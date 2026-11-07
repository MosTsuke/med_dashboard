@echo off
setlocal
REM ==================================================================
REM  Double-click this file to install, build, and run the dashboard.
REM  It auto-detects its own folder, so it works wherever you copy
REM  the project to on the server.
REM
REM  Keep this file as UTF-8 (no BOM) with Windows CRLF line endings
REM  (.gitattributes enforces CRLF). chcp 65001 makes cmd read the Thai
REM  messages below as UTF-8 instead of garbling them.
REM ==================================================================

chcp 65001 >nul

set PROJECT_DIR=%~dp0
set PORT=3001
REM The SQL Server driver (tedious) needs Node.js 22 or newer.
set MIN_NODE_MAJOR=22

cd /d "%PROJECT_DIR%"

REM If a Node.js ZIP has been unpacked into a "node" folder next to this
REM file, use it instead of the one installed on the machine. That way an
REM older Node.js that other programs depend on is left untouched.
REM (setlocal above keeps this PATH change inside this window only.)
if exist "%PROJECT_DIR%node\node.exe" set "PATH=%PROJECT_DIR%node;%PATH%"

echo ==================================================
echo กำลังตรวจสอบ Node.js...
node -v
if errorlevel 1 (
    echo [ไม่พบ Node.js] กรุณาติดตั้งจาก https://nodejs.org ก่อน ^(เลือกเวอร์ชัน LTS แบบ 64-bit^) แล้วรันไฟล์นี้ใหม่
    pause
    exit /b 1
)

set NODE_MAJOR=
for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if not defined NODE_MAJOR set NODE_MAJOR=0
if %NODE_MAJOR% LSS %MIN_NODE_MAJOR% (
    echo [Node.js เก่าเกินไป] ต้องเป็นเวอร์ชัน %MIN_NODE_MAJOR% ขึ้นไป ^(แนะนำ LTS ล่าสุด^) ดูข้อ 2 ใน DEPLOY.md
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
