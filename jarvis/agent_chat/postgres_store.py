"""Opt-in PostgreSQL store for existing agent-chat sessions and event shapes.

The caller supplies an authenticated owner and a Psycopg connection factory.
No credentials, cloud defaults, startup work or migration of live data occurs
on import. This adapter is not an authentication boundary by itself.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Callable
from dataclasses import asdict
from typing import Any

from jarvis.agent_chat.events import is_transient, now_ms
from jarvis.agent_chat.store import DEFAULT_SURFACE, SURFACES, AgentChatSession, _title_from


class PostgresAgentChatStore:
    """Owner-scoped store compatible with the local chat store's public API.

    Row locks serialize event sequence assignment and metadata updates for one
    session. Separate sessions can progress concurrently. Connections commit or
    roll back on context exit; no database connection remains open between calls.
    """

    def __init__(self, connect: Callable[[], Any], owner_id: str) -> None:
        if not isinstance(owner_id, str) or not owner_id.strip():
            raise ValueError("An authenticated owner ID is required")
        self._connect = connect
        self.owner_id = owner_id

    def initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS agent_chat_sessions_v1 ("
                "owner_id TEXT NOT NULL, session_id TEXT NOT NULL, payload JSONB NOT NULL, "
                "PRIMARY KEY(owner_id, session_id))"
            )
            connection.execute(
                "CREATE TABLE IF NOT EXISTS agent_chat_events_v1 ("
                "owner_id TEXT NOT NULL, session_id TEXT NOT NULL, seq BIGINT NOT NULL, "
                "ts_ms BIGINT NOT NULL, kind TEXT NOT NULL, payload JSONB NOT NULL, "
                "PRIMARY KEY(owner_id, session_id, seq), "
                "FOREIGN KEY(owner_id, session_id) REFERENCES "
                "agent_chat_sessions_v1(owner_id, session_id) ON DELETE CASCADE)"
            )
            connection.execute(
                "CREATE TABLE IF NOT EXISTS agent_chat_versions_v1 ("
                "owner_id TEXT PRIMARY KEY, version INTEGER NOT NULL)"
            )

    def close(self) -> None:
        """Connections are closed by each operation's context manager."""

    def create_session(
        self,
        *,
        provider: str,
        model: str,
        effort: str,
        cwd: str,
        permission_mode: str = "",
        title: str = "",
        session_id: str | None = None,
        surface: str = DEFAULT_SURFACE,
    ) -> AgentChatSession:
        if surface not in SURFACES:
            raise ValueError(f"surface must be one of {SURFACES}")
        now = now_ms()
        session = AgentChatSession(
            session_id=session_id or uuid.uuid4().hex,
            title=title,
            provider=provider,
            model=model,
            effort=effort,
            cwd=cwd,
            permission_mode=(permission_mode or "").strip(),
            vendor_session=None,
            created_ms=now,
            updated_ms=now,
            message_count=0,
            preview="",
            surface=surface,
        )
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO agent_chat_sessions_v1 VALUES (%s, %s, %s::jsonb)",
                (
                    self.owner_id,
                    session.session_id,
                    json.dumps(asdict(session), ensure_ascii=False),
                ),
            )
        return session

    def _read(self, connection: Any, session_id: str, *, lock: bool = False) -> Any:
        query = "SELECT payload FROM agent_chat_sessions_v1 WHERE owner_id=%s AND session_id=%s"
        if lock:
            query += " FOR UPDATE"
        row = connection.execute(query, (self.owner_id, session_id)).fetchone()
        return dict(row[0]) if row else None

    def _write(self, connection: Any, session_id: str, payload: dict[str, Any]) -> None:
        connection.execute(
            "UPDATE agent_chat_sessions_v1 SET payload=%s::jsonb "
            "WHERE owner_id=%s AND session_id=%s",
            (json.dumps(payload, ensure_ascii=False), self.owner_id, session_id),
        )

    def get_session(self, session_id: str) -> AgentChatSession | None:
        with self._connect() as connection:
            payload = self._read(connection, session_id)
        return AgentChatSession(**payload) if payload else None

    def import_session(
        self,
        session: AgentChatSession,
        events: list[dict[str, Any]],
    ) -> None:
        """Import an explicit snapshot atomically, preserving IDs and timestamps.

        Existing destination sessions are never overwritten. This only writes
        data; it does not resume runners, execute tools or approve past actions.
        The caller must capture a consistent source snapshot before calling.
        """
        if session.surface not in SURFACES:
            raise ValueError("Unknown chat surface")
        previous = 0
        for entry in events:
            sequence = entry.get("seq")
            if type(sequence) is not int or sequence <= previous or is_transient(entry):
                raise ValueError("Imported events require increasing durable sequence numbers")
            if not isinstance(entry.get("payload"), dict):
                raise ValueError("Imported event payload must be an object")
            previous = sequence
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO agent_chat_sessions_v1 VALUES (%s,%s,%s::jsonb)",
                (
                    self.owner_id,
                    session.session_id,
                    json.dumps(asdict(session), ensure_ascii=False),
                ),
            )
            for entry in events:
                connection.execute(
                    "INSERT INTO agent_chat_events_v1 VALUES (%s,%s,%s,%s,%s,%s::jsonb)",
                    (
                        self.owner_id,
                        session.session_id,
                        entry["seq"],
                        int(entry["ts_ms"]),
                        str(entry["kind"]),
                        json.dumps(entry["payload"], ensure_ascii=False),
                    ),
                )

    def list_sessions(
        self,
        limit: int = 200,
        *,
        surface: str | None = None,
    ) -> list[AgentChatSession]:
        query = "SELECT payload FROM agent_chat_sessions_v1 WHERE owner_id=%s"
        params: list[Any] = [self.owner_id]
        if surface is not None:
            query += " AND payload->>'surface'=%s"
            params.append(surface)
        query += " ORDER BY (payload->>'updated_ms')::bigint DESC, session_id LIMIT %s"
        params.append(max(0, int(limit)))
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        return [AgentChatSession(**row[0]) for row in rows]

    def update_session(self, session_id: str, **fields: Any) -> AgentChatSession | None:
        allowed = {
            "title",
            "provider",
            "model",
            "effort",
            "cwd",
            "permission_mode",
            "vendor_session",
        }
        updates = {
            key: value for key, value in fields.items() if key in allowed and value is not None
        }
        with self._connect() as connection:
            payload = self._read(connection, session_id, lock=True)
            if payload is None:
                return None
            if updates:
                payload.update(updates, updated_ms=now_ms())
                self._write(connection, session_id, payload)
        return AgentChatSession(**payload)

    def delete_session(self, session_id: str) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM agent_chat_sessions_v1 WHERE owner_id=%s AND session_id=%s",
                (self.owner_id, session_id),
            )
            return cursor.rowcount > 0

    def append_event(self, session_id: str, event: dict[str, Any]) -> dict[str, Any]:
        if is_transient(event):
            return event
        kind = str(event.get("kind") or "")
        payload = event.get("payload") or {}
        timestamp = int(event.get("ts_ms") or now_ms())
        with self._connect() as connection:
            session = self._read(connection, session_id, lock=True)
            if session is None:
                raise KeyError("Session not found for this owner")
            row = connection.execute(
                "SELECT COALESCE(MAX(seq),0)+1 FROM agent_chat_events_v1 "
                "WHERE owner_id=%s AND session_id=%s",
                (self.owner_id, session_id),
            ).fetchone()
            seq = int(row[0])
            connection.execute(
                "INSERT INTO agent_chat_events_v1 VALUES (%s,%s,%s,%s,%s,%s::jsonb)",
                (
                    self.owner_id,
                    session_id,
                    seq,
                    timestamp,
                    kind,
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
            if kind == "user_message":
                text = str(payload.get("text") or "")
                session["message_count"] += 1
                session["title"] = session["title"] or _title_from(text)
                session.update(preview=text[:120], updated_ms=timestamp)
            elif kind == "assistant_text":
                text = " ".join(str(payload.get("text") or "").split())
                if text:
                    session.update(preview=text[:120], updated_ms=timestamp)
            else:
                session["updated_ms"] = timestamp
            self._write(connection, session_id, session)
        return {**event, "seq": seq, "ts_ms": timestamp}

    def list_events(self, session_id: str, *, after_seq: int = 0) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT seq,ts_ms,kind,payload FROM agent_chat_events_v1 "
                "WHERE owner_id=%s AND session_id=%s AND seq>%s ORDER BY seq",
                (self.owner_id, session_id, int(after_seq)),
            ).fetchall()
        return [dict(zip(("seq", "ts_ms", "kind", "payload"), row, strict=True)) for row in rows]

    def data_version(self) -> int:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT version FROM agent_chat_versions_v1 WHERE owner_id=%s",
                (self.owner_id,),
            ).fetchone()
        return int(row[0]) if row else 0

    def set_data_version(self, version: int) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO agent_chat_versions_v1 VALUES (%s,%s) "
                "ON CONFLICT(owner_id) DO UPDATE SET version=excluded.version",
                (self.owner_id, int(version)),
            )

    def sessions_on(self, surface: str, provider: str) -> list[AgentChatSession]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT payload FROM agent_chat_sessions_v1 WHERE owner_id=%s "
                "AND payload->>'surface'=%s AND payload->>'provider'=%s",
                (self.owner_id, surface, provider),
            ).fetchall()
        return [AgentChatSession(**row[0]) for row in rows]

    def reseat_session(self, session_id: str, *, provider: str, model: str) -> None:
        with self._connect() as connection:
            payload = self._read(connection, session_id, lock=True)
            if payload is not None:
                payload.update(provider=provider, model=model, vendor_session="")
                self._write(connection, session_id, payload)
