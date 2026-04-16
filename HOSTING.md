# SyncJournal — Hosting voor de community

Hoe je één vaste URL maakt waar de hele community de laatste versie gebruikt. Geen gedoe met downloads, en localStorage blijft per trader consistent.

---

## 🥇 Stap-voor-stap: GitHub Pages aanzetten

### 1. Open GitHub Settings

Ga naar: **https://github.com/ZaratrasJournal/SyncJournal/settings/pages**

Of handmatig:
- Open de repo op github.com
- Klik **Settings** (tab bovenaan)
- Klik **Pages** (in de linker sidebar, onder "Code and automation")

### 2. Source configureren

- **Source:** `Deploy from a branch`
- **Branch:** `main`
- **Folder:** `/ (root)`
- Klik **Save**

### 3. Wachten (1–2 minuten)

GitHub bouwt de site. Je ziet bovenin:
> ⏳ Your site is being built from the `main` branch

Na ~1 min ververs je de pagina → groene balk:
> ✅ Your site is live at **https://zaratrasjournal.github.io/SyncJournal/**

### 4. De juiste URL delen

Omdat de repo meerdere HTML-files heeft, moet de community naar de **juiste file**:

```
https://zaratrasjournal.github.io/SyncJournal/tradejournal.html
```

Deze link pin je in Discord.

---

## 🎯 Optioneel: URL mooier maken met `index.html` redirect

Nu is de URL lang. Met een kleine redirect wordt het:

```
https://zaratrasjournal.github.io/SyncJournal/
```

Voeg `index.html` toe aan de repo-root met deze inhoud:

```html
<!DOCTYPE html>
<meta charset="utf-8">
<title>SyncJournal — redirect</title>
<meta http-equiv="refresh" content="0; url=tradejournal.html">
<link rel="canonical" href="tradejournal.html">
<script>location.replace("tradejournal.html")</script>
<p>Laden… <a href="tradejournal.html">klik hier als er niks gebeurt</a></p>
```

Commit + push → na 1 min werkt `https://zaratrasjournal.github.io/SyncJournal/` direct.

---

## 🔄 Hoe updates werken

1. Jij (of Sebas) pusht naar `main`
2. GitHub bouwt automatisch (~1 min)
3. Volgende keer dat community member F5 doet → nieuwste versie

**localStorage blijft intact** omdat iedereen op dezelfde origin zit. Geen data-verlies bij updates.

Tip: bump het versielabel binnenin de app bij grote changes, dan weet iedereen dat ze iets nieuws hebben.

---

## 📱 Tips voor de community

Stuur samen met de URL deze korte uitleg:

> **SyncJournal openen**
>
> 1. Open **https://zaratrasjournal.github.io/SyncJournal/** in Chrome/Edge/Firefox
> 2. Bookmark 'm, of voeg toe aan je home screen (op mobiel via "Aan startscherm toevoegen")
> 3. Je data blijft in je eigen browser (localStorage). Ander apparaat? → Export JSON uit Instellingen en importeer op het nieuwe apparaat.
> 4. Updates komen automatisch — gewoon de pagina verversen.

---

## 🔒 Later: privé maken

Als je op enig moment **niet meer wil dat iedereen toegang heeft**:

### Optie A: Switch naar Cloudflare Pages + Access (gratis tot 50 users)

1. Zet `zaratrasjournal.github.io` uit (Settings → Pages → "None")
2. Cloudflare Dashboard → Pages → "Create a project" → connect GitHub repo
3. Build settings: leeg laten (statische HTML) → Deploy
4. Cloudflare Access → application aanmaken → email whitelist (bv. community@)
5. Custom domain koppelen: `journal.moranitraden.nl`

Login via email: user krijgt magic-link, kan app gebruiken. Niet-community → 403.

### Optie B: Repo privé maken (kost GitHub Pro voor Pages op private repos)

Simpeler maar $4/maand. Alleen mensen met repo-access zien de Pages site.

---

## ⚠️ Waarschuwingen

- **API-keys in localStorage blijven lokaal** bij elke trader. Ze worden *niet* gedeeld via GitHub Pages. Code is open, data niet.
- **Commit geen `.env`, `*_personal.*` of CSV's.** Staan al in `.gitignore`, dubbel-check bij elke commit.
- **Breaking changes** in storage-schema → denk aan een migratie in `runSchemaMigrations()`, anders raakt iemands data stuk bij update.
- **Privé dev werk?** Maak een aparte branch (`dev`, `feature/xyz`) — alleen `main` wordt live gepusht.

---

## 🚨 Troubleshooting

| Probleem | Oplossing |
|---|---|
| "404 — There isn't a GitHub Pages site here" | Wacht 2 min, dan hard refresh (Ctrl+F5). Check Settings → Pages of branch = `main`. |
| Update is niet zichtbaar | Hard refresh (Ctrl+Shift+R). GitHub Pages cached ~10 min. |
| `localStorage is null` / data weg | User heeft iets in private mode geopend, of andere URL. Check dat ze de vaste URL gebruiken. |
| Build failed | Check de **Actions** tab — meestal een YAML-fout of illegale filename. |

---

*Laatst bijgewerkt: 2026-04-16*
