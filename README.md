# Hermes Skins Pack — 50 Themes

![Cover](hermes-cover.png)

A curated pack of **50 unique, drop-in skin themes** for the [Hermes Agent](https://github.com/NousResearch/hermes-agent) CLI and TUI. Every skin is a complete YAML file using the real Hermes color keys — no inherited defaults, no silent fallbacks.

## What's Inside

| Category | Skins |
|---|---|
| Cyberpunk / Synthwave | neon-ghost, chrome-rain, glitch-punk, void-sunset, netrunner |
| Modern Dark / OLED | obsidian, deep-void, graphite, midnight-studio, eclipse |
| Earth & Nature | redwood, sandstone, deep-ocean, moss-stone, aurora-boreal |
| Retro / Vintage | amber-terminal, green-screen, typewriter-cream, commodore-64, newsprint-noir |
| Monochromatic / Minimalist | bone-white, slate-mist, warm-ash, steel-thread, single-malt |
| High Contrast | white-flash, solar-flare, black-canary, red-alert, high-noon |
| Pastel / Soft | lavender-dream, peach-fuzz, seafoam-silk, dusty-rose, baby-blue |
| Light / Paper Modes | warm-parchment, rice-paper, blueprint, linen-sage, alabaster |
| Fantasy / Gaming | dragon-blood, arcane-tome, shadow-thief, enchanted-forest, forge-master |
| Abstract / Artistic | vaporwave-mall, brutalist-concrete, stained-glass, desert-neon, liquid-silver |

## Install

Download or clone the repository, then copy the skins into Hermes:

```bash
mkdir -p "${HERMES_HOME:-$HOME/.hermes}/skins"
cp -i skins/*.yaml "${HERMES_HOME:-$HOME/.hermes}/skins/"
```

The `-i` flag asks before replacing any skin with the same filename.

Switch skins inside Hermes with `/skin <name>`, or set one as the default:

```bash
hermes config set display.skin neon-ghost
```

To install one skin by hand:

```bash
mkdir -p ~/.hermes/skins
cp skins/neon-ghost.yaml ~/.hermes/skins/
```

## Repository Contents

- `skins/`, 50 ready-to-use YAML skin files (+ `agentropolis-obsidian`, the
  HERMES // AGENTROPOLIS flagship cyber command-center skin)
- `cyber-tui/`, the Cyber TUI — an actual interactive Hermes TUI shell with a
  cyberpunk mission-control presentation (React/Ink, real gateway data)
- `installer/`, safe install/uninstall for the Cyber TUI + skin
- `docs/`, Cyber TUI architecture + compatibility documentation
- `README.md`, installation and skin list
- `VERSION`, current pack version
- `hermes_50_skins_pack.md`, browsable catalog with every full YAML block

Every skin defines the complete current Hermes palette, including syntax colors and `shell_dollar`, so it does not silently inherit the default theme.

## Cyber TUI (HERMES // AGENTROPOLIS)

The Cyber TUI is the visual/runtime customization layer for Hermes: the real
Hermes conversation/transcript/input stays in the center, wrapped in a
cyberpunk command-center interface with MISSION / TASKS / AGENTS / SYSTEM /
APPROVALS / ACTIVITY / RECEIPTS panels. It uses the documented
`HERMES_TUI_DIR` custom-TUI mechanism and binds real gateway events — no
fabricated telemetry.

```bash
cd cyber-tui
npm install
npm run build          # dist/entry.js
export HERMES_TUI_DIR="$PWD"
hermes --tui
```

Or use the installer:

```bash
bash installer/install.sh       # builds, backs up, installs, sets HERMES_TUI_DIR
bash installer/uninstall.sh     # reverts
```

See `docs/CYBER_TUI_ARCHITECTURE.md` and `docs/CYBER_TUI_COMPATIBILITY.md`.

## License

MIT. See `LICENSE`.

Made by @BChopLXXXII

Built for vibe coders who just want their AI to feel less... corporate.

If this helped, ⭐ the repo — it helps others find it.