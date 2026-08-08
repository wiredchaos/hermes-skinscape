/**
 * Real gateway smoke test (not part of vitest suite — requires a local
 * Hermes install). Spawns the actual tui_gateway through the Cyber TUI
 * GatewayClient and verifies gateway.ready + one real RPC round-trip.
 */

import { GatewayClient } from '../src/gateway/client.js'

const root = process.env.HERMES_TEST_ROOT
const gw = new GatewayClient({ root, startupTimeoutMs: 20000, rpcTimeoutMs: 30000 })

let ready = false
let events = 0
const timeout = setTimeout(() => {
  console.error('SMOKE FAIL: gateway.ready not seen in time')
  console.error('logTail:', gw.logTail())
  process.exit(1)
}, 30000)

gw.subscribe((ev) => {
  events += 1
  if (ev.type === 'gateway.ready') {
    ready = true
  }
})

gw.on('gateway.error', (p) => {
  console.error('gateway.error:', p)
})

gw.start()

const poll = setInterval(() => {
  if (!ready) return
  clearInterval(poll)
  clearTimeout(timeout)
  void (async () => {
    try {
      const setup = await gw.setupStatus()
      if (!setup.ok) {
        console.error('SMOKE FAIL: setup.status error', setup.error)
        process.exit(1)
      }
      console.log('SMOKE PASS: gateway.ready seen, events =', events)
      console.log('setup.status:', JSON.stringify(setup.value))
      const recent = await gw.mostRecent()
      console.log('session.most_recent:', JSON.stringify(recent.ok ? recent.value : recent.error))
      gw.stop()
      process.exit(0)
    } catch (err) {
      console.error('SMOKE FAIL:', err)
      process.exit(1)
    }
  })()
}, 500)
