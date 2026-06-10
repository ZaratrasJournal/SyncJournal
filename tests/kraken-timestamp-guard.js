// Regressie: Kraken _normalise timestamp-guard. Kraken's history-endpoints geven `timestamp`/
// `lastUpdateTimestamp` als ms-integer i.p.v. ISO `fillTime` (docs-onderzoek 2026-06-09). De
// parser moet ISO ÉN epoch accepteren, en NOOIT terugvallen op 1970 (epoch 0). Fix v12.230.
//
// Run: node tests/kraken-timestamp-guard.js

// Replica van toIso + datum-afleiding uit work/tradejournal.html (ExchangeAPI.kraken._normalise)
const toIso = (v) => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" || /^\d{9,}$/.test(String(v).trim())) {
    let n = Number(typeof v === "number" ? v : String(v).trim());
    if (!isFinite(n) || n <= 0) return "";
    if (n < 1e12) n *= 1000;
    const dt = new Date(n); return (isNaN(dt.getTime()) || dt.getTime() <= 0) ? "" : dt.toISOString();
  }
  const dt = new Date(v);
  return (isNaN(dt.getTime()) || dt.getTime() <= 0) ? "" : (String(v).includes("T") ? String(v) : dt.toISOString());
};
const dateOf = (t) => {
  const rawFt = (t.fillTime != null && t.fillTime !== "") ? t.fillTime : (t.timestamp != null ? t.timestamp : t.lastUpdateTimestamp);
  const ft = toIso(rawFt) || toIso(t.open_time); const closeT = toIso(rawFt);
  return closeT ? closeT.split("T")[0] : (ft ? ft.split("T")[0] : "");
};

const cases = [
  { name: "ISO fillTime",            in: { fillTime: "2026-06-06T10:21:47.377Z" }, expect: "2026-06-06" },
  { name: "ms-epoch timestamp",      in: { timestamp: 1780741307377 },             expect: "2026-06-06" },
  { name: "ms-epoch als string",     in: { fillTime: "1780741307377" },            expect: "2026-06-06" },
  { name: "sec-epoch",               in: { timestamp: 1780741307 },                expect: "2026-06-06" },
  { name: "lastUpdateTimestamp ms",  in: { lastUpdateTimestamp: 1780741307377 },   expect: "2026-06-06" },
  { name: "open_time fallback ISO",  in: { open_time: "2026-05-20T08:05:41.250Z" },expect: "2026-05-20" },
  { name: "leeg → geen 1970",        in: { fillTime: "" },                          expect: "" },
  { name: "epoch 0 → geen 1970",     in: { fillTime: 0 },                           expect: "" },
  { name: "null → geen 1970",        in: { fillTime: null },                        expect: "" },
  { name: "garbage → geen 1970",     in: { fillTime: "not-a-date" },                expect: "" },
];

let fail = 0;
for (const c of cases) {
  const got = dateOf(c.in);
  const ok = got === c.expect;
  if (!ok) fail++;
  console.log((ok ? "✓" : "✗"), c.name.padEnd(24), "→", JSON.stringify(got), ok ? "" : `(verwacht ${JSON.stringify(c.expect)})`);
  if (/1970/.test(got)) { console.error("   !! 1970 gelekt"); fail++; }
}
console.log(fail ? `\n${fail} FAIL` : "\n✅ Alle timestamp-formaten correct; geen enkele 1970-fallback.");
process.exit(fail ? 1 : 0);
