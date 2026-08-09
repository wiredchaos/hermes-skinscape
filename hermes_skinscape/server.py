from __future__ import annotations

import json
import mimetypes
import os
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "0.0.0.0"
PORT = 8099
APP_DIR = Path("/app/www")
MEDIA_DIR = Path("/data/media")
MEDIA_FILE = MEDIA_DIR / "current.webm"
MAX_UPLOAD_BYTES = 300 * 1024 * 1024


def read_options() -> dict[str, bool]:
    path = Path("/data/options.json")
    defaults = {"autoplay": True, "loop": True, "muted": True}
    if not path.exists():
        return defaults
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
        return {key: bool(parsed.get(key, value)) for key, value in defaults.items()}
    except (OSError, ValueError, TypeError):
        return defaults


class Handler(BaseHTTPRequestHandler):
    server_version = "HermesSkinscapeBridge/0.1"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[skinscape] {self.address_string()} - {fmt % args}")

    def send_json(self, payload: dict[str, object], status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, content_type: str | None = None) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            self.send_file(APP_DIR / "index.html", "text/html; charset=utf-8")
            return
        if path == "/api/status":
            self.send_json({
                "ready": True,
                "has_media": MEDIA_FILE.exists(),
                "media_url": "media/current.webm" if MEDIA_FILE.exists() else None,
                "options": read_options(),
            })
            return
        if path == "/media/current.webm":
            self.send_file(MEDIA_FILE, "video/webm")
            return
        safe_name = path.lstrip("/")
        if safe_name and ".." not in safe_name:
            candidate = APP_DIR / safe_name
            if candidate.exists():
                self.send_file(candidate)
                return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/upload":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            self.send_json({"ok": False, "error": "Upload must be between 1 byte and 300 MB."}, HTTPStatus.BAD_REQUEST)
            return

        content_type = self.headers.get("Content-Type", "")
        boundary_match = re.search(r"boundary=([^;]+)", content_type)
        if not boundary_match:
            self.send_json({"ok": False, "error": "Expected multipart upload."}, HTTPStatus.BAD_REQUEST)
            return

        boundary = boundary_match.group(1).strip().strip('"').encode("utf-8")
        body = self.rfile.read(length)
        marker = b"--" + boundary
        file_bytes: bytes | None = None
        filename = ""

        for part in body.split(marker):
            if b"Content-Disposition:" not in part or b"filename=" not in part:
                continue
            header_blob, separator, content = part.partition(b"\r\n\r\n")
            if not separator:
                continue
            header_text = header_blob.decode("utf-8", errors="ignore")
            name_match = re.search(r'filename="([^"]+)"', header_text)
            filename = name_match.group(1) if name_match else "upload.webm"
            file_bytes = content.rstrip(b"\r\n-")
            break

        if not file_bytes:
            self.send_json({"ok": False, "error": "No media file found in upload."}, HTTPStatus.BAD_REQUEST)
            return

        if not filename.lower().endswith(".webm"):
            self.send_json({"ok": False, "error": "Skinscape Bridge currently accepts exported WebM files."}, HTTPStatus.BAD_REQUEST)
            return

        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        temp_file = MEDIA_DIR / "current.webm.tmp"
        temp_file.write_bytes(file_bytes)
        os.replace(temp_file, MEDIA_FILE)

        self.send_json({
            "ok": True,
            "message": "Animated ASCII media published to Home Assistant.",
            "media_url": "media/current.webm",
            "bytes": len(file_bytes),
        })


if __name__ == "__main__":
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Hermes Skinscape Bridge listening on {HOST}:{PORT}")
    server.serve_forever()
