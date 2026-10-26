#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

usage() {
  cat <<EOF
Uso: $(basename "$0") <comando>

Comandos disponíveis:
  up      Sobe os serviços em segundo plano
  down    Derruba os serviços mantendo volumes
  logs    Segue logs do Traefik, API e Web
  ps      Exibe status dos containers
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

COMMAND="$1"
shift || true

if [[ -z "${ENV_FILE:-}" ]]; then
  echo "[erro] Defina a variável ENV_FILE apontando para o .env.deploy real (ex.: export ENV_FILE=/etc/wallethub/.env.deploy)" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[erro] Arquivo $ENV_FILE não encontrado" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  DOCKER_CLI="docker"
elif command -v docker.exe >/dev/null 2>&1; then
  DOCKER_CLI="docker.exe"
else
  echo "[erro] Docker CLI não encontrado. Certifique-se de que o Docker Desktop esteja instalado e no PATH." >&2
  exit 1
fi

compose() {
  "$DOCKER_CLI" compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

case "$COMMAND" in
  up)
    compose up -d --build
    ;;
  down)
    compose down
    ;;
  logs)
    compose logs -f traefik api web
    ;;
  ps)
    compose ps
    ;;
  *)
    echo "[erro] Comando desconhecido: $COMMAND" >&2
    usage
    exit 1
    ;;
 esac
