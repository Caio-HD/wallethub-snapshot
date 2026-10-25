"""Comando release - Geração de imagens Docker"""

import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.utils.run import run_command
from wallethub.config import CI_COMPOSE_RELATIVE

app = Typer(name="release", help="Gera imagens de release usando o profile Docker configurado")


@app.command()
def release(ctx: typer.Context) -> None:
    """Gera imagens de release usando o profile Docker configurado"""
    menu_ctx: MenuContext = ctx.obj
    
    compose_file = menu_ctx.resolve_project_path(*CI_COMPOSE_RELATIVE.parts)
    if not compose_file.exists():
        raise typer.BadParameter("Arquivo docker-compose.ci.yml não encontrado.")
    
    run_command(
        ["docker", "compose", "-f", str(CI_COMPOSE_RELATIVE), "--profile", "release", "build"],
        cwd=menu_ctx.project_root,
        check=True,
    )
    
    print("\n✅ Imagens de release construídas. Use `docker images` para inspecionar.")




