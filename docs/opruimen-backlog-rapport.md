# Opruimen: backlog, graphify en twee wisselende tests — rapport

*26-10-2026, gemaakt door een cloud-agent (routine) zonder meelezer. Voor Zaratras.*

**Branch:** `opruimen-backlog`, vanaf `origin/main` (`f373eba`, v1.18.5). Geen versienummer opgehoogd, geen
release, niets in `site/`, `deploy/`, `main/` of `work/tradejournal.html`. Ook `work/syncjournal.html` is
uiteindelijk **niet** gewijzigd (zie punt 3).

| Commit | Punt |
|---|---|
| `cd40795` Backlog: drop finished items, add what is open now | 1 |
| `377a72c` CLAUDE.md: drop graphify, describe ?dev=1 as it exists now | 2 |
| `43e7f9e` kraken-accountlog-sync: run in Europe/Amsterdam regardless of machine zone | 3 (+ backlog B12) |
| `3f701eb` Stabilise ruwe-data spec: serve the app on a fixed http origin | 4 |

## 1 · BACKLOG.md

Per punt nagekeken in CHANGELOG.md, de commits en de code.

**Weggehaald (af):**

| Punt | Bewijs |
|---|---|
| F2 Kopieer voor Discord met meerdere trades | v1.18 |
| F5 stopbeweging en exit-reden | v1.18 (Kraken, Hyperliquid, OKX) |
| F9 stop zelf aanpassen / terug naar de exchange | v1.18 |
| F11 funded modus | v1.18 (testfase-melding v1.18.4); het vervolg is nu F15 |
| F12 sleutels niet vanzelf in een back-up | v1.17 |
| W2 ruwe gegevens met `?dev=1` | v1.18, `tests/ruwe-data.spec.js` |
| W5 Worker v25 (`okxHost`, `algos`) | live sinds 25-10 (v1.16.2) |
| C1 lege staten | v1.17.1, commit `573bdb9`; geen losse `*-empty`-classes meer |
| B3 CSV + API dubbel | v1.18.1 |
| B6 OKX-waarschuwing onbekende contractsoort, SL op het exacte contract | commit `ffdeaf3` |
| T1 CSV-import op CI | `csv-synthetisch` staat in de release-set |
| T4 `npm test` = release-poort | `package.json`, commit `413980b` |
| T5 `drive-backup` zonder vaste wachttijden | commit `eb15f93` |
| C3 account-label opzoeken | commit `ec3f657` |
| W3 graphify | besluit Zaratras: weghalen (punt 2) |
| Doorgestreept: F1, F3, F4, F8, F13, B1, B2, B5, B7–B11, C5, T2 | stonden al als gedaan |

Ook weg: de doorgestreepte AI-coach-regel bij *Besluiten* en de tabel *Opgeruimd op 29-09-2026* (git bewaart hem).

**Bleef staan, tekst kloppend gemaakt:**
- **F7** was maar half af: het paneel staat er sinds v1.18, maar drie blokken zijn niet gebouwd
  (`docs/stop-management-rapport.md`): verliezen in R, "stop verder weg" als fout voorstellen, en gepland tegenover
  gehaald (vereist F6). Nu prio 3, alleen als je ze wilt.
- **F10** gaat nu alleen nog over Blofin (OKX v1.15, Kraken en Hyperliquid al eerder), met een korte sectie.
- **F6, T3, W4, W6**: afhankelijkheden die klaar zijn op "—" gezet. **C2 en C4 niet aangeraakt** (C2 noemt nog
  "na T1"; T1 is af).
- *Ideeën*: "Na B1", "Na W3 en T2" en "Na het besluit of de AI-coach blijft" bijgewerkt.

**Erbij:**
- **F14** bijgewerkt: alleen Nederlands (ook als besluit in de tabel); stap 4–6 gebouwd op `origin/f14-beta`;
  open: review/merge/release, Workers Logs controleren, een feedbackplek, stap 1–3. 📅 deze week, prio 1.
- **W1** bijgewerkt: rond 1 november `ORIGIN_MODUS` op `afdwingen`. 📅 deze week, prio 1.
- **W7** nieuw: CSP afdwingen, een week na de F14-release (`docs/csp.md` op `f14-beta`).
- **F15** nieuw: funded fase 2 (import koppelt zelf aan het juiste account via de login uit het MT5-rapport); wacht
  op een MT5-rapport en een MetriX-CSV van Zaratras. Let op: komt het MT5-rapport alleen als XLSX, dan botst het
  met C4.
- **B12** nieuw (uit punt 3): tijden op een pc buiten Nederland, prio 3.

## 2 · CLAUDE.md

- De reflex *Impact-check vóór wijziging aan een gedeelde / cross-exchange helper … graphify* met de twee
  sub-bullets is vervangen door één regel: met grep alle aanroepers zoeken en per exchange toetsen welke paden het
  raakt.
