"""Workflows de desenvolvimento"""

import shutil
import time
from typing import Optional
from pathlib import Path

from wallethub.context import MenuContext
from wallethub.utils.run import run_command, exec_wallethub_safe
from wallethub.utils.platform import npm_command, is_windows
from wallethub.utils.filesystem import cleanup_windows_symlinks
from wallethub.utils.check_dependencies import (
    check_dependencies,
    find_nest_cli_command,
)
from wallethub.utils.tools import check_docker
from wallethub.utils.artifacts import (
    generate_artifact_dir,
    cleanup_old_artifacts,
    save_artifact,
)
from wallethub.workflows.helpers import (
    wait_for_service_ready,
    wait_for_container_healthy,
    safe_docker_command,
    resolve_compose_context,
    get_api_url,
    get_frontend_url,
    get_container_logs,
    show_container_logs,
)
from wallethub.workflows.api_startup_errors import match_api_startup_errors
from wallethub.config import (
    API_INITIAL_DELAY_MS,
    API_LIVENESS_TIMEOUT_MS,
    API_READINESS_TIMEOUT_MS,
)


def ensure_jwt_keys(menu_ctx: MenuContext) -> None:
    """Verifica e gera chaves JWT se não existirem"""
    jwt_env_path = menu_ctx.resolve_jwt_env_path()
    if not jwt_env_path.exists():
        print("🔐 Chaves JWT não encontradas. Gerando automaticamente...")
        try:
            exec_wallethub_safe(
                ["secrets", "jwt"],
                menu_ctx,
                check=True,
            )
            print("✅ Chaves JWT geradas com sucesso.")
        except Exception as e:
            raise RuntimeError(
                f"Falha ao gerar chaves JWT automaticamente: {e}. "
                "Execute manualmente: wallethub secrets jwt"
            )


def execute_steps(title: str, steps: list) -> None:
    """Executa uma lista de steps com logging"""
    print(f"\n🚀 {title}")
    for step in steps:
        print(f"\n➡️  {step['label']}")
        start = time.time()
        try:
            step["action"]()
            elapsed = time.time() - start
            print(f"✅ {step['label']} ({elapsed:.1f}s)")
        except Exception as e:
            elapsed = time.time() - start
            print(f"❌ {step['label']} falhou após {elapsed:.1f}s: {e}")
            raise
    print(f"\n🎉 {title} concluído.")


