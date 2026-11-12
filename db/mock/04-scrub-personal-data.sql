/* ============================================================================
   Blank secrets and personal data in a LOCAL copy of a hospital CSSD backup.
   The dashboard needs none of it. Run inside the restored database
   (restore-bak.sh does this for you). Columns that don't exist are skipped,
   so it works on both full backups and export-for-dashboard.sql exports.

   - passwords                    → NULL
   - staff names                  → PersonCall becomes "เจ้าหน้าที่ <id>"
                                    (what the export script does), the rest NULL
   - patient HN and attending staff on SetUseTb, names typed into receipts,
     requests and loans, and free-text notes → NULL ('' if the column can't
     be NULL)
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @targets TABLE (tbl SYSNAME, col SYSNAME);
INSERT @targets VALUES
  (N'DepartTb',        N'DepartTbPassword'),
  (N'DepartTb',        N'DepartTbNote'),
  (N'PersonTb',        N'PersonName'),
  (N'PersonTb',        N'PersonSurName'),
  (N'PersonTb',        N'PersonBarcode'),
  (N'SetUseTb',        N'HnId'),
  (N'SetUseTb',        N'People1'),
  (N'SetUseTb',        N'People2'),
  (N'SetUseTb',        N'People3'),
  (N'ReceiveTb',       N'DepartReceivePerson'),
  (N'SetReqTb',        N'SendPerson'),
  (N'SetReqTb',        N'ReqNote'),
  (N'SetReqTb',        N'ReqNoteAll'),
  (N'BorrowTb',        N'Person'),
  (N'CssdNoteTb',      N'CssdNoteText'),
  (N'MachineDetailTb', N'MachineNote'),
  (N'MachineDetailTb', N'MachineNote2');

DECLARE @tbl SYSNAME, @col SYSNAME, @nullable BIT, @isText BIT, @sql NVARCHAR(MAX);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.tbl, t.col, sc.is_nullable,
         CASE WHEN ty.name IN (N'char', N'varchar', N'nchar', N'nvarchar', N'text', N'ntext') THEN 1 ELSE 0 END
  FROM @targets t
  JOIN sys.columns sc ON sc.object_id = OBJECT_ID(N'dbo.' + QUOTENAME(t.tbl)) AND sc.name = t.col
  JOIN sys.types ty ON ty.user_type_id = sc.user_type_id;
OPEN c;
FETCH NEXT FROM c INTO @tbl, @col, @nullable, @isText;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = CASE
    WHEN @nullable = 1 THEN N'UPDATE dbo.' + QUOTENAME(@tbl) + N' SET ' + QUOTENAME(@col) + N' = NULL'
    WHEN @isText = 1   THEN N'UPDATE dbo.' + QUOTENAME(@tbl) + N' SET ' + QUOTENAME(@col) + N' = '''''
  END;
  IF @sql IS NOT NULL
  BEGIN
    EXEC sp_executesql @sql;
    PRINT N'- blanked ' + @tbl + N'.' + @col;
  END
  ELSE PRINT N'- left ' + @tbl + N'.' + @col + N' (NOT NULL, not text)';
  FETCH NEXT FROM c INTO @tbl, @col, @nullable, @isText;
END
CLOSE c;
DEALLOCATE c;

-- Nicknames shown in the dashboard's "เจ้าหน้าที่" column.
IF COL_LENGTH('dbo.PersonTb', 'PersonCall') IS NOT NULL
BEGIN
  EXEC(N'UPDATE dbo.PersonTb
         SET PersonCall = N''เจ้าหน้าที่ '' + CAST(PersonTbId AS NVARCHAR(20))
         WHERE PersonCall IS NOT NULL AND PersonCall <> N''/''
           AND PersonCall NOT LIKE N''เจ้าหน้าที่ %''');
  PRINT N'- masked PersonTb.PersonCall';
END
