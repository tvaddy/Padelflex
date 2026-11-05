import prisma from './prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from './auth';

const DEFAULT_ELO = 1500.0;

/**
 * Recalculates points, wins, draws, losses for all participants in a tournament.
 */
async function recalculateTournamentStatsInternal(tx: any, tournamentId: string) {
  const matches = await tx.match.findMany({
    where: { tournamentId, isCompleted: true },
  });

  const participants = await tx.tournamentParticipant.findMany({
    where: { tournamentId },
  });

  const statsMap: Record<string, { points: number; won: number; drawn: number; lost: number }> = {};
  for (const p of participants) {
    statsMap[p.userId] = { points: 0, won: 0, drawn: 0, lost: 0 };
  }

  for (const m of matches) {
    const a1 = m.teamAPlayer1Id;
    const a2 = m.teamAPlayer2Id;
    const b1 = m.teamBPlayer1Id;
    const b2 = m.teamBPlayer2Id;
    const sa = m.teamAScore ?? 0;
    const sb = m.teamBScore ?? 0;

    if (statsMap[a1]) statsMap[a1].points += sa;
    if (statsMap[a2]) statsMap[a2].points += sa;
    if (statsMap[b1]) statsMap[b1].points += sb;
    if (statsMap[b2]) statsMap[b2].points += sb;

    if (sa > sb) {
      if (statsMap[a1]) statsMap[a1].won += 1;
      if (statsMap[a2]) statsMap[a2].won += 1;
      if (statsMap[b1]) statsMap[b1].lost += 1;
      if (statsMap[b2]) statsMap[b2].lost += 1;
    } else if (sb > sa) {
      if (statsMap[b1]) statsMap[b1].won += 1;
      if (statsMap[b2]) statsMap[b2].won += 1;
      if (statsMap[a1]) statsMap[a1].lost += 1;
      if (statsMap[a2]) statsMap[a2].lost += 1;
    } else {
      if (statsMap[a1]) statsMap[a1].drawn += 1;
      if (statsMap[a2]) statsMap[a2].drawn += 1;
      if (statsMap[b1]) statsMap[b1].drawn += 1;
      if (statsMap[b2]) statsMap[b2].drawn += 1;
    }
  }

  for (const p of participants) {
    const s = statsMap[p.userId] || { points: 0, won: 0, drawn: 0, lost: 0 };
    await tx.tournamentParticipant.update({
      where: { id: p.id },
      data: {
        totalPoints: s.points,
        matchesWon: s.won,
        matchesDrawn: s.drawn,
        matchesLost: s.lost,
      },
    });
  }
}

/**
 * Seeds sample test data (8 players, a league, an Americano tournament, and standalone matches)
 * for testing and demonstration purposes.
 */
