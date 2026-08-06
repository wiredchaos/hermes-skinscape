#!/usr/bin/env python3
"""Dependency-free Home Assistant ingress bridge for one persistent WebM file."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

MAX_UPLOAD_BYTES = 250 * 1024 * 1024
WEBM_EBML_HEADER = b"\x1a\x45\xdf\xa3"
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "HermesSkinscape/0.1"

    @property
    def data_file(self) -> Path:
        return self.server.data_dir / "active.webm"  # type: ignore[attr-defined]

    @property
    def index_file(self) -> Path:
        return self.server.index_file  # type: ignore[attr-defined]

    def _route(self) -> str:
        path = urlsplit(self.path).path.rstrip("/")
        for route in ("/api/health", "/api/status", "/api/media"):
            if path.endswith(route):
                return route
        return "/"

    def _headers(self, status: int, content_type: str, length: int, **extra: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        for name, value in extra.items():
            self.send_header(name.replace("_", "-"), value)
        self.end_headers()

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode()
        self._headers(status, "application/json", len(body))
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        route = self._route()
        if route == "/api/health":
            self._json(HTTPStatus.OK, {"status": "ok"})
        elif route == "/api/status":
            if self.data_file.is_file():
                stat = self.data_file.stat()
                self._json(HTTPStatus.OK, {"available": True, "size": stat.st_size, "updated_ns": stat.st_mtime_ns})
            else:
                self._json(HTTPStatus.OK, {"available": False})
        elif route == "/api/media":
            self._serve_media()
        else:
            body = self.index_file.read_bytes()
            self._headers(HTTPStatus.OK, "text/html; charset=utf-8", len(body))
            self.wfile.write(body)

    def do_HEAD(self) -> None:  # noqa: N802
        if self._route() == "/api/media":
            self._serve_media()
        else:
            self.do_GET()

    def do_PUT(self) -> None:  # noqa: N802
        if self._route() != "/api/media":
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        content_type = self.headers.get_content_type()
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            length = -1
        if content_type != "video/webm":
            self._json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {"error": "Content-Type must be video/webm"})
            return
        if length < 4:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "A non-empty WebM body is required"})
            return
        if length > MAX_UPLOAD_BYTES:
            self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "WebM exceeds 250 MiB limit"})
            return

        self.server.data_dir.mkdir(parents=True, exist_ok=True)  # type: ignore[attr-defined]
        first = self.rfile.read(min(length, 4096))
        if not first.startswith(WEBM_EBML_HEADER) or b"webm" not in first.lower():
            self._json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {"error": "Body is not a WebM container"})
            return
        fd, temporary = tempfile.mkstemp(prefix="upload-", suffix=".webm", dir=self.server.data_dir)  # type: ignore[attr-defined]
        try:
            with os.fdopen(fd, "wb") as output:
                output.write(first)
                remaining = length - len(first)
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ConnectionError("upload ended early")
                    output.write(chunk)
                    remaining -= len(chunk)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, self.data_file)
        except (ConnectionError, OSError) as error:
            Path(temporary).unlink(missing_ok=True)
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        self._json(HTTPStatus.CREATED, {"stored": True, "size": length})

    def _serve_media(self) -> None:
        if not self.data_file.is_file():
            self._json(HTTPStatus.NOT_FOUND, {"error": "no active media"})
            return
        size = self.data_file.stat().st_size
        start, end = 0, size - 1
        requested = self.headers.get("Range")
        if requested:
            match = RANGE_RE.fullmatch(requested.strip())
            if not match:
                self._range_error(size)
                return
            first, last = match.groups()
            if not first:
                suffix = int(last or "0")
                if suffix <= 0:
                    self._range_error(size)
                    return
                start = max(0, size - suffix)
            else:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            if start >= size or end < start:
                self._range_error(size)
                return
        length = end - start + 1
        status = HTTPStatus.PARTIAL_CONTENT if requested else HTTPStatus.OK
        extra = {"Accept_Ranges": "bytes"}
        if requested:
            extra["Content_Range"] = f"bytes {start}-{end}/{size}"
        self._headers(status, "video/webm", length, **extra)
        if self.command == "HEAD":
            return
        with self.data_file.open("rb") as media:
            media.seek(start)
            remaining = length
            while remaining:
                chunk = media.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def _range_error(self, size: int) -> None:
        body = b'{"error":"invalid byte range"}'
        self._headers(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "application/json", len(body), Content_Range=f"bytes */{size}")
        if self.command != "HEAD":
            self.wfile.write(body)


def make_server(host: str, port: int, data_dir: Path, index_file: Path | None = None) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), BridgeHandler)
    server.data_dir = data_dir  # type: ignore[attr-defined]
    server.index_file = index_file or Path(__file__).with_name("index.html")  # type: ignore[attr-defined]
    return server


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8099)
    parser.add_argument("--data-dir", type=Path, default=Path("/data"))
    args = parser.parse_args()
    with make_server(args.host, args.port, args.data_dir) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
