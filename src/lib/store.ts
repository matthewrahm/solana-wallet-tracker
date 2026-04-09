import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, "..", "..", "wallets.db");

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    label TEXT,
    chat_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

export interface TrackedWallet {
  address: string;
  label: string | null;
  chat_id: number;
  created_at: string;
}

const insertStmt = db.prepare(
  "INSERT OR IGNORE INTO wallets (address, label, chat_id) VALUES (?, ?, ?)"
);

const deleteStmt = db.prepare("DELETE FROM wallets WHERE address = ? AND chat_id = ?");

const listStmt = db.prepare("SELECT * FROM wallets WHERE chat_id = ?");

const allStmt = db.prepare("SELECT * FROM wallets");

const getStmt = db.prepare("SELECT * FROM wallets WHERE address = ?");

export function addWallet(address: string, label: string | null, chatId: number): boolean {
  const result = insertStmt.run(address, label, chatId);
  return result.changes > 0;
}

export function removeWallet(address: string, chatId: number): boolean {
  const result = deleteStmt.run(address, chatId);
  return result.changes > 0;
}

export function listWallets(chatId: number): TrackedWallet[] {
  return listStmt.all(chatId) as TrackedWallet[];
}

export function getAllWallets(): TrackedWallet[] {
  return allStmt.all() as TrackedWallet[];
}

export function getWallet(address: string): TrackedWallet | undefined {
  return getStmt.get(address) as TrackedWallet | undefined;
}
