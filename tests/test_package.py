from __future__ import annotations

import os
import re
import runpy
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path, PurePosixPath

import yaml


ROOT = Path(__file__).resolve().parents[1]
SKINS_DIR = ROOT / "skins"
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
REQUIRED_COLOR_KEYS = {
    "background",
    "banner_border",
    "banner_title",
    "banner_accent",
    "banner_dim",
    "banner_text",
    "ui_accent",
    "ui_label",
    "ui_text",
    "ui_border",
    "ui_ok",
    "ui_error",
    "ui_warn",
    "ui_tool",
    "ui_thinking",
    "diff_added",
    "diff_removed",
    "diff_added_word",
    "diff_removed_word",
    "syntax_string",
    "syntax_number",
    "syntax_keyword",
    "syntax_comment",
    "prompt",
    "shell_dollar",
    "input_rule",
    "response_border",
    "session_label",
    "session_border",
    "status_bar_bg",
    "status_bar_text",
    "status_bar_strong",
    "status_bar_dim",
    "status_bar_good",
    "status_bar_warn",
    "status_bar_bad",
    "status_bar_critical",
    "voice_status_bg",
    "selection_bg",
    "completion_menu_bg",
    "completion_menu_current_bg",
    "completion_menu_meta_bg",
    "completion_menu_meta_current_bg",
}


