"""Cloud authorization policy is portable and does not require desktop extras."""

import shutil
import subprocess
from pathlib import Path

import pytest

from jarvis.core.process_utils import NO_WINDOW_CREATIONFLAGS


def test_cloud_auth_policy_contract() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Cloud contract requires Node.js; desktop installation is unaffected")
    root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [node, "--test", "tests/auth-policy.test.mjs"],
        cwd=root / "cloud",
        capture_output=True,
        encoding="utf-8",
        timeout=30,
        creationflags=NO_WINDOW_CREATIONFLAGS,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
