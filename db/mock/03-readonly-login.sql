-- Read-only login for the dashboard — mirrors what the hospital's IT should
-- create on the real server (with their own password, never this one).
-- The password below is for the LOCAL MOCK container only.
USE master;
GO
IF SUSER_ID(N'dashboard_ro') IS NOT NULL DROP LOGIN dashboard_ro;
GO
CREATE LOGIN dashboard_ro WITH PASSWORD = N'MockReadOnly#2568', CHECK_POLICY = OFF, DEFAULT_DATABASE = CSSD;
GO
USE CSSD;
GO
CREATE USER dashboard_ro FOR LOGIN dashboard_ro;
ALTER ROLE db_datareader ADD MEMBER dashboard_ro;
GO
