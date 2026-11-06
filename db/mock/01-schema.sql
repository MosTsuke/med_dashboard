-- =====================================================================
-- MOCK of the hospital's CSSD database (SQL Server 2019 Express).
--
-- Mirrors the REAL schema (from a database export the hospital provided,
-- 2026-11) for the columns the dashboard reads — names, types and
-- meaning match; the real tables have more columns than these.
-- Keep lib/db/cssdQueries.ts in sync with any change here.
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

CREATE TABLE dbo.DepartTb (
  DepartTbId   SMALLINT    NOT NULL PRIMARY KEY,
  DepartTbName VARCHAR(30) NULL
);

CREATE TABLE dbo.PersonTb (
  PersonTbId TINYINT     NOT NULL PRIMARY KEY,
  PersonCall VARCHAR(20) NULL
);

-- Shelf-life choices (days). Not read by the dashboard: each pack carries
-- its own expiry date (PackTb.SetTbExpireDate).
CREATE TABLE dbo.DayCountTb (
  DayCountTbId   TINYINT  NOT NULL PRIMARY KEY,
  DayCountTbName SMALLINT NULL
);

-- Sets and consumables. SetTbName1 is a short code, SetTbName2 the display
-- name. Consumables (สำลี, ผ้าก๊อซ, ...) use ids 5001+.
CREATE TABLE dbo.SetTb (
  SetTbId    SMALLINT    NOT NULL PRIMARY KEY,
  SetTbName1 VARCHAR(20) NULL,
  SetTbName2 VARCHAR(60) NULL,
  SetTbPrice MONEY       NULL
);

-- One row per physical pack (barcode). PackTbNo 0 is the placeholder
-- "pack" that consumable dispenses point at (no set, no expiry).
CREATE TABLE dbo.PackTb (
  PackTbNo        INT      NOT NULL PRIMARY KEY,
  PackBarcode     INT      NULL,
  SetTbPackDate   DATE     NULL,
  SetTbId         SMALLINT NULL,
  SetTbCountDate  SMALLINT NULL,
  SetTbExpireDate DATE     NULL,
  SetTbPrice      MONEY    NULL
);

-- Dispenses. Barcoded pack: PackTbNo = that pack, SuplyCount = 1.
-- Consumable: PackTbNo = 0, SuplyCount = quantity handed out.
-- ("SuplyCount" really is spelled without the second "p".)
CREATE TABLE dbo.SupplyTb (
  SupplyNo    INT      NOT NULL PRIMARY KEY,
  PackTbNo    INT      NULL,
  DepartTbId  SMALLINT NULL,
  PersonTbId  TINYINT  NULL,
  SupplyDate  DATETIME NULL,
  SupplyLabel SMALLINT NULL,
  SuplyCount  INT      NULL,
  SetTbId     SMALLINT NULL
);

CREATE INDEX IX_SupplyTb_SupplyDate ON dbo.SupplyTb (SupplyDate);
GO
