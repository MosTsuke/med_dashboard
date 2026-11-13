@echo off
setlocal
REM Right-click > Run as administrator: stop the dashboard (e.g. before
REM putting a new version in this folder). The autostart setting stays;
REM run 2-install-autostart.bat to start it again.
chcp 65001 >nul
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo [ต้องเปิดแบบผู้ดูแลระบบ] คลิกขวาที่ไฟล์นี้ แล้วเลือก Run as administrator
  pause
  exit /b 1
)

schtasks /end /tn "MedDashboard" >nul 2>&1
REM Also stop our own node.exe (only the one in this folder), in case it
REM outlived the task or was started by hand.
powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '%~dp0node\*' } | Stop-Process -Force"
echo หยุด dashboard แล้ว
pause
