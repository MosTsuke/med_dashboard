@echo off
setlocal EnableExtensions
REM ==================================================================
REM  Runs the dashboard: node\node.exe app\server.js with the settings
REM  in dashboard.env (copied to app\.env.local, where the server reads
REM  them). Used by 1-start-dashboard.bat and by the MedDashboard task.
REM    run-dashboard.cmd        output in this window
REM    run-dashboard.cmd log    output appended to logs\dashboard.log
REM  Exits non-zero when it stops, so the task starts it again.
REM ==================================================================
chcp 65001 >nul 2>&1
cd /d "%~dp0.."

if not exist "dashboard.env" (
  echo [ยังไม่มีไฟล์ dashboard.env] ดับเบิลคลิก 1-start-dashboard.bat ก่อน
  exit /b 2
)
findstr /C:"CHANGE_ME" "dashboard.env" >nul && (
  echo [ยังไม่ได้ใส่รหัสผ่าน] แก้ CSSD_DB_PASSWORD ในไฟล์ dashboard.env ก่อน
  exit /b 2
)

set "PORT=3001"
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("dashboard.env") do (
  if /i "%%a"=="PORT" set "PORT=%%b"
)
REM Listen on every network card, so other PCs can reach it (firewall allowing).
set "HOSTNAME=0.0.0.0"
set "NODE_ENV=production"
set "NEXT_TELEMETRY_DISABLED=1"
copy /Y "dashboard.env" "app\.env.local" >nul

if /i "%~1"=="log" (
  if not exist "logs" mkdir "logs"
  echo ==== %date% %time% starting on port %PORT% >> "logs\dashboard.log"
  "node\node.exe" "app\server.js" >> "logs\dashboard.log" 2>&1
) else (
  "node\node.exe" "app\server.js"
)
exit /b %errorlevel%