- In de bugfix-regel: "de graphify-impact-check" → "de impact-check".
- Twee regels over het snapshot-fixture-patroon zeiden nog dat `?dev=1` in SyncJournal ontbrak (W2). Nu staat er hoe
  het werkt: Instellingen → Data → "Ruwe gegevens downloaden", afspelen via `docs/w2-ruwe-data.md`.
- De `IS_DEV`-passage klopte al. `graphify-out/` en `graphify-src/` niet aangeraakt. Verder niets herschreven.

## 3 · `tests/kraken-accountlog-sync.spec.js` (41/43 in de cloud)

**Oorzaak.** De spec verwacht 19:12 (Amsterdam) maar draaide in de tijdzone van de machine (cloud: UTC → 17:12).

**Toont de app machine-tijd waar Amsterdam-tijd hoort?** Ja, op een computer buiten Nederland, maar **overal op
dezelfde manier**: `ts2date`/`ts2time` en het formulier (`formMomentMs` maakt van datum + tijd weer een
`openTime`, ook in de zone van de machine). De Kraken-adapter rekent zelf in Amsterdam-tijd (`amsDateTime`), maar
de gedeelde `sjFromTj` overschrijft dat met machine-tijd.

**Wat ik probeerde en terugdraaide.** `sjFromTj` naar `amsDateTime`: de Kraken-spec werd groen, maar `duration` en
`hl-open-tijd` werden rood, en het formulier zou op een pc buiten Nederland bij elke keer opslaan de opentijd met
het zoneverschil verschuiven. Dat is erger dan wat er nu is. Een goede fix moet de hele datumlaag in één keer
omzetten (tabel, formulier, tijdlijn, TP-tijden, "vandaag"); dat is geen kleinste wijziging, dus staat het als
**B12** in de backlog. Leden merken niets: op een Nederlandse computer is machine-tijd Amsterdam-tijd.

**Fix (spec).** De spec draait nu in een browsercontext met `timezoneId: 'Europe/Amsterdam'`: het beeld van een
Nederlands lid, los van de machine. Geen app-wijziging, dus geen changelog-regel.

**Bewijs:**

| Machine-tijdzone | Uitkomst |
|---|---|
| `TZ=UTC` | 43/43 (was 41/43) |
| `TZ=America/New_York` | 43/43 |
| `TZ=Europe/Amsterdam` | 43/43 |

## 4 · `tests/ruwe-data.spec.js` (soms rood na herladen)

**Gemeten.** 20 keer, 4 tegelijk (zoals de poort): **5 van 20 rood**, op "na herladen: knoppen uit" en een keer
op "daarna zonder parameter: blijft uit". Met een log van localStorage vóór en na het herladen, plus een init-script
dat de opslag leest vóórdat de app-code draait, en een tweede pagina in dezelfde context:
- bij de rode runs was localStorage al **leeg voordat de app-code liep** (alleen `sj_welcomed` van de helper);
- de tweede pagina op `file://` zag de sleutels van de app-pagina **vanaf het begin niet**: Chromium had de
  `file://`-pagina een eigen, losse opslag gegeven, die bij het herladen weg was;
- de app schreef niets leeg: de enige `sj_conns`-schrijfactie na het herladen was de boot met de lege opslag.

**Raakt een lid zijn koppelingen kwijt?** Nee. De app schrijft localStorage synchroon (`DB.save`), en leden draaien
hem nooit vanaf `file://` (syncjournal.nl of localhost). Het is de testopzet, geen app-fout.

**Fix (spec).** `tests/helpers/dov-page.js` kreeg een optie `http`: dezelfde `work/syncjournal.html` op
`http://localhost:4173/syncjournal.html`, beantwoord door een Playwright-route (geen server; localhost houdt
`IS_HOSTED` uit, zoals op `file://`). Andere specs veranderen niet; `ruwe-data` gebruikt de optie.

**Bewijs:** daarna 20 keer, 4 tegelijk: **20/20 groen** (47/47 elk).

## Release-poort

`node tests/run-release.js --hier` op de eindstand: **159/162 specs groen** (4,5 min).
- Rood, alleen bekend netwerk: `matrix`, `analytics-metrics`, `tendencies`, elk op "boot zonder fout" en "geen
  JS-errors" door `net::ERR_TUNNEL_CONNECTION_FAILED` (cdn.jsdelivr / fonts in de cloud).
- Overgeslagen (fixtures niet in de kloon): `csv-import`, `hl-echt`, `hl-csv-echt` en delen van de levensloop-specs.
- Verder niets rood. `kraken-accountlog-sync` 43/43, `ruwe-data` 47/47, `duration` 22/22, `hl-open-tijd` 15/15.

Omgeving: `npm install` haalde Playwright 1.64.1, die een browser verwacht die hier niet staat; voor deze run is
1.63.0 (de vooraf geïnstalleerde versie) lokaal in `node_modules` gezet, zonder `package.json` te wijzigen.

## Voor Zaratras
- Deze week: W1 (rond 1 november afdwingen) en F14 (review van `f14-beta`, Workers Logs).
- F15 wacht op jouw MT5-rapport en MetriX-CSV.
- B12 alleen oppakken als iemand de journal op een computer buiten Nederland gebruikt.
