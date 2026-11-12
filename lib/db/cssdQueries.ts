import type { DbGrain, DbReportKind } from "@/types";

/**
 * Every SQL statement the dashboard runs against the CSSD database.
 *
 * ── How the real CSSD schema works (confirmed from database exports the
 *    hospital provided, 2026-11) ──
 *
 *  สถิติจ่าย — SupplyTb holds two kinds of dispense rows:
 *   1. Barcoded packs (instrument sets): PackTbNo → a real PackTb row,
 *      SuplyCount = 1, and PackTb.SetTbId = SupplyTb.SetTbId.
 *   2. Consumables (สำลี, ผ้าก๊อซ, ...; SetTbId 5001+): PackTbNo = 0, a
 *      placeholder pack with no set/expiry, and SuplyCount = the quantity
 *      handed out (often more than 1).
 *   item = SupplyTb.SetTbId (PackTb.SetTbId is NULL for consumables),
 *   quantity = SUM(SuplyCount), department = SupplyTb.DepartTbId (where it
 *   went), expiry = the pack's.
 *
 *  สถิติแพ็ค — one PackTb row per pack made: SetTbPackDate, the set, the
 *   department it's made for (PackTb.SetTbDepart), sterilization method
 *   (SetTbSterileType → SterileTb), staff (SetTbPerson1 → PersonTb).
 *   Counted: PackTbActive = 1 only. Inactive packs (~3.5%) are mostly never
 *   dispensed — cancelled packs, it seems; still to confirm with the hospital.
 *
 *  Resterile — DemandTb rows with Resterile > 0: a pack sent back to be
 *   processed again. Resterile is the reason code (→ ReCauseTb), DemandDate
 *   the date, DepartTbId the department that sent it back, DemandRequest
 *   the quantity (always 1 so far). The hospital's own query gave the same
 *   monthly totals. (ReceiveTb is a delivery receipt, not resterile.)
 *
 *  For every report: name = SetTb.SetTbName2 (SetTbName1 is a code); unit
 *  price = SetTb.SetTbPrice, or the price stamped on the pack for sets since
 *  deleted from SetTb (their names are gone; only the ids remain).
 *
 *  Still unconfirmed with the hospital: whether SUM(SuplyCount) is the
 *  number they want for consumables, whether inactive packs count, and what
 *  to call deleted sets.
 *
 * ── Ground rule: the CSSD program must never notice the dashboard ──
 *  Everything here is a SELECT. The login must be read-only (client.ts
 *  refuses one that can write), and every table is read WITH (NOLOCK) so the
 *  dashboard takes no shared locks: it can't hold up the CSSD program's own
 *  inserts and updates, and never waits behind them either. The trade-off —
 *  a row that is mid-insert can be counted a moment early — doesn't matter
 *  for monthly statistics.
 */

const NOLOCK = "WITH (NOLOCK)";

/** The SQL behind one report. Every report uses the same aliases — `p`
 * PackTb, `st` SetTb, `d` DepartTb, `pe` PersonTb — and returns the same
 * columns, so the code above it treats all of them alike. */
export interface ReportSql {
  /** → minDate, maxDate: lists the fiscal years on offer. */
  dateRange: string;
  /** Per grain: @from, @to → setId, setName, setPrice, packPrice,
   * department, bucket, qty per set × department × time bucket. `bucket` is
   * the bucket's first day (a DATE), worked out in SQL so DATETIME values
   * never pass through a JS time zone. */
  aggregate: Record<DbGrain, string>;
  /** @from, @to + row filters → total. */
  rowsCount: string;
  /** … + @offset, @pageSize → id, at, setId, setName, barcode, quantity,
   * expiryDate, department, person, note; newest first. */
  rows: string;
}

/** First day of the bucket `date` falls in: the day itself, the 1st of its
 * month, or 1 Oct starting its fiscal year (ปีงบ N = 1 Oct N-1 … 30 Sep N). */
function bucketExpr(grain: DbGrain, date: string): string {
  if (grain === "day") return `CAST(${date} AS date)`;
  if (grain === "month") return `DATEFROMPARTS(YEAR(${date}), MONTH(${date}), 1)`;
  return `DATEFROMPARTS(YEAR(DATEADD(month, 3, ${date})) - 1, 10, 1)`;
}

