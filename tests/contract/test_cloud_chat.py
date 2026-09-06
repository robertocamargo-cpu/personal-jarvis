"""Portable cloud chat policy/stream contract; no desktop or live provider required."""

import shutil
import subprocess
from pathlib import Path

import pytest

from jarvis.core.process_utils import NO_WINDOW_CREATIONFLAGS


def test_cloud_chat_policy_and_stream_contract() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Optional cloud chat contract requires Node.js")
    result = subprocess.run(
        [node, "--test", "tests/chat.test.mjs"],
        cwd=Path(__file__).resolve().parents[2] / "cloud",
        capture_output=True,
        encoding="utf-8",
        timeout=30,
        creationflags=NO_WINDOW_CREATIONFLAGS,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
