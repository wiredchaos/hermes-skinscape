/**
 * Cyber TUI — panel state model.
 *
 * State produced by the adapters from REAL gateway events only. Absent data
 * carries an explicit availability marker so panels can render honest
 * fallbacks (UNAVAILABLE / NOT CONNECTED / NO PROVIDER / AWAITING DATA)
 * instead of fabricated values.
 */

export type Availability = 'live' | 'unavailable' | 'not_connected' | 'no_provider' | 'awaiting'

export interface AvailabilityInfo {
  availability: Availability
  label: string
}

export const UNAVAILABLE: AvailabilityInfo = { availability: 'unavailable', label: 'UNAVAILABLE' }
export const NOT_CONNECTED: AvailabilityInfo = { availability: 'not_connected', label: 'NOT CONNECTED' }
export const NO_PROVIDER: AvailabilityInfo = { availability: 'no_provider', label: 'NO PROVIDER' }
export const AWAITING: AvailabilityInfo = { availability: 'awaiting', label: 'AWAITING DATA' }

export function live(label = 'LIVE'): AvailabilityInfo {
  return { availability: 'live', label }
}

// ── System panel ──────────────────────────────────────────────────────────

export interface SystemState {
  availability: AvailabilityInfo
  model: string
  provider: string
  approvalMode: string
  yolo: boolean
  running: boolean
  cwd: string
  branch: string
  sessionId: string
  title: string
  usage: { total?: string; prompt?: string; completion?: string } | null
  version: string
}

export const EMPTY_SYSTEM: SystemState = {
  availability: NOT_CONNECTED,
  model: '',
  provider: '',
  approvalMode: '',
  yolo: false,
  running: false,
  cwd: '',
  branch: '',
  sessionId: '',
  title: '',
  usage: null,
  version: ''
}

// ── Activity panel ────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string
  kind: 'message' | 'tool' | 'status' | 'error' | 'reasoning'
  text: string
  at: number
}

export interface ActivityState {
  availability: AvailabilityInfo
  entries: ActivityEntry[]
  streaming: boolean
}

export const EMPTY_ACTIVITY: ActivityState = {
  availability: AWAITING,
  entries: [],
  streaming: false
}

// ── Tasks panel (tool.complete todos — REAL data) ─────────────────────────

export interface TaskItem {
  id: string
  content: string
  status: string
}

export interface TasksState {
  availability: AvailabilityInfo
  tasks: TaskItem[]
}

export const EMPTY_TASKS: TasksState = {
  availability: AWAITING,
  tasks: []
}

// ── Approvals panel (redacted approval.request — REAL data) ───────────────

export interface ApprovalItem {
  id: string
  command: string
  choices: string[]
  at: number
}

export interface ApprovalsState {
  availability: AvailabilityInfo
  pending: ApprovalItem[]
}

export const EMPTY_APPROVALS: ApprovalsState = {
  availability: AWAITING,
  pending: []
}

// ── Receipts panel (message.complete / tool.complete summaries) ───────────

export interface ReceiptItem {
  id: string
  kind: 'assistant' | 'tool' | 'error'
  text: string
  at: number
}

export interface ReceiptsState {
  availability: AvailabilityInfo
  receipts: ReceiptItem[]
}

export const EMPTY_RECEIPTS: ReceiptsState = {
  availability: AWAITING,
  receipts: []
}

// ── Agents panel ──────────────────────────────────────────────────────────

export interface AgentItem {
  name: string
  state: string
}

export interface AgentsState {
  availability: AvailabilityInfo
  agents: AgentItem[]
}

export const EMPTY_AGENTS: AgentsState = {
  availability: NO_PROVIDER,
  agents: []
}

// ── Mission panel ─────────────────────────────────────────────────────────

export interface MissionState {
  availability: AvailabilityInfo
  title: string
  workspace: string
  running: boolean
}

export const EMPTY_MISSION: MissionState = {
  availability: AWAITING,
  title: '',
  workspace: '',
  running: false
}

// ── Entropy / Drift (interfaces only; provider NOT CONNECTED in v0.1) ─────

export interface EntropyState {
  availability: AvailabilityInfo
  value: null
}

export const EMPTY_ENTROPY: EntropyState = {
  availability: { availability: 'not_connected', label: 'PROVIDER NOT CONNECTED' },
  value: null
}

export interface DriftState {
  availability: AvailabilityInfo
  value: null
}

export const EMPTY_DRIFT: DriftState = {
  availability: { availability: 'not_connected', label: 'PROVIDER NOT CONNECTED' },
  value: null
}

// ── Aggregate ─────────────────────────────────────────────────────────────

export interface CyberState {
  system: SystemState
  activity: ActivityState
  tasks: TasksState
  approvals: ApprovalsState
  receipts: ReceiptsState
  agents: AgentsState
  mission: MissionState
  entropy: EntropyState
  drift: DriftState
  sessionReady: boolean
  transcript: TranscriptLine[]
}

export interface TranscriptLine {
  id: string
  role: 'assistant' | 'system' | 'tool' | 'user'
  text: string
  at: number
}

export function initialState(): CyberState {
  return {
    system: EMPTY_SYSTEM,
    activity: EMPTY_ACTIVITY,
    tasks: EMPTY_TASKS,
    approvals: EMPTY_APPROVALS,
    receipts: EMPTY_RECEIPTS,
    agents: EMPTY_AGENTS,
    mission: EMPTY_MISSION,
    entropy: EMPTY_ENTROPY,
    drift: EMPTY_DRIFT,
    sessionReady: false,
    transcript: []
  }
}
