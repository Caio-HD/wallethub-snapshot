"""Comando db - Gerenciamento de banco de dados"""

import typer
from typer import Typer, Option

from wallethub.context import MenuContext
from wallethub.utils.run import run_command
from wallethub.utils.environment import (
    load_environment_definition,
    build_docker_environment,
    sync_env_derived_files,
)
from pathlib import Path
from wallethub.config import DEV_COMPOSE_RELATIVE

app = Typer(name="db", help="Gerencia o ecossistema local de banco de dados (Postgres/Redis)")


def get_environment_and_compose(
    ctx: typer.Context, env_name: str = "personal"
) -> tuple:
    """Obtém definição de ambiente e caminho do compose"""
    menu_ctx: MenuContext = ctx.obj
    sync_env_derived_files(menu_ctx, env_name)
    environment = load_environment_definition(menu_ctx, env_name)
    compose_relative = environment.compose_file or str(DEV_COMPOSE_RELATIVE)
    compose_path = menu_ctx.resolve_project_path(*Path(compose_relative).parts)
    
    if not compose_path.exists():
        raise typer.BadParameter(
            f"Arquivo {compose_relative} não encontrado. Execute o setup primeiro."
        )
    
    return environment, compose_relative


@app.command()
def up(
    ctx: typer.Context,
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
    attach: bool = Option(False, "-a", "--attach", help="Mantém Docker attachado"),
) -> None:
    """Sobe os serviços Postgres/Redis/Adminer via Docker Compose"""
    menu_ctx: MenuContext = ctx.obj
    environment, compose_relative = get_environment_and_compose(ctx, env)
    
    args = ["compose", "-f", compose_relative, "up"]
    if not attach:
        args.append("-d")
    
    run_command(
        ["docker"] + args,
        cwd=menu_ctx.project_root,
        env=build_docker_environment(environment),
        check=True,
    )


@app.command()
def down(
    ctx: typer.Context,
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
    volumes: bool = Option(False, "-v", "--volumes", help="Remove volumes associados"),
) -> None:
    """Derruba os serviços e opcionalmente remove volumes persistentes"""
    menu_ctx: MenuContext = ctx.obj
    environment, compose_relative = get_environment_and_compose(ctx, env)
    
    args = ["compose", "-f", compose_relative, "down"]
    if volumes:
        args.append("--volumes")
    
    run_command(
        ["docker"] + args,
        cwd=menu_ctx.project_root,
        env=build_docker_environment(environment),
        check=True,
    )


@app.command()
def psql(
    ctx: typer.Context,
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
    database: str = Option(None, "-d", "--database", help="Database alvo"),
    user: str = Option(None, "-U", "--user", help="Usuário do Postgres"),
    command: str = Option(None, "-c", "--command", help="Comando SQL a executar"),
) -> None:
    """Abre o cliente psql conectado ao Postgres do stack"""
    menu_ctx: MenuContext = ctx.obj
    environment, compose_relative = get_environment_and_compose(ctx, env)
    
    db_name = database or environment.database.name or "wallethub"
    db_user = user or environment.database.user or "wallethub"
    
    args = [
        "compose",
        "-f",
        compose_relative,
        "exec",
        "postgres",
        "psql",
        "-U",
        db_user,
        db_name,
    ]
    
    if command:
        args.extend(["-c", command])
    
    run_command(
        ["docker"] + args,
        cwd=menu_ctx.project_root,
        env=build_docker_environment(environment),
        check=True,
    )


@app.command()
def diagnose(
    ctx: typer.Context,
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
) -> None:
    """Diagnóstico do banco de dados"""
    menu_ctx: MenuContext = ctx.obj
    environment, compose_relative = get_environment_and_compose(ctx, env)
    
    print(f"\n🔍 Diagnóstico do banco de dados ({environment.name})")
    print("=" * 60)
    
    # Verifica se container está rodando
    try:
        run_command(
            ["docker", "compose", "-f", compose_relative, "ps", "postgres"],
            cwd=menu_ctx.project_root,
            check=True,
        )
    except Exception as e:
        print(f"⚠️  Erro ao verificar container: {e}")
        return
    
    # Lista tabelas
    try:
        result = run_command(
            [
                "docker",
                "compose",
                "-f",
                compose_relative,
                "exec",
                "-T",
                "postgres",
                "psql",
                "-U",
                environment.database.user,
                "-d",
                environment.database.name,
                "-c",
                "\\dt",
            ],
            cwd=menu_ctx.project_root,
            env=build_docker_environment(environment),
            check=True,
            capture_output=True,
        )
        print("\n📋 Tabelas:")
        print(result.stdout)
    except Exception as e:
        print(f"⚠️  Erro ao listar tabelas: {e}")
    
    print("\n✅ Diagnóstico concluído.")


