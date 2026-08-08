import { describe, expect, it } from 'vitest'

import { initialState } from '../src/state/model.js'

describe('panel fallback states', () => {
  const s = initialState()

  it('system starts NOT CONNECTED', () => {
    expect(s.system.availability.label).toBe('NOT CONNECTED')
    expect(s.system.model).toBe('')
  })

  it('activity starts AWAITING DATA', () => {
    expect(s.activity.availability.label).toBe('AWAITING DATA')
    expect(s.activity.entries).toHaveLength(0)
  })

  it('tasks starts AWAITING DATA', () => {
    expect(s.tasks.availability.label).toBe('AWAITING DATA')
    expect(s.tasks.tasks).toHaveLength(0)
  })

  it('approvals starts AWAITING DATA', () => {
    expect(s.approvals.availability.label).toBe('AWAITING DATA')
  })

  it('receipts starts AWAITING DATA', () => {
    expect(s.receipts.availability.label).toBe('AWAITING DATA')
  })

  it('agents starts NO PROVIDER', () => {
    expect(s.agents.availability.label).toBe('NO PROVIDER')
  })

  it('entropy/drift start PROVIDER NOT CONNECTED (no invented values)', () => {
    expect(s.entropy.availability.label).toBe('PROVIDER NOT CONNECTED')
    expect(s.entropy.value).toBeNull()
    expect(s.drift.availability.label).toBe('PROVIDER NOT CONNECTED')
    expect(s.drift.value).toBeNull()
  })

  it('no panel carries a fabricated numeric value', () => {
    expect(s.entropy.value).toBeNull()
    expect(s.drift.value).toBeNull()
    expect(s.system.usage).toBeNull()
  })
})
