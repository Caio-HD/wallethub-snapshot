"""Funções auxiliares para workflows"""

import json
import time
from pathlib import Path
from typing import Dict, Optional, Any
from urllib.parse import urlparse

import requests

from wallethub.context import MenuContext
from wallethub.utils.run import run_command
from wallethub.utils.environment import (
    load_environment_definition,
    build_docker_environment,
    sync_env_derived_files,
)
from wallethub.config import (
    SERVICE_WAIT_TIMEOUT_MS,
    SERVICE_WAIT_INTERVAL_MS,
    API_INITIAL_DELAY_MS,
)


# Após este número de respostas 5xx consecutivas, falha imediatamente (fail-fast)
MAX_CONSECUTIVE_5XX_BEFORE_FAIL = 12


def wait_for_service_ready(
    url: str,
    service_name: str,
    health_check_path: str = "/",
    expected_status: int = 200,
    max_timeout_ms: int = SERVICE_WAIT_TIMEOUT_MS,
) -> None:
    """
    Aguarda serviço estar pronto via HTTP health check.
    Falha rápido se o serviço responder 5xx em sequência (evita esperar todo o timeout).
    """
    attempts = (max_timeout_ms + SERVICE_WAIT_INTERVAL_MS - 1) // SERVICE_WAIT_INTERVAL_MS
    full_url = f"{url}{health_check_path}"
    consecutive_5xx = 0

    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(full_url, timeout=2)
            if response.status_code == expected_status:
                return  # Sucesso
            if response.status_code >= 500:
                consecutive_5xx += 1
                if consecutive_5xx >= MAX_CONSECUTIVE_5XX_BEFORE_FAIL:
                    raise RuntimeError(
                        f"{service_name} responde com HTTP {response.status_code} em {full_url}. "
                        f"Verifique os logs do contentor (ex.: docker compose logs api)."
                    )
            else:
                consecutive_5xx = 0

            if attempt % 5 == 0 or attempt == attempts:
                print(
                    f"⏳ {service_name} respondeu com status {response.status_code} "
                    f"(esperado {expected_status}, tentativa {attempt}/{attempts})."
                )
        except requests.exceptions.Timeout:
            consecutive_5xx = 0
            if attempt % 5 == 0 or attempt == attempts:
                print(f"⏳ {service_name} não respondeu ainda (timeout, tentativa {attempt}/{attempts})...")
        except RuntimeError:
            raise
        except Exception as e:
            consecutive_5xx = 0
            error_msg = str(e)[:50]
            if attempt % 5 == 0 or attempt == attempts:
                print(f"⏳ Aguardando {service_name} iniciar ({error_msg}, tentativa {attempt}/{attempts})...")
        time.sleep(SERVICE_WAIT_INTERVAL_MS / 1000.0)

    raise TimeoutError(
        f"{service_name} não respondeu em {max_timeout_ms // 1000}s em {full_url}."
    )


def is_container_running(
    menu_ctx: MenuContext,
    compose_relative: str,
    service_name: str,
    docker_env: Dict[str, str],
) -> Dict[str, Any]:
    """
    Verifica se container está rodando e retorna informações.
    
    Returns:
        Dicionário com running, health, state, status
    """
    try:
        result = run_command(
            [
                "docker",
                "compose",
                "-f",
                compose_relative,
                "ps",
                "--format",
                "json",
                service_name,
            ],
            cwd=menu_ctx.project_root,
            env=docker_env,
            check=False,
            capture_output=True,
            timeout=5,
        )
        
        if result.returncode == 0 and result.stdout:
            lines = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
            for line in lines:
                try:
                    container = json.loads(line)
                    if container.get("Service") == service_name or service_name in container.get("Name", ""):
                        return {
                            "running": container.get("State") == "running",
                            "health": container.get("Health"),
                            "state": container.get("State"),
                            "status": container.get("Status"),
                        }
                except json.JSONDecodeError:
                    continue
        
        return {"running": False}
    except Exception:
        return {"running": False}