@app.command()
def backup(
    ctx: typer.Context,
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
    output: str = Option(None, "-o", "--output", help="Nome do arquivo de saída"),
    plain: bool = Option(False, "--plain", help="Gera backup em formato SQL simples"),
) -> None:
    """Gera um backup do banco Postgres"""
    menu_ctx: MenuContext = ctx.obj
    environment, compose_relative = get_environment_and_compose(ctx, env)
    
    from datetime import datetime
    
    timestamp = datetime.now().isoformat().replace(":", "-").replace(".", "-")
    extension = "sql" if plain else "dump"
    filename = output or f"backup-{environment.name}-{environment.database.name}-{timestamp}.{extension}"
    
    compose_dir = Path(compose_relative).parent
    container_target = f"/var/backups/{filename}"
    
    args = [
        "compose",
        "-f",
        compose_relative,
        "exec",
        "-T",
        "postgres",
        "pg_dump",
        "-U",
        environment.database.user,
        "-d",
        environment.database.name,
    ]
    
    if plain:
        args.extend(["-F", "p"])
    else:
        args.extend(["-F", "c"])
    
    args.extend(["-f", container_target])
    
    docker_env = build_docker_environment(environment)
    docker_env["PGPASSWORD"] = environment.database.password
    
    run_command(
        ["docker"] + args,
        cwd=menu_ctx.project_root,
        env=docker_env,
        check=True,
    )
    
    if compose_dir and compose_dir != Path("."):
        host_path = menu_ctx.resolve_project_path(*compose_dir.parts, "backups", "postgres", filename)
    else:
        host_path = menu_ctx.resolve_project_path("backups", "postgres", filename)
    
    print(f"📦 Backup salvo em {host_path}")


@app.command()
def seed(
    ctx: typer.Context,
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
    file: str = Option("ops/dev/seeds/base.sql", "-f", "--file", help="Arquivo SQL relativo ao repositório"),
    force: bool = Option(False, "--force", help="Força a execução em ambiente de produção"),
) -> None:
    """Executa um script SQL local dentro do Postgres do stack"""
    menu_ctx: MenuContext = ctx.obj
    environment, compose_relative = get_environment_and_compose(ctx, env)
    
    # Validação de ambiente
    is_prod = getattr(environment, "environment", None) == "production" or env == "production"
    if is_prod and not force:
        print(f"⚠️  ALERTA: O ambiente '{env}' está marcado como PRODUÇÃO.")
        print("Executar seeds em produção pode sobrescrever dados reais ou causar duplicidade.")
        print("Se você tem certeza do que está fazendo, use a flag --force.")
        raise typer.Exit(code=1)

    seed_path = menu_ctx.resolve_project_path(*Path(file).parts)
    if not seed_path.exists():
        raise typer.BadParameter(f"Arquivo de seed não encontrado: {seed_path}")
    
    # Executa seed via stdin para evitar problemas de cópia/permissão
    docker_env = build_docker_environment(environment)
    docker_env["PGPASSWORD"] = environment.database.password
    
    with open(seed_path, "r", encoding="utf-8") as f:
        seed_content = f.read()

    run_command(
        [
            "docker",
            "compose",
            "-f",
            compose_relative,
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            environment.database.user,
            environment.database.name,
        ],
        input=seed_content,
        cwd=menu_ctx.project_root,
        env=docker_env,
        check=True,
    )
    
    print(f"🌱 Seed executado com sucesso a partir de {seed_path}")


# Criar subcomando para migrations
migration_app = Typer(name="migration", help="Comandos de migration TypeORM")
app.add_typer(migration_app)


