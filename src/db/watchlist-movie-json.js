import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const FILE = path.resolve('./data/watchlist_movies.json');
const TMP  = path.resolve('./data/watchlist_movies.tmp.json');

let cache = null;

async function ensureFile() {
  await fsp.mkdir(path.dirname(FILE), { recursive: true });
  try { await fsp.access(FILE, fs.constants.F_OK); }
  catch { await fsp.writeFile(FILE, '{}', 'utf8'); }
}
async function readAll() {
  if (cache) return cache;
  await ensureFile();
  const raw = await fsp.readFile(FILE, 'utf8');
  cache = raw.trim() ? JSON.parse(raw) : {};
  return cache;
}
async function writeAll(obj) {
  await fsp.writeFile(TMP, JSON.stringify(obj, null, 2), 'utf8');
  await fsp.rename(TMP, FILE);
  cache = obj;
}

function ensureUser(db, userId) {
  if (!db[userId]) db[userId] = { seq: 0, items: [] };
  return db[userId];
}

/** Add item; returns numeric id */
export async function addMovie(userId, { title, year, platform, link, note }) {
  const db = await readAll();
  const u = ensureUser(db, userId);
  const id = ++u.seq;
  const now = new Date().toISOString();
  u.items.push({
    id,
    title: title.trim(),
    year: year ? String(year) : null,
    platform: platform ? platform.trim() : null,  // e.g., Netflix/Prime/Bioskop
    link: link || null,                           // optional URL (trailer / TMDB / etc.)
    note: note || '',
    status: 'open',                               // open | done
    created_at: now,
    updated_at: now,
    completed_at: null
  });
  await writeAll(db);
  return id;
}

export async function listMovies(userId, { status } = {}) {
  const db = await readAll();
  const u = db[userId];
  if (!u) return [];
  const arr = status ? u.items.filter(x => x.status === status) : u.items;
  // Sort by ID in ascending order
  return arr.slice().sort((a, b) => (a.id - b.id)).map(movie => ({
    ...movie,
    watchLink: `https://1flix.to/search/${movie.title.replace(/\s+/g, '-').toLowerCase()}`
  }));
}

export async function completeMovie(userId, id) {
  const db = await readAll();
  const u = db[userId];
  if (!u) return false;
  const itemIndex = u.items.findIndex(x => x.id === Number(id));
  if (itemIndex === -1) return false;

  const item = u.items[itemIndex];
  item.status = 'done';
  item.updated_at = new Date().toISOString();
  item.completed_at = item.updated_at;

  // Remove the movie from the watchlist after marking as completed
  u.items.splice(itemIndex, 1);

  // Reindex remaining items so IDs become 1..n in ascending order
  // This ensures when an item is removed, subsequent items shift up
  u.items.sort((a, b) => a.id - b.id);
  for (let i = 0; i < u.items.length; i += 1) {
    u.items[i].id = i + 1;
    u.items[i].updated_at = new Date().toISOString();
  }

  // Keep sequence in sync with the latest count so next add continues at the end
  u.seq = u.items.length;

  await writeAll(db);
  return true;
}
