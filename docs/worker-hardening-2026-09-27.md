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

## 2 · Het client-kenmerk

De app stuurt sinds v0.9.151 in elke Worker-aanroep een veld mee:

```json
{ "exchange": "okx", "action": "test", "apiKey": "…", "client": "syncjournal-web" }
```

Dat is **geen geheim** — het staat in de client en is af te lezen door wie de app opent. Het doel
is een drempel: een script dat de Worker-URL gevonden heeft, stuurt dit veld niet mee.

Het zit bewust in de **body** en niet in een header. Een eigen header maakt van elk verzoek een
CORS-preflight, en dan zou de Worker die header eerst in `Access-Control-Allow-Headers` moeten
toestaan — een extra stap die stuk kan gaan zonder dat je het merkt.

### De wijziging in `worker.js`

Onder `const { exchange, action } = body;` erbij:

```js
    // Alleen onze eigen app. Geen authenticatie — het kenmerk staat in de client — maar het
    // weert scripts die de Worker-URL simpelweg gevonden hebben. Moet gelijk blijven aan
    // CLIENT_TAG in work/syncjournal.html.
    const TOEGESTANE_CLIENTS = ['syncjournal-web'];
    if (!TOEGESTANE_CLIENTS.includes(body.client)) {
      return json({ error: 'Onbekende client' }, 403);
    }
```

### Let op de volgorde — anders breek je members

Oude versies van de app sturen dit veld **niet** mee. Zet je de Worker meteen op weigeren, dan
valt de sync uit voor iedereen die nog niet heeft geüpdatet.

| | Wanneer | Wat |
|---|---|---|
| **A** | Nu, met de release | App-kant uitrollen (v0.9.151). De Worker negeert het onbekende veld gewoon; er verandert niets. |
| **B** | Na 2 à 4 weken | Pas dan de weigering hierboven aanzetten, als vrijwel iedereen geüpdatet is. |

Wil je tussentijds weten hoe ver dat is, zet dan in stap A alvast dit in de Worker in plaats van
de weigering:

```js
    if (body.client !== 'syncjournal-web') console.log('client ontbreekt of wijkt af:', body.client);
```

Die regels lees je terug met `wrangler tail`, of in het dashboard onder **Workers & Pages →
morani-proxy → Logs**. Zie je daar na een paar weken niets meer, dan kun je veilig naar stap B.

---

## Wat hier bewust niet staat

- **Een origin-allowlist.** Zie boven: lost het probleem niet op en breekt `file://`.
- **Een echt geheim in de client.** Dat bestaat niet; alles wat de browser meestuurt is af te
  lezen. Wil je echte authenticatie, dan heb je accounts en een backend nodig, en dat is een
  andere discussie (staat in de backlog onder *Onderzoek*).
- **IP-allowlists.** Members zitten overal; niet te doen.

---

## Controleren dat het werkt

Na stap B, vanaf je eigen machine:

```bash
# zonder kenmerk → hoort 403 te geven
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"exchange":"okx","action":"test"}' \
  https://morani-proxy.moranitraden.workers.dev

# met kenmerk → hoort de normale fout over ontbrekende keys te geven, geen 403
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"exchange":"okx","action":"test","client":"syncjournal-web"}' \
  https://morani-proxy.moranitraden.workers.dev
```

En daarna één keer echt syncen in de app, want dat is de enige toets die telt.