def workflow_dev_start(
    menu_ctx: MenuContext,
    env_name: str,
    with_tests: bool = False,
) -> None:
    """
    Workflow completo de início do ambiente de desenvolvimento.
    
    Fase 1: Validações pré-stack (fail-fast)
    Fase 2: Subir stack completo
    Fase 3: Testes pós-stack (opcional)
    Fase 4: Diagnóstico
    """
    compose = resolve_compose_context(menu_ctx, env_name)
    
    # Limpa artifacts antigos antes de começar
    print("🧹 Limpando artifacts antigos...")
    cleanup_old_artifacts(menu_ctx, "pre-stack")
    cleanup_old_artifacts(menu_ctx, "post-stack")
    
    # Cria diretório de artifacts para pre-stack
    pre_stack_artifact_dir = generate_artifact_dir(menu_ctx, "pre-stack")
    print(f"📦 Artifacts pré-stack: {pre_stack_artifact_dir}")
    
    # Fase 1: Validações Pré-Stack
    execute_steps("Fase 1: Validações Pré-Stack", [
        {
            "label": "Verificando disponibilidade do Docker",
            "action": lambda: _check_docker_available(),
        },
        {
            "label": "Verificando dependências e ambiente",
            "action": lambda: _check_dependencies_and_env(menu_ctx),
        },
        {
            "label": "Verificando dependências de runtime da API",
            "action": lambda: _check_api_runtime_dependencies(menu_ctx),
        },
        {
            "label": "Garantindo chaves JWT",
            "action": lambda: ensure_jwt_keys(menu_ctx),
        },
        {
            "label": "Executando validações pré-stack (lint, type-check, build)",
            "action": lambda: _run_pre_stack_validations(menu_ctx, pre_stack_artifact_dir),
        },
    ])
    
    # Fase 2: Subir Stack
    execute_steps(f"Fase 2: Subindo Stack - {compose['env_name']}", [
        {
            "label": "Finalizando containers residuais",
            "action": lambda: _cleanup_residual_containers(menu_ctx, compose),
        },
        {
            "label": "Subindo infra (Postgres/Redis/Adminer)",
            "action": lambda: safe_docker_command(
                menu_ctx,
                ["compose", "-f", compose["compose_relative"], "up", "-d", "postgres", "redis", "adminer"],
                compose["docker_env"],
            ),
        },
        {
            "label": "Aguardando Postgres ficar saudável",
            "action": lambda: _wait_for_postgres(menu_ctx, compose),
        },
        {
            "label": "Executando migrations do banco de dados",
            "action": lambda: _run_migrations(menu_ctx, compose),
        },
        {
            "label": "Ajustando Seed (se necessário)",
            "action": lambda: _apply_seed(menu_ctx, compose) if _should_apply_seed(menu_ctx, compose) else None,
        },
        {
            "label": "Subindo aplicações (API/Web)",
            "action": lambda: safe_docker_command(
                menu_ctx,
                ["compose", "-f", compose["compose_relative"], "up", "-d", "--build", "api", "web"],
                compose["docker_env"],
            ),
        },
        {
            "label": "Subindo Traefik / Proxy Reverso",
            "action": lambda: safe_docker_command(
                menu_ctx,
                ["compose", "-f", compose["compose_relative"], "up", "-d", "traefik"],
                compose["docker_env"],
            ),
        },
        {
            "label": "Aguardando Redis estar pronto",
            "action": lambda: wait_for_container_healthy(
                menu_ctx,
                compose["compose_relative"],
                "redis",
                compose["docker_env"],
                40,
                3000,
                True,
            ),
        },
        {
            "label": "Executando migrations do banco de dados",
            "action": lambda: _run_migrations(menu_ctx, compose),
        },
        {
            "label": "Aguardando API estar pronta",
            "action": lambda: _wait_for_api(menu_ctx, compose),
        },
        {
            "label": "Aplicando seed no banco de dados",
            "action": lambda: _apply_seed(menu_ctx, compose) if _should_apply_seed(menu_ctx, compose) else None,
        },
        {
            "label": "Aguardando Frontend estar pronto",
            "action": lambda: _wait_for_frontend(menu_ctx, compose),
        },
    ])
    
    # Fase 3: Testes Pós-Stack (opcional)
    if with_tests:
        # Cria diretório de artifacts para post-stack
        post_stack_artifact_dir = generate_artifact_dir(menu_ctx, "post-stack")
        print(f"📦 Artifacts pós-stack: {post_stack_artifact_dir}")
        
        execute_steps("Fase 3: Testes Pós-Stack (100% de sucesso obrigatório)", [
            {
                "label": "Executando todos os testes (unitários, e2e e healthchecks)",
                "action": lambda: _run_post_stack_tests(menu_ctx, compose, post_stack_artifact_dir),
            },
        ])
    
    # Fase 4: Diagnóstico
    execute_steps("Diagnóstico do Stack", [
        {
            "label": "Executando diagnóstico do stack",
            "action": lambda: exec_wallethub_safe(
                ["db", "diagnose", "--env", compose["env_name"]],
                menu_ctx,
                check=False,
            ),
        },
    ])


def _check_docker_available() -> None:
    """Verifica se Docker está disponível"""
    installed, error = check_docker()
    if not installed:
        raise RuntimeError(error)


def _check_dependencies_and_env(menu_ctx: MenuContext) -> None:
    """Verifica dependências e ambiente"""
    if is_windows():
        print("🧹 Executando script de limpeza do Windows...")
        try:
            cleanup_windows_symlinks(menu_ctx.project_root)
            time.sleep(1)
        except Exception:
            pass

    # Garante instalação/atualização das dependências do workspace na raiz
    print("📦 Instalando/atualizando dependências do workspace (npm install)...")
    run_command(
        [npm_command(), "install"],
        cwd=menu_ctx.project_root,
        check=True,
    )

    nest_command = find_nest_cli_command(menu_ctx)
    if not nest_command:
        raise RuntimeError(
            "NestJS CLI não encontrado. Certifique-se de que @nestjs/cli está instalado.\n"
            "Execute: npm install --save-dev @nestjs/cli"
        )
    print(f"✅ NestJS CLI disponível via: {nest_command}")


