'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from '@/lib/auth';
import { isMatchEditable } from '@/lib/match-utils';
import { 
  replayLeagueMatchesElo, 
  replayTournamentElo,
  calculate2v2EloDelta, 
  analyzePlayerExtendedStats,
  DEFAULT_ELO 
} from '@/lib/elo';

/* ==========================================================================
   HELPER: SESSION & ACCESS CODE
   ========================================================================== */

async function getAuthSession() {
  return await getServerSession();
}

/* ==========================================================================
   TESTPROFIL & EKSEMPELDATA SEEDER
   ========================================================================== */

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

  // 1. Opprett 8 testspillere
  const playerNames = [
    'Alexander', 'Henrik', 'Thomas', 'Magnus',
    'Kristoffer', 'Jonas', 'Fredrik', 'Sander'
  ];

  const createdPlayers: any[] = [];
  for (const name of playerNames) {
    let p = await prisma.user.findFirst({
      where: { name, accessCode: code, isArchived: false }
    });
    if (!p) {
      p = await prisma.user.create({
        data: {
          name,
          accessCode: code,
          eloRating: DEFAULT_ELO,
          isArchived: false,
        }
      });
    }
    createdPlayers.push(p);
  }

  const [p1, p2, p3, p4, p5, p6, p7, p8] = createdPlayers;

  // 2. Opprett Liga
  let league = await prisma.league.findFirst({
    where: { name: 'PadelFlex Tirsdagsliga', accessCode: code }
  });

  if (!league) {
    league = await prisma.league.create({
      data: {
        name: 'PadelFlex Tirsdagsliga',
        description: 'Offisiell testliga for interne kamper og Elo-ranking',
        defaultTargetScore: 21,
        accessCode: code,
        isArchived: false,
        members: {
          create: createdPlayers.map(p => ({
            userId: p.id,
            eloRating: DEFAULT_ELO,
            highestElo: DEFAULT_ELO,
            lowestElo: DEFAULT_ELO,
          }))
        }
      }
    });
  }

  // 3. Opprett Fullført Americano Turnering
  let tourney = await prisma.tournament.findFirst({
    where: { name: 'Tirsdagsturnering #1 (Americano)', accessCode: code }
  });

  if (!tourney && p1 && p2 && p3 && p4 && p5 && p6 && p7 && p8) {
    const createdTourney = await prisma.tournament.create({
      data: {
        name: 'Tirsdagsturnering #1 (Americano)',
        accessCode: code,
        leagueId: league.id,
        type: 'AMERICANO',
        courtCount: 2,
        targetScore: 21,
        isActive: false,
        isArchived: false,
        completedAt: new Date(),
        participants: {
          create: createdPlayers.map(p => ({
            userId: p.id,
            totalPoints: 0,
            matchesWon: 0,
            matchesDrawn: 0,
            matchesLost: 0,
          }))
        }
      }
    });

    const matchDefs = [
      { r: 1, c: 1, a1: p1.id, a2: p2.id, b1: p3.id, b2: p4.id, sa: 21, sb: 15 },
      { r: 1, c: 2, a1: p5.id, a2: p6.id, b1: p7.id, b2: p8.id, sa: 21, sb: 17 },
      { r: 2, c: 1, a1: p1.id, a2: p3.id, b1: p2.id, b2: p4.id, sa: 21, sb: 19 },
      { r: 2, c: 2, a1: p5.id, a2: p7.id, b1: p6.id, b2: p8.id, sa: 21, sb: 14 },
      { r: 3, c: 1, a1: p1.id, a2: p4.id, b1: p2.id, b2: p3.id, sa: 21, sb: 16 },
      { r: 3, c: 2, a1: p6.id, a2: p7.id, b1: p5.id, b2: p8.id, sa: 21, sb: 18 },
      { r: 4, c: 1, a1: p1.id, a2: p5.id, b1: p2.id, b2: p6.id, sa: 21, sb: 18 },
      { r: 4, c: 2, a1: p3.id, a2: p7.id, b1: p4.id, b2: p8.id, sa: 21, sb: 15 },
      { r: 5, c: 1, a1: p1.id, a2: p6.id, b1: p2.id, b2: p5.id, sa: 21, sb: 19 },
      { r: 5, c: 2, a1: p3.id, a2: p8.id, b1: p4.id, b2: p7.id, sa: 21, sb: 17 },
      { r: 6, c: 1, a1: p2.id, a2: p8.id, b1: p1.id, b2: p7.id, sa: 21, sb: 16 },
      { r: 6, c: 2, a1: p3.id, a2: p6.id, b1: p4.id, b2: p5.id, sa: 21, sb: 19 },
      { r: 7, c: 1, a1: p2.id, a2: p7.id, b1: p3.id, b2: p5.id, sa: 21, sb: 17 },
      { r: 7, c: 2, a1: p4.id, a2: p6.id, b1: p1.id, b2: p8.id, sa: 21, sb: 18 },
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
        }
      });
    }

    await prisma.$transaction(async (tx) => {
      await recalculateTournamentStatsInternal(tx, createdTourney.id);
      if (league) {
        await syncLeagueEloInternal(tx, league.id);
      }
    });
  }

  // 4. Opprett Ordinære Kamper (Standalone Matches)
  const existingMatches = await prisma.standaloneMatch.findMany({ where: { accessCode: code } });
  if (existingMatches.length === 0 && p1 && p2 && p3 && p4 && p5 && p6 && p7 && p8) {
    const activeScores = JSON.stringify({
      sets: [
        { teamA: 6, teamB: 4 },
        { teamA: 4, teamB: 6 },
        { teamA: 5, teamB: 4 }
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
      }
    });

    await prisma.standaloneMatch.create({
      data: {
        name: 'Fredagsduell: Finale',
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
      }
    });

    const completedScores = JSON.stringify({
      sets: [
        { teamA: 6, teamB: 3 },
        { teamA: 6, teamB: 2 }
      ],
      currentSetIndex: 1,
      currentPoints: { teamA: '0', teamB: '0' },
      isTiebreak: false,
      tiebreakScores: { teamA: 0, teamB: 0 },
      servingTeam: 'A',
      servingPlayer: 1,
      history: [],
      events: [],
      gameScoresHistory: [],
      matchStats: {
        teamAPointsTotal: 48,
        teamBPointsTotal: 31,
        goldenPointsPlayed: 2,
        goldenPointsWonA: 2,
        goldenPointsWonB: 0,
        breakPointsA: 4,
        breakPointsB: 1,
        breakPointsConvertedA: 3,
        breakPointsConvertedB: 0,
      }
    });

    await prisma.standaloneMatch.create({
      data: {
        name: 'Treningskamp: Kristoffer & Jonas vs Fredrik & Sander',
        accessCode: code,
        teamAPlayer1: p5.name,
        teamAPlayer2: p6.name,
        teamBPlayer1: p7.name,
        teamBPlayer2: p8.name,
        teamAPlayer1Id: p5.id,
        teamAPlayer2Id: p6.id,
        teamBPlayer1Id: p7.id,
        teamBPlayer2Id: p8.id,
        format: 'BEST_OF_3',
        goldenPoint: true,
        scoresJson: completedScores,
        isCompleted: true,
        winnerTeam: 'A',
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
      }
    });
  }

  revalidatePath('/');
}

export async function resetTestProfileData() {
  const session = await getAuthSession();
  const targetCode = session.accessCode === 'ADMIN' ? 'test' : session.accessCode;
  await seedTestDataForCode(targetCode, true);
  return { success: true };
}

/* ==========================================================================
   SPILLERE (USERS)
   ========================================================================== */

export async function getPlayers() {
  const session = await getAuthSession();
  
  if (session.isAdmin) {
    return await prisma.user.findMany({
      where: { isArchived: false },
      orderBy: { name: 'asc' }
    });
  }

  // Sørg for at 'test'-profilen eller nye tomme profiler initialiseres
  if (session.accessCode === 'test' || session.accessCode === 'default') {
    const count = await prisma.user.count({
      where: { accessCode: session.accessCode }
    });
    if (count === 0) {
      await seedTestDataForCode(session.accessCode);
    }
  }

  return await prisma.user.findMany({
    where: { 
      accessCode: session.accessCode,
      isArchived: false
    },
    orderBy: { name: 'asc' }
  });
}

