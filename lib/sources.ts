import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { SourceRecord } from './types';
import { canStoreJob } from './licensing';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'internlens.sqlite');
const SEED_PATH = path.join(DATA_DIR, 'sources.json');

let db: DatabaseSync | undefined;

function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, name_zh TEXT NOT NULL, url TEXT NOT NULL,
      category TEXT NOT NULL, category_zh TEXT NOT NULL, trust_level TEXT NOT NULL,
      storage_policy TEXT NOT NULL, policy_evidence TEXT NOT NULL, policy_url TEXT NOT NULL,
      last_reviewed TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS permitted_jobs (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id), title TEXT NOT NULL,
      organization TEXT NOT NULL, posting_url TEXT NOT NULL, license_evidence TEXT NOT NULL,
      last_reviewed TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  seedSources(db);
  return db;
}

function seedSources(database: DatabaseSync) {
  const records = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as SourceRecord[];
  const insert = database.prepare(`INSERT INTO sources
    (id, name, name_zh, url, category, category_zh, trust_level, storage_policy, policy_evidence, policy_url, last_reviewed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, name_zh=excluded.name_zh, url=excluded.url,
    category=excluded.category, category_zh=excluded.category_zh, trust_level=excluded.trust_level,
    storage_policy=excluded.storage_policy, policy_evidence=excluded.policy_evidence,
    policy_url=excluded.policy_url, last_reviewed=excluded.last_reviewed`);
  database.exec('BEGIN');
  try {
    for (const row of records) insert.run(row.id, row.name, row.nameZh, row.url, row.category, row.categoryZh, row.trustLevel, row.storagePolicy, row.policyEvidence, row.policyUrl, row.lastReviewed);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function listSources(): SourceRecord[] {
  const database = getDb();
  const activeIds = new Set((JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as SourceRecord[]).map((source) => source.id));
  const rows = (database.prepare('SELECT * FROM sources ORDER BY trust_level, name').all() as Array<Record<string, string>>).filter((row) => activeIds.has(row.id));
  return rows.map((row) => ({
    id: row.id, name: row.name, nameZh: row.name_zh, url: row.url,
    category: row.category, categoryZh: row.category_zh,
    trustLevel: row.trust_level as SourceRecord['trustLevel'],
    storagePolicy: row.storage_policy as SourceRecord['storagePolicy'],
    policyEvidence: row.policy_evidence, policyUrl: row.policy_url, lastReviewed: row.last_reviewed,
  }));
}

export function sourceForUrl(url: string | undefined): SourceRecord | undefined {
  if (!url) return undefined;
  let hostname: string;
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { return undefined; }
  let pathname: string;
  try { pathname = new URL(url).pathname.replace(/\/$/, '') || '/'; } catch { return undefined; }
  return listSources().find((source) => {
    try {
      const sourceUrl = new URL(source.url);
      const sourceHost = sourceUrl.hostname.toLowerCase();
      const sameHost = hostname === sourceHost || hostname === `www.${sourceHost}`;
      const sourcePath = sourceUrl.pathname.replace(/\/$/, '') || '/';
      const samePath = sourcePath === '/' || pathname === sourcePath || pathname.startsWith(`${sourcePath}/`);
      return sameHost && samePath;
    } catch { return false; }
  });
}

export function mayStoreJob(sourceId: string): boolean {
  const row = getDb().prepare('SELECT storage_policy FROM sources WHERE id = ?').get(sourceId) as { storage_policy?: string } | undefined;
  return !!row?.storage_policy && canStoreJob(row.storage_policy);
}

export function storePermittedJob(job: {
  id: string; sourceId: string; title: string; organization: string; postingUrl: string;
  licenseEvidence: string; lastReviewed: string;
}): void {
  if (!mayStoreJob(job.sourceId) || !job.licenseEvidence.trim()) {
    throw new Error('A job can be stored only when its source is licensed and license evidence is recorded.');
  }
  getDb().prepare(`INSERT INTO permitted_jobs
    (id, source_id, title, organization, posting_url, license_evidence, last_reviewed)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(job.id, job.sourceId, job.title, job.organization, job.postingUrl, job.licenseEvidence, job.lastReviewed);
}
