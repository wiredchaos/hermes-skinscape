#!/usr/bin/env python
"""Generate the AGENTROPOLIS HERMES SKINSCAPE brand assets.

Design language: obsidian surfaces, cyan structural illumination, red
operational accents — matching the canonical agentropolis-logo.svg district
towers motif (agentropolis-mission-control/public/media/agentropolis-logo.svg).
Uses Consolas Bold (terminal monospace) for the wordmark.

Outputs (written into assets/branding/ on the Pages branch working tree):
  agentropolis-hermes-skinscape-logo.png   full wordmark lockup (wide)
  hermes-skinscape-mark.png                compact H shield (narrow/mobile)
  favicon.png                              64x64 H shield favicon

No external deps beyond Pillow.
"""

from PIL import Image, ImageDraw, ImageFont

# ── Palette (Agentropolis Obsidian) ─────────────────────────────────────────
BG        = None  # transparent
SURFACE   = (8, 17, 27, 255)      # #08111B
SURFACE2  = (11, 22, 34, 255)     # #0B1622
CYAN      = (56, 199, 255, 255)   # #38C7FF
BLUE      = (22, 140, 255, 255)   # #168CFF
RED       = (255, 64, 88, 255)    # #FF4058
MAGENTA   = (255, 46, 136, 255)   # #FF2E88
TEXT      = (220, 233, 245, 255)  # #DCE9F5
MUTED     = (91, 120, 145, 255)   # #5B7891

FONT = "C:/Windows/Fonts/consolab.ttf"


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size)


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius: int, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_h_shield(size: int, border_px: int | None = None) -> Image.Image:
    """Obsidian rounded-square shield with cyan border, red base line,
    and a cyan/red H built from district towers."""
    if border_px is None:
        border_px = max(10, size // 42)
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)

    pad = border_px
    inner = size - pad * 2
    # Shield body: obsidian surface with subtle vertical gradient (SURFACE->SURFACE2)
    body = Image.new("RGBA", (size, size), BG)
    bd = ImageDraw.Draw(body)
    bd.rectangle([pad, pad, size - pad, size - pad], fill=SURFACE)
    # clip rounded
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=255)
    body.putalpha(mask)
    img.alpha_composite(body)
    # border
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, outline=CYAN, width=border_px)
    # inner hairline
    hp = pad + border_px
    d.rounded_rectangle([hp, hp, size - hp - 1, size - hp - 1], radius=size // 6, outline=(56, 199, 255, 70), width=1)

    # District-tower H: two cyan verticals + red crossbar
    bw = size * 0.13
    bar_gap = size * 0.085
    top = size * 0.24
    bottom = size * 0.76
    # verticals
    left_x = size * 0.26
    right_x = size * 0.74 - bw
    d.rectangle([left_x, top, left_x + bw, bottom], fill=CYAN)
    d.rectangle([right_x, top, right_x + bw, bottom], fill=CYAN)
    # red crossbar (slightly higher, ops accent)
    cy = size * 0.47
    cb_h = size * 0.13
    d.rectangle([left_x - bar_gap, cy, right_x + bw + bar_gap, cy + cb_h], fill=RED)
    # base reflection line
    d.rectangle([size * 0.18, size * 0.84, size * 0.82, size * 0.84 + max(2, size // 128)], fill=(56, 199, 255, 120))

    return img


def draw_wordmark() -> Image.Image:
    """AGENTROPOLIS (eyebrow) / HERMES (bold) / SKINSCAPE (bold cyan) with the H shield."""
    W, H = 1024, 400
    mark_size = 240
    img = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(img)

    mark = draw_h_shield(mark_size)
    img.alpha_composite(mark, (36, (H - mark_size) // 2))

    text_x = 36 + mark_size + 52

    # AGENTROPOLIS eyebrow — letterspaced red
    eyebrow = "AGENTROPOLIS"
    f_eyebrow = font(40)
    tracking = 6
    x = text_x
    y_e = 66
    for ch in eyebrow:
        d.text((x, y_e), ch, font=f_eyebrow, fill=RED)
        x += f_eyebrow.getbbox(ch)[2] - f_eyebrow.getbbox(ch)[0] + tracking

    # HERMES — bold text
    f_hermes = font(118)
    d.text((text_x, 118), "HERMES", font=f_hermes, fill=TEXT)

    # SKINSCAPE — bold cyan
    f_skin = font(118)
    d.text((text_x, 252), "SKINSCAPE", font=f_skin, fill=CYAN)

    return img


def main():
    import os
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "branding")
    os.makedirs(out_dir, exist_ok=True)

    logo = draw_wordmark()
    logo.save(os.path.join(out_dir, "agentropolis-hermes-skinscape-logo.png"))

    mark = draw_h_shield(512)
    mark.save(os.path.join(out_dir, "hermes-skinscape-mark.png"))

    fav = draw_h_shield(64, border_px=3)
    fav.save(os.path.join(out_dir, "favicon.png"))

    for name in ("agentropolis-hermes-skinscape-logo.png", "hermes-skinscape-mark.png", "favicon.png"):
        p = os.path.join(out_dir, name)
        print("wrote", os.path.normpath(p), os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