export async function getAllPlayersIncludingArchived() {
  const session = await getAuthSession();
  
  if (session.isAdmin) {
    return await prisma.user.findMany({
      orderBy: { name: 'asc' }
    });
  }

  return await prisma.user.findMany({
    where: { accessCode: session.accessCode },
    orderBy: { name: 'asc' }
  });
}

export async function addPlayer(name: string, customCode?: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Navn kan ikke være tomt');
  
  const session = await getAuthSession();
  const accessCode = customCode || session.accessCode || 'default';

  const player = await prisma.user.create({
    data: { 
      name: trimmed,
      accessCode,
      eloRating: DEFAULT_ELO,
      isArchived: false
    }
  });
  revalidatePath('/');
  return player;
}

export async function updatePlayerName(playerId: string, newName: string) {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Navn kan ikke være tomt');

  const updated = await prisma.user.update({
    where: { id: playerId },
    data: { name: trimmed }
  });
  revalidatePath('/');
  return updated;
}

export async function deletePlayer(playerId: string) {
  // Sjekk om spilleren har kamphistorikk
  const matchCount = await prisma.match.count({
    where: {
      OR: [
        { teamAPlayer1Id: playerId },
        { teamAPlayer2Id: playerId },
        { teamBPlayer1Id: playerId },
        { teamBPlayer2Id: playerId },
      ]
    }
  });

  if (matchCount > 0) {
    // Sett som arkivert slik at historikk bevares, men fjernes fra nye turneringer
    await prisma.user.update({
      where: { id: playerId },
      data: { isArchived: true }
    });
  } else {
    // Ingen kamper, trygt å slette helt
    await prisma.leagueMember.deleteMany({ where: { userId: playerId } });
    await prisma.tournamentParticipant.deleteMany({ where: { userId: playerId } });
    await prisma.user.delete({ where: { id: playerId } });
  }

  revalidatePath('/');
}

export async function getPlayerCareerStats(playerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: playerId },
    include: {
      leagueMemberships: {
        include: { league: true }
      }
    }
  });

  if (!user) return null;

  const matches = await prisma.match.findMany({
    where: {
      isCompleted: true,
      OR: [
        { teamAPlayer1Id: playerId },
        { teamAPlayer2Id: playerId },
        { teamBPlayer1Id: playerId },
        { teamBPlayer2Id: playerId },
      ]
    },
    include: {
      tournament: true,
      teamAPlayer1: true,
      teamAPlayer2: true,
      teamBPlayer1: true,
      teamBPlayer2: true,
    }
  });

  const tournamentEntries = await prisma.tournamentParticipant.findMany({
    where: { userId: playerId },
    include: {
      tournament: {
        include: {
          participants: {
            orderBy: { totalPoints: 'desc' }
          }
        }
      }
    },
    orderBy: { tournament: { createdAt: 'desc' } }
  });

  const tournamentHistory = tournamentEntries.map(entry => {
    const allInTourney = entry.tournament.participants || [];
    const placement = allInTourney.findIndex(p => p.userId === playerId) + 1;
    return {
      id: entry.tournament.id,
      name: entry.tournament.name,
      date: entry.tournament.createdAt,
      type: entry.tournament.type,
      totalPoints: entry.totalPoints,
      placement: placement > 0 ? placement : 1,
      totalParticipants: allInTourney.length,
      tournamentElo: Math.round(entry.tournamentElo * 10) / 10,
      initialElo: Math.round(entry.initialElo * 10) / 10,
      eloDelta: Math.round(entry.eloDelta * 10) / 10,
      matchesWon: entry.matchesWon,
      matchesDrawn: entry.matchesDrawn,
      matchesLost: entry.matchesLost,
    };
  });

  const bestTournamentElo = tournamentEntries.reduce((max, e) => Math.max(max, e.tournamentElo), DEFAULT_ELO);

  let totalPointsScored = 0;
  let totalPointsConceded = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;

  const partnerCounts: Record<string, { name: string; count: number; won: number }> = {};
  const opponentCounts: Record<string, { name: string; count: number }> = {};

  for (const m of matches) {
    const isTeamA = m.teamAPlayer1Id === playerId || m.teamAPlayer2Id === playerId;
    const myScore = isTeamA ? m.teamAScore : m.teamBScore;
    const oppScore = isTeamA ? m.teamBScore : m.teamAScore;

    totalPointsScored += myScore;
    totalPointsConceded += oppScore;

    const isWon = myScore > oppScore;
    const isDraw = myScore === oppScore;

    if (isWon) won++;
    else if (isDraw) drawn++;
    else lost++;

    // Partner
    const partner = isTeamA
      ? (m.teamAPlayer1Id === playerId ? m.teamAPlayer2 : m.teamAPlayer1)
      : (m.teamBPlayer1Id === playerId ? m.teamBPlayer2 : m.teamBPlayer1);

    if (partner) {
      if (!partnerCounts[partner.id]) {
        partnerCounts[partner.id] = { name: partner.name, count: 0, won: 0 };
      }
      partnerCounts[partner.id].count++;
      if (isWon) partnerCounts[partner.id].won++;
    }

    // Opponents
    const opponents = isTeamA
      ? [m.teamBPlayer1, m.teamBPlayer2]
      : [m.teamAPlayer1, m.teamAPlayer2];

    for (const opp of opponents) {
      if (opp) {
        if (!opponentCounts[opp.id]) {
          opponentCounts[opp.id] = { name: opp.name, count: 0 };
        }
        opponentCounts[opp.id].count++;
      }
    }
  }

  const matchesCount = matches.length;
  const winRate = matchesCount > 0 ? ((won + drawn * 0.5) / matchesCount) * 100 : 0;
  const avgPoints = matchesCount > 0 ? (totalPointsScored / matchesCount).toFixed(1) : '0.0';

  // Hent høyeste/beste Elo på tvers av medlemskap
  const bestElo = user.leagueMemberships.reduce((max, lm) => Math.max(max, lm.eloRating), user.eloRating || DEFAULT_ELO);

  // Analyser Drømmemakker, Kryptonitt og Formkurve
  const extendedStats = analyzePlayerExtendedStats(playerId, matches);

  return {
    user,
    eloRating: Math.round(bestElo * 10) / 10,
    totalElo: Math.round((user.eloRating || bestElo) * 10) / 10,
    bestTournamentElo: Math.round(bestTournamentElo * 10) / 10,
    tournamentHistory,
    tournamentsCount: tournamentEntries.length,
    matchesCount,
    won,
    drawn,
    lost,
    totalPointsScored,
    totalPointsConceded,
    pointDiff: totalPointsScored - totalPointsConceded,
    winRate: Number(winRate.toFixed(1)),
    avgPoints,
    partners: Object.entries(partnerCounts).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.count - a.count),
    opponents: Object.entries(opponentCounts).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.count - a.count),
    dreamPartner: extendedStats.dreamPartner,
    kryptonite: extendedStats.kryptonite,
    formCurve: extendedStats.formCurve,
    currentStreak: extendedStats.currentStreak,
  };
}

/* ==========================================================================
   LIGAER (LEAGUES) & ELO REKALKULERING
   ========================================================================== */

export async function getLeagues() {
  const session = await getAuthSession();

  const whereClause: any = session.isAdmin
    ? {}
    : { accessCode: session.accessCode };

  return await prisma.league.findMany({
    where: whereClause,
    include: {
      members: {
        include: { user: true }
      },
      tournaments: {
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: {
          participants: {
            include: { user: true },
            orderBy: { totalPoints: 'desc' }
          },
          matches: {
            orderBy: { date: 'asc' }
          }
        }
      }
    },
    orderBy: [
      { isArchived: 'asc' },
      { createdAt: 'desc' }
    ]
  });
}

export async function createLeague(
  name: string, 
  description?: string, 
  memberIds: string[] = [],
  defaultTargetScore: number = 21
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Liganavn kan ikke være tomt');

  const session = await getAuthSession();

  const league = await prisma.league.create({
    data: {
      name: trimmed,
      description: description?.trim() || null,
      defaultTargetScore: Number(defaultTargetScore) || 21,
      isArchived: false,
      accessCode: session.accessCode,
      members: {
        create: memberIds.map(userId => ({ 
          userId,
          eloRating: DEFAULT_ELO,
          highestElo: DEFAULT_ELO,
          lowestElo: DEFAULT_ELO
        }))
      }
    },
    include: {
      members: {
        include: { user: true }
      }
    }
  });

  revalidatePath('/');
  return league;
}

export async function archiveLeague(leagueId: string) {
  await prisma.league.update({
    where: { id: leagueId },
    data: { 
      isArchived: true,
      completedAt: new Date()
    }
  });
  revalidatePath('/');
}

