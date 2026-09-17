# Plan: Drive langer ingelogd (fase 4 — token-broker)

**Status:** Worker-code ligt klaar ([drive-token-worker.js](drive-token-worker.js)); wacht op Denny's deploy + go voor de app-kant.

## Waarom

Google geeft een browser-app zonder server maximaal **1 uur** toegang per keer. Daarom moet je nu na elke stille periode opnieuw "Verbinden" klikken. De enige nette oplossing is een *refresh token*, en die geeft Google alleen af aan iets dat een client secret veilig kan bewaren — dus niet aan de browser.

## Oplossing: mini-Worker als token-broker (privacy-vriendelijk)

- De gebruiker autoriseert éénmalig via een Google-popup (code-flow).
- De app stuurt de code naar onze Cloudflare Worker; die kent het client secret en wisselt hem bij Google in voor een **refresh token + uur-token**.
- Het refresh token wordt **alleen in de browser van de gebruiker** bewaard (IndexedDB, naast de rest van de journal-data). De Worker slaat niets op en logt niets — hij is een doorgeefluik van ±60 regels.
- Vanaf dan verlengt de app tokens stil op de achtergrond: nooit meer "opnieuw verbinden", totdat de gebruiker de koppeling intrekt (in de app of via myaccount.google.com).

Dit is hetzelfde patroon dat apps als Actual Budget gebruiken: lokaal-eerst, met een minimale stateless broker.

## Wat er moet gebeuren

1. **Denny (±5 min):** Worker aanmaken en dit bestand plakken, de twee variabelen zetten (client-ID + het client secret uit Google Cloud Console), custom domain `drive-token.syncjournal.nl`. Stappen staan bovenin het Worker-bestand. In Google Console hoeft niets te wijzigen.
2. **App-kant (ik, na de deploy):** de Drive-koppeling ombouwen van het uur-token-flow naar de popup-code-flow + stille verlenging, met nette terugval naar de huidige flow als de Worker onbereikbaar is. Inclusief specs (mock-Worker) en changelog. Inschatting: 2-3 uur.

## Veiligheid, eerlijk benoemd

- Het client secret staat alleen als Worker-secret bij Cloudflare, nooit in de app of op GitHub.
- De Worker accepteert alleen verzoeken vanaf syncjournal.nl en work.syncjournal.nl.
- Een refresh token in browser-opslag kan door malware op de computer van de gebruiker gestolen worden — maar die malware kan dan ook gewoon de journal-data zelf lezen. De scope blijft `drive.file`: alleen bestanden die SyncJournal zelf aanmaakt.
- Intrekken kan altijd: koppeling verwijderen in de app, of via Google-accountbeheer.

## Beslissing (Denny)

Deploy de Worker wanneer je wilt (stappen bovenin het bestand) en zeg het — dan bouw ik de app-kant als aparte release.
