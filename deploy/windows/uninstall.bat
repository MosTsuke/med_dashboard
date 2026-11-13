@echo off
setlocal
REM Right-click > Run as administrator: stop the dashboard and remove what
REM the install scripts added to Windows (the task and the firewall rule).
REM Then this folder can simply be deleted.
chcp 65001 >nul
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo [ต้องเปิดแบบผู้ดูแลระบบ] คลิกขวาที่ไฟล์นี้ แล้วเลือก Run as administrator
  pause
  exit /b 1
)

schtasks /end /tn "MedDashboard" >nul 2>&1
REM CIM rather than Get-Process: it also shows the path of the task's node.exe (runs as SYSTEM).
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like '%~dp0node\*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
schtasks /delete /tn "MedDashboard" /f >nul 2>&1 && echo - ลบการเปิดเองตอนเปิดเครื่องแล้ว || echo - ไม่มีการตั้งเปิดเองตอนเปิดเครื่อง
netsh advfirewall firewall delete rule name="Med Dashboard" >nul 2>&1 && echo - ลบ firewall rule แล้ว || echo - ไม่มี firewall rule
echo.
echo ถอนเรียบร้อย ลบโฟลเดอร์นี้ทิ้งได้เลย
echo ถ้าเลิกใช้ถาวร ให้ลบ login dashboard_ro ใน SSMS ด้วย ^(ดูวิธีใน README-TH.txt^)
pause