@migration_app.command("run")
def migration_run(
    ctx: typer.Context,
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
) -> None:
    """Executa migrations TypeORM pendentes no banco de dados"""
    menu_ctx: MenuContext = ctx.obj
    environment, _ = get_environment_and_compose(ctx, env)
    
    api_dist_dir = menu_ctx.api_dir / "dist"
    if not api_dist_dir.exists():
        raise typer.BadParameter(
            f"Diretório dist/ da API não encontrado. Execute 'wallethub setup' primeiro."
        )
    
    from urllib.parse import quote
    
    docker_env = build_docker_environment(environment)
    db_host = environment.database.host or "localhost"
    
    if not environment.database.port:
        raise typer.BadParameter(
            f"Porta do banco não especificada no ambiente '{environment.name}'. "
            f"Verifique config/envs/{environment.name}.json"
        )
    
    db_port = environment.database.port
    
    env_vars = {
        **docker_env,
        "DB_HOST": db_host,
        "DB_PORT": str(db_port),
        "DB_USER": environment.database.user,
        "DB_PASSWORD": environment.database.password,
        "DB_NAME": environment.database.name,
        "DB_SSL": "false",
        "DATABASE_URL": docker_env.get(
            "DATABASE_URL",
            f"postgresql://{environment.database.user}:{quote(environment.database.password)}@{db_host}:{db_port}/{environment.database.name}",
        ),
        "NODE_ENV": "development",
        "TYPEORM_LOGGING": "false",
    }

    # Executa migrations: node diretamente para garantir que o env (DB_*, DATABASE_URL) chegue
    # ao processo Node no Windows (npm.cmd pode não repassar o ambiente ao filho)
    run_command(
        ["node", "scripts/run-migrations.js"],
        cwd=menu_ctx.api_dir,
        env=env_vars,
        check=True,
    )
    
    print("✅ Migrations executadas com sucesso.")


@migration_app.command("revert")
def migration_revert(
    ctx: typer.Context,
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
) -> None:
    """Reverte a última migration TypeORM"""
    menu_ctx: MenuContext = ctx.obj
    environment, _ = get_environment_and_compose(ctx, env)
    
    from urllib.parse import quote
    
    docker_env = build_docker_environment(environment)
    db_host = environment.database.host or "localhost"
    db_port = environment.database.port or 5432
    
    env_vars = {
        **docker_env,
        "DB_HOST": db_host,
        "DB_PORT": str(db_port),
        "DB_USER": environment.database.user,
        "DB_PASSWORD": environment.database.password,
        "DB_NAME": environment.database.name,
        "DATABASE_URL": docker_env.get(
            "DATABASE_URL",
            f"postgresql://{environment.database.user}:{quote(environment.database.password)}@{db_host}:{db_port}/{environment.database.name}",
        ),
    }
    
    from wallethub.utils.platform import npm_command
    
    run_command(
        [npm_command(), "run", "migration:revert"],
        cwd=menu_ctx.api_dir,
        env=env_vars,
        check=True,
    )
    
    print("✅ Última migration revertida com sucesso.")


@migration_app.command("generate")
def migration_generate(
    ctx: typer.Context,
    name: str = typer.Argument(..., help="Nome da migration"),
    env: str = Option("personal", "-e", "--env", help="Ambiente configurado"),
) -> None:
    """Gera uma nova migration TypeORM"""
    menu_ctx: MenuContext = ctx.obj
    environment, _ = get_environment_and_compose(ctx, env)
    
    from urllib.parse import quote
    
    docker_env = build_docker_environment(environment)
    db_host = environment.database.host or "localhost"
    db_port = environment.database.port or 5432
    
    env_vars = {
        **docker_env,
        "DB_HOST": db_host,
        "DB_PORT": str(db_port),
        "DB_USER": environment.database.user,
        "DB_PASSWORD": environment.database.password,
        "DB_NAME": environment.database.name,
        "DATABASE_URL": docker_env.get(
            "DATABASE_URL",
            f"postgresql://{environment.database.user}:{quote(environment.database.password)}@{db_host}:{db_port}/{environment.database.name}",
        ),
    }
    
    from wallethub.utils.platform import npm_command
    
    run_command(
        [npm_command(), "run", "migration:generate", "--", name],
        cwd=menu_ctx.api_dir,
        env=env_vars,
        check=True,
    )
    
    print(f"✅ Migration '{name}' gerada com sucesso.")

