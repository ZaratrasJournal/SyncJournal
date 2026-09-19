# www.syncjournal.nl geeft "Connection timed out" (522) — wat er aan de hand is en hoe je het oplost

Gemeten op 19-09-2026.

## Wat er precies stuk is

Alleen het **onbeveiligde** adres van www. Dit is wat er nu gebeurt:

| Adres | Resultaat |
|---|---|
| `https://www.syncjournal.nl` | 301 → `https://syncjournal.nl` ✅ |
| `http://www.syncjournal.nl` | **522 Connection timed out** ❌ |
| `http://syncjournal.nl` | 301 → https ✅ |
| `http://work.syncjournal.nl` | 301 → https ✅ |

Het geldt voor élk pad op www over http, niet alleen de voorpagina.

Je ziet het terug in je eigen screenshot: de adresbalk zei **"Niet beveiligd"**. Je kwam dus via `http://`, en precies dat ene pad valt om.

## Waarom

Cloudflare geeft een 522 als hij wél een origin-server probeert te bereiken maar daar geen antwoord van krijgt. Dat betekent dat het verzoek nooit langs je redirect-regel is gekomen — hij ging meteen op zoek naar een webserver die er niet is.

- Het kale domein en `work.` zijn **Pages-projecten**. Cloudflare Pages stuurt http-verzoeken zelf al door naar https, dus die twee lopen nooit tegen dit probleem aan.
- `www` is géén Pages-project maar een DNS-record plus een **redirect-regel**. Aan het antwoord is te zien dat die regel alleen op https-verzoeken matcht (over https komt er een kale Cloudflare-301 terug, zonder origin-headers). Over http slaat hij hem over, probeert Cloudflare alsnog de origin achter het DNS-record te bereiken, en die bestaat niet → 522.

Kort: er ontbreekt een http→https-stap voor `www`.

## De oplossing (5 minuten, twee schakelaars)

### Stap 1 — "Always Use HTTPS" aanzetten (dit lost het op)

1. Ga naar [dash.cloudflare.com](https://dash.cloudflare.com) en klik in de lijst op het domein **syncjournal.nl**. Je zit nu in dat domein; alles hieronder staat in het linkermenu.
2. Klik op **SSL/TLS**. Het menu klapt open met daaronder o.a. *Overview* en *Edge Certificates*.
3. Open eerst **Overview** en kijk of de encryption mode niet op **Off** staat (bij jou hoort dat *Full* of *Full (strict)* te zijn). Staat hij op Off, dan werkt stap 4 niet.
4. Klik op **Edge Certificates**, scroll naar **Always Use HTTPS** en zet de schakelaar **aan**.

Het werkt direct; er is niets om op te slaan of te deployen.

Wat dit doet: Cloudflare beantwoordt élk http-verzoek meteen met een doorverwijzing naar https, nog vóórdat hij een origin-server gaat zoeken. Daarmee wordt `http://www...` eerst `https://www...`, en daar pakt je bestaande redirect-regel het weer op naar het kale domein.

Dit geldt voor het hele domein en verandert niets aan wat er nu al goed gaat.

### Stap 2 — de redirect-regel losmaken van https (voorkomt herhaling)

1. Klik in het linkermenu op **Rules** en dan op **Overview**. Daar staat de lijst met al je regels.
2. Zoek de regel die `www` doorstuurt naar het kale domein en klik erop om hem te openen.
3. Kijk bij **When incoming requests match** waar hij op matcht. Staat daar de volledige URL met `https://` erin (veld *URI Full*), zet het dan om naar:
   - Field: **Hostname**
   - Operator: **equals**
   - Value: `www.syncjournal.nl`
4. Bij **Then** laat je staan: doorverwijzen naar `https://syncjournal.nl` met statuscode **301**, en *Preserve query string* aan.
5. **Deploy**.

Op hostnaam matchen betekent dat het niet meer uitmaakt of iemand met http of https binnenkomt. Stap 1 vangt het al af, maar deze stap haalt de oorzaak zelf weg.

## Controleren of het gelukt is

Zeg het even, dan meet ik het na. Wil je het zelf zien: typ `http://www.syncjournal.nl` in een verse tab (let op de `http://`, anders upgradet je browser stilletjes). Je hoort zonder foutmelding op `https://syncjournal.nl` uit te komen.

Let op: je browser onthoudt de 522 soms even. Gebruik een incognitovenster of ververs hard met Ctrl+F5.

## Nog te overwegen, niet nu nodig

- **HSTS** (SSL/TLS → Edge Certificates) laat browsers je domein automatisch altijd via https openen, waardoor dit soort http-paden nooit meer geraakt worden. Zet dit pas aan als alles stabiel draait: het is met opzet moeilijk terug te draaien, want browsers onthouden het maandenlang.
- **www als Pages-domein** in plaats van een redirect zou ook werken, maar dan bestaat de site op twee adressen naast elkaar. Doorverwijzen naar één adres, zoals het nu is, is beter voor Google en voor de herkenbaarheid.
