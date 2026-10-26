# F14 · besloten beta: stap 4 t/m 6 — rapport

*26-10-2026, gemaakt door een cloud-agent (routine) zonder meelezer. Voor Zaratras.*

**Branch:** `f14-beta`, vanaf `main` (`8b0ac89`, v1.17.2). Niet gemerged, geen release, geen versienummer
opgehoogd, `site/app.html` niet aangeraakt. Nieuwe specs staan **niet** in `tests/release-set.js`.

## Per stap

### Stap 4 · Neutrale tags, met de Morani-set als keuze — `70036b2`
- `TAGSET_ALGEMEEN` naast de bestaande `DEFAULT_TAGCONFIG` (die is de Morani-set en is **ongewijzigd**), en
  `TAG_SETS = {morani, algemeen}`. De algemene set verschilt alleen in setups (Breakout, Pullback, Reversal,
  Range, Trend continuation, Retest, Failed breakout, Momentum) en confirmaties (Support/Resistance, Volume,
  Divergence, News, Trendline, Moving average, Candle pattern, Higher timeframe, Session open). Timeframes,
  emoties, fouten en missed-redenen zijn gelijk aan de Morani-set, zodat de kalm-heuristiek en de
  emotiekleuren blijven kloppen.
- `kiesTagSet(id, modus)`: `samenvoegen` voegt alleen ontbrekende tags toe (verwijdert nooit iets),
  `vervangen` vraagt eerst om bevestiging en laat eigen labels staan, `start` vervangt alleen een journal die
  nog op de onaangeraakte standaardset staat en voegt anders samen. De keuze staat in `sj_tagset`.
- Instellingen → Tags: bovenaan een blok *Startset voor je tags* met per set *Toevoegen* / *Vervangen*.
- **Besluit (zelf genomen):** een journal die niets kiest, houdt de Morani-set als standaard. Reden: bijna
  iedere bestaande gebruiker heeft nooit zelf een set gekozen; een andere standaard zou hun tags in het geheugen
  veranderen. "Bestaande gebruikers merken niets" weegt zwaarder.
- **Gevonden:** `sj_tagconfig` wordt bij élke eerste start al opgeslagen (de schema-migraties doen
  `persistTagConfig()`). "Heeft een eigen tagConfig" kan dus niet aan opslag worden afgelezen;
  `tagConfigEigen()` vergelijkt daarom de lijsten met de standaardset.
- Test: `tests/tag-sets.spec.js` (24 checks): bestaande config byte-gelijk na laden, beide sets kiesbaar in
  een nieuwe journal, samenvoegen verwijdert niets, vervangen alleen na bevestiging, licht/donker/390px.

### Stap 5 · Vertrouwen en veiligheid — `04ed30f`
- **`site/veiligheid.html`** ("Hoe veilig is SyncJournal?"), in de stijl van de privacyverklaring, licht en
  donker: lokaal in je browser; per exchange in één zin hoe je een read-only sleutel maakt (Blofin, OKX,
  Kraken Futures; Hyperliquid alleen een walletadres, nooit je private key); de drie routes (Blofin
  rechtstreeks, OKX en Kraken via de tussenserver, Hyperliquid openbaar) en wat de tussenserver ziet
  (sleutel per verzoek in het geheugen om te ondertekenen) en níet bewaart; back-ups en sleutels (standaard
  zonder); Mori met je eigen Anthropic-sleutel, nooit in een back-up; sleutel kwijt of gelekt → intrekken bij de
  exchange, nieuwe read-only sleutel, opnieuw invullen.
- Links ernaartoe: footer van de landing, de privacyverklaring, `sitemap.xml`, en in de app bij Instellingen →
  Accounts (in de intro én in elk koppel-paneel: "Hoe veilig is dit?", nieuw tabblad). Ook vanuit de FAQ-vraag
  "Zijn mijn API-keys veilig?".
- **`site/privacy.html`** bijgewerkt (datum 26-10-2026): de route per exchange (zei eerst dat álle verzoeken via
  de Worker lopen; Blofin en Hyperliquid doen dat niet), dat de Worker ook de **herkomst-website** en de duur
  telt (v25, `docs/worker-monitoring.md`), nieuw: Mori/Anthropic, de ECB-koers via Frankfurter en de openbare
  OKX/MEXC-contractgegevens, Google Fonts en jsDelivr. Contact noemt nu Zaratras.
