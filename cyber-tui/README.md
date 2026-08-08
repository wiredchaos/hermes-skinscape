# HERMES // AGENTROPOLIS — Cyber TUI

A cyberpunk mission-control TUI for [Hermes Agent](https://github.com/NousResearch/hermes-agent).

This is the **visual/runtime customization layer**. The Hermes runtime, agents,
tools, models, sessions, gateway, skills, and memory remain 100% upstream —
the Cyber TUI only replaces the terminal presentation, using the documented
`HERMES_TUI_DIR` custom-TUI mechanism and the real gateway JSON-RPC protocol.

## What it is

- Real Hermes conversation/transcript/input in the center
- Cyber panels around it: MISSION, TASKS, AGENTS, SYSTEM, APPROVALS, ACTIVITY, RECEIPTS
- Entropy/Drift monitor interfaces (show PROVIDER NOT CONNECTED until a provider exists)
- Layout profiles: `/layout command-center` (multi-panel) and `/layout focus` (conversation-first)
- Responsive: >=180 full command center · 120-179 compressed 3-column ·
  80-119 center + one rail · <80 focus mode
- NO fabricated telemetry — panels render real gateway events or explicit
  UNAVAILABLE / NOT CONNECTED / NO PROVIDER / AWAITING DATA markers

## Build

```bash
npm install
npm run build        # dist/entry.js (HERMES_TUI_DIR prebuilt bundle)
npm test             # vitest unit tests
npm run typecheck
```

## Activate

```bash
export HERMES_TUI_DIR="$PWD"    # or the built dir
hermes --tui
```

`HERMES_TUI_DIR` is the supported mechanism (`hermes_cli/main.py:1967`): the
launcher runs `node --expose-gc dist/entry.js` and the TUI spawns the real
gateway (`python -m tui_gateway.entry`) exactly like the upstream Ink TUI.

## Smoke test (real gateway)

```bash
node dist/smoke-gateway.js   # requires a working local Hermes install
```

Verifies `gateway.ready`, `setup.status`, and `session.most_recent` against the
actual local gateway. Read-only; no session mutation.

## Architecture

See `docs/CYBER_TUI_ARCHITECTURE.md` and `docs/CYBER_TUI_COMPATIBILITY.md` in
the repository root.
