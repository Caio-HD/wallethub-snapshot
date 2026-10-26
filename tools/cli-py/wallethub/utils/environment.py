"""Gerenciamento de variáveis de ambiente e configurações"""

import json
import os
from pathlib import Path
from typing import Dict, Optional, Any
from urllib.parse import urlparse, quote

from wallethub.context import MenuContext


class EnvironmentDatabaseConfig:
    """Configuração de banco de dados"""

    def __init__(self, data: Dict[str, Any]):
        self.host: Optional[str] = data.get("host")
        self.port: Optional[int] = data.get("port")
        self.name: str = data["name"]
        self.user: str = data["user"]
        self.password: str = data["password"]


class EnvironmentRedisConfig:
    """Configuração de Redis"""

    def __init__(self, data: Optional[Dict[str, Any]]):
        if data:
            self.host: Optional[str] = data.get("host")
            self.port: Optional[int] = data.get("port")
            self.password: Optional[str] = data.get("password")
        else:
            self.host = None
            self.port = None
            self.password = None


class EnvironmentDefinition:
    """Definição completa de ambiente"""

    def __init__(self, data: Dict[str, Any]):
        self.name: str = data["name"]
        self.description: Optional[str] = data.get("description")
        self.compose_file: Optional[str] = data.get("composeFile")
        self.postgres_container_name: Optional[str] = data.get("postgresContainerName")
        self.database = EnvironmentDatabaseConfig(data["database"])
        self.redis = EnvironmentRedisConfig(data.get("redis"))


def _parse_env_file(path: Path) -> Dict[str, str]:
    """
    Faz o parsing de um arquivo .env genérico em um dicionário de chaves/valores.
    """
    vars_dict: Dict[str, str] = {}

    if not path.exists():
        return vars_dict

    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            if not line or line.startswith("#") or "=" not in line:
                continue

            equal_index = line.index("=")
            key = line[:equal_index].strip()
            value = line[equal_index + 1 :].strip()

            if (value.startswith('"') and value.endswith('"')) or (
                value.startswith("'") and value.endswith("'")
            ):
                value = value[1:-1]

            if key:
                vars_dict[key] = value

    return vars_dict


def load_unified_env(context: MenuContext, env_name: str) -> Dict[str, str]:
    """
    Carrega variáveis de ambiente unificadas a partir de config/.env.*.

    - personal/development → config/.env.local
    - production → config/.env.production
    """
    normalized = env_name.lower()

    if normalized in ("personal", "development", "dev", "local"):
        filename = ".env.local"
    elif normalized in ("production", "prod"):
        filename = ".env.production"
    else:
        raise ValueError(
            f"Ambiente '{env_name}' não suportado para env unificado. "
            "Use 'personal' ou 'production'."
        )

    env_path = context.resolve_project_path("config", filename)

    if not env_path.exists():
        raise FileNotFoundError(
            f"Arquivo de ambiente unificado não encontrado: {env_path}. "
            f"Crie a partir de config/{filename}.example."
        )

    return _parse_env_file(env_path)


def serialize_env(env: Dict[str, str]) -> str:
    """
    Serializa dicionário de variáveis de ambiente para formato .env.
    """
    entries = [(k, v) for k, v in env.items() if isinstance(v, str) and v]
    entries.sort(key=lambda x: x[0])
    return "\n".join(f"{key}={value}" for key, value in entries) + "\n"


def _build_env_json_config(env_vars: Dict[str, str], env_name: str) -> Dict[str, Any]:
    """
    Constrói a estrutura JSON de config/envs/*.json a partir das variáveis do .env unificado.
    """
    normalized = env_name.lower()
    if normalized in ("personal", "development", "dev", "local"):
        name = "personal"
        description = "Ambiente pessoal executando no servidor local com Docker Compose"
        compose_file = "ops/dev/docker-compose.yml"
        default_db_port = 30332
        default_redis_port = 30379
        default_db_password = "wallethub"
    elif normalized in ("production", "prod"):
        name = "production"
        description = "Ambiente de produção"
        compose_file = "ops/prod/docker-compose.yml"
        default_db_port = 55432
        default_redis_port = 56379
        default_db_password = "change_me"
    else:
        raise ValueError(f"Ambiente '{env_name}' não suportado. Use 'personal' ou 'production'.")

    db_name = env_vars.get("DB_NAME", "wallethub")
    db_user = env_vars.get("DB_USER", "wallethub")
    db_password = env_vars.get("DB_PASSWORD", default_db_password)
    db_host = env_vars.get("DB_HOST", "localhost")
    db_port = int(env_vars.get("DB_PORT", str(default_db_port)))

    redis_host = env_vars.get("REDIS_HOST", "localhost")
    redis_port = int(env_vars.get("REDIS_PORT", str(default_redis_port)))

    config: Dict[str, Any] = {
        "name": name,
        "description": description,
        "composeFile": compose_file,
        "database": {
            "host": db_host,
            "port": db_port,
            "name": db_name,
            "user": db_user,
            "password": db_password,
        },
        "redis": {
            "host": redis_host,
            "port": redis_port,
        },
    }
    if env_vars.get("REDIS_PASSWORD"):
        config["redis"]["password"] = env_vars["REDIS_PASSWORD"]
    return config


def sync_env_derived_files(context: MenuContext, env_name: str) -> None:
    """
    Sincroniza arquivos derivados a partir do .env unificado em config/.

    - personal: lê config/.env.local, escreve config/envs/personal.json
    - production: lê config/.env.production, escreve config/envs/production.json e ops/prod/.env.deploy

    Se o .env unificado não existir, levanta FileNotFoundError (não cria arquivos com defaults).
    Idempotente: pode ser chamada várias vezes.
    """
    env_vars = load_unified_env(context, env_name)
    config = _build_env_json_config(env_vars, env_name)

    env_path = context.resolve_environment_path(config["name"])
    env_path.parent.mkdir(parents=True, exist_ok=True)
    env_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    if config["name"] == "production":
        deploy_path = context.resolve_project_path("ops", "prod", ".env.deploy")
        deploy_path.parent.mkdir(parents=True, exist_ok=True)
        deploy_path.write_text(serialize_env(env_vars), encoding="utf-8")


