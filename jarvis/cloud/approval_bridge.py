"""Bridge between local EventBus action approvals and Jarvis Cloud."""

from __future__ import annotations

import asyncio
import time
from uuid import UUID

from loguru import logger

from jarvis.core.bus import EventBus
from jarvis.core.cloud_client import get_pairing_status, poll_approval, publish_approval
from jarvis.core.events import (
    ActionApprovalRequired,
    ActionApproved,
    ActionDenied,
    ActionExecuted,
)


class CloudApprovalBridge:
    """Publishes pending tool approvals to the cloud and monitors for user decisions."""

    def __init__(self, bus: EventBus, *, poll_interval_s: float = 1.5) -> None:
        self._bus = bus
        self._poll_interval_s = poll_interval_s
        self._tasks: dict[UUID, asyncio.Task[None]] = {}
        self._closed = False

        bus.subscribe(ActionApprovalRequired, self._on_approval_required)
        bus.subscribe(ActionApproved, self._on_resolved)
        bus.subscribe(ActionDenied, self._on_resolved)
        bus.subscribe(ActionExecuted, self._on_resolved)

    async def _on_approval_required(self, event: ActionApprovalRequired) -> None:
        """Publish approval request to cloud if device is paired."""
        if self._closed:
            return

        pair_state = get_pairing_status()
        if not pair_state:
            return

        now_ns = time.time_ns()
        if event.expires_at_ns <= now_ns:
            return

        tid = event.trace_id
        try:
            await asyncio.to_thread(
                publish_approval,
                trace_id=str(tid),
                tool_name=event.tool_name,
                risk_tier=event.risk_tier,
                reason=event.reason,
                args_preview=event.args_preview,
                expires_at_ns=event.expires_at_ns,
            )
        except Exception as exc:
            logger.debug(f"CloudApprovalBridge: failed to publish approval to cloud: {exc}")
            return

        # Start poll task
        task = asyncio.create_task(self._poll_decision(tid, event.tool_name, event.expires_at_ns))
        self._tasks[tid] = task

    async def _poll_decision(self, trace_id: UUID, tool_name: str, expires_at_ns: int) -> None:
        """Poll cloud for decision until resolved or expired."""
        try:
            while time.time_ns() < expires_at_ns:
                await asyncio.sleep(self._poll_interval_s)
                try:
                    res = await asyncio.to_thread(poll_approval, str(trace_id))
                    approval_data = res.get("approval") or {}
                    status = approval_data.get("status")

                    if status == "approved":
                        decision_by = approval_data.get("decision_by") or "cloud_user"
                        logger.info(
                            f"CloudApprovalBridge: action {trace_id} ({tool_name}) "
                            f"approved via cloud by {decision_by}"
                        )
                        await self._bus.publish(
                            ActionApproved(
                                trace_id=trace_id,
                                tool_name=tool_name,
                                approved_by=f"cloud:{decision_by}",
                            )
                        )
                        break

                    if status == "denied":
                        reason = approval_data.get("decision_reason") or "cloud_denied"
                        logger.info(
                            f"CloudApprovalBridge: action {trace_id} ({tool_name}) "
                            f"denied via cloud: {reason}"
                        )
                        await self._bus.publish(
                            ActionDenied(
                                trace_id=trace_id,
                                tool_name=tool_name,
                                reason=reason,
                            )
                        )
                        break

                    if status == "expired":
                        break
                except Exception as exc:
                    logger.debug(f"CloudApprovalBridge: error during poll for {trace_id}: {exc}")
        except asyncio.CancelledError:
            pass
        finally:
            self._tasks.pop(trace_id, None)

    async def _on_resolved(self, event: ActionApproved | ActionDenied | ActionExecuted) -> None:
        """Cancel cloud poll if action was resolved (e.g. locally on desktop)."""
        task = self._tasks.pop(event.trace_id, None)
        if task and not task.done():
            task.cancel()

    def close(self) -> None:
        """Shut down all pending polling tasks."""
        self._closed = True
        for task in self._tasks.values():
            if not task.done():
                task.cancel()
        self._tasks.clear()
