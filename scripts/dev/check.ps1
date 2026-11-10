$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "../.."))
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Typecheck failed." }
npm run lint
if ($LASTEXITCODE -ne 0) { throw "Lint failed." }
npm test
if ($LASTEXITCODE -ne 0) { throw "Tests failed." }
Write-Host "All checks passed."
