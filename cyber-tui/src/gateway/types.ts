/**
 * Cyber TUI — gateway wire types.
 *
 * Mirrors the audited upstream contract (NousResearch/hermes-agent a8ccd52,
 * local v0.20.0): newline-delimited JSON-RPC 2.0 over the gateway child's
 * stdio. Event frames use `method: "event"` with `params.type` carrying the
 * event name. See docs/CYBER_TUI_ARCHITECTURE.md §4.
 */

/** A single inbound frame from the gateway (response or event). */
export type GatewayFrame =
  | { jsonrpc: '2.0'; id: number; result?: unknown; error?: { code: number; message: string } }
  | { jsonrpc: '2.0'; method: 'event'; params: { type: string; payload?: unknown; session_id?: string } }

/** Generic RPC request helper. */
export interface RpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

export interface RpcError {
  code: number
  message: string
}

/** GatewayEvent — the event stream the adapters consume. */
export type GatewayEvent =
  | { type: 'gateway.ready'; payload?: Record<string, unknown> }
  | { type: 'session.info'; payload: SessionInfoPayload }
  | { type: 'message.start'; payload?: Record<string, unknown> }
  | { type: 'message.delta'; payload: { text: string } }
  | { type: 'message.complete'; payload: { text?: string; status?: string } }
  | { type: 'message.interim'; payload?: Record<string, unknown> }
  | { type: 'tool.start'; payload: { tool_id: string; name: string; context?: string; args_text?: string } }
  | { type: 'tool.complete'; payload: ToolCompletePayload }
  | { type: 'tool.generating'; payload?: Record<string, unknown> }
  | { type: 'status.update'; payload: { kind: string; text: string } }
  | { type: 'error'; payload?: Record<string, unknown> }
  | { type: 'thinking.delta'; payload?: Record<string, unknown> }
  | { type: 'reasoning.delta'; payload?: Record<string, unknown> }
  | { type: 'reasoning.available'; payload?: Record<string, unknown> }
  | { type: 'approval.request'; payload: ApprovalRequestPayload }
  | { type: 'notification.clear'; payload?: Record<string, unknown> }
  | { type: string; payload?: unknown }

/** session.info payload — audited from server.py:5109 `_session_info`. */
export interface SessionInfoPayload {
  model?: string
  provider?: string
  reasoning_effort?: string
  service_tier?: string
  fast?: boolean
  yolo?: boolean
  approval_mode?: string
  tools?: Record<string, unknown>
  skills?: Record<string, unknown>
  cwd?: string
  branch?: string
  project?: unknown
  personality?: string
  running?: boolean
  title?: string
  stored_session_id?: string
  usage?: SessionUsage
  version?: string
  release_date?: string
  update_behind?: unknown
}

export interface SessionUsage {
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  [key: string]: unknown
}

/** tool.complete payload — audited from server.py:5425 `_on_tool_complete`. */
export interface ToolCompletePayload {
  tool_id: string
  name: string
  args?: Record<string, unknown>
  result?: unknown
  duration_s?: number
  summary?: string
  todos?: TodoItem[]
}

export interface TodoItem {
  id?: string
  content?: string
  status?: string
  [key: string]: unknown
}

/** approval.request payload — audited from server.py:1834 `_emit_approval_request`. */
export interface ApprovalRequestPayload {
  command?: string
  choices?: string[]
  smart_denied?: boolean
  allow_permanent?: boolean
  [key: string]: unknown
}

/** Responses we use directly. */
export interface SessionResumeResponse {
  session_id?: string
  resumed?: string
  session_key?: string
  status?: string
  running?: boolean
  started_at?: number
  info?: SessionInfoPayload
  messages?: TranscriptMessage[]
  inflight?: unknown[]
}

export interface SessionCreateResponse {
  session_id?: string
  session_key?: string
  status?: string
  running?: boolean
  info?: SessionInfoPayload
}

export interface MostRecentResponse {
  session_id?: string | null
  title?: string
  started_at?: number
  source?: string
}

/** A transcript message from session.resume/create responses. */
export interface TranscriptMessage {
  role?: 'assistant' | 'system' | 'tool' | 'user'
  name?: string
  text?: string
  context?: string
  display_kind?: string
  display_metadata?: Record<string, unknown>
}

export interface SetupStatusResponse {
  provider_configured?: boolean
  [key: string]: unknown
}
