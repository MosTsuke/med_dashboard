-- สร้าง login แบบอ่านอย่างเดียวให้ Med Dashboard (ทำครั้งเดียว ไม่ต้อง restart SQL Server)
-- 1) เปลี่ยน CHANGE_ME เป็นรหัสผ่านที่ต้องการ (ต้องเป็นค่าเดียวกับใน dashboard.env)
--    ห้ามมีเครื่องหมาย ' หรือ " ในรหัสผ่าน
-- 2) กด Execute (F5)
-- login นี้อ่านข้อมูลได้อย่างเดียว แก้ไขหรือลบข้อมูลไม่ได้ และไม่กระทบผู้ใช้หรือโปรแกรมเดิม

CREATE LOGIN dashboard_ro WITH PASSWORD = N'CHANGE_ME';
GO
USE CSSD;
GO
CREATE USER dashboard_ro FOR LOGIN dashboard_ro;
ALTER ROLE db_datareader ADD MEMBER dashboard_ro;
GO

-- ถ้าเลิกใช้ dashboard ถาวร ลบ login ได้ด้วย 3 บรรทัดนี้:
-- USE CSSD;
-- DROP USER dashboard_ro;
-- DROP LOGIN dashboard_ro;
