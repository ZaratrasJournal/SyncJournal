# Stand van zaken — avond 28-09-2026

*Voor Denny, om 's ochtends te lezen. Alles staat in de werkmap, **niets is gecommit en niets
is gepusht**. v1.0 draait ongewijzigd op syncjournal.nl.*

---

## In één alinea

Je meldde dat R op `+0,0R` bleef staan. Dat klopte, en je had gelijk over de oorzaak: er stond
nergens een stop-loss. Maar de app maakte er wél een fout van, want hij zei `+0,0R` — en dat
betekent "precies break-even", niet "niet te bepalen". Datzelfde misverstand zat in elk
R-gemiddelde in de app. Daarnaast bleek uit de OKX-melding van je community-lid dat een mislukte
koppeling in stilte verdween: je kreeg een groene "✓ verbonden" terwijl er niets werkte.

---

## 1 · R stond op nul terwijl hij onbekend was

**Wat er mis was.** De app gebruikte het getal `0` voor twee verschillende dingen: "deze trade
sloot precies op break-even" en "we kunnen R niet bepalen". Die zijn niet hetzelfde, maar ze
kregen dezelfde tekst.

**Waarom het meer dan cosmetisch was.** Het gemiddelde rekende ermee:

```js
avgR: list.reduce((s,t) => s + tradeR(t), 0) / n   // n = álle trades
```

De teller telde alleen de trades mét een R, de noemer telde ze allemaal. Elke trade zonder stop
trok het gemiddelde dus naar nul. Bij tien trades zonder stop is `Gem. R` gegarandeerd `+0,00R`,
wat opnieuw leest als "je draait break-even".

**Wat er nu gebeurt.**

| Situatie | Toen | Nu |
|---|---|---|
| Geen stop-loss (winst óf verlies) | `+0,0R` | `—`, met uitleg bij hover |
| Stop-loss, resultaat +1,8R | `+1.8R` | `+1,8R` |
| Stop-loss, verlies op de stop | `-1.0R` | `−1,0R` |
| Stop-loss, écht break-even | `+0,0R` | `+0,0R` — blijft |
| Gem. R zonder enkele bruikbare R | `+0,00R` | `—` |

**Hoe.** De app hád dit antwoord al: `tradeROrNull()` en `aggR()` bestonden en werden gebruikt
door de €/%/R-schakelaar. Alleen de R-kolom en alle gemiddelden sloegen ze over. Er is dus geen
nieuw gedrag bedacht — elf plekken zijn aangesloten op wat er al lag, via één nieuwe helper:

```js
// Gemiddelde R over álleen de trades waarvan R bekend is. n===0 betekent
// "niets te middelen", en dan hoort er een streepje te staan.
function gemR(rows){const a=aggR(rows);return {avg:a.n?a.sum/a.n:0,n:a.n,miss:a.miss};}
```

Geraakt: R-kolom, Recente trades, twee plekken in het trade-detail, de dashboard-KPI, de
periode-vergelijking, "Waar zit je edge", beide Tendencies-weergaves, Playbook, Grades en het
coach-exportbestand.

**Bonusfout, gevonden onderweg.** In het coach-pakket dat je met een coach deelt stond:

```js
wins = trades.filter(t => tradeR(t) >= 0).length
```

Een trade zónder R geeft daar `0`, en `0 >= 0` is waar — dus elke trade zonder stop-loss telde
mee als **winst**. De win-rate in dat gedeelde bestand was daardoor te hoog. Staat nu op
`pnl > 0`, zoals de rest van de app.

## 2 · Mislukte koppeling verdween in stilte

Naar aanleiding van de OKX-melding. Drie dingen zaten fout:

**a. Het IP in de melding is niet van de gebruiker.** `2a06:98c0:3600::103` valt in
`2a06:98c0::/29`, een Cloudflare-range — dat is jouw Worker. OKX ziet nooit het IP van je
gebruiker, dus een IP-whitelist kán niet kloppen. En het is niet te repareren met het "juiste"
IP: Workers hebben geen vast uitgaand adres. De ruwe tekst stuurde mensen juist het verkeerde
gat in.

