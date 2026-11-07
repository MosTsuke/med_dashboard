# คู่มือติดตั้ง Dashboard บนเครื่อง server โรงพยาบาล (Windows Server / IIS)

## หลักการ: แยกจากระบบเดิม และแตะของเดิมให้น้อยที่สุด

Dashboard เป็นเว็บแยกต่างหาก รันเป็นโปรแกรมของตัวเองบน port ของตัวเอง แค่ไป **อ่าน** ฐานข้อมูล CSSD ตัวเดียวกับที่โปรแกรม CSSD ใช้
ถ้า dashboard ล่มหรือถูกปิด ระบบเดิมยังทำงานตามปกติ

| ส่วนของระบบเดิม | dashboard ทำอะไรกับมัน |
|---|---|
| เว็บ PHP / IIS | ไม่แตะ — dashboard ใช้ port 3001 ของตัวเอง ไม่ต้องติดตั้งหรือตั้งค่าอะไรใน IIS |
| ข้อมูลในฐานข้อมูล CSSD | อ่านอย่างเดียว ผ่าน login ใหม่ที่มีสิทธิ์อ่านอย่างเดียว ถ้าใส่ login ที่แก้ข้อมูลได้ (เช่น `sa` หรือ login ของโปรแกรม CSSD) dashboard จะไม่ยอมเชื่อมต่อ |
| การทำงานของโปรแกรม CSSD | อ่านแบบไม่ล็อกตาราง จึงไม่ไปขวางการบันทึกข้อมูล เชื่อมต่อพร้อมกันไม่เกิน 2 และ query ที่เกิน 30 วินาทีจะถูกยกเลิก |
| ค่าตั้งของ SQL Server | ไม่เปลี่ยน ถ้าเปิด SQL login และ TCP/IP ไว้อยู่แล้ว (เช็คได้โดยไม่แก้อะไร ดู [db/README.md](db/README.md)) — การสร้าง login ใหม่ไม่ต้อง restart |
| Node.js ที่มีอยู่ในเครื่อง | ไม่ทับ — ใช้ Node แบบ ZIP ในโฟลเดอร์ของ dashboard เองได้ (ข้อ 2) |
| CPU / RAM | ตอน build ใช้ CPU หนักอยู่สักพัก ให้ทำนอกเวลางาน (หรือ build จากเครื่องอื่น) ตอนเปิดใช้งานปกติใช้น้อย |
| Firewall | เพิ่ม rule ขาเข้า port 3001 rule เดียว เฉพาะถ้าให้เครื่องอื่นเปิดดู |

## 1. เอาไฟล์ไปวางที่ไหน

