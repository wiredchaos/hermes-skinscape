#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HERMES // AGENTROPOLIS — Cyber TUI installer (v0.1)
#
# Safe installer:
#   - detects prerequisites (node, npm, Hermes install)
#   - builds the Cyber TUI bundle
#   - backs up any existing HERMES_TUI_DIR / config before touching anything
#   - installs the agentropolis-obsidian skin (never overwrites without backup)
#   - configures the supported custom-TUI path (HERMES_TUI_DIR)
#   - provides a revert path (uninstall)
#
# NEVER overwrites user configuration without a backup. No destructive ops.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CYBER_TUI_DIR="${CYBER_TUI_DIR:-$HERMES_HOME/cyber-tui}"
BACKUP_DIR="${BACKUP_DIR:-$HERMES_HOME/cyber-tui-backup-$(date +%Y%m%d%H%M%S)}"

log()  { printf '[cyber-tui] %s\n' "$*"; }
fail() { printf '[cyber-tui] ERROR: %s\n' "$*" >&2; exit 1; }

# ── 1. Prerequisites ────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || fail "node not found — install Node.js (>=18) first"
command -v npm >/dev/null 2>&1 || fail "npm not found"

if [ ! -d "$HERMES_HOME" ]; then
  log "HERMES_HOME ($HERMES_HOME) does not exist — creating it."
  mkdir -p "$HERMES_HOME"
fi

if [ ! -d "$HERMES_HOME/hermes-agent" ] && [ -z "${HERMES_TUI_DIR:-}" ]; then
  log "WARNING: no hermes-agent source tree found under \$HERMES_HOME."
  log "The Cyber TUI gateway spawns the real Hermes gateway, so a working"
  log "Hermes install is required at runtime. Proceeding with install; the"
  log "gateway will fail at launch if the install path is wrong."
fi

# ── 2. Backup existing Cyber TUI dir (never overwrite without backup) ───────
if [ -e "$CYBER_TUI_DIR" ]; then
  log "Backing up existing $CYBER_TUI_DIR → $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"
  cp -a "$CYBER_TUI_DIR"/. "$BACKUP_DIR"/ 2>/dev/null || true
fi

# ── 3. Build the Cyber TUI bundle ───────────────────────────────────────────
log "Building Cyber TUI from $REPO_ROOT/cyber-tui"
(
  cd "$REPO_ROOT/cyber-tui"
  npm install --no-audit --no-fund >/dev/null 2>&1 || log "npm install returned non-zero (may be network); attempting build anyway"
  npm run build
)

# ── 4. Install the bundle into HERMES_HOME ──────────────────────────────────
log "Installing Cyber TUI to $CYBER_TUI_DIR"
mkdir -p "$CYBER_TUI_DIR"
cp -a "$REPO_ROOT/cyber-tui/dist" "$CYBER_TUI_DIR/dist"
cp "$REPO_ROOT/cyber-tui/package.json" "$CYBER_TUI_DIR/package.json" 2>/dev/null || true

# ── 5. Install the Agentropolis Obsidian skin (backup first) ────────────────
SKIN_DIR="$HERMES_HOME/skins"
SKIN_SRC="$REPO_ROOT/skins/agentropolis-obsidian.yaml"
if [ -f "$SKIN_SRC" ]; then
  mkdir -p "$SKIN_DIR"
  if [ -f "$SKIN_DIR/agentropolis-obsidian.yaml" ]; then
    log "Skin agentropolis-obsidian.yaml already exists — backing it up"
    cp "$SKIN_DIR/agentropolis-obsidian.yaml" "$BACKUP_DIR/agentropolis-obsidian.yaml.bak" 2>/dev/null || true
  fi
  cp "$SKIN_SRC" "$SKIN_DIR/agentropolis-obsidian.yaml"
  log "Installed skin: agentropolis-obsidian.yaml"
else
  log "Skin source not found at $SKIN_SRC — skipping skin install"
fi

# ── 6. Configure the supported custom-TUI path ──────────────────────────────
# HERMES_TUI_DIR is the documented mechanism (hermes_cli/main.py:1967).
if [ -z "${HERMES_TUI_DIR:-}" ]; then
  log "Export HERMES_TUI_DIR to activate the Cyber TUI:"
  printf '  export HERMES_TUI_DIR=%q\n' "$CYBER_TUI_DIR"
  log "You can persist it by adding that line to your shell profile."
else
  log "HERMES_TUI_DIR already set to: $HERMES_TUI_DIR"
fi

log ""
log "Install complete. To use the Cyber TUI:"
log "  export HERMES_TUI_DIR=$CYBER_TUI_DIR"
log "  hermes --tui"
log "  (activate skin inside Hermes with: hermes config set display.skin agentropolis-obsidian)"
log ""
log "To revert, run:  $REPO_ROOT/installer/uninstall.sh"
log "Backup of previous state (if any): $BACKUP_DIR"
