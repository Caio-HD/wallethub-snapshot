"""Detecção de plataforma e utilitários cross-platform"""

import os
import sys
import platform
from pathlib import Path
from typing import Optional


def is_windows() -> bool:
    """Verifica se está rodando no Windows"""
    return platform.system() == "Windows"


def is_linux() -> bool:
    """Verifica se está rodando no Linux"""
    return platform.system() == "Linux"


def is_macos() -> bool:
    """Verifica se está rodando no macOS"""
    return platform.system() == "Darwin"


def npm_command() -> str:
    """
    Retorna o comando npm correto para a plataforma.
    
    Returns:
        'npm.cmd' no Windows, 'npm' em outros sistemas
    """
    return "npm.cmd" if is_windows() else "npm"


def npx_command() -> str:
    """
    Retorna o comando npx correto para a plataforma.
    
    Returns:
        'npx.cmd' no Windows, 'npx' em outros sistemas
    """
    return "npx.cmd" if is_windows() else "npx"


def to_posix_path(path: str) -> str:
    """
    Converte caminho Windows para formato POSIX.
    
    Args:
        path: Caminho a converter
    
    Returns:
        Caminho em formato POSIX
    """
    return path.replace("\\", "/")


def to_wsl_path(path: str) -> str:
    """
    Converte caminho Windows para formato WSL.
    
    Args:
        path: Caminho Windows (ex: C:\\Users\\...)
    
    Returns:
        Caminho WSL (ex: /mnt/c/Users/...)
    """
    if not is_windows():
        return path
    
    # Tenta detectar formato de drive (C:\, D:\, etc.)
    import re
    match = re.match(r"^([A-Za-z]):\\(.*)$", path)
    if not match:
        return to_posix_path(path)
    
    drive_letter, rest = match.groups()
    normalized_rest = rest.replace("\\", "/")
    return f"/mnt/{drive_letter.lower()}/{normalized_rest}"


def is_ci_environment() -> bool:
    """
    Detecta se o código está sendo executado em um ambiente CI/workflow.
    Verifica variáveis de ambiente comuns de diferentes sistemas de CI.
    
    Returns:
        True se estiver em ambiente CI, False caso contrário
    """
    ci_indicators = [
        "CI",  # Genérico (GitHub Actions, GitLab CI, CircleCI, etc.)
        "GITHUB_ACTIONS",
        "GITLAB_CI",
        "JENKINS_URL",
        "JENKINS_HOME",
        "TRAVIS",
        "CIRCLECI",
        "APPVEYOR",
        "TEAMCITY_VERSION",
        "BUILDKITE",
        "TF_BUILD",
        "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI",
        "CODEBUILD_BUILD_ID",
        "CONTINUOUS_INTEGRATION",
    ]
    
    for indicator in ci_indicators:
        value = os.environ.get(indicator)
        if value and value not in ("", "false", "0"):
            return True
    
    return False


def normalize_path(path: str) -> Path:
    """
    Normaliza um caminho para Path object, expandindo variáveis de ambiente.
    
    Args:
        path: Caminho a normalizar
    
    Returns:
        Path object normalizado
    """
    expanded = os.path.expanduser(os.path.expandvars(path))
    return Path(expanded).resolve()


def get_project_root() -> Optional[Path]:
    """
    Tenta detectar a raiz do projeto WalletHub.
    Procura por indicadores como package.json, pyproject.toml, etc.
    
    Returns:
        Path da raiz do projeto ou None se não encontrado
    """
    current = Path.cwd()
    
    # Indicador de raiz do projeto (fonte única: package.json na raiz)
    for path in [current] + list(current.parents):
        if (path / "package.json").exists():
            return path
    
    return None




