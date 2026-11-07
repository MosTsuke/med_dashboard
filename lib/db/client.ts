import sql from "mssql";
import { WRITE_ACCESS_SQL } from "@/lib/db/cssdQueries";

/**
 * Connection to the hospital's CSSD SQL Server, configured entirely from
 * environment variables (see .env.example). Server-only — never import this
 * from a client component.
 *
 * The database belongs to the CSSD program the hospital runs every day; the
 * dashboard only reads it. Besides read-only SQL (see cssdQueries.ts) this
 * file keeps the load small: at most 2 queries at a time, each cancelled on
 * the server after 30 s, and a login that can change data is refused.
 */

export class DbNotConfiguredError extends Error {
  constructor() {
    super("ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล (CSSD_DB_SERVER)");
  }
}

/** The configured login could change data, so the dashboard won't use it. */
export class DbWriteAccessError extends Error {
  constructor() {
    super(
      "login ที่ตั้งไว้สามารถแก้ไขข้อมูลในฐานข้อมูลได้ ระบบจึงไม่เชื่อมต่อ " +
        "ให้ใช้ login แบบอ่านอย่างเดียว (db_datareader) ตามคู่มือ db/README.md"
    );
  }
}

export function isDbConfigured(): boolean {
  return !!process.env.CSSD_DB_SERVER;
}

function readConfig(): sql.config {
  const env = process.env;
  if (!env.CSSD_DB_SERVER) throw new DbNotConfiguredError();

  const flag = (v: string | undefined, fallback: boolean) =>
    v == null || v === "" ? fallback : /^(1|true|yes)$/i.test(v);

  return {
    server: env.CSSD_DB_SERVER,
    // A named instance like "SQLEXPRESS" is resolved through the SQL Browser
    // service; set CSSD_DB_PORT instead when the instance has a fixed port.
    port: env.CSSD_DB_PORT ? Number(env.CSSD_DB_PORT) : undefined,
    database: env.CSSD_DB_NAME || "CSSD",
    user: env.CSSD_DB_USER,
    password: env.CSSD_DB_PASSWORD,
    // Two connections cover one page load (the record list runs its count
    // and its page side by side); more users simply queue behind them
    // instead of adding load on the CSSD server.
    pool: { max: 2, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 15_000,
    // On timeout the driver tells SQL Server to cancel the query, so a slow
    // query can't keep working the server after the dashboard gives up.
    requestTimeout: 30_000,
    options: {
      instanceName: env.CSSD_DB_INSTANCE || undefined,
      encrypt: flag(env.CSSD_DB_ENCRYPT, true),
      // SQL Server Express ships with a self-signed certificate.
      trustServerCertificate: flag(env.CSSD_DB_TRUST_SERVER_CERT, true),
      // DATETIME columns have no time zone. Reading/writing them as UTC keeps
      // the stored wall-clock digits unchanged end to end (we format with
      // getUTC* and build parameters with Date.UTC).
      useUTC: true,
      // Shows up in SQL Server's activity monitor, so IT can tell the
      // dashboard's sessions apart from the CSSD program's.
      appName: "med-dashboard",
    },
  };
}

async function connect(): Promise<sql.ConnectionPool> {
  const pool = await new sql.ConnectionPool(readConfig()).connect();
  try {
    const { recordset } = await pool
      .request()
      .query<Record<string, number | null>>(WRITE_ACCESS_SQL);
    if (Object.values(recordset[0] ?? {}).some((v) => v === 1)) {
      throw new DbWriteAccessError();
    }
    return pool;
  } catch (err) {
    await pool.close().catch(() => {});
    throw err;
  }
}

// Survive Next.js dev hot reloads without opening a new pool each time.
const globalForDb = globalThis as unknown as { cssdPool?: Promise<sql.ConnectionPool> };

export function getPool(): Promise<sql.ConnectionPool> {
  if (!globalForDb.cssdPool) {
    globalForDb.cssdPool = connect().catch((err) => {
      globalForDb.cssdPool = undefined; // let the next request retry
      throw err;
    });
  }
  return globalForDb.cssdPool;
}

export { sql };
