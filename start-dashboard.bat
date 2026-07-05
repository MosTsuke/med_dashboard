@echo off
setlocal
REM ==================================================================
REM  Double-click this file to install, build, and run the dashboard.
REM  It auto-detects its own folder, so it works wherever you copy
REM  the project to on the server.
REM ==================================================================

set PROJECT_DIR=%~dp0
set PORT=3001

cd /d "%PROJECT_DIR%"

echo ==================================================
echo กำลังตรวจสอบ Node.js...
node -v
if errorlevel 1 (
    echo [ไม่พบ Node.js] กรุณาติดตั้งจาก https://nodejs.org ก่อน ^(เลือกเวอร์ชัน LTS^) แล้วรันไฟล์นี้ใหม่
    pause
    exit /b 1
)

echo ==================================================
echo กำลังติดตั้ง dependencies (ครั้งแรกอาจใช้เวลาสักครู่)...
call npm install
if errorlevel 1 (
    echo [npm install ล้มเหลว] ดูข้อความ error ด้านบน
    pause
    exit /b 1
)

echo ==================================================
echo กำลัง build โปรเจกต์...
call npm run build
if errorlevel 1 (
    echo [build ล้มเหลว] ดูข้อความ error ด้านบน
    pause
    exit /b 1
)

echo ==================================================
echo เริ่มรันที่ port %PORT% ...
echo เปิดดูได้ที่ http://localhost:%PORT%
echo (ปิดหน้าต่างนี้ = หยุดการทำงาน — ดูวิธีตั้งให้รันค้างไว้เบื้องหลังใน DEPLOY.md)
echo ==================================================
call npm run start -- -p %PORT%

pause
