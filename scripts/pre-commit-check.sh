#!/usr/bin/env bash
# CEO Compass — full pre-commit / pre-push validation (matches CI).
# Usage (repo root):
#   bash scripts/pre-commit-check.sh
#   bash scripts/pre-commit-check.sh --skip-build   # faster local loop
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
  esac
done

echo "=============================================="
echo "  CEO Compass — Pre-Commit Validation"
echo "=============================================="
echo ""

# 0) UTF-8 (catches Windows/editor corruption that only fails on Linux CI)
echo ">>> [0/5] UTF-8 source encoding"
node scripts/check-utf8.mjs
echo "  OK"
echo ""

# 1) Mastery seed integrity
echo ">>> [1/5] Mastery seed validate"
node scripts/validate-mastery-seed.mjs
echo "  OK"
echo ""

cd "$ROOT/frontend"

# 2) TypeScript
echo ">>> [2/5] TypeScript (tsc --noEmit)"
npx tsc --noEmit
echo "  OK"
echo ""

# 3) ESLint — fail on errors AND warnings (CI should stay clean)
echo ">>> [3/5] ESLint (next lint --max-warnings 0)"
if npx next lint --max-warnings 0; then
  echo "  OK"
else
  echo ""
  echo "ESLint failed. Fix errors/warnings before commit."
  echo "  cd frontend && npx next lint"
  exit 1
fi
echo ""

# 4) Unit tests
echo ">>> [4/5] Unit tests (vitest run)"
npx vitest run
echo "  OK"
echo ""

# 5) Next.js build (same as CI frontend-build / deploy)
if [[ "$SKIP_BUILD" -eq 1 ]]; then
  echo ">>> [5/5] Next.js build SKIPPED (--skip-build)"
else
  echo ">>> [5/5] Next.js build"
  # Provide placeholder Firebase env so build does not depend on secrets locally
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:50128}"
  export NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:-demo-key}"
  export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-demo.firebaseapp.com}"
  export NEXT_PUBLIC_FIREBASE_DATABASE_URL="${NEXT_PUBLIC_FIREBASE_DATABASE_URL:-https://demo.firebaseio.com}"
  export NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-demo}"
  export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-demo.appspot.com}"
  export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-0}"
  export NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID:-demo}"
  npx next build
  echo "  OK"
fi
echo ""

# Functions unit tests when present
if [[ -f "$ROOT/functions/package.json" ]]; then
  echo ">>> [extra] Functions unit tests"
  cd "$ROOT/functions"
  if [[ ! -d node_modules ]]; then
    npm install --no-fund --no-audit
  fi
  npm test
  echo "  OK"
  echo ""
fi

echo "=============================================="
echo "  All validations passed — safe to push"
echo "=============================================="
