import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const FILE = path.resolve('./data/reminders.json');
const TMP  = path.resolve('./data/reminders.tmp.json');

let cache = null;

async function ensureFile() {
  await fsp.mkdir(path.dirname(FILE), { recursive: true });
  try { await fsp.access(FILE, fs.constants.F_OK); }
  catch { await fsp.writeFile(FILE, JSON.stringify({ seq: 0, items: [], tokens: {} }, null, 2), 'utf8'); }
}

async function readAll() {
  if (cache) return cache;
  await ensureFile();
  const raw = await fsp.readFile(FILE, 'utf8');
  const obj = raw.trim() ? JSON.parse(raw) : { seq: 0, items: [], tokens: {} };
  if (!obj.seq && obj.seq !== 0) obj.seq = 0;
  if (!Array.isArray(obj.items)) obj.items = [];
  if (!obj.tokens || typeof obj.tokens !== 'object') obj.tokens = {};
  cache = obj;
  return cache;
}

async function writeAll(obj) {
  await fsp.writeFile(TMP, JSON.stringify(obj, null, 2), 'utf8');
  await fsp.rename(TMP, FILE);
  cache = obj;
}

function makeId(len = 6) {
  return crypto.randomBytes(len).toString('hex');
}

export async function createReminderToken(payload, ttlMs = 10 * 60 * 1000) {
  const db = await readAll();
  const token = makeId();
  const now = Date.now();
  db.tokens[token] = { payload, expiresAt: now + ttlMs, createdAt: new Date(now).toISOString() };
  await writeAll(db);
  return token;
}

export async function consumeReminderToken(token) {
  const db = await readAll();
  const rec = db.tokens[token];
  if (!rec) return null;
  delete db.tokens[token];
  await writeAll(db);
  if (rec.expiresAt && rec.expiresAt < Date.now()) return null;
  return rec.payload;
}

export async function addReminder({ createdBy, guildId, targetType, targetId, message, remindAt }) {
  const db = await readAll();
  const id = ++db.seq;
  const now = new Date().toISOString();
  db.items.push({
    id,
    createdBy,
    guildId: guildId || null,
    targetType, // 'channel' | 'user'
    targetId,
    message,
    remindAt,   // ISO string
    status: 'pending', // 'pending' | 'sent' | 'failed' | 'cancelled'
    created_at: now,
    updated_at: now,
    sent_at: null,
    error: null,
  });
  await writeAll(db);
  return id;
}

export async function listDue(now = new Date()) {
  const db = await readAll();
  const ts = typeof now === 'string' ? Date.parse(now) : +now;
  return db.items.filter(x => x.status === 'pending' && Date.parse(x.remindAt) <= ts)
    .sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt));
}

export async function markSent(id) {
  const db = await readAll();
  const item = db.items.find(x => x.id === Number(id));
  if (!item) return false;
  item.status = 'sent';
  item.sent_at = new Date().toISOString();
  item.updated_at = item.sent_at;
  await writeAll(db);
  return true;
}

export async function markFailed(id, error) {
  const db = await readAll();
  const item = db.items.find(x => x.id === Number(id));
  if (!item) return false;
  item.status = 'failed';
  item.error = String(error || 'unknown');
  item.updated_at = new Date().toISOString();
  await writeAll(db);
  return true;
}

export async function cleanupExpiredTokens() {
  const db = await readAll();
  const now = Date.now();
  let changed = false;
  for (const [k, v] of Object.entries(db.tokens)) {
    if (!v || (v.expiresAt && v.expiresAt < now)) {
      delete db.tokens[k];
      changed = true;
    }
  }
  if (changed) await writeAll(db);
}