export async function unarchiveLeague(leagueId: string) {
  await prisma.league.update({
    where: { id: leagueId },
    data: { 
      isArchived: false,
      completedAt: null
    }
  });
  revalidatePath('/');
}

export async function renameLeague(leagueId: string, newName: string) {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Liganavn kan ikke være tomt');
  
  const league = await prisma.league.update({
    where: { id: leagueId },
    data: { name: trimmed }
  });
  revalidatePath('/');
  return league;
}

export async function updateLeagueTargetScore(leagueId: string, targetScore: number) {
  if (targetScore < 1 || targetScore > 200) {
    throw new Error('Målscore må være mellom 1 og 200');
  }
  
  const league = await prisma.league.update({
    where: { id: leagueId },
    data: { defaultTargetScore: targetScore }
  });
  revalidatePath('/');
  return league;
}

export async function deleteLeague(leagueId: string) {
  try {
    const session = await getAuthSession();
    if (!session.isAdmin) {
      return { success: false, error: 'Kun administrator kan slette en liga.' };
    }
    await prisma.$transaction(async (tx) => {
      const tourneys = await tx.tournament.findMany({ where: { leagueId } });
      for (const t of tourneys) {
        await tx.match.deleteMany({ where: { tournamentId: t.id } });
        await tx.tournamentParticipant.deleteMany({ where: { tournamentId: t.id } });
      }
      await tx.tournament.deleteMany({ where: { leagueId } });
      await tx.leagueMember.deleteMany({ where: { leagueId } });
      await tx.league.delete({ where: { id: leagueId } });
    });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete league:', error);
    return { success: false, error: error.message || 'Kunne ikke slette liga' };
  }
}

export async function addMemberToLeague(leagueId: string, userId: string) {
  const exists = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } }
  });
  if (!exists) {
    await prisma.leagueMember.create({
      data: { 
        leagueId, 
        userId,
        eloRating: DEFAULT_ELO,
        highestElo: DEFAULT_ELO,
        lowestElo: DEFAULT_ELO
      }
    });
  }
  revalidatePath('/');
}

export async function removeMemberFromLeague(leagueId: string, userId: string) {
  await prisma.leagueMember.deleteMany({
    where: { leagueId, userId }
  });
  revalidatePath('/');
}

/**
 * Henter og beregner fullstendig ligastatistikk med Score-vektet Elo-rating
 * og normaliserte prosentpoeng som sekundære kriterier.
 */
export async function getLeagueStats(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: { include: { user: true } },
      tournaments: {
        include: {
          matches: {
            where: { isCompleted: true },
            include: {
              teamAPlayer1: true,
              teamAPlayer2: true,
              teamBPlayer1: true,
              teamBPlayer2: true,
            }
          },
          participants: {
            include: { user: true }
          }
        }
      }
    }
  });

  if (!league) return null;

  const playerMap = new Map<string, { user: any; isMember: boolean }>();
  for (const m of league.members) {
    playerMap.set(m.userId, { user: m.user, isMember: true });
  }
  for (const t of league.tournaments) {
    for (const p of t.participants) {
      if (!playerMap.has(p.userId)) {
        playerMap.set(p.userId, { user: p.user, isMember: false });
      }
    }
  }

  // Kjør deterministisk Elo-replay over alle ligakamper
  const memberIds = Array.from(playerMap.keys());
  const { playerStats: eloStatsMap, processedMatches } = replayLeagueMatchesElo(
    memberIds,
    league.tournaments.map(t => ({
      id: t.id,
      name: t.name,
      targetScore: t.targetScore || 21,
      matches: t.matches
    }))
  );

  const playerStats: Record<string, {
    userId: string;
    user: any;
    isMember: boolean;
    tournamentsPlayed: number;
    matchesPlayed: number;
    matchesWon: number;
    matchesDrawn: number;
    matchesLost: number;
    totalPoints: number;
    pointsConceded: number;
    pointPercentages: number[];
    eloRating: number;
    highestElo: number;
    lowestElo: number;
    eloHistory: any[];
  }> = {};

  for (const [userId, info] of playerMap.entries()) {
    const eloInfo = eloStatsMap[userId] || {
      currentElo: DEFAULT_ELO,
      highestElo: DEFAULT_ELO,
      lowestElo: DEFAULT_ELO,
      history: []
    };

    playerStats[userId] = {
      userId,
      user: info.user,
      isMember: info.isMember,
      tournamentsPlayed: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesDrawn: 0,
      matchesLost: 0,
      totalPoints: 0,
      pointsConceded: 0,
      pointPercentages: [],
      eloRating: Math.round(eloInfo.currentElo * 10) / 10,
      highestElo: Math.round(eloInfo.highestElo * 10) / 10,
      lowestElo: Math.round(eloInfo.lowestElo * 10) / 10,
      eloHistory: eloInfo.history
    };
  }

  for (const tourney of league.tournaments) {
    for (const p of tourney.participants) {
      if (playerStats[p.userId]) {
        playerStats[p.userId].tournamentsPlayed++;
      }
    }

    const completedMatches = tourney.matches;
    for (const m of completedMatches) {
      const sA = m.teamAScore;
      const sB = m.teamBScore;
      
      // Hver kamp regnes ut mot sin egen spesifikke targetScore (summen av poengene),
      // slik at endringer midt i turneringen (f.eks. halvering) håndteres riktig per kamp.
      const matchTargetScore = (sA + sB) > 0 ? (sA + sB) : (tourney.targetScore || 21);

      const isA1 = m.teamAPlayer1Id;
      const isA2 = m.teamAPlayer2Id;
      const isB1 = m.teamBPlayer1Id;
      const isB2 = m.teamBPlayer2Id;

      const isDraw = sA === sB;
      const isAWon = sA > sB;
      const isBWon = sB > sA;

      const recordMatch = (pid: string, myScore: number, oppScore: number, won: boolean, drawn: boolean, lost: boolean) => {
        if (!playerStats[pid]) return;
        const st = playerStats[pid];
        st.matchesPlayed++;
        st.totalPoints += myScore;
        st.pointsConceded += oppScore;
        if (won) st.matchesWon++;
        else if (drawn) st.matchesDrawn++;
        else if (lost) st.matchesLost++;

        const matchPct = matchTargetScore > 0 ? Math.min(100, (myScore / matchTargetScore) * 100) : 50;
        st.pointPercentages.push(matchPct);
      };

      recordMatch(isA1, sA, sB, isAWon, isDraw, isBWon);
      recordMatch(isA2, sA, sB, isAWon, isDraw, isBWon);
      recordMatch(isB1, sB, sA, isBWon, isDraw, isAWon);
      recordMatch(isB2, sB, sA, isBWon, isDraw, isAWon);
    }
  }

  // Sorter primært etter Elo-rating, med prosentpoeng og vinnerrate som sekundære tie-breakers
  const leaderboard = Object.values(playerStats).map(st => {
    const avgPointPct = st.pointPercentages.length > 0
      ? (st.pointPercentages.reduce((a, b) => a + b, 0) / st.pointPercentages.length)
      : 0;

    const winRatePct = st.matchesPlayed > 0
      ? ((st.matchesWon + (st.matchesDrawn * 0.5)) / st.matchesPlayed) * 100
      : 0;

    const pointDiff = st.totalPoints - st.pointsConceded;
    const avgPoints = st.matchesPlayed > 0 ? (st.totalPoints / st.matchesPlayed).toFixed(1) : '0.0';

    return {
      ...st,
      avgPointPct: Number(avgPointPct.toFixed(1)),
      winRatePct: Number(winRatePct.toFixed(1)),
      pointDiff,
      avgPoints
    };
  }).sort((a, b) => {
    // 1. Primær: Elo-rating
    if (b.eloRating !== a.eloRating) return b.eloRating - a.eloRating;
    // 2. Sekundær: Gjennomsnittlig poeng-%
    if (b.avgPointPct !== a.avgPointPct) return b.avgPointPct - a.avgPointPct;
    // 3. Tertiær: Seiersprosent
    if (b.winRatePct !== a.winRatePct) return b.winRatePct - a.winRatePct;
    // 4. Antall seire
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    // 5. Målforskjell
    return b.pointDiff - a.pointDiff;
  });

  return {
    league,
    leaderboard
  };
}

/* ==========================================================================
   TURNERINGER (TOURNAMENTS)
   ========================================================================== */

