// Stale-While-Revalidate cache backed by localStorage.
// Pages render the cached copy instantly, then refresh it after the GAS round trip.
const PREFIX = "swr:";

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(PREFIX + key);
    return null;
  }
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // storage full or unavailable — cache is best-effort
  }
}
