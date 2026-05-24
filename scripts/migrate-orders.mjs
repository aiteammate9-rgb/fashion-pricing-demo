/**
 * Safe, non-destructive migration for the cross-user buy flow.
 *  1. Adds 'reserved' to wardrobe.status enum (keeps all existing rows)
 *  2. Creates the `orders` table if it does not exist
 *
 * Why not `drizzle-kit push`? Its push planner flags the enum change as
 * data-loss and offers to TRUNCATE the wardrobe table. Adding an enum value
 * in MySQL is actually non-destructive, so we run the exact ALTER ourselves.
 *
 * Run:  node scripts/migrate-orders.mjs
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
  console.log("→ Adding 'reserved' to wardrobe.status enum (non-destructive)...");
  await conn.query(
    "ALTER TABLE `wardrobe` MODIFY COLUMN `status` ENUM('in_wardrobe','listed','reserved','sold') NOT NULL DEFAULT 'in_wardrobe'",
  );
  console.log("  ✓ enum updated");

  console.log("→ Creating `orders` table if missing...");
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`orders\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`buyerUserId\` INT NOT NULL,
      \`sellerUserId\` INT NOT NULL,
      \`itemId\` INT NOT NULL,
      \`outfitId\` INT NULL,
      \`priceBaht\` INT NOT NULL,
      \`status\` ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
      \`note\` VARCHAR(500) NULL,
      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("  ✓ orders table ready");

  const [rows] = await conn.query("SELECT COUNT(*) AS n FROM `wardrobe`");
  console.log(`✅ Migration done. wardrobe rows intact: ${rows[0].n}`);
} catch (e) {
  console.error("❌ Migration failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await conn.end();
}
