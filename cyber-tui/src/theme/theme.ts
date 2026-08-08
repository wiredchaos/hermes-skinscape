/**
 * Cyber TUI — theme loader.
 *
 * Loads a Hermes skin YAML (canonical schema, apps/shared/src/skin.ts) into
 * the Cyber TUI palette. The agentropolis-obsidian skin ships in this repo;
 * users may point at any installed skin file. Missing keys fall back to the
 * Agentropolis Obsidian palette, then to the Cyber defaults.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse as parseYaml } from 'yaml'

export interface CyberPalette {
  background: string
  surface: string
  surfaceAlt: string
  cyan: string
  electricBlue: string
  red: string
  magenta: string
  textPrimary: string
  textSecondary: string
  muted: string
  success: string
  warning: string
  error: string
  selection: string
  border: string
}

export const AGENTROPOLIS_OBSIDIAN: CyberPalette = {
  background: '#05080D',
  surface: '#08111B',
  surfaceAlt: '#0B1622',
  cyan: '#38C7FF',
  electricBlue: '#168CFF',
  red: '#FF4058',
  magenta: '#FF2E88',
  textPrimary: '#DCE9F5',
  textSecondary: '#9DB4C8',
  muted: '#5B7891',
  success: '#34E2A4',
  warning: '#FFB454',
  error: '#FF4058',
  selection: '#102D42',
  border: '#102D42'
}

export interface LoadedTheme {
  name: string
  palette: CyberPalette
  source: 'agentropolis-obsidian' | 'file' | 'defaults'
}

const COLOR_MAP: Record<string, keyof CyberPalette> = {
  background: 'background',
  ui_primary: 'textPrimary',
  ui_text: 'textPrimary',
  banner_text: 'textPrimary',
  ui_label: 'textSecondary',
  banner_dim: 'muted',
  ui_accent: 'cyan',
  banner_accent: 'electricBlue',
  banner_title: 'cyan',
  ui_tool: 'cyan',
  ui_ok: 'success',
  ui_warn: 'warning',
  ui_error: 'error',
  prompt: 'cyan',
  selection_bg: 'selection',
  ui_border: 'border',
  banner_border: 'border',
  session_label: 'magenta',
  status_bar_strong: 'textPrimary',
  status_bar_text: 'textSecondary',
  status_bar_dim: 'muted'
}

function hex(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const m = /^#([0-9a-fA-F]{6})$/.exec(value.trim())
  return m ? m[1] : null
}

export function paletteFromSkinColors(colors: Record<string, unknown> | undefined): CyberPalette {
  const palette: CyberPalette = { ...AGENTROPOLIS_OBSIDIAN }
  if (!colors || typeof colors !== 'object') {
    return palette
  }
  for (const [token, target] of Object.entries(COLOR_MAP)) {
    const h = hex(colors[token])
    if (h) {
      palette[target] = `#${h}`
    }
  }
  // Surface tones derive from the background seed if not explicitly set.
  palette.surface = hex(colors.background) ? palette.background : palette.surface
  palette.surfaceAlt = palette.surface
  return palette
}

function defaultSkinPath(): string {
  const home = process.env.HERMES_HOME?.trim() || join(homedir(), '.hermes')
  return join(home, 'skins', 'agentropolis-obsidian.yaml')
}

/** Load a skin file (YAML) and produce a palette. Never throws on skin errors. */
export async function loadTheme(skinPath?: string): Promise<LoadedTheme> {
  const candidates = [skinPath, defaultSkinPath()].filter(Boolean) as string[]
  for (const path of candidates) {
    try {
      const raw = await readFile(path, 'utf8')
      const doc = parseYaml(raw)
      const colors = doc?.colors as Record<string, unknown> | undefined
      if (!doc || typeof doc !== 'object' || !colors) {
        continue
      }
      const name = typeof doc.name === 'string' ? doc.name : 'custom'
      return { name, palette: paletteFromSkinColors(colors), source: 'file' }
    } catch {
      // Try next candidate.
    }
  }
  return { name: 'agentropolis-obsidian', palette: { ...AGENTROPOLIS_OBSIDIAN }, source: 'defaults' }
}
