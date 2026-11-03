# PadelFlex — Teknisk Dokumentasjon & QA-Guide 🎾

En mobil-først Progressive Web App (PWA) bygget med **Next.js 15 App Router**, **React 19**, **TypeScript**, **Tailwind CSS v4** og **Prisma med SQLite** for komplett administrasjon av Padel-turneringer, ligaer, Americano/Mexicano-spillformer og karrierestatistikk.

---

## Innholdsfortegnelse
1. [Oversikt & Arkitektur](#1-oversikt--arkitektur)
2. [Sikkerhet, Roller & Profilisolering (Multi-Tenancy)](#2-sikkerhet-roller--profilisolering-multi-tenancy)
3. [Dybdegående Algoritmedokumentasjon](#3-dybdegående-algoritmedokumentasjon)
   - [3.1 Americano Matchmaking & Rotasjonsalgoritme](#31-americano-matchmaking--rotasjonsalgoritme)
   - [3.2 Mexicano Matchmaking-algoritme](#32-mexicano-matchmaking-algoritme)
   - [3.3 Score-vektet 2v2 Elo-ratingsystem](#33-score-vektet-2v2-elo-ratingsystem)
   - [3.4 Flerbane-tildeling & Køhåndtering (1–3 Baner)](#34-flerbane-tildeling--køhåndtering-13-baner)
   - [3.5 Syklus- og Fremdriftsberegning (Tournament Progress)](#35-syklus--og-fremdriftsberegning-tournament-progress)
   - [3.6 Spillerpause & Rettferdig Rotasjon (`pausedCount`)](#36-spillerpause--rettferdig-rotasjon-pausedcount)
   - [3.7 Poenghalvering ved Tidspress](#37-poenghalvering-ved-tidspress)
   - [3.8 Ligasammenlagt & Normalisert Prosentberegning](#38-ligasammenlagt--normalisert-prosentberegning)
4. [Offline-støtte & Lokal Oppgavekø (PWA Resilience)](#4-offline-støtte--lokal-oppgavekø-pwa-resilience)
5. [Bildegenerering & Sosial Deling (Resultatkort)](#5-bildegenerering--sosial-deling-resultatkort)
6. [Datamodell, Optimistisk Låsing & SQLite Tuning](#6-datamodell-optimistisk-låsing--sqlite-tuning)
7. [Server Actions & API Referanse](#7-server-actions--api-referanse)
8. [Kvalitetssikringsguide (QA & Testscenarier)](#8-kvalitetssikringsguide-qa--testscenarier)
9. [Installasjon, Drift & Docker Deployment](#9-installasjon-drift--docker-deployment)

---

## 1. Oversikt & Arkitektur

### 1.1 Teknologistakk
- **Rammeverk**: Next.js 15.5+ (App Router, Server Actions, API Routes)
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React ikoner, Motion (animasjoner)
- **Database & ORM**: SQLite (`/prisma/padel.db`) med Prisma ORM v6
- **Autentisering**: HMAC-SHA256 signerte tilgangstokens og fleksible tilgangskoder (tenants)
- **Lagring**: Transaksjonell JSON-backup og direkte SQLite `.db`-eksport/import

### 1.2 Arkitekturdiagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Klient (PWA)                         │
│  - TournamentView (Aktiv kamp, live tabell, trekning, kø)    │
│  - LeaguesView (Ligaoppsett, sammenlagttabell, runder)      │
│  - HistoryView (Tidligere turneringer, varighet, gjenåpning)│
│  - PlayersView (Spillere, karriere, head-to-head stats)     │
│  - HelpFaqView (Veiledning, FAQ, admin database-backup)     │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
       Server Actions & API             Props & Server State
               │                               │
┌──────────────▼───────────────────────────────┴──────────────┐
│                    Next.js App Server                       │
│  - lib/auth.ts (HMAC-SHA256 token verifisering & profil)   │
│  - app/actions.ts (Matchmaking-motor, tabeller, rotasjon)   │
│  - lib/match-utils.ts (Fremdrift, syklus- og tidsestimat)   │
│  - app/api/backup/route.ts (Eksport/import av database)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma ORM
┌──────────────────────────────▼──────────────────────────────┐
│                 SQLite Database (/prisma/padel.db)          │
│   User | League | LeagueMember | Tournament | Participant   │
│   | Match                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Sikkerhet, Roller & Profilisolering (Multi-Tenancy)

PadelFlex støtter full dataisolering slik at flere vennegjenger eller bedrifter kan bruke samme applikasjon uten å se hverandres spillere eller turneringer.

### 2.1 Tilgangskoder (Tenant Isolation)
- **Brukerprofiler**: Ved innlogging oppgir brukeren et valgfritt kodeord (f.eks. `gjengen`, `oslo-padel`, `bedrift-it`).
- **Datafiltrering**: Alle spillere, ligaer og turneringer lagres med feltet `accessCode`. Server Actions filtrerer spørringer automatisk med `where: { accessCode: session.accessCode }`.
- **Profilbytte**: Brukere kan lagre flere profiler lokalt i nettleseren og bytte mellom dem med ett klikk.

### 2.2 Administratorrolle
- **Admin-passord**: Defineres i miljøvariabelen `ADMIN_PASSWORD` (standard: `admin123`).
- **Rettigheter**:
  - Full tilgang på tvers av alle tilgangskoder (ser og administrerer alle turneringer).
  - Eksklusiv tilgang til å laste ned sikkerhetskopi (JSON og SQLite `.db`).
  - Eksklusiv tilgang til å overskrive og gjenopprette databasen fra en JSON-backupfil.

### 2.3 Tokengenerering (HMAC-SHA256)
Tokenet lages og verifiseres i `lib/auth.ts`:
$$\text{Signature} = \text{HMAC-SHA256}(\text{ADMIN\_PASSWORD}, \text{role} + ":" + \text{accessCode} + ":padelflex_tenant_v4")$$
Token-format: `role:accessCode:signature`

---

## 3. Dybdegående Algoritmedokumentasjon

Algoritmene for matchmaking og rotasjon i PadelFlex er designet for å gi maksimal rettferdighet, jevn spilletid og varierte makkere/motstandere.

---

### 3.1 Americano Matchmaking & Rotasjonsalgoritme

I Americano skal alle spillere spille med og mot hverandre så jevnt som mulig.

#### Målsetninger:
1. **Lik spilletid**: Spillere med færrest spilte kamper må prioriteres først.
2. **Nye makkerskap**: Spillere skal unngå å være på lag med samme makker flere ganger.
3. **Varierte motstandere**: Spillere skal møte alle motstandere jevnt fordelt.

#### Steg 1: Bygging av historikk-matriser
Før trekning analyseres alle tidligere kamper i turneringen:
- `matchCount[playerId]`: Antall kamper spilleren har deltatt i (inkludert `pausedCount`).
- `partnerMatrix[p1][p2]`: Antall ganger `p1` og `p2` har vært makkere (på samme lag).
- `opponentMatrix[p1][p2]`: Antall ganger `p1` og `p2` har spilt mot hverandre.

#### Steg 2: Valg av kandidater til runden
Aktive (ikke-pausede) spillere sorteres etter:
1. `matchCount` (stigende – færrest kamper først).
2. `totalPoints` (synkende – tie-breaker).

For $C$ baner velges de første $4 \times C$ spillerne fra denne sorterte listen inn i spillerutvalget (`availableIds`).

#### Steg 3: Kombinasjonssøk & Kostnadsfunksjon (Cost Function)
For 4 spillere $\{p_0, p_1, p_2, p_3\}$ evalueres de 3 mulige lagkonfigurasjonene:
1. **Konfigurasjon 1**: $(p_0, p_1)$ mot $(p_2, p_3)$
2. **Konfigurasjon 2**: $(p_0, p_2)$ mot $(p_1, p_3)$
3. **Konfigurasjon 3**: $(p_0, p_3)$ mot $(p_1, p_2)$

Hver konfigurasjon evalueres med følgende matematiske kostnadsfunksjon:

$$\text{Cost} = (\text{MatchSum} \times 1\,000\,000) + (\text{PartnerPenalty} \times 10\,000) + (\text{OpponentPenalty} \times 100) + \text{Noise}$$

Hvor:
- $\text{MatchSum} = \sum_{i=0}^{3} \text{matchCount}[p_i]$
- $\text{PartnerPenalty} = \text{partnerMatrix}[a_1][a_2] + \text{partnerMatrix}[b_1][b_2]$
- $\text{OpponentPenalty} = \sum_{x \in \{a_1, a_2\}} \sum_{y \in \{b_1, b_2\}} \text{opponentMatrix}[x][y]$
- $\text{Noise} = \text{random}(0, 5)$ *(bryter deterministisk symmetri ved uavgjort kostnad)*

#### Hvorfor disse vekttallene?
- **1 000 000 (Spilletid)**: Garanterer at ingen spiller rykker foran i spilletid uansett paring.
- **10 000 (Makkerstraff)**: Å spille med en ny makker veier 100 ganger tyngre enn å møte en ny motstander.
- **100 (Motstanderstraff)**: Sprer motstandere jevnt når makkerstraffen er lik.
- **0–5 (Tilfeldig støy)**: Sikrer at rekkefølgen varierer naturlig ved helt like forutsetninger.

---

### 3.2 Mexicano Matchmaking-algoritme

I Mexicano matches spillere basert på tabellplassering for å skape så jevne kamper som mulig.

#### Logikk:
- **Runde 1**: Kjøres som en standard Americano-trekning (siden alle har 0 poeng).
- **Runde 2 og utover**:
  1. De $4 \times C$ spillerne med færrest kamper velges ut.
  2. Spillerne rangeres etter `totalPoints` (synkende): $[P_1, P_2, P_3, P_4]$.
  3. Lagene settes sammen etter formelen **1. og 3. plass mot 2. og 4. plass**:
     $$\text{Lag A} = (P_1, P_3) \quad \text{mot} \quad \text{Lag B} = (P_2, P_4)$$
  4. Dette gir en teoretisk balansert kamp der det beste og fjerde beste leddet møter det nest beste og tredje beste leddet.

---

### 3.3 Score-vektet 2v2 Elo-ratingsystem

For ligaer har PadelFlex et dynamisk, score-vektet Elo-ratingsystem spesifikt tilpasset 2v2 padel.

#### Startverdi & Ligaisolering
- Hver spiller starter med en basisrating på **1500 Elo** per liga (`LeagueMember.eloRating`).
- Ligatabellen sorteres primært etter denne Elo-ratingen, med seiersprosent og gjennomsnittlig score % som sekundære tie-breakers.

#### 1. Beregning av Lag-rating & Forventet Utfall
Gjennomsnittsratingen for hvert lag beregnes før kampstart:
$$R_A = \frac{R_{A1} + R_{A2}}{2}, \quad R_B = \frac{R_{B1} + R_{B2}}{2}$$

Forventet utfall for henholdsvis Lag A ($E_A$) og Lag B ($E_B$):
$$E_A = \frac{1}{1 + 10^{(R_B - R_A) / 400}}, \quad E_B = 1 - E_A$$

#### 2. Faktisk Utfall ($S_A$)
$$S_A = \begin{cases} 1.0 & \text{hvis Lag A vinner} \\ 0.5 & \text{ved uavgjort} \\ 0.0 & \text{hvis Lag B vinner} \end{cases}$$

#### 3. Seiersmargin-skalering ($M$)
For å belønne overlegne seire (f.eks. 21–3 fremfor 21–19) vektes endringen med en kvadratrot-skalert marginfaktor:
$$\text{ScoreDiff} = |\text{Score}_A - \text{Score}_B|$$
$$\text{MarginFactor} = \max\left(1.0, \, \sqrt{\text{ScoreDiff} + 1} \times \frac{\text{ScoreDiff} + 3}{\text{targetScore} \times 0.2 + 3}\right)$$

#### 4. Ratingendring ($\Delta R$)
Med $K = 32$ som basisvekt:
$$\Delta R_A = \text{round}\left(K \times \text{MarginFactor} \times (S_A - E_A)\right)$$
$$\Delta R_B = -\Delta R_A$$

Hver spiller på Lag A får $R_{A1} \leftarrow R_{A1} + \Delta R_A$, og hver spiller på Lag B får $R_{B1} \leftarrow R_{B1} + \Delta R_B$.

#### 5. "Single Source of Truth" & Historisk Replay
For å garantere at tabeller aldri blir korrupte ved korrigering av eldre kamper, sletting eller gjenåpning, benytter motoren en deterministisk **Replay Engine** (`lib/elo.ts`):
1. Alle spillere initialiseres til 1500 Elo.
2. Alle fullførte kamper i ligaen spilles av i kronologisk rekkefølge.
3. Ratinger og individuelle deltaker-statistikker oppdateres atomisk i databasen.

---

### 3.4 Flerbane-tildeling & Køhåndtering (1–3 Baner)

Når turneringen er konfigurert for flere baner:
1. `maxPossibleCourts = Math.floor(activePlayers.length / 4)`
2. `courtsToDraw = Math.min(desiredCourts, maxPossibleCourts)`
3. For hver bane (Bane 1, Bane 2, Bane 3) finner algoritmen det optimale 4-kløveret og fjerner dem fra `availableIds` før neste bane trekkes.
4. **Køsperre (Match Integrity)**: En ny kamp på samme bane kan ikke registreres hvis det allerede finnes en tidligere pågående/ufullført kamp på den banen.

---

### 3.5 Syklus- og Fremdriftsberegning (Tournament Progress)

I `lib/match-utils.ts` beregnes turneringens fremdrift i sanntid.

#### Jevning av spilletid (`isEqualized`):
- Finn $\text{maxPlayed} = \max_p(\text{matchesPlayed}[p])$ og $\text{minPlayed} = \min_p(\text{matchesPlayed}[p])$.
- Beregn gjenstående plasser:
  $$\text{SlotsNeeded} = \sum_{p} \max(0, \text{maxPlayed} - \text{matchesPlayed}[p])$$
- Gjenstående kamper for jevn spilletid:
  $$\text{MatchesToEqualize} = \left\lceil \frac{\text{SlotsNeeded}}{4} \right\rceil$$
- Når $\text{minPlayed} = \text{maxPlayed}$ og $\text{completedMatches} > 0$, er turneringen i **likevekt** (`isEqualized = true`).

#### Full Americano-syklus ($N$ delelig på 4):
Når totalt antall deltakere $N$ er et multiplum av 4 ($N = 4, 8, 12, 16\dots$):
- Antall kamper i én komplett syklus (der alle har spilt nøyaktig $N - 1$ kamper og vært makker med alle):
  $$T_{\text{syklus}} = \frac{N \times (N - 1)}{4}$$
- Eksempel ved $N = 8$: $T = \frac{8 \times 7}{4} = 14$ kamper (hver spiller spiller 7 kamper).
- Eksempel ved $N = 12$: $T = \frac{12 \times 11}{4} = 33$ kamper (hver spiller spiller 11 kamper).

#### Tidsestimater og varighet:
- Varighet per kamp: $\text{diffMs} = \text{completedAt} - \text{startedAt}$.
- Reell gjennomsnittlig kampvarighet:
  $$\text{AvgDuration} = \frac{\sum \text{MatchDuration}}{\text{TimedMatchesCount}}$$
  *(Standardverdi på 12 min dersom ingen kamper er tidsmålt).*

---

### 3.6 Spillerpause & Rettferdig Rotasjon (`pausedCount`)

Dersom en spiller må hvile, er skadet eller ankommer sent:
1. **Pause-knapp**: Spilleren markeres med `isPaused: true`.
2. **Utelatelse**: Spilleren trekkes ikke i nye runder.
3. **Nye spillere som legges til midt i turneringen**:
   $$\text{pausedCount} = \left\lfloor \frac{\text{completedMatchesCount} \times 4}{N_{\text{eksisterende}}} \right\rfloor$$
   Dette gir den nye spilleren en virtuell spilletid tilsvarende det de andre har spilt, slik at algoritmen ikke tvinger den nye spilleren til å spille 10 kamper på rad alene.

---

### 3.7 Poenghalvering ved Tidspress

Når halltiden nærmer seg slutten:
- Funksjonen `toggleHalvePoints` setter:
  $$\text{originalTargetScore} = \text{targetScore}, \quad \text{targetScore} = \max\left(1, \text{round}\left(\frac{\text{targetScore}}{2}\right)\right)$$
- Resterende kamper spilles f.eks. til 12 eller 11 poeng i stedet for 24 eller 21 poeng.
- Trykkes knappen igjen, gjenopprettes den opprinnelige målscoren.

---

### 3.8 Ligasammenlagt & Normalisert Prosentberegning

I en liga spilles det flere runder over uker eller måneder. Noen runder kan ha 21 poeng, andre 24 poeng eller 12 poeng (ved halvering). Å summere råpoeng ville vært urettferdig for spillere som deltok i runder med høyere målscore.

#### Normalisert score per kamp ($P_i$):
$$P_i = \left( \frac{\text{Oppnådde Poeng}}{\text{Målscore i Runden}} \right) \times 100$$

#### Ligasnitt Prosentpoeng (`avgPointPct`):
$$\text{avgPointPct} = \frac{1}{M} \sum_{i=1}^{M} P_i$$

#### Seiersprosent (`winRatePct`):
$$\text{winRatePct} = \left( \frac{\text{Vunnet} + 0.5 \times \text{Uavgjort}}{\text{Spilte Kamper}} \right) \times 100$$

---

## 4. Offline-støtte & Lokal Oppgavekø (PWA Resilience)

I padelhaller med ustabil eller manglende mobildekning sikrer `hooks/useOfflineSync.ts` uavbrutt turnering:

1. **Lokal Oppgavekø (`localStorage`)**:
   - Hvis enhetsnettverket faller ut (`!navigator.onLine`), legges handlingen (`REGISTER_SCORE`) i en lokal kø under nøkkelen `padelflex_offline_queue_v1`.
   - Kampens `version` inkluderes for å sikre at ingen overskriver nyere data.
2. **Automatisk Bakgrunnssynkronisering**:
   - En lytter på `window.addEventListener('online')` prosesserer alle ventende oppgaver i rekkefølge så snart tilkoblingen gjenopprettes.
3. **Visuell Indikator & Manuell Synkronisering**:
   - `TournamentView` viser en gul varselstripe med antall ventende oppgaver og en manuell "Synkroniser nå"-knapp.

---

## 5. Bildegenerering & Sosial Deling (Resultatkort)

For enkel deling av resultater på WhatsApp, Messenger eller Instagram Stories:
- **Klient-side Rendring**: `components/ResultCardModal.tsx` benytter `html-to-image` for å rendre DOM-elementer direkte til høyoppløselige PNG-bilder (`pixelRatio: 2.5`).
- **Web Share API**: På støttede mobile nettlesere (iOS Safari, Android Chrome) åpnes den native delingsmenyen med filvedlegg (`navigator.share({ files: [file] })`).
- **Automatisk Fallback**: Dersom delings-API-et ikke støtter fildeling, lastes PNG-filen automatisk ned til enheten.
- **Kort-typer**:
  - **Kampkort**: Viser lagene, sluttscore, differanse, banenummer og Elo-delta.
  - **Slutt-tabell / Ligatabell**: Viser pallplassering, poeng, seire/tap og Elo-rating i en stilig mørk padel-layout.

---

## 6. Datamodell, Optimistisk Låsing & SQLite Tuning

### 6.1 Optimistisk Låsing & Status
- Feltet `status: MatchStatus` erstatter `isCompleted: Boolean` med eksplisitte tilstander: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- Feltet `version: Int @default(1)` og `updatedAt: DateTime @updatedAt` hindrer "lost updates" hvis to personer registrerer score samtidig.

### 6.2 SQLite WAL-Mode & Concurrency Tuning
I `lib/prisma.ts` konfigureres SQLite automatisk med høyeffektiv skrivehåndtering:
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

### 6.3 Prisma Skjema (Utdrag)
```prisma
enum MatchStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model Match {
  id             String      @id @default(cuid())
  tournamentId   String
  courtNumber    Int?        @default(1)
  status         MatchStatus @default(PENDING)
  version        Int         @default(1)
  updatedAt      DateTime    @updatedAt
  date           DateTime    @default(now())
  startedAt      DateTime    @default(now())
  completedAt    DateTime?

  teamAPlayer1Id String
  teamAPlayer2Id String
  teamBPlayer1Id String
  teamBPlayer2Id String

  teamAScore     Int         @default(0)
  teamBScore     Int         @default(0)
  winnerTeam     String?     // 'A', 'B' eller 'DRAW'
  teamAEloDelta  Int?
  teamBEloDelta  Int?

  tournament     Tournament  @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
}
```

---

## 7. Server Actions & API Referanse

### 7.1 Server Actions (`app/actions.ts`)

| Action | Parametere | Beskrivelse |
|---|---|---|
| `createTournament` | `{ name, leagueId, type, targetScore, courtCount, playerIds }` | Oppretter en ny turnering og setter den som aktiv. |
| `drawNextMatches` | `tournamentId, overrideCourts?` | Trekker kamper for valgte baner med Americano/Mexicano algoritme. |
| `registerMatchScore` | `matchId, scoreA, scoreB, version?, completedAt?` | Lagrer kampresultat, sjekker optimistisk låsing, oppdaterer Elo og rekalkulerer tabellen. |
| `updateMatchScore` | `matchId, scoreA, scoreB, version?, startedAt?, completedAt?` | Korrigerer resultat, tider og rekalkulerer hele Elo-historikken. |
| `togglePlayerPause` | `tournamentId, userId` | Setter en spiller på pause eller gjenopptar aktiv status. |
| `toggleHalvePoints` | `tournamentId` | Halverer eller gjenoppretter målscore ved tidspress. |
| `reopenTournament` | `tournamentId` | Gjenåpner en fullført turnering (samme dag) og rekalkulerer Elo. |
| `recalculateTournamentStats` | `tournamentId` | Beregner poeng, seire, uavgjort og tap for alle deltakere på nytt. |
| `getLeagueStats` | `leagueId` | Henter normalisert sammenlagttabell med Elo-rating, prosentpoeng og vinnerrate. |
| `getPlayerCareerStats` | `playerId` | Henter karrierestatistikk, makkere, motstandere og seiersprosent. |

### 7.2 Sikkerhetskopi API (`/app/api/backup/route.ts`)

- **GET `/api/backup?format=json&password=...`**: Laster ned en fullstendig JSON-sikkerhetskopi av alle tabeller.
- **GET `/api/backup?format=db&password=...`**: Laster ned den råe SQLite-filen (`padel.db`).
- **POST `/api/backup`**: Tar imot `{ password, backupData }` og gjenoppretter hele databasen i én atomisk Prisma-transaksjon.

---

## 8. Kvalitetssikringsguide (QA & Testscenarier)

Bruk denne listen for å teste og verifisere appens funksjonalitet.

### Test 1: Opprette Enkeltturnering (8 spillere, 2 baner, 21 poeng)
1. Gå til **Ny turnering** og velg **Enkeltturnering**.
2. Velg 8 spillere, sett baner = 2 og målscore = 21.
3. **Forventet**: Turneringen starter med status 0 spilte kamper. Ingen spillere er forhåndsvalgt fra før.

### Test 2: Trekning & Paringssjekk (Runde 1 & 2)
1. Trykk **Trekk runde**.
2. **Forventet**: Det opprettes to kamper (Bane 1 og Bane 2) med 8 unike spillere.
3. Registrer resultat på begge baner (f.eks. 14–7 og 11–10).
4. Trykk **Trekk runde** igjen.
5. **Forventet**: Ingen spillere får samme makker som i runde 1 (makkerstraff fungerer).

### Test 3: Køhåndtering & Resultatregistrering
1. Trekk to runder på rad slik at det ligger to kamper i kø på Bane 1.
2. Forsøk å registrere score på kamp #2 før kamp #1 er fullført.
3. **Forventet**: Systemet avviser registreringen og ber om at forrige kamp på banen fullføres først.

### Test 4: Score-vektet Elo-rating i Ligaspill
1. Start en turnering knyttet til en Liga.
2. Registrer en overlegen seier (f.eks. 21–3).
3. **Forventet**: Vinnerparet får en større Elo-gevinst (f.eks. +25) enn ved en jevn seier 21–19 (f.eks. +16).
4. Gå til **Ligaer** og verifiser at ligatabellen sorteres primært etter oppdatert Elo-rating.

### Test 5: Offline-modus & Synkronisering
1. Skru av nettverksforbindelsen på enheten (eller sett "Offline" i DevTools).
2. Registrer resultat på en aktiv kamp.
3. **Forventet**: Appen lagrer resultatet i lokal kø og viser en gul offline-stripe: *"1 handling venter på synkronisering"*.
4. Slå på nettverket igjen (eller trykk *Synkroniser nå*).
5. **Forventet**: Oppgaven sendes automatisk til serveren og tabellen oppdateres.

### Test 6: Bildegenerering & Resultatkort
1. Trykk på **Del kort** (eller *Del resultatkort* under Historikk / Ligatabell).
2. Forhåndsvis det genererte kortet med gradient, score og lagnavn.
3. Trykk **Del kort** på mobil (eller **Last ned PNG** på PC).
4. **Forventet**: Et høyoppløselig PNG-bilde genereres og overføres til operativsystemets delingsdialog.

### Test 7: Spillerpause midt i turneringen
1. I tabellen, trykk på pause-ikonet ved Spiller 1.
2. Trykk **Trekk runde**.
3. **Forventet**: Spiller 1 blir ikke trukket i denne runden. Tabellpoengene til Spiller 1 forblir uendret.
4. Fjern pause og trekk neste runde. Spiller 1 prioriteres automatisk på grunn av lavere spilletid.

### Test 8: Halvér poeng ved tidspress
1. Trykk **Halvér poeng** i toppmenyen.
2. **Forventet**: Målscore endres fra 21 til 11 poeng. Nye kamper spilles om 11 poeng.
3. Trykk på nytt for å reversere til 21 poeng.

### Test 9: Korrektur & Sammedags-sperre
1. Under *Fullførte kamper*, trykk **Korriger**.
2. Endre score og lagre.
3. **Forventet**: Tabellpoeng og Elo-ratinger rekalkuleres fra historikken i sin helhet.

### Test 10: Gjenåpning av fullført turnering
1. Trykk **Fullfør** på den aktive turneringen.
2. Gå til **Historikk** og finn turneringen under *Tidligere turneringer*.
3. Trykk **Gjenåpne**.
4. **Forventet**: Turneringen gjenopprettes som aktiv uten tap av kamper eller poeng.

### Test 11: Sikkerhetskopi (Backup & Restore)
1. Gå til **Hjelp** $\to$ **Database & Sikkerhetskopi**.
2. Trykk **Last ned JSON**, oppgi admin-passord (`admin123`).
3. Sjekk at JSON-filen inneholder `users`, `tournaments`, `matches` og `leagues`.
4. Last opp JSON-filen under *Gjenopprett fra JSON* og bekreft.
5. **Forventet**: Siden laster på nytt og alle data er intakt.

### Test 12: Multi-Profil Isolering (Access Code)
1. Trykk på profilknappen i toppmenyen (f.eks. *Profil: default*).
2. Skriv inn en ny kode, f.eks. `venneturnering`.
3. **Forventet**: Appen viser en ren tilstand uten spillerne fra `default`. Bytt tilbake til `default` for å se de opprinnelige dataene.

---

## 9. Installasjon, Drift & Docker Deployment

### 7.1 Lokal Utvikling

```bash
# 1. Installer avhengigheter
npm install

# 2. Generer Prisma Client og oppdater databasen
npx prisma db push

# 3. Start utviklingsserveren (port 3000)
npm run dev
```

### 7.2 Produksjonsbygg

```bash
npm run build
npm start
```

### 7.3 Docker & Portainer Deployment

Opprett `Dockerfile` i rotmappen:

```dockerfile
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/padel.db"
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm start"]
```

Opprett `docker-compose.yml`:

```yaml
version: '3.8'

services:
  padel-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: padelflex-pwa
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/padel.db
      - PORT=3000
      - ADMIN_PASSWORD=ditt_hemmelige_adminpassord
    volumes:
      - ./padel-data:/app/data
    ports:
      - "3000:3000"
```

Start containeren:
```bash
docker compose up -d --build
```

---

*PadelFlex — Utviklet med fokus på presisjon, rettferdighet og brukervennlighet på banen.*
