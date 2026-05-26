/**
 * Safe, non-destructive migration for the outfit-calendar (ปฏิทินแต่งตัว).
 *   - Creates the `outfit_calendar` table if it does not exist.
 *   - Adds a UNIQUE index on (userId, date) so each user has one plan per day.
 *
 * No existing data is touched. Run:  node scripts/migrate-calendar.mjs
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

const conn = await mysql.createConnection({
  host: u.hostname,
  port: u.port ? Number(u.port) : 4000,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ""),
  ssl: needTls ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
  multipleStatements: true,
});

try {
  console.log("→ Creating `outfit_calendar` table if missing...");
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`outfit_calendar\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`userId\` INT NOT NULL,
      \`date\` VARCHAR(10) NOT NULL,
      \`outfitId\` INT NULL,
      \`luckyNote\` VARCHAR(300) NULL,
      \`weatherNote\` VARCHAR(300) NULL,
      \`pushed\` INT NOT NULL DEFAULT 0,
      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("  ✓ outfit_calendar table ready");

  // Add the unique (userId,date) index only if it isn't there yet.
  const [idx] = await conn.query(
    "SHOW INDEX FROM `outfit_calendar` WHERE Key_name = 'uniq_user_date'",
  );
  if (idx.length === 0) {
    await conn.query(
      "ALTER TABLE `outfit_calendar` ADD UNIQUE INDEX `uniq_user_date` (`userId`, `date`)",
    );
    console.log("  ✓ unique index (userId,date) added");
  } else {
    console.log("  · unique index already present");
  }

  const [rows] = await conn.query("SELECT COUNT(*) AS n FROM `outfit_calendar`");
  console.log(`✅ Migration done. outfit_calendar rows: ${rows[0].n}`);
} catch (e) {
  console.error("❌ Migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
