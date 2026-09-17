# Plan: echte basis voor P&L-percentages (vervangt ACCT=24663)

**Status:** wacht op keuze van Denny (zie "Beslissing" onderaan). Nog niets gebouwd.

## Huidige situatie

- `const ACCT=24663` staat hardcoded in `work/syncjournal.html` (regel ~1479) — een restant uit de demo-tijd.
- `pnlPct` wordt bij het opslaan van een trade berekend als `pnl / ACCT * 100` en als veld op de trade bewaard. Ook `migrateOldTrade` en de trades-tabel-footer gebruiken ACCT.
- Gevolg: iedere gebruiker ziet percentages t.o.v. een fictief account van $24.663, hoe groot hun echte account ook is.

## Opties

**A. Percentage t.o.v. de huidige totale balans**
Simpel (basis = `totalBalance()`), maar historisch onjuist: een trade van vorig jaar krijgt een % op basis van je saldo van vandaag, en alle percentages verschuiven bij elke sync.

**B. Percentage t.o.v. de balans op het moment van de trade (aanbevolen)**
Reconstrueerbaar zonder extra opslag: `basis(trade) = totalBalance() − som(pnl van deze trade en alle latere gesloten trades)`. Zo krijgt elke trade het percentage van zijn eigen moment, en blijft alles kloppen na syncs. Voorwaarden:
- `pnlPct` wordt een berekende weergave (`pnlPctOf(t)`), geen opgeslagen veld meer — opgeslagen waarden verouderen per definitie.
- Geen betrouwbare basis (balans 0/onbekend, of basis ≤ 0 door opnames buiten beeld) → géén % tonen in plaats van onzin.
- Kapitaal-mutaties van handmatige accounts (deposits/withdrawals) zitten in `manualBalance` en rekenen dus mee; exchange-deposits kennen we niet — beperking benoemen in de FAQ.

**C. Vast, door de gebruiker instelbaar referentiebedrag**
"Percentage t.o.v. mijn startkapitaal €X" als instelling. Voorspelbaar en simpel, maar iedereen moet iets invullen en het veroudert.

## Aanbeveling

**B**, met C als handmatige override in Instellingen voor wie een vaste referentie wil (bijv. prop-firm-traders met een vaste accountgrootte). A vervalt.

## Impact-audit (te doen bij bouw)

Alle lezers van `t.pnlPct` en `ACCT` langslopen: trade-opslag, migratie, `pnlCell`, tabel-footer, coach-share, exports/backups (veld laten staan voor backward-compat maar niet meer tonen). Spec met reconstructie-scenario (deposit → trades → sync → percentages per trade stabiel).

## Inschatting

Ongeveer een halve dag inclusief tests. Aparte release, niet bundelen met andere wijzigingen.

## Beslissing (Denny)

1. Akkoord met **B + optionele vaste referentie (C)**?
2. Moet het %-veld bij ontbrekende basis verdwijnen of "—" tonen?
