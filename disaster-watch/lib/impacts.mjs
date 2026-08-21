// Impact engine: maps a disaster (type + location) to securities and
// commodity ETFs that historically tend to be NEGATIVELY affected by that
// kind of event — insurers absorbing claims, utilities with damaged
// infrastructure, airlines with cancellations, regional country ETFs, etc.
// The output is a research watchlist, not a trade recommendation.

// Country name fragment -> single-country ETF hit hardest by a local disaster.
const COUNTRY_ETFS = [
  ["japan", "EWJ.US", "iShares MSCI Japan"],
  ["taiwan", "EWT.US", "iShares MSCI Taiwan"],
  ["korea", "EWY.US", "iShares MSCI South Korea"],
  ["china", "MCHI.US", "iShares MSCI China"],
  ["india", "INDA.US", "iShares MSCI India"],
  ["indonesia", "EIDO.US", "iShares MSCI Indonesia"],
  ["philippines", "EPHE.US", "iShares MSCI Philippines"],
  ["thailand", "THD.US", "iShares MSCI Thailand"],
  ["vietnam", "VNM.US", "VanEck Vietnam"],
  ["malaysia", "EWM.US", "iShares MSCI Malaysia"],
  ["australia", "EWA.US", "iShares MSCI Australia"],
  ["new zealand", "ENZL.US", "iShares MSCI New Zealand"],
  ["mexico", "EWW.US", "iShares MSCI Mexico"],
  ["brazil", "EWZ.US", "iShares MSCI Brazil"],
  ["chile", "ECH.US", "iShares MSCI Chile"],
  ["peru", "EPU.US", "iShares MSCI Peru"],
  ["turkey", "TUR.US", "iShares MSCI Turkey"],
  ["greece", "GREK.US", "Global X MSCI Greece"],
  ["italy", "EWI.US", "iShares MSCI Italy"],
  ["spain", "EWP.US", "iShares MSCI Spain"],
  ["germany", "EWG.US", "iShares MSCI Germany"],
  ["france", "EWQ.US", "iShares MSCI France"],
  ["united kingdom", "EWU.US", "iShares MSCI United Kingdom"],
  ["canada", "EWC.US", "iShares MSCI Canada"],
  ["south africa", "EZA.US", "iShares MSCI South Africa"],
];

const T = (symbol, name, reason) => ({ symbol, name, reason });

const INSURERS = [
  T("ALL.US", "Allstate", "Property & casualty claims exposure"),
  T("TRV.US", "Travelers", "Property & casualty claims exposure"),
  T("CB.US", "Chubb", "Commercial property claims exposure"),
  T("RNR.US", "RenaissanceRe", "Catastrophe reinsurance losses"),
];

const AIRLINES = [
  T("DAL.US", "Delta Air Lines", "Flight cancellations and rebooking costs"),
  T("UAL.US", "United Airlines", "Flight cancellations and hub disruption"),
  T("AAL.US", "American Airlines", "Flight cancellations and hub disruption"),
];

const CRUISES = [
  T("CCL.US", "Carnival", "Itinerary disruption and port closures"),
  T("RCL.US", "Royal Caribbean", "Itinerary disruption and port closures"),
];

const AG_COMMODITIES = [
  T("DBA.US", "Invesco DB Agriculture ETF", "Crop damage disrupts agricultural supply"),
  T("CORN.US", "Teucrium Corn ETF", "Corn belt crop damage"),
  T("WEAT.US", "Teucrium Wheat ETF", "Wheat harvest disruption"),
];

const AG_PROCESSORS = [
  T("ADM.US", "Archer-Daniels-Midland", "Higher input costs, damaged supply chains"),
  T("BG.US", "Bunge", "Crop sourcing and processing disruption"),
];

