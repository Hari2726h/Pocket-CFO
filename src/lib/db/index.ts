import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __pocketCfoDb: Database.Database | undefined;
}

function createConnection(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || "./data/pocketcfo.sqlite";
  const resolved = path.resolve(process.cwd(), dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.resolve(process.cwd(), "src/lib/db/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  return db;
}

// Reuse a single connection across Next.js hot-reloads / route invocations.
export function getDb(): Database.Database {
  if (!global.__pocketCfoDb) {
    global.__pocketCfoDb = createConnection();
  }
  return global.__pocketCfoDb;
}
