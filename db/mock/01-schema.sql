-- =====================================================================
-- MOCK of the hospital's CSSD database (SQL Server 2019 Express).
--
-- Rebuilt from screenshots only — NOT the real schema. Every table/column
-- below that wasn't visible in the screenshots is marked "GUESS"; those are
-- exactly the parts to replace once the real .bak / schema script arrives.
-- Keep lib/db/cssdQueries.ts in sync with any rename here.
-- =====================================================================

IF DB_ID(N'CSSD') IS NOT NULL
BEGIN
  ALTER DATABASE CSSD SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE CSSD;
END
GO

CREATE DATABASE CSSD COLLATE Thai_CI_AS;
GO

USE CSSD;
GO

-- หน่วยงาน (seen in screenshot)
CREATE TABLE dbo.DepartTb (
  DepartTbId   INT           NOT NULL PRIMARY KEY,
  DepartTbName NVARCHAR(100) NULL
);

-- เจ้าหน้าที่ (seen in screenshot)
CREATE TABLE dbo.PersonTb (
  PersonTbId INT           NOT NULL PRIMARY KEY,
  PersonCall NVARCHAR(100) NULL
);

-- อายุการใช้งาน / วันหมดอายุ (seen in screenshot; the name column was cut
-- off as "DayCountTbN..." — assumed DayCountTbName, holding a day count)
CREATE TABLE dbo.DayCountTb (
  DayCountTbId   INT          NOT NULL PRIMARY KEY,
  DayCountTbName NVARCHAR(50) NULL
);

-- GUESS: whole table. The item names in the existing "สถิติจ่าย" Excel report
-- are set names (e.g. "กรรไกรตัดก๊อส(14วัน)") with a unit price, and PackTb
-- (as screenshotted) has no name column — so the name/price must come from
-- somewhere like SetTb. Column names follow the DB's "<Table>Name" pattern.
CREATE TABLE dbo.SetTb (
  SetTbId    INT            NOT NULL PRIMARY KEY,
  SetTbName  NVARCHAR(200)  NULL,
  SetTbPrice DECIMAL(12, 2) NULL
);

-- แพ็ค/ชิ้นที่มีบาร์โค้ด (PackTbNo + PackBarcode seen in screenshot)
CREATE TABLE dbo.PackTb (
  PackTbNo    INT          NOT NULL PRIMARY KEY,
  PackBarcode NVARCHAR(50) NULL,
  SetTbId     INT          NULL  -- GUESS: link from a pack to its set
);

-- การจ่าย (all columns seen in screenshot; "SuplyCount" really is spelled
-- without the second "p" in the source DB)
CREATE TABLE dbo.SupplyTb (
  SupplyNo    INT          NOT NULL PRIMARY KEY,
  PackTbNo    INT          NULL,
  DepartTbId  INT          NULL,
  PersonTbId  INT          NULL,
  SupplyDate  DATETIME     NULL,
  SupplyLabel NVARCHAR(50) NULL,
  SuplyCount  INT          NULL
);

CREATE INDEX IX_SupplyTb_SupplyDate ON dbo.SupplyTb (SupplyDate);
GO
