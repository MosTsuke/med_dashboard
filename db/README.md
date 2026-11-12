# ดึงข้อมูลจากฐานข้อมูล CSSD

Dashboard ดึง "สถิติจ่าย" จากฐานข้อมูล SQL Server ของโปรแกรม CSSD ได้โดยตรง
ไม่ต้องนำเข้าไฟล์ Excel (ส่วนนำเข้าไฟล์ Excel ยังใช้ได้เหมือนเดิม)

- **หน้าแรก** มีกล่อง "ดึงสถิติจ่ายจากฐานข้อมูล CSSD" ให้เลือกปีงบประมาณ (กล่องนี้จะไม่แสดงถ้ายังไม่ได้ตั้งค่า DB)
- **ลิงก์ตรง** `/?db=supply&fy=2568` ใช้ทำปุ่มในหน้า PHP ได้
- **แท็บ "รายการจ่าย"** แสดงรายการจ่ายทีละรายการ เรียงคอลัมน์ตามแบบที่ทีมโรงพยาบาลส่งมา: วันที่จ่าย · ชื่อรายการ · วันหมดอายุ · หน่วยงานที่จ่ายให้ · เจ้าหน้าที่
- **กรองตามหน่วยงาน** ได้ทั้ง dashboard รายเดือน (Excel แบบเดิมไม่มีข้อมูลหน่วยงาน)

SQL ทั้งหมดอยู่ใน [`lib/db/cssdQueries.ts`](../lib/db/cssdQueries.ts) ไฟล์เดียว

### โหมดสาธิต (ข้อมูลจำลอง ไม่ต้องมีฐานข้อมูล)

บน Vercel (หรือที่ไหนก็ได้ที่ตั้ง `CSSD_DEMO=1`) และไม่ได้ตั้ง `CSSD_DB_SERVER` หน้าจอฐานข้อมูลทั้งหมดจะใช้ข้อมูลสมมติที่สร้างในตัว
([`lib/supply/demo.ts`](../lib/supply/demo.ts)) มี 2 ปีงบ (2568–2569) ชื่อรายการ หน่วยงาน และตัวเลขเป็นของสมมติทั้งหมด
หน้าจอติดป้าย "ข้อมูลจำลองสำหรับสาธิต" ไว้ชัดเจน ใช้ให้ทีมโรงพยาบาลดูหน้าตาระบบก่อนติดตั้งจริงได้
ตั้ง `CSSD_DEMO=0` เพื่อปิด ถ้าตั้งค่าฐานข้อมูลไว้ ระบบจะใช้ฐานข้อมูลเสมอ

## โครงสร้างข้อมูลจริง (ยืนยันจากไฟล์ export ที่โรงพยาบาลส่งมา)

การจ่ายใน `SupplyTb` มี 2 แบบ:

| แบบ | PackTbNo | SuplyCount | วันหมดอายุ |
|---|---|---|---|
| แพ็คมีบาร์โค้ด (เซตเครื่องมือ) | แพ็คจริงใน PackTb | 1 | `PackTb.SetTbExpireDate` |
| ของสิ้นเปลือง (สำลี ผ้าก๊อซ ฯลฯ, SetTbId 5001 ขึ้นไป) | 0 (แพ็คหลอก) | จำนวนที่จ่าย (มักมากกว่า 1) | ไม่มี |

ดังนั้น dashboard นับแบบนี้ (รายละเอียดอยู่ด้านบนของ `lib/db/cssdQueries.ts`):

- **รายการ** = `SupplyTb.SetTbId` → ชื่อจาก `SetTb.SetTbName2` (`SetTbName1` เป็นรหัส)
- **จำนวน** = `SUM(SuplyCount)`
- **ราคา/หน่วย** = `SetTb.SetTbPrice` ถ้าเซตถูกลบจาก SetTb ไปแล้ว ใช้ราคาที่ติดอยู่กับแพ็ค (`PackTb.SetTbPrice`)
- **หน่วยงาน** = `SupplyTb.DepartTbId` → `DepartTb.DepartTbName`

ต่างจากฟังก์ชัน `dbo.fn_Report_Aggregate` ที่มีอยู่แล้วในฐานข้อมูลโรงพยาบาล ซึ่งนับเป็นจำนวนแถวและใช้รหัสเซตจาก PackTb
ทำให้ของสิ้นเปลืองทั้งหมดไปรวมอยู่ในเซต 0 และนับได้แค่จำนวนครั้งที่จ่าย ส่วนแพ็คมีบาร์โค้ด ยอดตรงกับฟังก์ชันนั้น (ยกเว้นกรณีที่เซตปกติถูกจ่ายโดยไม่ยิงบาร์โค้ด)

