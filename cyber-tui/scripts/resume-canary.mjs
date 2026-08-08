/**
 * Headless session-resume canary — resumes a SPECIFIC stored session id via the
 * same GatewayClient the Cyber TUI uses and reports whether the transcript
 * hydrated. Never resumes the live/most-recent session.
 */

import { GatewayClient } from '../src/gateway/client.js'

const target = process.argv[2]
if (!target) {
  console.error('usage: node resume-canary.js <stored_session_id>')
  process.exit(1)
}

const root = process.env.HERMES_TEST_ROOT
const gw = new GatewayClient({ root, startupTimeoutMs: 30000, rpcTimeoutMs: 60000 })

let ready = false
const hardTimeout = setTimeout(() => {
  console.error('RESUME FAIL: timed out waiting for gateway.ready')
  process.exit(1)
}, 35000)

gw.subscribe((ev) => {
  if (ev.type === 'gateway.ready') {
    ready = true
  }
})

gw.start()

const poll = setInterval(() => {
  if (!ready) return
  clearInterval(poll)
  clearTimeout(hardTimeout)

  void (async () => {
    try {
      const resumed = await gw.resume(target, 120)
      if (!resumed.ok) {
        console.error('RESUME FAIL:', resumed.error)
        process.exit(1)
      }
      const r = resumed.value
      console.log('[rpc] session.resume ok=true')
      console.log('  returned session_id :', r?.session_id)
      console.log('  stored_session_id   :', r?.info?.stored_session_id)
      console.log('  messages hydrated   :', Array.isArray(r?.messages) ? r.messages.length : 'none')
      console.log('  model               :', r?.info?.model)
      console.log('  provider            :', r?.info?.provider)
      const pass = Boolean(r?.session_id || r?.info?.stored_session_id)
      console.log(pass ? 'RESUME PASS: specific session resumed' : 'RESUME FAIL: no session bound')
      process.exit(pass ? 0 : 1)
    } catch (err) {
      console.error('RESUME FAIL:', err)
      process.exit(1)
    }
  })()
}, 500)
