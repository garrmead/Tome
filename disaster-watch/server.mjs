// Disaster Watch — zero-dependency Node server.
//   node server.mjs            live feeds (USGS, NASA EONET, GDACS, Stooq)
//   MOCK=1 node server.mjs     bundled sample data, works fully offline
//   PORT=3000 to override the default port 4310.

import http from "node:http";
import { networkInterfaces } from "node:os";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchAllDisasters } from "./lib/sources.mjs";
import { buildOpportunities, allSymbols } from "./lib/impacts.mjs";
import { getQuotes } from "./lib/quotes.mjs";

const PORT = Number(process.env.PORT) || 4310;
const MOCK = process.env.MOCK === "1" || process.env.MOCK === "true";
const PUBLIC_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Cache the aggregated dashboard for 60s so a busy tab doesn't hammer the feeds.
let dashboardCache = { at: 0, payload: null };

async function buildDashboard() {
  const now = Date.now();
  if (dashboardCache.payload && now - dashboardCache.at < 60_000) return dashboardCache.payload;

  const { events, sources } = await fetchAllDisasters({ mock: MOCK });
  const symbols = allSymbols(events);
  const { quotes, ok: quotesOk } = await getQuotes(symbols, { mock: MOCK });
  const payload = {
    generatedAt: new Date().toISOString(),
    mock: MOCK,
    sources: [...sources, { name: "Stooq quotes", ok: quotesOk, count: Object.keys(quotes).length, ...(MOCK && { mock: true }) }],
    events,
    opportunities: buildOpportunities(events, quotes),
  };
  dashboardCache = { at: now, payload };
  return payload;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    if (url.pathname === "/api/dashboard") {
      return sendJson(res, 200, await buildDashboard());
    }

    // Static files
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    path = normalize(path).replace(/^(\.\.[/\\])+/, "");
    const file = join(PUBLIC_DIR, path);
    if (!file.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: "forbidden" });
    try {
      const data = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      return res.end(data);
    } catch {
      return sendJson(res, 404, { error: "not found" });
    }
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: String(err?.message || err) });
  }
});

// 0.0.0.0 so phones and tablets on the same network can connect.
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Disaster Watch${MOCK ? " (MOCK mode)" : ""}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  for (const addr of lan) console.log(`  Network: http://${addr}:${PORT}  <- open this on your phone (same Wi-Fi)`);
  if (!lan.length) console.log("  (no LAN address found — phone access needs a network interface)");
});
