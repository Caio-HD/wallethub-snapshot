"""Operações de arquivo robustas com suporte cross-platform"""

import os
import shutil
import stat
import time
from pathlib import Path
from typing import Optional, List
import subprocess

from wallethub.utils.platform import is_windows


def safe_remove(path: Path, max_attempts: int = 5) -> bool:
    """
    Remove arquivo ou diretório de forma segura com múltiplas tentativas.
    
    Args:
        path: Caminho a remover
        max_attempts: Número máximo de tentativas
    
    Returns:
        True se removido com sucesso, False caso contrário
    """
    if not path.exists():
        return True
    
    for attempt in range(1, max_attempts + 1):
        try:
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=False)
            else:
                path.unlink()
            
            # Verifica se foi removido
            if not path.exists():
                return True
                
        except PermissionError:
            if attempt < max_attempts:
                wait_time = 0.1 * (2 ** (attempt - 1))  # Backoff exponencial
                time.sleep(wait_time)
            else:
                return False
        except Exception:
            if attempt < max_attempts:
                time.sleep(0.1 * attempt)
            else:
                return False
    
    return False


def safe_remove_windows(path: Path, max_attempts: int = 5) -> bool:
    """
    Remove arquivo ou diretório no Windows usando múltiplas estratégias.
    
    Args:
        path: Caminho a remover
        max_attempts: Número máximo de tentativas por método
    
    Returns:
        True se removido com sucesso, False caso contrário
    """
    if not is_windows():
        return safe_remove(path, max_attempts)
    
    if not path.exists():
        return True
    
    path_str = str(path.resolve())
    
    # Método 1: shutil.rmtree/path.unlink
    for attempt in range(max_attempts):
        try:
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=False)
            else:
                path.unlink()
            if not path.exists():
                return True
        except Exception:
            if attempt < max_attempts - 1:
                time.sleep(0.1 * (2 ** attempt))
    
    # Método 2: PowerShell
    for attempt in range(max_attempts):
        try:
            escaped_path = path_str.replace("'", "''")
            cmd = f"powershell -Command \"Remove-Item -Path '{escaped_path}' -Recurse -Force -ErrorAction Stop\""
            subprocess.run(cmd, shell=True, check=True, capture_output=True, timeout=10)
            if not path.exists():
                return True
        except Exception:
            if attempt < max_attempts - 1:
                time.sleep(0.2 * (2 ** attempt))
    
    # Método 3: CMD rmdir
    for attempt in range(max_attempts):
        try:
            if path.is_dir():
                cmd = f'cmd /c rmdir /s /q "{path_str}"'
            else:
                cmd = f'cmd /c del /f /q "{path_str}"'
            subprocess.run(cmd, shell=True, check=True, capture_output=True, timeout=10)
            if not path.exists():
                return True
        except Exception:
            if attempt < max_attempts - 1:
                time.sleep(0.3 * (2 ** attempt))
    
    return False


def cleanup_blocked_directories(root: Path, patterns: List[str]) -> bool:
    """
    Limpa diretórios bloqueados que correspondem aos padrões.
    
    Args:
        root: Diretório raiz para procurar
        patterns: Lista de prefixos de nomes de diretórios a limpar (ex: ['.web-', '.api-'])
    
    Returns:
        True se algum diretório não pôde ser removido, False caso contrário
    """
    if not root.exists() or not root.is_dir():
        return False
    
    has_blocked = False
    
    try:
        for entry in root.iterdir():
            if any(entry.name.startswith(pattern) for pattern in patterns):
                if is_windows():
                    removed = safe_remove_windows(entry)
                else:
                    removed = safe_remove(entry)
                
                if not removed:
                    has_blocked = True
                    print(f"⚠️  Não foi possível remover: {entry.name}")
                else:
                    print(f"✅ Removido: {entry.name}")
    except PermissionError:
        has_blocked = True
    except Exception:
        pass
    
    return has_blocked


def is_path_locked(path: Path) -> bool:
    """
    Verifica se um caminho está bloqueado por um processo (Windows).
    
    Args:
        path: Caminho a verificar
    
    Returns:
        True se bloqueado, False caso contrário
    """
    if not is_windows():
        return False
    
    try:
        escaped_path = str(path).replace("'", "''")
        cmd = f"powershell -Command \"try {{ $null = Get-Item -Path '{escaped_path}' -ErrorAction Stop; Write-Output 'OK' }} catch {{ Write-Output 'LOCKED' }}\""
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=3,
        )
        return result.stdout.strip().upper() == "LOCKED"
    except Exception:
        return True  # Em caso de dúvida, assume bloqueado


def find_locking_processes(path: Path) -> List[str]:
    """
    Tenta identificar processos que podem estar bloqueando um caminho (Windows).
    
    Args:
        path: Caminho bloqueado
    
    Returns:
        Lista de nomes de processos detectados
    """
    if not is_windows():
        return []
    
    processes: List[str] = []
    try:
        escaped_path = str(path).replace("\\", "\\\\").replace("'", "''")
        cmd = f"powershell -Command \"Get-Process | Where-Object {{ $_.Path -like '*{escaped_path}*' }} | Select-Object -ExpandProperty ProcessName\""
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=5,
        )
        processes = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
    except Exception:
        pass
    
    return processes


def has_active_npm_processes() -> bool:
    """
    Verifica se há processos npm/node ativos (Windows).
    
    Returns:
        True se há processos ativos, False caso contrário
    """
    if not is_windows():
        return False
    
    try:
        cmd = "powershell -Command \"Get-Process | Where-Object { $_.ProcessName -like '*node*' -or $_.ProcessName -like '*npm*' } | Select-Object -ExpandProperty ProcessName\""
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=3,
        )
        lines = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
        return any("node" in line.lower() or "npm" in line.lower() for line in lines)
    except Exception:
        return True  # Em caso de dúvida, assume que pode haver processos


def cleanup_windows_symlinks(project_root: Path) -> bool:
    """
    Limpa links simbólicos problemáticos no Windows.
    
    Args:
        project_root: Raiz do projeto
    
    Returns:
        True se algum diretório não pôde ser removido
    """
    if not is_windows():
        return False
    
    node_modules = project_root / "node_modules"
    if not node_modules.exists():
        return False
    
    # Verifica processos npm ativos
    if has_active_npm_processes():
        print("⚠️  Processos npm detectados, aguardando 1 segundo...")
        time.sleep(1)
    
    # Padrões de diretórios temporários do npm
    patterns = [".web-", ".api-", ".cli-"]
    
    return cleanup_blocked_directories(node_modules, patterns)