def load_environment_definition(context: MenuContext, env_name: str) -> EnvironmentDefinition:
    """
    Carrega definição de ambiente de um arquivo JSON.
    
    Args:
        context: Contexto da CLI
        env_name: Nome do ambiente (ex: 'personal', 'production')
    
    Returns:
        EnvironmentDefinition carregada
    
    Raises:
        FileNotFoundError: Se arquivo não existir
        ValueError: Se configuração estiver incompleta ou inválida
    """
    env_path = context.resolve_environment_path(env_name)

    if not env_path.exists():
        raise FileNotFoundError(f'Ambiente "{env_name}" não encontrado em config/envs.')
    
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f'Falha ao parsear JSON do ambiente "{env_name}": {e}')

    # Validação básica
    if not data.get("database") or not all(
        key in data["database"] for key in ["name", "user", "password"]
    ):
        raise ValueError("Configuração de banco de dados incompleta.")

    return EnvironmentDefinition(data)


def build_docker_environment(definition: EnvironmentDefinition) -> Dict[str, str]:
    """
    Constrói variáveis de ambiente para Docker a partir de uma definição.
    
    Args:
        definition: Definição de ambiente
    
    Returns:
        Dicionário com variáveis de ambiente
    """
    env: Dict[str, str] = {
        "WALLETHUB_ENV": definition.name,
        "POSTGRES_DB": definition.database.name,
        "POSTGRES_USER": definition.database.user,
        "POSTGRES_PASSWORD": definition.database.password,
    }

    if definition.database.host:
        env["POSTGRES_HOST"] = definition.database.host
    if definition.database.port:
        env["POSTGRES_PORT"] = str(definition.database.port)

    if definition.redis:
        if definition.redis.host:
            env["REDIS_HOST"] = definition.redis.host
        if definition.redis.port:
            env["REDIS_PORT"] = str(definition.redis.port)
        if definition.redis.password:
            env["REDIS_PASSWORD"] = definition.redis.password

    # Constrói DATABASE_URL se host e port estão definidos
    if definition.database.host and definition.database.port:
        encoded_password = quote(definition.database.password, safe="")
        env["DATABASE_URL"] = (
            f"postgresql://{definition.database.user}:{encoded_password}"
            f"@{definition.database.host}:{definition.database.port}/{definition.database.name}"
        )

    return env


def load_env_file(context: MenuContext) -> Dict[str, str]:
    """
    Carrega variáveis de ambiente do arquivo .env.deploy.
    
    Args:
        context: Contexto da CLI
    
    Returns:
        Dicionário com variáveis de ambiente
    """
    defaults: Dict[str, str] = {
        "DB_NAME": "wallethub",
        "DB_USER": "wallethub",
        "DB_PASSWORD": "change_me",
    }
    
    # Tenta ler do caminho padrão
    env_file_path = context.resolve_deploy_env_path()
    
    # Se não existir, tenta ler da variável ENV_FILE
    if not env_file_path.exists():
        env_file = os.environ.get("ENV_FILE")
        if env_file and Path(env_file).exists():
            env_file_path = Path(env_file)
        else:
            return defaults
    
    # Lê e parseia arquivo .env
    vars_dict: Dict[str, str] = {**defaults}
    
    try:
        raw_vars = _parse_env_file(env_file_path)

        for key, value in raw_vars.items():
            # Extrai variáveis relevantes
            if key in ("DB_NAME", "POSTGRES_DB"):
                vars_dict["DB_NAME"] = value
            elif key in ("DB_USER", "POSTGRES_USER"):
                vars_dict["DB_USER"] = value
            elif key in ("DB_PASSWORD", "POSTGRES_PASSWORD"):
                vars_dict["DB_PASSWORD"] = value
            elif key == "DATABASE_URL":
                vars_dict["DATABASE_URL"] = value
            elif key == "REDIS_URL":
                vars_dict["REDIS_URL"] = value
            elif key == "REDIS_HOST":
                vars_dict["REDIS_HOST"] = value
            elif key == "REDIS_PORT":
                vars_dict["REDIS_PORT"] = value
            elif key == "REDIS_PASSWORD":
                vars_dict["REDIS_PASSWORD"] = value
        
        # Se DATABASE_URL existir, tenta extrair credenciais se não foram definidas individualmente
        if "DATABASE_URL" in vars_dict:
            try:
                url = urlparse(vars_dict["DATABASE_URL"])
                if vars_dict.get("DB_USER") == defaults["DB_USER"]:
                    vars_dict["DB_USER"] = url.username or vars_dict.get("DB_USER", defaults["DB_USER"])
                if vars_dict.get("DB_PASSWORD") == defaults["DB_PASSWORD"]:
                    vars_dict["DB_PASSWORD"] = (
                        url.password if url.password else vars_dict.get("DB_PASSWORD", defaults["DB_PASSWORD"])
                    )
                if vars_dict.get("DB_NAME") == defaults["DB_NAME"]:
                    vars_dict["DB_NAME"] = url.path.lstrip("/") or vars_dict.get("DB_NAME", defaults["DB_NAME"])
            except Exception:
                pass  # Se não conseguir parsear, mantém valores já definidos
        
    except Exception as e:
        print(f"⚠️  Não foi possível ler o arquivo .env.deploy: {e}")
        return defaults
    
    return vars_dict




