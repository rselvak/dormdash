$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "../.."))
$expected = "feature/shared-events-calendar"
$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne $expected) { throw "Switch to $expected before running setup (currently: $branch)." }
$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw "Could not inspect Git status." }
if ($dirty) {
  Write-Warning "Local changes found. They will NOT be overwritten:"
  $dirty | ForEach-Object { Write-Host "  $_" }
  Write-Host ""
  Write-Host "Choose an option:"
  Write-Host "  [L] Continue with local code (skip git pull; recommended)"
  Write-Host "  [S] Stop so you can review, commit, or stash changes"
  $choice = (Read-Host "Enter L or S").Trim().ToUpperInvariant()
  if ($choice -ne "L") { throw "Setup stopped; no changes were discarded." }
  Write-Host "Skipping git pull; continuing with your local working tree."
} else {
  Write-Host "Pulling latest $expected..."
  git pull --ff-only origin $expected
  if ($LASTEXITCODE -ne 0) { throw "Git pull failed." }
}
Write-Host "Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
Write-Host "Generating Prisma client..."
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed." }
Write-Host "Running TypeScript checks..."
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Typecheck failed. App not started." }
Write-Host "Starting DormDash..."
npm run dev
if ($LASTEXITCODE -ne 0) { throw "Development server exited with an error." }
