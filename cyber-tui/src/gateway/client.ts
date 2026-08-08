/**
 * Cyber TUI — gateway client.
 *
 * Spawns the real Hermes gateway (`python -m tui_gateway.entry`) as a child
 * process and speaks newline-delimited JSON-RPC 2.0 over its stdio — the same
 * contract the upstream Ink TUI uses (ui-tui/src/gatewayClient.ts:356).
 *
 * No fabricated data: every value rendered by the Cyber TUI originates from
 * this client's event stream or RPC responses.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import { delimiter, resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { EventEmitter } from 'node:events'

import type {
  GatewayEvent,
  GatewayFrame,
  MostRecentResponse,
  RpcError,
  RpcRequest,
  SessionCreateResponse,
  SessionResumeResponse,
  SetupStatusResponse
} from './types.js'

export interface GatewayClientOptions {
  /** Override the Hermes source root (default: HERMES_PYTHON_SRC_ROOT or ~/.hermes/hermes-agent). */
  root?: string
  /** Override the Python executable (default: HERMES_PYTHON / VIRTUAL_ENV / root/.venv). */
  python?: string
  /** Startup timeout in ms (default 15000, env HERMES_TUI_STARTUP_TIMEOUT_MS). */
  startupTimeoutMs?: number
  /** RPC timeout in ms (default 120000, env HERMES_TUI_RPC_TIMEOUT_MS). */
  rpcTimeoutMs?: number
  /** Working directory for the gateway child (default HERMES_CWD or root). */
  cwd?: string
}

export interface RpcResult<T> {
  ok: true
  value: T
}

export interface RpcFailure {
  ok: false
  error: RpcError
}

export type RpcOutcome<T> = RpcResult<T> | RpcFailure

const MAX_LOG_LINES = 200
const MAX_LOG_LINE_BYTES = 4096

function truncateLine(line: string): string {
  return line.length > MAX_LOG_LINE_BYTES ? `${line.slice(0, MAX_LOG_LINE_BYTES)}…` : line
}

function findPython(root: string, explicit?: string): string {
  if (explicit && explicit.trim()) {
    return explicit.trim()
  }
  const configured = process.env.HERMES_PYTHON?.trim() || process.env.PYTHON?.trim()
  if (configured) {
    return configured
  }
  const venv = process.env.VIRTUAL_ENV?.trim()
  const candidates = [
    venv && resolve(venv, 'bin/python'),
    venv && resolve(venv, 'Scripts/python.exe'),
    resolve(root, '.venv/bin/python'),
    resolve(root, '.venv/bin/python3'),
    resolve(root, 'venv/bin/python'),
    resolve(root, 'venv/bin/python3'),
    resolve(root, '.venv/Scripts/python.exe'),
    resolve(root, 'venv/Scripts/python.exe')
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    if (existsSync(p)) {
      return p
    }
  }
  return process.platform === 'win32' ? 'python' : 'python3'
}

function defaultRoot(): string {
  const fromEnv = process.env.HERMES_PYTHON_SRC_ROOT?.trim()
  if (fromEnv) {
    return fromEnv
  }
  const home = process.env.HERMES_HOME?.trim() || join(homedir(), '.hermes')
  return join(home, 'hermes-agent')
}

function defaultCwd(root: string): string {
  return process.env.HERMES_CWD?.trim() || root
}

/**
 * Minimal gateway client: spawn, connect, request/response with id
 * correlation, and an 'event' emitter for the typed event stream.
 */
export class GatewayClient extends EventEmitter {
  private proc: ChildProcess | null = null
  private stdoutRl: Interface | null = null
  private stderrRl: Interface | null = null
  private ready = false
  private nextId = 1
  private pending = new Map<number, { resolve: (r: RpcOutcome<unknown>) => void; timer: NodeJS.Timeout }>()
  private bufferedEvents: GatewayEvent[] = []
  private subscribed = false
  private logs: string[] = []
  private root: string
  private python: string
  private startupTimeoutMs: number
  private rpcTimeoutMs: number
  private cwd: string

  constructor(opts: GatewayClientOptions = {}) {
    super()
    this.setMaxListeners(0)
    this.root = opts.root ?? defaultRoot()
    this.python = findPython(this.root, opts.python)
    this.startupTimeoutMs =
      opts.startupTimeoutMs ?? (parseInt(process.env.HERMES_TUI_STARTUP_TIMEOUT_MS ?? '15000', 10) || 15000)
    this.rpcTimeoutMs =
      opts.rpcTimeoutMs ?? (parseInt(process.env.HERMES_TUI_RPC_TIMEOUT_MS ?? '120000', 10) || 120000)
    this.cwd = opts.cwd ?? defaultCwd(this.root)
  }

  get gatewayRoot(): string {
    return this.root
  }

  get gatewayPython(): string {
    return this.python
  }

  logTail(): string[] {
    return this.logs.slice(-10)
  }