- **CSP** in `site/_headers` op `/`, `/index.html`, `/app`, `/app.html`, als
  `Content-Security-Policy-Report-Only`. Uitleg en upgrade-pad: [docs/csp.md](csp.md).
- Test: `tests/veiligheid.spec.js` (34 checks) en `tests/csp.spec.js` (22 checks; een kleine lokale server
  serveert de app en de landing met de policy **afdwingend**, loopt alle pagina's en instellingen-tabs langs met
  voorbeelddata, controleert dat elke externe host toegestaan is en dat een onbekende host wél wordt
  geblokkeerd).

**Externe bronnen in de CSP**

| Directive | Bronnen |
|---|---|
| `script-src` | `'self'` `'unsafe-inline'` cdn.jsdelivr.net (XLSX) · static.cloudflareinsights.com (Web Analytics) · accounts.google.com (Drive-login) |
| `style-src` | `'self'` `'unsafe-inline'` fonts.googleapis.com · accounts.google.com |
| `font-src` | `'self'` fonts.gstatic.com `data:` |
| `img-src` | `'self'` `data:` `blob:` `https:` (screenshots mogen een link naar een plaatje zijn, zoals een TradingView-snapshot) |
| `connect-src` | `'self'` · morani-proxy.moranitraden.workers.dev (Worker) · openapi.blofin.com · api.hyperliquid.xyz · www.okx.com · eea.okx.com · api.mexc.com · api.anthropic.com (Mori) · api.frankfurter.dev (ECB-koers) · www.googleapis.com (Drive) · drive-token.syncjournal.nl · accounts.google.com · cloudflareinsights.com |
| `frame-src` | accounts.google.com |
| overig | `object-src 'none'` · `base-uri 'self'` · `form-action 'self'` · `frame-ancestors 'none'` · geen `'unsafe-eval'` |

**Waarom `'unsafe-inline'`:** alleen bij scripts en stijlen. De app is één HTML-bestand met React en alle code in
inline `<script>`-blokken en ~300 `onclick="…"`-attributen; de landing heeft vier inline scripts; de opmaak is
grotendeels inline `style="…"` (de codebase-afspraak). Zonder start niets. De policy beschermt daarna nog steeds
waar het om gaat: een ingeslopen script kan sleutels niet naar een vreemde host sturen (`connect-src`) en geen
extern script bijladen. Upgrade-pad (onclick → addEventListener, dan hashes) staat in `docs/csp.md`.

