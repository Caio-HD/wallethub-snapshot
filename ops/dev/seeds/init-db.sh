#!/bin/bash
# Legado: antes corria base.sql no primeiro init do Postgres.
# O schema passa a ser criado pelas migrations da API; o seed é aplicado com:
#   npm exec -- wallethub db seed
# (após `npm run migration:run` em apps/api ou com TYPEORM_MIGRATIONS_RUN no arranque da API.)
set -e
echo "ℹ️  Este script não aplica mais schema/seed. Use: wallethub db seed (com migrations já executadas)."
exit 0
