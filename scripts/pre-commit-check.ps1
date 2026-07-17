# CEO Compass — Windows pre-commit validation (mirrors scripts/pre-commit-check.sh)
# Usage (repo root, PowerShell):
#   powershell -File scripts/pre-commit-check.ps1
#   powershell -File scripts/pre-commit-check.ps1 -SkipBuild

param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=============================================="
Write-Host "  CEO Compass — Pre-Commit Validation"
Write-Host "=============================================="
Write-Host ""

Write-Host ">>> [0/5] UTF-8 source encoding"
node scripts/check-utf8.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "  OK"
Write-Host ""

Write-Host ">>> [1/5] Mastery seed validate"
node scripts/validate-mastery-seed.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "  OK"
Write-Host ""

Set-Location (Join-Path $Root "frontend")

Write-Host ">>> [2/5] TypeScript (tsc --noEmit)"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "  OK"
Write-Host ""

Write-Host ">>> [3/5] ESLint (next lint --max-warnings 0)"
npx next lint --max-warnings 0
if ($LASTEXITCODE -ne 0) {
  Write-Host "ESLint failed. Fix errors/warnings before commit."
  exit $LASTEXITCODE
}
Write-Host "  OK"
Write-Host ""

Write-Host ">>> [4/5] Unit tests (vitest run)"
npx vitest run
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "  OK"
Write-Host ""

if ($SkipBuild) {
  Write-Host ">>> [5/5] Next.js build SKIPPED (-SkipBuild)"
} else {
  Write-Host ">>> [5/5] Next.js build"
  if (-not $env:NEXT_PUBLIC_FIREBASE_API_KEY) { $env:NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key" }
  if (-not $env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) { $env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.firebaseapp.com" }
  if (-not $env:NEXT_PUBLIC_FIREBASE_DATABASE_URL) { $env:NEXT_PUBLIC_FIREBASE_DATABASE_URL = "https://demo.firebaseio.com" }
  if (-not $env:NEXT_PUBLIC_FIREBASE_PROJECT_ID) { $env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo" }
  if (-not $env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) { $env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo.appspot.com" }
  if (-not $env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) { $env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "0" }
  if (-not $env:NEXT_PUBLIC_FIREBASE_APP_ID) { $env:NEXT_PUBLIC_FIREBASE_APP_ID = "demo" }
  if (-not $env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL = "http://localhost:50128" }
  npx next build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "  OK"
}
Write-Host ""

$fn = Join-Path $Root "functions"
if (Test-Path (Join-Path $fn "package.json")) {
  Write-Host ">>> [extra] Functions unit tests"
  Set-Location $fn
  if (-not (Test-Path "node_modules")) {
    npm install --no-fund --no-audit
  }
  npm test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "  OK"
  Write-Host ""
}

Write-Host "=============================================="
Write-Host "  All validations passed — safe to push"
Write-Host "=============================================="
