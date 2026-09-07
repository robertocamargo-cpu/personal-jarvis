"""Unit tests for CloudChatBridge."""

from __future__ import annotations

import asyncio

import pytest

from jarvis.cloud.chat_bridge import CloudChatBridge


@pytest.mark.asyncio
async def test_cloud_chat_bridge_process(monkeypatch) -> None:
    polled = [{"request_id": "req-1", "user_text": "status do mac"}]
    replies = []

    monkeypatch.setattr(
        "jarvis.cloud.chat_bridge.get_pairing_status",
        lambda: {"owner_id": "test-owner", "device_token": "test-tok"},
    )
    monkeypatch.setattr("jarvis.cloud.chat_bridge.poll_mac_messages", lambda: polled)

    def fake_reply(request_id, assistant_text, status="complete", error=None):
        replies.append({"request_id": request_id, "text": assistant_text, "status": status})
        return True

    monkeypatch.setattr("jarvis.cloud.chat_bridge.reply_mac_message", fake_reply)

    bridge = CloudChatBridge(poll_interval_s=0.01)
    bridge.start()
    try:
        for _ in range(20):
            if replies:
                break
            await asyncio.sleep(0.02)

        assert len(replies) >= 1
        assert replies[0]["request_id"] == "req-1"
        assert replies[0]["status"] == "complete"
        assert "Jarvis Mac" in replies[0]["text"]
    finally:
        bridge.stop()
