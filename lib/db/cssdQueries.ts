/**
 * Every SQL statement the dashboard runs against the CSSD database.
 *
 * ── How the real CSSD schema works (confirmed from a database export the
 *    hospital provided, 2026-11) ──
 *
 *  SupplyTb holds two kinds of dispense rows:
 *   1. Barcoded packs (instrument sets): PackTbNo → a real PackTb row,
 *      SuplyCount = 1, and PackTb.SetTbId = SupplyTb.SetTbId.
 *   2. Consumables (สำลี, ผ้าก๊อซ, ...; SetTbId 5001+): PackTbNo = 0, a
 *      placeholder pack with no set/expiry, and SuplyCount = the quantity
 *      handed out (often more than 1).
 *  So:
 *   - item       = SupplyTb.SetTbId (NOT PackTb.SetTbId — that's NULL for
 *                  consumables); name = SetTb.SetTbName2 (SetTbName1 is a code)
 *   - quantity   = SUM(SuplyCount)
 *   - unit price = SetTb.SetTbPrice; for sets since deleted from SetTb, the
 *                  price stamped on the pack (PackTb.SetTbPrice) instead
 *   - expiry     = PackTb.SetTbExpireDate (consumables have none)
 *   - department = SupplyTb.DepartTbId → DepartTb.DepartTbName
 *
 *  Note: the hospital's own dbo.fn_Report_Aggregate counts dispenses as
 *  COUNT(PackTb rows) grouped by PackTb.SetTbId, which lumps every consumable
 *  into set 0 and counts rows instead of quantity. We deliberately differ
 *  there; barcoded-pack totals agree with it.
 *
 *  Still unconfirmed with the hospital: whether SUM(SuplyCount) is the
 *  number they want for consumables, and what to call sets that no longer
 *  exist in SetTb (their names are gone; only the ids remain).
 */

export const QUANTITY_EXPR = "SUM(COALESCE(s.SuplyCount, 1))";

/** Joins shared by every query. `s` = SupplyTb. PackTbNo 0 is the
 * consumables placeholder pack, so it's never joined. */
const FROM_SUPPLY = `
FROM dbo.SupplyTb s
LEFT JOIN dbo.PackTb   p  ON p.PackTbNo    = s.PackTbNo AND s.PackTbNo <> 0
LEFT JOIN dbo.SetTb    st ON st.SetTbId    = s.SetTbId
LEFT JOIN dbo.DepartTb d  ON d.DepartTbId  = s.DepartTbId
LEFT JOIN dbo.PersonTb pe ON pe.PersonTbId = s.PersonTbId`;

const ITEM_NAME_EXPR = `COALESCE(NULLIF(LTRIM(RTRIM(st.SetTbName2)), ''), NULLIF(LTRIM(RTRIM(st.SetTbName1)), ''))`;

/** Half-open date range on SupplyDate. SupplyNo 0 is a placeholder row. */
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
  s.SetTbId              AS setId,
  ${ITEM_NAME_EXPR}      AS setName,
  MAX(st.SetTbPrice)     AS setPrice,
  MAX(p.SetTbPrice)      AS packPrice,
  d.DepartTbName         AS department,
  YEAR(s.SupplyDate)     AS y,
  MONTH(s.SupplyDate)    AS m,
  ${QUANTITY_EXPR}       AS qty
${FROM_SUPPLY}
${WHERE_RANGE}
GROUP BY s.SetTbId, ${ITEM_NAME_EXPR}, d.DepartTbName,
         YEAR(s.SupplyDate), MONTH(s.SupplyDate)`;

/**
 * Optional filters for the row listing. @department / @search are NULL when
 * unused; @noDepartment = 1 selects rows whose department didn't resolve.
 */
const ROW_FILTERS = `
  AND (@department IS NULL OR d.DepartTbName = @department)
  AND (@noDepartment = 0 OR d.DepartTbName IS NULL)
  AND (@search IS NULL
       OR st.SetTbName2 LIKE @search ESCAPE '\\'
       OR st.SetTbName1 LIKE @search ESCAPE '\\'
       OR CAST(p.PackBarcode AS VARCHAR(20)) LIKE @search ESCAPE '\\')`;

export const SUPPLY_ROWS_COUNT_SQL = `
SELECT COUNT(*) AS total
${FROM_SUPPLY}
${WHERE_RANGE}
${ROW_FILTERS}`;

/** Column order follows the team's spec: วันที่จ่าย · ชื่อรายการ · วันหมดอายุ · หน่วยงาน · เจ้าหน้าที่ */
export const SUPPLY_ROWS_SQL = `
SELECT
  s.SupplyNo            AS supplyNo,
  s.SupplyDate          AS supplyDate,
  s.SetTbId             AS setId,
  ${ITEM_NAME_EXPR}     AS setName,
  p.PackBarcode         AS barcode,
  COALESCE(s.SuplyCount, 1) AS quantity,
  p.SetTbExpireDate     AS expiryDate,
  d.DepartTbName        AS department,
  pe.PersonCall         AS person
${FROM_SUPPLY}
${WHERE_RANGE}
${ROW_FILTERS}
ORDER BY s.SupplyDate DESC, s.SupplyNo DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
