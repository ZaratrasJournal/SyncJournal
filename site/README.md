# site/ — deploybron voor syncjournal.nl (Cloudflare Pages)

Deze map is wat er live staat. Inhoud:

- `index.html` — de app (kopie van `work/syncjournal.html` op releasemoment)
- `version.json` — bron voor de in-app update-check (`{version, released}`); **moet gelijk zijn aan `APP_VERSION` in index.html**
- `privacy.html` — privacyverklaring (vereist voor de Google Drive-verificatie in fase 3)
- `_headers` — cache-regels (version.json nooit cachen)

## Release-ritueel (hosted)

1. `cp work/syncjournal.html site/index.html`
2. Zet `version` + `released` in `site/version.json` gelijk aan de nieuwe `APP_VERSION`
3. Commit: `Release site: vX.Y.Z — korte titel`
4. **Alleen op expliciet "push"/"release"-commando van Denny** naar GitHub pushen — Cloudflare Pages deployt daarna automatisch (leden zien binnen ±4 uur de update-banner, of direct via 🔄 Check).

`tests/hosted.spec.js` bewaakt dat index.html en version.json dezelfde versie dragen.

## Eenmalige Cloudflare Pages-setup (Denny)

1. Cloudflare-dashboard → **Workers & Pages → Create → Pages → Connect to Git** → kies deze repo.
2. Build settings: framework **None**, build command **leeg**, output directory **`site`**.
3. Na de eerste deploy: **Custom domains** → `syncjournal.nl` toevoegen (en `www.syncjournal.nl` → redirect naar apex via een Bulk Redirect of Page Rule).
4. Klaar — elke push naar main deployt automatisch.

Tradingplan later: tweede Pages-project met output directory `tradingplan`, custom domain `tradingplan.syncjournal.nl`.
