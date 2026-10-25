"""Comando dev - Fluxos de desenvolvimento locais"""

import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.utils.run import run_command
from wallethub.utils.platform import npm_command
from wallethub.config import CI_COMPOSE_RELATIVE

app = Typer(name="dev", help="Fluxos de desenvolvimento locais")


@app.command()
def up(ctx: typer.Context) -> None:
    """Sobe serviços auxiliares (Postgres, Redis) via Docker"""
    menu_ctx: MenuContext = ctx.obj
    
    compose_file = menu_ctx.resolve_project_path(*CI_COMPOSE_RELATIVE.parts)
    if not compose_file.exists():
        raise typer.BadParameter("Arquivo docker-compose.ci.yml não encontrado.")
    
    run_command(
        [
            "docker",
            "compose",
            "-f",
            str(CI_COMPOSE_RELATIVE),
            "up",
            "-d",
            "postgres",
            "redis",
        ],
        cwd=menu_ctx.project_root,
        check=True,
    )


@app.command()
def down(ctx: typer.Context) -> None:
    """Derruba serviços auxiliares e remove volumes efêmeros"""
    menu_ctx: MenuContext = ctx.obj
    
    run_command(
        ["docker", "compose", "-f", str(CI_COMPOSE_RELATIVE), "down", "--remove-orphans"],
        cwd=menu_ctx.project_root,
        check=True,
    )


@app.command()
def api(ctx: typer.Context) -> None:
    """Inicia API NestJS em modo watch (necessita dependências instaladas)"""
    menu_ctx: MenuContext = ctx.obj
    
    run_command(
        [npm_command(), "run", "start:dev"],
        cwd=menu_ctx.api_dir,
        check=True,
    )


@app.command()
def web(ctx: typer.Context) -> None:
    """Inicia frontend Vite em modo dev"""
    menu_ctx: MenuContext = ctx.obj
    
    run_command(
        [npm_command(), "run", "dev"],
        cwd=menu_ctx.web_dir,
        check=True,
    )




