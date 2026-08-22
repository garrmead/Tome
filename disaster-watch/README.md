# Disaster Watch

Real-time dashboard that tracks natural disasters worldwide, notifies you when
new ones appear, and builds a watchlist of stocks, ETFs, and commodity funds
that tend to be **negatively affected** by each event — surfacing names already
selling off as potential event-driven opportunities to research.

Zero dependencies. One command to run.

## Run it

```bash
cd disaster-watch
node server.mjs          # http://localhost:4310
```

Offline / demo mode (bundled sample data, no internet needed):

```bash
MOCK=1 node server.mjs
```

`PORT=3000 node server.mjs` overrides the port. Requires Node 18+.

## Use it on your phone

The app is a mobile-friendly PWA. Three ways to get it on a phone, in
increasing order of capability:

1. **Same Wi-Fi (quickest).** Start the server on your computer — it prints a
   `Network: http://192.168.x.x:4310` address. Open that URL in your phone's
   browser. The full dashboard (map, feed, watchlist, auto-refresh) works.
   You can "Add to Home Screen" for an app icon, but note that browsers only
   allow service workers and push notifications on HTTPS origins, so over
   plain LAN HTTP those two features stay off.

2. **HTTPS tunnel (full features, still self-hosted).** Point a tunnel at the
   server — e.g. `cloudflared tunnel --url http://localhost:4310` (free, no
   account) or Tailscale Serve — and open the generated `https://` URL on your
   phone. HTTPS unlocks install-to-home-screen as a real app plus
   notifications when new severe events appear.

3. **Host it (works anywhere, always on).** Deploy the folder to any Node
   host or free container tier (Render, Fly.io, Railway…) — a `Dockerfile`
   is included, or just run `node server.mjs`. Your phone then gets the full
   PWA experience from anywhere, and the server keeps polling even when your
   computer is off.

On iPhone, notifications additionally require adding the app to the Home
Screen first (Share → Add to Home Screen), then enabling notifications from
inside the app — that's an iOS platform rule for web apps.

## What it does

- **Tracks disasters in real time** from three free, key-less public feeds,
  refreshed every 60 seconds:
  - **USGS** — earthquakes M4.5+ (past 24h)
  - **NASA EONET** — open wildfires, severe storms, volcanoes, floods, and more
  - **GDACS** — multi-hazard alerts with Red/Orange/Green severity levels
  Events are normalized, deduplicated across feeds, and plotted on a world map
  (Leaflet + OpenStreetMap) with severity-colored markers.
- **Notifies you**: click "Enable notifications" and the browser fires a push
  notification whenever a new warning- or severe-level event appears. New
  events are also badged "new" in the feed.
- **Maps market impact**: each significant event is run through an impact
  engine (`lib/impacts.mjs`) that knows which sectors historically take the
  hit — e.g. hurricanes → P&C insurers, Gulf refiners, coastal utilities,
  airlines, cruise lines; wildfires → California utilities, timber REITs;
  floods → insurers, railroads, agricultural processors and commodity ETFs
  (DBA/CORN/WEAT); earthquakes near Japan/Taiwan → TSMC and the country ETF.
  Delayed quotes come from Stooq (also free, no key), and names already down
  on the day are flagged **dipping** (−1%+) or **dipping hard** (−3%+).

Each data source fails independently — the header shows a green/red status dot
per feed, and the dashboard keeps working with whatever is reachable.

## Architecture

```
server.mjs            zero-dep Node HTTP server, /api/dashboard + static files
lib/sources.mjs       USGS / EONET / GDACS fetchers + normalizers + dedupe
lib/impacts.mjs       disaster type + region -> affected tickers, with reasons
lib/quotes.mjs        Stooq delayed quotes, 5-minute cache
lib/mock.mjs          sample data for MOCK=1 mode
public/               single-page dashboard (map, feed, watchlist, notifications)
```

## Disclaimer

This tool is for research and monitoring only. Nothing it shows is financial
advice; disaster-driven dips can keep falling, and quotes are delayed. Do your
own due diligence.
