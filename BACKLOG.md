# SyncJournal — Backlog

*Opgeruimd op 26-10-2026.* Wat klaar is, is weggehaald (besluit Zaratras, 26-10-2026: wat klaar is mag weg);
per punt is in CHANGELOG.md en in de code nagekeken dat het echt af is. Wat er gebouwd is staat in
[CHANGELOG.md](CHANGELOG.md); de vorige versies van dit bestand staan in git. Het archief van 29-09-2026, met
oude onderzoeksnotities, staat in [docs/backlog-archief-2026-09-29.md](docs/backlog-archief-2026-09-29.md).

**Hoe te lezen.** Elke story heeft een ID (**F** functie · **B** bug · **T** tests · **C** code · **W** werkwijze), een
prioriteit (1 = eerst) en een effort (XS < 1 uur · S ≈ halve dag · M ≈ dag · L = meerdere dagen). Per
story: waarom het ertoe doet, het plan in stappen, en wanneer hij klaar is.

**Werkwijze** (uit CLAUDE.md): bugs beginnen met een test die de fout laat zien; M- en L-stories eerst
een plan-document (`superpowers:writing-plans`); exchange-logica alleen in de adapter van die exchange;
elke wijziging eindigt met `node tests/run-release.js` groen.

---

## Overzicht

| ID | Story | Prio | Effort | Hangt af van |
|---|---|---|---|---|
| **F14** | SyncJournal buiten Morani: besloten beta, alleen Nederlands — stap 4–6 gebouwd op branch `f14-beta`; open: review en release, stap 1–3, feedbackplek, Workers Logs — 📅 **deze week** | 1 | M | — |
| **W1** | Worker: `Access-Control-Allow-Origin` — v25 staat sinds 25-10 op `meten`; **rond 1 november** `ORIGIN_MODUS` op `afdwingen` — 📅 **deze week** | 1 | XS (Zaratras) | een week meten |
| **W7** | CSP afdwingen: `Content-Security-Policy-Report-Only` → afdwingend | 2 | XS | F14 een week live |
| **F15** | Funded modus fase 2: een import koppelt zelf aan het juiste challenge- of funded account (login uit het MT5-rapport) | 2 | M | MT5-rapport + MetriX-CSV van Zaratras |
| **F10** | Blofin: oorspronkelijke stop-loss, stopbeweging en TP/SL/Close in de eigen adapter — OKX ✅ v1.15, Kraken en Hyperliquid ✅ | 2 | M | — |
| **F6** | Kraken: geplande TP's uit de trigger-historie | 2 | S | — |
| **F7** | Analytics *Stop & uitvoering*: de drie blokken die nog niet gebouwd zijn (paneel zelf ✅ v1.18) | 3 | S | F6 voor één blok |
| **T3** | Levensloop-toets voor FTMO, één gedeelde vorm | 3 | M | — |
| **W4** | Eerste echte PR met beide reviewers | 3 | XS | volgende release |
| **W6** | Discord-poll "Gebruik je de AI-coach? Zo nee, waarom niet?" — eind januari 2027 | 3 | XS (Zaratras) | — (Mori live sinds v1.16) |
| **C2** | CSV-parser per exchange opsplitsen | 3 | M–L | T1 |
| **C4** | XLSX-ondersteuning eruit | gepland | S | na 16 nov (MEXC weg) |

---

## Functies

### F14 · SyncJournal buiten Morani: besloten beta — 📅 **deze week** · prio 1 · M

**Waarom** (Zaratras, 25-10-2026). De journal breder trekken, zodat ook traders buiten de Morani-community hem gebruiken.
Technisch staat syncjournal.nl/app al open (geen login, alles lokaal); het werk zit in vertrouwen, neutraliteit en de Worker.

**Besloten (Zaratras, 26-10-2026): alleen Nederlands.** Een besloten beta, Nederlandstalig en gratis, met een paar
mensen. Engels (app, FAQ, landing) is geen doel; komt alleen terug als Zaratras daar later anders over beslist.

**Stand 26-10-2026.** Stap 4–6 zijn gebouwd op branch `origin/f14-beta`, niet gemerged; zie
`docs/f14-beta-rapport.md` op die branch. Gebouwd: neutrale tag-set naast de Morani-set (stap 4), de pagina
"Hoe veilig is SyncJournal?", de bijgewerkte privacyverklaring en een CSP in `Report-Only` (stap 5), en een welkom
in drie stappen voor wie Morani niet kent (stap 6). F12 (sleutels uit de back-up) is af sinds v1.17.

