// Simple JSON "DB" with atomic writes + tiny cache
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const FILE = path.resolve('./data/contacts.json');     // data folder
const TMP  = path.resolve('./data/contacts.tmp.json');

let cache = null;
let dirty = false;
let writing = Promise.resolve();

// ensure file & folder exist
async function ensureFile() {
  await fsp.mkdir(path.dirname(FILE), { recursive: true });
  try {
    await fsp.access(FILE, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(FILE, '{}', 'utf8');
  }
}

async function readAll() {
  if (cache) return cache;
  await ensureFile();
  const raw = await fsp.readFile(FILE, 'utf8');
  cache = raw.trim() ? JSON.parse(raw) : {};
  return cache;
}

async function writeAll(obj) {
  // atomic: write -> rename
  await fsp.writeFile(TMP, JSON.stringify(obj, null, 2), 'utf8');
  await fsp.rename(TMP, FILE);
}

async function flush() {
  if (!dirty) return;
  dirty = false;
  const obj = cache || {};
  await writeAll(obj);
}

function queueWrite() {
  dirty = true;
  // serialize writes
  writing = writing.then(flush).catch(() => {});
  return writing;
}

// Public APIs
export async function getContact(userId) {
  const db = await readAll();
  return db[userId] || null;
}

export async function upsertContact({ user_id, username, global_name, phone, address }) {
  const db = await readAll();
  const now = new Date().toISOString();
  db[user_id] = {
    ...(db[user_id] || {}),
    username: username ?? '',
    global_name: global_name ?? '',
    phone: phone ?? '',
    address: address ?? '',
    updated_at: now
  };
  cache = db;
  await queueWrite();
  return db[user_id];
}

export async function deleteContact(userId) {
  const db = await readAll();
  if (db[userId]) {
    delete db[userId];
    cache = db;
    await queueWrite();
    return true;
  }
  return false;
}

// Optional: export all (for backup)
export async function listContacts() {
  const db = await readAll();
  return db; // { [userId]: {..} }
}
