/**
 * Every SQL statement the dashboard runs against the CSSD database.
 *
 * ── ASSUMPTIONS (unconfirmed — revisit when the real schema arrives) ──
 * Built from screenshots of SupplyTb / PackTb / DepartTb / PersonTb /
 * DayCountTb only. The pieces marked below were NOT visible and are guesses
 * mirrored by the mock DB in db/mock/01-schema.sql:
 *
 *  A. Item name + unit price come from SetTb (SetTbName, SetTbPrice), reached
 *     through PackTb.SetTbId. PackTb as screenshotted has only PackTbNo and
 *     PackBarcode, but the existing "สถิติจ่าย" report lists set names with a
 *     price, so they must live somewhere like this.
 *  B. One SupplyTb row = one dispensed pack, so quantity = COUNT(*).
 *     The column "SuplyCount" is 1 on every visible row; if it turns out to be
 *     a real quantity, switch QUANTITY_EXPR to "SUM(s.SuplyCount)".
 *  C. The team's diagram links SuplyCount → DayCountTb (shelf-life days), and
 *     "วันหมดอายุ" = SupplyDate + those days. Both halves need confirming —
 *     expiry may instead be counted from the sterilisation date.
 *  D. SupplyNo 0 is a placeholder row (all NULLs) and is excluded.
 */

export const QUANTITY_EXPR = "COUNT(*)";

/** Joins shared by every query. `s` = SupplyTb. */
const FROM_SUPPLY = `
FROM dbo.SupplyTb s
LEFT JOIN dbo.PackTb     p  ON p.PackTbNo      = s.PackTbNo
LEFT JOIN dbo.SetTb      st ON st.SetTbId      = p.SetTbId
LEFT JOIN dbo.DepartTb   d  ON d.DepartTbId    = s.DepartTbId
LEFT JOIN dbo.PersonTb   pe ON pe.PersonTbId   = s.PersonTbId
LEFT JOIN dbo.DayCountTb dc ON dc.DayCountTbId = s.SuplyCount`;

/** Half-open date range on the indexed column, plus the placeholder row. */
const WHERE_RANGE = `
WHERE s.SupplyNo <> 0
  AND s.SupplyDate >= @from
  AND s.SupplyDate <  @to`;

/** Earliest/latest dispense date — used to list the fiscal years on offer. */
export const SUPPLY_DATE_RANGE_SQL = `
SELECT MIN(SupplyDate) AS minDate, MAX(SupplyDate) AS maxDate
FROM dbo.SupplyTb
WHERE SupplyNo <> 0 AND SupplyDate IS NOT NULL`;

/**
 * Quantity per set × department × calendar month. Month bucketing happens in
 * SQL so DATETIME values never pass through a JS time zone.
 */
export const SUPPLY_AGGREGATE_SQL = `
SELECT
  p.SetTbId       AS setId,
  st.SetTbName    AS setName,
  st.SetTbPrice   AS price,
  d.DepartTbName  AS department,
  YEAR(s.SupplyDate)  AS y,
  MONTH(s.SupplyDate) AS m,
  ${QUANTITY_EXPR} AS qty
${FROM_SUPPLY}
${WHERE_RANGE}
GROUP BY p.SetTbId, st.SetTbName, st.SetTbPrice, d.DepartTbName,
         YEAR(s.SupplyDate), MONTH(s.SupplyDate)`;

/**
 * Optional filters for the row listing. @department / @search are NULL when
 * unused; @noDepartment = 1 selects rows whose department didn't resolve.
 */
const ROW_FILTERS = `
  AND (@department IS NULL OR d.DepartTbName = @department)
  AND (@noDepartment = 0 OR d.DepartTbName IS NULL)
  AND (@search IS NULL OR st.SetTbName LIKE @search ESCAPE '\\' OR p.PackBarcode LIKE @search ESCAPE '\\')`;

export const SUPPLY_ROWS_COUNT_SQL = `
SELECT COUNT(*) AS total
${FROM_SUPPLY}
${WHERE_RANGE}
${ROW_FILTERS}`;

/** Column order follows the team's spec: วันที่จ่าย · ชื่อรายการ · วันหมดอายุ · หน่วยงาน · เจ้าหน้าที่ */
export const SUPPLY_ROWS_SQL = `
SELECT
  s.SupplyNo      AS supplyNo,
  s.SupplyDate    AS supplyDate,
  p.SetTbId       AS setId,
  st.SetTbName    AS setName,
  p.PackBarcode   AS barcode,
  TRY_CAST(dc.DayCountTbName AS INT) AS expiryDays,
  d.DepartTbName  AS department,
  pe.PersonCall   AS person
${FROM_SUPPLY}
${WHERE_RANGE}
${ROW_FILTERS}
ORDER BY s.SupplyDate DESC, s.SupplyNo DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