export async function getActiveTournament() {
  const session = await getAuthSession();

  const whereClause: any = {
    isActive: true,
    isArchived: false,
  };

  if (!session.isAdmin) {
    whereClause.accessCode = session.accessCode;
  }

  return await prisma.tournament.findFirst({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      league: true,
      participants: {
        include: { user: true },
        orderBy: { totalPoints: 'desc' }
      },
      matches: {
        include: {
          teamAPlayer1: true,
          teamAPlayer2: true,
          teamBPlayer1: true,
          teamBPlayer2: true,
        },
        orderBy: [
          { isCompleted: 'asc' },
          { startedAt: 'asc' }
        ]
      }
    }
  });
}

export async function getTournamentHistory() {
  const session = await getAuthSession();

  const whereClause: any = {
    isActive: false,
  };

  if (!session.isAdmin) {
    whereClause.accessCode = session.accessCode;
  }

  const tournaments = await prisma.tournament.findMany({
    where: whereClause,
    orderBy: [
      { isArchived: 'asc' },
      { createdAt: 'desc' }
    ],
    include: {
      league: true,
      participants: {
        include: { user: true },
        orderBy: { totalPoints: 'desc' }
      },
      matches: {
        where: { isCompleted: true },
        orderBy: { startedAt: 'asc' },
        include: {
          teamAPlayer1: true,
          teamAPlayer2: true,
          teamBPlayer1: true,
          teamBPlayer2: true,
        }
      }
    }
  });

  return tournaments.map(t => {
    let totalMinutes = 0;
    let timedMatchesCount = 0;

    for (const m of t.matches) {
      if (m.startedAt && m.completedAt) {
        const diffMs = new Date(m.completedAt).getTime() - new Date(m.startedAt).getTime();
        const durationMin = Math.max(1, Math.round(diffMs / 60000));
        if (durationMin > 0 && durationMin < 180) {
          totalMinutes += durationMin;
          timedMatchesCount++;
        }
      }
    }

    const avgMatchDurationMinutes = timedMatchesCount > 0 
      ? Math.round(totalMinutes / timedMatchesCount) 
      : (t.matches.length > 0 ? 12 : 0);

    return {
      ...t,
      avgMatchDurationMinutes,
      totalDurationMinutes: totalMinutes > 0 ? totalMinutes : t.matches.length * 12
    };
  });
}

export async function getTournamentDetails(tournamentId: string) {
  const tourney = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      league: true,
      participants: {
        include: { user: true },
        orderBy: { totalPoints: 'desc' }
      },
      matches: {
        include: {
          teamAPlayer1: true,
          teamAPlayer2: true,
          teamBPlayer1: true,
          teamBPlayer2: true,
        },
        orderBy: { startedAt: 'asc' }
      }
    }
  });

  if (!tourney) return null;

  let totalMinutes = 0;
  let timedMatchesCount = 0;

  for (const m of tourney.matches) {
    if (m.startedAt && m.completedAt) {
      const diffMs = new Date(m.completedAt).getTime() - new Date(m.startedAt).getTime();
      const durationMin = Math.max(1, Math.round(diffMs / 60000));
      if (durationMin > 0 && durationMin < 180) {
        totalMinutes += durationMin;
        timedMatchesCount++;
      }
    }
  }

  const avgMatchDurationMinutes = timedMatchesCount > 0 
    ? Math.round(totalMinutes / timedMatchesCount) 
    : (tourney.matches.length > 0 ? 12 : 0);

  return {
    ...tourney,
    avgMatchDurationMinutes,
    totalDurationMinutes: totalMinutes > 0 ? totalMinutes : tourney.matches.length * 12
  };
}

/**
 * Intern hjelper for å trekke kamper inne i en Prisma-transaksjon.
 */
