"""Assistant identity foundation, independent of wake engines and credentials.

This is an opt-in domain service. Importing it does not migrate an installation
or rename an existing assistant. Channel names are display data, not prompts.
"""

from __future__ import annotations

import unicodedata
from collections.abc import Mapping
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from jarvis.core.protocols import IdentityRepository

CHANNELS = frozenset({"voice", "phone", "whatsapp", "pwa", "discord", "telegram", "email"})


def _display_text(value: str, label: str, limit: int = 80) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{label} must be nonempty text without surrounding whitespace")
    if len(value) > limit or any(unicodedata.category(c).startswith("C") for c in value):
        raise ValueError(f"{label} contains control characters or exceeds {limit} characters")


@dataclass(frozen=True, slots=True)
class AssistantIdentity:
    """Versioned assistant display identity owned by one authenticated user."""

    id: str
    user_id: str
    name: str = "Jarvis"
    display_name: str = "Jarvis"
    short_name: str = "Jarvis"
    wake_word: str = "Jarvis"
    channel_names: tuple[tuple[str, str], ...] = ()
    greeting: str = ""
    language: str = "pt-BR"
    timezone: str = "America/Sao_Paulo"
    revision: int = 0
    created_at: str = ""
    updated_at: str = ""

    def __post_init__(self) -> None:
        for field in ("id", "user_id", "name", "display_name", "short_name", "language"):
            _display_text(getattr(self, field), field)
        if self.wake_word:
            _display_text(self.wake_word, "wake_word")
        if self.greeting:
            _display_text(self.greeting, "greeting", 500)
        ZoneInfo(self.timezone)
        if type(self.revision) is not int or self.revision < 0:
            raise ValueError("revision must be a nonnegative integer")
        names = tuple(tuple(pair) for pair in self.channel_names)
        seen: set[str] = set()
        for channel, name in names:
            if channel not in CHANNELS or channel in seen:
                raise ValueError("Unknown or duplicate identity channel")
            _display_text(name, "channel name")
            seen.add(channel)
        object.__setattr__(self, "channel_names", names)


class IdentityConflictError(ValueError):
    """The caller tried to overwrite a newer identity revision."""


class IdentityService:
    """Resolve display identity without changing tools, providers or wake state.

    The caller supplies an authenticated owner, never an incoming channel sender
    name. No cache is maintained: a second process's committed update is visible
    on the next read. Environment defaults are explicit injectable input.
    """

    def __init__(
        self,
        repository: IdentityRepository,
        user_id: str,
        *,
        environment: Mapping[str, str] | None = None,
    ) -> None:
        _display_text(user_id, "user_id")
        self.repository = repository
        self.user_id = user_id
        self.environment = dict(environment or {})

    def get_identity(self) -> AssistantIdentity:
        payload = self.repository.load(self.user_id)
        if payload is not None:
            identity = AssistantIdentity(**payload)
            if identity.user_id != self.user_id:
                raise PermissionError("Identity owner mismatch")
            return identity
        name = self.environment.get("JARVIS_ASSISTANT_NAME", "Jarvis")
        return AssistantIdentity(
            id=self.user_id,
            user_id=self.user_id,
            name=name,
            display_name=name,
            short_name=name,
        )

    def get_name(self) -> str:
        return self.get_identity().name

    def get_display_name(self) -> str:
        return self.get_identity().display_name

    def get_wake_word(self) -> str:
        """Return a preference, not evidence of an installed wake model."""
        return self.get_identity().wake_word

    def get_channel_name(self, channel: str) -> str:
        if channel not in CHANNELS:
            raise ValueError("Unknown identity channel")
        identity = self.get_identity()
        return dict(identity.channel_names).get(channel, identity.display_name)

    def get_greeting(self, channel: str) -> str:
        if channel not in CHANNELS:
            raise ValueError("Unknown identity channel")
        return self.get_identity().greeting

    def update_identity(
        self,
        identity: AssistantIdentity,
        *,
        expected_revision: int,
    ) -> AssistantIdentity:
        if identity.user_id != self.user_id:
            raise PermissionError("Identity owner mismatch")
        current = self.get_identity()
        if identity.id != current.id:
            raise ValueError("Identity ID is immutable")
        if expected_revision != current.revision:
            raise IdentityConflictError("Identity changed; reload before saving")
        now = datetime.now(UTC).isoformat()
        saved = replace(
            identity,
            revision=expected_revision + 1,
            created_at=current.created_at or now,
            updated_at=now,
        )
        if not self.repository.compare_and_swap(self.user_id, expected_revision, asdict(saved)):
            raise IdentityConflictError("Identity changed; reload before saving")
        return saved
