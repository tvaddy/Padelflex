import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma, { ensureDbSchemaMigrated } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';

function checkAdminAuth(req: NextRequest, bodyPassword?: string): boolean {
  const { searchParams } = new URL(req.url);
  const queryPass = searchParams.get('password') || searchParams.get('token');
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const cookieToken = req.cookies.get('padelflex_token')?.value;

  const candidate = bodyPassword || queryPass || authHeader || cookieToken || '';
  return verifyAdmin(candidate);
}

// GET: Last ned backup (JSON eller DB) - KUN FOR ADMIN
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json(
      { error: 'Kun administrator har tilgang til å laste ned sikkerhetskopi. Vennligst oppgi gyldig admin-passord.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';

  if (format === 'json') {
    try {
      await ensureDbSchemaMigrated(prisma);

      const [users, leagues, leagueMembers, tournaments, participants, matches, standaloneMatches] = await Promise.all([
        prisma.user.findMany(),
        prisma.league.findMany(),
        prisma.leagueMember.findMany(),
        prisma.tournament.findMany(),
        prisma.tournamentParticipant.findMany(),
        prisma.match.findMany(),
        prisma.standaloneMatch.findMany(),
      ]);

      const backupData = {
        app: 'PadelFlex',
        exportDate: new Date().toISOString(),
        version: '2.0',
        counts: {
          users: users.length,
          leagues: leagues.length,
          leagueMembers: leagueMembers.length,
          tournaments: tournaments.length,
          participants: participants.length,
          matches: matches.length,
          standaloneMatches: standaloneMatches.length,
        },
        data: {
          users,
          leagues,
          leagueMembers,
          tournaments,
          participants,
          matches,
          standaloneMatches,
        },
      };

      const dateStr = new Date().toISOString().split('T')[0];
      return new NextResponse(JSON.stringify(backupData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="padelflex-backup-${dateStr}.json"`,
        },
      });
    } catch (error) {
      console.error('Failed to export JSON backup:', error);
      return NextResponse.json({ error: 'Kunne ikke eksportere JSON-backup' }, { status: 500 });
    }
  }

  // format === 'db'
  try {
    let dbPath = path.join(process.cwd(), 'prisma', 'padel.db');
    const envUrl = process.env.DATABASE_URL;
    if (envUrl && envUrl.startsWith('file:')) {
      const rawPath = envUrl.replace(/^file:/, '');
      if (path.isAbsolute(rawPath)) {
        dbPath = rawPath;
      } else {
        dbPath = path.resolve(process.cwd(), rawPath);
      }
    }

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Databasefil ikke funnet på serveren' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.sqlite3',
        'Content-Disposition': `attachment; filename="padel-database-${dateStr}.db"`,
      },
    });
  } catch (error) {
    console.error('Failed to export SQLite database:', error);
    return NextResponse.json({ error: 'Kunne ikke laste ned databasefil' }, { status: 500 });
  }
}

// POST: Last opp og gjenopprett JSON-backup - KUN FOR ADMIN
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { password, backupData } = payload;

    if (!checkAdminAuth(req, password)) {
      return NextResponse.json(
        { error: 'Kun administrator har tilgang til å gjenopprette databasen. Oppgi gyldig admin-passord.' },
        { status: 401 }
      );
    }

    if (!backupData || (typeof backupData !== 'object')) {
      return NextResponse.json(
        { error: 'Ugyldig backup-filstruktur. Ingen data ble mottatt.' },
        { status: 400 }
      );
    }

    const dataObj = backupData.data || backupData;
    const { 
      users = [], 
      leagues = [], 
      leagueMembers = [], 
      tournaments = [], 
      participants = [], 
      matches = [],
      standaloneMatches = [] 
    } = dataObj;

    // Sørg for at alle kolonner (som highestElo, lowestElo, etc.) eksisterer i databasen før innsetting
    await ensureDbSchemaMigrated(prisma);

    // Utfør full gjenoppretting i en transaksjon
    await prisma.$transaction(async (tx) => {
      // 1. Slett eksisterende data i riktig rekkefølge for foreign keys
      await tx.standaloneMatch.deleteMany({});
      await tx.match.deleteMany({});
      await tx.tournamentParticipant.deleteMany({});
      await tx.tournament.deleteMany({});
      await tx.leagueMember.deleteMany({});
      await tx.league.deleteMany({});
      await tx.user.deleteMany({});

      // 2. Sett inn brukere med Elo-historikk
      if (users.length > 0) {
        for (const u of users) {
          const elo = typeof u.eloRating === 'number' ? u.eloRating : 1500.0;
          await tx.user.create({
            data: {
              id: u.id,
              name: u.name,
              accessCode: u.accessCode || 'default',
              eloRating: elo,
              highestElo: typeof u.highestElo === 'number' ? u.highestElo : elo,
              lowestElo: typeof u.lowestElo === 'number' ? u.lowestElo : elo,
              isArchived: Boolean(u.isArchived),
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            },
          });
        }
      }

      // 3. Sett inn ligaer
      if (leagues.length > 0) {
        for (const l of leagues) {
          await tx.league.create({
            data: {
              id: l.id,
              name: l.name,
              description: l.description || null,
              defaultTargetScore: typeof l.defaultTargetScore === 'number' ? l.defaultTargetScore : 21,
              isArchived: Boolean(l.isArchived),
              accessCode: l.accessCode || 'default',
              completedAt: l.completedAt ? new Date(l.completedAt) : null,
              createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
            },
          });
        }
      }

      // 4. Sett inn ligamedlemmer med rating
      if (leagueMembers.length > 0) {
        for (const lm of leagueMembers) {
          const elo = typeof lm.eloRating === 'number' ? lm.eloRating : 1500.0;
          await tx.leagueMember.create({
            data: {
              id: lm.id,
              leagueId: lm.leagueId,
              userId: lm.userId,
              eloRating: elo,
              highestElo: typeof lm.highestElo === 'number' ? lm.highestElo : elo,
              lowestElo: typeof lm.lowestElo === 'number' ? lm.lowestElo : elo,
              createdAt: lm.createdAt ? new Date(lm.createdAt) : new Date(),
            },
          });
        }
      }

      // 5. Sett inn turneringer
      if (tournaments.length > 0) {
        for (const t of tournaments) {
          await tx.tournament.create({
            data: {
              id: t.id,
              name: t.name,
              isActive: Boolean(t.isActive),
              type: t.type || 'AMERICANO',
              courtCount: typeof t.courtCount === 'number' ? t.courtCount : 1,
              targetScore: typeof t.targetScore === 'number' ? t.targetScore : 21,
              originalTargetScore: typeof t.originalTargetScore === 'number' ? t.originalTargetScore : null,
              isArchived: Boolean(t.isArchived),
              accessCode: t.accessCode || 'default',
              createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
              completedAt: t.completedAt ? new Date(t.completedAt) : null,
              leagueId: t.leagueId || null,
            },
          });
        }
      }

      // 6. Sett inn turneringsdeltakere
      if (participants.length > 0) {
        for (const p of participants) {
          await tx.tournamentParticipant.create({
            data: {
              id: p.id,
              tournamentId: p.tournamentId,
              userId: p.userId,
              totalPoints: p.totalPoints ?? 0,
              matchesWon: p.matchesWon ?? 0,
              matchesDrawn: p.matchesDrawn ?? 0,
              matchesLost: p.matchesLost ?? 0,
              pausedCount: p.pausedCount ?? 0,
              isPaused: Boolean(p.isPaused),
              tournamentElo: typeof p.tournamentElo === 'number' ? p.tournamentElo : 1500.0,
              initialElo: typeof p.initialElo === 'number' ? p.initialElo : 1500.0,
              eloDelta: typeof p.eloDelta === 'number' ? p.eloDelta : 0.0,
            },
          });
        }
      }

      // 7. Sett inn kamper med Elo-detaljer
      if (matches.length > 0) {
        for (const m of matches) {
          await tx.match.create({
            data: {
              id: m.id,
              tournamentId: m.tournamentId,
              courtNumber: typeof m.courtNumber === 'number' ? m.courtNumber : 1,
              status: m.status || (m.isCompleted ? 'COMPLETED' : 'PENDING'),
              version: typeof m.version === 'number' ? m.version : 1,
              date: m.date ? new Date(m.date) : new Date(),
              startedAt: m.startedAt ? new Date(m.startedAt) : new Date(),
              completedAt: m.completedAt ? new Date(m.completedAt) : null,
              updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
              teamAPlayer1Id: m.teamAPlayer1Id,
              teamAPlayer2Id: m.teamAPlayer2Id,
              teamBPlayer1Id: m.teamBPlayer1Id,
              teamBPlayer2Id: m.teamBPlayer2Id,
              teamAScore: m.teamAScore ?? 0,
              teamBScore: m.teamBScore ?? 0,
              winnerTeam: m.winnerTeam || null,
              isCompleted: Boolean(m.isCompleted),
              teamAEloBefore: typeof m.teamAEloBefore === 'number' ? m.teamAEloBefore : null,
              teamBEloBefore: typeof m.teamBEloBefore === 'number' ? m.teamBEloBefore : null,
              eloDelta: typeof m.eloDelta === 'number' ? m.eloDelta : null,
            },
          });
        }
      }

      // 8. Sett inn frittstående kamper hvis til stede
      if (standaloneMatches.length > 0) {
        for (const sm of standaloneMatches) {
          await tx.standaloneMatch.create({
            data: {
              id: sm.id,
              name: sm.name || 'Padelkamp',
              accessCode: sm.accessCode || 'default',
              teamAPlayer1: sm.teamAPlayer1,
              teamAPlayer2: sm.teamAPlayer2,
              teamBPlayer1: sm.teamBPlayer1,
              teamBPlayer2: sm.teamBPlayer2,
              teamAPlayer1Id: sm.teamAPlayer1Id || null,
              teamAPlayer2Id: sm.teamAPlayer2Id || null,
              teamBPlayer1Id: sm.teamBPlayer1Id || null,
              teamBPlayer2Id: sm.teamBPlayer2Id || null,
              format: sm.format || 'BEST_OF_3',
              goldenPoint: sm.goldenPoint !== undefined ? Boolean(sm.goldenPoint) : true,
              scoresJson: sm.scoresJson || '{}',
              winnerTeam: sm.winnerTeam || null,
              isCompleted: Boolean(sm.isCompleted),
              startedAt: sm.startedAt ? new Date(sm.startedAt) : new Date(),
              completedAt: sm.completedAt ? new Date(sm.completedAt) : null,
              createdAt: sm.createdAt ? new Date(sm.createdAt) : new Date(),
            },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Databasen ble vellykket gjenopprettet fra JSON-sikkerhetskopi!',
      restored: {
        users: users.length,
        leagues: leagues.length,
        tournaments: tournaments.length,
        matches: matches.length,
        standaloneMatches: standaloneMatches.length,
      },
    });
  } catch (error: any) {
    console.error('Failed to restore backup:', error);
    return NextResponse.json(
      { error: `Kunne ikke gjenopprette backup: ${error?.message || 'Ukjent feil'}` },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';
