# Automated System Recovery & Startup
# 1. Kill processes on 8000 and 5173 (process sync)
# 2. Run migrations, start Django, health-check /api/health/ until 200 OK
# 3. Start Vite (proxies /api to 127.0.0.1:8000), open browser
$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

function Stop-Port {
  param([int]$Port)
  $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if ($conn) {
    $conn | ForEach-Object {
      $procId = $_.OwningProcess
      try {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "[Auto] Stopped process $procId on port $Port"
      } catch {}
    }
    Start-Sleep -Seconds 1
  }
}

Write-Host "=== Process Sync (clear ports 8000 and 5173) ==="
Stop-Port -Port 8000
Stop-Port -Port 5173
Start-Sleep -Seconds 2

$env:DJANGO_SECRET_KEY = "auto-gen-key-123"
$env:DJANGO_DEBUG = "true"

Write-Host "=== Database Migration Sync ==="
Push-Location $BackendDir
try {
  & python manage.py migrate
  if ($LASTEXITCODE -ne 0) { Write-Host "[Auto] migrate had non-zero exit; continuing anyway." }
} finally { Pop-Location }

Write-Host "=== Starting Django (port 8000) ==="
Start-Process -FilePath "python" -ArgumentList "manage.py","runserver","0.0.0.0:8000","--noreload" -WorkingDirectory $BackendDir -WindowStyle Normal -PassThru | Out-Null
Start-Sleep -Seconds 5

Write-Host "=== Health Check (wait for 200 OK on /api/health/) ==="
$healthUrl = "http://127.0.0.1:8000/api/health/"
$maxAttempts = 60
$attempt = 0
$ready = $false
do {
  $attempt++
  try {
    $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {
    $code = $null
    try { $code = [int]$_.Exception.Response.StatusCode.value__ } catch {}
    Write-Host "[Auto] Backend not ready ($code)... ($attempt/$maxAttempts)"
  }
  if (-not $ready -and $attempt -ge $maxAttempts) {
    Write-Host "[Auto] Backend health check timed out. Exiting without starting frontend."
    exit 1
  }
  if (-not $ready) { Start-Sleep -Seconds 2 }
} while (-not $ready -and $attempt -lt $maxAttempts)

Write-Host "[Auto] Backend ready (200 OK on /api/health/)."

Write-Host "=== Starting Vite (port 5173, proxy /api -> 127.0.0.1:8000) ==="
$env:VITE_API_BASE = "http://127.0.0.1:8000/api"
# Use cmd /k so the window stays open and errors are visible; set env in same shell
Start-Process -FilePath "cmd.exe" -ArgumentList "/k","cd /d `"$FrontendDir`" && set VITE_API_BASE=http://127.0.0.1:8000/api && npm run dev" -WindowStyle Normal -PassThru | Out-Null
Start-Sleep -Seconds 3

# Wait for frontend to be reachable before opening browser
Write-Host "=== Waiting for frontend (port 5173) ==="
$feUrl = "http://127.0.0.1:5173"
$feAttempts = 0
$feMax = 20
$feReady = $false
do {
  $feAttempts++
  try {
    $fr = Invoke-WebRequest -Uri $feUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    $feReady = $true
    break
  } catch {
    if ($feAttempts -ge $feMax) {
      Write-Host "[Auto] Frontend did not respond in time. Open manually: $feUrl"
      break
    }
    Write-Host "[Auto] Waiting for frontend... ($feAttempts/$feMax)"
    Start-Sleep -Seconds 2
  }
} while (-not $feReady -and $feAttempts -lt $feMax)

if ($feReady) { Write-Host "[Auto] Frontend ready." }

Write-Host ""
Write-Host "=== Startup complete ==="
Write-Host "  Backend:  http://127.0.0.1:8000"
Write-Host "  Frontend: http://localhost:5173  (proxies /api to backend)"
$netIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.' } | Select-Object -First 1).IPAddress
if ($netIp) { Write-Host "  From LAN: http://${netIp}:5173" }
Write-Host ""
if ($feReady) {
  Start-Process "http://localhost:5173"
} else {
  Write-Host "  Open in browser: http://localhost:5173"
}