class PackageContentsTests(unittest.TestCase):
    def test_pack_contains_50_complete_valid_skins(self) -> None:
        skin_paths = sorted(SKINS_DIR.glob("*.yaml"))
        self.assertEqual(50, len(skin_paths))

        names: list[str] = []
        for path in skin_paths:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            self.assertIsInstance(data, dict, path.name)
            self.assertEqual(path.stem, data.get("name"), path.name)
            self.assertIsInstance(data.get("description"), str, path.name)
            self.assertTrue(data["description"].strip(), path.name)
            self.assertIsInstance(data.get("branding"), dict, path.name)
            self.assertTrue(data["branding"].get("prompt_symbol"), path.name)
            self.assertIsInstance(data.get("tool_prefix"), str, path.name)
            self.assertTrue(data["tool_prefix"], path.name)

            colors = data.get("colors")
            self.assertIsInstance(colors, dict, path.name)
            self.assertEqual(REQUIRED_COLOR_KEYS, set(colors), path.name)
            for key, value in colors.items():
                self.assertIsInstance(value, str, f"{path.name}: {key}")
                self.assertRegex(value, HEX_COLOR, f"{path.name}: {key}")
            names.append(data["name"])

        self.assertEqual(50, len(set(names)))

        catalog_blocks = re.findall(
            r"```yaml\n(.*?)\n```",
            (ROOT / "hermes_50_skins_pack.md").read_text(encoding="utf-8"),
            re.S,
        )
        catalog = {data["name"]: data for data in map(yaml.safe_load, catalog_blocks)}
        standalone = {
            path.stem: yaml.safe_load(path.read_text(encoding="utf-8")) for path in skin_paths
        }
        self.assertEqual(standalone, catalog)

    def test_catalog_documents_every_color_key(self) -> None:
        catalog = (ROOT / "hermes_50_skins_pack.md").read_text(encoding="utf-8")
        appendix = catalog.split("## Appendix: All Color Keys Reference", 1)[1]
        documented = set(re.findall(r"\| `([a-z_]+)` \|", appendix))
        self.assertEqual(REQUIRED_COLOR_KEYS, documented)

    def test_installer_copies_all_skins_into_hermes_home(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-skins-install-") as temp_dir:
            hermes_home = Path(temp_dir) / "home"
            env = os.environ.copy()
            env["HERMES_HOME"] = str(hermes_home)

            result = subprocess.run(
                ["bash", str(ROOT / "install.sh")],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual(50, len(list((hermes_home / "skins").glob("*.yaml"))))
            self.assertIn("Installed 50 Hermes skins", result.stdout)

    def test_installer_preserves_existing_skins_without_force(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-skins-install-") as temp_dir:
            hermes_home = Path(temp_dir) / "home"
            target_dir = hermes_home / "skins"
            target_dir.mkdir(parents=True)
            existing = target_dir / "neon-ghost.yaml"
            existing.write_text("local customization\n", encoding="utf-8")
            env = os.environ.copy()
            env["HERMES_HOME"] = str(hermes_home)

            result = subprocess.run(
                ["bash", str(ROOT / "install.sh")],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual("local customization\n", existing.read_text(encoding="utf-8"))
            self.assertIn("skipped 1 existing file", result.stdout)

    def test_installer_preserves_dangling_skin_symlinks(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-skins-install-") as temp_dir:
            hermes_home = Path(temp_dir) / "home"
            target_dir = hermes_home / "skins"
            target_dir.mkdir(parents=True)
            existing = target_dir / "neon-ghost.yaml"
            existing.symlink_to(target_dir / "missing-custom-skin.yaml")
            env = os.environ.copy()
            env["HERMES_HOME"] = str(hermes_home)

            result = subprocess.run(
                ["bash", str(ROOT / "install.sh")],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(existing.is_symlink())
            self.assertIn("skipped 1 existing file", result.stdout)

    def test_installer_preserves_symlink_to_directory(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-skins-directory-link-") as temp_dir:
            temp = Path(temp_dir)
            hermes_home = temp / "home"
            target_dir = hermes_home / "skins"
            target_dir.mkdir(parents=True)
            referent = temp / "custom-directory"
            referent.mkdir()
            existing = target_dir / "alabaster.yaml"
            existing.symlink_to(referent, target_is_directory=True)
            env = os.environ.copy()
            env["HERMES_HOME"] = str(hermes_home)

            result = subprocess.run(
                ["bash", str(ROOT / "install.sh")],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(existing.is_symlink())
            self.assertEqual(referent, existing.resolve())
            self.assertEqual([], list(referent.iterdir()))
            self.assertIn("Installed 49 Hermes skins", result.stdout)
            self.assertIn("skipped 1 existing file", result.stdout)

    def test_installer_preserves_existing_directory_at_skin_path(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-skins-directory-") as temp_dir:
            hermes_home = Path(temp_dir) / "home"
            existing = hermes_home / "skins" / "alabaster.yaml"
            existing.mkdir(parents=True)
            env = os.environ.copy()
            env["HERMES_HOME"] = str(hermes_home)

            result = subprocess.run(
                ["bash", str(ROOT / "install.sh")],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(existing.is_dir())
            self.assertEqual([], list(existing.iterdir()))
            self.assertIn("Installed 49 Hermes skins", result.stdout)
            self.assertIn("skipped 1 existing file", result.stdout)

    def test_installer_preserves_a_path_created_during_install(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-skins-race-") as temp_dir:
            temp = Path(temp_dir)
            hermes_home = temp / "home"
            race_target = hermes_home / "skins" / "alabaster.yaml"
            wrapper_dir = temp / "bin"
            wrapper_dir.mkdir()
            real_python = shutil.which("python3")
            self.assertIsNotNone(real_python)
            wrapper = wrapper_dir / "python3"
            wrapper.write_text(
                "#!/usr/bin/env bash\n"
                'target="$3/alabaster.yaml"\n'
                'if [[ "$target" == "$RACE_TARGET" && ! -e "$target" && ! -L "$target" ]]; then\n'
                "  printf 'race winner\\n' > \"$target\"\n"
                "fi\n"
                f'exec "{real_python}" "$@"\n',
                encoding="utf-8",
            )
            wrapper.chmod(0o755)
            env = os.environ.copy()
            env["HERMES_HOME"] = str(hermes_home)
            env["RACE_TARGET"] = str(race_target)
            env["PATH"] = str(wrapper_dir) + os.pathsep + env["PATH"]

            result = subprocess.run(
                ["bash", str(ROOT / "install.sh")],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual("race winner\n", race_target.read_text(encoding="utf-8"))
            self.assertIn("Installed 49 Hermes skins", result.stdout)
            self.assertIn("skipped 1 existing file", result.stdout)

    def test_installer_reports_unwritable_destination_as_error(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-skins-permission-") as temp_dir:
            hermes_home = Path(temp_dir) / "home"
            target_dir = hermes_home / "skins"
            target_dir.mkdir(parents=True)
            target_dir.chmod(0o500)
            if os.access(target_dir, os.W_OK):
                self.skipTest("permission failure cannot be reproduced as this user")
            env = os.environ.copy()
            env["HERMES_HOME"] = str(hermes_home)
            try:
                result = subprocess.run(
                    ["bash", str(ROOT / "install.sh")],
                    cwd=ROOT,
                    env=env,
                    capture_output=True,
                    text=True,
                    check=False,
                )
            finally:
                target_dir.chmod(0o700)

            self.assertNotEqual(0, result.returncode)
            self.assertIn("Could not install", result.stderr)
            self.assertEqual([], list(target_dir.glob("*.yaml")))

    def test_builder_rejects_unsafe_versions(self) -> None:
        namespace = runpy.run_path(
            str(ROOT / "scripts" / "build_package.py"), run_name="build_package_test"
        )
        validate_version = namespace["validate_version"]

        self.assertEqual("1.0.0", validate_version("1.0.0"))
        for value in ("", "../escape", "1/2/3", "version one"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    validate_version(value)

    def test_builder_creates_complete_versioned_zip(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-skins-build-") as temp_dir:
            temp = Path(temp_dir)
            output_dirs = (temp / "first", temp / "second")
            for output_dir in output_dirs:
                result = subprocess.run(
                    [
                        os.environ.get("PYTHON", "python3"),
                        str(ROOT / "scripts" / "build_package.py"),
                        "--output-dir",
                        str(output_dir),
                    ],
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(0, result.returncode, result.stderr)

            filename = "hermes-skins-pack-v1.0.0.zip"
            first_archive = output_dirs[0] / filename
            second_archive = output_dirs[1] / filename
            self.assertTrue(first_archive.is_file())
            self.assertTrue(second_archive.is_file())
            self.assertEqual(first_archive.read_bytes(), second_archive.read_bytes())

            prefix = "hermes-skins-pack/"
            root_files = ("README.md", "LICENSE", "VERSION", "install.sh", "hermes_50_skins_pack.md")
            expected_sources = {
                prefix + filename: ROOT / filename for filename in root_files
            }
            expected_sources.update(
                {
                    prefix + "skins/" + path.name: path
                    for path in sorted(SKINS_DIR.glob("*.yaml"))
                }
            )

            with zipfile.ZipFile(first_archive) as archive:
                infos = archive.infolist()
                names = [info.filename for info in infos]
                self.assertEqual(55, len(names))
                self.assertEqual(len(names), len(set(names)))
                self.assertEqual(set(expected_sources), set(names))

                for info in infos:
                    member = PurePosixPath(info.filename)
                    self.assertFalse(member.is_absolute())
                    self.assertNotIn("..", member.parts)
                    self.assertEqual((2026, 1, 1, 0, 0, 0), info.date_time)
                    expected_mode = 0o755 if info.filename == prefix + "install.sh" else 0o644
                    self.assertEqual(expected_mode, (info.external_attr >> 16) & 0o777)
                    self.assertEqual(
                        expected_sources[info.filename].read_bytes(),
                        archive.read(info.filename),
                        info.filename,
                    )


if __name__ == "__main__":
    unittest.main()
