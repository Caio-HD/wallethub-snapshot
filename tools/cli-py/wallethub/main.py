#!/usr/bin/env python3
"""
Interface CLI interativa para desenvolvimento do WalletHub
Modernizado com Typer mantendo compatibilidade retroativa
"""

import sys
from pathlib import Path

# Garantir tools/cli-py no path quando main.py é executado diretamente
_CLI_PY = Path(__file__).resolve().parent.parent
if str(_CLI_PY) not in sys.path:
    sys.path.insert(0, str(_CLI_PY))

# PEP 668: venv dedicado em tools/cli-py/.venv + re-exec antes de qualquer pip
from wallethub.bootstrap_venv import ensure_cli_venv_and_reexec

ensure_cli_venv_and_reexec()

# Configurar encoding UTF-8 robusto
from wallethub.utils.encoding import configure_utf8_encoding

configure_utf8_encoding()

# Auto-instalar dependências essenciais
from wallethub.utils.dependencies import ensure_python_dependency, auto_setup

# Verificar e instalar dependências opcionais
HAS_RICH = ensure_python_dependency("rich")
HAS_QUESTIONARY = ensure_python_dependency("questionary")
HAS_TYPER = ensure_python_dependency("typer")

if HAS_TYPER:
    import typer
    from typer import Typer
    app = Typer(
        name="wallethub",
        help="Ferramenta de Developer Experience para WalletHub",
        add_completion=True,
        rich_markup_mode="rich" if HAS_RICH else None,
    )
else:
    app = None

from wallethub.context import MenuContext
from wallethub.utils.platform import get_project_root


def detect_project_root() -> Path:
    """
    Detecta a raiz do projeto WalletHub.
    
    Returns:
        Path da raiz do projeto
    """
    # Tenta detectar automaticamente
    root = get_project_root()
    if root:
        return root
    
    # Fallback: assume que estamos em tools/cli-py e sobe 3 níveis
    current = Path(__file__).parent.resolve()
    if "tools" in current.parts and "cli-py" in current.parts:
        # Estamos em tools/cli-py, sobe para raiz
        while current.name != "tools" and current.parent != current:
            current = current.parent
        if current.name == "tools":
            return current.parent
    
    # Último fallback: diretório atual
    return Path.cwd()


def main() -> int:
    """
    Função principal com setup 100% automático.

    Contrato: sem argumentos (ex.: `python wallethub.py`) exibe o menu interativo;
    com argumentos delega para a CLI Typer (ex.: `python wallethub.py --help`).

    Returns:
        Código de saída (0 para sucesso, != 0 para erro)
    """
    from wallethub.utils.dependencies import check_python_dependencies

    project_root = detect_project_root()

    # Verificar e instalar dependências automaticamente
    missing_deps, _ = check_python_dependencies()

    if missing_deps:
        print("🔧 Detectadas dependências faltando. Instalando automaticamente...\n")
        if not auto_setup():
            print("⚠️  Setup incompleto. Alguns recursos podem não funcionar.\n")

    # Com argumentos: CLI Typer (subcomandos). Sem argumentos: menu interativo.
    if len(sys.argv) > 1 and HAS_TYPER:
        try:
            app()
            return 0
        except SystemExit as e:
            return e.code if isinstance(e.code, int) else 0
        except Exception as e:
            print(f"❌ Erro: {e}")
            return 1
    
    # Sem argumentos: exibir menu interativo (header + dashboard + escolha de ações)
    from wallethub.menu.header import show_header
    from wallethub.menu.interactive import run_interactive_menu
    from wallethub.analytics.dashboard import show_dashboard

    env_name = "personal"
    menu_ctx = MenuContext(project_root)

    show_header(project_root, env_name)
    show_dashboard(menu_ctx)

    # Garantir que o dashboard foi completamente renderizado antes de iniciar o menu
    # Isso evita sobreposição visual entre Rich e Questionary
    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except (AttributeError, OSError):
        pass

    run_interactive_menu(menu_ctx, env_name)
    return 0


# Registrar comandos quando Typer estiver disponível
if HAS_TYPER and app:
    # Callback global para injetar contexto em todos os comandos
    @app.callback()
    def main_callback(ctx: typer.Context):
        """Callback principal que injeta contexto"""
        project_root = detect_project_root()
        ctx.obj = MenuContext(project_root)
    
    # Importar e registrar comandos
    from wallethub.commands import (
        diagnose,
        setup,
        dev,
        db,
        secrets,
        env,
        ci,
        release,
        deploy,
        cloudflare,
        workflow,
        menu,
    )
    
    app.add_typer(diagnose.app, name="diagnose")
    app.add_typer(setup.app, name="setup")
    app.add_typer(dev.app, name="dev")
    app.add_typer(db.app, name="db")
    app.add_typer(secrets.app, name="secrets")
    app.add_typer(env.app, name="env")
    app.add_typer(ci.app, name="ci")
    app.add_typer(release.app, name="release")
    app.add_typer(deploy.app, name="deploy")
    app.add_typer(cloudflare.app, name="cloudflare")
    app.add_typer(workflow.app, name="workflow")
    app.add_typer(menu.app, name="menu")


if __name__ == "__main__":
    sys.exit(main())

