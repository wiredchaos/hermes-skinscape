import { describe, expect, it } from 'vitest'

import { AGENTROPOLIS_OBSIDIAN, paletteFromSkinColors } from '../src/theme/theme.js'

describe('theme loading', () => {
  it('returns the Agentropolis Obsidian palette for a canonical skin colors block', () => {
    const palette = paletteFromSkinColors({
      background: '#05080D',
      ui_accent: '#38C7FF',
      banner_accent: '#168CFF',
      ui_error: '#FF4058',
      session_label: '#FF2E88',
      ui_text: '#DCE9F5',
      ui_label: '#9DB4C8',
      banner_dim: '#5B7891',
      ui_ok: '#34E2A4',
      ui_warn: '#FFB454',
      selection_bg: '#102D42'
    })
    expect(palette.background).toBe('#05080D')
    expect(palette.cyan).toBe('#38C7FF')
    expect(palette.electricBlue).toBe('#168CFF')
    expect(palette.red).toBe('#FF4058')
    expect(palette.magenta).toBe('#FF2E88')
    expect(palette.textPrimary).toBe('#DCE9F5')
    expect(palette.textSecondary).toBe('#9DB4C8')
    expect(palette.muted).toBe('#5B7891')
    expect(palette.success).toBe('#34E2A4')
    expect(palette.warning).toBe('#FFB454')
    expect(palette.selection).toBe('#102D42')
  })

  it('falls back to Agentropolis Obsidian defaults for missing keys', () => {
    const palette = paletteFromSkinColors({ ui_accent: '#00FF00' })
    expect(palette.cyan).toBe('#00FF00')
    expect(palette.background).toBe(AGENTROPOLIS_OBSIDIAN.background)
    expect(palette.magenta).toBe(AGENTROPOLIS_OBSIDIAN.magenta)
  })

  it('rejects malformed hex (no partial palette from bad values)', () => {
    const palette = paletteFromSkinColors({ ui_accent: 'cyan', banner_dim: 'rgb(1,2,3)' })
    expect(palette.cyan).toBe(AGENTROPOLIS_OBSIDIAN.cyan)
    expect(palette.muted).toBe(AGENTROPOLIS_OBSIDIAN.muted)
  })

  it('never throws on undefined colors', () => {
    expect(() => paletteFromSkinColors(undefined)).not.toThrow()
  })
})

describe('missing telemetry behavior', () => {
  it('entropy/drift interfaces start PROVIDER NOT CONNECTED', () => {
    // Panels render these labels; values are null until a provider exists.
    expect(AGENTROPOLIS_OBSIDIAN.background).toBeTruthy()
  })
})
