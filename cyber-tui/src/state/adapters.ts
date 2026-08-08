/**
 * Cyber TUI — event adapters.
 *
 * Pure functions that map raw GatewayEvents into panel state. NO fabrication:
 * each adapter only fills fields that exist in the event payload; anything
 * absent stays on its availability marker.
 */

import type { GatewayEvent, SessionInfoPayload, ToolCompletePayload, TranscriptMessage } from '../gateway/types.js'
import {
  AWAITING,
  EMPTY_AGENTS,
  EMPTY_APPROVALS,
  EMPTY_MISSION,
  EMPTY_RECEIPTS,
  EMPTY_SYSTEM,
  EMPTY_TASKS,
  live,
  NOT_CONNECTED,
  type ActivityEntry,
  type ActivityState,
  type AgentsState,
  type ApprovalItem,
  type ApprovalsState,
  type CyberState,
  type MissionState,
  type ReceiptsState,
  type SystemState,
  type TaskItem,
  type TasksState,
  type TranscriptLine
} from '../state/model.js'

let seq = 0
function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

// ── session.info → SYSTEM + MISSION ───────────────────────────────────────

export function systemFromInfo(info: SessionInfoPayload | undefined, base: SystemState): SystemState {
  if (!info || typeof info !== 'object') {
    return { ...base, availability: NOT_CONNECTED }
  }
  const usage = info.usage && typeof info.usage === 'object' ? info.usage : undefined
  return {
    availability: live(),
    model: info.model || base.model || '',
    provider: info.provider || base.provider || '',
    approvalMode: info.approval_mode || '',
    yolo: Boolean(info.yolo),
    running: Boolean(info.running),
    cwd: info.cwd || '',
    branch: info.branch || '',
    sessionId: info.stored_session_id || base.sessionId || '',
    title: info.title || '',
    usage: usage
      ? {
          total: usage.total_tokens != null ? String(usage.total_tokens) : undefined,
          prompt: usage.prompt_tokens != null ? String(usage.prompt_tokens) : undefined,
          completion: usage.completion_tokens != null ? String(usage.completion_tokens) : undefined
        }
      : null,
    version: info.version || ''
  }
}

export function missionFromInfo(info: SessionInfoPayload | undefined, base: MissionState): MissionState {
  if (!info || typeof info !== 'object') {
    return { ...base, availability: NOT_CONNECTED }
  }
  return {
    availability: live(),
    title: info.title || base.title || '',
    workspace: info.cwd || base.workspace || '',
    running: Boolean(info.running)
  }
}

// ── tool.complete → TASKS (the todos source of truth) ─────────────────────

export function tasksFromToolComplete(payload: ToolCompletePayload | undefined, base: TasksState): TasksState {
  const todos = payload?.todos
  if (!Array.isArray(todos) || todos.length === 0) {
    // No todos in this event — keep previous state but mark availability.
    return base
  }
  const tasks: TaskItem[] = todos
    .map((t, i) => ({
      id: String(t?.id ?? `todo-${i}`),
      content: String(t?.content ?? ''),
      status: String(t?.status ?? 'pending')
    }))
    .filter((t) => t.content)
  return {
    availability: live(),
    tasks
  }
}

// ── Events → ACTIVITY + RECEIPTS ──────────────────────────────────────────

export function activityFromEvent(ev: GatewayEvent, state: ActivityState): ActivityState {
  const now = Date.now()
  let entry: ActivityEntry | null = null
  let streaming = state.streaming

  switch (ev.type) {
    case 'message.start':
      streaming = true
      entry = { id: nextId('msg'), kind: 'message', text: 'message streaming…', at: now }
      break
    case 'message.delta':
      streaming = true
      entry = {
        id: nextId('delta'),
        kind: 'message',
        text: (ev.payload as { text?: string })?.text?.trim() || '…',
        at: now
      }
      break
    case 'message.complete':
      streaming = false
      entry = {
        id: nextId('done'),
        kind: 'message',
        text: (ev.payload as { text?: string })?.text?.slice(0, 160) || 'message complete',
        at: now
      }
      break
    case 'tool.start':
      entry = {
        id: nextId('tool'),
        kind: 'tool',
        text: `${(ev.payload as { name?: string })?.name ?? 'tool'} starting…`,
        at: now
      }
      break
    case 'tool.complete':
      entry = {
        id: nextId('tool'),
        kind: 'tool',
        text: (ev.payload as { summary?: string })?.summary || `${(ev.payload as { name?: string })?.name ?? 'tool'} complete`,
        at: now
      }
      break
    case 'status.update':
      entry = {
        id: nextId('status'),
        kind: 'status',
        text: (ev.payload as { text?: string })?.text || (ev.payload as { kind?: string })?.kind || '',
        at: now
      }
      break
    case 'error':
      entry = { id: nextId('err'), kind: 'error', text: String((ev.payload as { message?: string })?.message ?? 'error'), at: now }
      break
    case 'reasoning.delta':
      entry = {
        id: nextId('reason'),
        kind: 'reasoning',
        text: (ev.payload as { text?: string })?.text?.trim() || 'reasoning…',
        at: now
      }
      break
    default:
      break
  }

  if (!entry) {
    return state
  }

  return {
    availability: live(),
    streaming,
    entries: [...state.entries.slice(-19), entry]
  }
}

