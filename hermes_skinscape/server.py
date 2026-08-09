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
PORT = int(os.environ.get("PORT", "8099"))
APP_DIR = Path(os.environ.get("APP_DIR", "/app/www"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
MEDIA_DIR = DATA_DIR / "media"
MEDIA_FILE = MEDIA_DIR / "current.webm"
MAX_UPLOAD_BYTES = 300 * 1024 * 1024
WEBM_MAGIC = b"\x1aE\xdf\xa3"


def read_options() -> dict[str, bool]:
    path = DATA_DIR / "options.json"
    defaults = {"autoplay": True, "loop": True, "muted": True}
    if not path.exists():
        return defaults
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
        return {key: bool(parsed.get(key, value)) for key, value in defaults.items()}
    except (OSError, ValueError, TypeError):
        return defaults


class Handler(BaseHTTPRequestHandler):
    server_version = "HermesSkinscapeBridge/0.2"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[skinscape] {self.address_string()} - {fmt % args}")

    def send_json(self, payload: dict[str, object], status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def send_static_file(self, path: Path, content_type: str | None = None) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def send_media(self) -> None:
        if not MEDIA_FILE.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        size = MEDIA_FILE.stat().st_size
        range_header = self.headers.get("Range", "")
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip()) if range_header else None
        start, end = 0, size - 1
        status = HTTPStatus.OK
        if match:
            raw_start, raw_end = match.groups()
            if raw_start:
                start = int(raw_start)
                end = int(raw_end) if raw_end else size - 1
            elif raw_end:
                suffix = min(int(raw_end), size)
                start = size - suffix
            if start >= size or end < start:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            end = min(end, size - 1)
            status = HTTPStatus.PARTIAL_CONTENT
        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", "video/webm")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with MEDIA_FILE.open("rb") as source:
            source.seek(start)
            remaining = length
            while remaining:
                chunk = source.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            self.send_static_file(APP_DIR / "index.html", "text/html; charset=utf-8")
            return
        if path in {"/health", "/api/health"}:
            self.send_json({"ok": True, "service": "hermes-skinscape-bridge"})
            return
        if path == "/api/status":
            self.send_json({
                "ready": True,
                "has_media": MEDIA_FILE.exists(),
                "media_url": "media/current.webm" if MEDIA_FILE.exists() else None,
                "media_bytes": MEDIA_FILE.stat().st_size if MEDIA_FILE.exists() else 0,
                "options": read_options(),
            })
            return
        if path == "/media/current.webm":
            self.send_media()
            return
        safe_name = path.lstrip("/")
        if safe_name and ".." not in safe_name:
            candidate = (APP_DIR / safe_name).resolve()
            if APP_DIR.resolve() in candidate.parents and candidate.exists():
                self.send_static_file(candidate)
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
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        filename = self.headers.get("X-Filename", "upload.webm")
        if content_type not in {"video/webm", "application/octet-stream"} or not filename.lower().endswith(".webm"):
            self.send_json({"ok": False, "error": "Only exported WebM files are accepted."}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
            return
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        temp_file = MEDIA_DIR / "current.webm.tmp"
        remaining = length
        first = b""
        with temp_file.open("wb") as target:
            while remaining:
                chunk = self.rfile.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                if len(first) < 4:
                    first += chunk[: 4 - len(first)]
                target.write(chunk)
                remaining -= len(chunk)
        if remaining != 0 or first != WEBM_MAGIC:
            temp_file.unlink(missing_ok=True)
            self.send_json({"ok": False, "error": "The upload is not a valid WebM container."}, HTTPStatus.BAD_REQUEST)
            return
        os.replace(temp_file, MEDIA_FILE)
        self.send_json({
            "ok": True,
            "message": "Animated ASCII media published to Home Assistant.",
            "media_url": "media/current.webm",
            "bytes": length,
        })


if __name__ == "__main__":
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Hermes Skinscape Bridge listening on {HOST}:{PORT}")
    server.serve_forever()
