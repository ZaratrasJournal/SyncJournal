# SyncJournal — Backlog

Werklijst voor Denny & Sebas. Staat per status gegroepeerd. Sluit een item af door hem naar **Done** te verplaatsen met korte notitie + PR-link.

Basis kwam uit de feature-diff v4_14 → v9 onderaan. Inmiddels werken we op **v12** (Sebas' nieuwe baseline) — diff is als referentie nog handig maar niet meer leidend.

---

## 🐛 Bugs (prio — eerst fixen)

<!-- Denny stuurt bugs 1 voor 1 — elk item krijgt datum + korte reproductiestap. -->

- [ ] **Glow rond progress-cirkel verschijnt als vierkant** *(2026-04-28, gemeld door Denny)* — op het Dashboard bij maand-doelen (Win-rate / Doel: 60% card) zie je de cirkel-progress correct gerenderd, maar de glow eromheen is **rechthoekig zichtbaar** in plaats van een cirkel-aura. Symptoom: SVG circle is rond, maar `box-shadow` of `filter: drop-shadow` is op een rechthoekige container i.p.v. op het SVG-pad zelf, waardoor de glow een vierkante bounding-box vormt. Te checken: (a) GoalsRings / RingProgress component — heeft de wrapper-div een `boxShadow:"0 0 X rgba(...)"` die rechthoekig blijft? (b) Glow zou via SVG `filter` op `<circle>` moeten lopen (dropShadow op SVG-element met `<defs>` blur), niet op de container; (c) Mogelijk theme-specifiek — check op alle 6 themes. Reproductie: Dashboard → scroll naar maand-doelen Goals-rings → kijk naar de glow rond bv. Win-rate cirkel → glow lijkt vierkant. Fix: vervang container `boxShadow` met SVG `<filter id="glow">` + `filter:url(#glow)` op de progress-circle. Of: gebruik `border-radius:50%` op de glow-container.
- [ ] **Hyperliquid live balance wordt niet opgehaald in BALANS bovenin** *(2026-04-24, gemeld door Denny)* — Hyperliquid `testConnection` haalt nu alleen `clearinghouseState.marginSummary.accountValue` op (perp-only equity). Te checken: (a) returnt de call überhaupt `success: true` met `balance > 0` voor Denny's wallet — debug via console of de hook hyperliquid wel oppakt; (b) `useLiveExchangeBalances` skipt mogelijk wallet-only exchanges door de check `if(ex.walletOnly){if(!cfg.walletAddress)continue;}` — of werkt die correct?; (c) als de wallet alleen spot-balance heeft (`spotClearinghouseState.balances` met USDC/USDT) telt dat nu niet mee in `accountValue` — uitbreiden met spot-fetch zou nodig zijn (zoals we eerder probeerden in een teruggedraaide v12.30 patch). Reproductie: Denny's profiel met Hyperliquid wallet ingevuld → Hyperliquid contributeert niets aan BALANS bovenin. Code: [work/tradejournal.html:1642-1647](work/tradejournal.html#L1642-L1647) (testConnection) + [work/tradejournal.html:1924-1958](work/tradejournal.html#L1924-L1958) (hook).

## 🔜 Next up (deze of volgende werksessie)

- [ ] **🥇 AI Trade Autopsy** — knop "🔍 AI Autopsy" in trade-detail. Input: screenshots (multi, sinds v12.32) + entry/exit/SL/TP + actieve Trading Rules + setup/mistake/emotion-tags + write-up. Vragen in NL: "Voldeed mijn entry aan mijn regels? Volgde ik mijn exit-plan? Welk patroon zie je? Belangrijkste verbeterpunt? Als je mijn coach was — wat zou je zeggen?". Output → `aiAutopsy` veld op trade. Stack-keuze open: (a) opt-in user-supplied API-key (privacy + geen kosten voor ons, sluit non-techies uit) of (b) gedeelde Cloudflare Worker met community-budget. Default voorstel: optie (a). Effort: 1–2 dagen. Bouwt voort op multi-screenshot uit v12.32.
- [ ] **🥈 AI Super-Prompt "Wat heeft prioriteit?"** — knop bovenaan Tendencies-tab. Aggregeert laatste 10 autopsies + huidige tendencies → 1 zin top-prioriteit + 3 concrete acties voor deze week. Voorkomt overfitting bij veel tendencies. Hangt af van Autopsy-feature (genoeg autopsies om te aggregeren). Effort: 3–4u na Autopsy.
- [ ] **Pre-Market Game Plan tab** — dagelijkse template: watchlist (pairs), bias per pair, news/catalysts, mood-check. Match later op die dag gelogde trades → "matchte je pre-market bias" / "niet". Optionele AI-laag: priority-table uit watchlist + news. Effort: 1–2 dagen.
- [ ] **Alerts Cookbook in Help-tab** — copy-paste Pine Script alert-prompts voor Claude (opening range break + volume + VWAP, etc). Pure docs, community-marketing waarde. Effort: ~2u.
- [ ] **🧠 Best Trade of the Week — Steenbarger ritueel** *(uit research 2026-04-28)* — wekelijks Dashboard-blok dat automatisch je top-R-trade van afgelopen 7 dagen pakt en 3 vragen stelt: (1) *Welke entry-trigger zag je?* (2) *Waarom durfde je deze size?* (3) *Wat maakte dit een pivotal moment?* Antwoorden slaan op als notitie + voeden over tijd een nieuw **"Best Practices"-tabblad**. Doel: app van problem-focused (verlies-post-mortem) naar 50/50 solution-focused trekken. Bron: Brett Steenbarger SMB Summit 2026 talk *"Positive Trading Psychology"* — *"Be more consistent in being who we already are at our best."* Effort: ~1 release (~3-4u). Storage: nieuwe key `tj_best_trade_reviews`. Aanbevolen als eerste Steenbarger-feature — kleine scope, hoge impact.
- [ ] **🧠 Strengths-onboarding + Strengths Heatmap** *(uit research 2026-04-28, larger scope)* — eenmalige onboarding waar user 3 signature strengths kiest uit VIA-lijst (Curiosity / Grit / Patience / Analytical / Decisive / Adaptive / Disciplined / etc.). Per Playbook-setup tonen of die setup hun strengths benut of er tegenin gaat (*"Deze setup vereist Patience + Decisive — past bij jouw profiel"*). Plus een **Strengths Heatmap** naast de bestaande Discipline Heatmap — "hoe vaak vandaag een strength benut" als solution-focused tegenhanger. Effort: 2-3 dagen. Vereist eerst Best Trade of the Week om data te genereren waarmee de strengths zich bewijzen.
- [ ] **🧠 2D Mindset-grid (emotional × cognitive axis)** *(uit research 2026-04-28)* — Steenbargers april-2026 update: mindset is 2D, niet 1D. Twee sliders bij elke trade-entry: **emotional axis** (calm ↔ nervous) + **cognitive axis** (focused ↔ distracted). Top-performers tonen "flexibility of perspective" — de cross-correlatie geeft veel rijker signaal dan een enkel rustig/nerveus-veld. Effort: ~half dag UI + Analytics-correlatie.
- [ ] **🧠 Decision-space-meter per trade** *(uit research 2026-04-28, out-of-the-box)* — meet hoeveel "knoppen" een trade heeft (1=mechanisch level-X long; 6=open-space met sizing/scaling/multi-TP). Routeert het review-formulier: 1-2 knoppen = problem-focused review (poker-stijl leak-plugging), 4+ knoppen = solution-focused review (Steenbarger-stijl best-trade reverse-engineering). Niemand doet dit. Effort: ~half dag.
- [ ] **🧠 Pre-Market Strengths Primer** *(uit research 2026-04-28, out-of-the-box, blocked)* — 3-min ritueel vóór eerste trade van de dag: app toont jouw top-3 best-executed trades ooit met notes erbij. Solution-focused warm-up (zoals een pianist een Bach-prelude speelt vóór het concert, niet het concertstuk zelf). **Geblokkeerd**: vereist eerst Best Trade of the Week feature om data op te bouwen, anders is er niks om te tonen.
- [ ] **Tiltmeter (emotie 1-10 per trade)** — Edgewonk's USP. Correleer met PnL. Fase 2 van proces-focus (Fase 1 is al live, Discipline Heatmap afgerond 2026-04-22).
- [ ] **Pre-trade checklist builder** — user definieert 5-10 items (entry-criteria, risk-check, bias confirmation). Per trade score → toegevoegd aan Analytics Proces-mode.
- [ ] **Checklist-streak gamification** — Duolingo-stijl streak-counter voor "checklist volledig ingevuld X dagen op rij". Loss aversion werkt.
- [ ] **Mindset-reminders fase 2** — 4 deferred contexten: risk-exceeded inline warning, heatmap-red-zone warning in TradeForm, emotion-tag tooltip (opgewonden/hebzuchtig), weekend sidebar-whisper. Fase 1 (banner + pre-trade + post-loss) live sinds 2026-04-22.
- [ ] **Dag-limiet / tilt guard** — modal bij N losses op dag. Data zit in Trading Rules.
- [ ] **Trade-voucher / shareable link** — base64 URL-fragment. Read-only modal.
- [ ] **Discord webhook** bij PnL-milestones — community leeft op Discord. Moeite: L.
- [ ] **TradingView Lightweight Charts embed** — interactieve mini-chart in trade-detail i.p.v. link. 40KB, gratis. Moeite: M.
- [ ] **Weekly performance summary** — lokaal gegenereerd, geen AI nodig voor v1. Pure aggregatie. Moeite: L.
- [ ] **MFE/MAE exit-efficiency scatter** — vereist MFE/MAE data uit exchange-fills.
- [ ] **PnL Calendar Heatmap** — 13-weken grid, GitHub-stijl.
- [ ] **Scratch segmentation donut** — "True Win-rate" los van scratch trades.
- [ ] **Funding & Fees Drain waterfall** — crypto-futures specifiek, onderscheidend.
- [ ] **Underwater Drawdown chart** — hedge-fund standaard.

## 📋 Quick wins (klein, geïsoleerd, laag risico)

- [ ] **Blofin — near-liquidation warning** — mark-price vs liquidationPrice check, oranje/rode badge als binnen 10% van liq. Vereist mark-price feed (extra API-call per positie of een quote-poll). Middelgroot.
- [ ] **Blofin — live "last refresh" indicator** — klein tijdje "3s geleden" badge naast open-posities om zichtbaar te maken dat auto-refresh draait. Puur UI, geen logica.
- [ ] **Blofin — R:R live berekening** — nu SL/TP meekomt van API kunnen we live R:R tonen in trade-detail. Trivial UI-toevoeging (R:R computed uit entry/SL/TP).
- [ ] **Hyperliquid toevoegen** — kan volledig client-side (public info-endpoint, geen proxy). Zie `Agent` onderzoek van 2026-04-14.
- [ ] **MAE-to-Stop ratio per setup** (idee #12) — uitbreiding op Setup Insights tabel als we MAE data hebben.

## ⚠️ Risky (refactor of schema-migratie)

- [ ] **PDFReportModal herintroduceren** — groot component, jsPDF + html2canvas CDNs staan al geladen. Trade-shape hercontroleren vóór port.
- [ ] **Meerdere screenshots per trade** — v4_14 en v12 hebben 1 per trade. TF-breakdown (4H/15m/entry) zou datamodel + migratie vergen.

## 🔬 Onderzoek / te besluiten

- [ ] **Welke exchanges prioriteit?** — lijst afstemmen met community. Bybit, Binance, MEXC, Blofin, Kraken, Hyperliquid?
- [ ] **Later: backend ja/nee?** — pas relevant als community direct-API-sync wil. Voorlopig blijft keuze: lokaal + CSV.
- [ ] **Distributiemodel** — GitHub `/main/` folder nu. Overwegen: GitHub Pages (paid private) of Cloudflare Pages + Access (gratis, email-gate).

## ✅ Done

- [x] 2026-04-28 — **Fees worden nu auto-verrekend in PnL bij handmatige trades** (v12.49) — useEffect in TradeForm recalculeert PnL bij wijziging van entry/exit/positionSize/fees, mits source==="manual" en "pnl" niet in manualOverrides. Zodra user PnL handmatig typt stopt auto-update. API-imports onveranderd (al netto). Commit `46c0a41`.
- [x] 2026-04-28 — **Setup-lagen tag-pills leesbaar op alle 6 themes** (v12.49) — vervangen `rgba(255,255,255,0.35)` (hardcoded) en lichte borders door `var(--text3)` + `var(--border4)` in alle drie pill-types (Timeframe / Setup / Confirmatie). Commit `46c0a41`.
- [x] 2026-04-28 — **"Indeling aanpassen" toggles zichtbaar in OFF-state op alle 6 themes** (v12.49) — toggle-track + knob OFF-state vervangen van `rgba(255,255,255,0.08)` / `rgba(255,255,255,0.25)` (wit op wit-bg = onzichtbaar) naar `var(--bg4)` track + border + `var(--text4)` knob. Commit `46c0a41`.

- [x] 2026-04-22 — **🎯 Blofin live tracking — open posities + live TP/SL + auto-refresh (v12.7 + v12.8)** — research door `exchange-integrator` agent: de gap met Tradezella/TraderSync was 90% UI, niet backend. Blofin's API bood alles al, we toonden niks. Fix:
  - Quick-win: "📡 Open posities ophalen" knop ontgrendeld voor alle exchanges met `fetchOpenPositions` (gate was hardcoded MEXC)
  - Live unrealized PnL `~+$X` (tilde = niet-gerealiseerd) in Trades-tabel PnL-kolom
  - Liquidation-price badge `LIQ $X` in amber onder Exit-kolom
  - Tweede API-call naar `/api/v1/trade/orders-tpsl-pending` — SL/TP worden automatisch gevuld, match op instId + positionSide
  - `autoRefreshOpen` config (Uit/30s/1min/2min) — silent polling, pauzeert bij inactive tab
  - Smarter merge: `ALWAYS_PROTECT` (user content) + `PROTECT_IF_INCOMING_EMPTY` (SL/TP — Blofin overwrite, MEXC keep). Manual-overrides winnen nog altijd. Commits `cb00572`, `e56e6b9`.
- [x] 2026-04-22 — **👻 Missed trades — opt-in power feature (v12.6)** — log setups die je spotte maar niet nam. Master toggle in Instellingen → Accounts (default UIT). 4 fases in 1 commit:
  - Status "missed" (3e waarde naast open/closed), `missedReasonTags` array, `hindsightExit` veld
  - TradeForm: "👻 Gemist?" toggle, conditioneel velden verbergen, Multi-select reason-tags, optionele hindsight sectie
  - TagManager: nieuwe categorie "👻 Missed-redenen" met 7 default tags, volledig bewerkbaar
  - Trades-lijst: 👻 MISS pill, opacity 0.72 voor missed rijen
  - FilterBar: `[Genomen | Gemist | Beide]` type-pill (default Genomen)
  - Command Palette: `⌘K → m` voor quick-log
  - Analytics → Proces → "👻 Edge Gap" sectie: captured-ratio per setup, reasons breakdown, theoretical edge-leak met hindsight-bias warning
  - `missed-trades-demo.html` standalone prototype. Commit `b819d9a`.
- [x] 2026-04-22 — **📋 CHANGELOG.md + Instellingen-link (v12.5)** — source-of-truth op GitHub, niet in-app tab. Keep-a-Changelog format in NL. Link vanuit Instellingen → Accounts. Commit `c3cfaf2`.
- [x] 2026-04-22 — **🔄 Update-flow in Instellingen (v12.3 → v12.4)** — manuele "🔄 Check voor updates" knop in Instellingen → Accounts (vervangt auto-banner). 4 uitkomsten: checking / up-to-date (groen) / error (rood) / newer (gold card met IS_HOSTED-aware action). Voor gehoste contexten: "↻ Update nu" = location.reload(). Voor lokale bestanden: "⬇ Download" naar GitHub raw. Commits `35017e0`, `fd1fec3`.
- [x] 2026-04-22 — **🎨 Morani branding (v12.4)** — favicon + apple-touch-icon (base64 embedded, M+candle crop), Open Graph + Twitter Card meta tags (1200×630 og-image via GitHub raw hosting), theme-color `#C9A84C`, `<title>` "SyncJournal · Morani". `assets/` folder met source PNG + generated variants. Commit `3e2a456`.
- [x] 2026-04-22 — **📦 Versie-beheer + auto-update-check (v12.1 → v12.2)** — `APP_VERSION` const bovenin HTML + `main/version.json` companion file. Semver `v12.X` formaat. Zichtbaar in Instellingen footer + Help-pagina (gold mono-font). `isNewerVersion()` semver-compare. `IS_HOSTED` detectie (file:// + localhost vs. public). Commits `a4ce4bd`, `b312b03`, `29a88e1`, `2038df1`, `eeb3035`.
- [x] 2026-04-22 — **Dashboard cleanup — van 3 naar 2 mindset-elementen** — weekly quote-kaart verwijderd van beide Dashboards omdat de top-banner sinds `5e600fa` al per tab-navigatie roteert en de kaart redundant was. Settings-toggles van 4 → 3. Stale localStorage-keys (tj_mindset_dashQuote e.a.) éénmalig opgeruimd bij load. Commit `0ce2ef8`.
- [x] 2026-04-22 — **Bug: Light themes logo + dashboard-greeting niet leesbaar** — eerste poging faalde (background-shorthand reset `background-clip: text`), definitieve fix: op light themes gradient + shimmer volledig uit → solid `var(--gold)` via `-webkit-text-fill-color` op `.tj-logo-text`, plus donkere logo-text via `--tj-text-color:var(--text)` op `.tj-logo`. Donkere themas ongewijzigd. Commits `f4bf6c8`, `2e1c005`.
- [x] 2026-04-22 — **🎯 Persoonlijke greeting + stat-based insight + milestones** — Fase 1: naam-input in Instellingen (`config.displayName`, fallback "trader") + visuele "✓ Opgeslagen" bevestiging (400ms debounce, 1.8s fade). Fase 2: 9-branch priority-chain `getDashboardInsight()` met 31 micro-copy varianten (win-streak, best-week, consistency, discipline, goal-on-track, loss-streak, idle, fresh-user, neutral). Render onder greeting met tone-colored border-left. Fase 3: 9 milestone-celebrations (10/50/100/250/500/1000 trades, win-streak-5/10, first-win) als one-time modal. Persisted in `tj_milestones_seen`. Commits `4d6caa7`, `b0936ef`, `89b9055`, `b312b03`, `29a88e1`.
- [x] 2026-04-22 — **💭 Mindset-reminders geïntegreerd (fase 1)** — 13 quotes (8× Morani-voice + 5× classics, softer tone). 4 contexten live: (1) ochtend-banner rotating per tab-navigatie, (2) pre-trade italic in TradeForm, (3) post-loss toast met 2h cooldown, (4) Dashboard weekly quote-card (beide layouts). Master + per-categorie toggles in Instellingen (`tj_mindset_prefs`). Seen-tracking (`tj_mindset_seen`) voorkomt 7-daagse herhaling. Commits `20bd386`, `58bc1a4`, `6e878af`, `5e600fa`.
- [x] 2026-04-22 — **🎯 Discipline Heatmap in Analytics** — 7×24 (of 7×5 sessies) heatmap in Proces-mode. 6-check score (SL/pre-notitie/setup-tag/binnen-risk/post-notitie/rating) met user-toggleable vinkjes (min 1, persisted in `tj_discipline_checks`). Amsterdam-tijd via `Intl.DateTimeFormat` (DST-aware). Theme-aware kleuren via `color-mix()`. Auto-insights (dag-patroon, tag-discipline, best-day). Min-sample 3 trades/cel (dashed grijs anders). Best/worst slot cards. Commit `726f02d`.
- [x] 2026-04-18 — **Bug: Proxy-sectie verbergen voor community** — `{IS_DEV && ...}` wrapper, `?dev=1` ontgrendelt (persisted). Backup-text en Help-text ontzien van Worker/CORS jargon. Commit `f9d1437`.
- [x] 2026-04-18 — **Bug: Integer-rules + spinner-pijltjes** — Trading Rules + Goals target switched naar `type="text"` + inputMode, integer/decimaal per regel-type, digits-only regex. Commit `86efdcf`.
- [x] 2026-04-18 — **Bug: Content scrolt door top-nav** — `.tj-topbar` → `var(--bg)` met per-theme overrides (sync/aurora/light/parchment/daylight). Alle 6 themas getest. Commit `c2b4d86`.
- [x] 2026-04-18 — **Bug: Trade-modal sluit bij backdrop-click + save onder zicht** — 3-delige fix: (a) backdrop onClick verwijderd, (b) save-knop `position:sticky bottom:0` met `var(--bg)` + border-top, (c) auto-draft naar `tj_trade_draft` met 48h recovery-banner bij volgende app-open. Plus: confirm-dialog "Opslaan / Sluiten zonder opslaan / Annuleren" bij dirty-state close (edit-trade snapshot + new-trade hasContent check). Commits `ad53423`, `45e91c4`, `2430ef5`.
- [x] 2026-04-18 — **MEXC TP-fetch fix + UI-plek logisch** — Worker MEXC-signing nu alfabetisch gesorteerde params (fills/`order_deals` faalde met "Confirming signature failed" omdat `URLSearchParams.toString()` insertie-volgorde behoudt; `open_positions` werkte toevallig omdat daar geen params zijn). TP-fetch knop verhuisd van zwevende TP Tijdlijn-card naar de "TAKE PROFIT NIVEAUS" section header (naast "+ TP toevoegen"), teal-kleur, alleen zichtbaar bij exchange-sourced trades met key geconfigureerd. TPTimeline nu puur visualisatie (returnt null als leeg). Commits `e4ba9e5`, `10e45a0`.
- [x] 2026-04-18 — **MEXC open posities ophalen via API** — nieuwe "📡 Open posities ophalen" knop in Accounts-hub naast "Trades importeren" (MEXC only for now). `App.syncOpenPositions` helper: upsert met behoud van user-velden (tags, notes, rating, SL/TP, manualOverrides), verwijdert "zombie" opens (trades die niet meer in de API-response staan = dichtgegaan op exchange). Toast `X nieuw · Y bijgewerkt · Z dichtgegaan`. Betere Worker MEXC error-reporting (HTTP status + raw body in foutmelding). Commits `73c92d5`, `e4ba9e5`.
- [x] 2026-04-18 — **Blofin API import fixes** — `openAveragePrice` als entry (was leeg), `closePositions` als size per close-event, direction infer uit `(exit-entry)*pnl` bij `positionSide:"net"`, unieke ID per close-event (`blofin_{positionId}_{closeTime}`) zodat partials niet collideren in dedup. Poging tot aggregatie per positionId met tpLevels teruggedraaid (commits `a902abf` → reverted door `de6c15b`/`24a6ae1`). PnL% op tradecards gefixt (was altijd +0.00% — formule deed `entry × positionSize` maar positionSize is al de USDT-notional). Commits `da9d458`, `c60074a`, `de6c15b`, `071255d`.
- [x] 2026-04-18 — **Proces-focus Analytics** (voorstel A — segmented control) — Analytics toont nu `[🧠 Proces | 💰 Winst | 📊 Beide]` pill-keuze bovenaan met Mark Douglas quote. Default Proces voor <100 trades. 4 proces KPIs (Plan gevolgd % / SL discipline % / Journal compleet % / FTMO Consistency) + Risk consistency + Fout-ratio cards. 9 PnL-only secties mode-gated met `showW&&seq()`. Gebaseerd op research 8 concurrenten + Mark Douglas / Van Tharp / Steenbarger. localStorage `tj_analytics_view`. Commits `f48ad51`, `857e852`.
- [x] 2026-04-18 — **Drag handles verplaatst naar linker gutter** — floating top-right werd raar bij grid-secties (zweefde rechts buiten content). Nu consistent 48px gouden knop links, gecentreerd, werkt uniform voor single cards, 4-col grids, 2-col grids én tabellen. Commit `464b42e`.
- [x] 2026-04-18 — **Proces research & thinking doc** — deep-research 8 journals (Edgewonk Tiltmeter/Edge Finder, Tradezella Zella Score, TraderSync Cypher AI, Tradervue tags, Chartlog strategy rules, TradesViz 600+ stats, FTMO Consistency, Topstep) → top 10 proces-metrics, 3 toggle UI-voorstellen, Mark Douglas/Van Tharp/Steenbarger bronnen.
- [x] 2026-04-18 — **2 nieuwe light themes: Parchment + Daylight** — warm cream (Linear/Notion-stijl) + koel wit (Stripe/Vercel-stijl). WCAG AA compliant, gold accent aangepast per bg (#A8832E en #B8912F). Premium layout overrides ge-scoped naar dark themes alleen. Chart.js defaults theme-aware (text/border/tooltip uit CSS vars).
- [x] 2026-04-18 — **Light-theme polish** — year heatmap empty cells (min alpha .4 op light ipv .18 voor zichtbaarheid), Review-pagina scorecard cards (rgba(42,46,57,0.3) → var(--bg4)), Analytics Long/Short cards, Capital tracking balk. Chart.js global sync via useEffect.
- [x] 2026-04-18 — **Trade cards uitgebreid met 5 meme-kaarten** — Boss (Ibiza Final Boss), Goodfellas, Giggling, OMG, Pablo. Alle via herbruikbare `ImageCard` helper (beeld rechts + fade naar links + gouden accent). Base64 embedded, html2canvas compatible. Totaal nu 9 kaart-designs.
- [x] 2026-04-18 — **Rich progressive disclosure op trade-hover** — volledig 3-rij detail (stats grid, thesis/review quotes, meta badges). `trade-detail-row` CSS + React hover state ipv fragiele tbody:hover.
- [x] 2026-04-18 — **Quick-filter bar 2 rijen** — datum van/t/m + presets + richting/resultaat/pairs (rij 1), exchange pills met icon + account-label (rij 2). Pill CSS class foundation toegevoegd.
- [x] 2026-04-18 — **Classic theme + Premium lichter** — lichtere bg (#10111a), helderder groen/rood, meer border-opacity. Classic+Premium combo met aparte gold-tinted orbs.
- [x] 2026-04-18 — **Card modal breder** — trade-card export modal nu 20px padding inset-0 (bijna volledig scherm) ipv 95vw + dynamic scaling op cards. Trade-bewerken modal 760→960px.
- [x] 2026-04-17 — **Bento KPI grid + animated counters** op DashboardPremium — hero P&L card (5fr, 44px gold-shimmer) + 3 KPI sub-cards (7fr). `AnimNum` component telt vloeiend op (800ms cubic ease-out, 60fps). Cascade stagger 70ms per card.
- [x] 2026-04-17 — **Rich progressive disclosure** op trade-hover — 3-rij detail-paneel: stats grid (SL/leverage/risk/fees/hold/PnL%/R-mult/account), gold-border thesis + review notes, meta badges (📐 layers, 🎯 TPs, ★ rating, 📎 links, 📸 screenshot, ⚠ mistakes). React hover-state ipv fragiele CSS.
- [x] 2026-04-17 — **Classic theme + Premium lichter** — achtergronden opgelicht (#0c0d12→#10111a), win/loss kleuren helderder (#5ce0a0/#ff7b7b), goud warmer (#d4b45c), borders zichtbaarder. Classic+Premium combo met aparte overrides.
- [x] 2026-04-17 — **Premium UI polish (ui-demo parity)** — Inter font, antialiased rendering, tabular-nums, button :active feedback (scale .97), gold left-border op hover-reveal notes, warm off-white tekst #E8E4DC, softer green/red.
- [x] 2026-04-17 — **Quick-filter pill bar** — altijd zichtbaar, 2 rijen: datum van/t/m + presets + richting + resultaat + pairs (rij 1), exchange pills met icoon + label (rij 2). Airbnb-stijl rounded pills met gold active state.
- [x] 2026-04-17 — **UI/UX hyper-modern CSS foundation** — gold shimmer sweep, card cascade stagger, glassmorphism hover glow + lift, skeleton shimmer, toast notifications met progress bar (slide-in + 4s countdown). Border-radius 10/14→12/16px. Alles pure CSS, geen deps.
- [x] 2026-04-17 — **Competitive research rapport** — deep-dive 8 concurrenten (Tradezella/TraderSync/Edgewonk/Tradervue/TradesViz/Chartlog/MM Platinum/Deltalytix) + user pain-points + 10 UX-verbeteringen + crypto-niche features + AI roadmap + integraties shortlist. Bevindingen verwerkt in Next up.
- [x] 2026-04-17 — **UI/UX research rapport** — trends 2026 (bento grid, view transitions, progressive disclosure, skeleton loading, animated counters), color/typography advies, 3 wow-factor CSS animaties, 5 missende UI-componenten.
- [x] 2026-04-16 — **Help page volledig herschreven** — 10 categorieën (Sneltoetsen, Data, Accounts, Trade form, Goals, Rules, Analytics, Trade cards, Themes, Versie-flow) met alle nieuwe features uitgelegd.
- [x] 2026-04-16 — **Analytics upgrade met 4 charts uit demo** — R-Multiple distributie (Chart.js histogram, vervangt custom divs), Mistake Impact (Chart.js horizontal bar met $-bedragen + callout), Rolling 20-trade edge (dual-axis line WR%+Expectancy, nieuw), Setup insights tabel (8 kolommen met auto-advies: 🏆 Edge bevestigd / 🚫 Overweeg schrappen / 🎯 Targets verhogen / ⚠ Verliezen te groot / ✓ Consistent). Commit `eb49961`.
- [x] 2026-04-16 — **Analytics demo file** (`analytics-demo.html`, gitignored) — standalone showcase van 10 chart-ideeën met 120 synthetische trades, gebaseerd op onderzoek naar Edgewonk/TraderSync/TradeZella/TradesViz/FTMO. Vervolg-analytics (MFE/MAE, Discipline Score, PnL Calendar, Underwater DD, Funding Drain, Scratch) staan als items in Next up.
- [x] 2026-04-16 — **🎯 Goals sub-tab met custom goals** — nieuwe `GOAL_METRICS` catalog (9 metrics: pnl, winRate, trades, winningDays, avgR, grossProfit, maxDD, profitFactor, expectancy) × `GOAL_PERIODS` (week/month/quarter/year/all). `computeGoalMetric()` + `migrateGoals()` (backwards-compat met oude 4-goal shape). GoalsPage met add/edit/delete + inline progress bar. GoalsRings refactored om `goals.items` te lezen. Commit `a6d7365`.
- [x] 2026-04-16 — **Account-labels + Capital-tracking** (Denny's ideeën, samen in één commit). Labels: preset-chips (Swing/Daytrade/Scalp/News trade/Test/Swing-scalp) + vrije invoer per manual-account én per exchange, gouden sub-regel onder pair in trade-lijst. Capital tracking: `transactions[]` met ➕ Storting / ➖ Opname / ✏️ Correctie per account (beide types), Capital + Equity + Return% live berekend. Correctie = absolute waarde om te syncen met exchange-balance. Commit `940bf44`.
- [x] 2026-04-16 — **Setup Ranking widget** op beide Dashboards — Top 3 / Worst 3 setups by avg R-multiple (fallback avg PnL), min 3 trades per setup, klik rij → filters.setupTags=[tag] + navigate naar Trades. Commit `940bf44`.
- [x] 2026-04-16 — **Risk-per-trade tracking** — `computeTradeRisk()` + `getCapitalForSource()` helpers. saveTrade auto-fills `riskUsd` + `riskPct` tenzij manual override. Live KPI-strip toont nu **Risk $ | Risk % | R:R | Qty** met kleur-thresholds (≤1% groen, ≤2% goud, ≤4% amber, >4% rood = tilt-signaal). Commit `940bf44`.
- [x] 2026-04-16 — **Trade-form UX quick wins** — Status-toggle bovenaan (hide Exit/PNL/Fees/post-trade notes bij Open), live KPI-strip (Risk / R:R / Qty) real-time, 3 collapsible sections via `<details>` (Setup & Psychologie, Media & Links, Notities) met localStorage-persist per sectie. Commit `26e2168`.
- [x] 2026-04-16 — **Deelbare trade-kaart** met 4 designs (Classic / Exchange Ticker / Story / Minimal), Bitcoin (Beta) watermark, statische candle silhouet, corner brackets, field-toggles voor PnL/R/entry/exit/size/hold/setup/session/anoniem. **Copy-to-clipboard** naast Download PNG — direct Ctrl+V plakken in Discord via `navigator.clipboard.write(ClipboardItem)`. Isolated sandbox-capture om parent-CSS (conic-gradient, transform:scale) te vermijden die html2canvas's `createPattern` crashte.
- [x] 2026-04-16 — **⌘K Command Palette** — keyboard-shortcut voor nav-acties + fuzzy search.
- [x] 2026-04-16 — **Goals & Progress Rings** op DashboardPremium — `tj_goals` {monthPnl, winRate, maxDD, monthTrades, enabled{}}.
- [x] 2026-04-15 — **🥈 Trading Rules module** — dedicated sub-tab in Instellingen, regels opslaan als `tj_trading_rules[]`, per-regel handmatige override, collapsible widget op dashboard, per-dag evaluatie.
- [x] 2026-04-15 — **🥉 Daily Journal / Event Log** — `tj_daily_notes` storage, 1 entry per datum met pre-market plan + mood-tags + reflection. Integreert met kalender-view.
- [x] 2026-04-15 — **Premium layout** — aparte `body.layout-premium` class, werkt met alle 4 thema's (8 combinaties). Orthogonaal aan theme. Voorbeelden gebaseerd op `premium-demo.html`.
- [x] 2026-04-15 — **Drag-drop section reordering in Analytics** — modulaire `useSortable` / `SortableSections` / `EditModeBar` helpers, sort-handle met solid bg, geen overlap met content.
- [x] 2026-04-15 — **Review-pagina charts** — zoals v4_14 (equity curve + PnL/day bar).
- [x] 2026-04-15 — **Drop-JSON box** van site weg — Export/Import nog wel via knop in Instellingen.
- [x] 2026-04-14 — **Lokale CCXT-proxy** opgezet (`proxy-local/server.js`) met Express + CCXT + CORS. Draait op `http://localhost:8787`, vervangt tijdelijk de Cloudflare Worker voor Denny + Sebas tijdens dev.
- [x] 2026-04-14 — **MEXC Contract V1 direct** — proxy roept `contract.mexc.com/api/v1/private/position/list/history_positions` aan met HMAC-SHA256 signing. Werkend, geaggregeerde posities binnen.
- [x] 2026-04-14 — **Blofin positions-history direct** — proxy roept `openapi.blofin.com/api/v1/account/positions-history` aan met ACCESS-KEY/SIGN/TIMESTAMP/PASSPHRASE/NONCE. Werkend.
- [x] 2026-04-14 — **Kraken Futures account-log** — via CCXT's `request()` naar `/api/history/v3/account-log`, met paginatie (max 20k entries) en positie-lifecycle tracking (open → partial closes → full close). Partial closes worden `tpLevels[]` in SyncJournal. Werkt globaal, TP-detectie nog te valideren.
- [x] 2026-04-14 — **SyncJournal `getProxyUrl()` bug** — localhost-URLs werden automatisch terug-reset naar Cloudflare. Fixed.
- [x] 2026-04-14 — **Sync `importTrades()` bug** — "Trades importeren" toonde preview maar sloeg niets op. Nu voegt 'ie toe aan de journal.
- [x] 2026-04-14 — **Online onderzoek exchange-API's** via `web-search-agent`: CCXT (MIT, 37k stars) dekt alle 4 crypto-exchanges. FTMO vereist CSV-import. Geen bestaande Claude-subagents voor trading.
- [x] 2026-04-14 — **MEXC Position History + Order History CSV/XLSX import** — SheetJS CDN toegevoegd, parser detecteert 2 MEXC-formats. Position History geeft entry+exit+pnl; Order History filtert op Closing PNL. Disclaimer alleen voor MEXC.
- [x] 2026-04-14 — **Blofin CSV standalone (FIFO reconstructie)** — open-lots queue per symbol, reduce-only fills trekken af, emit bij size=0. Orphan closes krijgen "⚠ partial data" flag. PnL = net (CSV pnl − fees).
- [x] 2026-04-14 — **Blofin CSV timezone fix** — CSV-tijden geïnterpreteerd als UTC, display converteert naar browser-local. Matcht nu Blofin UI.
- [x] 2026-04-14 — **Kraken CSV positie-lifecycle tracking** — zelfde algoritme als API proxy, bundelt partial fills per contract. Orphan closes → virtuele positie met partial_data flag + entry uit `new_average_entry_price`.
- [x] 2026-04-14 — **Blofin API handler** — directe call naar `/api/v1/account/positions-history` met ACCESS-KEY/SIGN/TIMESTAMP/PASSPHRASE/NONCE signing.
- [x] 2026-04-14 — **MEXC & Blofin TP's ophalen (fills)** endpoints — proxy roept order_deals (MEXC) en fills-history (Blofin) aan; client mapt naar tpLevels.
- [x] 2026-04-14 — **Snel-filter presets** — Vandaag / Deze week / Deze maand / Alles in FilterBar.
- [x] 2026-04-14 — **Voor-trade notitie** — "Waarom ga ik erin?" veld in TradeForm, apart van post-mortem notes. `entryNote` field op EMPTY_TRADE.
- [x] 2026-04-14 — **Sync vanaf default = 1e van maand** — zowel UI-display als sync() startTime.
- [x] 2026-04-14 — **Datumformaat dd-mm-yyyy** — `fmtNL()` helper, toegepast op trade-lijst, review highlights, CSV preview. Storage blijft ISO.
- [x] 2026-04-14 — **🎯 TP's ophalen knop** in TPTimeline — per exchange fills ophalen en als tpLevels mappen op trade.
- [x] 2026-04-14 — **📄 Importeer CSV/XLSX knop** verplaatst naar exchange-paneel (naast "Trades importeren") ipv tiny icoon in sidebar.
- [x] 2026-04-14 — **Cloudflare Worker gedeployed** via `wrangler` → `morani-proxy.moranitraden.workers.dev`. Code in `worker/proxy.js`. Vervangt v3.
- [x] 2026-04-14 — **MEXC + Kraken API via Worker** werkend. Position-history voor MEXC, account-log met minute-bucket aggregatie voor Kraken.
- [x] 2026-04-14 — **Kraken minute-bucket aggregatie** (reverted van position-lifecycle): partial fills binnen zelfde minuut/contract/richting → 1 trade. Simpel en betrouwbaar.
- [x] 2026-04-14 — **Blofin direct vanuit browser** — geen Worker meer nodig. Cloudflare blokkeerde Worker→Blofin (beide op Cloudflare, bot-protection). `_direct()` helper met WebCrypto HMAC-signing + ACCESS-NONCE. Werkt standalone + client-side filtering op startTime.
- [x] 2026-04-14 — **API-sync preview-flow** — "Trades importeren" toont nu hetzelfde preview-scherm als CSV/XLSX (filter long/short + win/loss, selecteren, dedup). Pas op "Importeer" klik worden trades geladen.
- [x] 2026-04-14 — **Preview-titel dynamisch** — "Import preview" voor API, "CSV / XLSX import" voor bestanden.
- [x] 2026-04-14 — **Proxy server panel verplaatst** naar Instellingen (onder Auto-sync). Was voorheen los blok rechts in exchange-paneel.
- [x] 2026-04-14 — **Light theme toegevoegd** — 4e thema (naast SyncJournal, Classic, Aurora). Wit/cream bg, donkere tekst, brons-goud accent.
- [x] 2026-04-13 — Projectopzet: `CLAUDE.md`, memory, `.gitignore`, GitHub-handleiding.
- [x] 2026-04-13 — Custom subagents aangemaakt: `html-feature-diff`, `exchange-integrator`, `pr-reviewer-nl`.
- [x] 2026-04-13 — `tradjournal_v9_morani.html` → `tradejournal.html`, titel/versielabel gezet naar `SyncJournal v9.0.0`.
- [x] 2026-04-13 — Feature-diff v4_14 vs v9 uitgevoerd (zie onderaan).
- [x] 2026-04-13 — `schemaVersion` geïntroduceerd (`tj_schema_version` key, `runSchemaMigrations()` runt bij opstart, baseline = v1).
- [x] 2026-04-13 — v12 baseline vervangen (`tradjournalv12.html` → `tradejournal.html`), titel → `SyncJournal v12`.
- [x] 2026-04-13 — `calcExpectancy` helper toegevoegd (miste in v12 → Dashboard crasht zonder).
- [x] 2026-04-13 — **TP niveaus editor** (add/remove/status-toggle, multi-TP, auto winst/R:R) geport uit v4_14 naar v12 TradeForm.
- [x] 2026-04-13 — **TradingView links** sectie geport: meerdere links per trade, met commentaar, reorder (▲▼), open-in-tab, verwijder. Screenshot-label bijgewerkt.
- [x] 2026-04-13 — **CSV-import per exchange** (MEXC/Blofin/Kraken) in Instellingen: 📄 knop per exchange, herkent Kraken log-format + generieke CSV, deduped import.
- [x] 2026-04-13 — **Auto-sync interval** toegevoegd (`config.syncInterval`, Uit/15/30/60 min). Default Uit zolang MEXC-API nog niet werkt.
- [x] 2026-04-13 — **Standaard quote asset** setting (USDT/USDC/USD) in Instellingen.
- [x] 2026-04-13 — **3 thema's** werkend: `SyncJournal` (default v12 look), `Classic` (v4_14 solid), `Aurora` (v4_14 Morani Signature hernoemd — mesh gradient orbs + glasmorfisme). Oude `theme:"morani"` waardes vallen automatisch terug op `sync`.
- [x] 2026-04-13 — **CSV-import preview UI** geport: na CSV-pick komt een preview met filter (long/short, win/loss), sorteerbare kolommen (side/pair/datum/pnl), per-rij selectie, "Selecteer gefilterde" / "Selecteer alles". Importeert alleen geselecteerde trades.
- [x] 2026-04-13 — **Analytics uitgebreid**: R:R analyse (gemiddeld gepland/gerealiseerd + per setup + per entry-timeframe), Holdtijd-buckets, Uur heatmap (24 cellen met intensiteit). Respecteert bestaande layout-gear toggles.
- [x] 2026-04-13 — **Review charts** toegevoegd: SVG equity curve, PNL/dag bars, 3 donuts (Win/Loss, Long/Short, Sessies). Self-contained (geen Chart.js dependency), responsive grid.
- [x] 2026-04-13 — **Onboarding flow** — welkom-modal heeft nu 2 keuzes (Koppel accounts / Log een trade) + "Later kiezen".
- [x] 2026-04-13 — **Backup-knop zichtbaar** in Instellingen → Accounts (Export + Import backup met counter).
- [x] 2026-04-13 — **Hash routing / deeplinks** geport uit v4_14: `#/trades/edit/:id` werkt, browser back/forward synchroniseert tab, deeplinks openen direct de juiste view.
- [x] 2026-04-13 — **Export/Import JSON geharmoniseerd**: backup bevat nu `trades + tagConfig + accounts + config` (proxy-URL, thema, quote, sync-interval, exchange-keys, `schemaVersion`). Drag-drop import herstelt alles. Filename → `syncjournal-backup-YYYY-MM-DD.json`.
- [x] 2026-04-13 — **Custom setups & confirmations** afgevinkt: v12's TagManager ondersteunt al editable tags; nu ook via backup geborgen dankzij export/import-harmonisatie. Aparte `tj_csetups`/`tj_cconfs` zijn overbodig.

---

## 📊 Feature-diff snapshot (v4_14 → v9, 2026-04-13)

> Gegenereerd door `html-feature-diff` agent. **Historisch:** v12 heeft sindsdien eigen wijzigingen. Gebruik als leidraad, niet als waarheid.

### Alleen in v4_14 (Denny) — kandidaten voor migratie
- **PDFReportModal** — volledige PDF-generator (jsPDF + html2canvas), secties selecteerbaar — [TradeJournal_v4_14.html:1549-1836](TradeJournal_v4_14.html#L1549). CDN's + `onReport`-hook staan klaar, component ontbreekt.
- **ReviewDashboard + ReviewCharts** — equity curve, PnL/day, vergelijk vorige periode — [TradeJournal_v4_14.html:1933](TradeJournal_v4_14.html#L1933).
- **Hash-based routing / deeplinks** — `#/trades/edit/:id` — [TradeJournal_v4_14.html:4327](TradeJournal_v4_14.html#L4327).
- **Onboarding flow (2 keuzes)** — [TradeJournal_v4_14.html:4567](TradeJournal_v4_14.html#L4567).
- **Custom setups/confirmations opslag** — `tj_csetups` / `tj_cconfs` met merge in tagConfig — [TradeJournal_v4_14.html:4370-4378](TradeJournal_v4_14.html#L4370).
- **Bulk Export CSV + JSON** — volgens help-doc — [TradeJournal_v4_14.html:1847](TradeJournal_v4_14.html#L1847).
- **Uitgebreide Analytics** — R:R per timeframe, heatmaps, layer-analytics — [TradeJournal_v4_14.html:2738-3266](TradeJournal_v4_14.html#L2738).

### Alleen in v9/v12 (Sebas) — houden
- **IndexedDB storage** + migratie vanuit localStorage.
- **Storage usage monitoring + `StorageWarning`**.
- **`safeSave()` met quota-error afhandeling**.
- **Configureerbare proxy URL** `tj_proxy_url`.

### Storage-schema
- Alleen in v4_14: `tj_csetups`, `tj_cconfs`, `tj_onboarded`
- Alleen in v12: `tj_welcomed`, `tj_proxy_url`, `tj_schema_version`, IndexedDB `morani_trades_v1`
- Gedeeld: `tj_trades`, `tj_config`, `tj_accounts`, `tj_tags`, `tj_layout_*`, `tj_sizeMode`, `tj_sizeInputMode`

### Verificatiepunten
- Of v4_14's Analytics écht rijker is of alleen anders gestructureerd.
- Of v12's AccountsHub een werkende JSON-export heeft (prop-shape verschilt).
- Of Calendar in beide gelijkwaardig is.
