import { describe, expect, it } from 'vitest'

import type { GatewayEvent } from '../src/gateway/types.js'
import {
  activityFromEvent,
  agentsFromInfo,
  approvalsFromRequest,
  reduceEvent,
  systemFromInfo,
  tasksFromToolComplete
} from '../src/state/adapters.js'
import {
  EMPTY_ACTIVITY,
  EMPTY_AGENTS,
  EMPTY_APPROVALS,
  EMPTY_SYSTEM,
  EMPTY_TASKS,
  initialState
} from '../src/state/model.js'

const infoEvent = (): GatewayEvent => ({
  type: 'session.info',
  payload: {
    model: 'deepseek/deepseek-v4-flash-0731',
    provider: 'nous',
    approval_mode: 'manual',
    yolo: false,
    running: true,
    cwd: '/workspace',
    branch: 'feat/cyber-tui-v0.1',
    stored_session_id: 'abc12345',
    title: 'MIGRATION',
    tools: { terminal: {}, web_search: {} },
    skills: { 'hermes-agent': {} },
    usage: { total_tokens: 1234, prompt_tokens: 500, completion_tokens: 734 }
  }
})

describe('gateway/event adapters', () => {
  it('session.info -> SYSTEM with real fields', () => {
    const sys = systemFromInfo(infoEvent().payload as Record<string, unknown>, EMPTY_SYSTEM)
    expect(sys.availability.availability).toBe('live')
    expect(sys.model).toBe('deepseek/deepseek-v4-flash-0731')
    expect(sys.provider).toBe('nous')
    expect(sys.approvalMode).toBe('manual')
    expect(sys.branch).toBe('feat/cyber-tui-v0.1')
    expect(sys.usage?.total).toBe('1234')
  })

  it('session.info -> AGENTS with tools + skills', () => {
    const agents = agentsFromInfo(infoEvent().payload as Record<string, unknown>, EMPTY_AGENTS)
    expect(agents.availability.availability).toBe('live')
    expect(agents.agents.some((a) => a.name === 'terminal' && a.state === 'tool')).toBe(true)
    expect(agents.agents.some((a) => a.name === 'hermes-agent' && a.state === 'skill')).toBe(true)
  })

  it('missing session.info keeps NOT CONNECTED (no fabrication)', () => {
    const sys = systemFromInfo(undefined, EMPTY_SYSTEM)
    expect(sys.availability.availability).toBe('not_connected')
    expect(sys.model).toBe('')
  })

  it('tool.complete todos -> TASKS (real todos source)', () => {
    const tasks = tasksFromToolComplete(
      {
        tool_id: 't1',
        name: 'todo',
        todos: [
          { id: 'a', content: 'Build Cyber TUI', status: 'completed' },
          { id: 'b', content: 'Write tests', status: 'pending' }
        ]
      },
      EMPTY_TASKS
    )
    expect(tasks.availability.availability).toBe('live')
    expect(tasks.tasks).toHaveLength(2)
    expect(tasks.tasks[0].content).toBe('Build Cyber TUI')
  })

  it('approval.request -> APPROVALS with redacted command + choices', () => {
    const state = approvalsFromRequest(
      { command: 'rm -rf /tmp/scratch', choices: ['once', 'deny'] },
      EMPTY_APPROVALS
    )
    expect(state.availability.availability).toBe('live')
    expect(state.pending[0].command).toBe('rm -rf /tmp/scratch')
    expect(state.pending[0].choices).toEqual(['once', 'deny'])
  })

  it('unknown events produce no activity entry', () => {
    const before = EMPTY_ACTIVITY
    const after = activityFromEvent({ type: 'notification.clear' } as GatewayEvent, before)
    expect(after.entries).toHaveLength(0)
    expect(after.availability.availability).toBe('awaiting')
  })

  it('message.delta marks streaming and records an entry', () => {
    const state = activityFromEvent({ type: 'message.delta', payload: { text: 'hello' } }, EMPTY_ACTIVITY)
    expect(state.streaming).toBe(true)
    expect(state.entries).toHaveLength(1)
    expect(state.entries[0].kind).toBe('message')
  })

  it('reduceEvent applies session.info across panels', () => {
    const state = reduceEvent(initialState(), infoEvent())
    expect(state.system.model).toBe('deepseek/deepseek-v4-flash-0731')
    expect(state.mission.availability.availability).toBe('live')
    expect(state.agents.agents.length).toBeGreaterThan(0)
  })
})
