import { describe, expect, it } from 'vitest'

import {
  breakpointForWidth,
  columnBudget,
  decideLayout,
  nextFocusedPanel,
  panelsForLayout,
  visiblePanelsFor,
  type LayoutProfile
} from '../src/layout/engine.js'

describe('responsive breakpoint selection', () => {
  it('selects wide >= 180 columns', () => {
    expect(breakpointForWidth(200)).toBe('wide')
    expect(breakpointForWidth(180)).toBe('wide')
  })

  it('selects operational at 120-179 columns', () => {
    expect(breakpointForWidth(179)).toBe('operational')
    expect(breakpointForWidth(120)).toBe('operational')
  })

  it('selects compact at 80-119 columns', () => {
    expect(breakpointForWidth(119)).toBe('compact')
    expect(breakpointForWidth(80)).toBe('compact')
  })

  it('selects narrow below 80 columns', () => {
    expect(breakpointForWidth(79)).toBe('narrow')
    expect(breakpointForWidth(40)).toBe('narrow')
  })
})

describe('layout profile switching', () => {
  it('command-center is three-column at wide widths', () => {
    const d = decideLayout(200, 'command-center')
    expect(d.threeColumn).toBe(true)
    expect(d.focusOnly).toBe(false)
  })

  it('command-center compresses to one rail at compact widths', () => {
    const d = decideLayout(100, 'command-center')
    expect(d.threeColumn).toBe(false)
    expect(d.oneRail).toBe(true)
    expect(d.focusOnly).toBe(false)
  })

  it('focus profile is always focus-only', () => {
    for (const cols of [240, 140, 100, 60]) {
      const d = decideLayout(cols, 'focus')
      expect(d.focusOnly).toBe(true)
      expect(d.threeColumn).toBe(false)
    }
  })

  it('narrow command-center degrades to focus-only', () => {
    const d = decideLayout(60, 'command-center')
    expect(d.focusOnly).toBe(true)
  })
})

describe('panel selection', () => {
  it('command-center wide shows left mission/tasks/agents and right system/approvals/activity/receipts', () => {
    const d = decideLayout(200, 'command-center')
    const { left, right } = panelsForLayout(d)
    expect(left).toEqual(['mission', 'tasks', 'agents'])
    expect(right).toEqual(['system', 'approvals', 'activity', 'receipts'])
  })

  it('focus layout renders no rails', () => {
    const d = decideLayout(200, 'focus')
    const { left, right } = panelsForLayout(d)
    expect(left).toEqual([])
    expect(right).toEqual([])
  })

  it('compact layout shows the operational rail only', () => {
    const d = decideLayout(100, 'command-center')
    const { left, right } = panelsForLayout(d)
    expect(left).toEqual([])
    expect(right).toEqual(['system', 'approvals', 'activity'])
  })
})

describe('column budget', () => {
  it('never produces zero-width or negative columns', () => {
    for (const cols of [200, 140, 100, 60, 30]) {
      const b = columnBudget(cols)
      expect(b.center).toBeGreaterThanOrEqual(20)
      expect(b.left).toBeGreaterThanOrEqual(24)
      expect(b.right).toBeGreaterThanOrEqual(24)
    }
  })

  it('center is the largest column at wide widths', () => {
    const b = columnBudget(200)
    expect(b.center).toBeGreaterThan(b.left)
    expect(b.center).toBeGreaterThan(b.right)
  })
})

describe('focused panel cycling (visual-state logic)', () => {
  const visible = ['mission', 'tasks', 'agents', 'system', 'approvals', 'activity', 'receipts'] as const

  it('null focus selects the first visible panel', () => {
    expect(nextFocusedPanel(visible, null)).toBe('mission')
  })

  it('wraps around to the first panel after the last', () => {
    expect(nextFocusedPanel(visible, 'receipts')).toBe('mission')
  })

  it('advances through the visible order', () => {
    expect(nextFocusedPanel(visible, 'mission')).toBe('tasks')
    expect(nextFocusedPanel(visible, 'system')).toBe('approvals')
  })

  it('unknown current focus snaps to the first panel', () => {
    expect(nextFocusedPanel(visible, 'not-a-panel' as never)).toBe('mission')
  })

  it('empty visible set stays null (no focusable panels)', () => {
    expect(nextFocusedPanel([], null)).toBeNull()
    expect(nextFocusedPanel([], 'mission' as never)).toBeNull()
  })

  it('focus mode exposes no panels', () => {
    const d = decideLayout(200, 'focus')
    expect(visiblePanelsFor(d)).toEqual([])
  })

  it('wide command center exposes all seven panels', () => {
    const d = decideLayout(200, 'command-center')
    expect(visiblePanelsFor(d)).toEqual(['mission', 'tasks', 'agents', 'system', 'approvals', 'activity', 'receipts'])
  })

  it('compact command center exposes only the operational rail', () => {
    const d = decideLayout(100, 'command-center')
    expect(visiblePanelsFor(d)).toEqual(['system', 'approvals', 'activity'])
  })
})