async function drawMatchesInternal(
  tx: any, 
  tournamentId: string, 
  desiredCourts: number
): Promise<{ success: boolean; error?: string; matches: any[]; drawnCourts: number; warning: string | null }> {
  const tourney = await tx.tournament.findUnique({
    where: { id: tournamentId }
  });
  if (!tourney) return { success: false, error: 'Turnering ikke funnet', matches: [], drawnCourts: 0, warning: null };

  const activePlayers = await tx.tournamentParticipant.findMany({
    where: { 
      tournamentId,
      isPaused: false
    },
    include: { user: true }
  });

  const pausedPlayers = await tx.tournamentParticipant.findMany({
    where: { 
      tournamentId,
      isPaused: true
    }
  });

  if (activePlayers.length < 4) {
    return {
      success: false,
      error: `For få aktive spillere (${activePlayers.length}/4). Slå av pause på spillere eller legg til flere deltakere.`,
      matches: [],
      drawnCourts: 0,
      warning: null
    };
  }

  const maxPossibleCourts = Math.floor(activePlayers.length / 4);
  const courtsToDraw = Math.min(desiredCourts, maxPossibleCourts);

  if (courtsToDraw < 1) {
    return {
      success: false,
      error: `Minst 4 spillere må være aktive for å trekke en kamp.`,
      matches: [],
      drawnCourts: 0,
      warning: null
    };
  }

  // Hent alle gyldige kamper i turneringen (ikke kansellerte)
  const allMatches = await tx.match.findMany({
    where: { 
      tournamentId,
      status: { not: 'CANCELLED' }
    }
  });

  // Bygg historikk for makkere, motstandere, faktisk spilte kamper og sit-out rotasjon
  const actualMatchesPlayed: Record<string, number> = {};
  const lastPlayedOrder: Record<string, number> = {};
  const lastSitOutOrder: Record<string, number> = {};
  const partnerMatrix: Record<string, Record<string, number>> = {};
  const opponentMatrix: Record<string, Record<string, number>> = {};

  for (const p of activePlayers) {
    actualMatchesPlayed[p.userId] = 0;
    lastPlayedOrder[p.userId] = 0;
    lastSitOutOrder[p.userId] = 0;
    partnerMatrix[p.userId] = {};
    opponentMatrix[p.userId] = {};
    for (const p2 of activePlayers) {
      partnerMatrix[p.userId][p2.userId] = 0;
      opponentMatrix[p.userId][p2.userId] = 0;
    }
  }

  // Sorter allMatches kronologisk for å spore nøyaktig rekkefølge
  const sortedMatches = [...allMatches].sort((a: any, b: any) => {
    return new Date(a.startedAt || a.date || a.createdAt).getTime() - new Date(b.startedAt || b.date || b.createdAt).getTime();
  });

  let matchIndex = 0;
  for (const m of sortedMatches) {
    matchIndex++;
    const a1 = m.teamAPlayer1Id;
    const a2 = m.teamAPlayer2Id;
    const b1 = m.teamBPlayer1Id;
    const b2 = m.teamBPlayer2Id;

    const playingSet = new Set([a1, a2, b1, b2].filter(Boolean));

    for (const pid of playingSet) {
      if (actualMatchesPlayed[pid] !== undefined) {
        actualMatchesPlayed[pid]++;
        lastPlayedOrder[pid] = matchIndex;
      }
    }

    for (const p of activePlayers) {
      if (!playingSet.has(p.userId)) {
        lastSitOutOrder[p.userId] = matchIndex;
      }
    }

    const registerPartner = (p1: string, p2: string) => {
      if (partnerMatrix[p1]?.[p2] !== undefined) partnerMatrix[p1][p2]++;
      if (partnerMatrix[p2]?.[p1] !== undefined) partnerMatrix[p2][p1]++;
    };
    if (a1 && a2) registerPartner(a1, a2);
    if (b1 && b2) registerPartner(b1, b2);

    const registerOpponent = (p1: string, p2: string) => {
      if (opponentMatrix[p1]?.[p2] !== undefined) opponentMatrix[p1][p2]++;
      if (opponentMatrix[p2]?.[p1] !== undefined) opponentMatrix[p2][p1]++;
    };
    if (a1 && b1) registerOpponent(a1, b1);
    if (a1 && b2) registerOpponent(a1, b2);
    if (a2 && b1) registerOpponent(a2, b1);
    if (a2 && b2) registerOpponent(a2, b2);
  }

  // RETTFERDIG UTVALG AV SPILLERE:
  // 1. actualMatchesPlayed ascending (færrest kamper spilt SKAL velges først)
  // 2. lastPlayedOrder ascending (spilte lengst tilbake i tid / satt over sist)
  // 3. lastSitOutOrder descending (satt over nyligst)
  // 4. deterministisk fallback
  const sortedPool = [...activePlayers].sort((a: any, b: any) => {
    const cA = actualMatchesPlayed[a.userId] || 0;
    const cB = actualMatchesPlayed[b.userId] || 0;
    if (cA !== cB) return cA - cB;

    const lpA = lastPlayedOrder[a.userId] || 0;
    const lpB = lastPlayedOrder[b.userId] || 0;
    if (lpA !== lpB) return lpA - lpB;

    const lsA = lastSitOutOrder[a.userId] || 0;
    const lsB = lastSitOutOrder[b.userId] || 0;
    if (lsA !== lsB) return lsB - lsA;

    return a.userId.localeCompare(b.userId);
  });

  const totalPlayersNeeded = courtsToDraw * 4;
  const selectedPlayers = sortedPool.slice(0, totalPlayersNeeded);
  const selectedIds = selectedPlayers.map((p: any) => p.userId);

  const createdMatches: any[] = [];
  const now = new Date();
  const isMexicano = tourney.type === 'MEXICANO';
  const hasCompletedMatches = allMatches.some((m: any) => m.isCompleted);

  if (isMexicano && hasCompletedMatches) {
    // MEXICANO: Sorter utvalgte spillere etter poeng og fordel lagvis per bane
    const rankedSelected = [...selectedPlayers].sort((a: any, b: any) => (b.totalPoints || 0) - (a.totalPoints || 0));
    
    for (let court = 1; court <= courtsToDraw; court++) {
      const offset = (court - 1) * 4;
      const courtPlayers = rankedSelected.slice(offset, offset + 4);
      if (courtPlayers.length < 4) break;

      const p0 = courtPlayers[0].userId; // Rank 1
      const p1 = courtPlayers[1].userId; // Rank 2
      const p2 = courtPlayers[2].userId; // Rank 3
      const p3 = courtPlayers[3].userId; // Rank 4

      // Rank 1 + 3 vs Rank 2 + 4
      const m = await tx.match.create({
        data: {
          tournamentId,
          courtNumber: court,
          status: 'PENDING',
          version: 1,
          startedAt: now,
          date: now,
          isCompleted: false,
          teamAPlayer1Id: p0,
          teamAPlayer2Id: p2,
          teamBPlayer1Id: p1,
          teamBPlayer2Id: p3,
        },
        include: {
          teamAPlayer1: true,
          teamAPlayer2: true,
          teamBPlayer1: true,
          teamBPlayer2: true,
        }
      });
      createdMatches.push(m);
    }
  } else {
    // AMERICANO (eller Mexicano runde 1):
    // Finn optimal fordeling av makkere og baner som minimerer gjentatte partnerskap
    const evaluatePairing = (a1: string, a2: string, b1: string, b2: string) => {
      const partA = partnerMatrix[a1]?.[a2] || 0;
      const partB = partnerMatrix[b1]?.[b2] || 0;
      const oppA1B1 = opponentMatrix[a1]?.[b1] || 0;
      const oppA1B2 = opponentMatrix[a1]?.[b2] || 0;
      const oppA2B1 = opponentMatrix[a2]?.[b1] || 0;
      const oppA2B2 = opponentMatrix[a2]?.[b2] || 0;

      const partnerPenalty = (partA * partA + partB * partB) * 10000;
      const oppPenalty = (oppA1B1 + oppA1B2 + oppA2B1 + oppA2B2) * 50;
      return partnerPenalty + oppPenalty;
    };

    const findBestPairingFor4 = (fourIds: string[]) => {
      const [p0, p1, p2, p3] = fourIds;
      const options = [
        { a1: p0, a2: p1, b1: p2, b2: p3, cost: evaluatePairing(p0, p1, p2, p3) },
        { a1: p0, a2: p2, b1: p1, b2: p3, cost: evaluatePairing(p0, p2, p1, p3) },
        { a1: p0, a2: p3, b1: p1, b2: p2, cost: evaluatePairing(p0, p3, p1, p2) }
      ];
      options.sort((x, y) => x.cost - y.cost);
      return options[0];
    };

    if (courtsToDraw === 1) {
      const best = findBestPairingFor4(selectedIds);
      const m = await tx.match.create({
        data: {
          tournamentId,
          courtNumber: 1,
          status: 'PENDING',
          version: 1,
          startedAt: now,
          date: now,
          isCompleted: false,
          teamAPlayer1Id: best.a1,
          teamAPlayer2Id: best.a2,
          teamBPlayer1Id: best.b1,
          teamBPlayer2Id: best.b2,
        },
        include: {
          teamAPlayer1: true,
          teamAPlayer2: true,
          teamBPlayer1: true,
          teamBPlayer2: true,
        }
      });
      createdMatches.push(m);
    } else if (courtsToDraw === 2) {
      // 8 spillere: 35 partisjoner i 2 baner
      let bestCombinedCost = Infinity;
      let bestCourt1: any = null;
      let bestCourt2: any = null;

      const ids = selectedIds;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          for (let k = j + 1; k < ids.length; k++) {
            for (let l = k + 1; l < ids.length; l++) {
              const c1 = [ids[i], ids[j], ids[k], ids[l]];
              const c2 = ids.filter(id => !c1.includes(id));
              const pair1 = findBestPairingFor4(c1);
              const pair2 = findBestPairingFor4(c2);
              const totalCost = pair1.cost + pair2.cost;
              if (totalCost < bestCombinedCost) {
                bestCombinedCost = totalCost;
                bestCourt1 = pair1;
                bestCourt2 = pair2;
              }
            }
          }
        }
      }

      if (!bestCourt1) {
        bestCourt1 = findBestPairingFor4(ids.slice(0, 4));
        bestCourt2 = findBestPairingFor4(ids.slice(4, 8));
      }

      const m1 = await tx.match.create({
        data: {
          tournamentId,
          courtNumber: 1,
          status: 'PENDING',
          version: 1,
          startedAt: now,
          date: now,
          isCompleted: false,
          teamAPlayer1Id: bestCourt1.a1,
          teamAPlayer2Id: bestCourt1.a2,
          teamBPlayer1Id: bestCourt1.b1,
          teamBPlayer2Id: bestCourt1.b2,
        },
        include: {
          teamAPlayer1: true,
          teamAPlayer2: true,
          teamBPlayer1: true,
          teamBPlayer2: true,
        }
      });
      createdMatches.push(m1);

      const m2 = await tx.match.create({
        data: {
          tournamentId,
          courtNumber: 2,
          status: 'PENDING',
          version: 1,
          startedAt: now,
          date: now,
          isCompleted: false,
          teamAPlayer1Id: bestCourt2.a1,
          teamAPlayer2Id: bestCourt2.a2,
          teamBPlayer1Id: bestCourt2.b1,
          teamBPlayer2Id: bestCourt2.b2,
        },
        include: {
          teamAPlayer1: true,
          teamAPlayer2: true,
          teamBPlayer1: true,
          teamBPlayer2: true,
        }
      });
      createdMatches.push(m2);
    } else {
      // 3+ baner: optimal per bane
      let remainingIds = [...selectedIds];
      for (let court = 1; court <= courtsToDraw; court++) {
        if (remainingIds.length < 4) break;
        const courtIds = remainingIds.slice(0, 4);
        remainingIds = remainingIds.slice(4);
        const best = findBestPairingFor4(courtIds);
        const m = await tx.match.create({
          data: {
            tournamentId,
            courtNumber: court,
            status: 'PENDING',
            version: 1,
            startedAt: now,
            date: now,
            isCompleted: false,
            teamAPlayer1Id: best.a1,
            teamAPlayer2Id: best.a2,
            teamBPlayer1Id: best.b1,
            teamBPlayer2Id: best.b2,
          },
          include: {
            teamAPlayer1: true,
            teamAPlayer2: true,
            teamBPlayer1: true,
            teamBPlayer2: true,
          }
        });
        createdMatches.push(m);
      }
    }
  }

  // Hvis det er pausede spillere, oppdater pausedCount i databasen for visning i UI
  if (createdMatches.length > 0 && pausedPlayers.length > 0) {
    for (const p of pausedPlayers) {
      await tx.tournamentParticipant.update({
        where: { id: p.id },
        data: { pausedCount: { increment: 1 } }
      });
    }
  }

  let warning: string | null = null;
  if (desiredCourts > courtsToDraw) {
    warning = `Trakk kamper for ${courtsToDraw} bane(r). Krever minst ${desiredCourts * 4} aktive spillere for ${desiredCourts} baner.`;
  }

  return { 
    success: true, 
    matches: createdMatches,
    drawnCourts: courtsToDraw,
    warning 
  };
}

