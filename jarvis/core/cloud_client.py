"""Client for device pairing and authenticated communication between Jarvis Desktop and Cloud."""

from __future__ import annotations

import json
import os
import platform
import stat
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from jarvis.core.paths import user_data_dir

DEFAULT_CLOUD_URL = "https://jarvis-bob.vercel.app"
PAIR_FILE_NAME = "cloud_pair.json"
INSTALLATION_ID_FILE = "installation_id"


def _pairing_file_path() -> Path:
    return user_data_dir() / PAIR_FILE_NAME


def get_installation_id() -> str:
    """Get or generate a persistent installation ID for this machine."""
    path = user_data_dir() / INSTALLATION_ID_FILE
    if path.exists():
        try:
            val = path.read_text(encoding="utf-8").strip()
            if val:
                return val
        except OSError:
            pass

    new_id = str(uuid.uuid4())
    try:
        user_data_dir().mkdir(parents=True, exist_ok=True)
        path.write_text(new_id, encoding="utf-8")
        if os.name != "nt":
            path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass
    return new_id


def get_device_name() -> str:
    """Get friendly device hostname and OS."""
    node = platform.node() or "Desktop"
    system = platform.system() or "macOS"
    return f"{node} ({system})"


def get_pairing_status() -> dict[str, Any] | None:
    """Return pairing state if paired, or None."""
    path = _pairing_file_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and data.get("owner_id") and data.get("device_token"):
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return None


