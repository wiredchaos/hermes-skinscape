#!/usr/bin/env node
/**
 * Cyber TUI — entry point (HERMES_TUI_DIR prebuilt bundle entry).
 *
 * The Hermes launcher runs `node --expose-gc <HERMES_TUI_DIR>/dist/entry.js`
 * when HERMES_TUI_DIR points at this prebuilt directory
 * (hermes_cli/main.py:1986-2004). This file mounts the Cyber App.
 */

import React from 'react'
import { render } from 'ink'

import { CyberApp } from './app.js'

if (!process.stdin.isTTY) {
  console.log('hermes-cyber-tui: no TTY')
  process.exit(0)
}

// Reset terminal modes for a clean slate (mirrors upstream entry hygiene).
process.on('exit', () => {
  try {
    process.stdout.write('\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?25h')
  } catch {
    // best-effort
  }
})

const { unmount } = render(<CyberApp />)

const shutdown = (code = 0): void => {
  unmount()
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