export async function createTournament({
  name,
  leagueId,
  type = 'AMERICANO',
  targetScore = 21,
  courtCount = 1,
  playerIds,
  scheduledDate
}: {
  name?: string;
  leagueId?: string | null;
  type?: string;
  targetScore?: number;
  courtCount?: number;
  playerIds: string[];
  scheduledDate?: string | Date | null;
}) {
  const session = await getAuthSession();
  const accessCode = session.accessCode;

  const tourneyDate = scheduledDate ? new Date(scheduledDate) : new Date();

  const tournament = await prisma.$transaction(async (tx) => {
    // Avslutt eksisterende aktive turneringer for denne profilen først
    await tx.tournament.updateMany({
      where: { 
        isActive: true,
        ...(session.isAdmin ? {} : { accessCode })
      },
      data: { isActive: false, completedAt: new Date() }
    });

    let finalName = name?.trim();
    if (!finalName) {
      const startOfDay = new Date(tourneyDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(tourneyDate);
      endOfDay.setHours(23, 59, 59, 999);

      const dateStr = tourneyDate.toLocaleDateString('no-NB', { day: '2-digit', month: '2-digit', year: 'numeric' });

      if (leagueId) {
        const league = await tx.league.findUnique({ where: { id: leagueId } });
        const leagueTourneyCount = await tx.tournament.count({ where: { leagueId } });
        finalName = `${league?.name || 'Liga'} - Runde ${leagueTourneyCount + 1} (${dateStr})`;
      } else {
        const standaloneCount = await tx.tournament.count({
          where: { 
            leagueId: null, 
            accessCode,
            createdAt: { gte: startOfDay, lte: endOfDay } 
          }
        });
        finalName = `Enkeltturnering ${dateStr} #${standaloneCount + 1}`;
      }
    }

    const courts = Math.min(3, Math.max(1, Number(courtCount) || 1));

    const createdTourney = await tx.tournament.create({
      data: {
        name: finalName,
        leagueId: leagueId || null,
        type: type || 'AMERICANO',
        courtCount: courts,
        targetScore: Number(targetScore) || 21,
        originalTargetScore: null,
        isActive: true,
        isArchived: false,
        accessCode,
        createdAt: tourneyDate,
        participants: {
          create: playerIds.map(id => ({
            userId: id,
            isPaused: false,
            pausedCount: 0,
            totalPoints: 0,
            matchesWon: 0,
            matchesDrawn: 0,
            matchesLost: 0,
          }))
        }
      }
    });

    // Ikke trekk kamper automatisk – vent til brukeren trykker på "Trekk kamp"
    return await tx.tournament.findUnique({
      where: { id: createdTourney.id },
      include: {
        league: true,
        participants: { 
          include: { user: true },
          orderBy: { totalPoints: 'desc' }
        },
        matches: {
          include: {
            teamAPlayer1: true,
            teamAPlayer2: true,
            teamBPlayer1: true,
            teamBPlayer2: true,
          },
          orderBy: [
            { isCompleted: 'asc' },
            { startedAt: 'asc' }
          ]
        }
      }
    });
  });

  revalidatePath('/');
  return tournament;
}

export async function endActiveTournament(tournamentId?: string) {
  if (tournamentId) {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { isActive: false, completedAt: new Date() }
    });
  } else {
    const session = await getAuthSession();
    await prisma.tournament.updateMany({
      where: { 
        isActive: true,
        ...(session.isAdmin ? {} : { accessCode: session.accessCode })
      },
      data: { isActive: false, completedAt: new Date() }
    });
  }
  revalidatePath('/');
}

export async function reopenTournament(tournamentId: string) {
  try {
    const tourney = await prisma.tournament.findUnique({
      where: { id: tournamentId }
    });
    if (!tourney) return { success: false, error: 'Turnering ikke funnet' };

    const session = await getAuthSession();

    // Vanlige brukere kan kun gjenåpne turneringer fra samme dag. Ingen begrensning for admin.
    if (!session.isAdmin) {
      const now = new Date();
      const createdDate = new Date(tourney.createdAt);
      const completedDate = tourney.completedAt ? new Date(tourney.completedAt) : null;

      const isSameCreatedDay = 
        now.getFullYear() === createdDate.getFullYear() &&
        now.getMonth() === createdDate.getMonth() &&
        now.getDate() === createdDate.getDate();

      const isSameCompletedDay = completedDate ? (
        now.getFullYear() === completedDate.getFullYear() &&
        now.getMonth() === completedDate.getMonth() &&
        now.getDate() === completedDate.getDate()
      ) : false;

      if (!isSameCreatedDay && !isSameCompletedDay) {
        return { 
          success: false, 
          error: 'Vanlige brukere kan kun gjenåpne turneringer fra samme dag. Kontakt administrator for eldre turneringer.' 
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      // Deaktiver andre aktive turneringer først
      await tx.tournament.updateMany({
        where: { 
          isActive: true,
          ...(session.isAdmin ? {} : { accessCode: session.accessCode })
        },
        data: { isActive: false }
      });

      // Sett denne som aktiv igjen og opphev eventuell arkivering
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { 
          isActive: true,
          isArchived: false,
          completedAt: null
        }
      });
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to reopen tournament:', error);
    return { success: false, error: error.message || 'Kunne ikke gjenåpne turnering' };
  }
}

export async function archiveTournament(tournamentId: string) {
  try {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { 
        isArchived: true,
        isActive: false
      }
    });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function unarchiveTournament(tournamentId: string) {
  try {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { 
        isArchived: false
      }
    });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteTournament(tournamentId: string) {
  try {
    const session = await getAuthSession();
    
    // Sjekk tilgang: Admin kan alltid slette, vanlige brukere kan slette turneringer opprettet samme dag for sin profil
    if (!session.isAdmin) {
      const tourney = await prisma.tournament.findUnique({
        where: { id: tournamentId }
      });

      if (!tourney) {
        return { success: false, error: 'Turneringen ble ikke funnet.' };
      }

      if (tourney.accessCode !== session.accessCode) {
        return { success: false, error: 'Du har ikke tilgang til denne turneringen.' };
      }

      const today = new Date();
      const createdDate = new Date(tourney.createdAt);
      const isSameCreatedDay = 
        today.getFullYear() === createdDate.getFullYear() &&
        today.getMonth() === createdDate.getMonth() &&
        today.getDate() === createdDate.getDate();

      const completedDate = tourney.completedAt ? new Date(tourney.completedAt) : null;
      const isSameCompletedDay = completedDate ? (
        today.getFullYear() === completedDate.getFullYear() &&
        today.getMonth() === completedDate.getMonth() &&
        today.getDate() === completedDate.getDate()
      ) : false;

      if (!isSameCreatedDay && !isSameCompletedDay) {
        return { 
          success: false, 
          error: 'Du kan kun slette turneringer opprettet samme dag. Kontakt administrator for eldre turneringer.' 
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({ where: { tournamentId } });
      await tx.tournamentParticipant.deleteMany({ where: { tournamentId } });
      await tx.tournament.delete({ where: { id: tournamentId } });
    });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete tournament:', error);
    return { success: false, error: error.message || 'Kunne ikke slette turnering' };
  }
}

export async function deleteAllTournaments() {
  try {
    const session = await getAuthSession();
    if (!session.isAdmin) {
      return { success: false, error: 'Kun administrator har tillatelse til å slette alle turneringer.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({});
      await tx.tournamentParticipant.deleteMany({});
      await tx.tournament.deleteMany({});
    });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete all tournaments:', error);
    return { success: false, error: error.message || 'Kunne ikke slette turneringer' };
  }
}

export async function deleteAllData() {
  try {
    const session = await getAuthSession();
    if (!session.isAdmin) {
      return { success: false, error: 'Kun administrator har tillatelse til å nullstille alle data.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({});
      await tx.tournamentParticipant.deleteMany({});
      await tx.tournament.deleteMany({});
      await tx.leagueMember.deleteMany({});
      await tx.league.deleteMany({});
      await tx.user.deleteMany({});
    });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete all data:', error);
    return { success: false, error: error.message || 'Kunne ikke nullstille databasen' };
  }
}

export async function addPlayersToTournament(tournamentId: string, playerIds: string[]) {
  const completedMatchesCount = await prisma.match.count({
    where: { tournamentId, isCompleted: true }
  });

  const existingParticipants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId }
  });

  const roundsPlayedSoFar = existingParticipants.length > 0
    ? Math.max(0, Math.floor((completedMatchesCount * 4) / existingParticipants.length))
    : 0;

  for (const userId of playerIds) {
    const exists = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } }
    });
    if (!exists) {
      await prisma.tournamentParticipant.create({
        data: {
          tournamentId,
          userId,
          isPaused: false,
          pausedCount: roundsPlayedSoFar,
          totalPoints: 0,
          matchesWon: 0,
          matchesDrawn: 0,
          matchesLost: 0
        }
      });
    }
  }
  revalidatePath('/');
}

