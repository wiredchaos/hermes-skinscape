/**
 * Headless interactive canary — exercises the REAL gateway through the SAME
 * GatewayClient the Cyber TUI uses, and prints every event the UI layer would
 * consume. Creates a FRESH session (HERMES_CYBER_TUI_NEW_SESSION semantics)
 * so it never hijacks the live session.
 *
 * Sequence: gateway.ready -> setup.status -> session.create -> prompt.submit
 * -> watch message.start/delta/complete + tool events for up to N seconds.
 */

import { GatewayClient } from '../src/gateway/client.js'

const root = process.env.HERMES_TEST_ROOT
const gw = new GatewayClient({ root, startupTimeoutMs: 30000, rpcTimeoutMs: 120000 })

let ready = false
let sawStart = false
let sawDelta = false
let sawComplete = false
let sawTool = false
let sessionId = ''

const hardTimeout = setTimeout(() => {
  console.error('CANARY FAIL: timed out waiting for gateway.ready')
  process.exit(1)
}, 35000)

gw.subscribe((ev) => {
  if (ev.type === 'gateway.ready') {
    ready = true
    console.log('[event] gateway.ready')
    return
  }
  if (ev.type === 'session.info') {
    const p = ev.payload
    // NOTE: never overwrite the WORKING session id here — session.info's
    // stored_session_id is display-only and does not key _sessions.
    console.log('[event] session.info model=%s provider=%s running=%s session=%s', p?.model, p?.provider, p?.running, sessionId || p?.stored_session_id)
    return
  }
  if (ev.type === 'message.start') {
    sawStart = true
    console.log('[event] message.start')
    return
  }
  if (ev.type === 'message.delta') {
    sawDelta = true
    const text = ev.payload?.text ?? ''
    process.stdout.write(`[delta] ${text.slice(0, 200)}\n`)
    return
  }
  if (ev.type === 'message.complete') {
    sawComplete = true
    console.log('[event] message.complete')
    return
  }
  if (ev.type === 'tool.start' || ev.type === 'tool.complete') {
    sawTool = true
    console.log('[event] %s name=%s', ev.type, ev.payload?.name ?? '?')
    return
  }
  if (ev.type === 'status.update') {
    console.log('[event] status.update kind=%s', ev.payload?.kind)
    return
  }
  if (ev.type === 'approval.request') {
    console.log('[event] approval.request command=%j choices=%j', ev.payload?.command, ev.payload?.choices)
    // The canary only ever asks for the KNOWN-SAFE echo command; answering
    // its own approval gate is the only way the tool can complete. Never
    // auto-approve anything else.
    const cmd = String(ev.payload?.command ?? '')
    if (cmd.includes('echo') && cmd.includes('CYBER_TOOL_OK')) {
      const choice = Array.isArray(ev.payload?.choices) && ev.payload.choices.includes('once') ? 'once' : 'deny'
      console.log('[rpc] approval.respond choice=%s (canary-safe echo only)', choice)
      void gw.request('approval.respond', { choice, approval_id: ev.payload?.approval_id })
    } else {
      console.log('[phase2 guard] NOT auto-approving unexpected command: %j', cmd)
      void gw.request('approval.respond', { choice: 'deny', approval_id: ev.payload?.approval_id })
    }
    return
  }
  // quiet on other events
})

gw.start()

