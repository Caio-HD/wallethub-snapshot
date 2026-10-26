"""Comando workflow - Fluxos automatizados"""

import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.workflows.dev import workflow_dev_start, workflow_dev_stop, workflow_dev_reset
from wallethub.workflows.prod import workflow_prod_start, workflow_prod_stop
from wallethub.workflows.maintenance import workflow_deploy_publish

app = Typer(name="workflow", help="Fluxos automatizados de desenvolvimento e publicação")


@app.command("dev:start")
def dev_start(
    ctx: typer.Context,
    env: str = typer.Option("personal", "-e", "--env", help="Ambiente configurado"),
    with_tests: bool = typer.Option(False, "--with-tests", help="Executa testes pós-stack"),
) -> None:
    """Limpa containers residuais, sobe stack local e executa diagnósticos"""
    menu_ctx: MenuContext = ctx.obj
    workflow_dev_start(menu_ctx, env, with_tests)


@app.command("dev:stop")
def dev_stop(
    ctx: typer.Context,
    env: str = typer.Option("personal", "-e", "--env", help="Ambiente configurado"),
) -> None:
    """Derruba stack local mantendo volumes"""
    menu_ctx: MenuContext = ctx.obj
    workflow_dev_stop(menu_ctx, env, remove_volumes=False)


@app.command("dev:reset")
def dev_reset(
    ctx: typer.Context,
    env: str = typer.Option("personal", "-e", "--env", help="Ambiente configurado"),
) -> None:
    """Derruba stack local removendo volumes"""
    menu_ctx: MenuContext = ctx.obj
    workflow_dev_reset(menu_ctx, env)


@app.command("deploy:publish")
def deploy_publish(
    ctx: typer.Context,
    env_file: str = typer.Option(None, "-f", "--env-file", help="Arquivo .env.deploy alternativo"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Simula etapa de deploy"),
) -> None:
    """Executa CI, gera imagens de release e aplica deploy"""
    menu_ctx: MenuContext = ctx.obj
    workflow_deploy_publish(menu_ctx, env_file, dry_run)


@app.command("prod:start")
def prod_start(
    ctx: typer.Context,
    env: str = typer.Option("production", "-e", "--env", help="Ambiente configurado"),
) -> None:
    """Executa workflow completo de produção"""
    menu_ctx: MenuContext = ctx.obj
    workflow_prod_start(menu_ctx, env)


@app.command("prod:stop")
def prod_stop(ctx: typer.Context) -> None:
    """Encerra ambiente de produção"""
    menu_ctx: MenuContext = ctx.obj
    workflow_prod_stop(menu_ctx)

