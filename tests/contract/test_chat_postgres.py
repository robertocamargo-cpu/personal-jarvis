"""Real PostgreSQL checks for chat shape parity, isolation and concurrency."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from jarvis.agent_chat import postgres_store, store
from jarvis.agent_chat.postgres_store import PostgresAgentChatStore
from jarvis.agent_chat.store import AgentChatStore


@pytest.fixture
def database():
    dsn = os.environ.get("JARVIS_TEST_POSTGRES_DSN")
    if not dsn:
        pytest.skip("JARVIS_TEST_POSTGRES_DSN not set; real PostgreSQL required")
    psycopg = pytest.importorskip("psycopg")
    schema = "chat_test_" + uuid4().hex
    with psycopg.connect(dsn) as connection:
        connection.execute(
            psycopg.sql.SQL("CREATE SCHEMA {}").format(psycopg.sql.Identifier(schema))
        )

    def connect():
        return psycopg.connect(dsn, options=f"-c search_path={schema}", connect_timeout=5)

    try:
        result = PostgresAgentChatStore(connect, "owner")
        result.initialize()
        yield result, connect, psycopg
    finally:
        with psycopg.connect(dsn) as connection:
            connection.execute(
                psycopg.sql.SQL("DROP SCHEMA {} CASCADE").format(psycopg.sql.Identifier(schema))
            )


def create(repository, session_id="session"):
    return repository.create_session(
        provider="gemini",
        model="test",
        effort="",
        cwd="",
        surface="jarvis",
        session_id=session_id,
    )


def event(kind, text="", timestamp=2000):
    return {"kind": kind, "payload": {"text": text}, "ts_ms": timestamp}


def test_sqlite_postgres_chat_contract_parity(database, monkeypatch):
    postgres, _, _ = database
    monkeypatch.setattr(store, "now_ms", lambda: 1000)
    monkeypatch.setattr(postgres_store, "now_ms", lambda: 1000)
    sqlite = AgentChatStore()
    try:
        for repository in (sqlite, postgres):
            create(repository)
            repository.append_event("session", event("text_delta", "transient"))
            repository.append_event("session", event("user_message", "Olá, " + "nome " * 20))
            repository.append_event("session", event("assistant_text", "Olá!\nTudo bem?", 3000))
            repository.append_event("session", event("turn_finished", timestamp=4000))
            repository.update_session(
                "session", title="Conversa", surface="agent", owner_id="other"
            )
            repository.set_data_version(2)
        assert sqlite.get_session("session") == postgres.get_session("session")
        assert sqlite.list_sessions(surface="jarvis") == postgres.list_sessions(surface="jarvis")
        assert sqlite.list_events("session") == postgres.list_events("session")
        assert sqlite.list_events("session", after_seq=1) == postgres.list_events(
            "session", after_seq=1
        )
        assert sqlite.data_version() == postgres.data_version() == 2
        assert len(postgres.list_events("session")) == 3
        assert postgres.list_sessions(surface="agent") == []
        for repository in (sqlite, postgres):
            repository.reseat_session("session", provider="replacement", model="next")
        assert sqlite.sessions_on("jarvis", "replacement") == postgres.sessions_on(
            "jarvis", "replacement"
        )
    finally:
        sqlite.close()


def test_owners_cannot_read_change_append_or_delete_each_others_sessions(database):
    owner, connect, _ = database
    create(owner)
    owner.append_event("session", event("user_message", "private"))
    other = PostgresAgentChatStore(connect, "other")
    assert other.get_session("session") is None
    assert other.list_events("session") == []
    assert other.list_sessions() == []
    assert other.update_session("session", title="changed") is None
    assert not other.delete_session("session")
    with pytest.raises(KeyError):
        other.append_event("session", event("user_message", "unauthorized"))
    create(other)  # Identical session IDs remain distinct across owners.
    other.append_event("session", event("user_message", "other owner"))
    assert owner.list_events("session")[0]["payload"]["text"] == "private"
    assert other.delete_session("session")
    assert owner.get_session("session") is not None


def test_concurrent_events_keep_sequence_and_counters(database):
    repository, connect, _ = database
    create(repository)

    def append(index):
        separate = PostgresAgentChatStore(connect, "owner")
        return separate.append_event("session", event("user_message", str(index)))["seq"]

    with ThreadPoolExecutor(max_workers=4) as executor:
        sequences = list(executor.map(append, range(12)))
    assert sorted(sequences) == list(range(1, 13))
    assert repository.get_session("session").message_count == 12
    assert [row["seq"] for row in repository.list_events("session")] == list(range(1, 13))


def test_failed_event_rolls_back_and_reconnect_preserves_history(database):
    repository, connect, psycopg = database
    create(repository)
    repository.append_event("session", event("user_message", "Meu projeto se chama Jarvis Alpha."))
    # A null character is rejected by PostgreSQL JSONB, after the session lock.
    with pytest.raises(psycopg.Error):
        repository.append_event("session", event("user_message", "invalid\x00text"))
    reopened = PostgresAgentChatStore(connect, "owner")
    assert reopened.get_session("session").message_count == 1
    assert len(reopened.list_events("session")) == 1
    assert "Jarvis Alpha" in reopened.list_events("session")[0]["payload"]["text"]
    assert reopened.append_event("session", event("assistant_text", "Entendido."))["seq"] == 2
    assert reopened.delete_session("session")
    assert reopened.list_events("session") == []


def test_snapshot_import_preserves_history_and_never_overwrites(database):
    destination, _, psycopg = database
    source = AgentChatStore()
    try:
        create(source)
        source.append_event("session", event("user_message", "Meu projeto se chama Jarvis Alpha."))
        source.append_event("session", event("assistant_text", "Entendido.", 3000))
        snapshot = source.get_session("session")
        events = source.list_events("session")
        destination.import_session(snapshot, events)
        assert destination.get_session("session") == snapshot
        assert destination.list_events("session") == events
        with pytest.raises(psycopg.errors.UniqueViolation):
            destination.import_session(snapshot, events)
        assert destination.list_events("session") == events
        assert source.list_events("session") == events
    finally:
        source.close()


def test_failed_import_does_not_leave_a_partial_conversation(database):
    destination, _, psycopg = database
    source = AgentChatStore()
    try:
        snapshot = create(source)
        events = [
            {**event("user_message", "valid"), "seq": 1},
            {**event("assistant_text", "invalid\x00text"), "seq": 2},
        ]
        with pytest.raises(psycopg.Error):
            destination.import_session(snapshot, events)
        assert destination.get_session("session") is None
        assert destination.list_events("session") == []
        with pytest.raises(ValueError):
            destination.import_session(snapshot, list(reversed(events)))
    finally:
        source.close()
