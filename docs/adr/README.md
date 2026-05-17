# Architecture Decision Records

Beslissingen over architectuur, met context waarom ze zijn genomen en welke consequenties ze hebben. Skills (`grill-with-docs`, `improve-codebase-architecture`) lezen dit om consistent te blijven met eerdere keuzes.

## Format

Elke ADR is een markdown-file met:
- **Title** — wat is besloten (1 zin)
- **Status** — Accepted | Superseded | Deprecated
- **Context** — waar komt deze beslissing vandaan, welk probleem lost het op
- **Decision** — wat is gekozen (specifiek + meetbaar)
- **Consequences** — wat betekent dit voor toekomstige code/keuzes

## Naamgeving

`NNNN-korte-naam.md` waar `NNNN` 4 cijfers (volgordelijk), korte-naam = kebab-case-titel.

## Lijst

- [0001](0001-single-file-html.md) — Single-file HTML zonder bundler
- [0002](0002-exchange-per-adapter-isolation.md) — Exchange-architectuur: per-adapter isolation
