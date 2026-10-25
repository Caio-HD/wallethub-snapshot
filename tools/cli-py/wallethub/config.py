"""Configurações e constantes da CLI WalletHub"""

from pathlib import Path
from typing import Optional

# Caminhos relativos (a partir da raiz do projeto)
CI_COMPOSE_RELATIVE = Path("ops") / "ci" / "docker-compose.ci.yml"
CI_SCRIPT_RELATIVE = Path("ops") / "ci" / "run-all.sh"
DEV_COMPOSE_RELATIVE = Path("ops") / "dev" / "docker-compose.yml"
PROD_SCRIPT_RELATIVE = Path("ops") / "prod" / "deploy-local.sh"
PROD_ENV_RELATIVE = Path("ops") / "prod" / ".env.deploy"
CLOUDFLARED_DIR_RELATIVE = Path(".cloudflared")
CLOUDFLARED_CONFIG_RELATIVE = CLOUDFLARED_DIR_RELATIVE / "config.dev.yml"

# Diretórios das aplicações (fonte única: package.json workspaces)
APPS_API_RELATIVE = Path("apps") / "api"
APPS_WEB_RELATIVE = Path("apps") / "web"

# Diretórios de configuração
CONFIG_ENVS_RELATIVE = Path("config") / "envs"
SECRETS_JWT_RELATIVE = Path("secrets") / "jwt"

# Diretórios de artifacts
ARTIFACTS_DEV_PRE_STACK = Path("ops") / "dev" / "artifacts" / "pre-stack"
ARTIFACTS_DEV_POST_STACK = Path("ops") / "dev" / "artifacts" / "post-stack"
ARTIFACTS_CI = Path("ops") / "ci" / "artifacts"

# Timeouts e configurações
SERVICE_WAIT_TIMEOUT_MS = 20000  # 20 segundos (default)
SERVICE_WAIT_INTERVAL_MS = 1000  # 1 segundo
API_INITIAL_DELAY_MS = 10000  # 10 segundos
# Liveness: tempo máximo para o processo responder em GET /api/health/live
API_LIVENESS_TIMEOUT_MS = 90000  # 90 segundos
# Readiness: tempo máximo para GET /api/health retornar 200 após liveness OK
API_READINESS_TIMEOUT_MS = 30000  # 30 segundos
# Legado; comportamento do dev:start usa liveness + readiness
API_FIRST_START_TIMEOUT_MS = 300000  # 5 minutos (fallback)

# Configurações de JWT
JWT_DEFAULT_BITS = 4096
JWT_DEFAULT_KEEP_HISTORY = 5

# Configurações de artifacts
ARTIFACTS_KEEP_LAST = 10

# Configurações de ambiente padrão
DEFAULT_ENV = "personal"
PRODUCTION_ENV = "production"




