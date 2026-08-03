# Hermes Skinscape Architecture

Hermes Skinscape is a community extension for Hermes Agent that preserves the original 50 skins while adding a rotating screensaver, identity profiles, PFP-to-ASCII conversion, URL-based image input, a browser preview, and exportable Hermes assets.

## Core rule

**Themes control the world. Identity profiles control the brand.**

The public project is brand-neutral. Users may extract colors from an image, define custom colors, lock protected brand tokens, or allow a theme to fully transform the presentation.

## Product layers

### 1. Skin library

- Preserve the original 50 YAML skins.
- Keep upstream attribution and license notices.
- Load skins without modifying the user's permanent Hermes configuration.

### 2. Screensaver engine

- Rotate through all 50 skins sequentially or randomly.
- Allow playlists, exclusions, favorites, timing controls, pause, previous, and next.
- Activate after an idle interval and return to Hermes on input.
- Keep the user identity persistent while the scene changes.

### 3. Identity engine

Supported inputs:

- Local image upload
- Drag and drop
- Direct HTTPS image URL
- GitHub profile URL
- Supported webpage/profile URL through an optional secure metadata proxy

Generated outputs:

- ASCII portrait
- ANSI-colored portrait
- Hermes banner and hero art
- Extracted palette
- Brand profile
- Skin YAML
- Screensaver configuration
- Standalone HTML preview

### 4. Brand profile modes

- `extracted`: derive colors from the supplied image.
- `custom`: use explicit user-defined colors.
- `protected`: preserve locked colors, logo, name, or other identity tokens while scenes rotate.
- `unrestricted`: allow each theme to transform all presentation tokens.

### 5. Browser application

The GitHub Pages application should provide image and URL input, palette controls, ASCII generation, terminal preview, all-50 rotation, playlist controls, and local export. Arbitrary remote webpage extraction must use an optional secure proxy because browser CORS rules prevent reliable client-only ingestion.

### 6. Original aesthetic packs

Additional packs must use original names, silhouettes, lore, symbols, environments, and equipment. The first planned pack is `void-frontier`, an original space-opera collection built from broad genre archetypes rather than copied franchise characters.

## Planned repository layout

```text
core/
  ascii-engine/
  brand-engine/
  identity-engine/
  scene-engine/
  export-engine/
screensaver/
cli/
web/
packs/
profiles/
presets/
docs/
tests/
```

## Safety and integrity

- Back up existing Hermes configuration before applying changes.
- Preview generated assets before installation.
- Never overwrite the user's current skin without explicit action.
- Require HTTPS for remote image input.
- Reject private-network and loopback URL targets.
- Validate MIME type and file size.
- Re-encode imported images before processing.
- Do not execute SVG scripts or remote HTML.
- Do not permanently store user images without permission.

## Community default

The default distribution must not impose Agentropolis colors or any other contributor's branding. Personalized profiles are optional presets layered on top of the neutral engine.