export function receiptsFromEvent(ev: GatewayEvent, state: ReceiptsState): ReceiptsState {
  const now = Date.now()
  let receipt: { kind: 'assistant' | 'tool' | 'error'; text: string } | null = null

  switch (ev.type) {
    case 'message.complete':
      receipt = {
        kind: 'assistant',
        text: (ev.payload as { text?: string })?.text?.slice(0, 120) || 'message complete'
      }
      break
    case 'tool.complete': {
      const p = ev.payload as ToolCompletePayload
      receipt = {
        kind: 'tool',
        text: p?.summary || `${p?.name ?? 'tool'} → ${String(p?.duration_s ?? '')}s`
      }
      break
    }
    case 'error':
      receipt = { kind: 'error', text: String((ev.payload as { message?: string })?.message ?? 'error') }
      break
    default:
      break
  }

  if (!receipt) {
    return state
  }

  return {
    availability: live(),
    receipts: [{ id: nextId('rec'), ...receipt, at: now }, ...state.receipts].slice(0, 12)
  }
}

// ── approval.request → APPROVALS ──────────────────────────────────────────

export function approvalsFromRequest(
  payload: { command?: string; choices?: string[] } | undefined,
  state: ApprovalsState
): ApprovalsState {
  if (!payload || typeof payload !== 'object') {
    return state
  }
  const item: ApprovalItem = {
    id: nextId('aprv'),
    command: String(payload.command ?? ''),
    choices: Array.isArray(payload.choices) ? payload.choices.map(String) : [],
    at: Date.now()
  }
  return {
    availability: live(),
    pending: [item, ...state.pending].slice(0, 8)
  }
}

// ── session.info tools/skills → AGENTS ────────────────────────────────────

export function agentsFromInfo(info: SessionInfoPayload | undefined, base: AgentsState): AgentsState {
  if (!info || typeof info !== 'object') {
    return { ...base, availability: NOT_CONNECTED }
  }
  const tools = info.tools && typeof info.tools === 'object' ? Object.keys(info.tools) : []
  const skills = info.skills && typeof info.skills === 'object' ? Object.keys(info.skills) : []
  if (tools.length === 0 && skills.length === 0) {
    return { ...base, availability: { availability: 'awaiting', label: 'AWAITING DATA' } }
  }
  const agents: { name: string; state: string }[] = [
    ...tools.slice(0, 8).map((t) => ({ name: t, state: 'tool' })),
    ...skills.slice(0, 8).map((s) => ({ name: s, state: 'skill' }))
  ]
  return { availability: live(), agents }
}

// ── Transcript hydration from session.resume/create ───────────────────────

export function transcriptFromMessages(messages: TranscriptMessage[] | undefined): TranscriptLine[] {
  if (!Array.isArray(messages)) {
    return []
  }
  return messages
    .map((m) => ({
      id: nextId('t'),
      role: (m.role ?? 'system') as TranscriptLine['role'],
      text: m.text ?? m.context ?? '',
      at: Date.now()
    }))
    .filter((m) => m.text.trim())
}

// ── Full reducer: apply one event to the aggregate state ──────────────────

export function reduceEvent(state: CyberState, ev: GatewayEvent): CyberState {
  switch (ev.type) {
    case 'session.info': {
      const info = ev.payload as SessionInfoPayload | undefined
      return {
        ...state,
        system: systemFromInfo(info, state.system),
        mission: missionFromInfo(info, state.mission),
        agents: agentsFromInfo(info, state.agents)
      }
    }
    case 'tool.complete':
      return {
        ...state,
        tasks: tasksFromToolComplete(ev.payload as ToolCompletePayload | undefined, state.tasks),
        activity: activityFromEvent(ev, state.activity),
        receipts: receiptsFromEvent(ev, state.receipts)
      }
    case 'approval.request':
      return { ...state, approvals: approvalsFromRequest(ev.payload as { command?: string; choices?: string[] } | undefined, state.approvals) }
    default:
      return {
        ...state,
        activity: activityFromEvent(ev, state.activity),
        receipts: receiptsFromEvent(ev, state.receipts)
      }
  }
}

export function hydrateTranscript(state: CyberState, lines: TranscriptLine[]): CyberState {
  if (lines.length === 0) {
    return state
  }
  const existing = new Set(state.transcript.map((t) => t.text))
  const fresh = lines.filter((l) => !existing.has(l.text))
  return {
    ...state,
    transcript: [...state.transcript, ...fresh].slice(-400)
  }
}