def pair_device(code: str, cloud_url: str = DEFAULT_CLOUD_URL) -> dict[str, Any]:
    """Claim a single-use pairing code and save device credentials locally."""
    clean_code = code.strip().upper()
    cloud_base = cloud_url.rstrip("/")
    endpoint = f"{cloud_base}/api/pair/claim"

    device_id = get_installation_id()
    device_name = get_device_name()

    payload = json.dumps(
        {
            "code": clean_code,
            "device_id": device_id,
            "device_name": device_name,
        }
    ).encode("utf-8")

    req = urllib.request.Request(  # noqa: S310
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": f"PersonalJarvis/{platform.system()}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:  # noqa: S310
            resp_bytes = response.read()
            result = json.loads(resp_bytes.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        status = exc.code
        body = exc.read().decode("utf-8", errors="replace")
        err_code = "request_failed"
        try:
            err_json = json.loads(body)
            err_code = err_json.get("error", err_code)
        except Exception:  # noqa: S110
            pass

        if status == 404:
            raise ValueError("Código de pareamento não encontrado.") from exc
        if status == 409:
            raise ValueError("Código de pareamento já foi utilizado.") from exc
        if status == 410:
            raise ValueError("Código de pareamento expirou (validade: 10 minutos).") from exc
        raise RuntimeError(f"Erro no pareamento (HTTP {status}): {err_code}") from exc
    except urllib.error.URLError as exc:
        raise ConnectionError(
            f"Não foi possível conectar à nuvem ({cloud_base}): {exc.reason}"
        ) from exc

    owner_id = result.get("owner_id")
    device_token = result.get("device_token")
    if not owner_id or not device_token:
        raise RuntimeError("A nuvem não retornou as credenciais completas de pareamento.")

    state = {
        "owner_id": owner_id,
        "device_token": device_token,
        "device_id": device_id,
        "device_name": device_name,
        "cloud_url": cloud_base,
        "paired_at": datetime.now(UTC).isoformat(),
    }

    # Atomic safe write with 0600 permissions
    target_path = _pairing_file_path()
    target_path.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = target_path.parent
    with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8") as tf:
        json.dump(state, tf, indent=2)
        temp_name = tf.name

    if os.name != "nt":
        os.chmod(temp_name, stat.S_IRUSR | stat.S_IWUSR)
    os.replace(temp_name, target_path)

    return state


def unpair_device() -> bool:
    """Remove local pairing credentials."""
    path = _pairing_file_path()
    if path.exists():
        try:
            path.unlink()
            return True
        except OSError:
            pass
    return False


def publish_approval(
    trace_id: str,
    tool_name: str,
    risk_tier: str = "ask",
    reason: str = "",
    args_preview: str = "",
    expires_at_ns: int | None = None,
) -> dict[str, Any]:
    """Publish a pending tool approval to the Cloud for remote decision."""
    pair_state = get_pairing_status()
    if not pair_state:
        raise RuntimeError("Dispositivo não pareado com a nuvem.")

    cloud_base = pair_state.get("cloud_url", DEFAULT_CLOUD_URL).rstrip("/")
    device_token = pair_state.get("device_token", "")
    endpoint = f"{cloud_base}/api/approvals/publish"

    payload_data = {
        "trace_id": str(trace_id),
        "tool_name": str(tool_name),
        "risk_tier": str(risk_tier),
        "reason": str(reason),
        "args_preview": str(args_preview),
    }
    if expires_at_ns:
        payload_data["expires_at_ns"] = expires_at_ns

    payload = json.dumps(payload_data).encode("utf-8")

    req = urllib.request.Request(  # noqa: S310
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-jarvis-device-token": device_token,
            "User-Agent": f"PersonalJarvis/{platform.system()}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=5) as response:  # noqa: S310
        resp_bytes = response.read()
        return json.loads(resp_bytes.decode("utf-8"))


def poll_approval(trace_id: str) -> dict[str, Any]:
    """Poll cloud approval status for a specific trace_id."""
    pair_state = get_pairing_status()
    if not pair_state:
        raise RuntimeError("Dispositivo não pareado com a nuvem.")

    cloud_base = pair_state.get("cloud_url", DEFAULT_CLOUD_URL).rstrip("/")
    device_token = pair_state.get("device_token", "")
    endpoint = f"{cloud_base}/api/approvals/poll?trace_id={urllib.parse.quote(str(trace_id))}"

    req = urllib.request.Request(  # noqa: S310
        endpoint,
        headers={
            "x-jarvis-device-token": device_token,
            "User-Agent": f"PersonalJarvis/{platform.system()}",
        },
        method="GET",
    )

    with urllib.request.urlopen(req, timeout=5) as response:  # noqa: S310
        resp_bytes = response.read()
        return json.loads(resp_bytes.decode("utf-8"))


def poll_mac_messages() -> list[dict[str, Any]]:
    """Poll cloud for pending chat messages addressed to this Mac."""
    pair_state = get_pairing_status()
    if not pair_state:
        return []

    cloud_base = pair_state.get("cloud_url", DEFAULT_CLOUD_URL).rstrip("/")
    device_token = pair_state.get("device_token", "")
    endpoint = f"{cloud_base}/api/mac/messages/poll"

    req = urllib.request.Request(  # noqa: S310
        endpoint,
        headers={
            "x-jarvis-device-token": device_token,
            "User-Agent": f"PersonalJarvis/{platform.system()}",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:  # noqa: S310
            resp_bytes = response.read()
            data = json.loads(resp_bytes.decode("utf-8"))
            return data.get("messages", [])
    except Exception:  # noqa: S110
        return []


def reply_mac_message(
    request_id: str,
    assistant_text: str,
    status: str = "complete",
    error: str | None = None,
) -> bool:
    """Send assistant reply back to cloud for a processed message."""
    pair_state = get_pairing_status()
    if not pair_state:
        return False

    cloud_base = pair_state.get("cloud_url", DEFAULT_CLOUD_URL).rstrip("/")
    device_token = pair_state.get("device_token", "")
    endpoint = f"{cloud_base}/api/mac/messages/reply"

    payload = json.dumps(
        {
            "requestId": str(request_id),
            "assistantText": str(assistant_text),
            "status": str(status),
            "error": error,
        }
    ).encode("utf-8")

    req = urllib.request.Request(  # noqa: S310
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-jarvis-device-token": device_token,
            "User-Agent": f"PersonalJarvis/{platform.system()}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:  # noqa: S310
            return response.status == 200
    except Exception:  # noqa: S110
        return False
