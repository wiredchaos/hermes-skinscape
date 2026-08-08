/**
 * Cyber TUI — MVP panels.
 *
 * Every panel renders REAL state produced by the adapters; anything absent
 * shows an honest availability marker. Entropy/Drift are interfaces only —
 * they display PROVIDER NOT CONNECTED until a metric provider exists.
 */

import React from 'react'
import { Box, Text } from 'ink'

import type { CyberPalette } from '../theme/theme.js'
import type { CyberState } from '../state/model.js'
import { AvailabilityChip, CyberPanel, TelemetryRow, sparkline } from '../components/primitives.js'

// ── MISSION ───────────────────────────────────────────────────────────────

export function MissionPanel({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  const m = state.mission
  return (
    <CyberPanel title="MISSION" palette={palette} right={m.availability.label}>
      {m.availability.availability === 'live' ? (
        <>
          <Text color={palette.textPrimary} bold wrap="truncate">
            {m.title || 'UNTITLED MISSION'}
          </Text>
          <Text color={palette.muted} wrap="truncate">
            {m.workspace || '—'}
          </Text>
          <Text color={m.running ? palette.cyan : palette.muted}>{m.running ? '● RUNNING' : '○ IDLE'}</Text>
        </>
      ) : (
        <AvailabilityChip info={m.availability} palette={palette} />
      )}
    </CyberPanel>
  )
}

// ── TASKS (real todos from tool.complete) ─────────────────────────────────

export function TasksPanel({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  const t = state.tasks
  return (
    <CyberPanel title="TASKS" palette={palette} right={t.availability.label}>
      {t.availability.availability === 'live' && t.tasks.length > 0 ? (
        t.tasks.slice(0, 8).map((task) => {
          const done = /done|complete|completed/i.test(task.status)
          return (
            <Text key={task.id} wrap="truncate">
              <Text color={done ? palette.success : palette.muted}>{done ? '✓' : '○'} </Text>
              <Text color={done ? palette.muted : palette.textPrimary}>{task.content}</Text>
            </Text>
          )
        })
      ) : (
        <Text color={palette.muted}>{t.availability.availability === 'live' ? 'no todos yet' : t.availability.label}</Text>
      )}
    </CyberPanel>
  )
}

// ── AGENTS (tools/skills surfaced from session.info) ──────────────────────

export function AgentsPanel({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  const a = state.agents
  return (
    <CyberPanel title="AGENTS" palette={palette} right={a.availability.label}>
      {a.availability.availability === 'live' && a.agents.length > 0 ? (
        a.agents.slice(0, 10).map((agent) => (
          <Text key={agent.name} wrap="truncate">
            <Text color={agent.state === 'tool' ? palette.electricBlue : palette.magenta}>
              {agent.state === 'tool' ? '◆' : '◇'}{' '}
            </Text>
            <Text color={palette.textSecondary}>{agent.name}</Text>
          </Text>
        ))
      ) : (
        <Text color={palette.muted}>{a.availability.label}</Text>
      )}
    </CyberPanel>
  )
}

// ── SYSTEM (real session.info) ────────────────────────────────────────────

export function SystemPanel({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  const s = state.system
  return (
    <CyberPanel title="SYSTEM" palette={palette} right={s.availability.label}>
      {s.availability.availability === 'live' ? (
        <>
          <TelemetryRow label="MODEL" value={s.model || '—'} palette={palette} valueColor={palette.cyan} />
          <TelemetryRow label="PROVIDER" value={s.provider || '—'} palette={palette} />
          <TelemetryRow label="APPROVAL" value={s.yolo ? 'YOLO' : s.approvalMode || '—'} palette={palette} valueColor={s.yolo ? palette.red : palette.textPrimary} />
          <TelemetryRow label="SESSION" value={s.sessionId || '—'} palette={palette} />
          <Text color={palette.muted} wrap="truncate">
            {s.cwd || ''}
          </Text>
          {s.branch ? <Text color={palette.muted}>⎇ {s.branch}</Text> : null}
          {s.usage ? (
            <Text color={palette.muted}>
              tok {s.usage.total ?? '—'}
              {s.usage.prompt ? ` (p ${s.usage.prompt})` : ''}
            </Text>
          ) : null}
        </>
      ) : (
        <AvailabilityChip info={s.availability} palette={palette} />
      )}
    </CyberPanel>
  )
}

// ── APPROVALS (redacted approval.request) ─────────────────────────────────

export function ApprovalsPanel({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  const a = state.approvals
  return (
    <CyberPanel title="APPROVALS" palette={palette} right={a.availability.label}>
      {a.availability.availability === 'live' && a.pending.length > 0 ? (
        a.pending.slice(0, 5).map((item) => (
          <Box key={item.id} flexDirection="column" marginBottom={0}>
            <Text color={palette.red} wrap="truncate">
              ▲ {item.command || '(redacted)'}
            </Text>
            <Text color={palette.muted}>{item.choices.join(' | ') || '—'}</Text>
          </Box>
        ))
      ) : (
        <Text color={palette.muted}>{a.availability.availability === 'live' ? 'no pending approvals' : a.availability.label}</Text>
      )}
    </CyberPanel>
  )
}

// ── ACTIVITY (message/tool/status/error events) ───────────────────────────

export function ActivityPanel({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  const a = state.activity
  const series = a.entries.slice(-24).map((e) => (e.kind === 'tool' ? 3 : e.kind === 'error' ? 1 : 2))
  const colorFor = (kind: string): string =>
    kind === 'error' ? palette.red : kind === 'tool' ? palette.electricBlue : kind === 'reasoning' ? palette.magenta : palette.cyan
  return (
    <CyberPanel title="ACTIVITY" palette={palette} right={a.streaming ? '◉ STREAMING' : a.availability.label}>
      <Text color={palette.muted}>{sparkline(series, 28) || '—'}</Text>
      {a.entries.length > 0 ? (
        a.entries
          .slice(-6)
          .reverse()
          .map((e) => (
            <Text key={e.id} wrap="truncate">
              <Text color={colorFor(e.kind)}>{e.kind === 'tool' ? '◆' : e.kind === 'error' ? '▲' : '▸'} </Text>
              <Text color={palette.textSecondary}>{e.text}</Text>
            </Text>
          ))
      ) : (
        <Text color={palette.muted}>{a.availability.label}</Text>
      )}
    </CyberPanel>
  )
}

// ── RECEIPTS (message.complete / tool.complete / error) ───────────────────

export function ReceiptsPanel({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  const r = state.receipts
  return (
    <CyberPanel title="RECEIPTS" palette={palette} right={r.availability.label}>
      {r.availability.availability === 'live' && r.receipts.length > 0 ? (
        r.receipts.slice(0, 6).map((rec) => (
          <Text key={rec.id} wrap="truncate">
            <Text color={rec.kind === 'error' ? palette.red : rec.kind === 'tool' ? palette.electricBlue : palette.success}>
              {rec.kind === 'error' ? '✗' : rec.kind === 'tool' ? '◆' : '✓'}{' '}
            </Text>
            <Text color={palette.textSecondary}>{rec.text}</Text>
          </Text>
        ))
      ) : (
        <Text color={palette.muted}>{r.availability.label}</Text>
      )}
    </CyberPanel>
  )
}

// ── ENTROPY / DRIFT (interfaces; no invented values) ──────────────────────

export function EntropyMonitor({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  return (
    <CyberPanel title="ENTROPY" palette={palette} right={state.entropy.availability.label}>
      <Text color={palette.muted}>ENTROPY: {state.entropy.availability.label}</Text>
    </CyberPanel>
  )
}

export function DriftMonitor({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  return (
    <CyberPanel title="DRIFT" palette={palette} right={state.drift.availability.label}>
      <Text color={palette.muted}>DRIFT: {state.drift.availability.label}</Text>
    </CyberPanel>
  )
}

// ── Transcript (the REAL Hermes conversation) ─────────────────────────────

export function TranscriptPanel({ state, palette }: { state: CyberState; palette: CyberPalette }): React.JSX.Element {
  const colorFor = (role: string): string =>
    role === 'user' ? palette.cyan : role === 'tool' ? palette.electricBlue : role === 'error' ? palette.red : palette.textPrimary
  if (state.transcript.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color={palette.muted}>AWAITING DATA — no transcript yet.</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column" paddingX={1}>
      {state.transcript.slice(-40).map((line) => (
        <Text key={line.id} wrap="truncate">
          <Text color={colorFor(line.role)} bold>
            {line.role === 'user' ? 'YOU' : line.role === 'tool' ? 'TOOL' : 'HERMES'}
          </Text>
          <Text color={palette.muted}> ▸ </Text>
          <Text color={palette.textPrimary}>{line.text}</Text>
        </Text>
      ))}
    </Box>
  )
}
