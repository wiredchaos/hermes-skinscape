# Hermes Skinscape Worlds

## What existed upstream

The original `hermes-skins-pack` project shipped 50 complete terminal skin YAML files. Each skin includes an authentic name, category, descriptive vibe, terminal palette, syntax colors, status colors, prompt symbol, and tool prefix.

It did **not** ship 50 completed background images, animated scenes, character illustrations, videos, or 3D models.

Hermes Skinscape therefore preserves two separate provenance layers:

- `upstream-hermes-skin`: authentic source metadata from the original repository.
- `generated-from-upstream-theme`: new world scenes derived from the authentic skin metadata.

Generated worlds must never be described as original upstream artwork.

## Files

- `world-prompt.schema.json` — complete production contract for one generated world.
- `world-seeds.json` — 50 distinct environment seeds, one for every original Hermes skin.

## Generation pipeline

```text
original skin YAML
        +
matching world seed
        +
selected cinematic pack
        +
optional user identity profile
        ↓
validated world prompt
        ↓
hero image / background / thumbnail / motion loop / 3D scene
```

## Prompt assembly

For each world, combine:

1. The original skin name and description.
2. The original skin palette.
3. The matching entry from `world-seeds.json`.
4. The selected cinematic pack:
   - `agentropolis-city`
   - `void-frontier`
   - `neutral-environment`
5. The user's protected identity tokens.
6. The target output type.

### Still-image prompt template

```text
Create an original cinematic environment titled "{{title}}".

Source theme: {{skin_id}}
Authentic source description: {{source_description}}
Environment: {{environment}}
Architecture: {{architecture}}
Central landmark: {{landmark}}
Atmosphere: {{atmosphere}}
Motion implied in the still: {{motion}}

Use the source Hermes palette:
background {{background}}, primary {{primary}}, secondary {{secondary}}, accent {{accent}}.

Presentation: original Agentropolis cyber-noir worldbuilding, highly legible focal hierarchy, volumetric depth, cinematic environmental storytelling, no copied franchise characters, ships, costumes, symbols, weapons, or locations.

Preserve these user identity tokens when supplied: {{protected_tokens}}.
Output aspect ratio: {{aspect_ratio}}.
```

### Motion-loop prompt template

```text
Animate the original environment "{{title}}" as a seamless {{duration_seconds}}-second loop.

Camera: {{camera_movement}}
Environmental motion: {{motion}}
Atmosphere: {{atmosphere}}

Keep architecture and landmark geometry stable. Use subtle parallax, particles, lighting pulses, atmospheric movement, and background traffic. Avoid cuts, text mutation, character morphing, camera jumps, and non-looping events.
```

### 3D-scene prompt template

```text
Build a lightweight real-time 3D scene for "{{title}}".

Required layers:
- navigable environment: {{environment}}
- modular architecture: {{architecture}}
- central landmark: {{landmark}}
- atmospheric system: {{atmosphere}}
- loopable motion systems: {{motion}}

Targets:
- WebGL/browser deployment
- procedural or instanced geometry where possible
- low, balanced, and cinematic quality levels
- separate world palette from protected identity palette
- mobile fallback
- no franchise-derived silhouettes or assets
```

## Void Frontier remix

`void-frontier` is an original space-opera interpretation layer, not a copied franchise pack. It may add original orbital ruins, crystal moons, archive machines, star-child entities, asymmetric guardians, cosmic navigation systems, and alien infrastructure.

Prohibited public-pack references include named franchise characters, recognizable helmets, signature weapons, protected logos, copied spacecraft, copied costumes, and recognizable locations.

## Asset status

Every generated asset slot begins as:

```json
{
  "status": "missing",
  "path": null,
  "checksum": null
}
```

An asset becomes `generated` after creation and `approved` only after visual review, originality review, and mobile performance review.
