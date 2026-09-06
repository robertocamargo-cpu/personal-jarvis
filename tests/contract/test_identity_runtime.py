"""Explicit identity migration preserves legacy installs and device settings."""

from dataclasses import replace
from types import SimpleNamespace

from jarvis.brain.assistant_name import resolve_assistant_name
from jarvis.core.identity import IdentityService
from jarvis.core.identity_repository import SQLiteIdentityRepository
from jarvis.core.identity_runtime import (
    LOCAL_OWNER,
    identity_path,
    migrate_local_identity,
    migrated_identity,
)


def config_for(path):
    return SimpleNamespace(
        memory=SimpleNamespace(data_dir=str(path)),
        trigger=SimpleNamespace(wake_word=SimpleNamespace(phrase="Hey Athena")),
        tts=SimpleNamespace(voice="existing-voice"),
    )


def test_explicit_migration_preserves_wake_and_voice_and_survives_reopen(tmp_path):
    config = config_for(tmp_path)
    assert resolve_assistant_name(config) == "Athena"
    assert not identity_path(config).exists()
    saved = migrate_local_identity(config)
    assert saved.display_name == "Jarvis"
    assert saved.wake_word == "Hey Athena"
    assert config.trigger.wake_word.phrase == "Hey Athena"
    assert config.tts.voice == "existing-voice"
    assert resolve_assistant_name(config_for(tmp_path)) == "Jarvis"
    assert migrate_local_identity(config) == saved


def test_next_resolution_observes_persisted_change_without_restart(tmp_path):
    config = config_for(tmp_path)
    saved = migrate_local_identity(config)
    service = IdentityService(SQLiteIdentityRepository(identity_path(config)), LOCAL_OWNER)
    renamed = service.update_identity(replace(saved, display_name="Test Name"), expected_revision=1)
    assert resolve_assistant_name(config) == "Test Name"
    service.update_identity(replace(renamed, display_name="Jarvis"), expected_revision=2)
    assert resolve_assistant_name(config) == "Jarvis"


def test_corrupt_identity_degrades_without_overwriting_the_file(tmp_path):
    config = config_for(tmp_path)
    path = identity_path(config)
    path.write_bytes(b"invalid database")
    assert migrated_identity(config) is None
    assert resolve_assistant_name(config) == "Athena"
    assert path.read_bytes() == b"invalid database"
