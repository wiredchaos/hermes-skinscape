# Cyber TUI Compatibility — v0.1

Recorded 2026-08-08. Upstream compatibility is a first-class concern: the
Cyber TUI composes against the real Hermes gateway, never a fork.

## Tested baseline

| Component | Version / commit |
|---|---|
| Upstream Hermes audited | `NousResearch/hermes-agent` main @ `a8ccd521236b2a8c99cdb4e0b9abcded7d82ae31` (2026-08-08) |
| Hermes locally verified | v0.20.0 (2026.8.3) at `C:\Users\marqu\AppData\Local\hermes\hermes-agent` |
| Hermes used by LIVE canary | v0.20.0 (profile `neuro`, `HERMES_HOME=C:\Users\marqu\AppData\Local\hermes\profiles\neuro`), launched via the real `hermes --tui` with `HERMES_TUI_DIR` on 2026-08-08 |
| Node.js (verified host) | v24.18.0 (npm 12.0.1) |
| React | ^18.3.1 (public npm) |
| Ink | ^5.2.0 (public npm) — NOT the upstream `@hermes/ink` fork |
| esbuild | ^0.25 (bundler) |
| TypeScript | ^5.6.3 |
| Vitest | ^2.1.8 |
| YAML parser | `yaml` ^2.5.0 |

Note: upstream ui-tui pins React 19.2.7 + its private `@hermes/ink` fork
(file: dep inside the Hermes repo). The Cyber TUI deliberately uses public
npm Ink + React 18 so it can be built from hermes-skinscape without copying
the Hermes repository. The wire protocol is what matters, and it is unchanged.

## Gateway protocol assumptions (audited against upstream source)

- Transport: child-process stdio, newline-delimited JSON-RPC 2.0
  (`ui-tui/src/gatewayClient.ts:356` spawns `python -m tui_gateway.entry`).
- Event frames: `{"jsonrpc":"2.0","method":"event","params":{"type":...}}`.
- Session lifecycle: `setup.status` → `session.most_recent` →
  `session.resume` (or `session.create`), mirroring upstream
  `useSessionLifecycle.ts`.
- Key events consumed: `session.info`, `message.start|delta|complete`,
  `tool.start|complete`, `status.update`, `error`, `reasoning.delta`,
  `approval.request`.
- `session.info` payload shape from `tui_gateway/server.py:5109`
  (`_session_info`): model, provider, approval_mode, yolo, running, cwd,
  branch, tools, skills, usage, etc.
- `tool.complete` is the todos source of truth (server.py:5447-5453).
- `approval.request` command is redacted upstream (server.py:1834-1849) —
  the APPROVALS panel only ever sees the redacted command + choices.

## Custom TUI loading mechanism

- **`HERMES_TUI_DIR`** — the documented, supported path
  (`hermes_cli/main.py:1967`; docs `environment-variables.md:855`,
  `user-guide/tui.md:91`). Must point at a directory containing
  `dist/entry.js` and `node_modules`.
- `hermes --tui` runs `node --expose-gc <dir>/dist/entry.js` (main.py:1986).
- `--dev` (hot reload) is mutually exclusive with `HERMES_TUI_DIR`.
- The installer (`installer/install.sh`) builds the bundle and exports
  `HERMES_TUI_DIR`; `installer/uninstall.sh` reverts.
- Fallback: unset `HERMES_TUI_DIR` and `hermes --tui` returns to the stock
  upstream Ink TUI. Normal Hermes is always recoverable.

## Supported terminals

- ANSI truecolor terminals (Windows Terminal, iTerm2, kitty, GNOME Terminal,
  VS Code terminal, tmux with truecolor, mintty/git-bash, macOS Terminal).
- Ink 5 requires a TTY; `dist/entry.js` exits cleanly when stdin is not a TTY.
- Terminals without Unicode get ASCII fallbacks via `CYBER_TUI_UNICODE`
  unset: box glyphs and the `❯` prompt degrade to `>` / ASCII borders.

## Interactive canary record (2026-08-08, Hermes v0.20.0)

Real send/stream/tool cycle performed — not inferred:

