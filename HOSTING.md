# SyncJournal — Hosting & Workflow

Hoe de community altijd de **final** versie gebruikt via één vaste URL, terwijl Denny & Sebas vrij kunnen bouwen op een **work** versie zonder ooit iets te breken voor de community.

---

## 🎯 De opzet

- **`main` branch** = SyncJournal final → publieke community-URL (met Cloudflare Access gate)
- **`work` branch** = werk-in-uitvoering → private preview-URL (alleen Denny + Sebas)
- **Cloudflare Pages** deployt beide branches automatisch naar aparte URL's
- **Cloudflare Access** beschermt beide URL's: alleen whitelist-emails kunnen openen

```
Denny/Sebas ─push→ work branch   ─cloudflare→  work.syncjournal.pages.dev  (alleen wij)
                       │
                       │ git merge work (als tevreden)
                       ↓
                    main branch  ─cloudflare→  journal.moranitraden.nl     (community)
```

---

## 🚀 Stap 1: Cloudflare Pages project aanmaken

### 1a. Connect GitHub

1. Ga naar **https://dash.cloudflare.com** → **Workers & Pages**
2. Klik **Create application** → tab **Pages** → **Connect to Git**
3. Autoriseer Cloudflare voor GitHub (eenmalig)
4. Selecteer repo `ZaratrasJournal/SyncJournal`

### 1b. Build settings

Omdat dit een static HTML site is:

| Setting | Waarde |
|---|---|
| **Project name** | `syncjournal` |
| **Production branch** | `main` |
| **Framework preset** | None |
| **Build command** | *(leeg laten)* |
| **Build output directory** | `/` |

Klik **Save and Deploy**.

Na ~30 sec is je production live op `https://syncjournal.pages.dev/tradejournal.html`.

### 1c. Custom domain (optioneel, aanbevolen)

1. In het project → tab **Custom domains** → **Set up a custom domain**
2. Typ: `journal.moranitraden.nl` (of wat je wil)
3. Cloudflare voegt automatisch een CNAME toe (als moranitraden.nl bij Cloudflare staat) — anders DNS bij je provider: `CNAME journal → syncjournal.pages.dev`

---

## 🔐 Stap 2: Cloudflare Access (community gate)

Zonder Access is je URL publiek. Access voegt een **email-login** toe: alleen whitelist kan openen.

### 2a. Access aanzetten

1. Cloudflare Dashboard → **Zero Trust** (links in menu)
2. Eerste keer: setup wizard (naam kiezen, gratis plan → up to 50 users)
3. **Access** → **Applications** → **Add an application** → **Self-hosted**

### 2b. App configureren

| Setting | Waarde |
|---|---|
| **Application name** | SyncJournal |
| **Session duration** | `1 month` (anders loggen mensen te vaak in) |
| **Application domain** | `journal.moranitraden.nl` (of je Pages URL) |

### 2c. Policy (wie mag erin?)

- **Policy name:** `Morani community`
- **Action:** Allow
- **Include** → **Emails** → voeg elke trader's email toe
  - Of **Emails ending in** → `@moranitraden.nl` (als iedereen dat domein heeft)
  - Of **GitHub organization** → `ZaratrasJournal` (als ze allemaal GitHub hebben)

Save. Vanaf nu: wie de URL opent krijgt een login-scherm, typt zijn email, krijgt magic-link, is 1 maand binnen.

---

## 🌳 Stap 3: Work branch aanmaken (als nog niet gedaan)

```bash
git checkout main
git pull
git checkout -b work
git push -u origin work
```

Cloudflare Pages detecteert de nieuwe branch automatisch en maakt een **preview-deployment**. URL wordt ongeveer:
```
https://work.syncjournal.pages.dev
```

Optioneel: gate deze ook met Cloudflare Access (zelfde policy).

---

## 🔄 Dagelijkse workflow

### Werken op `work`

```bash
git checkout work
# bouwen, testen, pushen
git add tradejournal.html
git commit -m "WIP: new feature X"
git push
```

Cloudflare bouwt binnen 1 min → check resultaat op `work.syncjournal.pages.dev`.

### Tevreden? Merge naar `main` (= update voor community)

```bash
git checkout main
git pull                      # veiligheidscheck
git merge work                # fast-forward of merge-commit
git push                      # community krijgt nieuwe versie binnen 1 min
git checkout work             # terug naar dev
```

Of met een PR-flow als je Sebas wil laten reviewen:
```bash
gh pr create --base main --head work --title "Release: feature X"
# Sebas reviewt, approved, merget via GitHub UI
```

### Rollback als er iets brak

```bash
git checkout main
git revert HEAD               # maakt nieuwe commit die laatste undoet
git push
# of harder:
git reset --hard <oude-sha>
git push --force              # ⚠ voorzichtig, alleen in noodgevallen
```

---

## 💾 localStorage: let op deze valkuil

Elke deploy-URL heeft een **eigen localStorage**:
- `journal.moranitraden.nl` → community-data
- `work.syncjournal.pages.dev` → Denny's work-data

Dat is **goed** — je breekt nooit per ongeluk community-data tijdens testen. Maar:

- **Test data wil je soms kopiëren** tussen work → prod (of andersom). Gebruik Export JSON → import op andere URL.
- **Schema-migraties** test je eerst op `work` met een kopie van je prod-backup.
- **Als je een breaking change maakt** in localStorage-schema → altijd migratie toevoegen in `runSchemaMigrations()` vóór je naar main merged.

---

## 📋 Community-bericht (template voor Discord)

```
🎯 SyncJournal is live!

👉 https://journal.moranitraden.nl

Eerste keer:
1. Klik de link
2. Typ je email (die je aan Denny hebt doorgegeven)
3. Open de magic-link die Cloudflare stuurt
4. Journal start — bookmark 'm!

Je data staat in je eigen browser (localStorage). Voor backup:
Instellingen → Export JSON → bewaar die file. Wissel je van apparaat of browser? Importeer 'm weer.

Updates komen automatisch — gewoon de pagina verversen.
```

---

## 🚨 Veiligheid

- **Geen API-keys in de code.** Elke trader vult ze zelf in de browser (localStorage). CLAUDE.md-regel.
- **Private repo blijft privé.** Cloudflare Pages pullt via OAuth, niemand anders ziet je code.
- **Cloudflare Access sessie = 1 maand.** Bij verlaten-community een trader: verwijder 'm uit de policy, logt dan uit binnen 1 maand (of force-revoke via Access UI).
- **Commit nooit `.env`, CSV's, `*_personal.*`.** Staat al in `.gitignore`.

---

## 🐛 Troubleshooting

| Probleem | Oplossing |
|---|---|
| Deploy faalt na push | Cloudflare Dashboard → Pages → Deployments → click failed deploy → check build log. Meestal: illegale filename of te grote file. |
| "Access denied" voor legitieme user | Check Access → Applications → Policies. Email goed gespeld? Case-sensitive soms. |
| Trader ziet oude versie na update | Hard refresh (`Ctrl+Shift+R`). Cloudflare cached statisch ~5 min. |
| Preview URL werkt niet meer | Check Cloudflare Pages → Deployments → staat `work` branch nog actief? |
| localStorage weg na URL-wijziging | Normaal — andere origin. Import JSON-backup van oude URL. |

---

*Laatst bijgewerkt: 2026-04-16*