### Stap 6 · Onboarding voor wie Morani niet kent — `6ce6079`
- Een welkom in drie stappen in het bestaande `#welcome`-scherm: (1) wat SyncJournal is in twee zinnen, met
  "Zaratras bouwde SyncJournal voor de trade-community van Morani … je hebt geen voorkennis nodig"; (2) tags
  kiezen (algemene set of Morani-set, of later); (3) eerste trades: koppel een exchange (met "Hoe veilig is
  dit?"), importeer een CSV, rondkijken met voorbeelddata, of zelf een trade invullen. Terug kan; *Overslaan*,
  Escape en `hideWelcome()` sluiten het definitief (`sj_onboard = 'klaar'`).
- **Wanneer:** alleen bij een opslag die vóór deze keer laden nog niet bestond (geen `sj_schema`), zonder trades,
  koppelingen of handmatige accounts. Getoond maar niet afgemaakt (`'open'`) → komt bij herladen terug. Een
  bestaande journal ziet het nooit, ook niet als hij leeg is. Via de landing met `?demo=1` niet.
- FAQ: nieuwe vraag *"Ik ken Morani niet. Is SyncJournal ook iets voor mij?"* bij Aan de slag; de tags-vraag legt
  de startset uit. De lege staten bleken al zonder Morani-voorkennis geschreven; de visie-teksten van Zaratras
  (eerste persoon, Morani-gericht) heb ik bewust niet herschreven. "Powered by Morani" en de Morani-links staan
  er nog.
- Test: `tests/onboarding.spec.js` (40 checks): lege journal toont het welkom, alle stappen, overslaan onthoudt
  het, bestaande journal (met trades, leeg, of met een koppeling) ziet het nooit, licht/donker, 1400 en 390px.
- **Specs aangepast** (bewuste gedragswijziging): `tests/helpers/dov-page.js` start voorbij het welkom (zoals
  het al voorbij het oude welkom startte); `e2e-doorloop` en `landing` verwachtten "geen overlay bij een verse
  start" en accepteren nu het onboarding-welkom (nooit het oude welkomscherm). `landing.spec` is getest tegen
  zowel de huidige `site/app.html` als een tijdelijke kopie van de nieuwe app (daarna teruggezet): 31/31.

## Tests

| Spec | Uitkomst |
|---|---|
| tag-sets (nieuw) | 24/24 |
| veiligheid (nieuw) | 34/34 |
| csp (nieuw) | 22/22 |
| onboarding (nieuw) | 40/40 |
| default-tags · tag-kleuren · landing · faq · lege-staten | 14/14 · 64/64 · 31/31 · 55/55 · 134/134 |
| hosted (ook tegen een kopie van de nieuwe app) | 16/16 |

**Release-poort** `node tests/run-release.js --hier`: **139/143 groen**. De vier rode zijn **niet van deze branch**;
ze falen op `main` precies hetzelfde (in een losse worktree gecontroleerd):
- `analytics-metrics`, `matrix`, `tendencies`: alleen "boot zonder fout"/"geen JS-errors" door
  `net::ERR_TUNNEL_CONNECTION_FAILED`. De cloud-sandbox laat de lettertypes en de XLSX-CDN niet door; lokaal
  verwacht ik deze groen.
- `kraken-accountlog-sync`: 2 checks over "je short van 14-10" (gesloten trade met 3 stappen, notities). Lijkt
  datum-afhankelijk (vandaag 26-10); verdient een eigen blik, staat los van F14.

Omgeving: de Playwright-versie in `node_modules` (1.64.1) verwachtte browser-build 1248; de container had 1243 en
de download was dicht. Ik heb in `/opt/pw-browsers` een symlink 1248 → 1243 gezet (alleen in deze container).

## Wat Zaratras zelf moet doen
1. **Review en merge** van `f14-beta`, dan de gewone release (`APP_VERSION`, changelog-blok onder een versie,
   `site/app.html`, demo-data, poort, `deploy/`). Voorstel: **minor** (nieuwe functie: onboarding en tag-sets).
   Voeg `tag-sets`, `veiligheid`, `csp` en `onboarding` toe aan `tests/release-set.js`.
2. **CSP na een week afdwingen**, volgens [docs/csp.md](csp.md): een week met de console open meekijken naar
   `[Report Only] Refused to …`, daarna in `site/_headers` op alle vier de regels `-Report-Only` weghalen,
   `node tests/csp.spec.js` draaien (en de check "nergens al afdwingend" aanpassen), via de werkversie live.
3. **Workers Logs controleren**: de veiligheidspagina en de privacyverklaring zeggen dat de tussenserver geen
   sleutels of IP-adressen bewaart. Dat klopt alleen als *Observability → Workers Logs* bij `morani-proxy` uit
   staat (zie `docs/worker-monitoring.md`). Even nakijken.
4. **Teksten nalezen** op de veiligheidspagina, vooral: de stappen per exchange om een read-only sleutel te maken
   (menu-namen veranderen bij exchanges), en de zin "beheerd door Zaratras" (de Worker draait in het
   Cloudflare-account van Morani; dat staat er niet letterlijk, wel dat Zaratras hem beheert). Past dat bij de
   afspraken met Morani (backlog F14 stap 2)?

## Twijfels en open punten
- **Feedback-plek** (backlog F14 stap 6 noemt "een duidelijke plek voor feedback") zat niet in de opdracht en is
  niet gebouwd. Beta-testers van buiten zitten niet in de community; de veiligheidspagina en de privacyverklaring
  zeggen nu "in de community of aan Zaratras". Een vast kanaal (e-mail of formulier) is nog nodig.
- **Playbooks**: de backlog noemt "neutrale standaard-tags én playbooks". Een verse journal start al met een leeg
  playbook-archief, dus daar zat niets Morani-specifieks in; niets veranderd.
- `sj_tagset` en `sj_onboard` gaan niet mee in een back-up. Bewust: het zijn eenmalige startkeuzes.
- De keuze "Vervangen" vervangt ook emoties, fouten en missed-redenen door die van de set (na bevestiging). Bij de
  twee huidige sets zijn die gelijk, dus in de praktijk raakt het alleen setups en confirmaties.
- Op de werkversie (work.syncjournal.nl) geldt dezelfde CSP, omdat die dezelfde `_headers` gebruikt.
