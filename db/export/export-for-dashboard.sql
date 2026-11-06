/* ============================================================================
   ส่งออกเฉพาะข้อมูลที่ Dashboard ใช้ จากฐานข้อมูล CSSD
   ----------------------------------------------------------------------------
   วิธีใช้ (SQL Server Management Studio):
     1. File → Open → File... แล้วเลือกไฟล์นี้
     2. ถ้าต้องการช่วงวันที่อื่น แก้ @From / @To ด้านล่าง
     3. กด Execute (F5) รอจนแท็บ Messages ขึ้นว่า "เสร็จแล้ว"
     4. แท็บ Messages จะบอกว่าไฟล์ CSSD_Export.bak อยู่โฟลเดอร์ไหน
        zip ไฟล์นั้นแล้วส่งให้ผู้พัฒนา

   ความปลอดภัย:
     - อ่านจากฐานข้อมูล CSSD อย่างเดียว ไม่แก้ไขอะไรในนั้น
     - สร้างฐานข้อมูลชั่วคราวชื่อ CSSD_Export → backup ออกเป็นไฟล์ → ลบทิ้งให้อัตโนมัติ
     - ชื่อเจ้าหน้าที่ในไฟล์ที่ส่งออกจะเป็น "เจ้าหน้าที่ <รหัส>" (ข้อมูลจริงไม่เปลี่ยน)
     - ต้องรันด้วยบัญชีที่สร้างฐานข้อมูลและ backup ได้ (เช่น sa หรือผู้ดูแลระบบ)

   สิ่งที่อยู่ในไฟล์ที่ได้:
     - SupplyTb (การจ่าย) เฉพาะช่วง @From ถึงก่อน @To
     - PackTb เฉพาะแพ็คที่ถูกจ่ายในช่วงนั้น
     - ตารางอ้างอิงทั้งตาราง: DayCountTb, SetTb, SetTypeTb,
       DepartTb (ไม่รวมรหัสผ่าน), PersonTb (เฉพาะรหัส + ชื่อที่ปิดแล้ว)
     - โครงสร้างของทั้งฐานข้อมูล: ชื่อตาราง ชื่อคอลัมน์ ชนิดข้อมูล key จำนวนแถว
       และโค้ดของ view/stored procedure (ไม่มีข้อมูลในตารางอื่นติดไปด้วย)
   ============================================================================ */

SET NOCOUNT ON;

DECLARE @From DATE = '20241001';   -- วันแรกที่ต้องการ          (1 ต.ค. 2567)
DECLARE @To   DATE = '20251001';   -- วันถัดจากวันสุดท้าย (ไม่รวม) (= ถึง 30 ก.ย. 2568)
DECLARE @MaskStaffNames BIT = 1;   -- 1 = ปิดชื่อเจ้าหน้าที่, 0 = ส่งชื่อจริง

IF DB_ID(N'CSSD') IS NULL
BEGIN
  RAISERROR(N'ไม่พบฐานข้อมูล CSSD', 16, 1);
  RETURN;
END
IF DB_ID(N'CSSD_Export') IS NOT NULL
BEGIN
  RAISERROR(N'มีฐานข้อมูล CSSD_Export ค้างอยู่จากการรันครั้งก่อน — ลบด้วยคำสั่ง DROP DATABASE CSSD_Export แล้วรันใหม่', 16, 1);
  RETURN;
END

