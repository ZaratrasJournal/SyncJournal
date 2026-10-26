# Review → Beeld: alle tags in het infopaneel — rapport (26-10-2026)

Branch `review-info-tags`, vanaf `origin/release-v1.18.2`. Eén wens van Zaratras: het infopaneel naast de grote
afbeelding toont álle tags van de trade, als gekleurde blokjes per soort.
Geen versie opgehoogd, geen release; de spec stond al niet in `tests/release-set.js` (wél in de poort-uitvoer, als
`review-beeld-info`). Changelog: één regel onder `## [Unreleased]` → Gewijzigd.

## Wat er veranderde (`work/syncjournal.html`)

- **`overzichtTags(t, metTf)`** (de bron van de Tags-kolom in de tradelijst) geeft nu per tag ook zijn soort mee:
  `{tag, kleur, key}`. De kleur komt nog steeds uit `tagKleur(key, tag)`. Nieuw is de optie `metTf`: dan telt ook het
  losse `t.timeframe` mee (trades zonder lagen). De Tags-kolom roept hem aan zonder die optie en ziet er dus precies
  hetzelfde uit (`tag-kleuren` 64/64).
- **Nieuw `revTagGroepen(t)`**: groepeert `overzichtTags(t, true)` per soort, in de volgorde Timeframe, Setup-type,
  Confirmaties, Emoties, Fouten, Missed-redenen, Eigen labels (`REV_TAG_VOLGORDE`, kopjes uit `TAG_CATS`).
  Lege soorten vallen weg. Elke tag één keer (de ontdubbeling van `overzichtTags`).
- **Nieuw `revBeeldTags(t)`**: het blok in het paneel. Eerst Playbook (`t.setup`), dan de groepen. Per soort een rij
  met het kopje links en de chips rechts. Timeframes top-down met een `→` ertussen, bv. `4H → 15M`.
  Zonder playbook en zonder tags: één regel "Nog geen tags" met de knop **✎ Tags toevoegen**
  (`closeRevPres(); openForm(id)`).
- **`revBeeldInfo(t)`**: bovenin blijven pair, richting, datum/tijd/sessie, R en P&L (privacy-modus laat het bedrag
  weg). De rijen Lagen/Playbook/Setup/Confirmaties zijn vervangen door het tag-blok; Entry/Stop/Exit, R:R gepland,
  de TP's, de notitie en *Kopieer voor Discord* staan eronder zoals voorheen.
- **Nieuw `revTpRij(x, t)`**: één TP-rij in het paneel (zie de SL hieronder).
- CSS: alleen `.revpres aside .bitags …` erbij: chips mogen afbreken (`white-space:normal; overflow-wrap:anywhere`),
  het pijltje en de lege regel in `var(--muted)`. Geen nieuwe kleuren.

### Hergebruikt, niets nieuws gebouwd

- De chip zelf: **`kleurChips()`** → `<span class="tagchip col" style="--tc:…">`, dezelfde als in de Tags-kolom van de
  tradelijst. Playbook staat in de gewone `.tagchip` (neutraal), want het is geen tag-soort met een eigen kleur.
- De kleuren: **`tagKleur()` / `TAG_CATS` / `EMO_KLEUR`**: Setup-type `--accent`, Confirmaties `--teal`,
  Timeframe `--violet`, Emoties `--green`/`--red` (naar `tagConfig.emotionNeg`), Fouten `--amber`,
  Missed-redenen `--pink`, Eigen labels `--muted`.
- Waar de tags vandaan komen: lagen (`timeframe`, `setups`, `confirmations`), `tradeEmotions` / `tradeMistakes`
  (ook het oude enkelvoud `emotion` / `mistake`), `missedReasons`, losse `tags` (die vallen in de soort waarin ze in
  `tagConfig` staan, anders Eigen labels) en `t.timeframe`. NB: een functie `syncTradeFlatFields` bestaat in
  SyncJournal niet (die is van de oude app); de platte velden hierboven zijn wat oudere/gemigreerde trades hebben.

## De SL-rij

