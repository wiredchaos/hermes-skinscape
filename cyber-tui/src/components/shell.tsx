/**
 * Cyber TUI — CyberShell.
 *
 * The responsive shell: header strip, three-column command center (or focus
 * layout), and the command bar. Composes the real Hermes transcript with the
 * cyber panels. No fabricated telemetry — panels render adapter state only.
 */

import React, { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'

import type { CyberPalette } from '../theme/theme.js'
import type { CyberState } from '../state/model.js'
import { decideLayout, panelsForLayout, breakpointLabel, type LayoutProfile } from '../layout/engine.js'
import {
  ActivityPanel,
  AgentsPanel,
  ApprovalsPanel,
  DriftMonitor,
  EntropyMonitor,
  MissionPanel,
  ReceiptsPanel,
  SystemPanel,
  TasksPanel,
  TranscriptPanel
} from './panels.js'
import { ActivityPulse, CommandBar, StatusChip } from './primitives.js'
import type { GatewayClient } from '../gateway/client.js'

export interface CyberShellProps {
  state: CyberState
  palette: CyberPalette
  gw: GatewayClient | null
  onLayout: (profile: LayoutProfile) => void
  onCommand: (text: string) => void
  ascii?: boolean
  /** When false, the shell renders statically (no stdin raw mode). Used by the preview harness. */
  interactive?: boolean
}

function HeaderStrip({ state, palette, cols }: { state: CyberState; palette: CyberPalette; cols: number }): React.JSX.Element {
  const s = state.system
  const model = s.model || 'NO PROVIDER'
  const provider = s.provider || '—'
  const session = s.sessionId ? s.sessionId.slice(0, 8) : '—'
  const bp = breakpointLabel(cols)

  return (
    <Box width={cols} justifyContent="space-between" borderStyle="round" borderColor={palette.border} paddingX={1}>
      <Box flexShrink={0}>
        <Text bold color={palette.cyan}>
          HERMES <Text color={palette.red}>//</Text> AGENTROPOLIS
        </Text>
      </Box>
      <Box flexShrink={1} width="auto">
        <Text color={palette.muted} wrap="truncate">
          RUNTIME <Text color={palette.textSecondary}>{state.sessionReady ? 'LIVE' : 'BOOT'}</Text>
          {'  '}SESSION <Text color={palette.textSecondary}>{session}</Text>
          {'  '}MODEL <Text color={palette.textSecondary}>{model}</Text>
          {'  '}AGENTS <Text color={palette.textSecondary}>{state.agents.agents.length}</Text>
          {'  '}QUEUE <Text color={palette.textSecondary}>{state.activity.streaming ? '◉' : '—'}</Text>
          {'  '}STATE <Text color={palette.textSecondary}>{bp}</Text>
        </Text>
      </Box>
      <Box flexShrink={0}>
        <ActivityPulse active={state.system.running || state.activity.streaming} palette={palette} />
      </Box>
    </Box>
  )
}

function RailPanels({
  keys,
  state,
  palette
}: {
  keys: readonly string[]
  state: CyberState
  palette: CyberPalette
}): React.JSX.Element {
  const render = (key: string): React.JSX.Element | null => {
    switch (key) {
      case 'mission':
        return <MissionPanel state={state} palette={palette} />
      case 'tasks':
        return <TasksPanel state={state} palette={palette} />
      case 'agents':
        return <AgentsPanel state={state} palette={palette} />
      case 'system':
        return <SystemPanel state={state} palette={palette} />
      case 'approvals':
        return <ApprovalsPanel state={state} palette={palette} />
      case 'activity':
        return <ActivityPanel state={state} palette={palette} />
      case 'receipts':
        return <ReceiptsPanel state={state} palette={palette} />
      default:
        return null
    }
  }
  return (
    <Box flexDirection="column" width="100%" gap={0}>
      {keys.map((k) => (
        <Box key={k} marginBottom={1}>
          {render(k)}
        </Box>
      ))}
    </Box>
  )
}

export function CyberShell({ state, palette, gw, onLayout, onCommand, ascii, interactive = true }: CyberShellProps): React.JSX.Element {
  const { stdout } = useStdout()
  const { exit } = useApp()
  const cols = stdout.columns ?? 120
  const [profile, setProfile] = useState<LayoutProfile>('command-center')
  const [input, setInput] = useState('')

  const decision = decideLayout(cols, profile)
  const { left, right } = panelsForLayout(decision)

  useEffect(() => {
    if (gw && !state.sessionReady) {
      // Handled by the app-level boot flow; kept here for visual state only.
    }
  }, [gw, state.sessionReady])

  useInput(
    (_input, key) => {
      if (key.escape) {
        exit()
        return
      }
      if (key.return) {
        const text = input.trim()
        setInput('')
        if (text.startsWith('/layout ')) {
          const target = text.slice('/layout '.length).trim() as LayoutProfile
          if (target === 'command-center' || target === 'focus') {
            setProfile(target)
            onLayout(target)
          }
          return
        }
        if (text) {
          onCommand(text)
        }
        return
      }
      if (key.backspace || key.delete) {
        setInput((v) => v.slice(0, -1))
        return
      }
      if (_input && !key.ctrl) {
        setInput((v) => v + _input)
      }
    },
    { isActive: interactive }
  )

  const leftCol = decision.focusOnly ? null : (
    <Box width="24%" flexDirection="column" paddingRight={1}>
      <RailPanels keys={left} state={state} palette={palette} />
      {decision.threeColumn ? (
        <>
          <EntropyMonitor state={state} palette={palette} />
          <Box marginBottom={1} />
          <DriftMonitor state={state} palette={palette} />
        </>
      ) : null}
    </Box>
  )

  const rightCol = decision.focusOnly ? null : (
    <Box width={decision.threeColumn ? '24%' : '28%'} flexDirection="column" paddingLeft={1}>
      <RailPanels keys={right} state={state} palette={palette} />
    </Box>
  )

  return (
    <Box flexDirection="column" width={cols} paddingX={0}>
      <HeaderStrip state={state} palette={palette} cols={cols} />
      <Box width={cols} flexDirection="row" marginTop={1} marginBottom={1}>
        {leftCol}
        <Box width={decision.focusOnly ? '100%' : decision.threeColumn ? '52%' : '72%'} flexDirection="column" paddingX={1}>
          <Text color={palette.muted} dimColor>
            {profile.toUpperCase()} · {breakpointLabel(cols)}
            {decision.focusOnly ? ' · FOCUS' : decision.oneRail ? ' · COMPACT' : ' · COMMAND CENTER'}
          </Text>
          <Box flexDirection="column" marginTop={0}>
            <TranscriptPanel state={state} palette={palette} />
          </Box>
        </Box>
        {rightCol}
      </Box>
      <CommandBar value={input} palette={palette} ascii={ascii} />
      <Box width={cols} justifyContent="space-between">
        <Text color={palette.muted}>/layout command-center | /layout focus | Esc quit</Text>
        <Text color={palette.muted}>{decision.focusOnly ? 'CONVERSATION-FIRST' : decision.threeColumn ? 'FULL COMMAND CENTER' : decision.oneRail ? 'ONE RAIL' : 'FOCUS'}</Text>
      </Box>
    </Box>
  )
}
