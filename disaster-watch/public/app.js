/* Disaster Watch frontend: polls /api/dashboard every 60s, renders the map,
   disaster feed and impact watchlist, and fires browser notifications for
   newly-seen significant events. */

const POLL_MS = 60_000;
const SEEN_KEY = "disaster-watch:seen-ids";
const TYPE_ICONS = {
  earthquake: "🌐",
  "tropical cyclone": "🌀",
  wildfire: "🔥",
  flood: "🌊",
  volcano: "🌋",
  drought: "☀️",
  "severe storm": "⛈️",
  "winter storm": "❄️",
  tsunami: "🌊",
  landslide: "⛰️",
  "dust storm": "🌪️",
};
const SEV_LABEL = { 1: "advisory", 2: "warning", 3: "severe" };

let map = null;
let markerLayer = null;
let firstLoad = true;

function initMap() {
  const el = document.getElementById("map");
  if (typeof L === "undefined") {
    el.classList.add("unavailable");
    el.textContent = "Map unavailable (Leaflet CDN unreachable) — feed below still live.";
    return;
  }
  map = L.map("map", { worldCopyJump: true }).setView([20, 10], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function renderMap(events) {
  if (!map) return;
  markerLayer.clearLayers();
  const colors = { 1: "#4cd97b", 2: "#ffab40", 3: "#ff5d5d" };
  for (const ev of events) {
    if (ev.lat == null || ev.lon == null) continue;
    L.circleMarker([ev.lat, ev.lon], {
      radius: 4 + ev.severity * 3,
      color: colors[ev.severity],
      fillColor: colors[ev.severity],
      fillOpacity: 0.55,
      weight: 1.5,
    })
      .bindPopup(
        `<strong>${TYPE_ICONS[ev.type] || "⚠️"} ${escapeHtml(ev.title)}</strong><br>` +
          `${escapeHtml(ev.type)} · ${SEV_LABEL[ev.severity]}` +
          (ev.url ? `<br><a href="${ev.url}" target="_blank" rel="noopener">details</a>` : "")
      )
      .addTo(markerLayer);
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function getSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveSeen(set) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-500))); }
  catch { /* private mode */ }
}

function notifyNewEvents(events) {
  const seen = getSeen();
  const fresh = events.filter((e) => !seen.has(e.id));
  for (const e of events) seen.add(e.id);
  saveSeen(seen);

  // Don't notification-blast on the very first visit.
  if (firstLoad) { firstLoad = false; return fresh; }

  if (Notification?.permission === "granted") {
    for (const e of fresh.filter((e) => e.severity >= 2).slice(0, 5)) {
      new Notification(`${TYPE_ICONS[e.type] || "⚠️"} ${e.title}`, {
        body: `${e.type} · ${SEV_LABEL[e.severity]} · via ${e.source}`,
        tag: e.id,
      });
    }
  }
  return fresh;
}

function renderSources(sources) {
  document.getElementById("source-status").innerHTML = sources
    .map(
      (s) =>
        `<span class="src ${s.ok ? "ok" : "down"}" title="${s.ok ? `${s.count} items` : escapeHtml(s.error || "unreachable")}">${escapeHtml(s.name)}</span>`
    )
    .join("");
}

function renderEvents(events, freshIds) {
  const el = document.getElementById("events");
  document.getElementById("event-count").textContent = `(${events.length})`;
  if (!events.length) {
    el.innerHTML = `<p class="empty">No active disasters reported by the feeds right now.</p>`;
    return;
  }
  el.innerHTML = events
    .map(
      (ev) => `
      <div class="card">
        <div class="title-row">
          <span>${TYPE_ICONS[ev.type] || "⚠️"}</span>
          ${ev.url ? `<a href="${ev.url}" target="_blank" rel="noopener">${escapeHtml(ev.title)}</a>` : `<span>${escapeHtml(ev.title)}</span>`}
          <span class="badge sev-${ev.severity}">${SEV_LABEL[ev.severity]}</span>
          ${freshIds.has(ev.id) ? `<span class="badge new">new</span>` : ""}
        </div>
        <div class="meta">${escapeHtml(ev.type)}${ev.magnitude ? ` · M${ev.magnitude}` : ""}${ev.place ? ` · ${escapeHtml(ev.place)}` : ""} · ${timeAgo(ev.time)} · ${escapeHtml(ev.source)}</div>
      </div>`
    )
    .join("");
}

function renderOpportunities(opps) {
  const el = document.getElementById("opportunities");
  document.getElementById("opp-count").textContent = `(${opps.length} events)`;
  if (!opps.length) {
    el.innerHTML = `<p class="empty">No warning/severe events with mapped market impacts right now.</p>`;
    return;
  }
  el.innerHTML = opps
    .map(({ event: ev, impacts }) => {
      const rows = impacts
        .map((t) => {
          const chg = t.quote?.changePct;
          const chgCls = chg == null ? "flat" : chg < 0 ? "down" : chg > 0 ? "up" : "flat";
          const chgTxt = chg == null ? "—" : `${chg > 0 ? "+" : ""}${chg.toFixed(2)}%`;
          const sig =
            t.signal === "strong-dip"
              ? `<span class="sig strong-dip">dipping hard</span>`
              : t.signal === "dip"
              ? `<span class="sig dip">dipping</span>`
              : "";
          return `
            <div class="ticker">
              <span class="sym">${escapeHtml(t.symbol.replace(".US", ""))}</span>
              <span class="name">${escapeHtml(t.name)}</span>
              <span class="reason">${escapeHtml(t.reason)}</span>
              <span class="chg ${chgCls}">${chgTxt}</span>
              ${sig}
            </div>`;
        })
        .join("");
      return `
      <div class="card">
        <div class="title-row">
          <span>${TYPE_ICONS[ev.type] || "⚠️"}</span>
          <span style="font-weight:600">${escapeHtml(ev.title)}</span>
          <span class="badge sev-${ev.severity}">${SEV_LABEL[ev.severity]}</span>
        </div>
        <div class="tickers">${rows}</div>
      </div>`;
    })
    .join("");
}

async function refresh() {
  try {
    const res = await fetch("/api/dashboard");
    const data = await res.json();
    document.getElementById("mock-banner").hidden = !data.mock;
    renderSources(data.sources);
    const fresh = notifyNewEvents(data.events);
    renderEvents(data.events, new Set(fresh.map((e) => e.id)));
    renderOpportunities(data.opportunities);
    renderMap(data.events);
  } catch (err) {
    console.error("refresh failed", err);
  }
}

document.getElementById("notify-btn").addEventListener("click", async () => {
  if (!("Notification" in window)) return alert("This browser does not support notifications.");
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    const btn = document.getElementById("notify-btn");
    btn.textContent = "🔔 Notifications on";
    btn.classList.add("enabled");
  }
});

if ("Notification" in window && Notification.permission === "granted") {
  const btn = document.getElementById("notify-btn");
  btn.textContent = "🔔 Notifications on";
  btn.classList.add("enabled");
}

initMap();
refresh();
setInterval(refresh, POLL_MS);