ตรวจกับข้อมูลจริงแล้ว: ยอดรายเดือน รายหน่วยงาน รายเซต และยอดรวม ตรงกับ SQL ที่เขียนแยกตรวจทุกตัว

**ยังต้องยืนยันกับทีมโรงพยาบาล**
- ของสิ้นเปลืองควรนับตาม `SuplyCount` (จำนวนชิ้น) ใช่ไหม
- เซตที่ไม่มีใน SetTb แล้วชื่ออะไร — ตอนนี้แสดงเป็น "(ไม่ระบุชื่อรายการ รหัสเซต …)"
- แท็บรายการจ่ายติดป้ายแดง "จ่ายหลังหมดอายุ" ให้รายการที่วันที่จ่ายเลยวันหมดอายุของแพ็ค
- ไฟล์ Excel สถิติจ่ายใน `test/` ไม่ได้มาจากฐานข้อมูลนี้ จึงใช้เทียบยอดกับข้อมูลจริงไม่ได้

## รันฐานข้อมูลจำลองบนเครื่อง (Mac/Windows ที่มี Docker)

ใช้ SQL Server 2019 เวอร์ชันเดียวกับของโรงพยาบาล บน Mac ชิป M จะรันผ่าน Rosetta ของ Docker Desktop

1. เปิด container

   ```bash
   docker compose -f db/docker-compose.yml up -d
   ```

2. สร้างข้อมูลจำลองจากไฟล์ Excel "สถิติ จ่าย ปีงบประมาณ 2568.xlsx" (ต้องเปิด `npm run dev` ไว้ก่อน)
   โครงสร้างตารางเหมือนของจริง แต่ใช้ชื่อเซตและยอดจาก Excel ซึ่งไม่ใช่ข้อมูลของโรงพยาบาลนี้

   ```bash
   curl -s -F "file=@test/สถิติ จ่าย ปีงบประมาณ 2568.xlsx" http://localhost:3000/api/parse-xlsx > /tmp/supply-2568.json
   ```

   ```bash
   node db/mock/generate-seed.mjs /tmp/supply-2568.json
   ```

   ไฟล์ที่ได้ (`db/mock/generated/02-seed.sql`) ไม่เข้า git เพราะมาจากข้อมูลจริงของโรงพยาบาล
   ชื่อเจ้าหน้าที่ในข้อมูลจำลองเป็นชื่อสมมติ ("เจ้าหน้าที่ 2", "เจ้าหน้าที่ 3", ...)

3. โหลด schema + ข้อมูล + login แบบอ่านอย่างเดียว (รันซ้ำได้ จะลบแล้วสร้างใหม่)

   ```bash
   ./db/mock/load.sh
   ```

4. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าส่วน "Local MOCK" แล้วรัน `npm run dev` ใหม่

เปิดดูข้อมูลด้วย DBeaver ได้ที่ `127.0.0.1:1433` ฐานข้อมูล `CSSD` user `dashboard_ro` (รหัสอยู่ใน `.env.example`)

### ขอข้อมูลจริงจากโรงพยาบาล (เฉพาะส่วนที่ใช้)

ฐานข้อมูล CSSD ทั้งก้อนมีขนาดใหญ่ ให้ทีมโรงพยาบาลรัน [`db/export/export-for-dashboard.sql`](export/export-for-dashboard.sql) ใน SSMS แทน
(เปิดไฟล์แล้วกด Execute) สคริปต์นี้จะส่งออกเฉพาะ:

ช่วงวันที่ตั้งต้นคือ 1 ต.ค. 2567 (ต้นปีงบ 2568) ถึงวันที่รัน แก้ได้ที่ `@From` / `@To` ด้านบนของไฟล์

- SupplyTb (สถิติจ่าย) และ DemandTb (resterile และการเบิก/คืน) ในช่วงวันที่นั้น
- PackTb (สถิติแพ็ค): ห่อที่แพ็คในช่วงนั้น รวมห่อเก่าที่ถูกจ่ายหรือส่งกลับมา resterile ในช่วงนั้น
- ตารางอ้างอิงทั้งตาราง ได้แก่ DepartTb, DayCountTb, SetTb, SetTypeTb, ReCauseTb (สาเหตุ resterile),
  SterileTb (วิธีฆ่าเชื้อ), MachineTb (เครื่อง), RoundTb (รอบ) และ PersonTb (ชื่อเจ้าหน้าที่ถูกแทนด้วยรหัส)
