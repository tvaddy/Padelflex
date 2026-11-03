/**
 * Score-vektet Elo-ratingsystem for 2v2 Padel
 * 
 * Egenskaper:
 * - Startverdi: 1500 Elo per spiller i en liga
 * - 2v2 Lagberegning: Gjennomsnitts-rating for hvert lag bestemmer forventet utfall E_A og E_B
 * - Resultatvektet justering: Skalerer ratingendringen etter seiersmarginen (f.eks. 21-3 gir vesentlig større endring enn 21-19)
 * - Single Source of Truth: Deterministisk replay av alle fullførte ligakamper i kronologisk rekkefølge
 */

export const DEFAULT_ELO = 1500;
export const BASE_K_FACTOR = 28;
export const PROVISIONAL_K_FACTOR = 40; // Raskere kalibrering for nye spillere (< 10 kamper)

export type EloCalculationResult = {
  teamARatingBefore: number;
  teamBRatingBefore: number;
  expectedA: number;
  expectedB: number;
  winnerTeam: 'A' | 'B' | 'DRAW';
  scoreDifference: number;
  marginMultiplier: number;
  deltaA: number; // Positiv for gevinst, negativ for tap
  deltaB: number;
};

/**
 * Beregner forventet utfall for Lag A (mellom 0.0 og 1.0)
 */
