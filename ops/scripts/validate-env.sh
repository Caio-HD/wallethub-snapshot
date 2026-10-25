#!/usr/bin/env bash
#
# Script standalone para validação rápida de variáveis de ambiente
#
# Uso:
#   ./ops/scripts/validate-env.sh [--env-file /caminho/para/.env] [--strict]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${1:-}"
STRICT="${2:-}"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

log_ok() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++)) || true
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++)) || true
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Carregar variáveis de ambiente
if [[ -n "${ENV_FILE}" ]] && [[ -f "${ENV_FILE}" ]]; then
    log_info "Carregando variáveis de ${ENV_FILE}..."
    set -a
    source "${ENV_FILE}"
    set +a
elif [[ -n "${ENV_FILE}" ]]; then
    log_error "Arquivo não encontrado: ${ENV_FILE}"
    exit 1
fi

echo "🔍 Validando variáveis de ambiente..."
echo

# Valores padrão inseguros
UNSAFE_DEFAULTS=("change_me" "changeme" "dummy" "test" "password" "secret" "admin" "123456" "default" "example")

# Verificar variáveis obrigatórias
log_info "Verificando variáveis obrigatórias..."

if [[ -z "${JWT_PRIVATE_KEY:-}" ]]; then
    log_error "JWT_PRIVATE_KEY não definida"
else
    log_ok "JWT_PRIVATE_KEY definida"
    if [[ "${JWT_PRIVATE_KEY}" =~ (change_me|dummy|test|password|secret) ]]; then
        log_warn "JWT_PRIVATE_KEY contém valor padrão inseguro"
    fi
    if [[ ! "${JWT_PRIVATE_KEY}" =~ BEGIN ]]; then
        log_warn "JWT_PRIVATE_KEY não parece estar no formato PEM"
    fi
fi

if [[ -z "${JWT_PUBLIC_KEY:-}" ]]; then
    log_error "JWT_PUBLIC_KEY não definida"
else
    log_ok "JWT_PUBLIC_KEY definida"
    if [[ "${JWT_PUBLIC_KEY}" =~ (change_me|dummy|test|password|secret) ]]; then
        log_warn "JWT_PUBLIC_KEY contém valor padrão inseguro"
    fi
    if [[ ! "${JWT_PUBLIC_KEY}" =~ BEGIN ]]; then
        log_warn "JWT_PUBLIC_KEY não parece estar no formato PEM"
    fi
fi

# Verificar conexão de banco
log_info "Verificando conexão de banco de dados..."
if [[ -n "${DATABASE_URL:-}" ]]; then
    log_ok "DATABASE_URL definida"
    if [[ ! "${DATABASE_URL}" =~ ^postgres(ql)?:// ]]; then
        log_warn "DATABASE_URL não parece ser uma URL PostgreSQL válida"
    fi
elif [[ -n "${DB_HOST:-}" ]] && [[ -n "${DB_USER:-}" ]] && [[ -n "${DB_PASSWORD:-}" ]] && [[ -n "${DB_NAME:-}" ]]; then
    log_ok "Variáveis DB_* configuradas"
    if [[ "${DB_PASSWORD}" =~ (change_me|dummy|test|password|secret) ]]; then
        log_warn "DB_PASSWORD contém valor padrão inseguro"
    fi
else
    log_error "Conexão de banco não configurada (use DATABASE_URL ou DB_HOST/DB_USER/DB_PASSWORD/DB_NAME)"
fi

# Verificar conexão Redis
log_info "Verificando conexão Redis..."
if [[ -n "${REDIS_URL:-}" ]]; then
    log_ok "REDIS_URL definida"
elif [[ -n "${REDIS_HOST:-}" ]] || [[ -n "${REDIS_PORT:-}" ]]; then
    log_ok "Variáveis REDIS_* configuradas"
else
    log_warn "Conexão Redis não configurada (opcional, mas necessário para filas)"
fi

# Verificar outras variáveis sensíveis
log_info "Verificando outras variáveis sensíveis..."
SENSITIVE_VARS=("META_APP_SECRET" "WHATSAPP_ACCESS_TOKEN" "OPENAI_API_KEY" "REDIS_PASSWORD")

for VAR in "${SENSITIVE_VARS[@]}"; do
    if [[ -n "${!VAR:-}" ]]; then
        VALUE="${!VAR}"
        for UNSAFE in "${UNSAFE_DEFAULTS[@]}"; do
            if [[ "${VALUE,,}" =~ ${UNSAFE} ]]; then
                log_warn "${VAR} contém valor padrão inseguro"
                break
            fi
        done
    fi
done

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}✅ Validação concluída sem erros${NC}"
    exit 0
elif [[ $ERRORS -eq 0 ]]; then
    echo -e "${YELLOW}⚠️  Validação concluída com ${WARNINGS} aviso(s)${NC}"
    if [[ "${STRICT}" == "--strict" ]]; then
        exit 1
    fi
    exit 0
else
    echo -e "${RED}❌ Validação falhou com ${ERRORS} erro(s) e ${WARNINGS} aviso(s)${NC}"
    exit 1
fi