def wait_for_container_healthy(
    menu_ctx: MenuContext,
    compose_relative: str,
    service_name: str,
    docker_env: Dict[str, str],
    max_attempts: int = 40,
    delay_ms: int = 3000,
    require_healthy: bool = True,
) -> None:
    """
    Aguarda container estar saudável (healthcheck passou).
    
    Args:
        menu_ctx: Contexto da CLI
        compose_relative: Caminho relativo do docker-compose
        service_name: Nome do serviço
        docker_env: Variáveis de ambiente Docker
        max_attempts: Número máximo de tentativas
        delay_ms: Delay entre tentativas em milissegundos
        require_healthy: Se True, requer healthcheck healthy
    
    Raises:
        TimeoutError: Se container não ficar pronto dentro do tempo limite
    """
    for attempt in range(1, max_attempts + 1):
        try:
            container_info = is_container_running(menu_ctx, compose_relative, service_name, docker_env)
            
            # Se não está rodando, continuar aguardando
            if not container_info.get("running", False):
                if attempt < max_attempts:
                    print(f"⏳ Container {service_name} ainda não está rodando (tentativa {attempt}/{max_attempts})...")
                    time.sleep(delay_ms / 1000.0)
                    continue
                else:
                    state = container_info.get("state", "unknown")
                    raise TimeoutError(
                        f"Container {service_name} não iniciou dentro do tempo limite. Estado: {state}"
                    )
            
            # Se não requer healthcheck ou não tem healthcheck, considerar pronto
            if not require_healthy or not container_info.get("health"):
                return
            
            # Se requer healthcheck e está healthy, pronto
            if container_info.get("health") == "healthy":
                return
            
            # Está rodando mas healthcheck ainda não passou
            if attempt < max_attempts:
                health_status = container_info.get("health", "checking")
                print(
                    f"⏳ Container {service_name} está rodando mas healthcheck ainda não passou "
                    f"({health_status}, tentativa {attempt}/{max_attempts})..."
                )
                time.sleep(delay_ms / 1000.0)
            else:
                # Última tentativa: mostrar debug e logs
                print(f"\n⚠️  Container {service_name} está rodando mas healthcheck não passou.")
                print(f"   Estado: {container_info.get('state', 'unknown')}")
                print(f"   Health: {container_info.get('health', 'no healthcheck')}")
                print(f"   Status: {container_info.get('status', 'unknown')}")
                print(f"\n📋 Últimas linhas dos logs do container:")
                try:
                    run_command(
                        [
                            "docker",
                            "compose",
                            "-f",
                            compose_relative,
                            "logs",
                            "--tail",
                            "20",
                            service_name,
                        ],
                        cwd=menu_ctx.project_root,
                        env=docker_env,
                        check=False,
                    )
                except Exception as log_error:
                    print(f"   (Não foi possível exibir logs: {log_error})")
                
                raise TimeoutError(
                    f"Container {service_name} está rodando mas healthcheck não passou dentro do tempo limite. "
                    f"Estado: {container_info.get('state')}, Health: {container_info.get('health')}, "
                    f"Status: {container_info.get('status')}."
                )
        except TimeoutError:
            raise
        except Exception as e:
            if attempt < max_attempts:
                print(f"⏳ Aguardando {service_name} estar pronto (tentativa {attempt}/{max_attempts})...")
                time.sleep(delay_ms / 1000.0)
            else:
                raise TimeoutError(
                    f"{service_name} não ficou pronto dentro do tempo limite "
                    f"({max_attempts * delay_ms // 1000}s). {str(e)}"
                )


def get_container_logs(
    menu_ctx: MenuContext,
    compose_relative: str,
    service_name: str,
    docker_env: Dict[str, str],
    lines: int = 80,
) -> str:
    """Obtém as últimas linhas dos logs do container como string."""
    try:
        result = run_command(
            [
                "docker",
                "compose",
                "-f",
                compose_relative,
                "logs",
                "--tail",
                str(lines),
                service_name,
            ],
            cwd=menu_ctx.project_root,
            env=docker_env,
            check=False,
            capture_output=True,
        )
        return (result.stdout or "") + (result.stderr or "")
    except Exception:
        return ""


def show_container_logs(
    menu_ctx: MenuContext,
    compose_relative: str,
    service_name: str,
    docker_env: Dict[str, str],
    lines: int = 50,
) -> None:
    """Exibe logs do container"""
    try:
        print(f"\n📋 Últimas {lines} linhas dos logs do container {service_name}:")
        print("─" * 60)
        run_command(
            [
                "docker",
                "compose",
                "-f",
                compose_relative,
                "logs",
                "--tail",
                str(lines),
                service_name,
            ],
            cwd=menu_ctx.project_root,
            env=docker_env,
            check=False,
        )
        print("─" * 60)
    except Exception as e:
        print(f"   (Não foi possível exibir logs: {e})")