Dit geldt alleen voor de exchanges achter de Worker:

| Exchange | Route | Whitelist mogelijk? |
|---|---|---|
| OKX, MEXC, Kraken | via de Worker (die exchanges staan geen directe browser-verbinding toe) | ✗ nooit |
| Blofin | rechtstreeks vanuit de browser | ✓ werkt |
| Hyperliquid | publieke wallet-data | n.v.t. |

De melding wordt nu vertaald in `proxyCall` — dus per definitie alleen voor de drie die er
doorheen lopen. Blofin en Hyperliquid krijgen hem nooit, en daar ís de whitelist ook zinvol.

**b. De fout stond in een toast.** Die verdwijnt na een paar seconden, terwijl je de uitleg juist
nodig hebt tijdens het opnieuw aanmaken van je sleutel. Er staat nu een vast rood blok in de
verbind-kaart, dat blijft tot een poging wél lukt.

**c. "Verbinden" loog.** Dit was de ernstigste:

```js
CONNS[id]={...,connected:true,...};  toast('✓ ... verbonden ...','ok');
(async()=>{try{await refreshBalance(id);await syncExchange(id,{});}catch(e){}render();})();
```

De koppeling werd als geslaagd weggeschreven vóór er één aanvraag was gedaan, en de fout
verdween in een lege `catch`. Bovendien bleek `refreshBalance` de fout nóg een niveau dieper al
in te slikken (`catch(err){return false;}`), dus mijn eerste patch ving niets — dat kwam pas uit
de test. Nu legt `refreshBalance` de fout vast en toont de kaart hem.

**d. Preventief.** De `🔒`-uitleg bij OKX, MEXC en Kraken zegt nu dat de IP-whitelist uit moet.
Bij Blofin en Hyperliquid staat dat er nadrukkelijk níét.

## 3 · FAQ klopte niet meer

Er stond: *"De app praat rechtstreeks met de exchange; je keys gaan niet naar een externe
server."* Dat is waar voor Blofin en Hyperliquid, maar niet voor OKX, MEXC en Kraken — daar gaan
key, secret en passphrase door de Worker. Herschreven naar wat er echt gebeurt.

> **Nog te bevestigen door jou:** ik heb bewust *niet* geschreven dat de Worker niets bewaart,
> want die code beheer jij buiten deze repo en ik kan het niet nakijken. Als hij niets logt, kun
> je die zin toevoegen. Logt hij wel iets, dan moet het er juist anders in.

---

## Wat ik heb getest

| Spec | Checks | Wat het bewaakt |
|---|---|---|
| `tests/r-scenarios.spec.js` | 27 | negen soorten invoer: geen stop, stop=entry, stop zonder exit, absurde R, short, échte nul… plus dat het gemiddelde 0,45 is en niet 0,225 |
| `tests/r-zonder-stop.spec.js` | 17 | de R-kolom, Recente trades en het detailscherm |
| `tests/conn-fout-zichtbaar.spec.js` | 20 | fout blijft staan, verdwijnt bij succes, waarschuwing alleen bij de juiste exchanges, FAQ-inhoud |
| `tests/ip-whitelist-melding.spec.js` | 19 | de vertaling zelf + welke exchanges via de Worker lopen |

Alle vier groen. Beide thema's visueel gecontroleerd (licht en donker).

### Brede regressie — geen enkele

`proxyCall` en `refreshBalance` raken álle exchanges, dus daar zijn 66 specs overheen gegaan
(okx / mexc / kraken / blofin / hyperliquid / sync / balance / dashboard / multi-account / …).
Twee volledige rondes van elk ~49 minuten: één met mijn wijziging, één met de **gecommitte v1.0**
en verder exact dezelfde tests.

