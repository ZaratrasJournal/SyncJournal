# Content-Security-Policy voor syncjournal.nl

*F14 stap 5, 26-10-2026. Voor Zaratras.*

Een Content-Security-Policy (CSP) vertelt de browser van welke adressen de pagina scripts, lettertypes,
plaatjes en verbindingen mag gebruiken. Komt er ooit kwaadaardige code in de pagina terecht (via een
gekaapte bibliotheek of een fout in de app), dan kan die je API-sleutels niet naar een vreemde server
sturen: de browser blokkeert elke verbinding die niet op de lijst staat.

De policy staat in [site/_headers](../site/_headers) op `/`, `/index.html`, `/app` en `/app.html`, voorlopig als
**`Content-Security-Policy-Report-Only`**: de browser meldt overtredingen in de console, maar blokkeert niets.
Vier keer dezelfde regel, want `_headers` kent geen variabelen; wijzig je er één, wijzig ze dan alle vier
(`tests/csp.spec.js` controleert dat ze gelijk zijn).

`/plan` (TradingPlan), `/privacy.html` en `/veiligheid.html` hebben (nog) geen CSP. De twee infopagina's
laden niets van buiten behalve Cloudflare Web Analytics; TradingPlan is een aparte app met eigen bronnen.

## De policy

```
default-src 'self';
script-src  'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://accounts.google.com;
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com;
font-src    'self' https://fonts.gstatic.com data:;
img-src     'self' data: blob: https:;
connect-src 'self' https://morani-proxy.moranitraden.workers.dev https://openapi.blofin.com https://api.hyperliquid.xyz
            https://www.okx.com https://eea.okx.com https://api.mexc.com https://api.anthropic.com https://api.frankfurter.dev
            https://www.googleapis.com https://drive-token.syncjournal.nl https://accounts.google.com https://cloudflareinsights.com;
frame-src   https://accounts.google.com;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

## Elke externe bron, en waarom

Geïnventariseerd uit `work/syncjournal.html` en `site/index.html` (zoek op `https://` en `fetch(`).

| Bron | Soort | Waarvoor |
|---|---|---|
| `cdn.jsdelivr.net` | script | de XLSX-bibliotheek (Excel-import), met SRI-hash vastgezet op versie 0.18.5 |
| `static.cloudflareinsights.com` | script | Cloudflare Web Analytics (alleen op syncjournal.nl, zie de privacyverklaring) |
| `cloudflareinsights.com` | verbinding | waar dat analytics-script zijn telling heen stuurt |
| `fonts.googleapis.com` | stylesheet | de lettertypes (Plus Jakarta Sans, Inter, IBM Plex Mono) |
| `fonts.gstatic.com` | lettertype | de lettertype-bestanden zelf |
| `morani-proxy.moranitraden.workers.dev` | verbinding | de tussenserver (Worker) voor OKX, Kraken Futures en (vroeger) MEXC |
| `openapi.blofin.com` | verbinding | Blofin, rechtstreeks vanuit de browser (Blofin staat dat toe) |
| `api.hyperliquid.xyz` | verbinding | Hyperliquid, openbare wallet-data |
| `www.okx.com`, `eea.okx.com` | verbinding | OKX-contractgegevens (openbaar, zonder sleutel) voor de juiste positiegrootte |
| `api.mexc.com` | verbinding | MEXC-contractgegevens (openbaar), nog voor oude MEXC-data |
| `api.anthropic.com` | verbinding | Mori, de AI-coach, met de eigen sleutel van de gebruiker |
| `api.frankfurter.dev` | verbinding | de euro/dollar-dagkoers (ECB-koersen) |
| `www.googleapis.com` | verbinding | Google Drive-back-up (bestanden lezen en schrijven) |
| `drive-token.syncjournal.nl` | verbinding | onze token-broker voor Drive |
| `accounts.google.com` | script, stijl, verbinding, frame | het Google-inlogvenster voor Drive (Google Identity Services) |
| `https:` (alle) | plaatje | screenshots mogen een link naar een plaatje zijn (bijvoorbeeld een TradingView-snapshot) |
| `data:`, `blob:` | plaatje, lettertype | geplakte screenshots, het Discord-beeld en de favicon |
| `'self'` | alles | de app zelf, `version.json` (update-check) en `demo-dataset.json` (voorbeelddata) |

