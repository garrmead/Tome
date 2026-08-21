// Disaster data sources: USGS (earthquakes), NASA EONET (wildfires/storms/
// volcanoes/floods), GDACS (multi-hazard with Red/Orange/Green alert levels).
// All public, no API keys. Each source fails independently.

import { MOCK_EVENTS } from "./mock.mjs";

const FETCH_TIMEOUT_MS = 15_000;

export const SEVERITY = { ADVISORY: 1, WARNING: 2, SEVERE: 3 };

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { "user-agent": "disaster-watch/1.0", ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// USGS earthquakes (M4.5+ past day)

async function fetchUsgs() {
  const res = await fetchWithTimeout(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
  );
  const data = await res.json();
  return (data.features || []).map((f) => {
    const mag = f.properties.mag ?? 0;
    return {
      id: `usgs:${f.id}`,
      source: "USGS",
      type: "earthquake",
      title: f.properties.title || `M${mag} earthquake`,
      place: f.properties.place || "",
      severity: mag >= 7 ? SEVERITY.SEVERE : mag >= 5.5 ? SEVERITY.WARNING : SEVERITY.ADVISORY,
      magnitude: mag,
      lat: f.geometry?.coordinates?.[1] ?? null,
      lon: f.geometry?.coordinates?.[0] ?? null,
      time: f.properties.time ? new Date(f.properties.time).toISOString() : null,
      url: f.properties.url || null,
    };
  });
}

// ---------------------------------------------------------------------------
// NASA EONET open events

const EONET_TYPE_MAP = {
  wildfires: "wildfire",
  severeStorms: "severe storm",
  volcanoes: "volcano",
  floods: "flood",
  drought: "drought",
  earthquakes: "earthquake",
  landslides: "landslide",
  snow: "winter storm",
  dustHaze: "dust storm",
};

async function fetchEonet() {
  const res = await fetchWithTimeout(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=120"
  );
  const data = await res.json();
  const events = [];
  for (const e of data.events || []) {
    const cat = e.categories?.[0]?.id;
    const type = EONET_TYPE_MAP[cat];
    if (!type) continue;
    const geo = e.geometry?.[e.geometry.length - 1];
    const coords = geo?.coordinates;
    // Points are [lon, lat]; polygons are nested — take the first vertex.
    const point = Array.isArray(coords?.[0]) ? coords.flat(Infinity).slice(0, 2) : coords;
    events.push({
      id: `eonet:${e.id}`,
      source: "NASA EONET",
      type,
      title: e.title,
      place: "",
      severity:
        type === "severe storm" || type === "volcano" ? SEVERITY.WARNING : SEVERITY.ADVISORY,
      magnitude: null,
      lat: point?.[1] ?? null,
      lon: point?.[0] ?? null,
      time: geo?.date || null,
      url: e.sources?.[0]?.url || null,
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// GDACS RSS (Red/Orange/Green multi-hazard alerts)

const GDACS_TYPE_MAP = {
  EQ: "earthquake",
  TC: "tropical cyclone",
  FL: "flood",
  VO: "volcano",
  DR: "drought",
  WF: "wildfire",
  TS: "tsunami",
};

function xmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchGdacs() {
  const res = await fetchWithTimeout("https://www.gdacs.org/xml/rss.xml");
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.map((item, i) => {
    const alert = xmlTag(item, "gdacs:alertlevel").toLowerCase();
    const eventType = xmlTag(item, "gdacs:eventtype").toUpperCase();
    const point = xmlTag(item, "georss:point").split(/\s+/).map(Number);
    const eventId = xmlTag(item, "gdacs:eventid") || `item${i}`;
    const pubDate = xmlTag(item, "pubDate");
    return {
      id: `gdacs:${eventType}:${eventId}`,
      source: "GDACS",
      type: GDACS_TYPE_MAP[eventType] || "disaster",
      title: xmlTag(item, "title"),
      place: xmlTag(item, "gdacs:country"),
      severity:
        alert === "red" ? SEVERITY.SEVERE : alert === "orange" ? SEVERITY.WARNING : SEVERITY.ADVISORY,
      magnitude: null,
      lat: Number.isFinite(point[0]) ? point[0] : null,
      lon: Number.isFinite(point[1]) ? point[1] : null,
      time: pubDate ? new Date(pubDate).toISOString() : null,
      url: xmlTag(item, "link") || null,
    };
  });
}

// ---------------------------------------------------------------------------
// Aggregation

// Two earthquakes from different feeds within ~1 degree and 6 hours are the
// same event; keep the higher-severity report.
function dedupe(events) {
  const out = [];
  for (const e of events.sort((a, b) => b.severity - a.severity)) {
    const dup = out.find(
      (o) =>
        o.type === e.type &&
        o.lat != null &&
        e.lat != null &&
        Math.abs(o.lat - e.lat) < 1 &&
        Math.abs(o.lon - e.lon) < 1 &&
        o.time &&
        e.time &&
        Math.abs(new Date(o.time) - new Date(e.time)) < 6 * 3600 * 1000
    );
    if (!dup) out.push(e);
  }
  return out;
}

export async function fetchAllDisasters({ mock = false } = {}) {
  if (mock) {
    return {
      events: MOCK_EVENTS,
      sources: [
        { name: "USGS", ok: true, count: MOCK_EVENTS.filter((e) => e.source === "USGS").length, mock: true },
        { name: "NASA EONET", ok: true, count: MOCK_EVENTS.filter((e) => e.source === "NASA EONET").length, mock: true },
        { name: "GDACS", ok: true, count: MOCK_EVENTS.filter((e) => e.source === "GDACS").length, mock: true },
      ],
    };
  }

  const jobs = [
    { name: "USGS", fn: fetchUsgs },
    { name: "NASA EONET", fn: fetchEonet },
    { name: "GDACS", fn: fetchGdacs },
  ];
  const results = await Promise.allSettled(jobs.map((j) => j.fn()));
  const events = [];
  const sources = results.map((r, i) => {
    if (r.status === "fulfilled") {
      events.push(...r.value);
      return { name: jobs[i].name, ok: true, count: r.value.length };
    }
    return { name: jobs[i].name, ok: false, error: String(r.reason?.message || r.reason) };
  });

  const deduped = dedupe(events).sort(
    (a, b) => b.severity - a.severity || new Date(b.time || 0) - new Date(a.time || 0)
  );
  return { events: deduped, sources };
}
