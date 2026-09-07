"""Contract tests for desktop cloud pairing."""
from __future__ import annotations

import http.server
import json
import threading
from pathlib import Path
from typing import Any

import pytest

from jarvis.core import cloud_client


class _MockCloudHandler(http.server.BaseHTTPRequestHandler):
    pairing_db: dict[str, Any] = {
        "JRV-TEST-0001": {
            "owner_id": "user_contract_test_123",
            "status": "pending",
        }
    }

    def do_POST(self) -> None:
        if self.path == "/api/pair/claim":
            length = int(self.headers.get("content-length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            code = body.get("code")
            device_id = body.get("device_id")
            device_name = body.get("device_name")

            if code == "JRV-EXPIRED":
                self.send_response(410)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"pairing_code_expired"}')
                return

            if code not in self.pairing_db:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"pairing_code_not_found"}')
                return

            item = self.pairing_db[code]
            if item["status"] != "pending":
                self.send_response(409)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"pairing_code_already_used"}')
                return

            item["status"] = "claimed"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = json.dumps({
                "success": True,
                "owner_id": item["owner_id"],
                "device_token": "a" * 64,
                "device_id": device_id,
                "device_name": device_name,
                "cloud_url": "http://127.0.0.1",
            }).encode("utf-8")
            self.wfile.write(resp)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        pass


@pytest.fixture
def mock_cloud_server():
    server = http.server.HTTPServer(("127.0.0.1", 0), _MockCloudHandler)
    host, port = server.server_address
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://{host}:{port}"
    server.shutdown()
    server.server_close()


def test_installation_id_and_device_name(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(cloud_client, "user_data_dir", lambda: tmp_path)
    id1 = cloud_client.get_installation_id()
    assert len(id1) == 36
    id2 = cloud_client.get_installation_id()
    assert id1 == id2, "Installation ID must be persistent"

    name = cloud_client.get_device_name()
    assert isinstance(name, str)
    assert len(name) > 0


def test_pair_device_flow(mock_cloud_server: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(cloud_client, "user_data_dir", lambda: tmp_path)

    # Initial status is None
    assert cloud_client.get_pairing_status() is None

    # Claim valid code
    result = cloud_client.pair_device("JRV-TEST-0001", cloud_url=mock_cloud_server)
    assert result["owner_id"] == "user_contract_test_123"
    assert result["device_token"] == "a" * 64

    # Status now returns paired details
    status = cloud_client.get_pairing_status()
    assert status is not None
    assert status["owner_id"] == "user_contract_test_123"
    assert status["cloud_url"] == mock_cloud_server

    # Reusing the same code causes 409
    with pytest.raises(ValueError, match="já foi utilizado"):
        cloud_client.pair_device("JRV-TEST-0001", cloud_url=mock_cloud_server)

    # Expired code causes 410
    with pytest.raises(ValueError, match="expirou"):
        cloud_client.pair_device("JRV-EXPIRED", cloud_url=mock_cloud_server)

    # Unknown code causes 404
    with pytest.raises(ValueError, match="não encontrado"):
        cloud_client.pair_device("JRV-UNKNOWN", cloud_url=mock_cloud_server)

    # Unpair works
    assert cloud_client.unpair_device() is True
    assert cloud_client.get_pairing_status() is None
    assert cloud_client.unpair_device() is False
