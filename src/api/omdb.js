import 'dotenv/config';

const API = 'http://www.omdbapi.com/';

function u(params) {
  const q = new URLSearchParams({ apikey: process.env.OMDB_API_KEY, ...params });
  return `${API}?${q.toString()}`;
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const j = await res.json();
  if (j.Response === 'False') throw new Error(j.Error || 'OMDb error');
  return j;
}

// Search by title (top results)
export async function searchTitle(title, { type, year, page = 1 } = {}) {
  const params = { s: title, page };
  if (type) params.type = type;     // movie | series | episode
  if (year) params.y = String(year);
  const j = await getJSON(u(params));
  // j.Search = [{ Title, Year, imdbID, Type, Poster }, ...]
  return (j.Search || []).slice(0, 3);
}

// Detail by IMDb ID
export async function getById(imdbID) {
  return getJSON(u({ i: imdbID, plot: 'short' }));
}