BEGIN TRY
  -- Everything touching CSSD_Export goes through dynamic SQL: the database
  -- doesn't exist yet when this batch is compiled.
  EXEC sp_executesql N'CREATE DATABASE CSSD_Export';
  PRINT N'สร้างฐานข้อมูลชั่วคราว CSSD_Export แล้ว';

  -- ── 1. Data tables ─────────────────────────────────────────────────────
  DECLARE @tables TABLE (seq INT IDENTITY, name SYSNAME, kind VARCHAR(10));
  INSERT @tables (name, kind) VALUES
    (N'SupplyTb',   'dated'),
    (N'PackTb',     'packs'),
    (N'DepartTb',   'all'),
    (N'DayCountTb', 'all'),
    (N'SetTb',      'all'),
    (N'SetTypeTb',  'all'),
    (N'PersonTb',   'person');

  DECLARE @i INT = 1, @n INT = (SELECT COUNT(*) FROM @tables);
  DECLARE @name SYSNAME, @kind VARCHAR(10), @sql NVARCHAR(MAX), @cols NVARCHAR(MAX), @rows BIGINT;

  WHILE @i <= @n
  BEGIN
    SELECT @name = name, @kind = kind FROM @tables WHERE seq = @i;

    IF OBJECT_ID(N'CSSD.dbo.' + QUOTENAME(@name), N'U') IS NULL
      PRINT N'- ข้าม ' + @name + N' (ไม่มีตารางนี้)';
    ELSE
    BEGIN
      -- Every column except anything password-like (e.g. DepartTb.DepartTbPassword).
      SELECT @cols = STRING_AGG(CAST(QUOTENAME(c.name) AS NVARCHAR(MAX)), N', ')
                     WITHIN GROUP (ORDER BY c.column_id)
      FROM CSSD.sys.columns c
      WHERE c.object_id = OBJECT_ID(N'CSSD.dbo.' + QUOTENAME(@name))
        AND c.name NOT LIKE N'%Password%';

      SET @sql = CASE @kind
        WHEN 'dated' THEN
          N'SELECT ' + @cols + N' INTO CSSD_Export.dbo.' + QUOTENAME(@name) +
          N' FROM CSSD.dbo.' + QUOTENAME(@name) +
          N' WHERE SupplyDate >= @From AND SupplyDate < @To'
        WHEN 'packs' THEN
          -- only packs dispensed in the range (PackTb holds every pack ever made)
          N'SELECT ' + @cols + N' INTO CSSD_Export.dbo.PackTb FROM CSSD.dbo.PackTb
            WHERE PackTbNo IN (SELECT PackTbNo FROM CSSD.dbo.SupplyTb
                               WHERE SupplyDate >= @From AND SupplyDate < @To)'
        WHEN 'person' THEN
          N'SELECT PersonTbId,
                   CASE WHEN @Mask = 1 AND PersonCall IS NOT NULL AND PersonCall <> N''/''
                        THEN N''เจ้าหน้าที่ '' + CAST(PersonTbId AS NVARCHAR(20))
                        ELSE PersonCall END AS PersonCall
            INTO CSSD_Export.dbo.PersonTb FROM CSSD.dbo.PersonTb'
        ELSE
          N'SELECT ' + @cols + N' INTO CSSD_Export.dbo.' + QUOTENAME(@name) +
          N' FROM CSSD.dbo.' + QUOTENAME(@name)
      END + N'; SET @rows = @@ROWCOUNT;';

      EXEC sp_executesql @sql,
        N'@From DATE, @To DATE, @Mask BIT, @rows BIGINT OUTPUT',
        @From, @To, @MaskStaffNames, @rows OUTPUT;
      PRINT N'- ' + @name + N': ' + CAST(@rows AS NVARCHAR(20)) + N' แถว';
    END
    SET @i += 1;
  END

  -- ── 2. Structure of the whole database (no table data) ─────────────────
  EXEC sp_executesql N'
    SELECT TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE,
           CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
    INTO CSSD_Export.dbo._SchemaColumns
    FROM CSSD.INFORMATION_SCHEMA.COLUMNS;

    SELECT tc.TABLE_NAME, tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME, k.COLUMN_NAME, k.ORDINAL_POSITION
    INTO CSSD_Export.dbo._SchemaKeys
    FROM CSSD.INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN CSSD.INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
      ON k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME AND k.TABLE_NAME = tc.TABLE_NAME;

    SELECT fk.name AS FkName,
           OBJECT_NAME(fkc.parent_object_id, DB_ID(N''CSSD''))     AS FromTable, pc.name AS FromColumn,
           OBJECT_NAME(fkc.referenced_object_id, DB_ID(N''CSSD'')) AS ToTable,   rc.name AS ToColumn
    INTO CSSD_Export.dbo._SchemaForeignKeys
    FROM CSSD.sys.foreign_keys fk
    JOIN CSSD.sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN CSSD.sys.columns pc ON pc.object_id = fkc.parent_object_id     AND pc.column_id = fkc.parent_column_id
    JOIN CSSD.sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id;

    SELECT t.name AS TableName, SUM(p.rows) AS TableRows
    INTO CSSD_Export.dbo._SchemaRowCounts
    FROM CSSD.sys.tables t
    JOIN CSSD.sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
    GROUP BY t.name;

    -- Views / procedures may hold the CSSD program''s own report logic.
    SELECT o.name AS ObjectName, o.type_desc AS ObjectType, m.definition AS Definition
    INTO CSSD_Export.dbo._SchemaModules
    FROM CSSD.sys.sql_modules m
    JOIN CSSD.sys.objects o ON o.object_id = m.object_id;';
  PRINT N'- โครงสร้างฐานข้อมูล (ชื่อตาราง/คอลัมน์/key/จำนวนแถว/view): เรียบร้อย';

  -- ── 3. Back up, then clean up ──────────────────────────────────────────
  -- A bare file name lands in the instance's default backup folder.
  EXEC sp_executesql N'BACKUP DATABASE CSSD_Export TO DISK = N''CSSD_Export.bak''
                       WITH INIT, FORMAT, NAME = N''CSSD subset for dashboard''';
  EXEC sp_executesql N'DROP DATABASE CSSD_Export';

  PRINT N'';
  PRINT N'เสร็จแล้ว — ไฟล์อยู่ที่: '
    + ISNULL(CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(4000)), N'(โฟลเดอร์ Backup ของ SQL Server)')
    + N'\CSSD_Export.bak';
  PRINT N'zip ไฟล์นี้แล้วส่งให้ผู้พัฒนาได้เลย (ลบฐานข้อมูลชั่วคราวให้แล้ว)';
END TRY
BEGIN CATCH
  IF DB_ID(N'CSSD_Export') IS NOT NULL
    EXEC sp_executesql N'DROP DATABASE CSSD_Export';
  PRINT N'เกิดข้อผิดพลาด — ส่งข้อความด้านล่างนี้ให้ผู้พัฒนาดูได้เลย';
  THROW;
END CATCH
