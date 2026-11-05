# PadelFlex 🎾

A self-hosted modern, mobile-first Progressive Web App (PWA) for complete management of padel tournaments, leagues, Americano/Mexicano formats, and career statistics.

PadelFlex was engineered specifically for padel clubs, friend groups, and corporate leagues. It eliminates manual paper notes and rigid spreadsheets, handling rotations, multi-court queues, and 2v2 Elo ratings in real time.

The main goal of the project was to easily allow for an uneven amount of players (e.g. 5-7), for players to join or leave mid-tournament, and then fairly match playtime for players dynamically.

Disclaimer: This app was developed in its entirety by Google AI Studio. It was developed as a personal hobby project, and is provided here as a proof-of-concept.

---

## Table of Contents
1. [Overview & Tech Stack](#1-overview--tech-stack)
2. [Key Features](#2-key-features)
3. [Architecture & Multi-Tenancy](#3-architecture--multi-tenancy)
4. [In-Depth Algorithm Documentation](#4-in-depth-algorithm-documentation)
   - [4.1 Americano Matchmaking & Cost Function](#41-americano-matchmaking--cost-function)
   - [4.2 Mexicano Matchmaking](#42-mexicano-matchmaking)
   - [4.3 Score-Weighted 2v2 Elo Rating System](#43-score-weighted-2v2-elo-rating-system)
   - [4.4 Multi-Court Scheduling (1–3 Courts)](#44-multi-court-scheduling-13-courts)
   - [4.5 Equalized Playtime & Progress Formula](#45-equalized-playtime--progress-formula)
   - [4.6 Player Pausing & Dynamic Mid-Tournament Joins](#46-player-pausing--dynamic-mid-tournament-joins)
   - [4.7 Point Halving Under Court Time Limits](#47-point-halving-under-court-time-limits)
   - [4.8 Normalized League Standings](#48-normalized-league-standings)
5. [Offline Resilience & Local Queue](#5-offline-resilience--local-queue)
6. [Social Result Cards & Image Generation](#6-social-result-cards--image-generation)
7. [Internationalization (i18n)](#7-internationalization-i18n)
8. [Database, Optimistic Locking & Tuning](#8-database-optimistic-locking--tuning)
9. [Installation, Local Development & Docker Deployment](#9-installation-local-development--docker-deployment)
10. [Environment Variables](#10-environment-variables)
11. [Quality Assurance & QA Test Scenarios](#11-quality-assurance--qa-test-scenarios)

---

## 1. Overview & Tech Stack

PadelFlex was engineered specifically for padel clubs, friend groups, and corporate leagues. It eliminates manual paper notes and rigid spreadsheets, handling rotations, multi-court queues, and 2v2 Elo ratings in real time.

The main goal of the project was to easily allow for an uneven amount of players (e.g. 5-7), for players to join or leave mid-tournament, and then fairly match playtime for players dynamically.

- **Framework**: Next.js 15.5+ (App Router, Server Actions, Route Handlers)
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (fluid animations), Lucide React icons
- **Database & ORM**: SQLite (`prisma/padel.db`) with Prisma ORM v6
- **Architecture**: Next.js Standalone server with multi-stage Docker builds (<200MB container)
- **State & Concurrency**: WAL-mode SQLite with optimistic locking (`version` field) and replay engine
- **PWA**: Web App Manifest, offline sync queue (`localStorage`), fullscreen installability

---

## 2. Key Features

- **Americano & Mexicano Formats**: Smart combinatorial engine ensuring balanced playtimes, fresh partnerships, and spread opponents.
- **2v2 Score-Weighted Elo Rating**: Margin-of-victory scaled Elo calculations with a deterministic replay engine for past match edits.
- **Multi-Court Allocation (1–3 Courts)**: Parallel scheduling for up to 3 courts simultaneously with court queue integrity.
- **Traditional Matches**: Full match scoreboard supporting Best of 1, 3, or 5 sets, Golden Point or Advantage, and Tiebreak/Super-Tiebreak.
- **Live Leaderboard & Progress Metrics**: Instant standings, cycle countdowns, and completion estimates based on recorded match durations.
- **Emergency Tools**: 
  - **Player Pause**: Temporarily benches late or injured players without losing their earned points.
  - **Halve Points**: Instantly cuts remaining target scores in half (e.g., 24 to 12 pts) when court booking time is running out.
  - **Time Calculator**: Computes exact achievable rounds based on players, courts, match length, and warm-up time.
- **Bilingual Support**: Norwegian (`no`) and English (`en`) selectable via environment variables.
- **Social Sharing**: Client-side PNG card generation for WhatsApp, Messenger, and Instagram Stories.

---

## 3. Architecture & Multi-Tenancy

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (PWA)                          │
│  - TournamentView (Active courts, live standings, draw)     │
│  - LeaguesView (League series, multi-round Elo leaderboard) │
│  - StandaloneMatchView (Traditional Best-of-3 sets scoring) │
│  - HistoryView (Archived tournaments, past matches, replay) │
│  - PlayersView (Player profiles, career records, head-to-head)│
│  - HelpFaqView (Guides, FAQs, time calculator, backup)      │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
       Server Actions & API             Props & Server State
               │                               │
┌──────────────▼───────────────────────────────┴──────────────┐
│                    Next.js App Server                       │
│  - lib/auth.ts (HMAC-SHA256 token verification & tenancy)   │
│  - app/actions.ts (Matchmaking engine, scores, standings)   │
│  - lib/elo.ts (2v2 score-weighted Elo rating calculation)   │
│  - lib/match-utils.ts (Progress, cycle & duration formulas) │
│  - app/api/backup/route.ts (Atomic JSON backup export/import)│
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma ORM
┌──────────────────────────────▼──────────────────────────────┐
│                    SQLite Database                          │
│   User | League | LeagueMember | Tournament | Participant   │
│   | Match | StandaloneMatch                                 │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Isolation
- **Tenant Codes**: Users enter an access code (e.g., `friends`, `oslo-padel`, `company-league`).
- **Query Scoping**: Database queries automatically filter with `where: { accessCode: session.accessCode }`.
- **Fast Profile Switching**: Multiple access codes can be saved locally in the browser and switched with one click.
- **Admin Access**: Entering the admin password grants system-wide oversight, cross-tenant access, backup downloads, and restore tools.

---

## 4. In-Depth Algorithm Documentation

### 4.1 Americano Matchmaking & Cost Function

In an Americano tournament, every player should ideally partner with and play against every other participant an equal number of times.

#### Step 1: History Matrices
Prior to drawing each round, the engine builds three matrices from all prior matches:
- `matchCount[p]`: Total matches played by player $p$ (including `pausedCount`).
- `partnerMatrix[p1][p2]`: Number of times $p_1$ and $p_2$ were on the same team.
- `opponentMatrix[p1][p2]`: Number of times $p_1$ and $p_2$ faced each other as opponents.

#### Step 2: Selecting Candidates
Active (unpaused) players are sorted by:
1. `matchCount` (ascending — players with fewer matches are prioritized).
2. `totalPoints` (descending — secondary tie-breaker).

For $C$ available courts, the first $4 \times C$ candidates are selected into `availableIds`.

#### Step 3: Combinatorial Optimization & Cost Function
For any set of 4 players $\{p_0, p_1, p_2, p_3\}$, there are 3 possible team configurations:
1. **Config 1**: $(p_0, p_1)$ vs $(p_2, p_3)$
2. **Config 2**: $(p_0, p_2)$ vs $(p_1, p_3)$
3. **Config 3**: $(p_0, p_3)$ vs $(p_1, p_2)$

Each configuration is evaluated against the following mathematical cost function:

$$\text{Cost} = (\text{MatchSum} \times 1\,000\,000) + (\text{PartnerPenalty} \times 10\,000) + (\text{OpponentPenalty} \times 100) + \text{Noise}$$

Where:
- $\text{MatchSum} = \sum_{i=0}^{3} \text{matchCount}[p_i]$
- $\text{PartnerPenalty} = \text{partnerMatrix}[a_1][a_2] + \text{partnerMatrix}[b_1][b_2]$
- $\text{OpponentPenalty} = \sum_{x \in \{a_1, a_2\}} \sum_{y \in \{b_1, b_2\}} \text{opponentMatrix}[x][y]$
- $\text{Noise} = \text{random}(0, 5)$ *(breaks deterministic ties dynamically)*

**Rationale behind the weights:**
- **$1\,000\,000$ (Playtime Weight)**: Guarantees no player falls behind in total matches played.
- **$10\,000$ (Partner Penalty)**: Partnering with a new player is weighted 100× more heavily than facing a new opponent.
- **$100$ (Opponent Penalty)**: Distributes opponents evenly once partnership freshness is satisfied.
- **$0–5$ (Noise)**: Eliminates predictable draw order when candidates have identical historical weights.

---

### 4.2 Mexicano Matchmaking

In Mexicano, matchups are determined dynamically from current leaderboard positions:
- **Round 1**: Standard Americano draw (all players start with 0 points).
- **Round 2+**:
  1. The $4 \times C$ players with the fewest matches are selected.
  2. Ranked by `totalPoints` (descending): $[P_1, P_2, P_3, P_4]$.
  3. Paired using the **1st & 3rd vs 2nd & 4th** formula:
     $$\text{Team A} = (P_1, P_3) \quad \text{vs} \quad \text{Team B} = (P_2, P_4)$$
  4. This produces competitive, closely matched games throughout the event.

---

### 4.3 Score-Weighted 2v2 Elo Rating System

PadelFlex features a specialized 2v2 Elo calculation engine:

#### 1. Baseline Rating & Team Average
All players start at **1500 Elo** (`LeagueMember.eloRating`).
$$R_A = \frac{R_{A1} + R_{A2}}{2}, \quad R_B = \frac{R_{B1} + R_{B2}}{2}$$

Expected outcomes:
$$E_A = \frac{1}{1 + 10^{(R_B - R_A) / 400}}, \quad E_B = 1 - E_A$$

#### 2. Actual Match Result ($S_A$)
$$S_A = \begin{cases} 1.0 & \text{if Team A wins} \\ 0.5 & \text{if Draw} \\ 0.0 & \text{if Team B wins} \end{cases}$$

#### 3. Victory Margin Scaling ($M$)
To reward decisive victories (e.g., 21–3 vs 21–19), the delta is scaled with a square-root margin factor:
$$\text{ScoreDiff} = |\text{Score}_A - \text{Score}_B|$$
$$\text{MarginFactor} = \max\left(1.0, \, \sqrt{\text{ScoreDiff} + 1} \times \frac{\text{ScoreDiff} + 3}{\text{targetScore} \times 0.2 + 3}\right)$$

#### 4. Rating Update ($\Delta R$)
With base $K = 32$:
$$\Delta R_A = \text{round}\left(K \times \text{MarginFactor} \times (S_A - E_A)\right)$$
$$\Delta R_B = -\Delta R_A$$

Each player on Team A receives $R_{A} \leftarrow R_{A} + \Delta R_A$, and Team B receives $R_{B} \leftarrow R_{B} + \Delta R_B$.

#### 5. Deterministic Historical Replay
When a completed match is edited, deleted, or a tournament reopened, the system triggers `recalculateAllRatings` in `lib/elo.ts`:
1. Resets all league players to 1500.
2. Re-executes every completed match in strict chronological sequence.
3. Atomically updates player ratings and records in a single database transaction.

---

### 4.4 Multi-Court Scheduling (1–3 Courts)

- $\text{maxPossibleCourts} = \lfloor N_{\text{active}} / 4 \rfloor$
- $\text{courtsToDraw} = \min(\text{configuredCourts}, \text{maxPossibleCourts})$
- **Match Integrity**: A new match cannot be drawn on Court $k$ if there is already an active unfinished match on that court.

---

### 4.5 Equalized Playtime & Progress Formula

- $\text{SlotsNeeded} = \sum_{p} \max(0, \text{maxPlayed} - \text{matchesPlayed}[p])$
- $\text{MatchesToEqualize} = \lceil \text{SlotsNeeded} / 4 \rceil$
- When $\min(matchesPlayed) = \max(matchesPlayed)$ and completed matches $> 0$, the tournament has reached **Equal Playtime** (`isEqualized = true`).
- **Complete Americano Cycle**: When total players $N$ is divisible by 4:
  $$T_{\text{cycle}} = \frac{N \times (N - 1)}{4}$$
  *(For 8 players: $\frac{8 \times 7}{4} = 14$ total matches, 7 matches per player).*

---

### 4.6 Player Pausing & Dynamic Mid-Tournament Joins

- **Player Pause**: Benched players are marked `isPaused: true`. They are omitted from new draws without losing accumulated points.
- **Late Arrivals**: When a new player joins mid-tournament:
  $$\text{pausedCount} = \left\lfloor \frac{\text{completedMatchesCount} \times 4}{N_{\text{existing}}} \right\rfloor$$
  This virtual match count prevents the engine from scheduling the newcomer into 10 consecutive rounds alone.

---

### 4.7 Point Halving Under Court Time Limits

When venue booking time is expiring, the **Halve Points** action updates:
$$\text{originalTargetScore} = \text{targetScore}, \quad \text{targetScore} = \max\left(1, \text{round}\left(\frac{\text{targetScore}}{2}\right)\right)$$
Remaining matches are played to 12 or 11 points instead of 24 or 21 points, allowing all courts to wrap up on time.

---

### 4.8 Normalized League Standings

To compare players across rounds with different target scores (e.g., 21 vs 24 or 12 pts):
$$P_i = \left( \frac{\text{Points Scored}_i}{\text{Target Score in Round}_i} \right) \times 100$$
$$\text{Average Score \%} = \frac{1}{M} \sum_{i=1}^{M} P_i$$
$$\text{Win Rate \%} = \left( \frac{\text{Wins} + 0.5 \times \text{Draws}}{\text{Matches Played}} \right) \times 100$$

---

## 5. Offline Resilience & Local Queue

For venues with weak cellular coverage, `hooks/useOfflineSync.ts` provides client-side resilience:
1. **Local Queue**: When offline (`!navigator.onLine`), match score registrations are stored in `localStorage` under `padelflex_offline_queue_v1`.
2. **Optimistic Versioning**: Each mutation carries the match's `version` token to prevent overwriting updates made on another device.
3. **Automatic Sync**: An event listener on `window.addEventListener('online')` automatically drains and synchronizes queued requests sequentially once network connectivity is restored.

---

## 6. Social Result Cards & Image Generation

- Built with `html-to-image` rendering directly to high-DPI PNGs (`pixelRatio: 2.5`).
- **Web Share API**: Uses native OS sharing (`navigator.share({ files: [file] })`) on iOS Safari and Android Chrome.
- **Desktop Fallback**: Automatically triggers PNG file download when the Web Share API is unavailable.
- **Card Formats**:
  - **Match Card**: Court number, team rosters, final score, difference, and Elo delta.
  - **Tournament / League Leaderboard**: Podium rankings, gold/silver/bronze badges, points, and Elo ratings.

---

## 7. Internationalization (i18n)

The application supports English and Norwegian out-of-the-box:
- **Dynamic Runtime Support**: `NEXT_PUBLIC_APP_LANGUAGE` (or `APP_LANGUAGE`) can be changed in `docker-compose.yml` or `.env` and takes effect immediately without rebuilding the Docker container.
- **In-App Language Switcher**: Users can toggle between **NO** and **EN** directly from the top navigation bar or the login screen. User preference is saved in `localStorage`.
- **Type-Safe Dictionary**: Defined in `lib/i18n.tsx` with full coverage for tournaments, matches, leaderboards, player stats, rules, FAQs, and admin backup modals.

---

## 8. Database, Optimistic Locking & Tuning

### SQLite WAL Mode
Configured automatically in `lib/prisma.ts`:
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

### Optimistic Concurrency
Matches track `status: MatchStatus`, `version: Int @default(1)`, and `updatedAt: DateTime @updatedAt`. Concurrent writes fail gracefully if another scorer already registered the match.

---

## 9. Installation, Local Development & Docker Deployment

### 9.1 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Synchronize database schema
npx prisma db push

# 3. Start development server on port 3000
npm run dev
```

### 9.2 Production Build

```bash
# Build standalone Next.js bundle
npm run build

# Start production server
npm start
```

### 9.3 Production Multi-Stage Docker Setup

The repository includes an optimized multi-stage `Dockerfile` (`node:22-alpine`):

```dockerfile
# ==========================================
# STAGE 1: Install dependencies
# ==========================================
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# ==========================================
# STAGE 2: Build application
# ==========================================
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/padel.db"

RUN npx prisma generate
RUN npm run build
RUN cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/

# ==========================================
# STAGE 3: Production runner
# ==========================================
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Oslo
ENV DATABASE_URL="file:/app/data/padel.db"
ENV PORT=3000

RUN mkdir -p /app/data

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && node server.js"]
```

### 9.4 Docker Compose (`docker-compose.yml`)

```bash
# Start container with volume persistence
docker compose up -d --build
```

---

## 10. Environment Variables

Create a `.env` file from `.env.example`:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/padel.db` | SQLite database connection string or file path |
| `USER_PASSWORD` | `padel123` | Default user password for app access |
| `ADMIN_PASSWORD` | `admin123` | Master password for JSON backup download, restore, and resets |
| `NEXT_PUBLIC_APP_LANGUAGE` | `no` | In-app language (`"no"` for Norwegian, `"en"` for English) |
| `NEXT_PUBLIC_ENABLE_TEST_PROFILE` | `false` | When `"true"`, displays the "Try with test profile" button on login |
| `PORT` | `3000` | HTTP port for the web server |

---

## 11. Quality Assurance & QA Test Scenarios

### Test 1: Single Tournament Creation (8 Players, 2 Courts, 21 Pts)
1. Navigate to **New Tournament** $\to$ **Single Tournament**.
2. Select 8 players, set courts = 2, and target score = 21.
3. **Verify**: Tournament initializes with 0 matches played and an empty active match card.

### Test 2: Draw & Matchmaking Rotation
1. Click **Draw Round**.
2. **Verify**: Two matches are generated (Court 1 & Court 2) with 8 distinct players.
3. Enter scores for both courts (e.g., 14–7 and 12–9).
4. Click **Draw Round** again.
5. **Verify**: No player is partnered with their Round 1 teammate (partner penalty enforced).

### Test 3: Score-Weighted Elo Rating in Leagues
1. Start an Americano round linked to an active League.
2. Record a dominant win (e.g., 21–2).
3. **Verify**: Winning players receive a larger Elo gain (+26) than in a narrow 21–19 win (+16).
4. Go to **Leagues** and verify that standings sort primarily by the updated Elo rating.

### Test 4: Offline Queue & Recovery
1. In browser DevTools, switch network throttling to **Offline**.
2. Submit a match score.
3. **Verify**: Yellow notification bar appears: *"1 action pending synchronization"*.
4. Switch back to **Online**.
5. **Verify**: Queue drains automatically, data synchronizes, and leaderboard updates.

### Test 5: Full JSON Backup & Restore
1. Log in as admin, navigate to **Help** $\to$ **Database & Backup**.
2. Click **Download Backup** $\to$ inspect exported `.json` file.
3. Upload the file under **Restore from JSON** and confirm.
4. **Verify**: Application restores players, tournaments, and match records intact.

---

*PadelFlex — Designed for precision, fair matchmaking, and effortless tournament nights.*
