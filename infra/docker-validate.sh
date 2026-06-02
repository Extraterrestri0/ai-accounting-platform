#!/usr/bin/env bash
# Validate the container stack definition.
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v docker >/dev/null 2>&1; then
  echo "▶ docker compose config"; docker compose config >/dev/null && echo "✓ compose valid"
  echo "▶ building images"; docker compose build api web worker && echo "✓ images build"
else
  echo "docker not installed — validating compose YAML structurally"
  python3 - <<'PY'
import yaml; d=yaml.safe_load(open('docker-compose.yml'))
svcs=list(d['services']); req={'db','redis','minio','migrate','api','worker','web'}
assert req.issubset(set(svcs)), f"missing services: {req-set(svcs)}"
print('✓ compose YAML valid; services:', ', '.join(svcs))
PY
fi