Copy ทั้งโฟลเดอร์โปรเจกต์นี้ไปวางบน server เช่น `D:\apps\med_dashboard\` (หรือดาวน์โหลดเป็น ZIP จาก GitHub แล้วแตกไฟล์)

- ไม่ต้อง copy `node_modules` กับ `.next` — สคริปต์จะสร้างใหม่ให้เองตอนรันครั้งแรก และไม่ต้องเอา `test` ไป
- อย่า copy `.env.local` จากเครื่องผู้พัฒนา — ในนั้นเป็นค่าของฐานข้อมูลจำลอง ให้สร้างใหม่บน server ตามข้อ 7

## 2. เช็คเครื่อง server และ Node.js

### สเปกที่ต้องมี

- **Windows 10 / Windows Server 2016 ขึ้นไป แบบ 64-bit** (เช็คด้วยคำสั่ง `winver`)
  Node.js รุ่นที่ใช้ได้ไม่รองรับ Windows Server 2012 R2 หรือเก่ากว่าอย่างเป็นทางการ ถ้าเครื่องเก่ากว่านี้ให้แจ้งผู้พัฒนาก่อน
- **Node.js 22 ขึ้นไป** (แนะนำ LTS ล่าสุด แบบ 64-bit) — ตัวเชื่อม SQL Server (`tedious`) ต้องใช้ 22 ขึ้นไป `start-dashboard.bat` จะเช็คให้

เช็คว่าเครื่องมี Node.js อยู่แล้วไหม (รันใน cmd): `node -v`

### ถ้าเครื่องมี Node.js รุ่นเก่าที่โปรแกรมอื่นใช้อยู่ — อย่าอัปเกรดทับ

ใช้ Node แบบ ZIP แทน ซึ่งไม่ได้ติดตั้งลงระบบ และไม่แตะตัวเดิมเลย:

1. โหลด `node-v<เวอร์ชัน>-win-x64.zip` (รุ่น LTS) จาก nodejs.org
2. แตกไฟล์ แล้วเปลี่ยนชื่อโฟลเดอร์เป็น `node` วางไว้ข้าง `start-dashboard.bat` ให้ได้ `D:\apps\med_dashboard\node\node.exe`
3. `start-dashboard.bat` จะใช้ตัวนี้เองอัตโนมัติ ส่วน NSSM (ข้อ 3) ให้ใส่ Path เป็น `D:\apps\med_dashboard\node\node.exe`

ถ้าเครื่องยังไม่มี Node.js เลย จะติดตั้งแบบ .msi ปกติ หรือใช้วิธี ZIP นี้ก็ได้

### รันครั้งแรก

เปิด `start-dashboard.bat` (ดับเบิลคลิกได้เลย ไม่ต้องพิมพ์คำสั่งเอง) — สคริปต์จะ:

1. เช็คว่ามี Node.js 22 ขึ้นไปติดตั้งอยู่ไหม (ถ้าไม่มีหรือเก่าไป จะบอกให้ไปโหลดจาก nodejs.org เวอร์ชัน LTS ก่อน)
2. รัน `npm install` ติดตั้ง dependencies
3. รัน `npm run build` (build production)
4. รัน `npm run start -- -p 3001` เปิดที่ port 3001

ถ้าทุกอย่างผ่าน จะเข้าดูได้ที่ `http://localhost:3001` บนเครื่อง server นั้น

ขั้น build ใช้ CPU และ RAM หนักอยู่สักพัก ถ้าโปรแกรม CSSD หรือ SQL Server อยู่เครื่องเดียวกัน ให้รันครั้งแรกนอกเวลางาน

ถ้าดับเบิลคลิกไฟล์ .bat ไม่ได้เลย (ระบบล็อกไว้) แปลว่าต้องให้ทีม IT ของโรงพยาบาลช่วยติดตั้ง Node.js และรันให้ครั้งแรก
ถ้าข้อความภาษาไทยในหน้าต่าง cmd ขึ้นเป็นสี่เหลี่ยม แปลว่าฟอนต์ของ cmd ไม่มีภาษาไทย — สคริปต์ยังทำงานปกติ

### Dashboard ใช้ port อะไร ชนกับของเดิมไหม

Dashboard เปิดรับที่ port **3001** port เดียว (ตั้งใน `start-dashboard.bat`)
ตอนดึงข้อมูล dashboard เป็นฝ่ายเชื่อมออกไปหา SQL Server ที่ port ของ SQL Server เอง (ปกติ 1433) เหมือนโปรแกรมอื่นที่ต่อฐานข้อมูล ไม่ได้จับ port นั้นเพิ่ม จึงไม่ชนกับโปรแกรม CSSD
เว็บ PHP/IIS (80/443), SQL Server (1433) และ SQL Server Browser (1434) ใช้ port คนละตัวกับ 3001

เช็คก่อนติดตั้งว่า 3001 ว่างไหม (รันใน cmd) — ถ้าไม่มีอะไรขึ้นมาแปลว่าว่าง:
```
netstat -ano | findstr :3001
```

### ถ้า port 3001 ถูกใช้งานอยู่แล้ว

เรื่องนี้เกิดได้แค่ตอน **เริ่มรัน server** เท่านั้น (ไม่เกี่ยวกับตอนมีคนเปิดดูหลายแท็บพร้อมกัน อันนั้นรองรับอยู่แล้วตามปกติ) ถ้ามีโปรแกรมอื่นจับ port 3001 ไว้ก่อน หน้าต่าง cmd จะขึ้น error ทันทีตอนรัน เช่น `Error: listen EADDRINUSE: address already in use :::3001` แล้วโปรแกรมจะไม่ขึ้นเลย ไม่ใช่ค้างเงียบ ๆ
โปรแกรมที่จับ port นั้นอยู่ก่อนจะไม่ได้รับผลกระทบอะไร

