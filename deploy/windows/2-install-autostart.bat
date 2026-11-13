@echo off
setlocal
REM Right-click > Run as administrator: start the dashboard by itself every
REM time the PC boots (no login needed), and again if it ever stops.
chcp 65001 >nul
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo [ต้องเปิดแบบผู้ดูแลระบบ] คลิกขวาที่ไฟล์นี้ แล้วเลือก Run as administrator
  pause
  exit /b 1
)
if not exist "dashboard.env" (
  echo [ยังไม่มีไฟล์ dashboard.env] ดับเบิลคลิก 1-start-dashboard.bat ก่อนเพื่อตั้งค่า
  pause
  exit /b 1
)
findstr /C:"CHANGE_ME" "dashboard.env" >nul && (
  echo [ยังไม่ได้ใส่รหัสผ่าน] แก้ CSSD_DB_PASSWORD ในไฟล์ dashboard.env ก่อน
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-autostart.ps1" -Root "%~dp0."
if errorlevel 1 (
  echo [ตั้งไม่สำเร็จ] ดูข้อความด้านบน
  pause
  exit /b 1
)
echo.
echo ตั้งเรียบร้อย: dashboard จะเปิดเองทุกครั้งที่เปิดเครื่อง ไม่ต้อง login
echo และจะเปิดใหม่เองภายใน 1 นาทีถ้าหยุดทำงาน
echo สั่งเปิดแล้ว รอประมาณ 10 วินาที แล้วเปิด http://localhost:3001
echo ถ้ามีปัญหา ดูไฟล์ logs\dashboard.log
pause
