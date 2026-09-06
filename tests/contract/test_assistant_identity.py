"""Owner isolation, persistence and conflict contract for assistant identity."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, replace

import pytest

from jarvis.core.identity import AssistantIdentity, IdentityConflictError, IdentityService
from jarvis.core.identity_repository import SQLiteIdentityRepository


def test_default_and_persisted_identity_precedence(tmp_path):
    path = tmp_path / "identity.db"
    service = IdentityService(SQLiteIdentityRepository(path), "owner")
    assert service.get_name() == "Jarvis"
    assert service.get_identity().language == "pt-BR"
    assert service.get_channel_name("telegram") == "Jarvis"
    original = service.get_identity()
    saved = service.update_identity(
        replace(original, display_name="Test Name", channel_names=(("telegram", "Channel Name"),)),
        expected_revision=0,
    )
    reopened = IdentityService(
        SQLiteIdentityRepository(path),
        "owner",
        environment={"JARVIS_ASSISTANT_NAME": "Other"},
    )
    assert reopened.get_display_name() == "Test Name"
    assert reopened.get_channel_name("telegram") == "Channel Name"
    assert reopened.get_channel_name("voice") == "Test Name"
    assert reopened.get_wake_word() == original.wake_word
    restored = reopened.update_identity(replace(saved, display_name="Jarvis"), expected_revision=1)
    assert restored.revision == 2
    assert restored.created_at == saved.created_at
    assert service.get_display_name() == "Jarvis"  # No stale cross-instance cache.


def test_owner_isolation_and_stale_update(tmp_path):
    repository = SQLiteIdentityRepository(tmp_path / "identity.db")
    alice = IdentityService(repository, "alice")
    bob = IdentityService(repository, "bob")
    stale = alice.get_identity()
    alice.update_identity(stale, expected_revision=0)
    with pytest.raises(IdentityConflictError):
        alice.update_identity(stale, expected_revision=0)
    with pytest.raises(PermissionError):
        bob.update_identity(stale, expected_revision=0)
    assert bob.get_identity().revision == 0
    assert alice.get_identity().revision == 1


def test_atomic_competing_writers(tmp_path):
    path = tmp_path / "identity.db"
    repositories = [SQLiteIdentityRepository(path), SQLiteIdentityRepository(path)]
    payload = asdict(AssistantIdentity(id="owner", user_id="owner", revision=1))
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(lambda repo: repo.compare_and_swap("owner", 0, payload), repositories)
        )
    assert sorted(results) == [False, True]
    assert repositories[0].load("owner")["revision"] == 1


@pytest.mark.parametrize("name", ["", " padded ", "line\nbreak", "hidden\u202ename", "a" * 81])
def test_invalid_names_are_rejected(name):
    with pytest.raises(ValueError):
        AssistantIdentity(id="owner", user_id="owner", display_name=name)


def test_channel_validation_and_environment_fallback(tmp_path):
    service = IdentityService(
        SQLiteIdentityRepository(tmp_path / "identity.db"),
        "owner",
        environment={"JARVIS_ASSISTANT_NAME": "Environment Name"},
    )
    assert service.get_name() == "Environment Name"
    with pytest.raises(ValueError):
        service.get_channel_name("shell")
    with pytest.raises(ValueError):
        AssistantIdentity(id="owner", user_id="owner", channel_names=(("shell", "Name"),))


def test_repository_rejects_mismatched_owner_and_keeps_prior_data(tmp_path):
    repository = SQLiteIdentityRepository(tmp_path / "identity.db")
    service = IdentityService(repository, "owner")
    saved = service.update_identity(service.get_identity(), expected_revision=0)
    with pytest.raises(ValueError):
        repository.compare_and_swap("other", 1, asdict(replace(saved, revision=2)))
    assert service.get_identity() == saved
