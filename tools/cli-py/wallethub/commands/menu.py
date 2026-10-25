"""Comando menu - Menu interativo"""

import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.menu.interactive import run_interactive_menu
from wallethub.analytics.dashboard import show_dashboard

app = Typer(name="menu", help="Inicia menu interativo com fluxos agrupados")


@app.command()
def menu(
    ctx: typer.Context,
    env: str = typer.Option("personal", "-e", "--env", help="Ambiente configurado"),
) -> None:
    """Inicia menu interativo com fluxos agrupados"""
    import sys
    
    menu_ctx: MenuContext = ctx.obj
    
    # Mostra dashboard primeiro
    show_dashboard(menu_ctx)
    
    # Garantir que o dashboard foi completamente renderizado antes de iniciar o menu
    # Isso evita sobreposição visual entre Rich e Questionary
    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except (AttributeError, OSError):
        pass
    
    # Executa menu interativo
    run_interactive_menu(menu_ctx, env)

