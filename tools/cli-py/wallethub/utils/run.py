"""Execução de comandos com retry e tratamento robusto de erros"""

import subprocess
import time
from pathlib import Path
from typing import Optional, Sequence, Union, Dict, Any, List
import os

# Tenta importar tenacity, mas funciona sem ele
try:
    from tenacity import retry, stop_after_attempt, wait_exponential
    HAS_TENACITY = True
except ImportError:
    HAS_TENACITY = False


def run_command(
    command: Union[str, Sequence[str]],
    cwd: Optional[Path] = None,
    env: Optional[Dict[str, str]] = None,
    track_analytics: bool = True,
    check: bool = True,
    capture_output: bool = False,
    input: Optional[str] = None,
    timeout: Optional[int] = None,
) -> subprocess.CompletedProcess:
    """
    Executa um comando com analytics e tratamento de erros robusto.
    
    Args:
        command: Comando a executar (string ou lista)
        cwd: Diretório de trabalho
        env: Variáveis de ambiente adicionais
        track_analytics: Se deve rastrear analytics
        check: Se deve lançar exceção em caso de erro
        capture_output: Se deve capturar stdout/stderr
        timeout: Timeout em segundos
    
    Returns:
        CompletedProcess com resultado da execução
    
    Raises:
        subprocess.CalledProcessError: Se check=True e comando falhar
        subprocess.TimeoutExpired: Se timeout for excedido
    """
    start_time = time.time()
    success = False
    error_msg = None
    
    try:
        # Prepara ambiente
        full_env = {**os.environ}
        if env:
            full_env.update(env)

        # Prepara comando
        if isinstance(command, str):
            shell = True
            cmd = command
        else:
            shell = False
            cmd = list(command)
        
        # Executa comando
        result = subprocess.run(
            cmd,
            input=input,
            cwd=str(cwd) if cwd else None,
            env=full_env,
            shell=shell,
            check=check,
            capture_output=capture_output,
            timeout=timeout,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        
        success = True
        return result
        
    except subprocess.CalledProcessError as e:
        error_msg = str(e)
        if capture_output:
            error_msg += f"\nstdout: {e.stdout}\nstderr: {e.stderr}"
        if check:
            print(f"\n❌ Erro ao executar comando: {error_msg}")
        raise
        
    except subprocess.TimeoutExpired as e:
        error_msg = f"Timeout após {timeout}s"
        print(f"\n❌ {error_msg}")
        raise
        
    except FileNotFoundError as e:
        error_msg = f"Comando não encontrado: {e}"
        print(f"\n❌ {error_msg}")
        raise
        
    except Exception as e:
        error_msg = str(e)
        print(f"\n❌ Erro inesperado: {error_msg}")
        raise
        
    finally:
        # Rastrear analytics se habilitado
        if track_analytics:
            try:
                duration = time.time() - start_time
                from wallethub.analytics.tracker import track_command
                cmd_name = command if isinstance(command, str) else " ".join(command)
                track_command(cmd_name, duration, success, error_msg)
            except Exception:
                pass  # Não falhar se analytics der erro


if HAS_TENACITY:
    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=10)
    )
    def run_command_with_retry(
        command: Sequence[str],
        cwd: Optional[Path] = None,
        env: Optional[Dict[str, str]] = None,
        check: bool = True,
        timeout: Optional[int] = None,
    ) -> subprocess.CompletedProcess:
        """
        Executa comando com retry automático usando tenacity.
        Útil para operações que podem falhar temporariamente.
        
        Args:
            command: Lista de argumentos do comando
            cwd: Diretório de trabalho
            env: Variáveis de ambiente adicionais
            check: Se deve lançar exceção em caso de erro
            timeout: Timeout em segundos
        
        Returns:
            CompletedProcess com resultado da execução
        """
        return run_command(
            command,
            cwd=cwd,
            env=env,
            check=check,
            timeout=timeout,
            track_analytics=False,  # Não rastrear cada tentativa
        )
else:
    def run_command_with_retry(
        command: Sequence[str],
        cwd: Optional[Path] = None,
        env: Optional[Dict[str, str]] = None,
        check: bool = True,
        timeout: Optional[int] = None,
        max_attempts: int = 5,
    ) -> subprocess.CompletedProcess:
        """
        Executa comando com retry manual (fallback quando tenacity não está disponível).
        
        Args:
            command: Lista de argumentos do comando
            cwd: Diretório de trabalho
            env: Variáveis de ambiente adicionais
            check: Se deve lançar exceção em caso de erro
            timeout: Timeout em segundos
            max_attempts: Número máximo de tentativas
        
        Returns:
            CompletedProcess com resultado da execução
        """
        last_error = None
        wait_time = 1
        
        for attempt in range(1, max_attempts + 1):
            try:
                return run_command(
                    command,
                    cwd=cwd,
                    env=env,
                    check=check,
                    timeout=timeout,
                    track_analytics=False,
                )
            except Exception as e:
                last_error = e
                if attempt < max_attempts:
                    print(f"⏳ Tentativa {attempt}/{max_attempts} falhou, aguardando {wait_time}s...")
                    time.sleep(wait_time)
                    wait_time = min(wait_time * 2, 10)  # Backoff exponencial, max 10s
        
        # Se chegou aqui, todas as tentativas falharam
        if check:
            raise last_error
        return subprocess.CompletedProcess(command, 1)


def exec_wallethub_safe(
    args: List[str],
    context: "MenuContext",
    check: bool = True,
    capture_output: bool = False,
    timeout: Optional[int] = None,
) -> subprocess.CompletedProcess:
    """
    Executa um subcomando da CLI WalletHub (Python) no mesmo processo ou via python -m.

    Usa o mesmo interpretador Python que está rodando a CLI, garantindo que
    sempre seja a CLI Python e não uma eventual CLI Node no PATH.

    Args:
        args: Argumentos para o wallethub (ex: ["workflow", "dev:start", "--env", "personal"])
        context: Contexto da CLI (MenuContext)
        check: Se deve lançar exceção em caso de erro
        capture_output: Se deve capturar stdout/stderr
        timeout: Timeout em segundos

    Returns:
        CompletedProcess com resultado da execução

    Raises:
        subprocess.CalledProcessError: Se check=True e comando falhar
    """
    import sys

    cmd = [sys.executable, "-m", "wallethub"] + args
    cli_py_path = context.project_root / "tools" / "cli-py"
    existing_pythonpath = os.environ.get("PYTHONPATH", "")
    new_pythonpath = str(cli_py_path) + (os.pathsep + existing_pythonpath if existing_pythonpath else "")
    subprocess_env = {**os.environ, "PYTHONPATH": new_pythonpath}
    return run_command(
        cmd,
        cwd=context.project_root,
        env=subprocess_env,
        check=check,
        capture_output=capture_output,
        timeout=timeout,
    )
