"""Read-only source snapshot failure cases require no PostgreSQL installation."""

import sqlite3
from contextlib import closing

import pytest

from jarvis.agent_chat.migration import read_chat_snapshots
from jarvis.agent_chat.store import AgentChatStore


def test_missing_source_is_not_created(tmp_path):
    path = tmp_path / "missing.db"
    with pytest.raises(sqlite3.OperationalError):
        read_chat_snapshots(path)
    assert not path.exists()


def test_orphaned_events_are_not_silently_lost(tmp_path):
    path = tmp_path / "source.db"
    source = AgentChatStore(path)
    source.close()
    with closing(sqlite3.connect(path)) as connection, connection:
        connection.execute(
            "INSERT INTO agent_chat_events VALUES ('missing',1,1000,'user_message','{}')"
        )
    with pytest.raises(ValueError, match="orphaned"):
        read_chat_snapshots(path)
    with closing(sqlite3.connect(path)) as connection:
        assert connection.execute("SELECT COUNT(*) FROM agent_chat_events").fetchone()[0] == 1
