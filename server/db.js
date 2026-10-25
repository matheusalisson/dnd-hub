// Banco SQLite embutido no Node (node:sqlite), sem dependências externas.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Só o hash SHA-256 do token fica salvo; o token em si vive apenas no cookie do navegador.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- Combatentes, rodada, criaturas próprias e campanha ativa: dados de um só usuário.
  CREATE TABLE IF NOT EXISTS personal_data (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    background TEXT NOT NULL DEFAULT 'mountains',
    image_url TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaign_members (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    PRIMARY KEY (campaign_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS campaign_invites (
    code_hash TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- Anotação sem campanha é pessoal; ligada a uma campanha, todos os membros a veem.
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_members_user ON campaign_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_notes_campaign ON notes(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_notes_author ON notes(author_id);
`;

export function openDatabase(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

// Executa fn dentro de uma transação, desfazendo tudo se algo falhar. Dentro de outra, só participa dela.
export function transaction(db, fn) {
  if (db.isTransaction) return fn();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
