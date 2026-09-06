"""Consistent read-only chat snapshots and resumable explicit migration.

Only storage is touched. Migration never starts a runner, invokes a provider,
replays an approval or resumes an execution recorded in a conversation.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import closing
from dataclasses import asdict, dataclass, fields
from pathlib import Path
from typing import Any

from jarvis.agent_chat.store import DEFAULT_SURFACE, AgentChatSession
from jarvis.core.protocols import ChatSnapshotDestination


@dataclass(frozen=True)
class ChatSnapshot:
    session: AgentChatSession
    events: list[dict[str, Any]]

    def digest(self) -> str:
        """Compare exact session metadata and ordered events without logging text."""
        serialized = json.dumps(
            {"session": asdict(self.session), "events": self.events},
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
        return hashlib.sha256(serialized).hexdigest()


class ChatMigrationConflict(ValueError):
    """Destination contains different data and must not be overwritten."""


def read_chat_snapshots(source: Path) -> list[ChatSnapshot]:
    """Read every session/event from one SQLite transaction, including its WAL.

    Does not initialize a schema, change a PRAGMA or copy a possibly torn raw
    database file. Missing, malformed and orphaned data are explicit failures.
    """
    uri = source.resolve().as_uri() + "?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("BEGIN")
        orphans = connection.execute(
            "SELECT COUNT(*) FROM agent_chat_events AS e LEFT JOIN agent_chat_sessions AS s "
            "ON e.session_id=s.session_id WHERE s.session_id IS NULL"
        ).fetchone()[0]
        if orphans:
            raise ValueError("Source has orphaned chat events; repair before migration")
        sessions = connection.execute(
            "SELECT * FROM agent_chat_sessions ORDER BY session_id"
        ).fetchall()
        snapshots = []
        names = {field.name for field in fields(AgentChatSession)}
        for row in sessions:
            values = dict(row)
            values.setdefault("surface", DEFAULT_SURFACE)
            session = AgentChatSession(**{key: values[key] for key in names})
            event_rows = connection.execute(
                "SELECT seq,ts_ms,kind,payload FROM agent_chat_events "
                "WHERE session_id=? ORDER BY seq",
                (session.session_id,),
            ).fetchall()
            events = [
                {
                    "seq": int(event["seq"]),
                    "ts_ms": int(event["ts_ms"]),
                    "kind": event["kind"],
                    "payload": json.loads(event["payload"]),
                }
                for event in event_rows
            ]
            snapshot = ChatSnapshot(session, events)
            snapshot.digest()  # Reject non-JSON numeric values before returning a snapshot.
            snapshots.append(snapshot)
        connection.rollback()  # End the read snapshot without any source writes.
    return snapshots


def migrate_chat_snapshots(
    snapshots: list[ChatSnapshot],
    destination: ChatSnapshotDestination,
    *,
    apply: bool = False,
) -> dict[str, int | bool]:
    """Default to dry-run; apply only explicitly to an owner-bound destination.

    All existing records are checked before the first write. Each new session
    imports atomically; after a network failure a repeated invocation skips
    identical records. Differing records always block, never overwrite.
    """
    pending = []
    existing_count = 0
    seen: set[str] = set()
    for snapshot in snapshots:
        sid = snapshot.session.session_id
        if sid in seen:
            raise ValueError("Duplicate source session ID")
        seen.add(sid)
        existing = destination.get_session(sid)
        if existing is not None:
            existing_snapshot = ChatSnapshot(existing, destination.list_events(sid))
            if existing_snapshot.digest() != snapshot.digest():
                raise ChatMigrationConflict(
                    "Destination conversation differs; no overwrite allowed"
                )
            existing_count += 1
        else:
            pending.append(snapshot)
    imported = 0
    if apply:
        for snapshot in pending:
            sid = snapshot.session.session_id
            destination.import_session(snapshot.session, snapshot.events)
            saved = destination.get_session(sid)
            if saved is None:
                raise RuntimeError("Imported conversation is missing")
            if ChatSnapshot(saved, destination.list_events(sid)).digest() != snapshot.digest():
                raise RuntimeError("Imported conversation failed integrity verification")
            imported += 1
    return {
        "dry_run": not apply,
        "sessions": len(snapshots),
        "events": sum(len(snapshot.events) for snapshot in snapshots),
        "already_present": existing_count,
        "pending": len(pending) - imported,
        "imported": imported,
    }
