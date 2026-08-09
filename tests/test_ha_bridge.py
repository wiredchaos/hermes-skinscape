from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).parents[1] / "hermes_skinscape" / "server.py"
spec = importlib.util.spec_from_file_location("bridge_server", MODULE)
server = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(server)


class BridgeTests(unittest.TestCase):
    def test_defaults_without_options(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            previous = server.DATA_DIR
            server.DATA_DIR = Path(temp)
            try:
                self.assertEqual(
                    server.read_options(),
                    {"autoplay": True, "loop": True, "muted": True},
                )
            finally:
                server.DATA_DIR = previous

    def test_webm_magic_constant(self) -> None:
        self.assertEqual(server.WEBM_MAGIC, b"\x1aE\xdf\xa3")


if __name__ == "__main__":
    unittest.main()
