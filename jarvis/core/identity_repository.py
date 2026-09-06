"""Local, transactional storage for the opt-in assistant identity foundation."""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any


class SQLiteIdentityRepository:
    """One connection per operation; SQLite arbitrates concurrent processes.

    Construction is explicit and never runs on the boot critical path. The
    additive table is namespaced/versioned so existing application tables survive.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        with closing(sqlite3.connect(self.path)) as connection, connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS assistant_identity_v1 "
                "(user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)"
            )

    def load(self, user_id: str) -> dict[str, Any] | None:
        with closing(sqlite3.connect(self.path)) as connection, connection:
            row = connection.execute(
                "SELECT payload FROM assistant_identity_v1 WHERE user_id = ?",
                (user_id,),
            ).fetchone()
        return json.loads(row[0]) if row else None

    def compare_and_swap(
        self,
        user_id: str,
        expected_revision: int,
        payload: dict[str, Any],
    ) -> bool:
        if payload.get("user_id") != user_id or payload.get("revision") != expected_revision + 1:
            raise ValueError("Identity owner or revision mismatch")
        serialized = json.dumps(payload, ensure_ascii=False)
        with closing(sqlite3.connect(self.path)) as connection, connection:
            if expected_revision == 0:
                cursor = connection.execute(
                    "INSERT INTO assistant_identity_v1 (user_id, revision, payload) "
                    "VALUES (?, 1, ?) ON CONFLICT(user_id) DO NOTHING",
                    (user_id, serialized),
                )
            else:
                cursor = connection.execute(
                    "UPDATE assistant_identity_v1 SET revision = ?, payload = ? "
                    "WHERE user_id = ? AND revision = ?",
                    (expected_revision + 1, serialized, user_id, expected_revision),
                )
            return cursor.rowcount == 1
