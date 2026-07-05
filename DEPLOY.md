# คู่มือติดตั้ง Dashboard บนเครื่อง server โรงพยาบาล (Windows Server / IIS)

## 1. เอาไฟล์ไปวางที่ไหน

Copy ทั้งโฟลเดอร์โปรเจกต์นี้ไปวางบน server เช่น `D:\apps\med_dashboard\`
(ไม่ต้อง copy โฟลเดอร์ `node_modules`, `.next`, `test` — สคริปต์จะสร้างใหม่ให้เองตอนรันครั้งแรก)

## 2. เช็คว่าเครื่องมี Node.js หรือยัง

เปิด `start-dashboard.bat` (ดับเบิลคลิกได้เลย ไม่ต้องพิมพ์คำสั่งเอง) — สคริปต์จะ:

1. เช็คว่ามี Node.js ติดตั้งอยู่ไหม (ถ้าไม่มีจะบอกให้ไปโหลดจาก nodejs.org เวอร์ชัน LTS ก่อน)
2. รัน `npm install` ติดตั้ง dependencies
3. รัน `npm run build` (build production)
4. รัน `npm run start -- -p 3001` เปิดที่ port 3001

ถ้าทุกอย่างผ่าน จะเข้าดูได้ที่ `http://localhost:3001` บนเครื่อง server นั้น

ถ้าดับเบิลคลิกไฟล์ .bat ไม่ได้เลย (ระบบล็อกไว้) แปลว่าต้องให้ทีม IT ของโรงพยาบาลช่วยติดตั้ง Node.js และรันให้ครั้งแรก

## 3. ทำให้รันค้างไว้ตลอด (ไม่ใช่แค่ตอนเปิดหน้าต่างไว้)

ปิดหน้าต่าง cmd ตอนนี้ = โปรแกรมหยุดทำงานทันที ต้องตั้งให้รันเป็น background service แนะนำ 2 ทาง:

**ทาง A — NSSM (ง่ายกว่า มี GUI)**
โหลด [NSSM](https://nssm.cc/download) มาแตกไฟล์ แล้วรัน (จาก cmd หรือดับเบิลคลิกก็ได้):
```
nssm.exe install MedDashboard
```
ถ้าไม่ใส่ argument ต่อ จะเด้งหน้าต่าง GUI ให้กรอก:
- Path: `C:\Program Files\nodejs\node.exe`
- Startup directory: `D:\apps\med_dashboard`
- Arguments: `node_modules\next\dist\bin\next start -p 3001`

กด Install Service แล้วสั่ง start service จาก `services.msc` ได้เลย — ไม่ต้องเปิดหน้าต่างค้างไว้อีก

**ทาง B — PM2**
```
npm install -g pm2 pm2-windows-startup
pm2-startup install
cd D:\apps\med_dashboard
pm2 start npm --name med-dashboard -- run start -- -p 3001
pm2 save
```

## 4. ให้เข้าถึงจากหน้า PHP ได้

มี 2 ทางเลือก:

**ทางง่าย — เปิด port ตรง ๆ**
ถ้า port 3001 เข้าถึงได้จากเครื่องในโรงพยาบาล (ไม่ติด firewall) ก็ใช้ลิงก์ตรง ๆ ได้เลย:
`http://<ชื่อ-หรือ-IP-server>:3001/?src=...`
ถ้ายังเข้าไม่ได้ ต้องเปิด Windows Firewall inbound rule สำหรับ port 3001 (ทำผ่าน GUI "Windows Defender Firewall with Advanced Security" ได้ ไม่ต้องพิมพ์คำสั่ง)

**ทางที่ดีกว่าถ้าอยากอยู่ domain/port เดียวกับ PHP**
ติดตั้ง IIS module "Application Request Routing (ARR)" + "URL Rewrite" (ผ่าน Web Platform Installer หรือโหลด MSI มาลงเอง) แล้วตั้ง reverse proxy ให้ path เช่น `/dashboard/*` ส่งต่อไปที่ `http://localhost:3001/*` — ทำให้ผู้ใช้เข้าผ่าน `https://hospital-server/dashboard/...` โดยไม่ต้องเปิด port ใหม่เลย (แนะนำทางนี้ถ้า IT ยอมให้ติดตั้ง module เพิ่ม)

## 5. เพิ่มปุ่มในหน้า PHP

หา loop ที่ list ไฟล์ xlsx อยู่ในโค้ด PHP ปัจจุบัน (เช่น `foreach ($files as $f) { ... }` ที่ print แถวตารางไฟล์) แล้วเพิ่มลิงก์แบบนี้ในแถวนั้น:

```php
<a
  href="http://<dashboard-host>:3001/?src=<?= urlencode($xlsxFileUrl) ?>"
  target="_blank"
>ดู Dashboard</a>
```

`$xlsxFileUrl` ต้องเป็น URL แบบเต็ม (มี `http://` นำหน้า) ที่ตัว Node เข้าไปโหลดไฟล์ได้เอง เช่น
`http://<php-server>/uploads/สถิติ ล้าง.xlsx` — ถ้าไฟล์ xlsx อยู่ในโฟลเดอร์ที่ PHP serve เป็น static file อยู่แล้วก็ใช้ path นั้นตรง ๆ ได้เลย

ถ้ายังไม่รู้ว่า path ไฟล์ xlsx ปัจจุบันอยู่ตรงไหน หรืออยากให้ชี้บรรทัดที่แน่นอน ส่ง snippet PHP ส่วนที่ list ไฟล์มาให้ดูได้ จะชี้ตำแหน่งที่แน่นอนให้
