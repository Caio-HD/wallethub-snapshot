"""Workflows de produção"""

from pathlib import Path

from wallethub.context import MenuContext
from wallethub.utils.run import run_command, exec_wallethub_safe
from wallethub.utils.platform import npm_command
from wallethub.utils.environment import (
    load_env_file,
    sync_env_derived_files,
)
from wallethub.utils.artifacts import (
    generate_artifact_dir,
    cleanup_old_artifacts,
)
from wallethub.workflows.helpers import (
    resolve_compose_context,
    wait_for_container_healthy,
    wait_for_service_ready,
    safe_docker_command,
    get_api_url,
    get_frontend_url,
    get_gateway_origin,
)
from wallethub.workflows.dev import execute_steps


def ensure_postgres_running(menu_ctx: MenuContext, env_name: str) -> None:
    """Garante que Postgres esteja rodando (apenas para produção)"""
    if env_name != "production":
        return
    
    compose = resolve_compose_context(menu_ctx, env_name)
    compose_path = menu_ctx.resolve_project_path(*Path(compose["compose_relative"]).parts)
    
    if not compose_path.exists():
        raise FileNotFoundError(f"Arquivo {compose['compose_relative']} não encontrado.")
    
    env_file_path = menu_ctx.resolve_deploy_env_path()
    
    # Verifica se container está rodando (implementação simplificada)
    # Se não estiver, sobe apenas Postgres
    print("📦 Verificando se Postgres está rodando...")
    
    # Tenta subir Postgres se não estiver rodando
    compose_args = ["compose", "-f", compose["compose_relative"]]
    if env_file_path.exists():
        compose_args.extend(["--env-file", str(env_file_path)])
    compose_args.extend(["up", "-d", "postgres"])
    
    safe_docker_command(menu_ctx, compose_args, compose["docker_env"])
    
    print("⏳ Aguardando Postgres estar pronto...")
    wait_for_container_healthy(
        menu_ctx,
        compose["compose_relative"],
        "postgres",
        compose["docker_env"],
        40,
        3000,
        True,
    )
    print("✅ Postgres está pronto e saudável.")


def workflow_prod_start(menu_ctx: MenuContext, env_name: str = "production") -> None:
    """Workflow completo de produção"""
    # Limpa artifacts antigos antes de começar
    print("🧹 Limpando artifacts antigos...")
    cleanup_old_artifacts(menu_ctx, "prod")
    
    # Cria diretório de artifacts para produção
    prod_artifact_dir = generate_artifact_dir(menu_ctx, "prod")
    print(f"📦 Artifacts de produção: {prod_artifact_dir}")
    
    execute_steps("Workflow de Produção", [
        {
            "label": "Sincronizando ambiente a partir de config/",
            "action": lambda: sync_env_derived_files(menu_ctx, env_name),
        },
        {
            "label": "Garantindo que Postgres esteja rodando",
            "action": lambda: ensure_postgres_running(menu_ctx, env_name),
        },
        {
            "label": "Fazendo backup do banco de dados",
            "action": lambda: _create_backup(menu_ctx, env_name),
        },
        {
            "label": "Executando CI completo",
            "action": lambda: exec_wallethub_safe(
                ["ci"],
                menu_ctx,
                check=True,
            ),
        },
        {
            "label": "Gerando imagens de release",
            "action": lambda: exec_wallethub_safe(
                ["release"],
                menu_ctx,
                check=True,
            ),
        },
        {
            "label": "Aplicando stack de deploy",
            "action": lambda: _apply_deploy(menu_ctx),
        },
        {
            "label": "Aguardando serviços estarem prontos",
            "action": lambda: _wait_for_prod_services(menu_ctx, env_name),
        },
        {
            "label": "Executando migrações do banco de dados",
            "action": lambda: exec_wallethub_safe(
                ["db", "migration", "run", "--env", env_name],
                menu_ctx,
                check=True,
            ),
        },
        {
            "label": "Executando diagnósticos",
            "action": lambda: exec_wallethub_safe(
                ["db", "diagnose", "--env", env_name],
                menu_ctx,
                check=False,
            ),
        },
        {
            "label": "Verificando saúde dos serviços",
            "action": lambda: _check_prod_services_health(menu_ctx, env_name),
        },
    ])