export function calculateExpectedOutcome(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Beregner score-vektet Elo-delta for en 2v2 padelkamp
 * I tråd med anerkjente ratingmetoder for padel/doubles:
 * - Lag-rating er snitt av de 2 spillerne
 * - Marginjustering basert på poengforhold/score-differanse
 * - Dynamisk K-faktor basert på spillernes erfaringsnivå/kalibrering
 */
export function calculate2v2EloDelta(
  ratingA1: number,
  ratingA2: number,
  ratingB1: number,
  ratingB2: number,
  scoreA: number,
  scoreB: number,
  targetScore: number = 21,
  kFactor: number = BASE_K_FACTOR
): EloCalculationResult {
  const teamARatingBefore = (ratingA1 + ratingA2) / 2;
  const teamBRatingBefore = (ratingB1 + ratingB2) / 2;

  const expectedA = calculateExpectedOutcome(teamARatingBefore, teamBRatingBefore);
  const expectedB = 1 - expectedA;

  let actualA = 0.5;
  let winnerTeam: 'A' | 'B' | 'DRAW' = 'DRAW';

  if (scoreA > scoreB) {
    actualA = 1.0;
    winnerTeam = 'A';
  } else if (scoreB > scoreA) {
    actualA = 0.0;
    winnerTeam = 'B';
  }

  const scoreDifference = Math.abs(scoreA - scoreB);
  const nominalTarget = Math.max(12, targetScore);
  
  // Margin multiplikator: Seier med 21-3 vs 21-19
  // Glatt og balansert skalering i tråd med padel americano/mexicano
  const rawMargin = Math.sqrt((scoreDifference + 1) / (nominalTarget * 0.45));
  const marginMultiplier = Math.min(2.2, Math.max(0.4, rawMargin));

  // Elo delta for Lag A
  const rawDeltaA = kFactor * marginMultiplier * (actualA - expectedA);
  const deltaA = Math.round(rawDeltaA * 10) / 10; // 1 desimal
  const deltaB = -deltaA;

  return {
    teamARatingBefore: Math.round(teamARatingBefore * 10) / 10,
    teamBRatingBefore: Math.round(teamBRatingBefore * 10) / 10,
    expectedA: Math.round(expectedA * 1000) / 1000,
    expectedB: Math.round(expectedB * 1000) / 1000,
    winnerTeam,
    scoreDifference,
    marginMultiplier: Math.round(marginMultiplier * 100) / 100,
    deltaA,
    deltaB,
  };
}

export type FormMatchEntry = {
  matchId: string;
  tournamentId?: string;
  tournamentName?: string;
  date: Date | string;
  result: 'WON' | 'DRAW' | 'LOST';
  myScore: number;
  oppScore: number;
  partnerName: string;
  partnerId?: string;
  opponentNames: string[];
  eloDelta?: number;
};

export type ExtendedPlayerStats = {
  dreamPartner: {
    id: string;
    name: string;
    matchesTogether: number;
    wonTogether: number;
    drawnTogether: number;
    lostTogether: number;
    winRate: number;
    avgPointsTogether: number;
    pointDiffTogether: number;
  } | null;
  kryptonite: {
    id: string;
    name: string;
    matchesAgainst: number;
    lostAgainst: number;
    wonAgainst: number;
    drawnAgainst: number;
    lossRate: number;
    winRate: number;
    pointDiffAgainst: number;
  } | null;
  formCurve: FormMatchEntry[]; // Siste 5-10 kamper
  currentStreak: {
    type: 'WIN' | 'LOSS' | 'UNBEATEN' | 'NONE';
    count: number;
    label: string;
  };
};

/**
 * Analyserer makkere, motstandere, drømmemakker, kryptonitt og formkurve
 */
export function analyzePlayerExtendedStats(
  playerId: string,
  matches: Array<{
    id: string;
    date: Date | string;
    startedAt?: Date | string;
    completedAt?: Date | string | null;
    tournamentId?: string;
    tournament?: { id: string; name: string };
    teamAPlayer1Id: string;
    teamAPlayer2Id: string;
    teamBPlayer1Id: string;
    teamBPlayer2Id: string;
    teamAScore: number;
    teamBScore: number;
    teamAPlayer1?: { id: string; name: string };
    teamAPlayer2?: { id: string; name: string };
    teamBPlayer1?: { id: string; name: string };
    teamBPlayer2?: { id: string; name: string };
    eloDelta?: number | null;
  }>
): ExtendedPlayerStats {
  const partnerMap: Record<string, {
    id: string;
    name: string;
    matches: number;
    won: number;
    drawn: number;
    lost: number;
    pointsScored: number;
    pointsConceded: number;
  }> = {};

  const opponentMap: Record<string, {
    id: string;
    name: string;
    matches: number;
    wonAgainst: number;
    drawnAgainst: number;
    lostAgainst: number;
    pointsScoredAgainst: number;
    pointsConcededAgainst: number;
  }> = {};

  // Sorter kamper kronologisk (eldst til nyest) for strek- og formberegning
  const sortedMatches = [...matches].sort((a, b) => {
    const tA = new Date(a.startedAt || a.date).getTime();
    const tB = new Date(b.startedAt || b.date).getTime();
    return tA - tB;
  });

  const formEntries: FormMatchEntry[] = [];

  for (const m of sortedMatches) {
    const isTeamA = m.teamAPlayer1Id === playerId || m.teamAPlayer2Id === playerId;
    const isTeamB = m.teamBPlayer1Id === playerId || m.teamBPlayer2Id === playerId;

    if (!isTeamA && !isTeamB) continue;

    const myScore = isTeamA ? m.teamAScore : m.teamBScore;
    const oppScore = isTeamA ? m.teamBScore : m.teamAScore;

    const isWon = myScore > oppScore;
    const isDraw = myScore === oppScore;
    const isLost = myScore < oppScore;
    const resultStatus: 'WON' | 'DRAW' | 'LOST' = isWon ? 'WON' : isDraw ? 'DRAW' : 'LOST';

    const partner = isTeamA
      ? (m.teamAPlayer1Id === playerId ? m.teamAPlayer2 : m.teamAPlayer1)
      : (m.teamBPlayer1Id === playerId ? m.teamBPlayer2 : m.teamBPlayer1);

    const partnerId = isTeamA
      ? (m.teamAPlayer1Id === playerId ? m.teamAPlayer2Id : m.teamAPlayer1Id)
      : (m.teamBPlayer1Id === playerId ? m.teamBPlayer2Id : m.teamBPlayer1Id);

    const partnerName = partner?.name || 'Makker';

    const opponents = isTeamA
      ? [m.teamBPlayer1, m.teamBPlayer2]
      : [m.teamAPlayer1, m.teamAPlayer2];

    const oppIds = isTeamA
      ? [m.teamBPlayer1Id, m.teamBPlayer2Id]
      : [m.teamAPlayer1Id, m.teamAPlayer2Id];

    const oppNames = opponents.map((o, idx) => o?.name || `Motstander ${idx + 1}`);

    // Registrer makker
    if (partnerId && partnerId !== playerId) {
      if (!partnerMap[partnerId]) {
        partnerMap[partnerId] = {
          id: partnerId,
          name: partnerName,
          matches: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          pointsScored: 0,
          pointsConceded: 0,
        };
      }
      const pm = partnerMap[partnerId];
      pm.matches++;
      pm.pointsScored += myScore;
      pm.pointsConceded += oppScore;
      if (isWon) pm.won++;
      else if (isDraw) pm.drawn++;
      else pm.lost++;
    }

    // Registrer motstandere
    for (let i = 0; i < oppIds.length; i++) {
      const oppId = oppIds[i];
      if (oppId && oppId !== playerId) {
        if (!opponentMap[oppId]) {
          opponentMap[oppId] = {
            id: oppId,
            name: oppNames[i] || 'Motstander',
            matches: 0,
            wonAgainst: 0,
            drawnAgainst: 0,
            lostAgainst: 0,
            pointsScoredAgainst: 0,
            pointsConcededAgainst: 0,
          };
        }
        const om = opponentMap[oppId];
        om.matches++;
        om.pointsScoredAgainst += myScore;
        om.pointsConcededAgainst += oppScore;
        if (isWon) om.wonAgainst++;
        else if (isDraw) om.drawnAgainst++;
        else om.lostAgainst++;
      }
    }

    // Form match entry
    formEntries.push({
      matchId: m.id,
      tournamentId: m.tournamentId || m.tournament?.id,
      tournamentName: m.tournament?.name || 'Turnering',
      date: m.startedAt || m.date,
      result: resultStatus,
      myScore,
      oppScore,
      partnerName,
      partnerId,
      opponentNames: oppNames,
      eloDelta: m.eloDelta ? (isTeamA ? m.eloDelta : -m.eloDelta) : undefined,
    });
  }

  // 1. Beregn Drømmemakker (best winrate & synergy, vektet for antall kamper)
  const partnersList = Object.values(partnerMap);
  let dreamPartner: ExtendedPlayerStats['dreamPartner'] = null;

  if (partnersList.length > 0) {
    const scoredPartners = partnersList.map(p => {
      const winRate = p.matches > 0 ? ((p.won + p.drawn * 0.5) / p.matches) * 100 : 0;
      const avgPoints = p.matches > 0 ? p.pointsScored / p.matches : 0;
      const pointDiff = p.pointsScored - p.pointsConceded;
      // Synergy-score prioriterer høy seiersprosent kombinert med solid antall kamper
      const synergyScore = (winRate * 1.5) + (Math.min(p.matches, 8) * 10) + (pointDiff * 0.5);
      return {
        id: p.id,
        name: p.name,
        matchesTogether: p.matches,
        wonTogether: p.won,
        drawnTogether: p.drawn,
        lostTogether: p.lost,
        winRate: Math.round(winRate * 10) / 10,
        avgPointsTogether: Math.round(avgPoints * 10) / 10,
        pointDiffTogether: pointDiff,
        synergyScore,
      };
    });

    scoredPartners.sort((a, b) => b.synergyScore - a.synergyScore);
    if (scoredPartners[0]) {
      const { synergyScore, ...dp } = scoredPartners[0];
      dreamPartner = dp;
    }
  }

  // 2. Beregn Kryptonitt (motstander som volder størst trøbbel / høyest tapsprosent)
  const opponentsList = Object.values(opponentMap);
  let kryptonite: ExtendedPlayerStats['kryptonite'] = null;

  if (opponentsList.length > 0) {
    const scoredOpponents = opponentsList.map(o => {
      const lossRate = o.matches > 0 ? ((o.lostAgainst + o.drawnAgainst * 0.5) / o.matches) * 100 : 0;
      const winRate = o.matches > 0 ? (o.wonAgainst / o.matches) * 100 : 0;
      const pointDiff = o.pointsScoredAgainst - o.pointsConcededAgainst;
      // Kryptonite score: Høy tapsprosent + antall tap mot denne motstanderen
      const kryptoniteScore = (lossRate * 2) + (o.lostAgainst * 15) - (pointDiff * 0.5);
      return {
        id: o.id,
        name: o.name,
        matchesAgainst: o.matches,
        lostAgainst: o.lostAgainst,
        wonAgainst: o.wonAgainst,
        drawnAgainst: o.drawnAgainst,
        lossRate: Math.round(lossRate * 10) / 10,
        winRate: Math.round(winRate * 10) / 10,
        pointDiffAgainst: pointDiff,
        kryptoniteScore,
      };
    });

    scoredOpponents.sort((a, b) => b.kryptoniteScore - a.kryptoniteScore);
    // Kun kvalifiseres som kryptonitt hvis spilleren faktisk har tapt mot vedkommende
    const actualKryptonite = scoredOpponents.find(o => o.lostAgainst > 0) || scoredOpponents[0];
    if (actualKryptonite) {
      const { kryptoniteScore, ...kp } = actualKryptonite;
      kryptonite = kp;
    }
  }

  // 3. Formkurve (de siste 10 kampene, nyest først)
  const formCurve = [...formEntries].reverse().slice(0, 10);

  // 4. Strek-beregning (fra nyeste kamp bakover)
  let currentStreak: ExtendedPlayerStats['currentStreak'] = {
    type: 'NONE',
    count: 0,
    label: 'Ingen aktiv seiersrekke',
  };

  if (formEntries.length > 0) {
    const reversed = [...formEntries].reverse();
    const firstResult = reversed[0].result;

    let streakCount = 0;
    for (const entry of reversed) {
      if (entry.result === firstResult) {
        streakCount++;
      } else {
        break;
      }
    }

    if (firstResult === 'WON') {
      currentStreak = {
        type: 'WIN',
        count: streakCount,
        label: streakCount === 1 ? '1 seier' : `🔥 ${streakCount} seire på rad`,
      };
    } else if (firstResult === 'LOST') {
      currentStreak = {
        type: 'LOSS',
        count: streakCount,
        label: streakCount === 1 ? '1 tap' : `${streakCount} tap på rad`,
      };
    } else {
      currentStreak = {
        type: 'UNBEATEN',
        count: streakCount,
        label: 'Uavgjort sist',
      };
    }
  }

  return {
    dreamPartner,
    kryptonite,
    formCurve,
    currentStreak,
  };
}


export type PlayerEloHistoryEntry = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  date: Date;
  opponentNames: string[];
  partnerName: string;
  score: string;
  won: boolean;
  drawn: boolean;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
};

