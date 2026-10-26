"""Comando deploy - Gerenciamento de stack de produção.

No Windows, o script deploy-local.sh é executado via bash (WSL); os caminhos
são convertidos para formato WSL (/mnt/...). Recomenda-se executar deploy
de produção em Ubuntu (servidor) ou a partir do Windows via WSL.
"""

import os
from pathlib import Path
import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.utils.run import run_command
from wallethub.utils.platform import is_windows, to_wsl_path

app = Typer(name="deploy", help="Gerencia a stack Docker de deploy (ops/prod) via deploy-local.sh")


def run_deploy_script(
    menu_ctx: MenuContext,
    cmd: str,
    env_file: str = None,
    dry_run: bool = False,
) -> None:
    """Executa script deploy-local.sh. No Windows usa caminhos WSL e bash."""
    script_path = menu_ctx.resolve_deploy_script_path()
    env_path = env_file or os.environ.get("ENV_FILE") or str(menu_ctx.resolve_deploy_env_path())
    
    if not script_path.exists():
        raise typer.BadParameter(f"Script deploy-local.sh não encontrado: {script_path}")
    
    if not Path(env_path).exists():
        raise typer.BadParameter(f"Arquivo .env.deploy não encontrado: {env_path}")
    
    script_arg = to_wsl_path(str(script_path)) if is_windows() else str(script_path)
    env_arg = to_wsl_path(env_path) if is_windows() else env_path
    
    if dry_run:
        print("Dry-run ativado. Comando que seria executado:")
        if is_windows():
            print(f"bash -c 'ENV_FILE={env_arg} {script_arg} {cmd}'")
        else:
            print(f"ENV_FILE={env_arg} {script_arg} {cmd}")
        return
    
    if is_windows():
        escaped_script = script_arg.replace('"', '\\"')
        escaped_env = env_arg.replace('"', '\\"')
        command_args = ["-c", f'ENV_FILE="{escaped_env}" "{escaped_script}" {cmd}']
    else:
        command_args = [script_arg, cmd]
    
    command_env = {**os.environ, "ENV_FILE": env_arg}
    
    run_command(
        ["bash"] + command_args,
        cwd=menu_ctx.project_root,
        env=command_env,
        check=True,
    )


@app.command()
def up(
    ctx: typer.Context,
    env_file: str = typer.Option(None, "-f", "--env-file", help="Caminho alternativo para .env.deploy"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Apenas exibe o comando que seria executado"),
) -> None:
    """Sobe a stack de produção local via deploy-local.sh up"""
    menu_ctx: MenuContext = ctx.obj
    run_deploy_script(menu_ctx, "up", env_file, dry_run)


@app.command()
def down(
    ctx: typer.Context,
    env_file: str = typer.Option(None, "-f", "--env-file", help="Caminho alternativo para .env.deploy"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Apenas exibe o comando que seria executado"),
) -> None:
    """Derruba a stack mantendo volumes via deploy-local.sh down"""
    menu_ctx: MenuContext = ctx.obj
    run_deploy_script(menu_ctx, "down", env_file, dry_run)


@app.command()
def logs(
    ctx: typer.Context,
    env_file: str = typer.Option(None, "-f", "--env-file", help="Caminho alternativo para .env.deploy"),
) -> None:
    """Segue logs do Traefik, API e Web via deploy-local.sh logs"""
    menu_ctx: MenuContext = ctx.obj
    run_deploy_script(menu_ctx, "logs", env_file, False)


@app.command()
def ps(
    ctx: typer.Context,
    env_file: str = typer.Option(None, "-f", "--env-file", help="Caminho alternativo para .env.deploy"),
) -> None:
    """Exibe status dos containers via deploy-local.sh ps"""
    menu_ctx: MenuContext = ctx.obj
    run_deploy_script(menu_ctx, "ps", env_file, False)

