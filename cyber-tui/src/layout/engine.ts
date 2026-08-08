/**
 * Cyber TUI — layout engine.
 *
 * Responsive breakpoints + layout profiles. Pure logic, unit-testable.
 * No upstream changes required: /layout is handled by the CyberShell command
 * bar; the upstream slash-command integration requirement is documented in
 * docs/CYBER_TUI_COMPATIBILITY.md.
 */

export type LayoutProfile = 'command-center' | 'focus'
export type Breakpoint = 'wide' | 'operational' | 'compact' | 'narrow'

export interface BreakpointRule {
  /** Minimum columns for this breakpoint (inclusive). */
  minCols: number
  label: string
}

/** Recommended breakpoints per the mission (>=180 / 120-179 / 80-119 / <80). */
export const BREAKPOINT_RULES: BreakpointRule[] = [
  { minCols: 180, label: 'WIDE' },
  { minCols: 120, label: 'OPERATIONAL' },
  { minCols: 80, label: 'COMPACT' },
  { minCols: 0, label: 'NARROW' }
]

export function breakpointForWidth(cols: number): Breakpoint {
  if (cols >= 180) return 'wide'
  if (cols >= 120) return 'operational'
  if (cols >= 80) return 'compact'
  return 'narrow'
}

export function breakpointLabel(cols: number): string {
  const bp = breakpointForWidth(cols)
  return BREAKPOINT_RULES.find((r) => r.label.toLowerCase().startsWith(bp))?.label ?? bp.toUpperCase()
}

export interface LayoutDecision {
  profile: LayoutProfile
  breakpoint: Breakpoint
  /** true when the three-column command center can render. */
  threeColumn: boolean
  /** true when a single contextual rail is shown beside the transcript. */
  oneRail: boolean
  /** true when only the focus layout (conversation-first) renders. */
  focusOnly: boolean
}

export function decideLayout(cols: number, profile: LayoutProfile): LayoutDecision {
  const breakpoint = breakpointForWidth(cols)
  if (profile === 'focus') {
    return { profile, breakpoint, threeColumn: false, oneRail: false, focusOnly: true }
  }
  switch (breakpoint) {
    case 'wide':
      return { profile, breakpoint, threeColumn: true, oneRail: false, focusOnly: false }
    case 'operational':
      return { profile, breakpoint, threeColumn: true, oneRail: false, focusOnly: false }
    case 'compact':
      return { profile, breakpoint, threeColumn: false, oneRail: true, focusOnly: false }
    case 'narrow':
    default:
      return { profile, breakpoint, threeColumn: false, oneRail: false, focusOnly: true }
  }
}

/** Column budget allocation for the three-column command center. */
export interface ColumnBudget {
  left: number
  center: number
  right: number
  header: number
  footer: number
}

export function columnBudget(cols: number): ColumnBudget {
  // Border-safe: 1 col border on each side + 1 separator each side of center.
  const usable = Math.max(cols - 4, 20)
  const rail = Math.max(24, Math.floor(usable * 0.24))
  const center = Math.max(usable - rail * 2, 20)
  return { left: rail, center, right: rail, header: cols, footer: cols }
}

/** Panel registry: which panels are visible for a given decision. */
export const COMMAND_CENTER_PANELS = [
  'mission',
  'tasks',
  'agents',
  'system',
  'approvals',
  'activity',
  'receipts'
] as const

export type PanelKey = (typeof COMMAND_CENTER_PANELS)[number]

/** Panels visible per breakpoint in command-center profile. */
export function panelsForLayout(decision: LayoutDecision): { left: PanelKey[]; right: PanelKey[] } {
  if (decision.focusOnly) {
    return { left: [], right: [] }
  }
  if (decision.threeColumn) {
    return {
      left: ['mission', 'tasks', 'agents'],
      right: ['system', 'approvals', 'activity', 'receipts']
    }
  }
  // Compact: one contextual rail — the operational essentials.
  return {
    left: [],
    right: ['system', 'approvals', 'activity']
  }
}
