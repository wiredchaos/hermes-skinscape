/**
 * Cyber TUI — shared component primitives.
 *
 * Terminal-safe primitives composed into the CyberShell layout. No custom
 * font dependency; box glyphs degrade gracefully where the terminal lacks
 * Unicode (ASCII fallback via the `ascii` flag).
 */

import React from 'react'
import { Box, Text } from 'ink'

import type { CyberPalette } from '../theme/theme.js'
import type { AvailabilityInfo } from '../state/model.js'

export interface ThemeProps {
  palette: CyberPalette
}

// ── Availability colors ───────────────────────────────────────────────────

export function availabilityColor(a: AvailabilityInfo, palette: CyberPalette): string {
  switch (a.availability) {
    case 'live':
      return palette.success
    case 'no_provider':
      return palette.warning
    case 'not_connected':
      return palette.warning
    case 'unavailable':
      return palette.red
    case 'awaiting':
    default:
      return palette.muted
  }
}

// ── StatusChip ────────────────────────────────────────────────────────────

export function StatusChip({ label, color }: { label: string; color: string }): React.JSX.Element {
  return (
    <Text color={color}>
      [<Text bold>{label}</Text>]
    </Text>
  )
}

export function AvailabilityChip({ info, palette }: { info: AvailabilityInfo; palette: CyberPalette }): React.JSX.Element {
  return <StatusChip label={info.label} color={availabilityColor(info, palette)} />
}

// ── PanelHeader ───────────────────────────────────────────────────────────

export function PanelHeader({
  title,
  palette,
  right
}: {
  title: string
  palette: CyberPalette
  right?: string
}): React.JSX.Element {
  const bar = '─'.repeat(Math.max(2, 6 - title.length))
  return (
    <Box width="100%" justifyContent="space-between">
      <Text color={palette.cyan} bold>
        ▚ {title} <Text color={palette.border}>{"\u2500".repeat(Math.max(2, 10))}</Text>
      </Text>
      {right ? <Text color={palette.muted}>{right}</Text> : null}
    </Box>
  )
}

// ── CyberPanel (bordered panel with header) ───────────────────────────────

export function CyberPanel({
  title,
  palette,
  right,
  children,
  width
}: {
  title: string
  palette: CyberPalette
  right?: string
  children: React.ReactNode
  width?: number
}): React.JSX.Element {
  return (
    <Box flexDirection="column" width={width ?? '100%'} borderStyle="round" borderColor={palette.border} paddingX={1} paddingY={0}>
      <PanelHeader title={title} palette={palette} right={right} />
      <Box flexDirection="column" marginTop={0}>
        {children}
      </Box>
    </Box>
  )
}

// ── ActivityPulse ─────────────────────────────────────────────────────────

export function ActivityPulse({ active, palette }: { active: boolean; palette: CyberPalette }): React.JSX.Element {
  return <Text color={active ? palette.cyan : palette.muted}>{active ? '◉' : '○'}</Text>
}

// ── Sparkline (pure string builder; terminal-safe) ────────────────────────

const SPARK_CHARS = '▁▂▃▄▅▆▇█'

export function sparkline(series: number[], width?: number): string {
  if (!series || series.length === 0) {
    return ''
  }
  const w = width ?? series.length
  const window = series.slice(-w)
  const max = Math.max(...window, 1)
  return window
    .map((v) => SPARK_CHARS[Math.min(7, Math.max(0, Math.floor((v / max) * 8)))] ?? '▁')
    .join('')
}

export function Sparkline({ series, palette, width }: { series: number[]; palette: CyberPalette; width?: number }): React.JSX.Element {
  return <Text color={palette.cyan}>{sparkline(series, width) || '—'}</Text>
}

// ── TelemetryRow ──────────────────────────────────────────────────────────

export function TelemetryRow({
  label,
  value,
  palette,
  valueColor
}: {
  label: string
  value: string
  palette: CyberPalette
  valueColor?: string
}): React.JSX.Element {
  return (
    <Box width="100%" justifyContent="space-between">
      <Text color={palette.muted}>{label}</Text>
      <Text color={valueColor ?? palette.textPrimary}>{value}</Text>
    </Box>
  )
}

// ── AlertBadge ────────────────────────────────────────────────────────────

export function AlertBadge({ text, tone, palette }: { text: string; tone: 'warn' | 'error' | 'ok'; palette: CyberPalette }): React.JSX.Element {
  const color = tone === 'error' ? palette.red : tone === 'warn' ? palette.warning : palette.success
  return (
    <Text color={color} bold>
      {tone === 'error' ? '⚠ ' : tone === 'warn' ? '▲ ' : '✓ '}
      {text}
    </Text>
  )
}

// ── CommandBar (bottom input) ─────────────────────────────────────────────

export function CommandBar({
  value,
  palette,
  ascii
}: {
  value: string
  palette: CyberPalette
  ascii?: boolean
}): React.JSX.Element {
  const promptSym = ascii ? '>' : '❯'
  return (
    <Box borderStyle="round" borderColor={palette.border} paddingX={1}>
      <Text color={palette.cyan} bold>
        {promptSym}{' '}
      </Text>
      <Text color={palette.textPrimary}>{value || <Text color={palette.muted}>awaiting input…</Text>}</Text>
    </Box>
  )
}
