$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "../.."))
# Next.js loads .env.local; Prisma CLI may load .env. Make the target explicit.
$line = Get-Content ".env.local" -ErrorAction Stop | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $line) { throw "DATABASE_URL is missing from .env.local." }
$url = ($line -split '=',2)[1].Trim().Trim('"', "'")
try { $uri = [Uri]$url } catch { throw "Invalid DATABASE_URL in .env.local." }
if ($uri.Scheme -notin @("postgresql","postgres")) { throw "Expected a PostgreSQL URL." }
$hostName = $uri.Host
if ($hostName -notlike "*.neon.tech") { throw "Refusing migration: target is not Neon." }
Write-Host "Target host: $hostName"
Write-Host "Database: $($uri.AbsolutePath.TrimStart('/'))"
Write-Host "IMPORTANT: verify this host is your Neon DEVELOPMENT branch in the Neon console."
$confirmation = Read-Host "Type MIGRATE-DEV to apply pending migrations"
if ($confirmation -cne "MIGRATE-DEV") { throw "Migration cancelled." }
$env:DATABASE_URL = $url
try {
  npx prisma migrate status
  if ($LASTEXITCODE -ne 0) { throw "Migration status failed; no migrations applied." }
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "Migration failed." }
  npx prisma generate
  if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed." }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