// type -> { sectors: base tickers, usOnly: added when event is in the US,
//           regionEtf: include the country ETF, note }
const TYPE_IMPACTS = {
  earthquake: {
    sectors: INSURERS,
    regionEtf: true,
    special: (ev) => {
      const text = `${ev.title} ${ev.place}`.toLowerCase();
      if (text.includes("taiwan") || text.includes("japan"))
        return [T("TSM.US", "TSMC", "Fab shutdown risk near seismic activity")];
      return [];
    },
  },
  "tropical cyclone": {
    sectors: [
      ...INSURERS,
      ...AIRLINES,
      ...CRUISES,
    ],
    usOnly: [
      T("VLO.US", "Valero Energy", "Gulf coast refinery shut-ins"),
      T("MPC.US", "Marathon Petroleum", "Refinery shut-ins and margin hit"),
      T("ETR.US", "Entergy", "Gulf coast grid damage and restoration costs"),
      T("CNP.US", "CenterPoint Energy", "Texas/Louisiana grid damage"),
    ],
    regionEtf: true,
  },
  wildfire: {
    sectors: [
      ...INSURERS.slice(0, 2),
      T("WY.US", "Weyerhaeuser", "Timberland destruction"),
      T("RYN.US", "Rayonier", "Timberland destruction"),
    ],
    usOnly: [
      T("PCG.US", "PG&E", "Utility ignition liability (California)"),
      T("EIX.US", "Edison International", "Utility ignition liability (California)"),
    ],
    regionEtf: true,
  },
  flood: {
    sectors: [...INSURERS.slice(0, 3), ...AG_COMMODITIES.slice(0, 1), ...AG_PROCESSORS],
    usOnly: [
      T("UNP.US", "Union Pacific", "Track washouts and rerouting costs"),
      T("CSX.US", "CSX", "Track washouts and rerouting costs"),
    ],
    regionEtf: true,
  },
  volcano: {
    sectors: [...AIRLINES, ...CRUISES.slice(0, 1)],
    regionEtf: true,
  },
  drought: {
    sectors: [...AG_PROCESSORS, ...AG_COMMODITIES],
    regionEtf: true,
  },
  "severe storm": {
    sectors: [...INSURERS.slice(0, 2), ...AIRLINES.slice(0, 2)],
    regionEtf: true,
  },
  "winter storm": {
    sectors: [...AIRLINES, T("CNP.US", "CenterPoint Energy", "Grid strain and outage costs")],
    regionEtf: true,
  },
  tsunami: {
    sectors: [
      ...INSURERS.slice(0, 3),
      T("ZIM.US", "ZIM Integrated Shipping", "Port closures and route disruption"),
    ],
    regionEtf: true,
  },
  landslide: { sectors: INSURERS.slice(0, 2), regionEtf: true },
  "dust storm": { sectors: AIRLINES.slice(0, 2), regionEtf: true },
};

const US_HINTS = [
  "united states", " usa", ", ca", ", tx", ", la", ", fl", ", ok", ", ak", ", hi",
  "california", "texas", "louisiana", "florida", "oklahoma", "alaska", "hawaii",
  "puerto rico", "gulf of mexico", "gulf of america",
];

function isUS(ev) {
  const text = ` ${ev.title} ${ev.place}`.toLowerCase();
  return US_HINTS.some((h) => text.includes(h));
}

function regionEtfFor(ev) {
  const text = `${ev.title} ${ev.place}`.toLowerCase();
  for (const [frag, symbol, name] of COUNTRY_ETFS) {
    if (text.includes(frag))
      return T(symbol, name, `Country ETF for the affected region (${frag.replace(/\b\w/g, (c) => c.toUpperCase())})`);
  }
  return null;
}

// Only WARNING/SEVERE events generate watchlist entries — an M4.6 aftershock
// in open ocean should not page anyone about insurance stocks.
export function impactsFor(event) {
  if (event.severity < 2) return [];
  const rule = TYPE_IMPACTS[event.type];
  if (!rule) return [];

  const tickers = [...rule.sectors];
  if (rule.usOnly && isUS(event)) tickers.push(...rule.usOnly);
  if (rule.special) tickers.push(...rule.special(event));
  if (rule.regionEtf) {
    const etf = regionEtfFor(event);
    if (etf) tickers.push(etf);
  }

  // De-dupe by symbol, keep first reason.
  const seen = new Set();
  return tickers.filter((t) => !seen.has(t.symbol) && seen.add(t.symbol));
}

export function buildOpportunities(events, quotesBySymbol) {
  const out = [];
  for (const ev of events) {
    const impacts = impactsFor(ev);
    if (!impacts.length) continue;
    out.push({
      event: ev,
      impacts: impacts.map((t) => {
        const q = quotesBySymbol[t.symbol] || null;
        const changePct = q?.changePct ?? null;
        return {
          ...t,
          quote: q,
          // A name already selling off on a severe event is the "deal" signal.
          signal:
            changePct == null
              ? "no-data"
              : changePct <= -3
              ? "strong-dip"
              : changePct <= -1
              ? "dip"
              : "stable",
        };
      }),
    });
  }
  return out;
}

export function allSymbols(events) {
  const set = new Set();
  for (const ev of events) for (const t of impactsFor(ev)) set.add(t.symbol);
  return [...set];
}
