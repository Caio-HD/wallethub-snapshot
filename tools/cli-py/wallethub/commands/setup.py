"""Comando setup - Instalação inicial e validação"""

import shutil
import typer
from typer import Typer

from wallethub.context import MenuContext
from wallethub.utils.run import run_command, exec_wallethub_safe
from wallethub.utils.platform import npm_command, npx_command, is_windows
from wallethub.utils.filesystem import cleanup_windows_symlinks, safe_remove_windows
from wallethub.utils.check_dependencies import (
    check_dependencies,
    find_nest_cli_command,
)
import time

app = Typer(name="setup", help="Instala dependências locais e valida pré-requisitos básicos")


@app.command()
def setup(
    ctx: typer.Context,
    skip_check: bool = typer.Option(False, "--skip-check", help="Pula verificação prévia e força reinstalação"),
    clean: bool = typer.Option(False, "--clean", help="Limpa node_modules antes de instalar"),
) -> None:
    """Instala dependências locais e valida pré-requisitos básicos"""
    menu_ctx: MenuContext = ctx.obj
    
    api_dir = menu_ctx.api_dir
    web_dir = menu_ctx.web_dir
    
    # Verifica se diretórios existem
    for dir_path, name in [(api_dir, "API"), (web_dir, "Web")]:
        if not dir_path.exists():
            raise typer.BadParameter(f"Diretório obrigatório não encontrado: {dir_path}")
    
    # Verificação rápida: se tudo já estiver instalado, apenas informa
    if not skip_check:
        is_ready = check_dependencies(menu_ctx, auto_install=False)
        if is_ready:
            print("✅ Todas as dependências já estão instaladas.")
            print("   Use --skip-check para forçar reinstalação.\n")
            return
    
    # Variável para decidir entre npm ci e npm install
    use_npm_install = False
    
    # Limpa node_modules completamente se solicitado
    if clean:
        root_node_modules = menu_ctx.project_root / "node_modules"
        if root_node_modules.exists():
            print("🧹 Limpando node_modules completamente...")
            try:
                if is_windows():
                    removed = safe_remove_windows(root_node_modules)
                else:
                    removed = shutil.rmtree(root_node_modules, ignore_errors=False)
                if root_node_modules.exists():
                    raise Exception("Não foi possível remover node_modules completamente")
                print("✅ node_modules removido com sucesso.")
            except Exception as e:
                print(f"⚠️  Não foi possível remover node_modules: {e}")
                print("   Tente remover manualmente ou execute como administrador.")
                raise typer.Exit(code=1)
    else:
        # Limpa apenas links simbólicos problemáticos no Windows
        if is_windows():
            print("🧹 Limpando links simbólicos problemáticos no Windows...")
            try:
                has_blocked_dirs = cleanup_windows_symlinks(menu_ctx.project_root)
                time.sleep(0.5)  # Aguarda após limpeza
                if has_blocked_dirs:
                    use_npm_install = True
            except Exception:
                print("⚠️  Aviso: Não foi possível limpar alguns links simbólicos, usando npm install...")
                use_npm_install = True
    
    print("📦 Instalando dependências do workspace (npm workspaces)...")
    
    # Se usou --clean, sempre usa npm install
    if clean:
        use_npm_install = True
    
    # Instala dependências
    if use_npm_install:
        print("📦 Usando npm install (diretórios bloqueados detectados)...")
        try:
            run_command(
                [npm_command(), "install"],
                cwd=menu_ctx.project_root,
                check=True,
            )
        except Exception as e:
            print("\n❌ Falha ao instalar dependências.")
            print(f"   Erro: {e}")
            print("\n   Possíveis soluções:")
            print("   1. Execute como administrador (PowerShell como Admin)")
            print("   2. Feche editores de texto que possam estar bloqueando arquivos")
            print("   3. Desative temporariamente o antivírus")
            if is_windows():
                print("   4. Limpe node_modules manualmente: Remove-Item -Path node_modules -Recurse -Force")
                print("   5. Use: wallethub setup --clean")
            raise typer.Exit(code=1)
    else:
        # Tenta npm ci primeiro, com fallback para npm install
        try:
            run_command(
                [npm_command(), "ci"],
                cwd=menu_ctx.project_root,
                check=True,
            )
        except Exception as e:
            error_msg = str(e)
            if "EACCES" in error_msg or "permission denied" in error_msg or "-4092" in error_msg:
                print("⚠️  npm ci falhou com erro de permissão. Tentando npm install como fallback...")
                try:
                    run_command(
                        [npm_command(), "install"],
                        cwd=menu_ctx.project_root,
                        check=True,
                    )
                except Exception as fallback_error:
                    print(f"\n❌ Falha ao instalar dependências mesmo com fallback: {fallback_error}")
                    raise typer.Exit(code=1)
            else:
                raise
    
    print("🏗️  Compilando API...")
    nest_command = find_nest_cli_command(menu_ctx)
    if not nest_command:
        raise typer.BadParameter(
            "NestJS CLI não encontrado. Execute: npm install --save-dev @nestjs/cli"
        )
    
    try:
        run_command(
            [npm_command(), "run", "build"],
            cwd=api_dir,
            check=True,
        )
    except Exception as e:
        error_msg = str(e)
        if "'nest' is not recognized" in error_msg or "nest: command not found" in error_msg:
            print("⚠️  Comando 'nest' não encontrado, usando npx nest...")
            run_command([npx_command(), "nest", "build"], cwd=api_dir, check=True)
            run_command([npm_command(), "run", "build:data-source"], cwd=api_dir, check=True)
        else:
            raise
    
    # Verifica e gera chaves JWT se não existirem
    jwt_env_path = menu_ctx.resolve_jwt_env_path()
    if not jwt_env_path.exists():
        print("🔐 Gerando chaves JWT para desenvolvimento...")
        try:
            exec_wallethub_safe(
                ["secrets", "jwt"],
                menu_ctx,
                check=True,
            )
        except Exception:
            print("⚠️  Não foi possível gerar chaves JWT automaticamente.")
            print("   Execute manualmente: wallethub secrets jwt")
    
    print("\n✅ Setup concluído com sucesso.")

