"""Verificação de ferramentas externas e instalação automática"""

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional, List

from wallethub.utils.platform import is_windows, is_linux, is_macos
from wallethub.utils.run import run_command


def find_command(command: str) -> Optional[Path]:
    """
    Encontra um comando no PATH.
    
    Args:
        command: Nome do comando
    
    Returns:
        Path do comando ou None se não encontrado
    """
    which_cmd = "where" if is_windows() else "which"
    try:
        result = subprocess.run(
            [which_cmd, command],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            path = result.stdout.strip().split("\n")[0]
            return Path(path)
    except Exception:
        pass
    
    return None


def check_tool_installed(tool_name: str, version_flags: List[str] = None) -> bool:
    """
    Verifica se uma ferramenta está instalada e acessível.
    
    Args:
        tool_name: Nome da ferramenta
        version_flags: Flags para verificar versão (padrão: ['--version'])
    
    Returns:
        True se instalada, False caso contrário
    """
    if version_flags is None:
        version_flags = ["--version"]
    
    # Primeiro tenta encontrar no PATH
    tool_path = find_command(tool_name)
    if not tool_path:
        return False
    
    # Tenta executar comando de versão
    try:
        result = subprocess.run(
            [tool_name] + version_flags,
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


def check_docker() -> tuple[bool, Optional[str]]:
    """
    Verifica se Docker está instalado e rodando.
    
    Returns:
        Tupla (installed, error_message):
        - installed: True se Docker está disponível
        - error_message: Mensagem de erro se não disponível
    """
    # Verifica se docker está no PATH
    if not check_tool_installed("docker", ["--version"]):
        return False, "Docker não está instalado ou não está no PATH"
    
    # Verifica se Docker daemon está rodando
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            timeout=5,
        )
        if result.returncode != 0:
            error_msg = result.stderr.decode("utf-8", errors="replace")
            if "dockerDesktopLinuxEngine" in error_msg or "cannot find the file specified" in error_msg:
                return False, "Docker Desktop não está rodando. Inicie o Docker Desktop e aguarde até que esteja totalmente inicializado."
            return False, f"Docker daemon não está disponível: {error_msg}"
    except subprocess.TimeoutExpired:
        return False, "Timeout ao verificar Docker daemon"
    except Exception as e:
        return False, f"Erro ao verificar Docker: {e}"
    
    return True, None


def check_docker_compose() -> tuple[bool, Optional[str]]:
    """
    Verifica se Docker Compose está disponível.
    
    Returns:
        Tupla (available, error_message)
    """
    # Tenta 'docker compose' (versão mais recente)
    try:
        result = subprocess.run(
            ["docker", "compose", "version"],
            capture_output=True,
            timeout=5,
        )
        if result.returncode == 0:
            return True, None
    except Exception:
        pass
    
    # Tenta 'docker-compose' (versão antiga)
    if check_tool_installed("docker-compose", ["--version"]):
        return True, None
    
    return False, "Docker Compose não está disponível. Instale Docker Desktop ou docker-compose."


def check_node() -> tuple[bool, Optional[str]]:
    """
    Verifica se Node.js está instalado.
    
    Returns:
        Tupla (installed, error_message)
    """
    if not check_tool_installed("node", ["--version"]):
        return False, "Node.js não está instalado. Instale de https://nodejs.org/"
    
    return True, None


def check_npm() -> tuple[bool, Optional[str]]:
    """
    Verifica se npm está instalado.
    
    Returns:
        Tupla (installed, error_message)
    """
    from wallethub.utils.platform import npm_command
    
    cmd = npm_command()
    if not check_tool_installed(cmd, ["--version"]):
        return False, "npm não está instalado. Instale Node.js de https://nodejs.org/"
    
    return True, None


def check_bash() -> tuple[bool, Optional[str]]:
    """
    Verifica se Bash está disponível (importante no Windows com WSL).
    
    Returns:
        Tupla (available, error_message)
    """
    if is_windows():
        # No Windows, verifica WSL
        if check_tool_installed("wsl", ["--version"]):
            return True, None
        if check_tool_installed("bash", ["--version"]):
            return True, None
        return False, "Bash não está disponível. Instale WSL ou Git Bash."
    else:
        # Linux/macOS sempre tem bash
        return True, None




