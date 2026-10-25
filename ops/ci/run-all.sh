#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CI_DIR="$ROOT_DIR/ops/ci"
COMPOSE_FILE="$CI_DIR/docker-compose.ci.yml"
ARTIFACTS_DIR="$CI_DIR/artifacts"
COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")

# Em CI (GitHub Actions): habilita cache de build remoto (type=gha) via bake. O override de
# cache fica fora do compose base porque type=gha exige o backend de cache do Actions, ausente
# em builds locais (incluí-lo no base quebraria `docker compose build` fora do runner).
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  COMPOSE_CMD+=(-f "$CI_DIR/docker-compose.cache.yml")
  export COMPOSE_BAKE=true
fi

mkdir -p "$ARTIFACTS_DIR/api" "$ARTIFACTS_DIR/web" "$ARTIFACTS_DIR/diagnostics"

STATUS=0
SUMMARY=()

log_step() {
  printf '\n[ci] %s\n' "$1"
}

capture_logs() {
  "${COMPOSE_CMD[@]}" logs --no-color > "$ARTIFACTS_DIR/diagnostics/docker-compose.log" 2>&1 || true
}

print_summary() {
  local summary_file="$ARTIFACTS_DIR/diagnostics/summary.txt"
  {
    echo "WalletHub CI pipeline"
    echo "======================"
    for entry in "${SUMMARY[@]}"; do
      IFS='|' read -r label result <<<"$entry"
      printf ' - %-30s %s\n' "$label" "$result"
    done
    echo
    if [ "$STATUS" -eq 0 ]; then
      echo "Status geral: OK"
    else
      echo "Status geral: FALHA"
    fi
  } | tee "$summary_file"
}

run_step() {
  local label="$1"
  shift
  log_step "$label"
  if "$@"; then
    SUMMARY+=("$label|OK")
  else
    SUMMARY+=("$label|FAIL")
    STATUS=1
    # Fail-fast (PRs): para no primeiro erro para feedback rápido. Em main/push roda completo.
    if [ -n "${WALLETHUB_CI_FAIL_FAST:-}" ]; then
      log_step "fail-fast: abortando após falha em '$label'"
      capture_logs
      print_summary
      exit 1
    fi
  fi
}

cleanup() {
  "${COMPOSE_CMD[@]}" down --remove-orphans --volumes >/dev/null 2>&1 || true
}
trap cleanup EXIT

run_step "Pull base images" "${COMPOSE_CMD[@]}" pull postgres redis
run_step "Build API test image" "${COMPOSE_CMD[@]}" build api-ci
run_step "Build Web test image" "${COMPOSE_CMD[@]}" build web-ci

# Fast fail-closed signal: a mutating operator handler missing @PlatformAudit breaks the build here.
run_step "API audit-coverage guard" "${COMPOSE_CMD[@]}" run --rm api-ci npm run test:audit-guard
run_step "API lint" "${COMPOSE_CMD[@]}" run --rm api-ci npm run lint
run_step "API unit tests" "${COMPOSE_CMD[@]}" run --rm api-ci npm run test -- --runInBand --coverage --coverageDirectory=/artifacts/coverage-unit
run_step "API e2e tests" "${COMPOSE_CMD[@]}" run --rm api-ci npm run test:e2e -- --runInBand --detectOpenHandles --json --outputFile=/artifacts/jest-e2e-results.json
run_step "API build artifact" "${COMPOSE_CMD[@]}" run --rm api-ci bash -lc "set -euo pipefail; npm run build && tar -czf /artifacts/dist-api.tgz dist"

run_step "Web lint" "${COMPOSE_CMD[@]}" run --rm web-ci npm run lint
run_step "Web unit tests" "${COMPOSE_CMD[@]}" run --rm web-ci bash -lc "set -euo pipefail; rm -rf coverage && npm run test -- --run --coverage && mkdir -p /artifacts/coverage-unit && cp -r coverage/. /artifacts/coverage-unit/" # lint-allow-destructive: coverage efêmero dentro do container de CI
run_step "Web e2e tests" "${COMPOSE_CMD[@]}" run --rm web-ci bash -lc "set -euo pipefail; mkdir -p /artifacts/playwright && PLAYWRIGHT_JUNIT_OUTPUT_NAME=/artifacts/playwright/results.xml npm run test:e2e -- --reporter=line,junit --output=/artifacts/playwright/test-results"
run_step "Web build artifact" "${COMPOSE_CMD[@]}" run --rm web-ci bash -lc "set -euo pipefail; npm run build && tar -czf /artifacts/dist-web.tgz dist"

# Release artifacts (~3 min) só são consumidos pelo job Publish (push em main/develop). Em PRs
# (WALLETHUB_CI_RELEASE vazio) pulamos — economiza tempo e não bloqueia feedback. Rodam por último
# para não atrasar lint/test, que dão o sinal de erro mais cedo.
if [ -n "${WALLETHUB_CI_RELEASE:-}" ]; then
  run_step "Build release artifacts" "${COMPOSE_CMD[@]}" --profile release build
else
  log_step "Pulando release builds (PR — WALLETHUB_CI_RELEASE não definido)"
  SUMMARY+=("Build release artifacts|SKIP")
fi

if [ "$STATUS" -ne 0 ]; then
  log_step "Capturando logs para diagnóstico"
  capture_logs
fi

print_summary
exit "$STATUS"
