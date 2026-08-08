# Cyber TUI Architecture — HERMES x AGENTROPOLIS

Status: DISCOVERED — recorded before implementation (feat/cyber-tui-v0.1)
Date: 2026-08-08

This document records the integration contract discovered by auditing the live
upstream repository, the local Hermes install, and the existing Skinscape
repository. It is the contract the Cyber TUI is built against.

---

## 1. Scope split (the architecture rule)

| Layer | Owner |
|---|---|
| Runtime, agents, tools, models, sessions, gateway, skills, memory | **NousResearch/hermes-agent** (upstream) |
| Visual identity, skins, Cyber TUI, layout profiles, components, installer, compatibility layer, preview site | **wiredchaos/hermes-skinscape** |

hermes-skinscape does NOT fork the Hermes runtime. It composes against the
gateway protocol and the skin engine.

---

## 2. Upstream baseline (recorded 2026-08-08)

- Upstream repo: `NousResearch/hermes-agent`
- Upstream main head audited: `a8ccd521236b2a8c99cdb4e0b9abcded7d82ae31`
  (2026-08-08, "refactor(sessions): accurate scope wording for tip-only resume rejections")
- Local install tested: **Hermes Agent v0.20.0 (2026.8.3)** at
  `C:\Users\marqu\AppData\Local\hermes\hermes-agent` (venv launcher on PATH)
- TUI stack: **React 19.2.7 + Ink fork `@hermes/ink`** (TypeScript, esbuild,
  nanostores) in `ui-tui/`
- Gateway: **Python JSON-RPC server** in `tui_gateway/`, spawned by the TUI
  child process: `python -m tui_gateway.entry` with `PYTHONPATH` = Hermes root
- Wire protocol: **newline-delimited JSON-RPC 2.0** over stdio (identical
  framing over WebSocket at `/api/ws` for remote clients)
- Skin engine: `hermes_cli/skin_engine.py`; canonical TS shape in
  `apps/shared/src/skin.ts` (HermesSkin)

## 3. Custom TUI loading mechanism — CONFIRMED

**`HERMES_TUI_DIR` exists and is the documented custom-TUI path.**

- `hermes_cli/main.py:1967` — `ext_dir = os.environ.get("HERMES_TUI_DIR")`
- It must point at a prebuilt `ui-tui/` directory containing
  `dist/entry.js` and populated `node_modules` (docs: `website/docs/reference/
  environment-variables.md:855`; `website/docs/user-guide/tui.md:91`).
- Launch path (`main.py:1986-2004`): when `HERMES_TUI_DIR` is set and
  `dist/entry.js` exists, Hermes runs `node --expose-gc <dir>/dist/entry.js`
  and never tries to npm-install or esbuild from source.
- `--dev` (tsx hot reload) is mutually exclusive with `HERMES_TUI_DIR`
  (`main.py:1968-1979`).
- The TUI process is responsible for spawning its own gateway child
  (`ui-tui/src/gatewayClient.ts:356`): it resolves the Python interpreter,
  sets `PYTHONPATH` to the Hermes source root and
  `HERMES_PYTHON_SRC_ROOT=<root>`, then spawns
  `python -m tui_gateway.entry` with `stdio: ['pipe','pipe','pipe']`.

This is the **primary integration mechanism** for the Cyber TUI v0.1: build a
prebuilt Cyber TUI bundle and point `HERMES_TUI_DIR` at it. The same gateway
protocol is consumed; only the presentation is replaced.

## 4. Gateway protocol (wire contract)

Transport: child-process stdio, one JSON-RPC 2.0 message per line.
Requests: `{"jsonrpc":"2.0","id":N,"method":"...","params":{...}}`
Responses: `{"jsonrpc":"2.0","id":N,"result":...}` / `{"jsonrpc":"2.0","id":N,"error":{...}}`
Events (server->client): `{"jsonrpc":"2.0","method":"event","params":{type, payload, session_id?}}`

### 4.1 Registered RPC methods (from tui_gateway/*.py, `@method` decorators)

Session: `session.create`, `session.list`, `session.most_recent`,
`session.resume`, `session.active_list`, `session.activate`, `session.delete`,
`session.title`, `session.usage`, `session.context_breakdown`,
`session.cwd.set`, `session.workspace.move`

Prompt/input: `prompt.submit`, `prompt.background`, `preview.restart`,
`clipboard.paste`, `image.attach`, `image.attach_bytes`, `pdf.attach`,
`file.attach`, `image.detach`, `input.detect_drop`

Responses: `clarify.respond`, `terminal.read.respond`, `preview.read.respond`,
`sudo.respond`, `secret.respond`, `approval.respond`

Config: `config.get`, `config.set`, `setup.status`, `setup.runtime_check`

Completion/options: `complete.path`, `complete.slash`, `model.options`,
`model.save_key`, `model.disconnect`, `paste.collapse`

Project: `projects.discover_repos`, `projects.record_repos`, `projects.tree`,
`projects.project_sessions`, `project.facts`

Pets/usage/billing: `pet.*`, `billing.state`, `usage.bars`,
`subscription.state`, `verification.status`

Wake/voice: `wake.start|stop|pause|resume|status|feed`, `voice.toggle|record|tts`

### 4.2 Events emitted (server->client, type names from `_emit(...)`)

`session.info` — full session snapshot (see 4.3)
`message.start`, `message.delta` `{text}`, `message.complete`,
`message.interim`
`tool.start` `{tool_id, name, context, args_text?}`,
`tool.complete` `{tool_id, name, args, result, duration_s?, summary?,
todos?}`,
`tool.generating`, `tool.output_risk`
`status.update` `{kind, text}` (kinds include `lifecycle`, `compacting`)
`error`, `thinking.delta`, `reasoning.delta`, `reasoning.available`
`approval.request` `{command (redacted), choices, ...}`
`notification.clear`, `reaction`, `wake.detected`, `voice.*`,
`browser.progress`, `moa.*`, `pet.*`, `preview.restart.*`, `terminal.close`