def _create_backup(menu_ctx: MenuContext, env_name: str) -> None:
    """Cria backup do banco"""
    backup_dir = menu_ctx.resolve_project_path("ops", "prod", "backups", "postgres")
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    exec_wallethub_safe(
        ["db", "backup", "--env", env_name],
        menu_ctx,
        check=True,
    )


def _apply_deploy(menu_ctx: MenuContext) -> None:
    """Aplica stack de deploy"""
    sync_env_derived_files(menu_ctx, "production")
    env_file = menu_ctx.resolve_deploy_env_path()
    exec_wallethub_safe(
        ["deploy", "up", "--env-file", str(env_file)],
        menu_ctx,
        check=True,
    )


def _wait_for_prod_services(menu_ctx: MenuContext, env_name: str) -> None:
    """Aguarda serviços de produção estarem prontos"""
    compose = resolve_compose_context(menu_ctx, env_name)
    
    print("⏳ Aguardando Postgres estar pronto...")
    wait_for_container_healthy(
        menu_ctx,
        compose["compose_relative"],
        "postgres",
        compose["docker_env"],
        40,
        3000,
        True,
    )
    
    print("⏳ Aguardando Redis estar pronto...")
    wait_for_container_healthy(
        menu_ctx,
        compose["compose_relative"],
        "redis",
        compose["docker_env"],
        40,
        3000,
        True,
    )
    
    print("⏳ Aguardando API estar pronto...")
    try:
        api_url = get_gateway_origin(compose["docker_env"])
        wait_for_service_ready(api_url, "API", "/api/health", 200, 60000)
    except Exception:
        print("⚠️  API ainda não está pronta, mas continuando...")


def _check_prod_services_health(menu_ctx: MenuContext, env_name: str) -> None:
    """Verifica saúde dos serviços de produção"""
    compose = resolve_compose_context(menu_ctx, env_name)
    
    unhealthy = []
    
    # Verifica Postgres
    try:
        wait_for_container_healthy(menu_ctx, compose["compose_relative"], "postgres", compose["docker_env"], 5, 2000, True)
    except Exception as e:
        unhealthy.append(("Postgres", str(e)))
    
    # Verifica Redis
    try:
        wait_for_container_healthy(menu_ctx, compose["compose_relative"], "redis", compose["docker_env"], 5, 2000, True)
    except Exception as e:
        unhealthy.append(("Redis", str(e)))
    
    # Verifica API
    try:
        api_url = get_api_url(compose["docker_env"])
        wait_for_service_ready(api_url, "API", "/api/health", 200, 10000)
    except Exception as e:
        unhealthy.append(("API", str(e)))
    
    # Verifica Frontend
    try:
        frontend_url = get_frontend_url(compose["docker_env"])
        wait_for_service_ready(frontend_url, "Frontend", "/", 200, 10000)
    except Exception as e:
        unhealthy.append(("Frontend", str(e)))
    
    if unhealthy:
        print("\n⚠️  Alguns serviços não estão saudáveis:")
        for service, error in unhealthy:
            print(f"  • {service}: {error}")
        raise RuntimeError("Serviços não estão prontos. Verifique os logs acima.")
    
    print("✅ Todos os serviços estão saudáveis")


def workflow_prod_stop(menu_ctx: MenuContext) -> None:
    """Encerra ambiente de produção"""
    execute_steps("Encerrando Ambiente de Produção", [
        {
            "label": "Derrubando stack de produção",
            "action": lambda: exec_wallethub_safe(
                ["deploy", "down"],
                menu_ctx,
                check=True,
            ),
        },
    ])

