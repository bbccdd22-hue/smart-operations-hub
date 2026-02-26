#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Installing backend Python dependencies"
python3 -m pip install -r "${ROOT_DIR}/backend/requirements.txt"

echo "==> Installing frontend Node dependencies"
npm ci --prefix "${ROOT_DIR}/frontend"

echo "==> Verifying backend health"
(
  cd "${ROOT_DIR}/backend"
  python3 manage.py check
)

echo "==> Verifying frontend production build"
(
  cd "${ROOT_DIR}/frontend"
  npm run build
)

echo "Environment is ready for cloud agent tasks."
