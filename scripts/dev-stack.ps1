# =====================================================================
# dev-stack.ps1 - bring the whole MGI-Delta local stack up reliably (detached).
# Starts only what is DOWN, as independent (detached) processes so they survive,
# then prints a health summary. Web runs in PRODUCTION mode (next start) which is
# far more stable than next dev (no compiler workers that crash under memory load).
#
#   powershell -ExecutionPolicy Bypass -File scripts\dev-stack.ps1            # start/ensure up
#   powershell -ExecutionPolicy Bypass -File scripts\dev-stack.ps1 -Status    # health only
#   powershell -ExecutionPolicy Bypass -File scripts\dev-stack.ps1 -Stop      # stop app procs
#   powershell -ExecutionPolicy Bypass -File scripts\dev-stack.ps1 -BuildWeb  # rebuild web first
#
# Paths default to this machine; override via env vars (MGI_ROOT, MGI_PGBIN, ...).
# =====================================================================
param([switch]$Status, [switch]$Stop, [switch]$BuildWeb)

$Root   = if ($env:MGI_ROOT)   { $env:MGI_ROOT }   else { 'C:\Users\Cody\Desktop\MGI-Delta' }
$PgBin  = if ($env:MGI_PGBIN)  { $env:MGI_PGBIN }  else { 'C:\Users\Cody\pgdev\pgsql\bin' }
$PgData = if ($env:MGI_PGDATA) { $env:MGI_PGDATA } else { 'C:\Users\Cody\pgdev\data' }
$Redis  = if ($env:MGI_REDIS)  { $env:MGI_REDIS }  else { 'C:\Users\Cody\pgdev\redis\redis-server.exe' }

function Test-Port([int]$Port) {
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', $Port); $c.Close(); return $true } catch { return $false }
}
function Start-Detached([string]$File, [string[]]$ArgList, [string]$Cwd) {
  Start-Process -FilePath $File -ArgumentList $ArgList -WorkingDirectory $Cwd -WindowStyle Hidden | Out-Null
}
function Procs([string]$Pattern) {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match $Pattern }
}

if ($Stop) {
  Write-Host 'Stopping app processes (API, worker, web, OCR)...' -ForegroundColor Yellow
  foreach ($p in @('dist[\\/](main|worker)\.js', 'next.*start', 'next.*dev', 'local-ocr')) {
    Procs $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
  Write-Host 'Done. Redis and Postgres left running (shared datastores).'
  return
}

if (-not $Status) {
  Write-Host '== MGI-Delta dev stack ==' -ForegroundColor Cyan

  if (-not (Test-Port 5432)) {
    Write-Host 'starting Postgres...'
    Start-Detached "$PgBin\pg_ctl.exe" @('-D', $PgData, '-l', "$PgData\pg.log", '-o', '-p 5432', 'start') $PgBin
    Start-Sleep 3
  }
  if (-not (Test-Port 6379)) { Write-Host 'starting Redis...'; Start-Detached $Redis @('--port', '6379') (Split-Path $Redis); Start-Sleep 2 }
  if (-not (Test-Port 8089)) { Write-Host 'starting local OCR...'; Start-Detached 'node' @('server.js') "$Root\tools\local-ocr"; Start-Sleep 2 }
  if (-not (Test-Port 3000)) { Write-Host 'starting API...'; Start-Detached 'node' @('-r', './scripts/load-env.js', 'dist/main.js') "$Root\apps\api"; Start-Sleep 4 }
  if (-not (Procs 'dist[\\/]worker\.js')) { Write-Host 'starting worker...'; Start-Detached 'node' @('-r', './scripts/load-env.js', 'dist/worker.js') "$Root\apps\api"; Start-Sleep 2 }

  if ($BuildWeb -or -not (Test-Path "$Root\apps\web\.next\BUILD_ID")) {
    Write-Host 'building web (next build)...'
    Push-Location "$Root\apps\web"; & npm run build | Out-Null; Pop-Location
  }
  if (-not (Test-Port 3001)) { Write-Host 'starting web (next start)...'; Start-Detached 'node' @('node_modules\next\dist\bin\next', 'start', '-p', '3001') "$Root\apps\web"; Start-Sleep 5 }
}

Write-Host ''
Write-Host '== health ==' -ForegroundColor Cyan
$rows = @(
  @{ n = 'Postgres :5432'; ok = (Test-Port 5432) },
  @{ n = 'Redis    :6379'; ok = (Test-Port 6379) },
  @{ n = 'OCR      :8089'; ok = (Test-Port 8089) },
  @{ n = 'API      :3000'; ok = (Test-Port 3000) },
  @{ n = 'Worker        '; ok = ([bool](Procs 'dist[\\/]worker\.js')) },
  @{ n = 'Web      :3001'; ok = (Test-Port 3001) }
)
foreach ($r in $rows) {
  if ($r.ok) { Write-Host ('  UP    ' + $r.n) -ForegroundColor Green }
  else { Write-Host ('  DOWN  ' + $r.n) -ForegroundColor Red }
}
$apiOk = $false
try { if ((Invoke-WebRequest 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 5).Content -match 'status.{0,4}ok') { $apiOk = $true } } catch {}
if ($apiOk) { Write-Host ''; Write-Host '  API /health: ok' -ForegroundColor Green } else { Write-Host ''; Write-Host '  API /health: not ok' -ForegroundColor Red }
Write-Host '  Open: http://localhost:3001/login   (demo@demo.bg / Demo1234!)' -ForegroundColor Cyan