export async function togglePlayerPause(tournamentId: string, userId: string) {
  const participant = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } }
  });
  if (!participant) return;

  await prisma.tournamentParticipant.update({
    where: { id: participant.id },
    data: { isPaused: !participant.isPaused }
  });

  revalidatePath('/');
}

export async function toggleHalvePoints(tournamentId: string) {
  const tourney = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tourney) return;

  if (tourney.originalTargetScore == null) {
    const halved = Math.max(1, Math.round(tourney.targetScore / 2));
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        originalTargetScore: tourney.targetScore,
        targetScore: halved
      }
    });
  } else {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        targetScore: tourney.originalTargetScore,
        originalTargetScore: null
      }
    });
  }

  revalidatePath('/');
}

/**
 * Trekker kamper for en runde (1-3 baner).
 * Beskyttet av atomisk transaksjon for å hindre overlappende trekninger.
 */
export async function drawNextMatches(
  tournamentId: string, 
  overrideCourts?: number
): Promise<{ success: boolean; error?: string; matches: any[]; drawnCourts: number; warning: string | null }> {
  const result = await prisma.$transaction(async (tx) => {
    const tourney = await tx.tournament.findUnique({
      where: { id: tournamentId }
    });
    if (!tourney) return { success: false, error: 'Turnering ikke funnet', matches: [], drawnCourts: 0, warning: null };

    const desiredCourts = overrideCourts ?? tourney.courtCount ?? 1;
    return await drawMatchesInternal(tx, tournamentId, desiredCourts);
  });

  revalidatePath('/');
  return result;
}

export async function drawNextMatch(tournamentId: string) {
  return await drawNextMatches(tournamentId, 1);
}

/**
 * Registrerer kampresultat med optimistisk låsing (version check),
 * statusoppdatering, og atomisk rekalkulering av Elo og tabeller.
 */
export async function registerMatchScore(
  matchId: string, 
  scoreA: number, 
  scoreB: number,
  completedAt?: Date,
  clientVersion?: number
) {
  const result = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ 
      where: { id: matchId },
      include: { tournament: true }
    });
    if (!match) throw new Error('Kamp ikke funnet');

    // Optimistisk låsing
    if (clientVersion !== undefined && match.version !== clientVersion) {
      throw new Error('Kampen har blitt oppdatert fra en annen enhet. Vennligst last inn på nytt.');
    }

    // Sjekk om det finnes en tidligere ufullført kamp på samme bane i turneringen
    const earlierUncompleted = await tx.match.findFirst({
      where: {
        tournamentId: match.tournamentId,
        courtNumber: match.courtNumber,
        isCompleted: false,
        startedAt: { lt: match.startedAt },
        id: { not: matchId }
      }
    });

    if (earlierUncompleted) {
      throw new Error('Forrige kamp på denne banen må fullføres og lagres før denne kampen kan registreres.');
    }

    const validScoreA = Math.max(0, Number(scoreA) || 0);
    const validScoreB = Math.max(0, Number(scoreB) || 0);

    let winnerTeam: string = 'DRAW';
    if (validScoreA > validScoreB) winnerTeam = 'A';
    else if (validScoreB > validScoreA) winnerTeam = 'B';

    const finishDate = completedAt ? new Date(completedAt) : new Date();

    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: { 
        status: 'COMPLETED',
        isCompleted: true, 
        teamAScore: validScoreA, 
        teamBScore: validScoreB,
        winnerTeam,
        completedAt: finishDate,
        version: { increment: 1 }
      }
    });

    // Rekalkuler tabell for denne turneringen i transaksjonen
    await recalculateTournamentStatsInternal(tx, match.tournamentId);

    // Hvis dette er en ligaturnering, synkroniser ligamedlemmers Elo
    if (match.tournament.leagueId) {
      await syncLeagueEloInternal(tx, match.tournament.leagueId);
    }

    return updatedMatch;
  });

  revalidatePath('/');
  return { success: true, match: result };
}

export async function updateMatchScore(
  matchId: string, 
  scoreA: number, 
  scoreB: number,
  startedAt?: string | Date,
  completedAt?: string | Date,
  clientVersion?: number
) {
  const result = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ 
      where: { id: matchId },
      include: { tournament: true }
    });
    if (!match) throw new Error('Kamp ikke funnet');

    // Optimistisk låsing
    if (clientVersion !== undefined && match.version !== clientVersion) {
      throw new Error('Kampen har blitt endret av en annen enhet. Vennligst last inn på nytt.');
    }

    const matchDate = match.completedAt || match.date;
    const matchDay = new Date(matchDate).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    if (matchDay !== today) {
      throw new Error('Korrektur er sperret for kamper spilt en tidligere dag.');
    }

    const validScoreA = Math.max(0, Number(scoreA) || 0);
    const validScoreB = Math.max(0, Number(scoreB) || 0);

    let winnerTeam: string = 'DRAW';
    if (validScoreA > validScoreB) winnerTeam = 'A';
    else if (validScoreB > validScoreA) winnerTeam = 'B';

    const dataToUpdate: any = {
      status: 'COMPLETED',
      isCompleted: true,
      teamAScore: validScoreA,
      teamBScore: validScoreB,
      winnerTeam,
      version: { increment: 1 }
    };

    if (startedAt) dataToUpdate.startedAt = new Date(startedAt);
    if (completedAt) dataToUpdate.completedAt = new Date(completedAt);

    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: dataToUpdate
    });

    await recalculateTournamentStatsInternal(tx, match.tournamentId);

    if (match.tournament.leagueId) {
      await syncLeagueEloInternal(tx, match.tournament.leagueId);
    }

    return updatedMatch;
  });

  revalidatePath('/');
  return { success: true, match: result };
}

export async function deleteMatch(matchId: string) {
  const session = await getAuthSession();

  await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ 
      where: { id: matchId },
      include: { tournament: true }
    });
    if (!match) return;

    // Sjekk om vanlig bruker forsøker å slette kamp fra en tidligere dag
    if (!session.isAdmin) {
      const matchDate = match.completedAt || match.startedAt || match.date;
      if (!isMatchEditable(matchDate)) {
        throw new Error('Kamper kan kun slettes på samme kalenderdag som de ble spilt. Kontakt administrator for sletting av eldre kamper.');
      }
    }

    const tournamentId = match.tournamentId;
    const leagueId = match.tournament.leagueId;

    await tx.match.delete({ where: { id: matchId } });
    await recalculateTournamentStatsInternal(tx, tournamentId);

    if (leagueId) {
      await syncLeagueEloInternal(tx, leagueId);
    }
  });

  revalidatePath('/');
}

/**
 * Intern hjelper for å rekalkulere deltakernes poeng og kamper innenfor en transaksjon
 */