Komt er een nieuwe externe bron bij (een exchange, een API), voeg hem dan toe aan alle vier de regels, aan
deze tabel en aan `VERBINDINGEN` in `tests/csp.spec.js`. Anders blokkeert de browser hem zodra de policy
afdwingt.

## Waarom `'unsafe-inline'`

Alleen bij `script-src` en `style-src`, en daar is het nodig:

- **Scripts.** SyncJournal is één HTML-bestand: React, de app-code en het analytics-snippet staan in
  `<script>`-blokken in de pagina, en de app gebruikt zo'n 300 `onclick="…"`-attributen in de HTML die hij
  zelf opbouwt. De landing heeft vier inline scripts. Zonder `'unsafe-inline'` start niets.
- **Stijlen.** De app zet bijna alle opmaak inline (`style="…"`, de afspraak in deze codebase) en heeft
  één groot `<style>`-blok.

Wat de policy dan nog wél doet: elk **extern** script, elke verbinding en elk frame moet van de lijst komen.
Een ingeslopen script kan je sleutels dus niet naar een vreemde server sturen (`connect-src`), en geen
script van elders bijladen (`script-src`). `'unsafe-eval'` staat er niet in: de app gebruikt geen `eval`
of `new Function` (de twee `Function("return this")` in de React-bundel draaien alleen als `globalThis`
ontbreekt).

**Upgrade-pad**, als het ooit de moeite waard is:
1. Zet de `onclick`-attributen om naar `addEventListener` (of event-delegatie op `data-`-attributen). Dat
   is het grote werk: honderden plekken.
2. Geef de overgebleven inline `<script>`-blokken een hash (`'sha256-…'`) in `script-src`, of verplaats
   ze naar een los bestand op `'self'`. Een hash moet bij elke release opnieuw worden berekend; dat kan
   in `tests/run-release.js`.
3. Haal dan `'unsafe-inline'` weg bij `script-src`. Bij `style-src` mag het blijven: inline stijlen zijn
   een veel kleiner risico.

## Van Report-Only naar afdwingen (na een week)

1. **Kijk een week mee.** Open syncjournal.nl/app in Chrome of Edge met de ontwikkelaarstools open
   (F12 → Console). Een overtreding staat er als rode regel met
   `[Report Only] Refused to …`. Loop alle pagina's langs, doe een sync per exchange die je zelf hebt, maak
   een Drive-back-up, praat met Mori en laad voorbeelddata. Geen meldingen? Dan is het veilig.
   (Er is geen meldpunt dat overtredingen van leden verzamelt; daarvoor zou een `report-uri` naar een
   eigen server nodig zijn. Voor een kleine beta is zelf kijken genoeg.)
2. **Melding gezien?** Staat de bron terecht niet op de lijst (een nieuwe exchange, een nieuw lettertype),
   voeg hem dan toe zoals hierboven. Lijkt het onbekend of verdacht, laat het dan uitzoeken vóór je
   doorgaat.
3. **Afdwingen.** Vervang in `site/_headers` op alle vier de regels `Content-Security-Policy-Report-Only:`
   door `Content-Security-Policy:`. Draai `node tests/csp.spec.js` (die test de policy al afdwingend en
   moet groen blijven; pas de controle "nergens al afdwingend" dan aan) en doe de release zoals altijd,
   via de werkversie (work.syncjournal.nl) eerst.
4. **Controleer live.** Open de werkversie met de console open: geen rode `Refused to`-regels? Dan naar
   syncjournal.nl.
5. **Terugdraaien** kan altijd: zet `-Report-Only` er weer achter en publiceer opnieuw. Er gaat geen data
   verloren; de CSP raakt alleen wat de pagina mag laden.

Let op: de werkversie (work.syncjournal.nl) draait op dezelfde `_headers` en heeft dus dezelfde policy.
