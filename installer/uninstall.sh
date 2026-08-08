#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HERMES // AGENTROPOLIS — Cyber TUI uninstaller / revert (v0.1)
#
# Reverses installer/install.sh:
#   - restores any backed-up Cyber TUI dir
#   - restores any backed-up skin
#   - removes the installed Cyber TUI bundle (only the one it installed)
#   - never touches user config.yaml or .env
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
CYBER_TUI_DIR="${CYBER_TUI_DIR:-$HERMES_HOME/cyber-tui}"
BACKUP_DIR="${BACKUP_DIR:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '[cyber-tui] %s\n' "$*"; }

# ── 1. Find the most recent backup (if BACKUP_DIR not explicit) ─────────────
if [ -z "$BACKUP_DIR" ]; then
  BACKUP_DIR="$(ls -d "$HERMES_HOME"/cyber-tui-backup-* 2>/dev/null | sort | tail -1 || true)"
fi

if [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
  log "Restoring from backup: $BACKUP_DIR"
  if [ -d "$CYBER_TUI_DIR" ]; then
    log "Restoring Cyber TUI dir from backup"
    rm -rf "$CYBER_TUI_DIR"
    cp -a "$BACKUP_DIR"/. "$CYBER_TUI_DIR"/
  fi
  if [ -f "$BACKUP_DIR/agentropolis-obsidian.yaml.bak" ]; then
    log "Restoring previous agentropolis-obsidian.yaml skin"
    cp "$BACKUP_DIR/agentropolis-obsidian.yaml.bak" "$HERMES_HOME/skins/agentropolis-obsidian.yaml"
  else
    log "No previous skin backup found — leaving installed skin in place"
  fi
else
  log "No backup found; removing only the installed Cyber TUI bundle."
  if [ -d "$CYBER_TUI_DIR" ]; then
    rm -rf "$CYBER_TUI_DIR"
    log "Removed $CYBER_TUI_DIR"
  fi
fi

log ""
log "Revert complete. To return to the stock Hermes TUI:"
log "  unset HERMES_TUI_DIR   # (or remove the export from your shell profile)"
log "  hermes --tui"
log ""
log "Your Hermes config.yaml and .env were never modified by this installer."
