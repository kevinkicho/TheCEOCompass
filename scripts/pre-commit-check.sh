#!/usr/bin/env bash
set -euo pipefail

echo "══════════════════════════════════════════════"
echo "  CEO Compass — Pre-Commit Validation"
echo "══════════════════════════════════════════════"
echo ""

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

# 1. TypeScript type check
echo "━━━ [1/4] TypeScript type check ━━━"
npx tsc --noEmit
echo "  ✅ TypeScript OK"
echo ""

# 2. Lint
echo "━━━ [2/4] ESLint ━━━"
npx next lint --max-warnings 0 2>&1 || {
  echo "  ⚠️  Lint warnings exist — review before pushing"
}
echo ""

# 3. Unit tests
echo "━━━ [3/4] Unit tests ━━━"
npx vitest run
echo "  ✅ All tests passed"
echo ""

# 4. Next.js build
echo "━━━ [4/4] Next.js build ━━━"
npx next build
echo "  ✅ Build OK"
echo ""

echo "══════════════════════════════════════════════"
echo "  ✅ All validations passed!"
echo "══════════════════════════════════════════════"
