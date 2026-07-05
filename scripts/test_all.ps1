param(
  [switch]$Build
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
  throw "Missing .venv. Run .\scripts\install_all.ps1 first."
}

Write-Host "Running backend unit tests..."
Push-Location "services\navigation-engine"
& $Python -m pytest -q
Pop-Location

Write-Host "Running backend integration smoke..."
& $Python "scripts\integration_smoke.py"

Write-Host "Running TypeScript type checks..."
pnpm --filter "@ai-nav/shared-types" typecheck
pnpm --filter hospital-app typecheck
pnpm --filter admin-console typecheck

if ($Build) {
  Write-Host "Running frontend production builds..."
  pnpm --filter hospital-app build
  pnpm --filter admin-console build
}

Write-Host "All requested checks passed."
