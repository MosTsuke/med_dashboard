@echo off
setlocal
REM Right-click > Run as administrator: let other PCs on the same network
REM open the dashboard. Only needed when other PCs should see it.
chcp 65001 >nul
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo [ต้องเปิดแบบผู้ดูแลระบบ] คลิกขวาที่ไฟล์นี้ แล้วเลือก Run as administrator
  pause
  exit /b 1
)

set "PORT=3001"
if exist "dashboard.env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in ("dashboard.env") do (
    if /i "%%a"=="PORT" set "PORT=%%b"
  )
)

REM Only machines on the same local network (localsubnet), nothing beyond it.
netsh advfirewall firewall delete rule name="Med Dashboard" >nul 2>&1
netsh advfirewall firewall add rule name="Med Dashboard" dir=in action=allow protocol=TCP localport=%PORT% remoteip=localsubnet profile=any
if errorlevel 1 (
  echo [เปิด firewall ไม่สำเร็จ] ดูข้อความด้านบน
  pause
  exit /b 1
)
echo.
echo เปิดให้เครื่องอื่นในวงแลนเดียวกันเข้าได้แล้ว ที่ port %PORT%
echo ให้เครื่องอื่นเปิด http://^<IP ด้านล่าง^>:%PORT%
ipconfig | findstr /C:"IPv4"
pause