const ITEM_NAME_EXPR = `COALESCE(NULLIF(LTRIM(RTRIM(st.SetTbName2)), ''), NULLIF(LTRIM(RTRIM(st.SetTbName1)), ''))`;

/**
 * Optional filters for the record list. @department / @search are NULL when
 * unused; @noDepartment = 1 selects rows whose department didn't resolve.
 */
const ROW_FILTERS = `
  AND (@department IS NULL OR d.DepartTbName = @department)
  AND (@noDepartment = 0 OR d.DepartTbName IS NULL)
  AND (@search IS NULL
       OR st.SetTbName2 LIKE @search ESCAPE '\\'
       OR st.SetTbName1 LIKE @search ESCAPE '\\'
       OR CAST(p.PackBarcode AS VARCHAR(20)) LIKE @search ESCAPE '\\')`;

function reportSql(spec: {
  /** FROM … joins, using the shared aliases. */
  from: string;
  /** Rows that belong to the report at all (no date range). */
  where: string;
  /** The event's date/time column. */
  date: string;
  setId: string;
  /** Quantity of one row. */
  qty: string;
  /** Unique row id, newest-last tiebreak. */
  id: string;
  note: string;
  /** Just the base table, for the cheap min/max date query. */
  dateRangeFrom: string;
  dateRangeWhere: string;
  dateRangeDate: string;
}): ReportSql {
  const range = `${spec.where}
  AND ${spec.date} >= @from
  AND ${spec.date} <  @to`;
  const aggregate = (grain: DbGrain) => {
    const bucket = bucketExpr(grain, spec.date);
    return `
SELECT
  ${spec.setId}           AS setId,
  ${ITEM_NAME_EXPR}       AS setName,
  MAX(st.SetTbPrice)      AS setPrice,
  MAX(p.SetTbPrice)       AS packPrice,
  d.DepartTbName          AS department,
  ${bucket}               AS bucket,
  SUM(${spec.qty})        AS qty
${spec.from}
WHERE ${range}
GROUP BY ${spec.setId}, ${ITEM_NAME_EXPR}, d.DepartTbName, ${bucket}`;
  };
  return {
    dateRange: `
SELECT MIN(${spec.dateRangeDate}) AS minDate, MAX(${spec.dateRangeDate}) AS maxDate
${spec.dateRangeFrom}
WHERE ${spec.dateRangeWhere} AND ${spec.dateRangeDate} IS NOT NULL`,
    aggregate: { day: aggregate("day"), month: aggregate("month"), year: aggregate("year") },
    rowsCount: `
SELECT COUNT(*) AS total
${spec.from}
WHERE ${range}
${ROW_FILTERS}`,
    rows: `
SELECT
  ${spec.id}            AS id,
  ${spec.date}          AS at,
  ${spec.setId}         AS setId,
  ${ITEM_NAME_EXPR}     AS setName,
  p.PackBarcode         AS barcode,
  ${spec.qty}           AS quantity,
  p.SetTbExpireDate     AS expiryDate,
  d.DepartTbName        AS department,
  pe.PersonCall         AS person,
  ${spec.note}          AS note
${spec.from}
WHERE ${range}
${ROW_FILTERS}
ORDER BY ${spec.date} DESC, ${spec.id} DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
  };
}

export const REPORT_SQL: Record<DbReportKind, ReportSql> = {
  // สถิติจ่าย — `s` = SupplyTb. PackTbNo 0 is the consumables placeholder
  // pack, so it's never joined. SupplyNo 0 is a placeholder row.
  supply: reportSql({
    from: `
FROM dbo.SupplyTb s ${NOLOCK}
LEFT JOIN dbo.PackTb   p  ${NOLOCK} ON p.PackTbNo    = s.PackTbNo AND s.PackTbNo <> 0
LEFT JOIN dbo.SetTb    st ${NOLOCK} ON st.SetTbId    = s.SetTbId
LEFT JOIN dbo.DepartTb d  ${NOLOCK} ON d.DepartTbId  = s.DepartTbId
LEFT JOIN dbo.PersonTb pe ${NOLOCK} ON pe.PersonTbId = s.PersonTbId`,
    where: "s.SupplyNo <> 0",
    date: "s.SupplyDate",
    setId: "s.SetTbId",
    qty: "COALESCE(s.SuplyCount, 1)",
    id: "s.SupplyNo",
    note: "CAST(NULL AS NVARCHAR(100))",
    dateRangeFrom: `FROM dbo.SupplyTb ${NOLOCK}`,
    dateRangeWhere: "SupplyNo <> 0",
    dateRangeDate: "SupplyDate",
  }),

  // สถิติแพ็ค — `p` = PackTb itself; PackTbNo 0 is the placeholder pack.
  pack: reportSql({
    from: `
FROM dbo.PackTb p ${NOLOCK}
LEFT JOIN dbo.SetTb     st ${NOLOCK} ON st.SetTbId     = p.SetTbId
LEFT JOIN dbo.DepartTb  d  ${NOLOCK} ON d.DepartTbId   = p.SetTbDepart
LEFT JOIN dbo.SterileTb sr ${NOLOCK} ON sr.SterileTbId = p.SetTbSterileType
LEFT JOIN dbo.PersonTb  pe ${NOLOCK} ON pe.PersonTbId  = p.SetTbPerson1`,
    where: "p.PackTbNo <> 0 AND p.PackTbActive = 1",
    date: "p.SetTbPackDate",
    setId: "p.SetTbId",
    qty: "1",
    id: "p.PackTbNo",
    note: `COALESCE(NULLIF(LTRIM(RTRIM(sr.SterileTbName2)), ''), sr.SterileTbName)`,
    dateRangeFrom: `FROM dbo.PackTb ${NOLOCK}`,
    dateRangeWhere: "PackTbNo <> 0 AND PackTbActive = 1",
    dateRangeDate: "SetTbPackDate",
  }),

  // Resterile — `dm` = DemandTb rows with a resterile reason.
  resterile: reportSql({
    from: `
FROM dbo.DemandTb dm ${NOLOCK}
LEFT JOIN dbo.PackTb    p  ${NOLOCK} ON p.PackTbNo    = dm.PackTbNo AND dm.PackTbNo <> 0
LEFT JOIN dbo.SetTb     st ${NOLOCK} ON st.SetTbId    = dm.SetTbId
LEFT JOIN dbo.DepartTb  d  ${NOLOCK} ON d.DepartTbId  = dm.DepartTbId
LEFT JOIN dbo.ReCauseTb rc ${NOLOCK} ON rc.ReId       = dm.Resterile
LEFT JOIN dbo.PersonTb  pe ${NOLOCK} ON pe.PersonTbId = dm.PersonTbId`,
    where: "dm.Resterile > 0",
    date: "dm.DemandDate",
    setId: "dm.SetTbId",
    qty: "COALESCE(dm.DemandRequest, 1)",
    id: "dm.DemandNo",
    note: `COALESCE(NULLIF(LTRIM(RTRIM(rc.ReDetail)), ''), N'สาเหตุ ' + CAST(dm.Resterile AS NVARCHAR(10)))`,
    dateRangeFrom: `FROM dbo.DemandTb ${NOLOCK}`,
    dateRangeWhere: "Resterile > 0",
    dateRangeDate: "DemandDate",
  }),
};

/**
 * Run once per connection pool: any 1 here means the login could change
 * data, and client.ts refuses to use it. HAS_PERMS_BY_NAME covers grants
 * made directly on the table; the role checks cover the usual shortcuts.
 */
export const WRITE_ACCESS_SQL = `
SELECT
  IS_SRVROLEMEMBER('sysadmin')                           AS sysadmin,
  IS_ROLEMEMBER('db_owner')                              AS dbOwner,
  IS_ROLEMEMBER('db_datawriter')                         AS dbDataWriter,
  IS_ROLEMEMBER('db_ddladmin')                           AS dbDdlAdmin,
  HAS_PERMS_BY_NAME('dbo.SupplyTb', 'OBJECT', 'INSERT')  AS canInsert,
  HAS_PERMS_BY_NAME('dbo.SupplyTb', 'OBJECT', 'UPDATE')  AS canUpdate,
  HAS_PERMS_BY_NAME('dbo.SupplyTb', 'OBJECT', 'DELETE')  AS canDelete`;
