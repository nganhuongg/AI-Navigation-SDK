param(
  [switch]$NoNode
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

if (-not (Test-Path ".venv")) {
  python -m venv .venv
}

$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
& $Python -m pip install --upgrade pip
& $Python -m pip install -r requirements.txt

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example. Fill VNPT credentials there if using real services."
}

if (-not $NoNode) {
  corepack enable
  pnpm install
}

Write-Host "Install complete."
