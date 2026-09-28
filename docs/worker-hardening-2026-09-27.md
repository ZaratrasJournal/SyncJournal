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

## 1 · Snelheidslimiet in de Worker zelf

> **Gecorrigeerd op 28-09-2026.** De eerste versie zei: maak een WAF *rate limiting rule* in het
> dashboard. Dat werkt hier niet. WAF-regels gelden op een **zone** — een domein dat in jouw
> Cloudflare-account staat — en de Worker draait op `morani-proxy.moranitraden.workers.dev`.
> `workers.dev` is een domein van Cloudflare zelf, niet van jou. Bovendien geeft het Free-plan
> maar één WAF-regel, en die kan alleen op *Path* en *Verified Bot* matchen, niet op IP.
> De juiste weg is de snelheidslimiet in de Worker zelf.

Cloudflare heeft daar een ingebouwde binding voor. Die telt per sleutel die je zelf kiest — in
ons geval het IP van de bezoeker.

### Instellen in `wrangler.jsonc`

```jsonc
{
  "main": "src/index.js",
  "ratelimits": [
    {
      "name": "LIMIET",
      "namespace_id": "1001",
      "simple": { "limit": 60, "period": 60 }
    }
  ]
}
```

- `period` mag **alleen 10 of 60** zijn (seconden). Andere waarden worden geweigerd.
- `namespace_id` is een vrij te kiezen getal; het onderscheidt tellers binnen je account.
- Vereist **wrangler 4.36 of nieuwer** (`npx wrangler --version`).

### In `worker.js` — exact, tegen v19

Alleen het `export default`-blok verandert. De rest van het bestand blijft ongemoeid.

**Nu:**

```js
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return cors();
    if (request.method !== 'POST') return json({ error: 'Only POST allowed' }, 405);
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }
    const { exchange, action } = body;
    try {
```

**Wordt:**

```js
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors();
    if (request.method !== 'POST') return json({ error: 'Only POST allowed' }, 405);

    // Snelheidslimiet per IP. Staat ná de OPTIONS-check, zodat CORS-preflights niet
    // meetellen. De `if (env.LIMIET)` is met opzet: zonder die guard geeft een deploy
    // vóór de binding bestaat een 500 op élk verzoek, en dan ligt de sync plat.
    if (env && env.LIMIET) {
      const ip = request.headers.get('CF-Connecting-IP') || 'onbekend';
      const { success } = await env.LIMIET.limit({ key: ip });
      if (!success) return json({ error: 'Te veel verzoeken, probeer over een minuut opnieuw' }, 429);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }
    const { exchange, action } = body;

    // Alleen meekijken wie er belt. NIET weigeren: de oude TradeJournal en Morani's
    // eigen journal sturen geen `client` mee en moeten blijven werken.
    console.log('client:', body.client || 'onbekend', '· exchange:', exchange, '· action:', action);

    try {
```

Door die `if (env && env.LIMIET)` maakt de volgorde niet uit: deploy je de code eerst, dan draait
hij gewoon door zonder limiet tot de binding er is.

### Als je de Worker in het dashboard bewerkt

Dan heb je geen `wrangler.jsonc`. De binding voeg je toe onder **Workers & Pages →
morani-proxy → Settings → Bindings → Add binding**. Staat *Rate limiting* daar niet tussen, dan
kan het alleen via wrangler — in dat geval is de eenvoudigste route één keer `npx wrangler init`
op de bestaande Worker en daarna vanaf je eigen machine deployen.

### Wat een lid merkt

Niets, tenzij je de limiet raakt. En dan heeft de app het al opgevangen: `proxyCall` herkent een
429 ([work/syncjournal.html:6055](work/syncjournal.html#L6055)) en zet een oplopende cooldown per
exchange, met de melding *"… is even druk (rate-limit), probeer over ~30s"*.

**Kanttekening:** die melding noemt de exchange, terwijl de 429 dan van ónze Worker komt. Klopt
niet helemaal, maar hij is onschuldig en pas relevant als iemand de limiet daadwerkelijk raakt.
Wil je dat netter, dan moet de app het onderscheid kunnen zien — dat is een aparte kleine
wijziging, niet nodig om dit aan te zetten.

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

**De snelheidslimiet**, vanaf je eigen machine — de tweede regel hoort een 429 te geven:

```bash
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code} " -X POST -H "Content-Type: application/json"     -d '{"exchange":"okx","action":"test","client":"syncjournal-web"}'     https://morani-proxy.moranitraden.workers.dev
done; echo
```

Je zou eerst een reeks normale antwoorden moeten zien en daarna `429`. Gebeurt dat niet, dan is
de binding niet actief — controleer de naam (`LIMIET`) en of `env` in de handtekening staat.

**Het log-label**: `wrangler tail`, of **Workers & Pages → morani-proxy → Logs**. Je zou drie
soorten regels moeten zien: `syncjournal-web`, en `onbekend` voor de oude journal en voor Morani.

En daarna één keer echt syncen in de app, want dat is de enige toets die telt.
