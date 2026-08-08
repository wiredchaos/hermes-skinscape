/**
 * Cyber TUI — shared component primitives.
 *
 * Terminal-safe primitives composed into the CyberShell layout. No custom
 * font dependency; box glyphs degrade gracefully where the terminal lacks
 * Unicode (ASCII fallback via the `ascii` flag).
 *
 * Semantic color language (Agentropolis Obsidian):
 *   CYAN    — navigation, live system structure, active connections
 *   RED     — alerts, high-priority accents, AGENTROPOLIS identity
 *   GREEN   — healthy / confirmed
 *   AMBER   — waiting / warning
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
      return palette.warning
  }
}

// ── StatusChip ────────────────────────────────────────────────────────────

export type ChipTone = 'cyan' | 'red' | 'green' | 'amber' | 'muted' | 'magenta'

export function toneColor(tone: ChipTone, palette: CyberPalette): string {
  switch (tone) {
    case 'cyan':
      return palette.cyan
    case 'red':
      return palette.red
    case 'green':
      return palette.success
    case 'amber':
      return palette.warning
    case 'magenta':
      return palette.magenta
    case 'muted':
    default:
      return palette.muted
  }
}

export function StatusChip({
  label,
  tone,
  palette,
  bright
}: {
  label: string
  tone: ChipTone
  palette: CyberPalette
  bright?: boolean
}): React.JSX.Element {
  const color = toneColor(tone, palette)
  return (
    <Text color={color}>
      [<Text bold={bright ?? true}>{label}</Text>]
    </Text>
  )
}

export function AvailabilityChip({ info, palette }: { info: AvailabilityInfo; palette: CyberPalette }): React.JSX.Element {
  const tone: ChipTone =
    info.availability === 'live' ? 'green' : info.availability === 'no_provider' || info.availability === 'not_connected' ? 'amber' : info.availability === 'unavailable' ? 'red' : 'amber'
  return <StatusChip label={info.label} tone={tone} palette={palette} />
}

// ── CyberDivider ──────────────────────────────────────────────────────────

export function CyberDivider({
  palette,
  tone = 'cyan',
  width
}: {
  palette: CyberPalette
  tone?: ChipTone
  width?: number
}): React.JSX.Element {
  const color = toneColor(tone, palette)
  const w = width ?? 24
  return (
    <Box width="100%">
      <Text color={color}>▚</Text>
      <Text color={palette.border}>{'─'.repeat(Math.max(2, w - 1))}</Text>
    </Box>
  )
}

// ── PanelHeader ───────────────────────────────────────────────────────────

export function PanelHeader({
  title,
  palette,
  right,
  active
}: {
  title: string
  palette: CyberPalette
  right?: string
  active?: boolean
}): React.JSX.Element {
  const accent = active ? palette.cyan : palette.border
  return (
    <Box width="100%" justifyContent="space-between">
      <Text color={accent} bold>
        ▚ <Text color={active ? palette.cyan : palette.textSecondary}>{title}</Text>{' '}
        <Text color={palette.border}>{'─'.repeat(Math.max(2, 10))}</Text>
      </Text>
      {right ? <Text color={palette.muted}>{right}</Text> : null}
    </Box>
  )
}

// ── CyberPanel (bordered panel with header + focus state) ─────────────────

export function CyberPanel({
  title,
  palette,
  right,
  children,
  width,
  focused,
  tone = 'cyan'
}: {
  title: string
  palette: CyberPalette
  right?: string
  children: React.ReactNode
  width?: number
  /** Focused panels get a bright cyan border (the selected panel state). */
  focused?: boolean
  /** Header accent tone (default cyan structural). */
  tone?: ChipTone
}): React.JSX.Element {
  const borderColor = focused ? palette.cyan : palette.border
  return (
    <Box
      flexDirection="column"
      width={width ?? '100%'}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
    >
      <PanelHeader title={title} palette={palette} right={right} active={focused} />
      <Box flexDirection="column" marginTop={0}>
        {children}
      </Box>
    </Box>
  )
}

// ── ActivityPulse ─────────────────────────────────────────────────────────

export function ActivityPulse({
  active,
  palette,
  tone = 'cyan'
}: {
  active: boolean
  palette: CyberPalette
  tone?: ChipTone
}): React.JSX.Element {
  return <Text color={active ? toneColor(tone, palette) : palette.muted}>{active ? '◉' : '○'}</Text>
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
  valueColor,
  labelWidth
}: {
  label: string
  value: string
  palette: CyberPalette
  valueColor?: string
  labelWidth?: number
}): React.JSX.Element {
  const lw = labelWidth ?? 9
  return (
    <Box width="100%" justifyContent="space-between">
      <Text color={palette.muted}>
        {label.padEnd(lw, ' ')}
      </Text>
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

// ── CommandComposer (bottom input with identity + hint rail) ──────────────

export function CommandComposer({
  value,
  palette,
  ascii,
  hint
}: {
  value: string
  palette: CyberPalette
  ascii?: boolean
  /** Right-side hint rail (e.g. layout + streaming state). */
  hint?: string
}): React.JSX.Element {
  const promptSym = ascii ? '>' : '❯'
  return (
    <Box flexDirection="column" width="100%">
      <CyberDivider palette={palette} tone="cyan" width={60} />
      <Box borderStyle="round" borderColor={palette.border} paddingX={1} justifyContent="space-between">
        <Box>
          <Text color={palette.red} bold>
            HERMES{' '}
          </Text>
          <Text color={palette.cyan} bold>
            COMMAND{' '}
          </Text>
          <Text color={palette.muted}>{promptSym}</Text>
          <Text color={palette.textPrimary}> {value || <Text color={palette.muted}>awaiting input…</Text>}</Text>
        </Box>
        {hint ? <Text color={palette.muted}>{hint}</Text> : null}
      </Box>
    </Box>
  )
}