**Nog open:**
1. **Review, merge en release** van `f14-beta` (Zaratras): voorstel minor. Zet `tag-sets`, `veiligheid`, `csp` en
   `onboarding` in `tests/release-set.js`. Lees de teksten op de veiligheidspagina na, vooral de stappen per
   exchange voor een read-only sleutel en "beheerd door Zaratras" (de Worker draait in Morani's account).
2. **Workers Logs controleren:** de veiligheidspagina en de privacyverklaring zeggen dat de Worker geen sleutels of
   IP-adressen bewaart. Dat klopt alleen als *Observability → Workers Logs* bij `morani-proxy` uit staat
   (`docs/worker-monitoring.md`).
3. **Een vaste plek voor feedback** (e-mail of formulier): beta-testers van buiten zitten niet in de Discord.
   Niet gebouwd op `f14-beta`.
4. **Stap 1 · Worker-verbruik meten:** in het dagrapport op de NUC het aantal verzoeken per dag en de drukste minuut
   aflezen (Morani's eigen journal gebruikt dezelfde Worker en hetzelfde dagbudget). Schatting: handmatige sync
   ~30–50 verzoeken per gebruiker per dag, auto-sync elke 15 min ~250. Gratis plan: 100.000 per dag; betaald
   ($5/maand): 10 mln per maand, daarna $0,30 per mln.
5. **Stap 2 · Eigen Worker-account** (Cloudflare, betaald plan) voor de nieuwe gebruikers, zodat Morani's account en
   journal er niet aan vastzitten. Afspraken met Morani over naam, "Powered by Morani" en de bestaande Worker.
6. **Stap 3 · Snelheidslimiet aanzetten** in de Worker (staat in v20+ klaar maar uit, binding `LIMIET`), op basis van
   de gemeten piek.

Daarna: de CSP afdwingen (**W7**).

**Later, na de beta:** het besluit backend/cloud-sync en het verdienmodel (zie *Besluiten*).

### F15 · Funded modus fase 2: import koppelt zelf aan het juiste account — prio 2 · M

**Waarom.** De funded modus staat sinds v1.18 live (in testfase sinds v1.18.4). Bij een CSV-import kies je nu zelf
het account; een FTMO-export stelt je FTMO-challenge of funded account voor, maar weet niet wélk account het is als
je er meer hebt. In de MetriX-CSV staat geen login; in het MT5-rapport (HTML of XLSX) staan accountnummer en
broker wel in de kop (`docs/research-funded-modus-2026-10-24.md`, §8 en "Gevolg").

**Wacht op Zaratras:** een MT5-rapport en een MetriX-CSV van hetzelfde FTMO-account (en een Breakout-export als die
er is). Dan stellen we vast waar de login staat, in plaats van het aan te nemen (`docs/demo-funded-keuzes.md`, vraag 7).

**Plan.**
1. Test eerst met de geanonimiseerde bestanden: het MT5-rapport wordt herkend, met login en firm.
2. Het MT5-rapport inlezen in de FTMO-adapter; logins onthouden op het challenge- of funded item.
3. "Bij welk account hoort dit?" stelt het item met die login voor; zonder login (MetriX) de actieve items van die firm.

**Let op C4:** XLSX gaat er na 16 november uit. Komt het MT5-rapport alleen als XLSX, dan eerst kiezen: de
HTML-variant gebruiken, of C4 aanpassen.

**Klaar als** een MT5-rapport zonder vragen op het juiste item landt, een MetriX-CSV het juiste item voorstelt, en de
release-poort groen is.

### F10 · Blofin: stop-loss en hoe de trade afliep, in de eigen adapter — prio 2 · M

**Stand.** Kraken (v1.11), Hyperliquid (v1.12) en OKX (v1.15) halen de oorspronkelijke stop-loss vanzelf op, en
sinds v1.18 zie je bij die drie ook de stopbeweging (BE / strakker / verder weg) en de exit-reden (stop / TP / met
de hand / liquidatie). Blofin nog niet: daar vul je de stop zelf in.

**Plan.** Zoals bij OKX, alles in `ExchangeAPI.blofin`: de TP/SL-orders van Blofin ophalen (Blofin praat
rechtstreeks met de browser, geen Worker nodig), de oorspronkelijke stop met `stopBron`, de gedeelde helper
`stopBewegingVan` en een eigen exit-reden. Eerst een snapshot met `?dev=1` van Zaratras' Blofin-account.

**Klaar als** een Blofin-trade zijn stop, beweging en exit-reden toont zoals de andere drie, en de release-poort groen is.

### F6 · Kraken: geplande TP's uit de trigger-historie — prio 2 · S

**Waarom.** De TP's van een Kraken-trade komen nu uit de fills, dus alleen de TP's die geraakt zijn.
De TP die je plande maar die niet geraakt werd, ontbreekt. Daarmee mis je "gepland tegenover gehaald".
Kraken heeft ze wél: TP-triggers aan de winstkant, met hun eigen qty (16-10 06:51: 82.932 / 83.582 / 85.332
voor 0,0038 / 0,0019 / 0,0019).

**Plan.**
1. Test eerst, uit de fixture: positie 2 krijgt 3 geplande TP's met prijs en % (49/25/25), geen enkele geraakt;
   positie 1 krijgt TP1 80.000 geraakt (uit de fill) plus TP2 78.500 en TP3 77.200 gepland.
2. In de adapter: triggers aan de winstkant, sluitende kant, binnen de levensloop, die niet de stop zijn.
   Gewijzigd of geannuleerd en opnieuw geplaatst → de laatste prijs vóór de sluiting (een TP mag je verzetten, de stop niet).
3. Samenvoegen met de `tps` uit de fills: een fill binnen 0,2% van een geplande TP markeert die als geraakt.
   Een fill zonder geplande TP blijft een eigen regel. Bestaand gedrag voor trades zonder triggers blijft gelijk.
4. Met `rrPlanned` (geplande R:R van de gewogen TP's tegenover de oorspronkelijke stop), maar alleen als de gebruiker die niet zelf invulde.

**Klaar als** een Kraken-trade alle geplande TP's toont, de geraakte gemarkeerd, en de presentatie en
Discord (F1) ze laten zien.

### F7 · Analytics: de rest van *Stop & uitvoering* — prio 3 · S

**Stand.** Het paneel *Stop-management en uitvoering* staat sinds v1.18 op Analytics: stopbeweging en hoe de trade
dichtging, per groep aantal, gemiddelde R en netto P&L, met lege staten (`docs/stop-management-rapport.md`).
Niet gebouwd uit het oorspronkelijke plan:
1. **Verliezen in R:** gemiddeld verlies in R en het aandeel verliezen slechter dan −1,1R (slippage of een ruimer
   gezette stop). Een klik toont die trades.
2. **Stop verder weg als fout voorstellen** (`mistakes`), alleen als voorstel: de gebruiker bevestigt.
3. **Gepland tegenover gehaald** (vereist F6): geplande R:R naast de gehaalde R, en het aandeel trades dat TP1, TP2
   en TP3 haalde.

Alleen bouwen als Zaratras ze wil. Gebruik `gemR` en `tradeROrNull`.

---

## Bugs

Geen open bugs.

---

## Tests

### T3 · Levensloop-toets voor FTMO, één gedeelde vorm — prio 3 · M

**Waarom.** Kraken, Blofin, Hyperliquid en OKX hebben een levensloop-spec; FTMO niet. En de vier
toetsen elk iets anders. (MEXC vervalt: koppeling gestopt.)

**Plan:** één toets — open → partial → partial → dicht → opnieuw importeren voegt niets toe —
die per adapter over diens fixture draait. FTMO erbij via zijn CSV. De bestaande specs blijven voor
de eigenaardigheden per exchange.

**Klaar als** vijf exchanges dezelfde toets doorlopen.

---

## Code

### C2 · CSV-parser per exchange opsplitsen — prio 3 · M–L

**Waarom.** `parseExchangeCsvText` ([work/syncjournal.html:7788](work/syncjournal.html#L7788)) is 333
regels met de parsing van alle exchanges door elkaar. De OKX-tak en de fallback beginnen met een
zesvoudige negatie, dus een nieuwe exchange toevoegen betekent twee negatie-kettingen bijwerken.
Kraken en Hyperliquid hebben hun parsing al in de adapter; Blofin, MEXC, FTMO en OKX nog niet.

**Plan** (na T1, eerst een plan-document):
1. Per exchange `herkentCsv(headers)` en `parseCsv(rows)` op de adapter, zoals Kraken en
   Hyperliquid het al doen.
2. `parseExchangeCsvText` wordt een lus over de adapters; de negatie-kettingen verdwijnen vanzelf.
3. Eén exchange per stap, met `csv-import` (zes formaten) ertussen.

**Klaar als** de functie op één scherm past en elke import exact dezelfde trades oplevert als
ervoor. Geen changelog (geen gedragswijziging). Niet samen met een feature doen.

### C4 · XLSX-ondersteuning eruit — gepland, na 16 november · S

**Waarom.** Het enige externe script in de app (`xlsx@0.18.5`,
[work/syncjournal.html:15](work/syncjournal.html#L15)) bestaat alleen voor MEXC's Excel-export. Tot
MEXC uit Nederland vertrekt hebben leden het nodig om hun historie binnen te halen.

**Plan** (december): script-tag weg; `accept` terug naar `.csv` ([:3923](work/syncjournal.html#L3923));
de xlsx-tak uit de CSV-import met de melding *"Sla op als CSV en probeer opnieuw"*; FAQ nalopen.
Test: een `.xlsx` geeft een begrijpelijke melding.

**Klaar als** er geen `<script src>` meer in het bestand staat.

---

## Werkwijze & tooling

### W1 · Worker: `Access-Control-Allow-Origin` afdwingen — 📅 **rond 1 november** · prio 1 · XS (Zaratras)

**Stand 26-10-2026.** In v24 stond hij op `*`: elke website kon de Worker gebruiken als gratis exchange-proxy, op
Morani's Cloudflare-quota. [docs/worker-v25.js](docs/worker-v25.js) staat sinds 25-10 live met de schakelaar
`ORIGIN_MODUS = 'meten'`: alles werkt, en het dagrapport toont per dag welke websites de Worker gebruiken.

**Plan** (Zaratras, ~5 minuten, stappenplan [docs/worker-v25-deploy.md](docs/worker-v25-deploy.md)):
1. Rond 1 november, na een week meten: in het dagrapport kijken welke herkomsten er voorkomen. Staat er een
   website die erbij hoort en niet in `ORIGINS`, eerst die toevoegen.
2. `ORIGIN_MODUS` op `'afdwingen'` en deployen: dan alleen syncjournal.nl, www, work, localhost/127.0.0.1 en `null`,
   plus Morani's journal.
3. Een sync op syncjournal.nl en work.syncjournal.nl controleren. Gaat er iets mis: `ORIGIN_MODUS` terug op `'meten'`.
4. CLAUDE.md bijwerken ("`ORIGIN_MODUS` staat op `'meten'`").

**Let op:** Morani's journal en de oude TradeJournal gebruiken dezelfde Worker. De oude TradeJournal draait lokaal,
als bestand (origin `null`) of via `localhost`. Die moeten op de lijst blijven.

**Klaar als** de Worker live op `afdwingen` staat en de syncs van alle herkomsten uit het dagrapport nog werken.

### W7 · CSP afdwingen — prio 2 · XS

**Waarom.** Met F14 komt er een Content-Security-Policy in `site/_headers`, eerst als `Report-Only`: de browser meldt
wat hij zou blokkeren, maar blokkeert nog niets. Pas afdwingend beschermt hij: een ingeslopen script kan sleutels
dan niet naar een vreemde host sturen.

**Plan** (uit `docs/csp.md` op branch `f14-beta`): een week na de F14-release met de console open meekijken naar
`[Report Only] Refused to …`. Daarna in `site/_headers` op alle vier de regels `-Report-Only` weghalen,
`node tests/csp.spec.js` draaien (en de check "nergens al afdwingend" aanpassen), via de werkversie live.

**Klaar als** de CSP op syncjournal.nl afdwingend staat en de app, de landing en Mori zonder geblokkeerde
verzoeken werken.

### W4 · Eerste echte PR met beide reviewers — prio 3 · XS

**Waarom.** `pr-reviewer-nl` en `/code-review` zijn nog nooit op een release losgelaten.

**Plan.** Bij de volgende release een branch en een PR. Lokaal `pr-reviewer-nl` over de diff, op de
PR `/code-review`. Daarna beoordelen of ze te streng of te los zijn, en of `pr-reviewer-nl` op het
duurdere opus-model moet blijven.

---

## Ideeën — niet ingepland

| Groep | Punten | Oppakken als |
|---|---|---|
| AI-coach uitbreiden (3) | AI Trade Autopsy, AI Super-Prompt "wat heeft prioriteit", playbook-coaching | Als Mori gebruikt wordt (poll W6, eind januari 2027) |
| Mindset & discipline (10) | Tiltmeter, pre-trade-checklist-builder, checklist-streak, mindset-reminders, dag-limiet/tilt guard, Strengths-onboarding, 2D mindset-grid, decision-space-meter, Strengths Primer, Best Trade of the Week | Als leden erom vragen — de mindset-module is niet meegekomen en de enquête vroeg om vereenvoudiging |
| Grafieken & analyse (7) | Bruto/netto P&L naast elkaar, drawdown-grafiek, funding & fees-waterval, weekoverzicht, scratch-donut, MAE-to-stop per setup, bias per layer | Kies er één; bruto/netto eerst (fees worden zichtbaar) |
| Funding-fees per trade (1) | Onderzoek klaar (bouwvolgorde Hyperliquid → Kraken → Blofin) | Kan nu (de Kraken-levensloop is af sinds v1.13) |
| Blofin-schermhulpjes (3) | Near-liquidation-waarschuwing, "laatst ververst"-indicator, live R:R | Laag |
| Delen & integraties (4) | Trade-voucher/deellink, Discord-webhook, TradingView-grafieken, PDF-rapport | Laag |
| Help & content (3) | Alerts Cookbook, Bellafiore-playbookveld, pro-trader-review-follow-up | Laag |
| Combined trades (1) | Meerdere trades als één behandelen | Samenvoegen bestaat al (FTMO); pas bij vraag |
| Test-scenario's O–T (6) | Funding, scaling-in, direction-flip, leverage-wijziging, liquidatie, sub-accounts | Zodra de bijbehorende feature er is |
| Wachtpost (2) | Dagelijkse staat-controle, diff-wachtpost ([ontwerp](docs/wachtpost-ontwerp-2026-09-27.md)) | Kan nu: de oude specs zijn herschreven (T2, 25-10) |
| Sync (1) | `fetchFills` parallel bij verversen | Als verversen traag voelt |
| Stortingen & opnames (1) | Percentages kloppend houden bij in- en uitleg, zie hieronder | Als leden vragen waarom oude percentages veranderen, of als je vaak stort of opneemt |

**Stortingen & opnames in de percentages** (Zaratras, 14-10-2026, bewust niet ingepland). De app kent
voor gekoppelde exchanges geen stortingen en opnames, en bewaart geen saldo-geschiedenis. Het
%-rendement van een trade rekent met een teruggerekend saldo (`pnlBaseOf`/`_pctBases`: saldo nu −
geboekte winst van die trade en alle latere). Een storting van $500 maakt daardoor al je óúde
percentages achteraf kleiner; een opname maakt ze groter. Bedragen, R, de equity-curve en drawdown
kloppen wél. Oplossing als het nodig wordt: een stortingen/opnames-logboek per account (bestaat al
voor handmatige accounts, `acctCapital`). Dat vul je zelf, of het wordt opgehaald: Hyperliquid
openbaar, Kraken uit de account-log, Blofin en OKX via een extra endpoint. Daarna is de basis = saldo
nu − latere winst − latere stortingen + latere opnames. Tot die tijd: *Instellingen → Percentage
rekent met → Vast referentiebedrag*.

De uitgewerkte teksten van deze ideeën staan in het [archief](docs/backlog-archief-2026-09-29.md).

## Besluiten

| Besluit | Waarom het ertoe doet |
|---|---|
| Welke exchanges krijgen prioriteit? | Bepaalt of er een zevende exchange komt, en daarmee de urgentie van C2 |
| Backend ja of nee? | Pas relevant als API-sleutels uit de browser moeten, of bij cloud-sync |
| Distributiemodel | Gratis/donatie, of iets anders |
| Internationaal (Engels)? | Besloten 26-10-2026: **nee, alleen Nederlands** (F14). Komt alleen terug als Zaratras er later anders over beslist |

