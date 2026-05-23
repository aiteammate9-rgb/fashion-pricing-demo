import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// TiDB Cloud (and most managed MySQL) require TLS. Detect it and pass discrete
// credentials + ssl so `drizzle-kit generate/migrate` can connect.
const needsTls = /tidbcloud\.com/i.test(connectionString) || process.env.DB_SSL === "1";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: needsTls
    ? (() => {
        const u = new URL(connectionString);
        return {
          host: u.hostname,
          port: u.port ? Number(u.port) : 4000,
          user: decodeURIComponent(u.username),
          password: decodeURIComponent(u.password),
          database: u.pathname.replace(/^\//, ""),
          ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
        };
      })()
    : { url: connectionString },
});