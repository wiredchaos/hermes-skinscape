from __future__ import annotations

import argparse
import re
import stat
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_ROOT = "hermes-skins-pack"
FIXED_TIMESTAMP = (2026, 1, 1, 0, 0, 0)
PACKAGE_FILES = (
    "README.md",
    "LICENSE",
    "VERSION",
    "install.sh",
    "hermes_50_skins_pack.md",
)
VERSION_PATTERN = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?")


def validate_version(value: str) -> str:
    if not VERSION_PATTERN.fullmatch(value):
        raise ValueError(f"Invalid package version: {value!r}")
    return value


def add_file(archive: zipfile.ZipFile, source: Path, destination: str) -> None:
    mode = 0o755 if source.name == "install.sh" else 0o644
    info = zipfile.ZipInfo(destination, FIXED_TIMESTAMP)
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | mode) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, source.read_bytes())


def build(output_dir: Path) -> Path:
    version = validate_version((ROOT / "VERSION").read_text(encoding="utf-8").strip())
    skins = sorted((ROOT / "skins").glob("*.yaml"))
    if len(skins) != 50:
        raise SystemExit(f"Expected 50 skins, found {len(skins)}")

    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"hermes-skins-pack-v{version}.zip"
    with zipfile.ZipFile(output, "w") as archive:
        for filename in PACKAGE_FILES:
            add_file(archive, ROOT / filename, f"{ARCHIVE_ROOT}/{filename}")
        for skin in skins:
            add_file(archive, skin, f"{ARCHIVE_ROOT}/skins/{skin.name}")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Hermes Skins Pack ZIP")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    print(build(args.output_dir))


if __name__ == "__main__":
    main()
