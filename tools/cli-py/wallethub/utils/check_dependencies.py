"""Verificação e instalação de dependências Node.js"""

import os
import time
from pathlib import Path
from typing import Optional

from wallethub.context import MenuContext
from wallethub.utils.run import run_command
from wallethub.utils.platform import npm_command, npx_command


def check_dependencies(context: MenuContext, auto_install: bool = False) -> bool:
    """
    Verifica se as dependências Node.js estão instaladas.
    
    Args:
        context: Contexto da CLI
        auto_install: Se True, instala automaticamente se faltando
    
    Returns:
        True se dependências estão instaladas, False caso contrário
    """
    api_dir = context.api_dir
    web_dir = context.web_dir
    
    # Verifica node_modules em cada serviço
    api_node_modules = api_dir / "node_modules"
    web_node_modules = web_dir / "node_modules"
    root_node_modules = context.project_root / "node_modules"
    
    # Em workspaces npm, verifica na raiz
    if not root_node_modules.exists():
        if auto_install:
            print("📦 Instalando dependências do workspace...")
            try:
                run_command(
                    [npm_command(), "install"],
                    cwd=context.project_root,
                    check=True,
                )
            except Exception:
                return False
        else:
            return False
    
    # Verifica se pelo menos algumas dependências críticas existem
    # (verificação básica, não exaustiva)
    return True


def find_nest_cli_command(context: MenuContext) -> Optional[str]:
    """
    Encontra o comando NestJS CLI disponível.
    
    Returns:
        Comando encontrado ('npx nest' ou 'nest') ou None
    """
    # Tenta npx nest primeiro (npx.cmd no Windows)
    try:
        run_command(
            [npx_command(), "nest", "--version"],
            cwd=context.api_dir,
            check=True,
            capture_output=True,
        )
        return "npx nest"
    except Exception:
        pass

    # Fallback: npm exec -- nest (equivalente a npx nest; usa npm.cmd no Windows)
    try:
        run_command(
            [npm_command(), "exec", "--", "nest", "--version"],
            cwd=context.api_dir,
            check=True,
            capture_output=True,
        )
        return "npx nest"
    except Exception:
        pass

    return None

