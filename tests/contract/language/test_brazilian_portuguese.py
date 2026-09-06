"""Brazilian Portuguese contract across the shared language consumers."""

from jarvis.brain.manager import SUPPORTED_REPLY_LANGUAGES, BrainManager
from jarvis.commands.registry import REPLY_LANGUAGES
from jarvis.core.turn_language import (
    detect_text_language,
    normalize_language_tag,
    resolve_output_language,
    validate_output_language,
)


def test_language_contract_is_platform_independent():
    # This shared resolver has no native or audio API dependency.
    assert normalize_language_tag("pt-BR") == "pt"
    assert resolve_output_language("pt", "en", "What is the weather?") == "pt"
    assert resolve_output_language("pt-BR", "en", "Hello") == "pt"
    assert detect_text_language("Você pode me ajudar a organizar meu dia? Obrigado.") == "pt"
    assert detect_text_language("Quiero que me ayudes con las tareas de hoy") == "es"
    assert (
        validate_output_language(
            "Você pode organizar seu dia com uma lista de tarefas.", resolved_language="pt"
        ).should_block
        is False
    )
    assert (
        validate_output_language(
            "He anotado la palabra y puedo ayudarte con las tareas de hoy.", resolved_language="pt"
        ).should_block
        is True
    )


def test_manager_pin_and_command_catalog_agree():
    assert REPLY_LANGUAGES == SUPPORTED_REPLY_LANGUAGES
    assert "pt" in SUPPORTED_REPLY_LANGUAGES
    manager = BrainManager.__new__(BrainManager)
    manager.set_reply_language("pt")
    assert "Brazilian Portuguese" in manager._reply_language_directive()


def test_voice_consumers_keep_brazilian_locale():
    from types import SimpleNamespace

    from jarvis.browser_voice.route import _resolve_language
    from jarvis.realtime.session import _LANGUAGE_NAMES
    from jarvis.speech.pipeline import SpeechPipeline
    from jarvis.ui.web.provider_routes import _REALTIME_PREVIEW_LANG_CODES

    assert _LANGUAGE_NAMES["pt"] == "Brazilian Portuguese"
    assert SpeechPipeline._bcp47("pt") == "pt-BR"
    for pin in ("pt", "pt-BR"):
        config = SimpleNamespace(brain=SimpleNamespace(reply_language=pin))
        assert _resolve_language(config) == "pt-BR"
    assert _REALTIME_PREVIEW_LANG_CODES["pt"] == "pt-BR"


def test_browser_voice_error_does_not_switch_to_german():
    from jarvis.brain.output_filter import scrub_for_voice
    from jarvis.browser_voice.session import BrowserVoiceSession

    session = BrowserVoiceSession.__new__(BrowserVoiceSession)
    session.language_code = "pt-BR"
    assert session._lang_short() == "pt"
    result = scrub_for_voice("Traceback (most recent call last):", language=session._lang_short())
    assert result.fallback_used
    assert result.cleaned == "Ocorreu um erro."
