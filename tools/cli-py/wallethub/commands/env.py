"""Comando env - Sincroniza variáveis de ambiente a partir de config/"""

import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.utils.environment import sync_env_derived_files

app = Typer(
    name="env",
    help=(
        "Sincroniza config/envs/*.json e ops/prod/.env.deploy a partir de config/.env.local e config/.env.production. "
        "Edite apenas os .env em config/; db, workflow e deploy já sincronizam automaticamente ao rodar."
    ),
    invoke_without_command=True,
)


@app.callback()
def env_callback(
    ctx: typer.Context,
    env: str = typer.Option(
        "all",
        "-e",
        "--env",
        help="Ambiente a sincronizar: personal, production ou all",
    ),
) -> None:
    """Sincroniza arquivos derivados a partir dos .env unificados em config/."""
    if ctx.invoked_subcommand is not None:
        return

    menu_ctx: MenuContext = ctx.obj
    env_lower = env.lower()

    if env_lower == "all":
        targets = ["personal", "production"]
    elif env_lower in ("personal", "production"):
        targets = [env_lower]
    else:
        raise typer.BadParameter(
            f"Ambiente '{env}' inválido. Use: personal, production ou all."
        )

    for target in targets:
        try:
            sync_env_derived_files(menu_ctx, target)
            print(f"✅ Ambiente '{target}' sincronizado.")
        except FileNotFoundError as e:
            print(f"⚠️  {e}")
            raise typer.Exit(1) from e