export type PlayerLeagueEloStats = {
  userId: string;
  currentElo: number;
  highestElo: number;
  lowestElo: number;
  startElo: number;
  totalMatches: number;
  history: PlayerEloHistoryEntry[];
};

/**
 * Replayer alle fullførte kamper i en liga deterministisk i kronologisk rekkefølge
 * for å sikre 100% konsistente Elo-tall uten avvik (Single Source of Truth).
 */
export function replayLeagueMatchesElo(
  memberUserIds: string[],
  tournamentsWithMatches: Array<{
    id: string;
    name: string;
    targetScore: number;
    matches: Array<{
      id: string;
      startedAt: Date | string;
      completedAt: Date | string | null;
      date: Date | string;
      teamAPlayer1Id: string;
      teamAPlayer2Id: string;
      teamBPlayer1Id: string;
      teamBPlayer2Id: string;
      teamAScore: number;
      teamBScore: number;
      teamAPlayer1?: { name: string };
      teamAPlayer2?: { name: string };
      teamBPlayer1?: { name: string };
      teamBPlayer2?: { name: string };
    }>;
  }>
): {
  playerStats: Record<string, PlayerLeagueEloStats>;
  processedMatches: Array<{
    matchId: string;
    teamAEloBefore: number;
    teamBEloBefore: number;
    eloDelta: number;
  }>;
} {
  const playerStats: Record<string, PlayerLeagueEloStats> = {};

  // Initialiser alle spillere med 1500
  for (const uid of memberUserIds) {
    playerStats[uid] = {
      userId: uid,
      currentElo: DEFAULT_ELO,
      highestElo: DEFAULT_ELO,
      lowestElo: DEFAULT_ELO,
      startElo: DEFAULT_ELO,
      totalMatches: 0,
      history: []
    };
  }

  // Samle alle fullførte kamper fra alle turneringer i ligaen
  type FlatMatch = {
    match: typeof tournamentsWithMatches[0]['matches'][0];
    tournamentId: string;
    tournamentName: string;
    targetScore: number;
    sortTime: number;
  };

  const flatMatches: FlatMatch[] = [];

  for (const t of tournamentsWithMatches) {
    for (const m of t.matches) {
      if (m.completedAt || (m.teamAScore > 0 || m.teamBScore > 0)) {
        const time = new Date(m.startedAt || m.date).getTime();
        flatMatches.push({
          match: m,
          tournamentId: t.id,
          tournamentName: t.name,
          targetScore: t.targetScore || 21,
          sortTime: time
        });
      }
    }
  }

  // Sorter kronologisk
  flatMatches.sort((a, b) => a.sortTime - b.sortTime);

  const processedMatches: Array<{
    matchId: string;
    teamAEloBefore: number;
    teamBEloBefore: number;
    eloDelta: number;
  }> = [];

  for (const item of flatMatches) {
    const m = item.match;
    const a1 = m.teamAPlayer1Id;
    const a2 = m.teamAPlayer2Id;
    const b1 = m.teamBPlayer1Id;
    const b2 = m.teamBPlayer2Id;

    // Sørg for at alle involverte spillere finnes i kartet
    for (const pid of [a1, a2, b1, b2]) {
      if (!playerStats[pid]) {
        playerStats[pid] = {
          userId: pid,
          currentElo: DEFAULT_ELO,
          highestElo: DEFAULT_ELO,
          lowestElo: DEFAULT_ELO,
          startElo: DEFAULT_ELO,
          totalMatches: 0,
          history: []
        };
      }
    }

    const rA1 = playerStats[a1].currentElo;
    const rA2 = playerStats[a2].currentElo;
    const rB1 = playerStats[b1].currentElo;
    const rB2 = playerStats[b2].currentElo;

    const minMatches = Math.min(
      playerStats[a1].totalMatches,
      playerStats[a2].totalMatches,
      playerStats[b1].totalMatches,
      playerStats[b2].totalMatches
    );
    const effectiveK = minMatches < 8 ? PROVISIONAL_K_FACTOR : BASE_K_FACTOR;

    const eloRes = calculate2v2EloDelta(
      rA1,
      rA2,
      rB1,
      rB2,
      m.teamAScore,
      m.teamBScore,
      item.targetScore,
      effectiveK
    );

    processedMatches.push({
      matchId: m.id,
      teamAEloBefore: eloRes.teamARatingBefore,
      teamBEloBefore: eloRes.teamBRatingBefore,
      eloDelta: eloRes.deltaA
    });

    const isAWon = m.teamAScore > m.teamBScore;
    const isBWon = m.teamBScore > m.teamAScore;
    const isDraw = m.teamAScore === m.teamBScore;

    // Oppdater Lag A spillere
    for (const pid of [a1, a2]) {
      const ps = playerStats[pid];
      const partnerId = pid === a1 ? a2 : a1;
      const partnerName = (pid === a1 ? m.teamAPlayer2?.name : m.teamAPlayer1?.name) || 'Makker';
      const oppNames = [m.teamBPlayer1?.name || 'Motspiller 1', m.teamBPlayer2?.name || 'Motspiller 2'];

      const before = ps.currentElo;
      const after = Math.round((before + eloRes.deltaA) * 10) / 10;

      ps.currentElo = after;
      ps.highestElo = Math.max(ps.highestElo, after);
      ps.lowestElo = Math.min(ps.lowestElo, after);
      ps.totalMatches++;

      ps.history.push({
        matchId: m.id,
        tournamentId: item.tournamentId,
        tournamentName: item.tournamentName,
        date: new Date(m.startedAt || m.date),
        opponentNames: oppNames,
        partnerName,
        score: `${m.teamAScore} - ${m.teamBScore}`,
        won: isAWon,
        drawn: isDraw,
        ratingBefore: before,
        ratingAfter: after,
        delta: eloRes.deltaA
      });
    }

    // Oppdater Lag B spillere
    for (const pid of [b1, b2]) {
      const ps = playerStats[pid];
      const partnerId = pid === b1 ? b2 : b1;
      const partnerName = (pid === b1 ? m.teamBPlayer2?.name : m.teamBPlayer1?.name) || 'Makker';
      const oppNames = [m.teamAPlayer1?.name || 'Motspiller 1', m.teamAPlayer2?.name || 'Motspiller 2'];

      const before = ps.currentElo;
      const after = Math.round((before + eloRes.deltaB) * 10) / 10;

      ps.currentElo = after;
      ps.highestElo = Math.max(ps.highestElo, after);
      ps.lowestElo = Math.min(ps.lowestElo, after);
      ps.totalMatches++;

      ps.history.push({
        matchId: m.id,
        tournamentId: item.tournamentId,
        tournamentName: item.tournamentName,
        date: new Date(m.startedAt || m.date),
        opponentNames: oppNames,
        partnerName,
        score: `${m.teamBScore} - ${m.teamAScore}`,
        won: isBWon,
        drawn: isDraw,
        ratingBefore: before,
        ratingAfter: after,
        delta: eloRes.deltaB
      });
    }
  }

  return { playerStats, processedMatches };
}