- ไม่ส่งออกคอลัมน์ที่ชื่อมีคำว่า Password (เช่น `DepartTb.DepartTbPassword`)
- โครงสร้างของทั้งฐานข้อมูล (`_SchemaColumns`, `_SchemaKeys`, `_SchemaForeignKeys`, `_SchemaRowCounts`, `_SchemaModules`) มีแค่ชื่อตาราง/คอลัมน์ ไม่มีข้อมูลในตาราง

สคริปต์อ่านจาก CSSD อย่างเดียวแบบไม่ล็อกตาราง สร้างฐานข้อมูลชั่วคราว `CSSD_Export` แล้ว backup ออกเป็นไฟล์ จากนั้นลบฐานข้อมูลชั่วคราวทิ้งให้อัตโนมัติ
ตารางไหนไม่มีในเครื่องนั้นจะข้ามไปเอง (ข้อมูล 1 ปีงบ ได้ไฟล์ขนาดหลักสิบ MB)

### เมื่อได้ไฟล์ `.bak` จากโรงพยาบาล

```bash
./db/mock/restore-bak.sh ~/Downloads/CSSD_Export.bak
```

สคริปต์จะ restore ไฟล์เป็นฐานข้อมูล `CSSD` แทนข้อมูลจำลอง (ใช้ได้ทั้งไฟล์จาก export script และไฟล์ backup ทั้งก้อน)
ลบรหัสผ่านหน่วยงานและชื่อ-นามสกุลเจ้าหน้าที่ออกจากสำเนาในเครื่อง แล้วตั้ง login `dashboard_ro` ให้ใหม่

ไฟล์ .bak จากโรงพยาบาลเป็นข้อมูลจริง ห้าม commit เข้า git และควรลบเมื่อไม่ใช้แล้ว
ถ้าต้องการกลับไปใช้ข้อมูลจำลอง ให้รัน `./db/mock/load.sh`

## ติดตั้งที่โรงพยาบาล (ให้ IT ทำ)

Dashboard แค่ **อ่าน** ฐานข้อมูล CSSD ตัวเดียวกับที่โปรแกรม CSSD ใช้ และต้องไม่ทำให้โปรแกรม CSSD สะดุด
ฝั่ง dashboard ป้องกันไว้แล้ว: อ่านอย่างเดียว อ่านแบบไม่ล็อกตาราง เชื่อมต่อพร้อมกันไม่เกิน 2 query ที่เกิน 30 วินาทีถูกยกเลิก
และถ้าใส่ login ที่แก้ข้อมูลได้ (เช่น `sa` หรือ login ของโปรแกรม CSSD) จะไม่ยอมเชื่อมต่อ
ใน Activity Monitor ของ SQL Server จะเห็นการเชื่อมต่อของ dashboard ในชื่อ `med-dashboard`

### ขั้นที่ 1 — เช็คค่าปัจจุบัน (แค่อ่าน ไม่แก้อะไร)

รันใน SSMS ด้วย login ผู้ดูแลที่ IT ใช้อยู่:

```sql
-- 0 = เปิด SQL Server Authentication อยู่แล้ว / 1 = ยังใช้ได้แค่ Windows login
SELECT SERVERPROPERTY('IsIntegratedSecurityOnly') AS windows_auth_only;

-- ดูบรรทัดแบบ  Server is listening on [ 'any' <ipv4> 1433].
-- ถ้ามี แปลว่าเปิด TCP/IP อยู่แล้ว และเลขท้ายคือ port ที่ใช้
EXEC xp_readerrorlog 0, 1, N'Server is listening on';
```

บรรทัดที่เป็น `127.0.0.1` หรือ `::1` ไม่นับ เพราะเป็นช่องเชื่อมต่อสำหรับผู้ดูแลจากในเครื่องเท่านั้น

ถ้าคำสั่งที่สองไม่มีผลลัพธ์ ให้เปิดดูใน SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for SQLEXPRESS ว่า TCP/IP เป็น Enabled ไหม (ดูอย่างเดียว ไม่ต้องแก้)
แล้วเปิด `services.msc` ดูว่า service "SQL Server Browser" สถานะ Running หรือไม่

