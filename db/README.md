# ดึงข้อมูลจากฐานข้อมูล CSSD

Dashboard ดึง "สถิติจ่าย" จากฐานข้อมูล SQL Server ของโปรแกรม CSSD ได้โดยตรง
ไม่ต้องนำเข้าไฟล์ Excel (ส่วนนำเข้าไฟล์ Excel ยังใช้ได้เหมือนเดิม)

- **หน้าแรก** มีกล่อง "ดึงสถิติจ่ายจากฐานข้อมูล CSSD" ให้เลือกปีงบประมาณ (กล่องนี้จะไม่แสดงถ้ายังไม่ได้ตั้งค่า DB)
- **ลิงก์ตรง** `/?db=supply&fy=2568` ใช้ทำปุ่มในหน้า PHP ได้
- **แท็บ "รายการจ่าย"** แสดงรายการจ่ายทีละรายการ เรียงคอลัมน์ตามแบบที่ทีมโรงพยาบาลส่งมา: วันที่จ่าย · ชื่อรายการ · วันหมดอายุ · หน่วยงานที่จ่ายให้ · เจ้าหน้าที่
- **กรองตามหน่วยงาน** ได้ทั้ง dashboard รายเดือน (Excel แบบเดิมไม่มีข้อมูลหน่วยงาน)

SQL ทั้งหมดอยู่ใน [`lib/db/cssdQueries.ts`](../lib/db/cssdQueries.ts) ไฟล์เดียว

## ⚠️ สิ่งที่ยังเดาอยู่ (ต้องยืนยันกับทีมโรงพยาบาล)

Schema จำลองสร้างจากภาพหน้าจอเท่านั้น ส่วนที่ไม่เห็นในภาพเป็นการเดา
(รายละเอียดอยู่ด้านบนของ `lib/db/cssdQueries.ts`):

| | สิ่งที่เดา | ถ้าผิดต้องแก้ |
|---|---|---|
| A | ชื่อรายการ/ราคามาจาก `SetTb.SetTbName` / `SetTb.SetTbPrice` ผ่าน `PackTb.SetTbId` | JOIN ใน `FROM_SUPPLY` และชื่อคอลัมน์ |
| B | 1 แถวใน SupplyTb = 1 ชิ้น → จำนวน = `COUNT(*)` | `QUANTITY_EXPR` → `SUM(s.SuplyCount)` |
| C | `SuplyCount` → `DayCountTb` และวันหมดอายุ = วันที่จ่าย + จำนวนวัน | JOIN `dc` และ `expiryDate` ใน `lib/db/supplyReport.ts` |
| D | `SupplyNo = 0` เป็นแถวว่าง ตัดทิ้ง | `WHERE_RANGE` |

## รันฐานข้อมูลจำลองบนเครื่อง (Mac/Windows ที่มี Docker)

ใช้ SQL Server 2019 เวอร์ชันเดียวกับของโรงพยาบาล บน Mac ชิป M จะรันผ่าน Rosetta ของ Docker Desktop

1. เปิด container

   ```bash
   docker compose -f db/docker-compose.yml up -d
   ```

2. สร้างข้อมูลจำลองจากไฟล์ Excel "สถิติ จ่าย ปีงบประมาณ 2568.xlsx" (ต้องเปิด `npm run dev` ไว้ก่อน)

   ```bash
   curl -s -F "file=@test/สถิติ จ่าย ปีงบประมาณ 2568.xlsx" http://localhost:3000/api/parse-xlsx > /tmp/supply-2568.json
   ```

   ```bash
   node db/mock/generate-seed.mjs /tmp/supply-2568.json
   ```

   ไฟล์ที่ได้ (`db/mock/generated/02-seed.sql`) ไม่เข้า git เพราะมาจากข้อมูลจริงของโรงพยาบาล
   ชื่อเจ้าหน้าที่ในข้อมูลจำลองเป็นชื่อสมมติ ("เจ้าหน้าที่ ก", "เจ้าหน้าที่ ข", ...)

3. โหลด schema + ข้อมูล + login แบบอ่านอย่างเดียว (รันซ้ำได้ จะลบแล้วสร้างใหม่)

   ```bash
   ./db/mock/load.sh
   ```

4. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าส่วน "Local MOCK" แล้วรัน `npm run dev` ใหม่

เปิดดูข้อมูลด้วย DBeaver ได้ที่ `127.0.0.1:1433` ฐานข้อมูล `CSSD` user `dashboard_ro` (รหัสอยู่ใน `.env.example`)

### เมื่อได้ไฟล์ `.bak` จริงจากโรงพยาบาล

```bash
docker cp CSSD.bak cssd-mock-sql:/var/opt/mssql/CSSD.bak
```

แล้ว restore ใน DBeaver/sqlcmd (`RESTORE DATABASE CSSD FROM DISK = '/var/opt/mssql/CSSD.bak' WITH MOVE ...`)
จากนั้นเทียบ schema จริงกับข้อ A–D ด้านบน แล้วแก้ `lib/db/cssdQueries.ts`
ตรวจความถูกต้องด้วยการเปิดปีงบ 2568 จาก DB แล้วเทียบยอดกับไฟล์ Excel สถิติจ่ายของปีเดียวกัน

## ติดตั้งที่โรงพยาบาล (ให้ IT ทำ)

SQL Server Express ค่าเริ่มต้นจะต่อจาก Node ไม่ได้ ต้องทำ 3 อย่างก่อน:

1. **เปิด SQL Server Authentication** — SSMS → คลิกขวาที่ server → Properties → Security → "SQL Server and Windows Authentication mode" → restart service
2. **สร้าง login แบบอ่านอย่างเดียว** (ใช้รหัสผ่านของโรงพยาบาลเอง ไม่ต้องส่งให้ผู้พัฒนา)

   ```sql
   CREATE LOGIN dashboard_ro WITH PASSWORD = N'<รหัสผ่าน>';
   USE CSSD;
   CREATE USER dashboard_ro FOR LOGIN dashboard_ro;
   ALTER ROLE db_datareader ADD MEMBER dashboard_ro;
   ```

3. **เปิด TCP/IP** — SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for SQLEXPRESS → TCP/IP = Enabled
   แล้วเลือกอย่างใดอย่างหนึ่ง: ตั้ง port ตายตัว (แท็บ IP Addresses → IPAll → TCP Port = 1433, ลบค่า TCP Dynamic Ports) แล้วใส่ `CSSD_DB_PORT=1433`
   **หรือ** เปิด service "SQL Server Browser" แล้วใส่ `CSSD_DB_INSTANCE=SQLEXPRESS`

จากนั้นสร้างไฟล์ `.env.local` ในโฟลเดอร์โปรเจกต์บน server (ดูตัวอย่างใน `.env.example`) แล้ว build/start ใหม่
ถ้า dashboard รันคนละเครื่องกับ SQL Server ต้องเปิด firewall port 1433 จากเครื่อง dashboard ด้วย
