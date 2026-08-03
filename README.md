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

- `skins/`, 50 ready-to-use YAML skin files
- `README.md`, installation and skin list
- `VERSION`, current pack version
- `hermes_50_skins_pack.md`, browsable catalog with every full YAML block

Every skin defines the complete current Hermes palette, including syntax colors and `shell_dollar`, so it does not silently inherit the default theme.

## License

MIT. See `LICENSE`.

Made by @BChopLXXXII

Built for vibe coders who just want their AI to feel less... corporate.

If this helped, ⭐ the repo — it helps others find it.