def _check_api_runtime_dependencies(menu_ctx: MenuContext) -> None:
    """Roda o check de dependências de runtime da API (apps/api)."""
    result = run_command(
        [npm_command(), "run", "deps:check"],
        cwd=menu_ctx.api_dir,
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        output = (result.stdout or "") + (result.stderr or "")
        snippet = output[:500]
        raise RuntimeError(
            "Falha ao verificar dependências de runtime da API (npm run deps:check).\n"
            "Veja o trecho abaixo e os logs completos no terminal:\n"
            f"{snippet}"
        )


def _run_pre_stack_validations(menu_ctx: MenuContext, artifact_dir: Path) -> None:
    """Executa validações pré-stack (lint, type-check, build)"""
    validation_logs = []
    validation_errors = []
    
    def log_output(msg: str):
        validation_logs.append(msg)
        print(msg)
    
    def log_error(msg: str):
        validation_errors.append(msg)
        validation_logs.append(f"ERROR: {msg}")
        print(f"❌ {msg}")
    
    # 1. Lint (por workspace: API e Web; a raiz não tem script lint)
    log_output("🔍 Executando lint...")
    try:
        result_api = run_command(
            [npm_command(), "run", "lint"],
            cwd=menu_ctx.api_dir,
            check=False,
            capture_output=True,
        )
        if result_api.returncode != 0:
            out = (result_api.stdout or "") + (result_api.stderr or "")
            log_error(f"Lint API falhou: {out[:500]}")
            save_artifact(menu_ctx, out, "lint-api-errors.log", "pre-stack", artifact_dir)
            raise RuntimeError("Lint API falhou. Verifique os logs em artifacts.")
        log_output("✅ Lint API: OK")
        result_web = run_command(
            [npm_command(), "run", "lint"],
            cwd=menu_ctx.web_dir,
            check=False,
            capture_output=True,
        )
        if result_web.returncode != 0:
            out = (result_web.stdout or "") + (result_web.stderr or "")
            log_error(f"Lint Web falhou: {out[:500]}")
            save_artifact(menu_ctx, out, "lint-web-errors.log", "pre-stack", artifact_dir)
            raise RuntimeError("Lint Web falhou. Verifique os logs em artifacts.")
        log_output("✅ Lint Web: OK")
    except RuntimeError:
        raise
    except Exception as e:
        log_error(f"Erro ao executar lint: {e}")
        raise
    
    # 2. Type-check (por workspace; apenas web tem script typecheck; a raiz não tem)
    log_output("🔍 Executando type-check...")
    try:
        # API não tem script typecheck no package.json; Web tem
        result_web = run_command(
            [npm_command(), "run", "typecheck"],
            cwd=menu_ctx.web_dir,
            check=False,
            capture_output=True,
        )
        if result_web.returncode != 0:
            log_error(f"Type-check Web falhou: {result_web.stderr}")
            save_artifact(menu_ctx, result_web.stderr, "typecheck-web-errors.log", "pre-stack", artifact_dir)
            raise RuntimeError("Type-check Web falhou. Verifique os logs em artifacts.")
        log_output("✅ Type-check: OK")
    except RuntimeError:
        raise
    except Exception as e:
        log_error(f"Erro ao executar type-check: {e}")
        raise
    
    # 3. Build
    log_output("🔨 Executando build...")
    try:
        # Build API
        result_api = run_command(
            [npm_command(), "run", "build"],
            cwd=menu_ctx.api_dir,
            check=False,
            capture_output=True,
        )
        if result_api.returncode != 0:
            log_error(f"Build API falhou: {result_api.stderr}")
            save_artifact(menu_ctx, result_api.stderr, "build-api-errors.log", "pre-stack", artifact_dir)
            raise RuntimeError("Build API falhou. Verifique os logs em artifacts.")
        
        # Build Web
        result_web = run_command(
            [npm_command(), "run", "build"],
            cwd=menu_ctx.web_dir,
            check=False,
            capture_output=True,
        )
        if result_web.returncode != 0:
            log_error(f"Build Web falhou: {result_web.stderr}")
            save_artifact(menu_ctx, result_web.stderr, "build-web-errors.log", "pre-stack", artifact_dir)
            raise RuntimeError("Build Web falhou. Verifique os logs em artifacts.")
        
        log_output("✅ Build: OK")
    except RuntimeError:
        raise
    except Exception as e:
        log_error(f"Erro ao executar build: {e}")
        raise
    
    # Salva log completo das validações
    validation_summary = "\n".join(validation_logs)
    save_artifact(menu_ctx, validation_summary, "validation-summary.log", "pre-stack", artifact_dir)
    
    if validation_errors:
        error_summary = "\n".join(validation_errors)
        save_artifact(menu_ctx, error_summary, "validation-errors.log", "pre-stack", artifact_dir)


def _cleanup_residual_containers(menu_ctx: MenuContext, compose: dict) -> None:
    """Finaliza containers residuais"""
    safe_docker_command(
        menu_ctx,
        ["compose", "-f", compose["compose_relative"], "down", "--remove-orphans"],
        compose["docker_env"],
        ignore_errors=True,
    )
    safe_docker_command(
        menu_ctx,
        ["rm", "-f", "wallethub_postgres", "wallethub_redis", "wallethub_adminer", "wallethub_api", "wallethub_web"],
        compose["docker_env"],
        ignore_errors=True,
    )


def _wait_for_postgres(menu_ctx: MenuContext, compose: dict) -> None:
    """Aguarda Postgres estar pronto"""
    wait_for_container_healthy(
        menu_ctx,
        compose["compose_relative"],
        "postgres",
        compose["docker_env"],
        40,
        3000,
        True,
    )
    
    # Verifica se Postgres aceita conexões
    try:
        run_command(
            [
                "docker",
                "compose",
                "-f",
                compose["compose_relative"],
                "exec",
                "-T",
                "postgres",
                "pg_isready",
                "-U",
                compose["docker_env"].get("POSTGRES_USER", "wallethub"),
            ],
            cwd=menu_ctx.project_root,
            env=compose["docker_env"],
            check=True,
            capture_output=True,
        )
    except Exception:
        raise RuntimeError(
            "Postgres está rodando mas não aceita conexões. "
            f"Verifique os logs: docker compose -f {compose['compose_relative']} logs postgres"
        )


def _run_migrations(menu_ctx: MenuContext, compose: dict) -> None:
    """Executa migrations"""
    try:
        exec_wallethub_safe(
            ["db", "migration", "run", "--env", compose["env_name"]],
            menu_ctx,
            check=True,
        )
    except Exception as e:
        error_msg = str(e)
        raise RuntimeError(f"Falha ao executar migrations: {error_msg}")


def _wait_for_api(menu_ctx: MenuContext, compose: dict) -> None:
    """Aguarda API estar pronta: liveness (/api/health/live) depois readiness (/api/health)."""
    wait_for_container_healthy(
        menu_ctx,
        compose["compose_relative"],
        "api",
        compose["docker_env"],
        90,
        2000,
        False,
    )

    print(f"⏳ Aguardando API iniciar ({API_INITIAL_DELAY_MS / 1000}s)...")
    time.sleep(API_INITIAL_DELAY_MS / 1000.0)

    api_url = get_api_url(compose["docker_env"])
    logs_cmd_hint = f"docker compose -f {compose['compose_relative']} logs api"

    try:
        # Fase 1: liveness (processo a aceitar HTTP)
        wait_for_service_ready(
            api_url, "API", "/api/health/live", 200, API_LIVENESS_TIMEOUT_MS
        )
        # Fase 2: readiness (DB, Redis, filas OK)
        wait_for_service_ready(
            api_url, "API", "/api/health", 200, API_READINESS_TIMEOUT_MS
        )
        print("✅ API está respondendo corretamente")
    except Exception as e:
        print("\n⚠️  API não ficou pronta. Verificando logs para diagnóstico...")
        logs = get_container_logs(
            menu_ctx, compose["compose_relative"], "api", compose["docker_env"], 80
        )
        suggestions = []
        for _pattern, suggestion in match_api_startup_errors(logs):
            suggestions.append(suggestion)
        show_container_logs(
            menu_ctx, compose["compose_relative"], "api", compose["docker_env"], 80
        )
        total_s = (
            API_INITIAL_DELAY_MS + API_LIVENESS_TIMEOUT_MS + API_READINESS_TIMEOUT_MS
        ) // 1000
        msg = (
            f"API não respondeu em até {total_s}s. "
            f"Comando para logs completos: {logs_cmd_hint}"
        )
        if "responde com HTTP 5" in str(e):
            msg = f"{e} {msg}"
        if suggestions:
            uniq = "\n".join(f"  • {s}" for s in dict.fromkeys(suggestions))
            msg = f"Detetado nos logs:\n{uniq}\n\n{msg}"
        raise RuntimeError(msg)


def _apply_seed(menu_ctx: MenuContext, compose: dict) -> None:
    """Aplica seed no banco (Base + Mock)"""
    try:
        # 1. Base (Idempotente)
        print("🌱 Aplicando seed base...")
        exec_wallethub_safe(
            ["db", "seed", "--env", compose["env_name"], "--file", "ops/dev/seeds/base.sql"],
            menu_ctx,
            check=True,
        )
        
        # 2. Mock
        print("🌱 Aplicando mock data...")
        exec_wallethub_safe(
            ["db", "seed", "--env", compose["env_name"], "--file", "ops/dev/seeds/mock-dev.sql"],
            menu_ctx,
            check=True,
        )
    except Exception as e:
        raise RuntimeError(f"Falha ao aplicar seed: {e}")


def _should_apply_seed(menu_ctx: MenuContext, compose: dict) -> bool:
    """
    Verifica se o seed deve ser aplicado automaticamente.

    Heurística simples e KISS:
    - Executa `select count(*) from users;` via psql no container Postgres
    - Se a contagem for 0, considera banco vazio e aplica seed
    - Se houver erro ou contagem > 0, não aplica seed automaticamente
    """
    try:
        result = run_command(
            [
                "docker",
                "compose",
                "-f",
                compose["compose_relative"],
                "exec",
                "-T",
                "postgres",
                "psql",
                "-U",
                compose["docker_env"].get("POSTGRES_USER", "wallethub"),
                "-d",
                compose["docker_env"].get("POSTGRES_DB", "wallethub"),
                "-t",
                "-A",
                "-c",
                "select count(*) from transactions;",
            ],
            cwd=menu_ctx.project_root,
            env=compose["docker_env"],
            check=True,
            capture_output=True,
        )
    except Exception as e:
        print(
            f"⚠️  Não foi possível verificar automaticamente se o banco precisa de seed: {e}. "
            "Seed automático será pulado (use `wallethub db seed` manualmente se necessário)."
        )
        return False

    output = (result.stdout or "").strip()
    lines = [line for line in output.splitlines() if line.strip()]
    last_line = lines[-1] if lines else ""

    try:
        count = int(last_line)
    except ValueError:
        print(
            "⚠️  Não foi possível interpretar a contagem de registros em users "
            f"(saída: {output!r}). Seed automático será pulado."
        )
        return False

    if count == 0:
        print("🌱 Tabela transactions está vazia. Seed será aplicado automaticamente.")
        return True

    print(f"ℹ️ Tabela transactions já possui {count} registro(s). Seed automático será pulado.")
    return False


def _wait_for_frontend(menu_ctx: MenuContext, compose: dict) -> None:
    """Aguarda Frontend estar pronto"""
    wait_for_container_healthy(
        menu_ctx,
        compose["compose_relative"],
        "web",
        compose["docker_env"],
        5,
        1000,
        False,
    )
    
    print("⏳ Aguardando Vite dev server iniciar (15s)...")
    time.sleep(15)
    
    try:
        frontend_url = get_frontend_url(compose["docker_env"])
        wait_for_service_ready(frontend_url, "Frontend", "/", 200, 15000)
        print("✅ Frontend está respondendo corretamente")
    except Exception:
        print("\n⚠️  Frontend não respondeu. Verificando logs...")
        show_container_logs(menu_ctx, compose["compose_relative"], "web", compose["docker_env"], 30)
        raise


def _run_post_stack_tests(menu_ctx: MenuContext, compose: dict, artifact_dir: Path) -> None:
    """Executa testes pós-stack (100% de sucesso obrigatório)"""
    test_logs = []
    test_errors = []
    
    def log_output(msg: str):
        test_logs.append(msg)
        print(msg)
    
    def log_error(msg: str):
        test_errors.append(msg)
        test_logs.append(f"ERROR: {msg}")
        print(f"❌ {msg}")
    
    # Healthcheck API
    log_output("🏥 Executando healthcheck da API...")
    try:
        api_url = get_api_url(compose["docker_env"])
        wait_for_service_ready(api_url, "API", "/api/health", 200, 10000)
        log_output("✅ API healthcheck: OK")
    except Exception as e:
        error_msg = f"API healthcheck: FALHOU - {e}"
        log_error(error_msg)
        save_artifact(menu_ctx, str(e), "api-healthcheck-error.log", "post-stack", artifact_dir)
        raise RuntimeError(f"❌ {error_msg}")
    
    # Healthcheck Frontend
    log_output("🏥 Executando healthcheck do Frontend...")
    try:
        frontend_url = get_frontend_url(compose["docker_env"])
        wait_for_service_ready(frontend_url, "Frontend", "/", 200, 10000)
        log_output("✅ Frontend healthcheck: OK")
    except Exception as e:
        error_msg = f"Frontend healthcheck: FALHOU - {e}"
        log_error(error_msg)
        save_artifact(menu_ctx, str(e), "frontend-healthcheck-error.log", "post-stack", artifact_dir)
        raise RuntimeError(f"❌ {error_msg}")
    
    # Testes unitários (se disponíveis; API usa script "test", não "test:unit")
    log_output("🧪 Executando testes unitários...")
    try:
        # Executa testes unitários da API (script "test" em apps/api/package.json)
        result_api = run_command(
            [npm_command(), "run", "test"],
            cwd=menu_ctx.api_dir,
            check=False,
            capture_output=True,
        )
        if result_api.returncode == 0:
            log_output("✅ Testes unitários API: OK")
        else:
            log_error(f"Testes unitários API falharam: {result_api.stderr}")
            save_artifact(menu_ctx, result_api.stderr, "test-unit-api-errors.log", "post-stack", artifact_dir)
            raise RuntimeError("Testes unitários API falharam. 100% de sucesso obrigatório.")
    except RuntimeError:
        raise
    except Exception:
        # Se o comando não existe, apenas avisa
        log_output("⚠️  Comando 'test' não encontrado, pulando testes unitários")
    
    # Testes E2E (se disponíveis)
    log_output("🧪 Executando testes E2E...")
    try:
        # Tenta executar testes E2E da API
        result_e2e = run_command(
            [npm_command(), "run", "test:e2e"],
            cwd=menu_ctx.api_dir,
            check=False,
            capture_output=True,
        )
        if result_e2e.returncode == 0:
            log_output("✅ Testes E2E API: OK")
        else:
            log_error(f"Testes E2E API falharam: {result_e2e.stderr}")
            save_artifact(menu_ctx, result_e2e.stderr, "test-e2e-api-errors.log", "post-stack", artifact_dir)
            raise RuntimeError("Testes E2E API falharam. 100% de sucesso obrigatório.")
    except RuntimeError:
        raise
    except Exception:
        # Se o comando não existe, apenas avisa
        log_output("⚠️  Comando 'test:e2e' não encontrado, pulando testes E2E")
    
    # Salva log completo dos testes
    test_summary = "\n".join(test_logs)
    save_artifact(menu_ctx, test_summary, "test-summary.log", "post-stack", artifact_dir)
    
    if test_errors:
        error_summary = "\n".join(test_errors)
        save_artifact(menu_ctx, error_summary, "test-errors.log", "post-stack", artifact_dir)
        raise RuntimeError("Testes falharam. 100% de sucesso obrigatório.")


def workflow_dev_stop(menu_ctx: MenuContext, env_name: str, remove_volumes: bool = False) -> None:
    """Para stack mantendo ou removendo volumes"""
    compose = resolve_compose_context(menu_ctx, env_name)
    
    args = ["compose", "-f", compose["compose_relative"], "down", "--remove-orphans"]
    if remove_volumes:
        args.append("--volumes")
    
    execute_steps(
        f"Encerrando ambiente {compose['env_name']}",
        [
            {
                "label": "Derrubando stack" + (" e removendo volumes" if remove_volumes else ""),
                "action": lambda: safe_docker_command(menu_ctx, args, compose["docker_env"], ignore_errors=True),
            },
        ],
    )


def workflow_dev_reset(menu_ctx: MenuContext, env_name: str) -> None:
    """Para stack removendo volumes e dados em bind mounts (postgres/redis)."""
    workflow_dev_stop(menu_ctx, env_name, remove_volumes=True)
    compose = resolve_compose_context(menu_ctx, env_name)
    compose_path = menu_ctx.resolve_project_path(*Path(compose["compose_relative"]).parts)
    compose_dir = compose_path.parent
    for subdir in ("postgres", "redis"):
        bind_mount = compose_dir / "volumes" / subdir
        if bind_mount.exists():
            try:
                shutil.rmtree(bind_mount)
            except OSError:
                pass

