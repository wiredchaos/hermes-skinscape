# Cyber TUI Compatibility — v0.1

Recorded 2026-08-08. Upstream compatibility is a first-class concern: the
Cyber TUI composes against the real Hermes gateway, never a fork.

## Tested baseline

| Component | Version / commit |
|---|---|
| Upstream Hermes audited | `NousResearch/hermes-agent` main @ `a8ccd521236b2a8c99cdb4e0b9abcded7d82ae31` (2026-08-08) |
| Hermes locally verified | v0.20.0 (2026.8.3) at `C:\Users\marqu\AppData\Local\hermes\hermes-agent` |
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
npm test                 # 34 tests: layouts, adapters, fallbacks, theme
npm run build            # dist/entry.js + dist/smoke-gateway.js
node dist/smoke-gateway.js   # real-gateway smoke (read-only)
```
