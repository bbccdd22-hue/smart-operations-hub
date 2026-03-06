# One-time setup: allow scripts in this project and register project path.
# Run once: Right-click -> Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File "scripts\Register-TrustedDevPath.ps1"
$ProjectRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
if (-not (Test-Path $ProjectRoot)) { $ProjectRoot = "C:\Users\kings\Desktop\smart-operations-hub" }

# 1. Allow running scripts for CurrentUser (prevents "script blocked" in this project and others)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
Write-Host "[Setup] ExecutionPolicy set to RemoteSigned for CurrentUser."

# 2. Register project as trusted development directory in user environment
$name = "SMART_OPS_HUB"
[Environment]::SetEnvironmentVariable($name, $ProjectRoot, "User")
Write-Host "[Setup] Environment variable $name = $ProjectRoot (User)."
# Refresh current session
$env:SMART_OPS_HUB = $ProjectRoot

Write-Host "[Setup] Done. Restart terminal or reopen Cursor for env to apply everywhere."
Write-Host "  Project path: $ProjectRoot"
