"""cloud: manage pairing and cloud connectivity with Personal Jarvis Cloud."""

from __future__ import annotations

import typer

from jarvis.cli_ctl import render
from jarvis.core import cloud_client

app = typer.Typer(no_args_is_help=True, help="Manage cloud pairing and connectivity.")


@app.command()
def pair(
    code: str = typer.Argument(
        ..., help="Single-use pairing code generated in the cloud (e.g. JRV-XXXX-XXXX)."
    ),
    url: str = typer.Option(
        cloud_client.DEFAULT_CLOUD_URL,
        "--url",
        help="Base URL of the cloud deployment.",
    ),
) -> None:
    """Pair this local Jarvis Desktop with your Cloud account."""
    typer.echo(f"Connecting to {url} with pairing code {code.strip()}...")
    try:
        result = cloud_client.pair_device(code=code, cloud_url=url)
        render.line(
            f"[green]✓ Successfully paired with cloud account {result['owner_id']}.[/green]"
        )
        typer.echo(f"Device ID: {result['device_id']}")
        typer.echo(f"Device Name: {result['device_name']}")
        typer.echo(f"Paired At: {result['paired_at']}")
    except ValueError as exc:
        render.error(str(exc))
        raise typer.Exit(code=1) from exc
    except ConnectionError as exc:
        render.error(str(exc))
        raise typer.Exit(code=2) from exc
    except Exception as exc:
        render.error(f"Failed to pair device: {exc}")
        raise typer.Exit(code=1) from exc


@app.command()
def status() -> None:
    """Display current cloud pairing status and registered owner."""
    paired = cloud_client.get_pairing_status()
    if not paired:
        typer.echo("Status: Not paired.")
        typer.echo("To pair this machine, generate a code in the cloud dashboard and run:")
        typer.echo("  jarvis cloud pair <CODE>")
        return

    typer.echo("Status: PAIRED")
    typer.echo(f"Owner ID:    {paired.get('owner_id')}")
    typer.echo(f"Device ID:   {paired.get('device_id')}")
    typer.echo(f"Device Name: {paired.get('device_name')}")
    typer.echo(f"Cloud URL:   {paired.get('cloud_url')}")
    typer.echo(f"Paired At:   {paired.get('paired_at')}")


@app.command()
def unpair() -> None:
    """Disconnect and remove local pairing credentials."""
    if cloud_client.unpair_device():
        render.line("[green]✓ Pairing credentials removed. Device is now unpaired.[/green]")
    else:
        typer.echo("Device was not paired.")


@app.command()
def approvals(
    trace_id: str | None = typer.Argument(None, help="Trace ID of the action to check status for."),
) -> None:
    """Check status of remote approvals in the cloud."""
    paired = cloud_client.get_pairing_status()
    if not paired:
        render.error("Device is not paired with the cloud.")
        raise typer.Exit(code=1)

    if not trace_id:
        typer.echo(f"Cloud Approvals Web UI: {paired.get('cloud_url')}/aprovacoes")
        typer.echo("To inspect a specific action status, provide its trace ID:")
        typer.echo("  jarvis cloud approvals <TRACE_ID>")
        return

    try:
        res = cloud_client.poll_approval(trace_id)
        approval = res.get("approval", {})
        typer.echo(f"Trace ID:    {approval.get('trace_id')}")
        typer.echo(f"Tool Name:   {approval.get('tool_name')}")
        typer.echo(f"Status:      {approval.get('status')}")
        if approval.get("decision_by"):
            typer.echo(f"Decided By:  {approval.get('decision_by')}")
        if approval.get("decision_reason"):
            typer.echo(f"Reason:      {approval.get('decision_reason')}")
    except Exception as exc:
        render.error(f"Failed to fetch approval status: {exc}")
        raise typer.Exit(code=1) from exc


@app.command()
def bridge() -> None:
    """Run the cloud chat bridge worker to process messages sent from cloud mobile chat."""
    import asyncio

    from jarvis.cloud.chat_bridge import CloudChatBridge

    paired = cloud_client.get_pairing_status()
    if not paired:
        render.error("Device is not paired with the cloud.")
        raise typer.Exit(code=1)

    typer.echo("Starting Jarvis Cloud Chat Bridge...")
    typer.echo(f"Connected to {paired.get('cloud_url')} as {paired.get('device_name')}")
    typer.echo("Listening for messages sent to 'Jarvis Mac'... (Press Ctrl+C to stop)")

    async def _runner() -> None:
        bridge_worker = CloudChatBridge()
        bridge_worker.start()
        try:
            while True:
                await asyncio.sleep(1)
        finally:
            bridge_worker.stop()

    try:
        asyncio.run(_runner())
    except (KeyboardInterrupt, SystemExit):
        typer.echo("\nBridge stopped.")
