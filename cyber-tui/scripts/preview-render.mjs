/**
 * Static render preview — renders the CyberShell layout to a text file with
 * PREVIEW state. Does NOT spawn the gateway and does NOT touch the live
 * session. Used to capture a visual for the report.
 */

import React from 'react'
import { render } from 'ink'
import { Writable } from 'node:stream'

import { CyberShell } from '../src/components/shell.js'
import { AGENTROPOLIS_OBSIDIAN } from '../src/theme/theme.js'
import { initialState } from '../src/state/model.js'
import { systemFromInfo, tasksFromToolComplete, approvalsFromRequest, activityFromEvent } from '../src/state/adapters.js'
import { live } from '../src/state/model.js'

function previewState() {
  const base = initialState()
  const state = {
    ...base,
    sessionReady: true,
    system: systemFromInfo(
      {
        model: 'deepseek/deepseek-v4-flash-0731',
        provider: 'nous',
        approval_mode: 'manual',
        yolo: false,
        running: true,
        cwd: '/workspace/hermes-skinscape',
        branch: 'feat/cyber-tui-v0.1',
        stored_session_id: 'preview0001',
        title: 'CYBER TUI PREVIEW',
        tools: { terminal: {}, web_search: {}, read_file: {}, write_file: {} },
        skills: { 'hermes-agent': {}, 'git-cross-repo-migration': {} },
        usage: { total_tokens: 48213, prompt_tokens: 19020, completion_tokens: 29193 }
      },
      base.system
    ),
    mission: { availability: live(), title: 'CYBER TUI PREVIEW', workspace: '/workspace/hermes-skinscape', running: true },
    tasks: tasksFromToolComplete(
      {
        tool_id: 't1',
        name: 'todo',
        todos: [
          { id: 'a', content: 'Build CyberShell layout', status: 'completed' },
          { id: 'b', content: 'Bind gateway adapters', status: 'completed' },
          { id: 'c', content: 'Write fallback tests', status: 'in_progress' }
        ]
      },
      base.tasks
    ),
    approvals: approvalsFromRequest({ command: 'git push origin feat/cyber-tui-v0.1', choices: ['once', 'session', 'deny'] }, base.approvals),
    agents: {
      availability: live(),
      agents: [
        { name: 'terminal', state: 'tool' },
        { name: 'web_search', state: 'tool' },
        { name: 'read_file', state: 'tool' },
        { name: 'hermes-agent', state: 'skill' }
      ]
    },
    transcript: [
      { id: 't1', role: 'user', text: 'Build the Cyber TUI v0.1', at: Date.now() },
      { id: 't2', role: 'assistant', text: 'Discovery complete. HERMES_TUI_DIR confirmed; building the shell now.', at: Date.now() },
      { id: 't3', role: 'tool', text: 'terminal: npm run build → dist/entry.js', at: Date.now() }
    ]
  }
  // Fill activity from the same events the real adapters would consume.
  let activity = base.activity
  activity = activityFromEvent({ type: 'message.start' }, activity)
  activity = activityFromEvent({ type: 'tool.start', payload: { tool_id: 'x', name: 'terminal' } }, activity)
  activity = activityFromEvent({ type: 'tool.complete', payload: { tool_id: 'x', name: 'terminal', summary: 'npm run build → ok (0.4s)' } }, activity)
  activity = activityFromEvent({ type: 'status.update', payload: { kind: 'lifecycle', text: 'ready' } }, activity)
  state.activity = activity
  state.receipts = {
    availability: live(),
    receipts: [
      { id: 'r1', kind: 'tool', text: 'terminal → 0.4s', at: Date.now() },
      { id: 'r2', kind: 'assistant', text: 'Discovery complete. HERMES_TUI_DIR confirmed.', at: Date.now() }
    ]
  }
  return state
}

let output = ''
const stream = new Writable({
  write(chunk, _enc, cb) {
    output += chunk.toString()
    cb()
  }
})

const { unmount, waitUntilExit } = render(
  React.createElement(CyberShell, {
    state: previewState(),
    palette: AGENTROPOLIS_OBSIDIAN,
    gw: null,
    onLayout: () => {},
    onCommand: () => {},
    ascii: true,
    interactive: false
  }),
  { stdout: stream, stderr: stream, exitOnCtrlC: false, patchConsole: false }
)

waitUntilExit().then(() => {
  process.stdout.write(output)
  unmount()
})
setTimeout(() => unmount(), 800)
