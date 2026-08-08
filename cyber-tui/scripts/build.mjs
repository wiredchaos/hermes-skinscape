/**
 * Build the Cyber TUI into dist/entry.js (HERMES_TUI_DIR prebuilt bundle).
 * esbuild bundles React + Ink + YAML into a single self-contained file that
 * the Hermes launcher runs with `node --expose-gc dist/entry.js`.
 *
 * Mirrors the audited upstream ui-tui build approach: ESM output + a
 * createRequire banner so CJS transitive deps (signal-exit etc.) get a
 * `require` binding at runtime, and a react-devtools-core stub (only used
 * by Ink in DEV mode).
 */

import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const outdir = resolve(root, '..', 'dist')

await mkdir(outdir, { recursive: true })

const banner = "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);\n/* hermes-cyber-tui v0.1 — HERMES // AGENTROPOLIS. Bundled by esbuild. */"
const alias = { 'react-devtools-core': resolve(root, 'shims', 'react-devtools-core.js') }

await build({
  entryPoints: [resolve(root, '..', 'src', 'entry.tsx')],
  outfile: resolve(outdir, 'entry.js'),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: false,
  minify: false,
  alias,
  banner: { js: banner }
})

console.log('cyber-tui: built dist/entry.js')

// Optional: build the real-gateway smoke harness for integration verification.
await build({
  entryPoints: [resolve(root, '..', 'scripts', 'smoke-gateway.mjs')],
  outfile: resolve(outdir, 'smoke-gateway.js'),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: false,
  minify: false,
  alias,
  banner: { js: banner }
})

console.log('cyber-tui: built dist/smoke-gateway.js')

// Optional: build the static render preview (terminal capture for reports).
await build({
  entryPoints: [resolve(root, '..', 'scripts', 'preview-render.mjs')],
  outfile: resolve(outdir, 'preview-render.js'),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: false,
  minify: false,
  alias,
  banner: { js: banner }
})

console.log('cyber-tui: built dist/preview-render.js')
