# Build Log

## 2026-08-02, package the 50-skin collection

### Request

Turn the existing Hermes skin catalog into a real installable package.

### Findings

- The repository was clean and synchronized with `origin/main`.
- All 50 YAML blocks parsed and loaded through Hermes, but they existed only inside one Markdown file.
- There was no ZIP builder, installer, version file, standalone license, or individual skin directory.
- Every skin omitted the current `shell_dollar` color and the four syntax colors, so the README's no-fallback claim was not yet true.

### Plan

Create standalone complete skin files, add a safe installer and deterministic ZIP builder, document the package, then exercise the built archive against the live Hermes skin engine.

### Files changed

- `skins/*.yaml`, 50 installable skin files with the complete current color palette.
- `hermes_50_skins_pack.md`, updated all catalog blocks with syntax and shell colors.
- `install.sh`, installs all skins while preserving existing custom files.
- `scripts/build_package.py`, creates a deterministic versioned ZIP.
- `tests/test_package.py`, validates skin completeness, installer behavior, and ZIP contents.
- `README.md`, replaced manual copy-first directions with package installation and build instructions.
- `LICENSE`, added the full MIT license text.
- `VERSION`, established package version `1.0.0`.
- `Makefile`, added canonical `test` and `package` commands.
- `.gitignore`, excludes generated packages and Python cache files.

### Failures

- The first package-content test failed with zero standalone skins, confirming the missing artifact.
- The first installer test failed because `install.sh` did not exist.
- The existing-file test proved a simple bulk copy would overwrite a user's customized skin.
- The first ZIP test failed because the package builder did not exist.
- `unzip` was unavailable during a manual archive listing attempt.
- A first catalog-parity probe used shell-sensitive Markdown backticks in an inline command and failed before verification; the file-based verifier replaced it.
- The initial independent review found a race between the installer's existence check and copy operation, plus a dangling-symlink failure. Either could break the promise that existing user paths are never overwritten or disturbed.
- The same review found that the first ZIP test checked counts and a few filenames but not exact inventory, source-byte parity, safe paths, fixed metadata, or reproducibility.
- A follow-up review found the first atomic-write fix still treated every write failure as an existing file, so an unwritable destination could return success. It also found that the race check only inspected script text rather than forcing a real competing write.
- A later focused probe found the shell `ln` command treats an existing directory as a destination folder, placing a hidden hard link inside it instead of preserving it untouched.
- That review also found the catalog appendix claimed to list all color keys while omitting `shell_dollar` and the four syntax colors.

### Fixes

- Extracted all 50 catalog blocks into standalone files and added the five newly required color values to every theme.
- Built the installer around a Python standard-library temporary-file plus atomic `os.link` handoff, so regular files, directories, symlinks, dangling symlinks, and paths created by a competing process are never overwritten or modified.
- Made genuine write failures stop with a nonzero exit instead of being misreported as skipped existing files.
- Added behavioral regression coverage that forces a competing destination creation during installation, plus unwritable-destination, existing-directory, and directory-symlink tests.
- Expanded ZIP verification to require the exact 55-entry inventory, source-byte parity, safe unique paths, fixed timestamps and modes, the exact versioned filename, and byte-for-byte reproducibility.
- Added version validation before any value from `VERSION` can enter an output path.
- Completed the catalog's color-key appendix and added a test that keeps it equal to the actual 43-key schema.
- Added a standard-library ZIP builder with fixed timestamps and file modes for reproducible output.
- Used Python's `zipfile` module for archive inspection because the host has no `unzip` command.

### Validation results

- `make test`, passed 11 tests.
- `python3 -m py_compile scripts/build_package.py tests/test_package.py`, passed.
- `bash -n install.sh`, passed.
- `git diff --check -- . ':(exclude)**/*.md' ':(exclude)*.md'`, passed.
- `make package`, created `dist/hermes-skins-pack-v1.0.0.zip`, 51,378 bytes.
- Ad-hoc live-package verification passed: the extracted installer installed 50 skins into an isolated Hermes home, `hermes skin list` found all 50, the live Hermes loader loaded all 50, and a second build was byte-for-byte identical.
- Package SHA-256: `3913fb58da507f22bd71760e844e008a573b9b430c2fc049ed8d9b9fc2fd690a`.

### Independent review

- Final verdict: **PASS**, no blocking findings.
- The reviewer independently checked all 50 skins, live Hermes loading, every installer path type and failure mode, exact ZIP contents and reproducibility, version-path safety, documentation truth, staged completeness, and secret scans.

### Remaining work

Commit, push, and the pull request remain before this checkpoint is ready for merge.

### Build-in-public draft, not published

turned a 70KB Markdown file full of themes into an actual package today.

50 separate YAML files, a safe installer, and a reproducible ZIP. caught one thing along the way too, every theme was missing Hermes's new shell prompt color, so they were still falling back to default...

50 installed, listed, and loaded against the live app. now it's real.

#BuildInPublic #IndieDev
