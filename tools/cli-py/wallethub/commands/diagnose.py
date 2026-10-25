"""Comando diagnose - Verificações de ambiente e dependências"""

import os
from pathlib import Path
from typing import Tuple, Optional

import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.utils.run import run_command
from wallethub.utils.tools import (
    check_docker,
    check_docker_compose,
    check_node,
    check_npm,
    check_bash,
)
from wallethub.utils.platform import npm_command
from wallethub.config import CI_COMPOSE_RELATIVE, CI_SCRIPT_RELATIVE


app = Typer(name="diagnose", help="Executa verificações rápidas de ambiente e dependências")


def run_with_status(label: str, fn) -> Tuple[str, str, Optional[str]]:
    """
    Executa uma função e retorna status.
    
    Returns:
        Tupla (label, status, message)
        - status: 'ok' ou 'fail'
        - message: Mensagem de erro se falhou
    """
    try:
        fn()
        return label, "ok", None
    except Exception as e:
        return label, "fail", str(e)


@app.command()
def diagnose(ctx: typer.Context) -> None:
    """Função principal do diagnose"""
    # Obtém contexto do menu
    menu_ctx: MenuContext = ctx.obj
    
    checks = []
    
    # Verifica Node.js
    def check_node_js():
        installed, error = check_node()
        if not installed:
            raise Exception(error)
    
    checks.append(("Node.js", check_node_js))
    
    # Verifica npm
    def check_npm_cmd():
        installed, error = check_npm()
        if not installed:
            raise Exception(error)
    
    checks.append(("npm", check_npm_cmd))
    
    # Verifica Docker
    def check_docker_cmd():
        installed, error = check_docker()
        if not installed:
            raise Exception(error)
    
    checks.append(("Docker", check_docker_cmd))
    
    # Verifica Docker Compose
    def check_docker_compose_cmd():
        available, error = check_docker_compose()
        if not available:
            raise Exception(error)
    
    checks.append(("Docker Compose", check_docker_compose_cmd))
    
    # Verifica Bash
    def check_bash_cmd():
        available, error = check_bash()
        if not available:
            raise Exception(error)
    
    checks.append(("Bash", check_bash_cmd))
    
    # Verifica Compose CI
    def check_compose_ci():
        compose_path = menu_ctx.resolve_project_path(*CI_COMPOSE_RELATIVE.parts)
        if not compose_path.exists():
            raise Exception(f"Arquivo não encontrado: {compose_path}")
        # Valida sintaxe do compose
        run_command(
            ["docker", "compose", "-f", str(CI_COMPOSE_RELATIVE), "config", "-q"],
            cwd=menu_ctx.project_root,
            check=True,
        )
    
    checks.append(("Compose CI", check_compose_ci))
    
    # Verifica Script CI
    def check_script_ci():
        script_path = menu_ctx.resolve_project_path(*CI_SCRIPT_RELATIVE.parts)
        if not script_path.exists():
            raise Exception(f"Arquivo não encontrado: {script_path}")
        # Verifica se é executável (Unix) ou legível (Windows)
        if not os.access(script_path, os.R_OK):
            raise Exception(f"Arquivo não é legível: {script_path}")
    
    checks.append(("Script CI", check_script_ci))
    
    # Executa todas as verificações
    results = []
    for label, check_fn in checks:
        result = run_with_status(label, check_fn)
        results.append(result)
    
    # Verifica variáveis de ambiente críticas
    required_envs = [
        "DATABASE_URL",
        "DB_HOST",
        "DB_PORT",
        "DB_USER",
        "DB_PASSWORD",
        "DB_NAME",
        "REDIS_URL",
        "JWT_PRIVATE_KEY",
        "JWT_PUBLIC_KEY",
    ]
    
    missing = [env for env in required_envs if not os.environ.get(env)]
    env_status = "ok" if not missing else "fail"
    env_message = (
        "Todas as variáveis detectadas."
        if not missing
        else f"Ausentes: {', '.join(missing)} (verifique .env local ou segredo no CI)."
    )
    results.append(("Variáveis de ambiente críticas", env_status, env_message))
    
    # Exibe resultados
    ok_count = sum(1 for _, status, _ in results if status == "ok")
    fail_count = len(results) - ok_count
    
    print("\nDiagnóstico WalletHub")
    print("=====================")
    for label, status, message in results:
        icon = "✅" if status == "ok" else "⚠️ "
        msg_part = f" — {message}" if message else ""
        print(f"{icon} {label}{msg_part}")
    
    print(f"\nResumo: {ok_count} OK, {fail_count} com atenção.")
    
    if fail_count > 0:
        raise typer.Exit(code=1)