Een trade die op de stop dichtging, had in het paneel `SL 79.901 · 100% ✓` in het groen: het niveau heeft
`soort:'sl'` en `hit:true`, en het paneel kleurde elke `hit` groen. Dat klopte niet: `tpTelt()` zegt zelf dat een stop
of liquidatie geen take-profit is, en in het trade-formulier (de stappentabel) en de trade-details staat zo'n sluiting
als **SL** naast een rode Stop-loss, niet als een behaalde TP.
Nu: `revTpRij` gebruikt `tpTelt`. Een SL/Liq (of een sluiting met de hand op verlies, `Close ✋`) staat **rood en
zonder ✓**; een behaalde TP blijft groen met ✓.

Niet aangepast (opdracht: Discord niet veranderen): **de Discord-tekst en -afbeelding** (`revTpRegels` / `revTps`)
zetten nog steeds `SL 79,901 ✓`, en de afbeelding toont die regel groen. Hetzelfde geldt voor `revTpBlok` in
*Presenteer* en `tpBreakdown` op de per-trade-pagina (groen bolletje met ✓). Zaratras: wil je dat daar ook
gelijktrekken? Dan is het per plek een kleine wijziging met dezelfde `tpTelt`.

## Tests

`tests/review-beeld-info.spec.js`: deel 4 erbij (`--deel=4`). Eerst rood (13 ✗, het blok bestond niet), daarna groen:

- trade met laag 1H / MSB / OB + FVG, emotie Rustig, fout Te vroeg in, eigen label Test, playbook Breakout: kopjes
  in de juiste volgorde, elke tag één keer, elke chip in de kleur van zijn soort **én gelijk aan dezelfde chip in de
  tradelijst**, in licht en donker;
- trade zonder lagen met alleen platte velden (`timeframe`, `tags` OB/SFP/nieuwsdag, oud `emotion` FOMO, oud
  `mistake`, `missedReasons`): alles verschijnt in de juiste soort, FOMO rood, Durf roze, geen "Lagen —", geen lege kopjes;
- trade zonder tags: "Nog geen tags", geen kopjes, de knop opent het formulier van die trade;
- SL-sluiting: rij "SL" rood, zonder ✓; de Discord-tekst is ongewijzigd;
- privacy-modus: geen bedrag, tags blijven; 390 px: lange tag loopt binnen het paneel door, geen horizontale
  scroll, de weergave scrollt zelf; geen JS-fouten.

Deel 3 had één assertie op de oude tekstrijen ("Setup: SFP, BOS"); die kijkt nu of dezelfde waarden als chip staan,
en of de lagen top-down (`4H → 15M`) staan.

| Spec | Uitkomst |
|---|---|
| review-beeld-info | 55/55 |
| review-beeld | 93/93 |
| review-volgorde | 11/11 |
| discord-meerdere | 55/55 |
| tag-kleuren | 64/64 |
| privacy-mode | 30/30 |

Schermafdrukken (niet gecommit, `tests/screenshots/review-beeld-info/`): `tags-light.png`, `tags-dark.png`,
`tags-390.png`, `breed-sl-{light,dark}.png`, `breed-leeg-{light,dark}.png`. Zelf bekeken: chips leesbaar in beide
thema's, de lange tag breekt netjes af op 390 px, de SL-rij rood, de lege staat rustig.

## Release-poort (`node tests/run-release.js --hier`)

**158/162 groen** (5,9 min); `privacy-mode` en `ruwe-data` groen bij de tweede poging.
- `analytics-metrics`, `matrix`, `tendencies`: alleen "boot zonder fout / geen JS-errors" door
  `net::ERR_TUNNEL_CONNECTION_FAILED` (CDN/fonts in de cloud) — het bekende netwerk-rood.
- `kraken-accountlog-sync` 41/43 ("je short van 14-10 staat er als gesloten trade"): dezelfde uitvoer als in
  `docs/review-pagina-rapport.md`, waar hij ook op de basis rood bleek. Raakt Review niet; vermoedelijk tijdzone (cloud = UTC).
- `hl-csv-echt` overgeslagen (fixture ontbreekt in de cloud).

## Met de hand bekijken (Zaratras)

1. Review → Beeld, klik een tegel van een trade met veel tags: kloppen kopjes en kleuren met je tradelijst?
2. Een oude trade (van vóór de lagen): staan zijn tags er nu?
3. Een trade die op de stop dichtging: SL rood, geen ✓. Discord laat de SL nog als ✓ zien (zie boven): gelijktrekken?
4. Telefoon: paneel onder de afbeelding, lange tags breken af.
