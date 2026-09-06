"""Explicit local identity migration and read-only compatibility resolution.

The local desktop/headless installation has one owner. Cloud deployments must
inject an authenticated owner instead of reusing this local installation ID.
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import replace
from pathlib import Path
from typing import Any

from jarvis.core.identity import AssistantIdentity, IdentityService
from jarvis.core.identity_repository import SQLiteIdentityRepository

log = logging.getLogger(__name__)
LOCAL_OWNER = "local-installation"
IDENTITY_FILENAME = "assistant_identity.db"


def identity_path(config: Any) -> Path | None:
    data_dir = getattr(getattr(config, "memory", None), "data_dir", None)
    return Path(data_dir) / IDENTITY_FILENAME if data_dir else None


def migrated_identity(config: Any) -> AssistantIdentity | None:
    """Read only an explicitly migrated record; never initialize on a read."""
    path = identity_path(config)
    if path is None or not path.is_file():
        return None
    try:
        payload = SQLiteIdentityRepository(path, initialize=False).load(LOCAL_OWNER)
        if payload is None:
            return None
        identity = AssistantIdentity(**payload)
        if identity.user_id != LOCAL_OWNER:
            raise ValueError("Local identity owner mismatch")
        return identity
    except (OSError, sqlite3.Error, ValueError, TypeError, KeyError) as exc:
        log.warning("Cannot read migrated identity; retaining legacy name: %s", type(exc).__name__)
        return None


def migrate_local_identity(config: Any) -> AssistantIdentity:
    """Explicitly install Jarvis identity, retaining the actual wake preference.

    Idempotent: an existing identity is returned without overwriting it. The
    configuration, voice choice, credentials and wake engine are never written.
    """
    path = identity_path(config)
    if path is None:
        raise ValueError("A configured data directory is required for identity migration")
    path.parent.mkdir(parents=True, exist_ok=True)
    service = IdentityService(SQLiteIdentityRepository(path), LOCAL_OWNER)
    current = service.get_identity()
    if current.revision:
        return current
    phrase = getattr(getattr(getattr(config, "trigger", None), "wake_word", None), "phrase", "")
    return service.update_identity(replace(current, wake_word=phrase or ""), expected_revision=0)
