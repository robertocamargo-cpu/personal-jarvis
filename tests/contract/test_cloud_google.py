"""Cloud Google integration policies remain portable and independent of desktop APIs."""

import shutil
import subprocess
from pathlib import Path

import pytest

from jarvis.core.process_utils import NO_WINDOW_CREATIONFLAGS


def test_cloud_google_contract() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Optional cloud integration requires Node.js")
    result = subprocess.run(
        [node, "--test", "tests/google.test.mjs"],
        cwd=Path(__file__).resolve().parents[2] / "cloud",
        capture_output=True,
        encoding="utf-8",
        timeout=30,
        creationflags=NO_WINDOW_CREATIONFLAGS,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