export async function seedTestDataForCode(accessCode: string = 'test', forceReset: boolean = false) {
  const code = accessCode.trim().toLowerCase() || 'test';

  if (forceReset) {
    await prisma.$transaction(async (tx) => {
      const tourneys = await tx.tournament.findMany({ where: { accessCode: code } });
      for (const t of tourneys) {
        await tx.match.deleteMany({ where: { tournamentId: t.id } });
        await tx.tournamentParticipant.deleteMany({ where: { tournamentId: t.id } });
      }
      await tx.tournament.deleteMany({ where: { accessCode: code } });

      const leagues = await tx.league.findMany({ where: { accessCode: code } });
      for (const l of leagues) {
        await tx.leagueMember.deleteMany({ where: { leagueId: l.id } });
      }
      await tx.league.deleteMany({ where: { accessCode: code } });
      await tx.standaloneMatch.deleteMany({ where: { accessCode: code } });
      await tx.user.deleteMany({ where: { accessCode: code } });
    });
  }

  // 1. Create 8 test players
  const playerNames = [
    'Alexander', 'Henrik', 'Thomas', 'Magnus',
    'Kristoffer', 'Jonas', 'Fredrik', 'Sander',
  ];

  const createdPlayers: any[] = [];
  for (const name of playerNames) {
    let p = await prisma.user.findFirst({
      where: { name, accessCode: code, isArchived: false },
    });
    if (!p) {
      p = await prisma.user.create({
        data: {
          name,
          accessCode: code,
          eloRating: DEFAULT_ELO,
          highestElo: DEFAULT_ELO,
          lowestElo: DEFAULT_ELO,
          isArchived: false,
        },
      });
    }
    createdPlayers.push(p);
  }

  const [p1, p2, p3, p4, p5, p6, p7, p8] = createdPlayers;

  // 2. Create sample League
  let league = await prisma.league.findFirst({
    where: { name: 'PadelFlex Premier League', accessCode: code },
  });

  if (!league) {
    league = await prisma.league.create({
      data: {
        name: 'PadelFlex Premier League',
        description: 'Official test league for internal matches and Elo rankings',
        defaultTargetScore: 21,
        accessCode: code,
        isArchived: false,
        members: {
          create: createdPlayers.map((p) => ({
            userId: p.id,
            eloRating: DEFAULT_ELO,
            highestElo: DEFAULT_ELO,
            lowestElo: DEFAULT_ELO,
          })),
        },
      },
    });
  }

  // 3. Create completed Americano Tournament
  let tourney = await prisma.tournament.findFirst({
    where: { name: 'Americano Round #1', accessCode: code },
  });

  if (!tourney && p1 && p2 && p3 && p4 && p5 && p6 && p7 && p8) {
    const createdTourney = await prisma.tournament.create({
      data: {
        name: 'Americano Round #1',
        accessCode: code,
        leagueId: league?.id || null,
        type: 'AMERICANO',
        courtCount: 2,
        targetScore: 21,
        isActive: false,
        isArchived: false,
        completedAt: new Date(),
        participants: {
          create: createdPlayers.map((p) => ({
            userId: p.id,
            totalPoints: 0,
            matchesWon: 0,
            matchesDrawn: 0,
            matchesLost: 0,
          })),
        },
      },
    });

    const matchDefs = [
      { c: 1, a1: p1.id, a2: p2.id, b1: p3.id, b2: p4.id, sa: 21, sb: 15 },
      { c: 2, a1: p5.id, a2: p6.id, b1: p7.id, b2: p8.id, sa: 21, sb: 17 },
      { c: 1, a1: p1.id, a2: p3.id, b1: p2.id, b2: p4.id, sa: 21, sb: 19 },
      { c: 2, a1: p5.id, a2: p7.id, b1: p6.id, b2: p8.id, sa: 21, sb: 14 },
      { c: 1, a1: p1.id, a2: p4.id, b1: p2.id, b2: p3.id, sa: 21, sb: 16 },
      { c: 2, a1: p6.id, a2: p7.id, b1: p5.id, b2: p8.id, sa: 21, sb: 18 },
      { c: 1, a1: p1.id, a2: p5.id, b1: p2.id, b2: p6.id, sa: 21, sb: 18 },
      { c: 2, a1: p3.id, a2: p7.id, b1: p4.id, b2: p8.id, sa: 21, sb: 15 },
    ];

    for (const m of matchDefs) {
      await prisma.match.create({
        data: {
          tournamentId: createdTourney.id,
          courtNumber: m.c,
          teamAPlayer1Id: m.a1,
          teamAPlayer2Id: m.a2,
          teamBPlayer1Id: m.b1,
          teamBPlayer2Id: m.b2,
          teamAScore: m.sa,
          teamBScore: m.sb,
          status: 'COMPLETED',
          winnerTeam: m.sa > m.sb ? 'A' : m.sb > m.sa ? 'B' : 'DRAW',
          isCompleted: true,
          completedAt: new Date(),
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      await recalculateTournamentStatsInternal(tx, createdTourney.id);
    });
  }

  // 4. Create sample Standalone Matches
  const existingMatches = await prisma.standaloneMatch.findMany({ where: { accessCode: code } });
  if (existingMatches.length === 0 && p1 && p2 && p3 && p4) {
    const activeScores = JSON.stringify({
      sets: [
        { teamA: 6, teamB: 4 },
        { teamA: 4, teamB: 6 },
        { teamA: 5, teamB: 4 },
      ],
      currentSetIndex: 2,
      currentPoints: { teamA: '40', teamB: '30' },
      isTiebreak: false,
      tiebreakScores: { teamA: 0, teamB: 0 },
      servingTeam: 'A',
      servingPlayer: 1,
      history: [],
      events: [],
      gameScoresHistory: [],
      matchStats: {
        teamAPointsTotal: 68,
        teamBPointsTotal: 62,
        goldenPointsPlayed: 3,
        goldenPointsWonA: 2,
        goldenPointsWonB: 1,
        breakPointsA: 5,
        breakPointsB: 4,
        breakPointsConvertedA: 3,
        breakPointsConvertedB: 2,
      },
    });

    await prisma.standaloneMatch.create({
      data: {
        name: 'Exhibition Match: Alexander & Henrik vs Thomas & Magnus',
        accessCode: code,
        teamAPlayer1: p1.name,
        teamAPlayer2: p2.name,
        teamBPlayer1: p3.name,
        teamBPlayer2: p4.name,
        teamAPlayer1Id: p1.id,
        teamAPlayer2Id: p2.id,
        teamBPlayer1Id: p3.id,
        teamBPlayer2Id: p4.id,
        format: 'BEST_OF_3',
        goldenPoint: true,
        scoresJson: activeScores,
        isCompleted: false,
        startedAt: new Date(),
      },
    });
  }

  revalidatePath('/');
}

/**
 * Resets the current user session's test profile back to default test data.
 */
export async function resetTestProfileData(code?: string) {
  const session = await getServerSession();
  const targetCode = code || (session.accessCode === 'ADMIN' ? 'test' : session.accessCode);
  await seedTestDataForCode(targetCode, true);
  return { success: true };
}
