"""Optional PostgreSQL identity adapter using the existing repository contract.

No DSN or secret is read here. The application supplies a Psycopg connection
factory, permitting its secret resolver and pool policy to remain authoritative.
Importing this module does not require Psycopg or open a network connection.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any


class PostgresIdentityRepository:
    """Transactional owner-scoped identity; no implicit schema changes on boot.

    ``connect`` must return a fresh Psycopg 3 connection/context manager with
    autocommit disabled. Use a dedicated schema/role for the application.
    """

    def __init__(self, connect: Callable[[], Any]) -> None:
        self._connect = connect

    def initialize(self) -> None:
        """Apply the additive v1 schema explicitly, with a migration role."""
        with self._connect() as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS assistant_identity_v1 ("
                "user_id TEXT PRIMARY KEY, revision BIGINT NOT NULL CHECK (revision > 0), "
                "payload JSONB NOT NULL, "
                "CHECK (payload->>'user_id' = user_id), "
                "CHECK ((payload->>'revision')::bigint = revision))"
            )

    def load(self, user_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT payload FROM assistant_identity_v1 WHERE user_id = %s", (user_id,)
            ).fetchone()
        return row[0] if row else None

    def compare_and_swap(
        self,
        user_id: str,
        expected_revision: int,
        payload: dict[str, Any],
    ) -> bool:
        if payload.get("user_id") != user_id or payload.get("revision") != expected_revision + 1:
            raise ValueError("Identity owner or revision mismatch")
        serialized = json.dumps(payload, ensure_ascii=False)
        with self._connect() as connection:
            if expected_revision == 0:
                cursor = connection.execute(
                    "INSERT INTO assistant_identity_v1 (user_id, revision, payload) "
                    "VALUES (%s, 1, %s::jsonb) ON CONFLICT(user_id) DO NOTHING",
                    (user_id, serialized),
                )
            else:
                cursor = connection.execute(
                    "UPDATE assistant_identity_v1 SET revision = %s, payload = %s::jsonb "
                    "WHERE user_id = %s AND revision = %s",
                    (expected_revision + 1, serialized, user_id, expected_revision),
                )
            return cursor.rowcount == 1
