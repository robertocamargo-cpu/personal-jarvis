"""Real PostgreSQL contract; opt in with JARVIS_TEST_POSTGRES_DSN.

Each test creates and drops its own random schema, containing synthetic data
only. Never point this test at a production database or a production role.
"""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, replace
from uuid import uuid4

import pytest

from jarvis.core.identity import AssistantIdentity, IdentityConflictError, IdentityService
from jarvis.core.identity_postgres import PostgresIdentityRepository


@pytest.fixture
def postgres():
    dsn = os.environ.get("JARVIS_TEST_POSTGRES_DSN")
    if not dsn:
        pytest.skip("JARVIS_TEST_POSTGRES_DSN not set; real PostgreSQL required")
    psycopg = pytest.importorskip("psycopg")
    schema = "identity_test_" + uuid4().hex
    with psycopg.connect(dsn) as connection:
        connection.execute(
            psycopg.sql.SQL("CREATE SCHEMA {}").format(psycopg.sql.Identifier(schema))
        )

    def connect():
        return psycopg.connect(dsn, options=f"-c search_path={schema}", connect_timeout=5)

    repository = PostgresIdentityRepository(connect)
    try:
        repository.initialize()
        yield repository, connect, psycopg
    finally:
        with psycopg.connect(dsn) as connection:
            connection.execute(
                psycopg.sql.SQL("DROP SCHEMA {} CASCADE").format(psycopg.sql.Identifier(schema))
            )


def test_identity_persistence_reconnect_and_owner_isolation(postgres):
    repository, connect, _ = postgres
    service = IdentityService(repository, "owner")
    saved = service.update_identity(service.get_identity(), expected_revision=0)
    reopened = IdentityService(PostgresIdentityRepository(connect), "owner")
    assert reopened.get_identity() == saved
    assert IdentityService(repository, "other").get_identity().revision == 0
    with pytest.raises(PermissionError):
        IdentityService(repository, "other").update_identity(saved, expected_revision=0)
    changed = reopened.update_identity(
        replace(saved, display_name="Test Name", channel_names=(("telegram", "Channel Name"),)),
        expected_revision=1,
    )
    assert service.get_display_name() == "Test Name"
    assert service.get_channel_name("telegram") == "Channel Name"
    with pytest.raises(IdentityConflictError):
        service.update_identity(saved, expected_revision=1)
    service.update_identity(replace(changed, display_name="Jarvis"), expected_revision=2)
    assert reopened.get_name() == "Jarvis"


def test_competing_writers_are_atomic(postgres):
    repository, connect, _ = postgres
    payload = asdict(AssistantIdentity(id="owner", user_id="owner", revision=1))
    repositories = [repository, PostgresIdentityRepository(connect)]
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda repo: repo.compare_and_swap("owner", 0, payload),
                repositories,
            )
        )
    assert sorted(results) == [False, True]
    payload["revision"] = 2
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda repo: repo.compare_and_swap("owner", 1, payload),
                repositories,
            )
        )
    assert sorted(results) == [False, True]


def test_transaction_rollback_and_recovery(postgres):
    repository, connect, psycopg = postgres
    service = IdentityService(repository, "owner")
    saved = service.update_identity(service.get_identity(), expected_revision=0)
    with pytest.raises(psycopg.errors.CheckViolation):
        with connect() as connection:
            connection.execute("DELETE FROM assistant_identity_v1 WHERE user_id=%s", ("owner",))
            connection.execute(
                "INSERT INTO assistant_identity_v1 VALUES (%s, 0, '{}'::jsonb)",
                ("invalid",),
            )
    assert service.get_identity() == saved
    with connect() as connection:
        connection.execute("DELETE FROM assistant_identity_v1 WHERE user_id=%s", ("owner",))
    assert repository.load("owner") is None
