# GitHub setup — SyncJournal

Repo: **https://github.com/ZaratrasJournal/SyncJournal**

Stap-voor-stap voor Denny en Sebas. "Eenmalig" = één keer per machine. Daarna is de dagelijkse flow kort.

---

## Deel 1 — Eenmalig (Denny, lokale map koppelen aan bestaande repo)

### 1. Installeer Git op Windows
- Download: https://git-scm.com/download/win → installer draaien, alle defaults akkoord.
- Check in terminal: `git --version` moet iets als `git version 2.xx` tonen.

### 2. Installeer GitHub CLI (aanbevolen)
- Download: https://cli.github.com/ → installeren.
- In terminal: `gh auth login` → GitHub.com → HTTPS → inloggen via browser.

### 3. Stel je git-identiteit in (één keer per machine)
```bash
git config --global user.name "Denny"
git config --global user.email "jouw-email@example.com"
```
Gebruik hetzelfde e-mailadres als op je GitHub-account.

### 4. Koppel de lokale map aan de bestaande repo

Er zijn twee situaties — kies de juiste:

**Situatie A — de repo op GitHub is nog leeg** (geen commits, geen README):
```bash
cd "C:/Users/Denny/Documents/Tradejournal"
git init
git branch -M main
git add TradeJournal_v4_14.html tradejournal.html CLAUDE.md GITHUB_SETUP.md .gitignore
git commit -m "Initial commit: v4_14 and v9 baseline"
git remote add origin https://github.com/ZaratrasJournal/SyncJournal.git
git push -u origin main
```

**Situatie B — de repo heeft al commits** (bv. een README.md die GitHub aanmaakte):
```bash
cd "C:/Users/Denny/Documents/Tradejournal"
git init
git branch -M main
git remote add origin https://github.com/ZaratrasJournal/SyncJournal.git
git pull origin main --allow-unrelated-histories
git add TradeJournal_v4_14.html tradejournal.html CLAUDE.md GITHUB_SETUP.md .gitignore
git commit -m "Add TradeJournal baseline files"
git push -u origin main
```

> Weet je niet welke situatie? Open https://github.com/ZaratrasJournal/SyncJournal — zie je al bestanden? → situatie B. Leeg? → situatie A.

### 5. Nodig Sebas uit (sla over als hij al collaborator is)
- Repo → Settings → Collaborators → Add people → Sebas' GitHub username → Write-rechten.

### 6. Bescherm de `main` branch
Repo → Settings → Branches → Add branch ruleset:
- Branch name pattern: `main`
- Require a pull request before merging → aan
- Require 1 approval → aan

Zo kan niemand per ongeluk direct op `main` pushen; alles gaat via PR.

---

## Deel 2 — Eenmalig (Sebas)

1. Git + (optioneel) GitHub CLI installeren — stappen 1–3 hierboven.
2. Uitnodiging van Denny accepteren.
3. Repo clonen:
```bash
cd "C:/Users/Sebas/Documents"   # of waar jij je projecten hebt
git clone https://github.com/ZaratrasJournal/SyncJournal.git
cd SyncJournal
```

Klaar. Je hebt nu lokaal dezelfde bestanden als Denny.

---

## Deel 3 — Dagelijkse flow (voor allebei)

### Beginnen met werken
```bash
cd pad/naar/SyncJournal
git checkout main
git pull                              # haal laatste wijzigingen
git checkout -b feature/korte-naam    # bv. feature/csv-import-bybit
```

### Tijdens het werken
Commit vaak, in kleine stukjes:
```bash
git add tradejournal.html
git commit -m "Add CSV parser for Bybit trades"
```

### Klaar met feature → push + PR
```bash
git push -u origin feature/korte-naam
```
Dan:
- GitHub toont een link in de terminal — klik die, of ga naar de repo.
- "Create pull request" → korte beschrijving → vraag de ander om te reviewen.
- Na approval → "Merge pull request".

Of volledig via CLI:
```bash
gh pr create --title "Add Bybit CSV import" --body "Beschrijving..."
# na approval:
gh pr merge --squash
```

### Conflicten
Als `git pull` of een merge een conflict geeft:
1. Open het bestand → zoek naar `<<<<<<<`, `=======`, `>>>>>>>`.
2. Kies welke code blijft (of combineer) en verwijder de markers.
3. `git add bestand.html && git commit`.

Niet paniekeren — vraag elkaar of Claude Code om hulp.

---

## Deel 4 — Handig om te weten

- **`.gitignore`** staat al in de repo. Niets met API-keys of `.env` committen.
- **Nooit API-keys committen.** Als het toch gebeurt: key direct revoken bij de exchange, dan pas oplossen in git (met `git filter-repo` — vraag Claude).
- **Releases** — versie uitbrengen naar community: GitHub → Releases → Draft a new release → tag bv. `v9.1` → users downloaden de `.html`.
- **Issues** — bugs/features bijhouden in GitHub Issues. Gratis projectmanagement voor jullie twee.

---

## Checklist Denny (eerste keer)
- [ ] Git geïnstalleerd
- [ ] `git config --global` gedaan
- [ ] Lokale map gekoppeld aan SyncJournal repo
- [ ] Eerste push gedaan
- [ ] Sebas is collaborator
- [ ] `main` branch protection aan

## Checklist Sebas (eerste keer)
- [ ] Git geïnstalleerd
- [ ] `git config --global` gedaan
- [ ] Uitnodiging geaccepteerd
- [ ] Repo gecloned
- [ ] Eerste feature-branch gemaakt en gepusht
