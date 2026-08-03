#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$ROOT_DIR/skins"
TARGET_DIR="${HERMES_HOME:-$HOME/.hermes}/skins"

if [[ ! -d "$SOURCE_DIR" ]]; then
  printf 'Skin folder not found: %s\n' "$SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  printf 'Python 3 is required to install Hermes skins.\n' >&2
  exit 1
fi

python3 - "$SOURCE_DIR" "$TARGET_DIR" <<'PY'
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

source_dir = Path(sys.argv[1])
target_dir = Path(sys.argv[2])
skins = sorted(source_dir.glob("*.yaml"))
if len(skins) != 50:
    print(f"Expected 50 skin files, found {len(skins)}.", file=sys.stderr)
    raise SystemExit(1)

installed = 0
skipped = 0

for skin in skins:
    target = target_dir / skin.name
    try:
        with tempfile.NamedTemporaryFile(
            dir=target_dir, prefix=".hermes-skin.", delete=True
        ) as staged:
            staged.write(skin.read_bytes())
            staged.flush()
            os.fsync(staged.fileno())
            os.chmod(staged.name, 0o644)
            try:
                os.link(staged.name, target, follow_symlinks=False)
            except FileExistsError:
                skipped += 1
            except OSError as error:
                print(f"Could not install skin: {target}: {error}", file=sys.stderr)
                raise SystemExit(1) from error
            else:
                installed += 1
    except OSError as error:
        print(f"Could not install skin: {target}: {error}", file=sys.stderr)
        raise SystemExit(1) from error

print(f"Installed {installed} Hermes skins into {target_dir}", end="")
if skipped:
    suffix = "" if skipped == 1 else "s"
    print(f", skipped {skipped} existing file{suffix}", end="")
print(".")
PY
