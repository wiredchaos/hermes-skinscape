import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path

from hermes_skinscape.server import make_server


WEBM = b"\x1a\x45\xdf\xa3\x42\x82\x84webm" + bytes(range(64))


class BridgeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        index = Path(self.temp.name) / "index.html"
        index.write_text("bridge")
        self.server = make_server("127.0.0.1", 0, Path(self.temp.name) / "data", index)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_ingress_prefixed_routes_and_persistent_upload(self):
        status, _, _ = self.request("PUT", "/api/hassio_ingress/token/api/media", WEBM, {"Content-Type": "video/webm"})
        self.assertEqual(status, 201)
        status, _, body = self.request("GET", "/api/hassio_ingress/token/api/status")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["available"])
        self.assertEqual((Path(self.temp.name) / "data" / "active.webm").read_bytes(), WEBM)

    def test_rejects_non_webm_content_type_and_signature(self):
        self.assertEqual(self.request("PUT", "/api/media", WEBM, {"Content-Type": "video/mp4"})[0], 415)
        self.assertEqual(self.request("PUT", "/api/media", b"not-webm", {"Content-Type": "video/webm"})[0], 415)

    def test_full_and_byte_range_playback(self):
        self.request("PUT", "/api/media", WEBM, {"Content-Type": "video/webm"})
        status, headers, body = self.request("GET", "/api/media")
        self.assertEqual((status, body), (200, WEBM))
        self.assertEqual(headers["Accept-Ranges"], "bytes")
        status, headers, body = self.request("GET", "/api/media", headers={"Range": "bytes=4-11"})
        self.assertEqual((status, body), (206, WEBM[4:12]))
        self.assertEqual(headers["Content-Range"], f"bytes 4-11/{len(WEBM)}")
        status, _, body = self.request("GET", "/api/media", headers={"Range": "bytes=-5"})
        self.assertEqual((status, body), (206, WEBM[-5:]))

    def test_invalid_range_is_416(self):
        self.request("PUT", "/api/media", WEBM, {"Content-Type": "video/webm"})
        status, headers, _ = self.request("GET", "/api/media", headers={"Range": "bytes=999-1000"})
        self.assertEqual(status, 416)
        self.assertEqual(headers["Content-Range"], f"bytes */{len(WEBM)}")

    def test_replacement_is_active(self):
        self.request("PUT", "/api/media", WEBM, {"Content-Type": "video/webm"})
        replacement = WEBM + b"replacement"
        self.request("PUT", "/api/media", replacement, {"Content-Type": "video/webm"})
        self.assertEqual(self.request("GET", "/api/media")[2], replacement)


if __name__ == "__main__":
    unittest.main()