def get_api_url(docker_env: Dict[str, str]) -> str:
    """Obtém URL da API a partir das variáveis de ambiente"""
    if docker_env.get("WALLETHUB_API_DIRECT_URL"):
        return docker_env["WALLETHUB_API_DIRECT_URL"]
    if docker_env.get("WALLETHUB_API_USE_DIRECT") == "true":
        api_port = docker_env.get("WALLETHUB_API_PORT", "3031")
        return f"http://127.0.0.1:{api_port}"
    return get_gateway_origin(docker_env)


def get_frontend_url(docker_env: Dict[str, str]) -> str:
    """Obtém URL do frontend"""
    return get_gateway_origin(docker_env)


def get_gateway_origin(docker_env: Dict[str, str]) -> str:
    """Obtém origem do gateway"""
    if docker_env.get("WALLETHUB_GATEWAY_ORIGIN"):
        return docker_env["WALLETHUB_GATEWAY_ORIGIN"]
    web_port = docker_env.get("WALLETHUB_WEB_PORT", "3030")
    return f"http://127.0.0.1:{web_port}"


def safe_docker_command(
    menu_ctx: MenuContext,
    args: list[str],
    docker_env: Dict[str, str],
    ignore_errors: bool = False,
) -> None:
    """Executa comando Docker de forma segura"""
    try:
        run_command(
            ["docker"] + args,
            cwd=menu_ctx.project_root,
            env=docker_env,
            check=True,
        )
    except Exception as e:
        if not ignore_errors:
            error_msg = str(e)
            if "dockerDesktopLinuxEngine" in error_msg or "cannot find the file specified" in error_msg:
                raise RuntimeError(
                    "Docker Desktop não está rodando.\n"
                    "Por favor, inicie o Docker Desktop e aguarde até que esteja totalmente inicializado.\n"
                    "No Windows, verifique se o ícone do Docker Desktop está visível na bandeja do sistema."
                )
            raise


def resolve_compose_context(menu_ctx: MenuContext, env_name: str) -> Dict[str, Any]:
    """
    Resolve contexto do docker-compose para um ambiente.

    Returns:
        Dicionário com compose_relative, env_name, docker_env
    """
    sync_env_derived_files(menu_ctx, env_name)
    definition = load_environment_definition(menu_ctx, env_name)
    compose_relative = definition.compose_file or "ops/dev/docker-compose.yml"
    compose_path = menu_ctx.resolve_project_path(*Path(compose_relative).parts)
    
    if not compose_path.exists():
        raise FileNotFoundError(
            f"Arquivo {compose_relative} não encontrado. Execute setup ou verifique o manifesto do ambiente."
        )
    
    docker_env = build_docker_environment(definition)

    # Adiciona variáveis de porta
    docker_env.update({
        "WALLETHUB_API_PORT": docker_env.get("WALLETHUB_API_PORT", "3031"),
        "WALLETHUB_WEB_PORT": docker_env.get("WALLETHUB_WEB_PORT", "3030"),
        "WALLETHUB_POSTGRES_PORT": str(definition.database.port or 30332),
        "WALLETHUB_REDIS_PORT": str(definition.redis.port if definition.redis else 30379),
        "WALLETHUB_ADMINER_PORT": docker_env.get("WALLETHUB_ADMINER_PORT", "30380"),
        "WALLETHUB_API_INTERNAL_PORT": docker_env.get("WALLETHUB_API_INTERNAL_PORT", "3001"),
        "WALLETHUB_WEB_INTERNAL_PORT": docker_env.get("WALLETHUB_WEB_INTERNAL_PORT", "3000"),
    })
    
    # Gera DATABASE_URL interna se necessário
    if not docker_env.get("DATABASE_URL") or "localhost" in docker_env.get("DATABASE_URL", ""):
        from urllib.parse import quote
        encoded_password = quote(definition.database.password)
        docker_env["DATABASE_URL"] = (
            f"postgresql://{definition.database.user}:{encoded_password}"
            f"@postgres:5432/{definition.database.name}"
        )
    
    return {
        "compose_relative": compose_relative,
        "env_name": definition.name,
        "docker_env": docker_env,
    }




