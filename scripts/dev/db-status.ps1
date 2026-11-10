$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "../.."))
Write-Host "Read-only migration status. Confirm the target branch from Prisma output."
npx prisma migrate status
if ($LASTEXITCODE -ne 0) { throw "Prisma migrate status reported an issue." }
