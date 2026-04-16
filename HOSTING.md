# SyncJournal — Workflow & Distributie

Twee folders in de GitHub repo:

- **`/main/tradejournal.html`** → final versie. Community downloadt hier.
- **`/work/tradejournal.html`** → werk-in-uitvoering. Alleen Denny + Sebas.

Als we tevreden zijn met de `work` versie → kopiëren naar `main` → pushen → community downloadt de nieuwe versie.

---

## 📦 Voor de community: downloaden & updaten

### Eerste keer

1. Open **https://github.com/ZaratrasJournal/SyncJournal/tree/main/main**
2. Klik op `tradejournal.html`
3. Klik rechtsboven op het **Download raw file** icoon (↓ pijl omlaag)
4. Sla op in een vaste map, bijv. `C:\SyncJournal\tradejournal.html`
5. Dubbelklik het bestand → opent in Chrome/Edge/Firefox
6. **Bookmark de file-locatie** (of maak een snelkoppeling op je desktop)

> 💡 **Tip:** gebruik altijd **dezelfde map** voor re-downloads. Je localStorage-data is gekoppeld aan het file-pad. Andere map → data weg.

### Updaten (nieuwe versie)

1. Open dezelfde URL → download raw file
2. **Overschrijf** het bestaande `tradejournal.html` (NIET een nieuwe kopie in een andere map)
3. Ververs je browser-tab → nieuwe versie draait, data blijft

### Backup (verplicht bij grote updates)

Vóór je een nieuwe versie download:
- Instellingen in SyncJournal → **Export JSON** → bewaar ergens veilig
- Als update iets breekt → reimporteer de backup

---

## 🛠️ Voor Denny + Sebas: dev workflow

### Setup (eenmalig)

```bash
git clone https://github.com/ZaratrasJournal/SyncJournal.git
cd SyncJournal
```

### Dagelijks werken

```bash
# 1. Laatste wijzigingen trekken
git pull

# 2. Open work versie lokaal voor testen
# (open work/tradejournal.html in je browser via Live Server / localhost)

# 3. Bewerk work/tradejournal.html
# ... bouwen + testen ...

# 4. Committen + pushen
git add work/tradejournal.html
git commit -m "WIP: feature X"
git push
```

### Release: work → main (community ziet nieuwe versie)

Wanneer je tevreden bent:

```bash
# Kopieer work naar main
cp work/tradejournal.html main/tradejournal.html

# Commit met duidelijke message (dit is wat community ziet in commit log)
git add main/tradejournal.html
git commit -m "Release v12.X: korte beschrijving van wat er nieuw is"
git push
```

Community member doet volgende keer `Download raw file` → heeft nieuwste versie.

### Alleen docs/backlog bijwerken

Geen release nodig, gewoon committen:

```bash
git add BACKLOG.md
git commit -m "Backlog: update"
git push
```

---

## ⚠️ Valkuilen

### localStorage & file-pad

Elke browser koppelt localStorage aan het **exacte file-pad** (`file:///C:/SyncJournal/tradejournal.html`).

- Bestand naar andere map verplaatsen → data weg (import JSON backup!)
- Renamen → data weg
- Op een ander apparaat openen → andere localStorage (import backup)

**Oplossing voor meerdere apparaten:** altijd JSON-export bij je laatste data, import op nieuw apparaat.

### `work` en `main` hebben verschillend gedrag

Je test op `work/tradejournal.html` → andere localStorage dan `main/tradejournal.html` (verschillend file-pad).

Dit is **goed** — je breekt nooit per ongeluk je echte data tijdens testen. Maar bedenk: testdata zit in `work`, niet in `main`.

### Schema-migraties

Als je `tj_*` localStorage keys wijzigt of nieuwe velden op trades toevoegt:
- Altijd migratie toevoegen in `runSchemaMigrations()`
- Test op `work` met een kopie van je echte data (JSON import)
- Pas na verificatie → release naar `main`

### Vergeten naar main te kopiëren

Alleen pushen naar `work/` → community ziet niks. Checklist bij release:
1. `cp work/tradejournal.html main/tradejournal.html`
2. `git diff main/tradejournal.html` (is dit wat je wil vrijgeven?)
3. Commit + push

---

## 📋 Community-bericht voor Discord

```
🎯 SyncJournal — download-link

👉 https://github.com/ZaratrasJournal/SyncJournal/tree/main/main

1. Klik op "tradejournal.html"
2. Klik rechts op de ↓ "Download raw file" knop
3. Sla op in een vaste map (bijv. C:\SyncJournal\)
4. Dubbelklik → opent in je browser

Updates: re-download in DEZELFDE map (overschrijf oude bestand).
Backup eerst: Instellingen → Export JSON.

Data blijft in je eigen browser, niemand kan erbij.
```

---

## 🔒 Wie kan erbij?

- **Private repo:** community-leden moeten GitHub-account hebben + als collaborator toegevoegd worden (Repo → Settings → Collaborators)
- **Public repo:** iedereen met de link kan downloaden — simpeler, maar code is openbaar zichtbaar

Wissel kan altijd later via Settings → General → Change visibility.

---

## 🐛 Troubleshooting

| Probleem | Oplossing |
|---|---|
| `localStorage is null` na update | Bestand staat op ander pad dan voorheen — verplaats terug of import JSON-backup |
| Community ziet oude versie | Vergeet je niet `cp work/tradejournal.html main/` + push? |
| Merge conflict op main/tradejournal.html | Twee mensen editten main direct. Regel: main is alleen kopie-uit-work, niet direct editten. |
| Browser opent HTML als tekst | Gebruik "Download raw file" (↓ icoon), niet "Copy" — "Copy" geeft URL-tekst |

---

*Laatst bijgewerkt: 2026-04-16*
