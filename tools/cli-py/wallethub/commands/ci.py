"""Comando ci - Pipeline CI/CD"""

import os
import shutil
import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.utils.run import run_command
from wallethub.utils.platform import is_windows, to_posix_path
from wallethub.config import CI_SCRIPT_RELATIVE

app = Typer(
    name="ci",
    help="Executa o pipeline completo (lint, testes, build) via Docker Compose",
    invoke_without_command=True,
)


@app.callback()
def ci(ctx: typer.Context) -> None:
    """Executa o pipeline completo (lint, testes, build) via Docker Compose.

    No Windows requer bash (WSL ou Git for Windows).
    """
    if ctx.invoked_subcommand is not None:
        return

    menu_ctx: MenuContext = ctx.obj

    if is_windows() and not shutil.which("bash"):
        raise typer.BadParameter(
            "No Windows, o comando 'ci' requer bash (WSL ou Git Bash). "
            "Instale WSL ou Git for Windows e tente novamente."
        )

    script_path = menu_ctx.resolve_project_path(*CI_SCRIPT_RELATIVE.parts)

    if not script_path.exists():
        raise typer.BadParameter("Script ops/ci/run-all.sh não encontrado.")

    # Torna script executável (Unix)
    if not is_windows():
        try:
            os.chmod(script_path, 0o755)
        except Exception:
            pass

    # Prepara argumentos do bash
    if is_windows():
        bash_args = ["-lc", to_posix_path(str(CI_SCRIPT_RELATIVE))]
    else:
        bash_args = [str(script_path)]

    run_command(
        ["bash"] + bash_args,
        cwd=menu_ctx.project_root,
        check=True,
    )