async function recalculateTournamentStatsInternal(tx: any, tournamentId: string) {
  const tourney = await tx.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: { include: { user: true } },
      matches: {
        where: { isCompleted: true },
        include: {
          teamAPlayer1: true,
          teamAPlayer2: true,
          teamBPlayer1: true,
          teamBPlayer2: true,
        },
        orderBy: { startedAt: 'asc' }
      }
    }
  });

  if (!tourney) return;

  const participants = tourney.participants;
  const completedMatches = tourney.matches;

  // Beregn turnering-spesifikk Elo (Turnering-Elo)
  const participantUserIds = participants.map((p: any) => p.userId);
  const { participantStats, processedMatches } = replayTournamentElo(
    participantUserIds,
    completedMatches,
    tourney.targetScore || 21,
    DEFAULT_ELO
  );

  const statsMap: Record<string, { points: number; won: number; drawn: number; lost: number }> = {};
  for (const lu of participants) {
    statsMap[lu.userId] = { points: 0, won: 0, drawn: 0, lost: 0 };
  }

  for (const m of completedMatches) {
    const sA = m.teamAScore;
    const sB = m.teamBScore;
    const isADraw = sA === sB;
    const isAWon = sA > sB;
    const isBWon = sB > sA;

    const addStats = (userId: string, points: number, won: boolean, drawn: boolean, lost: boolean) => {
      if (!statsMap[userId]) statsMap[userId] = { points: 0, won: 0, drawn: 0, lost: 0 };
      statsMap[userId].points += points;
      if (won) statsMap[userId].won++;
      else if (drawn) statsMap[userId].drawn++;
      else if (lost) statsMap[userId].lost++;
    };

    addStats(m.teamAPlayer1Id, sA, isAWon, isADraw, !isAWon && !isADraw);
    addStats(m.teamAPlayer2Id, sA, isAWon, isADraw, !isAWon && !isADraw);
    addStats(m.teamBPlayer1Id, sB, isBWon, isADraw, !isBWon && !isADraw);
    addStats(m.teamBPlayer2Id, sB, isBWon, isADraw, !isBWon && !isADraw);
  }

  for (const lu of participants) {
    const st = statsMap[lu.userId] || { points: 0, won: 0, drawn: 0, lost: 0 };
    const eloInfo = participantStats[lu.userId] || {
      tournamentElo: DEFAULT_ELO,
      initialElo: DEFAULT_ELO,
      eloDelta: 0
    };

    await tx.tournamentParticipant.update({
      where: { id: lu.id },
      data: {
        totalPoints: st.points,
        matchesWon: st.won,
        matchesDrawn: st.drawn,
        matchesLost: st.lost,
        tournamentElo: eloInfo.tournamentElo,
        initialElo: eloInfo.initialElo,
        eloDelta: eloInfo.eloDelta,
      }
    });
  }

  // Hvis turneringen ikke tilhører en liga, synkroniserer vi turneringens kamp-deltas direkte
  if (!tourney.leagueId) {
    for (const pm of processedMatches) {
      await tx.match.update({
        where: { id: pm.matchId },
        data: {
          teamAEloBefore: pm.teamAEloBefore,
          teamBEloBefore: pm.teamBEloBefore,
          eloDelta: pm.eloDelta
        }
      });
    }
  }
}

/**
 * Intern hjelper for å synkronisere ligamedlemmers Elo og kamp-deltas
 */
async function syncLeagueEloInternal(tx: any, leagueId: string) {
  const league = await tx.league.findUnique({
    where: { id: leagueId },
    include: {
      members: true,
      tournaments: {
        include: {
          matches: {
            where: { isCompleted: true },
            include: {
              teamAPlayer1: true,
              teamAPlayer2: true,
              teamBPlayer1: true,
              teamBPlayer2: true,
            }
          }
        }
      }
    }
  });

  if (!league) return;

  const memberIds = league.members.map((m: any) => m.userId);
  const { playerStats, processedMatches } = replayLeagueMatchesElo(
    memberIds,
    league.tournaments.map((t: any) => ({
      id: t.id,
      name: t.name,
      targetScore: t.targetScore || 21,
      matches: t.matches
    }))
  );

  // Oppdater Elo på LeagueMember
  for (const member of league.members) {
    const ps = playerStats[member.userId];
    if (ps) {
      await tx.leagueMember.update({
        where: { id: member.id },
        data: {
          eloRating: ps.currentElo,
          highestElo: ps.highestElo,
          lowestElo: ps.lowestElo
        }
      });
      // Oppdater også global User elo hvis høyere
      await tx.user.update({
        where: { id: member.userId },
        data: { eloRating: ps.currentElo }
      });
    }
  }

  // Oppdater Elo deltas på selve kampene
  for (const pm of processedMatches) {
    await tx.match.update({
      where: { id: pm.matchId },
      data: {
        teamAEloBefore: pm.teamAEloBefore,
        teamBEloBefore: pm.teamBEloBefore,
        eloDelta: pm.eloDelta
      }
    });
  }
}

export async function recalculateTournamentStats(tournamentId: string) {
  await prisma.$transaction(async (tx) => {
    await recalculateTournamentStatsInternal(tx, tournamentId);
    const tourney = await tx.tournament.findUnique({ where: { id: tournamentId } });
    if (tourney?.leagueId) {
      await syncLeagueEloInternal(tx, tourney.leagueId);
    }
  });
  revalidatePath('/');
}

/* ==========================================================================
   FRITTSTÅENDE PADEL-KAMP (STANDALONE MATCH - SET & GAME)
   ========================================================================== */

export type CreateStandaloneMatchInput = {
  name?: string;
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  teamAPlayer1Id?: string;
  teamAPlayer2Id?: string;
  teamBPlayer1Id?: string;
  teamBPlayer2Id?: string;
  format?: 'BEST_OF_1' | 'BEST_OF_3' | 'BEST_OF_3_SUPER_TB';
  goldenPoint?: boolean;
  deuceRule?: 'GOLDEN_POINT' | 'ADVANTAGE';
};

export async function createStandaloneMatch(input: CreateStandaloneMatchInput) {
  const session = await getAuthSession();

  const deuceRule = input.deuceRule || (input.goldenPoint === false ? 'ADVANTAGE' : 'GOLDEN_POINT');

  const initialScoresJson = JSON.stringify({
    sets: [{ teamA: 0, teamB: 0 }],
    currentSetIndex: 0,
    currentPoints: { teamA: '0', teamB: '0' },
    isTiebreak: false,
    tiebreakScores: { teamA: 0, teamB: 0 },
    servingTeam: 'A',
    servingPlayer: 1,
    deuceRule,
    history: [],
    events: [],
    gameScoresHistory: [],
    matchStats: {
      teamAPointsTotal: 0,
      teamBPointsTotal: 0,
      goldenPointsPlayed: 0,
      goldenPointsWonA: 0,
      goldenPointsWonB: 0,
      breakPointsA: 0,
      breakPointsB: 0,
      breakPointsConvertedA: 0,
      breakPointsConvertedB: 0,
    }
  });

  const match = await prisma.standaloneMatch.create({
    data: {
      name: input.name?.trim() || 'Padelkamp',
      accessCode: session.accessCode,
      teamAPlayer1: input.teamAPlayer1.trim(),
      teamAPlayer2: input.teamAPlayer2.trim(),
      teamBPlayer1: input.teamBPlayer1.trim(),
      teamBPlayer2: input.teamBPlayer2.trim(),
      teamAPlayer1Id: input.teamAPlayer1Id || null,
      teamAPlayer2Id: input.teamAPlayer2Id || null,
      teamBPlayer1Id: input.teamBPlayer1Id || null,
      teamBPlayer2Id: input.teamBPlayer2Id || null,
      format: input.format || 'BEST_OF_3',
      goldenPoint: deuceRule !== 'ADVANTAGE',
      scoresJson: initialScoresJson,
      isCompleted: false,
      startedAt: new Date(),
    }
  });

  revalidatePath('/');
  return match;
}

export async function getStandaloneMatches() {
  const session = await getAuthSession();

  if (session.accessCode === 'test' || session.accessCode === 'default') {
    const userCount = await prisma.user.count({ where: { accessCode: session.accessCode } });
    if (userCount === 0) {
      await seedTestDataForCode(session.accessCode);
    }
  }

  const whereClause: any = session.isAdmin
    ? {}
    : { accessCode: session.accessCode };

  return await prisma.standaloneMatch.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 50
  });
}

export async function getStandaloneMatch(id: string) {
  return await prisma.standaloneMatch.findUnique({
    where: { id }
  });
}

export async function saveStandaloneMatch(
  id: string,
  scoresJson: string,
  winnerTeam?: 'A' | 'B' | null,
  isCompleted: boolean = false
) {
  const match = await prisma.standaloneMatch.update({
    where: { id },
    data: {
      scoresJson,
      winnerTeam: winnerTeam || null,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    }
  });

  revalidatePath('/');
  return match;
}

export async function deleteStandaloneMatch(id: string) {
  const session = await getAuthSession();
  const match = await prisma.standaloneMatch.findUnique({
    where: { id }
  });
  if (!match) return;

  if (!session.isAdmin) {
    const matchDate = match.completedAt || match.startedAt || match.createdAt;
    if (!isMatchEditable(matchDate)) {
      throw new Error('Kamper kan kun slettes på samme kalenderdag som de ble spilt. Kontakt administrator for sletting av eldre kamper.');
    }
  }

  await prisma.standaloneMatch.delete({
    where: { id }
  });

  revalidatePath('/');
}

