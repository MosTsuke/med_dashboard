import sql from "mssql";

/**
 * Connection to the hospital's CSSD SQL Server, configured entirely from
 * environment variables (see .env.example). Server-only — never import this
 * from a client component.
 */

export class DbNotConfiguredError extends Error {
  constructor() {
    super("ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล (CSSD_DB_SERVER)");
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
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 15_000,
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
      appName: "med-dashboard",
    },
  };
}

// Survive Next.js dev hot reloads without opening a new pool each time.
const globalForDb = globalThis as unknown as { cssdPool?: Promise<sql.ConnectionPool> };

export function getPool(): Promise<sql.ConnectionPool> {
  if (!globalForDb.cssdPool) {
    const pool = new sql.ConnectionPool(readConfig());
    globalForDb.cssdPool = pool.connect().catch((err) => {
      globalForDb.cssdPool = undefined; // let the next request retry
      throw err;
    });
  }
  return globalForDb.cssdPool;
}

export { sql };