export type ParticipantTournamentElo = {
  userId: string;
  initialElo: number;
  tournamentElo: number;
  eloDelta: number; // tournamentElo - initialElo
  matchesPlayed: number;
  won: number;
  drawn: number;
  lost: number;
  highestElo: number;
  lowestElo: number;
  history: Array<{
    matchId: string;
    ratingBefore: number;
    ratingAfter: number;
    delta: number;
    won: boolean;
    drawn: boolean;
    score: string;
  }>;
};

/**
 * Replayer alle fullførte kamper i en enkeltturnering kronologisk
 * for å beregne turnering-spesifikk Elo (Turnering-Elo) uavhengig av historikk.
 */
export function replayTournamentElo(
  participantUserIds: string[],
  matches: Array<{
    id: string;
    startedAt?: Date | string;
    completedAt?: Date | string | null;
    date?: Date | string;
    teamAPlayer1Id: string;
    teamAPlayer2Id: string;
    teamBPlayer1Id: string;
    teamBPlayer2Id: string;
    teamAScore: number;
    teamBScore: number;
    teamAPlayer1?: { name: string };
    teamAPlayer2?: { name: string };
    teamBPlayer1?: { name: string };
    teamBPlayer2?: { name: string };
  }>,
  targetScore: number = 21,
  startElo: number = DEFAULT_ELO
): {
  participantStats: Record<string, ParticipantTournamentElo>;
  processedMatches: Array<{
    matchId: string;
    teamAEloBefore: number;
    teamBEloBefore: number;
    eloDelta: number;
  }>;
} {
  const participantStats: Record<string, ParticipantTournamentElo> = {};

  for (const uid of participantUserIds) {
    participantStats[uid] = {
      userId: uid,
      initialElo: startElo,
      tournamentElo: startElo,
      eloDelta: 0,
      matchesPlayed: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      highestElo: startElo,
      lowestElo: startElo,
      history: []
    };
  }

  // Filtrer og sorter fullførte kamper
  const completedMatches = matches.filter(m => m.completedAt || (m.teamAScore > 0 || m.teamBScore > 0));
  const sortedMatches = [...completedMatches].sort((a, b) => {
    const tA = new Date(a.startedAt || a.date || 0).getTime();
    const tB = new Date(b.startedAt || b.date || 0).getTime();
    return tA - tB;
  });

  const processedMatches: Array<{
    matchId: string;
    teamAEloBefore: number;
    teamBEloBefore: number;
    eloDelta: number;
  }> = [];

  // Bruk en turnering-optimalisert K-faktor (32) for synlig og responsiv turnering-elo
  const TOURNAMENT_K_FACTOR = 32;

  for (const m of sortedMatches) {
    const a1 = m.teamAPlayer1Id;
    const a2 = m.teamAPlayer2Id;
    const b1 = m.teamBPlayer1Id;
    const b2 = m.teamBPlayer2Id;

    for (const pid of [a1, a2, b1, b2]) {
      if (!participantStats[pid]) {
        participantStats[pid] = {
          userId: pid,
          initialElo: startElo,
          tournamentElo: startElo,
          eloDelta: 0,
          matchesPlayed: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          highestElo: startElo,
          lowestElo: startElo,
          history: []
        };
      }
    }

    const rA1 = participantStats[a1].tournamentElo;
    const rA2 = participantStats[a2].tournamentElo;
    const rB1 = participantStats[b1].tournamentElo;
    const rB2 = participantStats[b2].tournamentElo;

    const eloRes = calculate2v2EloDelta(
      rA1,
      rA2,
      rB1,
      rB2,
      m.teamAScore,
      m.teamBScore,
      targetScore,
      TOURNAMENT_K_FACTOR
    );

    processedMatches.push({
      matchId: m.id,
      teamAEloBefore: eloRes.teamARatingBefore,
      teamBEloBefore: eloRes.teamBRatingBefore,
      eloDelta: eloRes.deltaA
    });

    const isAWon = m.teamAScore > m.teamBScore;
    const isBWon = m.teamBScore > m.teamAScore;
    const isDraw = m.teamAScore === m.teamBScore;

    // Oppdater Lag A
    for (const pid of [a1, a2]) {
      const ps = participantStats[pid];
      const before = ps.tournamentElo;
      const after = Math.round((before + eloRes.deltaA) * 10) / 10;
      ps.tournamentElo = after;
      ps.eloDelta = Math.round((after - ps.initialElo) * 10) / 10;
      ps.highestElo = Math.max(ps.highestElo, after);
      ps.lowestElo = Math.min(ps.lowestElo, after);
      ps.matchesPlayed++;
      if (isAWon) ps.won++;
      else if (isDraw) ps.drawn++;
      else ps.lost++;

      ps.history.push({
        matchId: m.id,
        ratingBefore: before,
        ratingAfter: after,
        delta: eloRes.deltaA,
        won: isAWon,
        drawn: isDraw,
        score: `${m.teamAScore} - ${m.teamBScore}`
      });
    }

    // Oppdater Lag B
    for (const pid of [b1, b2]) {
      const ps = participantStats[pid];
      const before = ps.tournamentElo;
      const after = Math.round((before + eloRes.deltaB) * 10) / 10;
      ps.tournamentElo = after;
      ps.eloDelta = Math.round((after - ps.initialElo) * 10) / 10;
      ps.highestElo = Math.max(ps.highestElo, after);
      ps.lowestElo = Math.min(ps.lowestElo, after);
      ps.matchesPlayed++;
      if (isBWon) ps.won++;
      else if (isDraw) ps.drawn++;
      else ps.lost++;

      ps.history.push({
        matchId: m.id,
        ratingBefore: before,
        ratingAfter: after,
        delta: eloRes.deltaB,
        won: isBWon,
        drawn: isDraw,
        score: `${m.teamBScore} - ${m.teamAScore}`
      });
    }
  }

  return { participantStats, processedMatches };
}