- Gateway connects: `gateway.ready` seen on every run.
- Session loads: `session.create` returns a working `session_id`; session info
  renders real model/provider/approval/session values in the PTY.
- User message sent + streamed: `prompt.submit` → `message.start` → real
  `message.delta` chunks ("CY"/"BER"/" CAN"/"ARY"/" OK") → `message.complete`,
  echoed back as `CYBER CANARY OK` by the live model.
- Tool invocation renders: `tool.start name=terminal` / `name=read_file`
  rendered. `tool.complete` did NOT complete inside the nested canary
  environment: this host's terminal-tool subprocess spawn fails under the
  doubly-nested MSYS PTY (`mktemp ... couldn't create signal pipe,
  Win32 error 5` — cygheap copy failure), and the in-process `read_file`
  turn hung on the same nested gateway (fresh-gateway MCP discovery churn).
  The tool CALL and its start event are verified; tool completion was not
  observed in the canary environment, so it is not claimed here.
- Queue state renders: `QUEUE ◉` while running, `○` when idle (PTY-verified).
- Layout switching works: `/layout focus` → `FOCUS · OPERATIONAL · FOCUS`
  (conversation-first, rails hidden); `/layout command-center` restores the
  full cockpit. Both verified live in the PTY.
- Resizing does not corrupt output: re-renders cleanly; responsive breakpoints
  covered by tests.
- Session resume works: `HERMES_CYBER_TUI_RESUME_SESSION=<stored_id>` resumed
  session `20260808_123618_fe6686` — title "Exact Cyber Canary Reply", prior
  transcript hydrated in the MISSION panel, session id shown in SYSTEM.
- Ctrl+C / exit: NOT verified end-to-end — the harness PTY delivers literal
  `\u0003` text, not the control byte, so raw Ctrl+C/Esc keycodes could not
  be injected. Process termination was via external kill. `/exit` text
  submission path exists but was not exercised to completion.

Environment variables (canary safety, mirrors upstream semantics):

- `HERMES_CYBER_TUI_NEW_SESSION=1` — start a fresh session instead of
  auto-resuming the most recent one (prevents hijacking the live session).
- `HERMES_CYBER_TUI_RESUME_SESSION=<stored_session_id>` — resume a specific
  session (mirrors `hermes --resume <id>`).

Canary harnesses (committed, headless, non-destructive):

- `scripts/canary-interactive.mjs` → `dist/canary-interactive.js`
- `scripts/resume-canary.mjs` → `dist/resume-canary.js`

## Known limitations (v0.1)

- Layout state is local to the Cyber TUI. The upstream `/layout` slash command
  is NOT modified — implementing it upstream would require invasive changes
  to the Hermes slash-command registry. The CyberShell handles `/layout
  command-center|focus` in its own command bar; a future milestone can wire
  an upstream plugin if needed.
- Panels bind only real events. Fields absent from events render
  `UNAVAILABLE` / `NOT CONNECTED` / `NO PROVIDER` / `AWAITING DATA`.
- Entropy/Drift are interfaces only — always `PROVIDER NOT CONNECTED` until a
  defined metric provider exists (documented requirement, never invented).
- No completion popover, image attachment preview, pet gallery, or desktop
  dashboard integration yet — those are upstream TUI surfaces not yet
  re-implemented in the Cyber presentation layer.
- The transcript renderer is plain-text oriented (no full markdown/ANSI
  renderer yet); it renders the real message text from the gateway.
- No CI workflow in hermes-skinscape yet; `npm test` runs locally.

## Security posture

- The Cyber TUI adds NO Hermes authority. Approval gates, tool permissions,
  policy controls, sandboxing, and credential isolation are enforced entirely
  by the runtime/gateway.
- No raw secrets in UI state; approval payloads arrive redacted.
- No fabricated telemetry, by design and by test (`tests/fallbacks.test.ts`).

## Verification commands

```bash
cd cyber-tui
npm ci
npm run typecheck
npm test                 # 42 tests: layouts, adapters, fallbacks, theme, focus cycle
npm run build            # dist/entry.js + smoke/canary/preview/resume harnesses
node dist/smoke-gateway.js   # real-gateway smoke (read-only)
node dist/preview-render.js  # static render (no gateway)
```
