-- Read-only login for the dashboard — mirrors what the hospital's IT should
-- create on the real server (with their own password, never this one).
-- The password below is for the LOCAL MOCK container only.
-- Idempotent: safe to re-run after load.sh or restore-bak.sh, even while
-- the dashboard is connected (the login is kept, only the DB user is redone).
USE master;
GO
IF SUSER_ID(N'dashboard_ro') IS NULL
  CREATE LOGIN dashboard_ro WITH PASSWORD = N'MockReadOnly#2568', CHECK_POLICY = OFF, DEFAULT_DATABASE = CSSD;
ELSE
  ALTER LOGIN dashboard_ro WITH PASSWORD = N'MockReadOnly#2568', CHECK_POLICY = OFF;
GO
USE CSSD;
GO
IF DATABASE_PRINCIPAL_ID(N'dashboard_ro') IS NOT NULL DROP USER dashboard_ro;
CREATE USER dashboard_ro FOR LOGIN dashboard_ro;
ALTER ROLE db_datareader ADD MEMBER dashboard_ro;
GO