เช็คว่าอะไรจับ port นั้นอยู่ (รันใน cmd):
```
netstat -ano | findstr :3001
```
จะเห็น PID ต่อท้าย เอาไปเช็คใน Task Manager (แท็บ Details) ว่าเป็นโปรแกรมอะไร

วิธีแก้: ให้ dashboard ย้ายไปใช้ port อื่นที่ว่าง **อย่าไปปิดโปรแกรมที่ใช้ port นั้นอยู่**
แก้บรรทัด `set PORT=3001` ใน `start-dashboard.bat` เป็นเลขอื่น (เช่น `3005` เช็คด้วย `netstat` ก่อนว่าว่าง) แล้วอย่าลืมแก้ URL ปุ่มในหน้า PHP กับ NSSM/PM2 ให้ตรงกันด้วย

### ถ้าเครื่อง server ออกอินเทอร์เน็ตไม่ได้

ตอนใช้งาน หน้าเว็บไม่ต้องใช้อินเทอร์เน็ตเลย (ฟอนต์ฝังมากับตัวเว็บแล้ว และข้อมูลดึงจาก SQL Server ภายใน)
แต่ `start-dashboard.bat` ต้องใช้อินเทอร์เน็ตตอน `npm install` ถ้าเครื่อง server ออกเน็ตไม่ได้ ให้เตรียมชุดติดตั้งจากเครื่อง **Windows** อื่นที่มีเน็ต:

1. copy โฟลเดอร์โปรเจกต์ไปที่เครื่อง Windows นั้น (ต้องมี Node.js รุ่นหลักเดียวกับที่จะลงบน server เช่น 24 ทั้งคู่) แล้วรัน `npm ci` ตามด้วย `npm run build`
2. copy ทั้งโฟลเดอร์ (รวม `node_modules` และ `.next`) ไปวางบนเครื่อง server
3. บนเครื่อง server สร้าง `.env.local` (ดู [db/README.md](db/README.md)) แล้วรัน `npm run start -- -p 3001` แทนการดับเบิลคลิก `start-dashboard.bat`

ต้อง build บน Windows เท่านั้น — `node_modules` ที่ติดตั้งบน Mac มีไฟล์เฉพาะของ Mac ใช้บน Windows ไม่ได้
ค่าการเชื่อมต่อฐานข้อมูล (`CSSD_DB_...`) ใน `.env.local` ถูกอ่านตอนรัน `npm run start` ไม่ใช่ตอน build จึงสร้างไฟล์นี้บนเครื่อง server ทีหลังได้
(ยกเว้นค่าที่ขึ้นต้นด้วย `NEXT_PUBLIC_` ซึ่งต้องมีตั้งแต่ตอน build)

## 3. ทำให้รันค้างไว้ตลอด (ไม่ใช่แค่ตอนเปิดหน้าต่างไว้)

ปิดหน้าต่าง cmd ตอนนี้ = โปรแกรมหยุดทำงานทันที ต้องตั้งให้รันเป็น background service

อย่าใช้ `start-dashboard.bat` เป็นตัว service — มันรัน `npm install` และ build ใหม่ทุกครั้งที่เปิด ใช้ .bat แค่ครั้งแรก (ให้ build เสร็จ) แล้วปิดหน้าต่างก่อนตั้ง service
ตอนอัปเดตโค้ดรุ่นใหม่: หยุด service → รัน `npm install` และ `npm run build` → start service อีกครั้ง

แนะนำ 2 ทาง:

