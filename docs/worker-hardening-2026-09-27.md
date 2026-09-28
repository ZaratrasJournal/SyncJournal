# De Worker dichtzetten — rate limiting + client-kenmerk

*Voor Denny. De Worker-code zit buiten deze repo, dus hieronder staat wat je moet doen en
welke code erin moet. De app-kant is al gebouwd (v0.9.151).*

---

## Wat er aan de hand is

Gemeten op 27-09-2026 tegen de live Worker:

```
Origin: https://syncjournal.nl    → Access-Control-Allow-Origin: *
Origin: https://evil-example.test → Access-Control-Allow-Origin: *
Origin: null                      → Access-Control-Allow-Origin: *
```

De Worker antwoordt iedereen. **Je keys lekken hier niet door** — die zitten in de browser van de
gebruiker en gaan mee in de POST die zijn eigen browser doet. Wat wél kan: iedereen die de URL
kent, gebruikt hem met zijn eigen keys als gratis exchange-proxy, op jouw Cloudflare-quota. Raakt
die op, dan valt de sync uit voor de hele community.

**Een origin-allowlist lost dit niet op.** CORS geldt alleen voor browsers; `curl` en scripts
trekken zich er niets van aan, en dát is de partij die misbruikt. Bovendien draait de app ook
vanaf `file://` (origin `null`), dus een allowlist zou je lokale gebruikers breken.

Daarom deze twee maatregelen.

---

## 1 · Rate limiting in Cloudflare

Geen code nodig, alleen een regel in het dashboard. Dit is de maatregel die er echt toe doet.

1. Cloudflare-dashboard → je account → **Workers & Pages** → `morani-proxy`.
2. Ga naar **Settings → Domains & Routes** en noteer de route (`morani-proxy.moranitraden.workers.dev`).
3. Ga in het linkermenu naar **Security → WAF → Rate limiting rules** → **Create rule**.

| Veld | Waarde |
|---|---|
| Rule name | `syncjournal-proxy-limiet` |
| If incoming requests match | *Custom filter expression* → Field **Hostname** · Operator **equals** · Value `morani-proxy.moranitraden.workers.dev` |
| Characteristics (waarop tellen) | **IP address** |
| Rate | **60** requests per **1 minute** |
| Duration (hoe lang blokkeren) | **10 seconds** |
| Then take action | **Block** |

4. **Deploy**.

**Waarom 60 per minuut.** Een gewone sync doet er een handvol: per exchange een saldo-call, een
trades-call en soms fills per positie. Iemand met vier koppelingen die driftig op ververs drukt,
komt niet in de buurt van 60. Een script dat de Worker leegtrekt wel, meteen.

Zie je na een week niets geblokkeerd staan (**Security → Events**), dan staat hij goed. Klaagt een
member over "even druk", kijk daar dan eerst: de app toont die melding ook bij een 429 van de
exchange zelf, dus het hoeft niet jouw regel te zijn.

---

## 2 · Het client-kenmerk — als label, niet als slot

> **Gecorrigeerd op 28-09-2026.** De eerste versie van dit document zei: laat de Worker verzoeken
> zonder kenmerk weigeren. **Dat zou schade aanrichten.** Denny wees erop dat Morani's eigen
> journal dezelfde Worker gebruikt, en die stuurt geen kenmerk. Bovendien draaien er nog leden op
> de oude `tradejournal.html`, die het ook niet stuurt. Weigeren breekt allebei, stil, zonder dat
> zij weten waarom. Het kenmerk blijft dus een **label om mee te kijken**, geen slot.

De app stuurt sinds v0.9.151 in elke Worker-aanroep een veld mee:

```json
{ "exchange": "okx", "action": "test", "apiKey": "…", "client": "syncjournal-web" }
```

Het zit in de **body** en niet in een header: een eigen header maakt van elk verzoek een
CORS-preflight, die de Worker eerst zou moeten toestaan.

### Wie er allemaal op deze Worker zit

| Client | Stuurt `client` mee |
|---|---|
| SyncJournal (`site/app.html`) vanaf v0.9.151 | `syncjournal-web` |
| De oude TradeJournal (`main/tradejournal.html`), nog bij leden in gebruik | niets |
| Morani's eigen variant | niets |

### De wijziging in `worker.js` — alleen loggen

Onder `const { exchange, action } = body;` erbij:

```js
    // Alleen meekijken: wie roept deze Worker aan? NIET weigeren — de oude journal en
    // Morani's variant sturen geen kenmerk, en die horen gewoon te blijven werken.
    console.log('client:', body.client || 'onbekend', '· exchange:', exchange, '· action:', action);
```

Terug te lezen met `wrangler tail`, of in het dashboard onder **Workers & Pages → morani-proxy →
Logs**. Daarmee zie je wat je wilde weten: hoeveel verkeer van welke app komt, hoeveel leden nog
op de oude journal zitten, en of er verkeer binnenkomt dat van geen van beide is.

### Zou je het ooit wél kunnen afdwingen?

Alleen als élke legitieme client een kenmerk meestuurt. Dat vraagt:

1. Morani zet een eigen kenmerk in zijn journal (bv. `morani-web`).
2. De oude `tradejournal.html` wordt niet meer gebruikt, of krijgt er ook een.
3. Pas dán een lijst in de Worker: `['syncjournal-web', 'morani-web']`.

**Doe dat pas als de logs uit stap 2 laten zien dat er niets meer zonder kenmerk binnenkomt.**
En weeg het nog eens af: het kenmerk staat in de client en is dus af te lezen en te kopiëren.
De bescherming zit in de rate-limit, niet hierin.

## Wat hier bewust niet staat

- **Een origin-allowlist.** Zie boven: lost het probleem niet op en breekt `file://`.
- **Een echt geheim in de client.** Dat bestaat niet; alles wat de browser meestuurt is af te
  lezen. Wil je echte authenticatie, dan heb je accounts en een backend nodig, en dat is een
  andere discussie (staat in de backlog onder *Onderzoek*).
- **IP-allowlists.** Members zitten overal; niet te doen.

---

## Controleren dat het werkt

**De rate-limit**: Cloudflare-dashboard → **Security → Events**. Staat daar na een week niets
geblokkeerd, dan zit de drempel goed. Klaagt een member over "even druk", kijk daar dan eerst —
de app toont die melding ook bij een 429 van de exchange zelf, dus het hoeft niet jouw regel te zijn.

**Het log-label**: `wrangler tail`, of **Workers & Pages → morani-proxy → Logs**. Je zou drie
soorten regels moeten zien: `syncjournal-web`, en `onbekend` voor de oude journal en voor Morani.

En daarna één keer echt syncen in de app, want dat is de enige toets die telt.
