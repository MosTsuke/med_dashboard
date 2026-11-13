@echo off
setlocal
REM Double-click: first time, creates dashboard.env and opens it to fill in;
REM after that, runs the dashboard in this window (close it to stop).
chcp 65001 >nul
cd /d "%~dp0"

if not exist "dashboard.env" (
  copy "dashboard.env.example" "dashboard.env" >nul
  echo ==================================================
  echo สร้างไฟล์ dashboard.env แล้ว และเปิดใน Notepad ให้
  echo ใส่รหัสผ่านของ login dashboard_ro แทนคำว่า CHANGE_ME แล้วกดบันทึก
  echo จากนั้นดับเบิลคลิกไฟล์นี้อีกครั้ง
  echo ==================================================
  start "" notepad "dashboard.env"
  pause
  exit /b 0
)

schtasks /query /tn "MedDashboard" >nul 2>&1 && (
  echo ตั้งให้ dashboard เปิดเองตอนเปิดเครื่องไว้แล้ว ^(task MedDashboard^)
  echo ตอนนี้น่าจะทำงานอยู่แล้ว ลองเปิด http://localhost:3001
  echo ถ้าจะรันเองในหน้าต่างนี้แทน ให้คลิกขวา stop-dashboard.bat ^> Run as administrator ก่อน
  pause
  exit /b 0
)

echo ==================================================
echo กำลังเปิด Med Dashboard
echo เปิดเบราว์เซอร์ไปที่ http://localhost:3001
echo ปิดหน้าต่างนี้ = หยุด dashboard
echo ==================================================
call "%~dp0scripts\run-dashboard.cmd"
echo.
echo dashboard หยุดทำงาน ดูข้อความด้านบน
pause