**ถ้าเปิด SQL Server Authentication และ TCP/IP อยู่แล้ว ไม่ต้องเปลี่ยนค่าใดของ SQL Server และไม่ต้อง restart เลย** ไปขั้นที่ 2 ได้ทันที

### ขั้นที่ 2 — สร้าง login แบบอ่านอย่างเดียว (ไม่ต้อง restart)

ใช้รหัสผ่านของโรงพยาบาลเอง ไม่ต้องส่งให้ผู้พัฒนา:

```sql
CREATE LOGIN dashboard_ro WITH PASSWORD = N'<รหัสผ่าน>';
USE CSSD;
CREATE USER dashboard_ro FOR LOGIN dashboard_ro;
ALTER ROLE db_datareader ADD MEMBER dashboard_ro;
```

การสร้าง login ใหม่ไม่กระทบผู้ใช้หรือโปรแกรมเดิม ถ้าเลิกใช้ dashboard ลบออกได้ด้วย `DROP USER dashboard_ro;` (ใน CSSD) และ `DROP LOGIN dashboard_ro;`
อย่าให้ dashboard ใช้ `sa` หรือ login เดียวกับโปรแกรม CSSD

### ขั้นที่ 3 — ใส่ค่าใน `.env.local` บนเครื่องที่รัน dashboard

```
CSSD_DB_SERVER=localhost
CSSD_DB_NAME=CSSD
CSSD_DB_USER=dashboard_ro
CSSD_DB_PASSWORD="<รหัสผ่าน>"
```

แล้วเพิ่มอีกบรรทัดตามผลขั้นที่ 1 — **ไม่ต้องไปเปลี่ยน port ของ SQL Server**:
- ถ้า "SQL Server Browser" Running อยู่: `CSSD_DB_INSTANCE=SQLEXPRESS` (ชื่อ instance ตามที่เห็นใน Configuration Manager)
- ถ้าไม่ได้เปิด: `CSSD_DB_PORT=<เลข port จากขั้นที่ 1>`
  ถ้า port นั้นเป็นแบบ dynamic อาจเปลี่ยนเลขได้หลัง SQL Server restart (นาน ๆ ครั้ง) ถ้า dashboard ต่อไม่ได้หลังจากนั้น ให้เช็คเลขใหม่ด้วยคำสั่งในขั้นที่ 1 แล้วแก้ใน `.env.local`

ถ้า dashboard รันคนละเครื่องกับ SQL Server ให้ใส่ชื่อหรือ IP ของเครื่อง SQL Server แทน `localhost` และต้องเปิด firewall ฝั่ง SQL Server ให้เครื่อง dashboard เข้าถึง port นั้นได้ (และ UDP 1434 ถ้าใช้ `CSSD_DB_INSTANCE`) — รันไว้เครื่องเดียวกันง่ายกว่า

### ถ้าขั้นที่ 1 พบว่ายังไม่ได้เปิด SQL Server Authentication หรือ TCP/IP

Dashboard ต่อฐานข้อมูลได้ทาง TCP/IP ด้วย SQL login เท่านั้น ถ้ายังไม่ได้เปิด ต้องแก้ค่าที่ SQL Server แล้ว **restart service ของ SQL Server ซึ่งทำให้โปรแกรม CSSD ใช้งานไม่ได้ชั่วครู่**
ให้ตกลงกับผู้ดูแลโปรแกรม CSSD ก่อน และทำนอกเวลางานเท่านั้น:

1. **เปิด SQL Server Authentication** — SSMS → คลิกขวาที่ server → Properties → Security → "SQL Server and Windows Authentication mode"
   (Windows login เดิมยังใช้ได้ตามปกติ แค่เพิ่มให้ใช้ SQL login ได้ด้วย)
2. **เปิด TCP/IP** — SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for SQLEXPRESS → TCP/IP = Enabled
   **ไม่ต้องตั้งหรือเปลี่ยน port** ปล่อยค่าเดิมไว้ แล้วใช้ SQL Server Browser หรือเลข port จากขั้นที่ 1 ตามขั้นที่ 3
3. restart service "SQL Server (SQLEXPRESS)" ครั้งเดียว แล้วเช็คว่าโปรแกรม CSSD ใช้งานได้ปกติ