**ทาง A — NSSM (ง่ายกว่า มี GUI)**
โหลด [NSSM](https://nssm.cc/download) มาแตกไฟล์ แล้วรัน (จาก cmd หรือดับเบิลคลิกก็ได้):
```
nssm.exe install MedDashboard
```
ถ้าไม่ใส่ argument ต่อ จะเด้งหน้าต่าง GUI ให้กรอก:
- Path: `C:\Program Files\nodejs\node.exe` (ถ้าใช้ Node แบบ ZIP ตามข้อ 2: `D:\apps\med_dashboard\node\node.exe`)
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

**แนะนำ — เปิด port 3001 ตรง ๆ (ไม่แตะเว็บหลักเลย)**
ถ้า port 3001 เข้าถึงได้จากเครื่องในโรงพยาบาล (ไม่ติด firewall) ก็ใช้ลิงก์ตรง ๆ ได้เลย:
`http://<ชื่อ-หรือ-IP-server>:3001/?src=...`
ถ้ายังเข้าไม่ได้ ต้องเปิด Windows Firewall inbound rule สำหรับ port 3001 (ทำผ่าน GUI "Windows Defender Firewall with Advanced Security" ได้ ไม่ต้องพิมพ์คำสั่ง)
การเพิ่ม rule นี้ไม่กระทบ rule เดิมของเครื่อง

**ไม่แนะนำ — เข้าผ่าน IIS**
ทางนี้ต้องติดตั้ง module และแก้ค่าใน IIS ตัวเดียวกับที่เว็บ PHP ใช้อยู่ ถ้าตั้งผิดอาจกระทบเว็บหลัก ทำเฉพาะเมื่อ IT ต้องการเองเท่านั้น

ตอนนี้ Dashboard ต้องอยู่ที่ root ของ URL (`/`) เพราะหน้าเว็บโหลดไฟล์จาก `/_next/...` และเรียกข้อมูลจาก `/api/...`
ถ้าตั้ง IIS ให้ส่งเฉพาะ path อย่าง `/dashboard/*` ไปที่ 3001 หน้าเว็บจะโหลดไม่ขึ้น เพราะไฟล์พวกนั้นจะวิ่งไปหาเว็บ PHP แทน

ถ้าจะทำจริง: ติดตั้ง IIS module "Application Request Routing (ARR)" + "URL Rewrite" (ผ่าน Web Platform Installer หรือโหลด MSI มาลงเอง)
แล้วสร้าง **site ใหม่แยกจากเว็บ PHP** ผูกกับชื่อเฉพาะ เช่น `dashboard.<โดเมนภายใน>` (ให้ IT เพิ่มชื่อนี้ใน DNS ภายใน) และตั้ง reverse proxy ส่ง **ทุก path** ไปที่ `http://localhost:3001/`
ถ้าจำเป็นต้องอยู่ใต้ path ของเว็บ PHP จริง ๆ (เช่น `https://hospital-server/dashboard/`) ต้องแก้โค้ดเพิ่มก่อน ให้แจ้งผู้พัฒนา

## 5. เพิ่มปุ่มในหน้า PHP

> **ตอนนี้ปิดการนำเข้าไฟล์ Excel ไว้** (หน้างานขอให้ดึงจากฐานข้อมูลอย่างเดียว) ลิงก์ `?src=...` ในข้อนี้และวิธีส่งไฟล์ในข้อ 6 จะยังไม่ทำงาน
> ให้ใช้ลิงก์ฐานข้อมูลในข้อ 7 แทน — จะเปิดกลับให้แก้ `EXCEL_IMPORT_ENABLED` ใน `lib/features.ts` เป็น `true` แล้ว build ใหม่

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

## 6. ทางเลือกอื่น — ส่งไฟล์ตรงแบบไม่ต้องมี URL สาธารณะ (postMessage / blob)

วิธี `?src=...` ด้านบนใช้ได้ก็ต่อเมื่อ Dashboard (ฝั่ง Node) สามารถ fetch ไฟล์ xlsx ได้เองตรง ๆ แบบไม่ต้อง login — ถ้าไฟล์ xlsx ของจริงถูกป้องกันด้วย session/login ของ PHP (Node fetch เข้าไม่ถึง) หรือไม่อยากเปิด URL สาธารณะให้ไฟล์เลย มีอีกทางคือให้ browser ของผู้ใช้ (ที่ login อยู่แล้ว) ดึงไฟล์มาเป็นไบต์ในหน่วยความจำเอง แล้วส่งต่อให้แท็บ Dashboard ตรง ๆ ผ่าน `postMessage` — ไม่มีการ save ไฟล์ลงดิสก์ระหว่างทางเลย และไม่ต้องแก้อะไรฝั่ง Dashboard/backend เพิ่มอีก (โค้ดรองรับไว้แล้ว)

ตัวอย่างโค้ด JS ฝั่ง PHP ที่ผูกกับปุ่ม:

```js
function openDashboardWithBlob(fileUrl, fileName) {
  const dashboardOrigin = "http://localhost:3001"; // แก้ตาม host/port จริง
  const tab = window.open(dashboardOrigin + "/", "_blank");

  function onReady(event) {
    if (event.origin !== dashboardOrigin) return;
    if (event.data?.type !== "dashboard-ready") return;
    window.removeEventListener("message", onReady);

    // ดึงไฟล์ด้วย session/cookie ของผู้ใช้เอง — ไม่ผ่าน Node เลย
    fetch(fileUrl, { credentials: "same-origin" })
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        tab.postMessage({ type: "xlsx-file", name: fileName, buffer }, dashboardOrigin);
      });
  }
  window.addEventListener("message", onReady);
}
```

```php
<button onclick="openDashboardWithBlob('/uploads/<?= rawurlencode($filename) ?>', '<?= addslashes($filename) ?>')">
  ดู Dashboard
</button>
```

ลำดับการทำงาน: เปิดแท็บใหม่ → แท็บ Dashboard ส่งสัญญาณ `dashboard-ready` กลับมาบอกว่าพร้อมรับไฟล์แล้ว → หน้า PHP ค่อยดึงไฟล์แล้วส่งไบต์เข้าไป — กันปัญหาส่งไฟล์ไปตอนแท็บใหม่ยังโหลดไม่เสร็จ

อยากจำกัดว่าต้องเป็น origin ของหน้า PHP เท่านั้นถึงจะส่งไฟล์เข้ามาได้ (กันแท็บอื่นแอบส่งข้อมูลปลอม) ตั้ง env var `NEXT_PUBLIC_TRUSTED_OPENER_ORIGIN=http://<php-host>:8080` ตอน build/run Dashboard ได้ ถ้าไม่ตั้งไว้จะรับจาก opener origin ไหนก็ได้ (เหมาะกับใช้งานในวงแลนปิดของโรงพยาบาลอยู่แล้ว)

## 7. ดึงข้อมูลจากฐานข้อมูล CSSD โดยตรง (ไม่ต้องใช้ไฟล์ Excel)

Dashboard ต่อ SQL Server ของโปรแกรม CSSD ได้ตรง แล้วแสดงสถิติจ่ายตามปีงบประมาณ พร้อมแท็บ "รายการจ่าย"
ถ้ายังไม่ได้ตั้งค่าส่วนนี้ ระบบใช้งานแบบนำเข้าไฟล์ Excel ได้ตามปกติ

สิ่งที่ IT ต้องทำฝั่ง SQL Server (เปิด SQL Authentication, สร้าง login อ่านอย่างเดียว, เปิด TCP/IP) และค่าที่ต้องใส่ใน `.env.local` อยู่ใน [db/README.md](db/README.md)
ให้ IT เริ่มจาก "ขั้นที่ 1" ในนั้น ซึ่งแค่อ่านค่า ไม่แก้อะไร ถ้า SQL Server เปิด SQL Authentication และ TCP/IP ไว้อยู่แล้ว ก็แค่สร้าง login ใหม่ ไม่ต้อง restart
ถ้ายังไม่ได้เปิด การเปิดต้อง restart service ของ SQL Server ซึ่งทำให้โปรแกรม CSSD ใช้งานไม่ได้ชั่วครู่ ต้องตกลงกับผู้ดูแลโปรแกรม CSSD ก่อน และทำนอกเวลางานเท่านั้น

ลิงก์สำหรับปุ่มในหน้า PHP:

```php
<a href="http://<dashboard-host>:3001/?db=supply&fy=2568" target="_blank">สถิติจ่าย (ฐานข้อมูล)</a>
```
