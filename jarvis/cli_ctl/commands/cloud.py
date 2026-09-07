"""cloud: manage pairing and cloud connectivity with Personal Jarvis Cloud."""
from __future__ import annotations

import typer

from jarvis.cli_ctl import render
from jarvis.core import cloud_client

app = typer.Typer(no_args_is_help=True, help="Manage cloud pairing and connectivity.")


@app.command()
def pair(
    code: str = typer.Argument(..., help="Single-use pairing code generated in the cloud (e.g. JRV-XXXX-XXXX)."),
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
        render.success(f"Successfully paired with cloud account {result['owner_id']}.")
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
        render.success("Pairing credentials removed. Device is now unpaired.")
    else:
        typer.echo("Device was not paired.")
