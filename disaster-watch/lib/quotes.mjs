// Delayed quotes from Stooq's free CSV endpoint (no API key). Symbols use
// Stooq notation, e.g. "ALL.US". Cached for 5 minutes; failures degrade to
// watchlist-without-prices rather than breaking the dashboard.

import { MOCK_QUOTES } from "./mock.mjs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // symbol -> { quote, at }

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const quotes = {};
  for (const line of lines.slice(1)) {
    // Symbol,Date,Time,Open,High,Low,Close,Volume
    const [symbol, , , open, , , close] = line.split(",");
    const o = parseFloat(open);
    const c = parseFloat(close);
    if (!symbol || !Number.isFinite(c)) continue;
    quotes[symbol.toUpperCase()] = {
      symbol: symbol.toUpperCase(),
      price: c,
      changePct: Number.isFinite(o) && o > 0 ? +(((c - o) / o) * 100).toFixed(2) : null,
    };
  }
  return quotes;
}

export async function getQuotes(symbols, { mock = false } = {}) {
  if (mock) {
    const out = {};
    for (const s of symbols) if (MOCK_QUOTES[s]) out[s] = MOCK_QUOTES[s];
    return { quotes: out, ok: true, mock: true };
  }

  const now = Date.now();
  const fresh = {};
  const stale = [];
  for (const s of symbols) {
    const hit = cache.get(s);
    if (hit && now - hit.at < CACHE_TTL_MS) fresh[s] = hit.quote;
    else stale.push(s);
  }

  let ok = true;
  // Stooq accepts space-separated symbol lists; keep batches modest.
  for (let i = 0; i < stale.length; i += 20) {
    const batch = stale.slice(i, i + 20);
    try {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(batch.join(" ").toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseCsv(await res.text());
      for (const [sym, q] of Object.entries(parsed)) {
        cache.set(sym, { quote: q, at: now });
        fresh[sym] = q;
      }
    } catch {
      ok = false;
    }
  }
  return { quotes: fresh, ok };
}