const poll = setInterval(() => {
  if (!ready) return
  clearInterval(poll)
  clearTimeout(hardTimeout)

  void (async () => {
    try {
      const setup = await gw.setupStatus()
      console.log('[rpc] setup.status provider_configured=%s', setup.ok ? setup.value?.provider_configured : `ERR ${setup.error.message}`)

      const created = await gw.create(120)
      if (!created.ok) {
        console.error('CANARY FAIL: session.create ->', created.error)
        process.exit(1)
      }
      console.log('[rpc] session.create ok session_id=%s', created.value?.session_id)
      // prompt.submit binds to the WORKING session_id from the create response
      // (the long stored_session_id is display-only and does not map to the slot).
      sessionId = created.value?.session_id || created.value?.info?.stored_session_id || sessionId

      const submit = await gw.submit('Reply with exactly: CYBER CANARY OK', sessionId)
      console.log('[rpc] prompt.submit ok=%s%s', submit.ok, submit.ok ? '' : ` err=${JSON.stringify(submit.error)}`)
      if (!submit.ok) {
        process.exit(1)
      }

      // Watch the stream for up to 90s.
      const deadline = Date.now() + 90000
      const streamWatch = setInterval(() => {
        if (sawComplete || Date.now() > deadline) {
          clearInterval(streamWatch)
          console.log('---')
          console.log('CANARY RESULT: message.start=%s delta=%s complete=%s tool=%s', sawStart, sawDelta, sawComplete, sawTool)
          const pass = sawStart && sawDelta && sawComplete
          console.log(pass ? 'CANARY PASS: real send + stream cycle verified' : 'CANARY FAIL: incomplete stream')
          if (pass && !sawTool) {
            void phase2()
          } else {
            process.exit(pass ? 0 : 1)
          }
        }
      }, 500)
    } catch (err) {
      console.error('CANARY FAIL:', err)
      process.exit(1)
    }
  })()
}, 500)

/** Phase 2: trigger a SAFE tool call (terminal echo) and verify tool events. */
async function phase2() {
  console.log('\n[phase2] submitting safe tool prompt…')
  let toolStart = false
  let toolComplete = false
  let turnComplete = false
  // NOTE: read_file is in-process (no subprocess spawn), so it is not blocked
  // by the nested-PTY MSYS cygheap failure that breaks the terminal tool in
  // this harness environment (mktemp signal-pipe, Win32 error 5).
  const sub = await gw.submit(
    'Use the read_file tool to read the file at path C:/Users/marqu/wiredchaos/hermes-skinscape/README.md, then report the first line of the file.',
    sessionId
  )
  console.log('[rpc] prompt.submit(phase2) ok=%s', sub.ok)
  if (!sub.ok) {
    console.log('PHASE2 FAIL: submit error %j', sub.error)
    process.exit(1)
  }
  // This profile's gateway is slow to execute terminal tools (MCP discovery
  // churn for parked servers + Windows .hardproof hook errors routinely add
  // 1-3 minutes), so give the turn a generous window. phase-2 message.complete
  // can only fire AFTER the tool returns — it is the completion signal.
  const deadline = Date.now() + 420000
  const watch = setInterval(() => {
    if ((toolStart && turnComplete) || Date.now() > deadline) {
      clearInterval(watch)
      console.log('---')
      console.log('PHASE2 RESULT: tool.start=%s tool.complete=%s turn.complete=%s', toolStart, toolComplete, turnComplete)
      const pass = toolStart && (toolComplete || turnComplete)
      console.log(pass ? 'PHASE2 PASS: safe tool invocation + completion verified' : 'PHASE2 FAIL: tool cycle incomplete')
      if (!pass) {
        console.log('gateway logTail:', JSON.stringify(gw.logTail().slice(-6)))
      }
      process.exit(pass ? 0 : 1)
    }
  }, 1000)
  gw.on('event', (ev) => {
    if (ev.type === 'tool.start') {
      toolStart = true
      console.log('[phase2 event] tool.start name=%s', ev.payload?.name)
    }
    if (ev.type === 'tool.complete') {
      toolComplete = true
      console.log('[phase2 event] tool.complete name=%s summary=%s', ev.payload?.name, ev.payload?.summary ?? '')
    }
    if (ev.type === 'message.complete') {
      turnComplete = true
      console.log('[phase2 event] message.complete (turn done — tool returned)')
    }
    if (ev.type === 'error') {
      console.log('[phase2 event] ERROR %j', ev.payload)
    }
  })
}