  private pushLog(line: string): void {
    this.logs.push(truncateLine(line))
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_LINES)
    }
  }

  start(): void {
    const env = { ...process.env }
    const pyPath = env.PYTHONPATH?.trim()
    env.PYTHONPATH = pyPath ? `${this.root}${delimiter}${pyPath}` : this.root
    env.HERMES_PYTHON_SRC_ROOT = this.root

    this.proc = spawn(this.python, ['-m', 'tui_gateway.entry'], {
      cwd: this.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.proc.on('error', (err) => {
      this.pushLog(`[spawn] ${err.message}`)
      this.emit('gateway.error', { message: err.message })
    })

    this.proc.on('exit', (code, signal) => {
      this.pushLog(`[exit] code=${code} signal=${signal}`)
      this.ready = false
      this.rejectPending(new Error(`gateway exited (code=${code} signal=${signal})`))
      this.emit('gateway.exit', { code, signal })
    })

    this.stdoutRl = createInterface({ input: this.proc.stdout! })
    this.stdoutRl.on('line', (raw) => {
      try {
        this.dispatch(JSON.parse(raw) as GatewayFrame)
      } catch {
        this.pushLog(`[protocol] malformed line: ${raw.trim().slice(0, 240)}`)
      }
    })

    this.stderrRl = createInterface({ input: this.proc.stderr! })
    this.stderrRl.on('line', (raw) => {
      this.pushLog(`[stderr] ${raw}`)
    })

    // If the gateway never emits gateway.ready, surface a startup failure.
    const timer = setTimeout(() => {
      if (!this.ready) {
        this.pushLog('[startup] timed out waiting for gateway.ready')
        this.emit('gateway.error', {
          message: `gateway startup timed out (python=${this.python}, cwd=${this.cwd})`,
          logTail: this.logTail()
        })
      }
    }, this.startupTimeoutMs)
    timer.unref()
  }

  stop(): void {
    this.rejectPending(new Error('gateway stopped'))
    this.stdoutRl?.close()
    this.stderrRl?.close()
    this.proc?.kill()
    this.proc = null
  }

  private rejectPending(err: Error): void {
    for (const { resolve, timer } of this.pending.values()) {
      clearTimeout(timer)
      resolve({ ok: false, error: { code: -32000, message: err.message } })
    }
    this.pending.clear()
  }

  private dispatch(frame: GatewayFrame): void {
    if ('method' in frame && frame.method === 'event') {
      const ev = (frame.params?.type ? frame.params : null) as { type: string; payload?: unknown } | null
      if (!ev || typeof ev.type !== 'string') {
        return
      }
      const event: GatewayEvent = { type: ev.type, payload: ev.payload } as GatewayEvent
      if (event.type === 'gateway.ready') {
        this.ready = true
      }
      if (this.subscribed) {
        this.emit('event', event)
      } else {
        this.bufferedEvents.push(event)
      }
      return
    }

    if ('id' in frame && typeof frame.id === 'number') {
      const waiter = this.pending.get(frame.id)
      if (!waiter) {
        return
      }
      this.pending.delete(frame.id)
      clearTimeout(waiter.timer)
      if (frame.error) {
        waiter.resolve({ ok: false, error: frame.error })
      } else {
        waiter.resolve({ ok: true, value: frame.result })
      }
    }
  }

  /** Subscribe to the typed event stream (replays buffered startup events). */
  subscribe(onEvent: (ev: GatewayEvent) => void): () => void {
    const handler = (ev: GatewayEvent): void => onEvent(ev)
    this.on('event', handler)
    this.subscribed = true
    const buffered = this.bufferedEvents
    this.bufferedEvents = []
    for (const ev of buffered) {
      handler(ev)
    }
    return () => {
      this.off('event', handler)
    }
  }

  request<T>(method: string, params?: Record<string, unknown>): Promise<RpcOutcome<T>> {
    if (!this.proc || !this.proc.stdin?.writable) {
      return Promise.resolve({ ok: false, error: { code: -32000, message: 'gateway not running' } })
    }
    const id = this.nextId++
    const req: RpcRequest = { jsonrpc: '2.0', id, method, params: params ?? {} }
    return new Promise((resolveOuter) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolveOuter({ ok: false, error: { code: -32001, message: `rpc timeout: ${method}` } })
      }, this.rpcTimeoutMs)
      timer.unref()
      this.pending.set(id, { resolve: resolveOuter as (r: RpcOutcome<unknown>) => void, timer })
      this.proc!.stdin!.write(JSON.stringify(req) + '\n')
    })
  }

  // ── Typed convenience calls (only what the Cyber TUI actually uses) ──────

  setupStatus(): Promise<RpcOutcome<SetupStatusResponse>> {
    return this.request<SetupStatusResponse>('setup.status', {})
  }

  mostRecent(): Promise<RpcOutcome<MostRecentResponse>> {
    return this.request<MostRecentResponse>('session.most_recent', {})
  }

  resume(sessionId: string, cols: number): Promise<RpcOutcome<SessionResumeResponse>> {
    return this.request<SessionResumeResponse>('session.resume', { session_id: sessionId, cols })
  }

  create(cols: number): Promise<RpcOutcome<SessionCreateResponse>> {
    return this.request<SessionCreateResponse>('session.create', { cols })
  }

  submit(text: string, sessionId?: string): Promise<RpcOutcome<unknown>> {
    const params: Record<string, unknown> = { text }
    if (sessionId) {
      params.session_id = sessionId
    }
    return this.request('prompt.submit', params)
  }
}
