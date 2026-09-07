"""Client for device pairing and authenticated communication between Jarvis Desktop and Cloud."""
from __future__ import annotations

import json
import os
import platform
import stat
import tempfile
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
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

    payload = json.dumps({
        "code": clean_code,
        "device_id": device_id,
        "device_name": device_name,
    }).encode("utf-8")

    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": f"PersonalJarvis/{platform.system()}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            resp_bytes = response.read()
            result = json.loads(resp_bytes.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        status = exc.code
        body = exc.read().decode("utf-8", errors="replace")
        err_code = "request_failed"
        try:
            err_json = json.loads(body)
            err_code = err_json.get("error", err_code)
        except Exception:
            pass

        if status == 404:
            raise ValueError("Código de pareamento não encontrado.") from exc
        if status == 409:
            raise ValueError("Código de pareamento já foi utilizado.") from exc
        if status == 410:
            raise ValueError("Código de pareamento expirou (validade: 10 minutos).") from exc
        raise RuntimeError(f"Erro no pareamento (HTTP {status}): {err_code}") from exc
    except urllib.error.URLError as exc:
        raise ConnectionError(f"Não foi possível conectar à nuvem ({cloud_base}): {exc.reason}") from exc

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
        "paired_at": datetime.now(timezone.utc).isoformat(),
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
