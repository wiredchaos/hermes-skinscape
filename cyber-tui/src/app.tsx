/**
 * Cyber TUI — application root.
 *
 * Boot flow mirrors the audited upstream contract:
 *   gateway.ready → setup.status → session.most_recent → session.resume
 *   (or session.create) → live transcript + events.
 * The real Hermes gateway is always the source of truth.
 */

import React, { useEffect, useReducer, useRef, useState } from 'react'
import { Box, Text } from 'ink'

import { GatewayClient } from './gateway/client.js'
import type { GatewayEvent, SessionInfoPayload } from './gateway/types.js'
import { initialState, type CyberState } from './state/model.js'
import { hydrateTranscript, reduceEvent, transcriptFromMessages } from './state/adapters.js'
import { loadTheme, type CyberPalette } from './theme/theme.js'
import { CyberShell } from './components/shell.js'
import type { LayoutProfile } from './layout/engine.js'

function appReducer(state: CyberState, action: { type: 'event'; event: GatewayEvent } | { type: 'transcript'; lines: ReturnType<typeof transcriptFromMessages> } | { type: 'session'; ready: boolean }): CyberState {
  switch (action.type) {
    case 'event':
      return reduceEvent(state, action.event)
    case 'transcript':
      return hydrateTranscript(state, action.lines)
    case 'session':
      return { ...state, sessionReady: action.ready }
    default:
      return state
  }
}

export function CyberApp(): React.JSX.Element {
  const [state, dispatch] = useReducer(appReducer, undefined, initialState)
  const [palette, setPalette] = useState<CyberPalette | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [bootPhase, setBootPhase] = useState('loading theme…')
  const gwRef = useRef<GatewayClient | null>(null)
  const sessionIdRef = useRef<string>('')
  const [profile, setProfile] = useState<LayoutProfile>('command-center')

  useEffect(() => {
    let disposed = false
    void (async () => {
      try {
        const theme = await loadTheme()
        if (disposed) return
        setPalette(theme.palette)
      } catch {
        // loadTheme never throws; belt-and-braces.
      }
    })()
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!palette) {
      return
    }
    const gw = new GatewayClient()
    gwRef.current = gw

    gw.on('gateway.error', (payload) => {
      const msg = (payload as { message?: string })?.message ?? 'gateway error'
      setBootError(msg)
      setBootPhase(`ERROR: ${msg}`)
    })

    gw.subscribe((ev: GatewayEvent) => {
      dispatch({ type: 'event', event: ev })
    })

    gw.start()
    setBootPhase('starting gateway…')

    void (async () => {
      const setup = await gw.setupStatus()
      if (!setup.ok) {
        setBootError(`setup.status failed: ${setup.error.message}`)
        setBootPhase('SETUP REQUIRED')
        return
      }
      if (setup.value?.provider_configured === false) {
        setBootPhase('SETUP REQUIRED — NO PROVIDER')
        return
      }
      setBootPhase('resuming session…')

      // HERMES_CYBER_TUI_NEW_SESSION=1 starts a fresh session instead of
      // auto-resuming the most recent one (mirrors upstream start_new_session).
      // HERMES_CYBER_TUI_RESUME_SESSION=<stored_session_id> resumes THAT
      // specific session instead of the most recent one (mirrors `hermes
      // --resume <id>`), which keeps tests from hijacking the live session.
      const forceNew = process.env.HERMES_CYBER_TUI_NEW_SESSION === '1'
      const resumeTarget = process.env.HERMES_CYBER_TUI_RESUME_SESSION || ''
      let resume: Awaited<ReturnType<GatewayClient['resume']>> | null = null
      if (resumeTarget) {
        resume = await gw.resume(resumeTarget, 120)
      } else if (!forceNew) {
        const recent = await gw.mostRecent()
        if (recent.ok && recent.value?.session_id) {
          resume = await gw.resume(recent.value.session_id, 120)
        }
      }
      if (!resume || !resume.ok) {
        const created = await gw.create(120)
        if (created.ok && created.value?.info) {
          dispatch({ type: 'session', ready: true })
          // prompt.submit binds to the WORKING session_id from the create
          // response; stored_session_id is display-only (server.py:5177).
          sessionIdRef.current = created.value.session_id || created.value.info.stored_session_id || ''
          const info = created.value.info as SessionInfoPayload
          dispatch({ type: 'event', event: { type: 'session.info', payload: info } })
          setBootPhase('READY')
        } else {
          setBootError(created.ok ? 'session.create returned no info' : created.error.message)
          setBootPhase('ERROR')
        }
        return
      }
      const r = resume.value
      dispatch({ type: 'session', ready: true })
      sessionIdRef.current = r.session_id || r.resumed || r.info?.stored_session_id || ''
      if (r.info) {
        dispatch({ type: 'event', event: { type: 'session.info', payload: r.info as SessionInfoPayload } })
      }
      if (r.messages) {
        dispatch({ type: 'transcript', lines: transcriptFromMessages(r.messages) })
      }
      setBootPhase('READY')
    })()

    return () => {
      gw.stop()
      gwRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette])

  const handleCommand = (text: string): void => {
    // prompt.submit requires the WORKING session_id (methods_prompt.py:71);
    // the display stored_session_id does not map to the active slot.
    void gwRef.current?.submit(text, sessionIdRef.current || undefined)
  }

  if (!palette) {
    return (
      <Box paddingX={1}>
        <Text>loading…</Text>
      </Box>
    )
  }

  if (bootError) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1} borderStyle="round" borderColor={palette.red}>
        <Text bold color={palette.red}>
          HERMES // AGENTROPOLIS — GATEWAY ERROR
        </Text>
        <Text color={palette.textPrimary}>{bootError}</Text>
        <Text color={palette.muted}>Check ~/.hermes/logs/tui_gateway_crash.log for details.</Text>
        <Text color={palette.muted}>Press Esc to quit.</Text>
      </Box>
    )
  }

  return (
    <CyberShell
      state={state}
      palette={palette}
      gw={gwRef.current}
      onLayout={(p) => setProfile(p)}
      onCommand={handleCommand}
      ascii={!process.env.CYBER_TUI_UNICODE}
    />
  )
}