```
rood in basislijn (v1.0) : 35
rood met mijn wijziging  : 31

NIEUW ROOD door mijn wijziging : GEEN
```

Het verschil van vier is precies mijn vier nieuwe specs: die falen op v1.0 (ze testen gedrag dat
er toen nog niet was) en slagen nu. **Geen regressie.**

De 31 rode specs stonden dus al rood vóór vanavond. Dat sluit aan op wat in `CLAUDE.md` staat
sinds de runner de map is gaan lezen: ongeveer de helft van de 174 specs beschrijft de óúde
journal (verdwenen UI, hernoemde teksten). Zie backlog-story 17–19.

Ik heb deze meting expliciet twee keer gedaan omdat ik hem eerder op de avond fout deed: toen
draaide ik het héle bestand terug, tests inbegrepen, en trok te snel een conclusie. Die ronde
telt niet mee.

---

## Mijn advies

**Niet meteen releasen.** v1.0 staat één dag live en je presenteert vanavond. Deze twee
verbeteringen kunnen prima mee in v1.1 daarna.

**Die OKX-user heeft geen release nodig.** Antwoord dat je meteen kunt sturen:

> Je hebt bij het aanmaken van de sleutel *Trusted IP addresses* aangezet. Dat werkt bij
> SyncJournal niet, en het IP in de foutmelding is ook niet van jou — dat is onze tussenserver.
> SyncJournal praat via die server met OKX (OKX staat een directe verbinding vanuit de browser
> niet toe), dus OKX ziet nooit jouw eigen IP. En dat adres wisselt per aanvraag, dus er is geen
> IP dat je kunt invullen.
>
> Maak de sleutel opnieuw aan met **Trusted IP addresses uit** en vink alleen **Read** aan. Dat
> is veilig: zo'n sleutel kan alleen meekijken, nooit handelen of geld opnemen. Alleen sleutels
> mét handels- of opnamerechten verlopen bij OKX als er geen IP aan hangt — een leesrecht-sleutel
> niet.

---

## Klaar om te plakken bij een release

```markdown
## [v1.1] — 2026-09-XX

### Fixed
- R toont een streepje in plaats van `+0,0R` wanneer er geen stop-loss is ingevuld. Zonder stop
  is er geen risico om je resultaat tegen af te zetten, dus is R niet te bepalen — `+0,0R` las
  ten onrechte als "precies break-even".
- Gemiddelde R (dashboard, playbook, grades, tendencies, edge-overzicht) telt trades zonder
  stop-loss niet langer als nul mee. Die trokken het gemiddelde naar beneden.
- Het coach-exportbestand telde trades zonder stop-loss mee als winst, waardoor de win-rate te
  hoog uitviel.
- Een mislukte exchange-koppeling meldde eerst "verbonden" en verborg de fout. De fout blijft nu
  in beeld staan bij je koppeling, tot een poging wél lukt.
- Een sleutel met een IP-whitelist geeft nu uitleg waaróm dat niet kan werken, in plaats van de
  ruwe foutmelding van de exchange.

### Gewijzigd
- Bij OKX, MEXC en Kraken staat nu bij het koppelen dat de IP-whitelist uit moet.
- FAQ: eerlijker uitleg over welke exchanges rechtstreeks werken en welke via onze tussenserver.
```

---

## Nog open

- **Backlog toegevoegd**: het account-label wordt bij invoeren gekopieerd naar de trade in plaats
  van opgezocht. Hernoem je je account, dan lopen oude en nieuwe trades uit elkaar. Cosmetisch —
  er wordt niets mee gerekend. (Dit was je "ACCOUNT: Test"-vraag; die trade is handmatig
  ingevoerd of demo-data, want gesynct e trades krijgen dat veld nooit.)
- **Niet aangeraakt**: de tien bestaande rode specs, en de Worker-hardening die aan jouw kant ligt.
