"""Unit tests for CloudApprovalBridge."""

from __future__ import annotations

import asyncio
import time
from uuid import uuid4

import pytest

from jarvis.cloud.approval_bridge import CloudApprovalBridge
from jarvis.core.bus import EventBus
from jarvis.core.events import (
    ActionApprovalRequired,
    ActionApproved,
    ActionDenied,
)


@pytest.mark.asyncio
async def test_cloud_approval_bridge_approved(monkeypatch) -> None:
    bus = EventBus()
    published_to_cloud: list[dict] = []
    polled: list[str] = []

    # Mock pairing status
    monkeypatch.setattr(
        "jarvis.cloud.approval_bridge.get_pairing_status",
        lambda: {"owner_id": "test-owner", "device_token": "test-tok"},
    )

    def fake_publish(**kwargs):
        published_to_cloud.append(kwargs)
        return {"success": True}

    def fake_poll(trace_id: str):
        polled.append(trace_id)
        # Return approved on first poll
        return {
            "success": True,
            "approval": {
                "trace_id": trace_id,
                "status": "approved",
                "decision_by": "user@example.com",
            },
        }

    monkeypatch.setattr("jarvis.cloud.approval_bridge.publish_approval", fake_publish)
    monkeypatch.setattr("jarvis.cloud.approval_bridge.poll_approval", fake_poll)

    approved_events: list[ActionApproved] = []
    bus.subscribe(ActionApproved, lambda ev: approved_events.append(ev))

    bridge = CloudApprovalBridge(bus, poll_interval_s=0.01)
    try:
        tid = uuid4()
        now_ns = time.time_ns()
        event = ActionApprovalRequired(
            trace_id=tid,
            tool_name="bash",
            risk_tier="ask",
            reason="Sensitive command",
            args_preview='{"cmd": "uptime"}',
            expires_at_ns=now_ns + 10_000_000_000,
        )

        await bus.publish(event)
        # Yield to let tasks run
        for _ in range(10):
            if approved_events:
                break
            await asyncio.sleep(0.02)

        assert len(published_to_cloud) == 1
        assert published_to_cloud[0]["trace_id"] == str(tid)
        assert published_to_cloud[0]["tool_name"] == "bash"

        assert len(approved_events) == 1
        assert approved_events[0].trace_id == tid
        assert approved_events[0].approved_by == "cloud:user@example.com"
    finally:
        bridge.close()


@pytest.mark.asyncio
async def test_cloud_approval_bridge_denied(monkeypatch) -> None:
    bus = EventBus()

    monkeypatch.setattr(
        "jarvis.cloud.approval_bridge.get_pairing_status",
        lambda: {"owner_id": "test-owner", "device_token": "test-tok"},
    )
    monkeypatch.setattr("jarvis.cloud.approval_bridge.publish_approval", lambda **kw: {})
    monkeypatch.setattr(
        "jarvis.cloud.approval_bridge.poll_approval",
        lambda tid: {
            "approval": {
                "trace_id": tid,
                "status": "denied",
                "decision_reason": "Rejected by user",
            }
        },
    )

    denied_events: list[ActionDenied] = []
    bus.subscribe(ActionDenied, lambda ev: denied_events.append(ev))

    bridge = CloudApprovalBridge(bus, poll_interval_s=0.01)
    try:
        tid = uuid4()
        event = ActionApprovalRequired(
            trace_id=tid,
            tool_name="gmail",
            risk_tier="ask",
            reason="Send email",
            args_preview="{}",
            expires_at_ns=time.time_ns() + 10_000_000_000,
        )

        await bus.publish(event)
        for _ in range(10):
            if denied_events:
                break
            await asyncio.sleep(0.02)

        assert len(denied_events) == 1
        assert denied_events[0].trace_id == tid
        assert denied_events[0].reason == "Rejected by user"
    finally:
        bridge.close()


@pytest.mark.asyncio
async def test_cloud_approval_bridge_unpaired_noop(monkeypatch) -> None:
    bus = EventBus()
    published = []

    monkeypatch.setattr("jarvis.cloud.approval_bridge.get_pairing_status", lambda: None)
    monkeypatch.setattr(
        "jarvis.cloud.approval_bridge.publish_approval",
        lambda **kw: published.append(kw),
    )

    bridge = CloudApprovalBridge(bus, poll_interval_s=0.01)
    try:
        tid = uuid4()
        event = ActionApprovalRequired(
            trace_id=tid,
            tool_name="bash",
            risk_tier="ask",
            reason="Test",
            expires_at_ns=time.time_ns() + 10_000_000_000,
        )

        await bus.publish(event)
        await asyncio.sleep(0.05)
        assert len(published) == 0
    finally:
        bridge.close()
