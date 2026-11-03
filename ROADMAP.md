# Technical Design & Roadmap: Padel League PWA 🎾

## 1. Systemarkitektur & Homelab-Deploy
Den overordnede arkitekturen benytter en "moderne monolitt"-tilnærming. I stedet for en Next.js frontend og en separat Express-backend, bruker vi Next.js sine innebygde **Route Handlers** (App Router `app/api/...`) som backend.

**Hvorfor Next.js over Express for dette prosjektet?**
- **Enklere Homelab-deployment**: Én enkelt Docker-container å administrere.
- **Delt State / Type Safety**: Perfekt TypeScript-integrasjoner tvers over frontend/backend (bruker Prisma DTOs direkte i Next).
- **SQLite Persistens**: Databasen overlever container-omstarter ved at vi mounter en persistent volum-mappe `/app/data` inn i containeren via `docker-compose`. 

Systemet ligger eksponert via **Traefik Reverse Proxy**, med inngående trafikk sikret via Cloudflare Tunnel. Appen kjører i PWA "Standalone" modus på mobil for clean Vibe.

## 2. API Design (REST)

| Metode | Endepunkt | Beskrivelse | Data payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/leagues` | Hent liste over aktive turneringer. | - |
| `POST` | `/api/leagues` | Opprett en ny liga. | `{ name: string }` |
| `GET` | `/api/leagues/[id]/leaderboard` | Hent sortert poengoversikt. | - |
| `POST` | `/api/matches` | Registrer en ferdigspilt kamp. | `{ leagueId, teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, teamAScore, teamBScore }` |
| `GET` | `/api/users` | Hent liste over aktuelle spillere for autocomplete. | - |
| `POST` | `/api/users` | Skriv inn ny venn i systemet. | `{ name: string, avatarUrl?: string }` |

## 3. PWA Oppsett (Mobile First)
Appen har en `manifest.json` og `theme_color` satt i head-tag gen for native-vibe på iOS og Android. Vi bygger opp grensesnittet med tailwind utility-klasser og radix-ui (komponenter) for store interaktive treffpunkt:
- **Navigation**: Bunnbasert nav-bar (iOS-stil) for "Leaderboard", "Ny Kamp", og "Profil".
- **Ny Kamp Form**: Enorm hit-box på spiller-valg, nummepad for score-registrering for færre klikk mens man står på grusen i hallen.

## Neste Steg
1. Sikre Prisma Model og kjøre `npx prisma db push` / `npx prisma generate`.
2. Bygge appens layout med Tailwind CSS, mobil-bunnmeny og Dark Mode Vibe.
3. Importere og sette opp "shadcn/ui" knapper, forms, tabeller og visuelle komponenter.
4. Implementere API-rutene i `/app/api`.
5. Knytte API med UI.
