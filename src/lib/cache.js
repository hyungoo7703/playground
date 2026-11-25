// Stale-While-Revalidate cache backed by localStorage.
// Pages render the cached copy instantly, then refresh it after the GAS round trip.
// The number goes up when the shape of what is cached changes (see SHAPES in api.js),
// so copies saved by an older build are never rendered.
const PREFIX = "swr2:";

for (const key of Object.keys(localStorage)) {
  if (key.startsWith("swr:")) localStorage.removeItem(key);
}

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
