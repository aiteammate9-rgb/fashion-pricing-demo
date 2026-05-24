/**
 * Safe, non-destructive migration: add heightCm / weightKg to style_profiles.
 * Idempotent — checks information_schema before altering, so re-running is safe.
 *
 * Run:  node scripts/migrate-profile-fields.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL not set (.env)");
  process.exit(1);
}

const u = new URL(url);
const needTls = /tidbcloud\.com/i.test(u.hostname) || process.env.DB_SSL === "1";
const dbName = u.pathname.replace(/^\//, "");

const conn = await mysql.createConnection({
  host: u.hostname,
  port: u.port ? Number(u.port) : 4000,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: dbName,
  ssl: needTls ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
});

async function hasColumn(table, column) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?",
    [dbName, table, column],
  );
  return rows[0].n > 0;
}

try {
  for (const col of ["heightCm", "weightKg"]) {
    if (await hasColumn("style_profiles", col)) {
      console.log(`• style_profiles.${col} already exists — skip`);
    } else {
      console.log(`→ Adding style_profiles.${col} ...`);
      await conn.query(`ALTER TABLE \`style_profiles\` ADD COLUMN \`${col}\` INT NULL`);
      console.log(`  ✓ added`);
    }
  }
  console.log("✅ Profile fields migration done.");
} catch (e) {
  console.error("❌ Migration failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await conn.end();
}