### 4.3 session.info payload (server.py:5109 `_session_info`)

Fields available for the SYSTEM/HEADER panels:
`model`, `provider`, `reasoning_effort`, `service_tier`, `fast`, `yolo`,
`approval_mode`, `tools` (dict), `skills` (dict), `cwd`, `branch`, `project`,
`personality`, `running`, `title`, `stored_session_id`, `usage`,
`desktop_contract`, `version`, `release_date`, `update_behind`

### 4.4 tool.complete is the todos source of truth

`tool.complete` for the `todo` tool carries `payload["todos"]` — the full
todo list. TASKS panel binds to this (real data, no fabrication).

### 4.5 approval.request is redacted

`_emit_approval_request` (server.py:1834-1849) redacts the command before
emitting. The APPROVALS panel displays only the redacted command + choices —
never raw command strings.

## 5. Skin contract (for agentropolis-obsidian.yaml)

- Schema source of truth: `apps/shared/src/skin.ts` (`SKIN_COLOR_TOKENS`,
  `SKIN_BRANDING_TOKENS`, `HermesSkin`) and `hermes_cli/skin_engine.py`
  docstring.
- Top-level: `name`, `description`, `colors`, optional `light_colors`/
  `dark_colors`, `branding`, `spinner`, `tool_prefix`, `tool_emojis`.
- All color keys optional; missing inherit `default`. Hex `#rrggbb` only.
- Existing 50 Skinscape skins already follow this schema (verified: all have
  `name`, `description`, `colors`, `branding`, `tool_prefix`).
- Activation: `hermes config set display.skin <name>` (never hand-edit
  config.yaml). Gateway repaints every surface live within ~1s.
- Skin file location: `<hermes-home>/skins/<name>.yaml`.

## 6. Skinscape repository state

- `main` (42b48f9): 50 skins + README + VERSION + LICENSE +
  hermes_50_skins_pack.md. No web app on main.
- GitHub Pages deploys from branch `feat/skinscape-foundation`:
  - `index.html` + `web/` (styles.css, app.js, skins.js, hybrid-ui.js,
    onboarding.js, 3d/city.js, video-ascii.js) — rotating skins preview,
    ASCII identity generator, export flows
  - `worlds/`, `profiles/`, `schemas/profile.schema.json`,
    `repository.yaml`
  - `hermes_skinscape/` — Python preview server + Dockerfile + `www/`
    (Home Assistant bridge page)
- Pages URL: https://wiredchaos.github.io/hermes-skinscape/
- The Cyber TUI work lands on `main` under `cyber-tui/`, `installer/`,
  `docs/`; the Pages site evolution stays additive (no removal of skins).

## 7. Widget mechanism (secondary, documented for completeness)

- `$HERMES_HOME/tui-widgets/*.mjs` — ambient/modal widget apps loaded by the
  Ink TUI at startup, no build step (skill reference `tui-widgets.md`).
- Zones: dock-top, dock-bottom, top-left, top-right, bottom-left,
  bottom-right rails. `sdk.sparkline/sparkRows/gauge/hbars` chart helpers.
- Widgets receive NO gateway events through the SDK — data must be fetched by
  the widget itself. Therefore the widget dock is a SUPPLEMENTARY surface;
  it is not the Cyber TUI's data path.

## 8. Cyber TUI architecture (target)

```
Hermes Gateway (python -m tui_gateway.entry)
      │  newline JSON-RPC over stdio
      ▼
Cyber GatewayClient (TypeScript, spawned by node dist/entry.js)
      │  typed GatewayEvent stream + RPC request/response
      ▼
Event Adapter layer (cyber-tui/src/adapters/)
      │  maps raw events -> panel state (selectors, no fabrication)
      ▼
Cyber UI State (cyber-tui/src/state/)
      ▼
Panels (MISSION, TASKS, AGENTS, SYSTEM, APPROVALS, ACTIVITY, RECEIPTS)
      │
      ▼
CyberShell layout engine (command-center | focus, responsive breakpoints)
```

- Panels render real events only. Absent data shows `UNAVAILABLE`,
  `NOT CONNECTED`, `NO PROVIDER`, or `AWAITING DATA` — never invented values.
- Entropy/Drift components exist as interfaces but display
  `PROVIDER NOT CONNECTED` until a metric provider exists.
- Layout state is local (no upstream slash-command changes in v0.1); the
  `/layout` command integration requirement is documented in
  CYBER_TUI_COMPATIBILITY.md.

## 9. Security / authority invariants

- The Cyber TUI is a presentation/control surface. It adds no Hermes
  authority: approval gates, tool permissions, policy controls, sandboxing,
  and credential isolation remain exactly as the runtime enforces them.
- No raw secrets in UI state. `approval.request` payload is redacted
  upstream; adapters never echo raw params.
- No fabricated telemetry — this is a hard rule of the project.

## 10. Verification method

- Unit tests (vitest) for breakpoints, layout switching, adapters, fallback
  states, theme loading.
- Real smoke test: build bundle, set HERMES_TUI_DIR to the prebuilt dir,
  launch `hermes --tui` against the local v0.20.0 gateway, verify
  transcript/streaming/input/tool events, then restore config.
- Tree-parity/git discipline: no destructive rewrites of main; logical
  commits on feat/cyber-tui-v0.1; PR for review.
