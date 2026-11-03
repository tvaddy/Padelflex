/**
 * Verktøy for kampberegninger, varighet, gjenstående runder og korrektur-sjekk.
 */

export function isMatchEditable(matchDate: Date | string | null | undefined): boolean {
  if (!matchDate) return true;
  const d = new Date(matchDate);
  const now = new Date();

  // Sjekk om det er samme kalenderdag
  const isSameDay = 
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  return isSameDay;
}

export function formatDurationMinutes(startedAt: Date | string | null | undefined, completedAt: Date | string | null | undefined): string {
  if (!startedAt || !completedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = Math.max(0, end - start);
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hrs = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hrs}t ${remMin}m` : `${hrs}t`;
}

export function formatTimeOnly(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleTimeString('no-NB', { hour: '2-digit', minute: '2-digit' });
}

function calculateGcd(a: number, b: number): number {
  return b === 0 ? a : calculateGcd(b, a % b);
}

export type TournamentProgressInfo = {
  totalParticipants: number;
  activeParticipants: number;
  pausedParticipants: number;
  completedMatchesCount: number;
  maxMatchesPlayed: number;
  minMatchesPlayed: number;
  isEqualized: boolean;
  matchesToEqualize: number;
  isDivisibleBy4: boolean;
  totalMatchesInCycle: number | null;
  matchesToFullCycle: number | null;
  currentCycleNumber: number;
  allEqualMessage: string | null;
  totalMinutesPlayed: number;
  avgMatchMinutes: number;
  playerMatchCounts: Record<string, number>;
  playerSatOutCounts: Record<string, number>;
};

export function calculateTournamentProgress(
  participants: any[],
  completedMatches: any[],
  courtCount: number = 1
): TournamentProgressInfo {
  const totalParticipants = participants.length;
  const activeParticipants = participants.filter(p => !p.isPaused).length;
  const pausedParticipants = participants.filter(p => p.isPaused).length;
  const completedMatchesCount = completedMatches.length;

  // Match counts and sit-out counts per player
  const playerMatchCounts: Record<string, number> = {};
  const playerSatOutCounts: Record<string, number> = {};

  for (const p of participants) {
    playerMatchCounts[p.userId] = 0;
    playerSatOutCounts[p.userId] = p.pausedCount || 0;
  }

  let totalMinutesPlayed = 0;
  let timedMatchesCount = 0;

  for (const m of completedMatches) {
    const matchPlayerIds = new Set<string>();
    if (m.teamAPlayer1Id) matchPlayerIds.add(m.teamAPlayer1Id);
    if (m.teamAPlayer2Id) matchPlayerIds.add(m.teamAPlayer2Id);
    if (m.teamBPlayer1Id) matchPlayerIds.add(m.teamBPlayer1Id);
    if (m.teamBPlayer2Id) matchPlayerIds.add(m.teamBPlayer2Id);

    for (const pid of matchPlayerIds) {
      if (playerMatchCounts[pid] !== undefined) {
        playerMatchCounts[pid]++;
      }
    }

    // For spillere som ikke spilte i denne fullførte kampen:
    for (const p of participants) {
      if (!matchPlayerIds.has(p.userId)) {
        if (playerSatOutCounts[p.userId] !== undefined) {
          playerSatOutCounts[p.userId]++;
        }
      }
    }

    if (m.startedAt && m.completedAt) {
      const diffMs = new Date(m.completedAt).getTime() - new Date(m.startedAt).getTime();
      const dur = Math.max(1, Math.round(diffMs / 60000));
      if (dur > 0 && dur < 180) {
        totalMinutesPlayed += dur;
        timedMatchesCount++;
      }
    }
  }

  const avgMatchMinutes = timedMatchesCount > 0 
    ? Math.round(totalMinutesPlayed / timedMatchesCount) 
    : (completedMatchesCount > 0 ? 12 : 0);

  if (totalMinutesPlayed === 0 && completedMatchesCount > 0) {
    totalMinutesPlayed = completedMatchesCount * 12;
  }

  const activeParticipantsList = participants.filter(p => !p.isPaused);
  const targetParticipants = activeParticipantsList.length >= 4 ? activeParticipantsList : participants;

  const activeCounts = targetParticipants.map(p => playerMatchCounts[p.userId] || 0);
  const maxMatchesPlayed = activeCounts.length > 0 ? Math.max(...activeCounts) : 0;
  const minMatchesPlayed = activeCounts.length > 0 ? Math.min(...activeCounts) : 0;
  
  // Hvor mange kamper mangler før alle aktive har nådd maxMatchesPlayed?
  // (Hver kamp har 4 spillerplasser)
  const slotsNeeded = targetParticipants.reduce((acc, p) => {
    const played = playerMatchCounts[p.userId] || 0;
    return acc + Math.max(0, maxMatchesPlayed - played);
  }, 0);

  const matchesToEqualize = Math.ceil(slotsNeeded / 4);
  const isEqualized = activeCounts.length > 0 && minMatchesPlayed === maxMatchesPlayed && completedMatchesCount > 0;

  // Full rettferdig spilletid-syklus beregning:
  // For N aktive spillere og C baner (hver bane har 4 spillere, så K = 4 * C spillere per runde)
  // Minste antall runder for at alle har spilt like mange kamper er R = N / gcd(N, K)
  // Totalt antall kamper per syklus = R * C
  const activeN = activeParticipants >= 4 ? activeParticipants : totalParticipants;
  const effectiveCourts = Math.max(1, Math.min(courtCount || 1, Math.floor(activeN / 4)));
  const playersPerRound = effectiveCourts * 4;

  let totalMatchesInCycle: number | null = null;
  let matchesToFullCycle: number | null = null;
  let currentCycleNumber = 1;

  if (activeN >= 4) {
    const g = calculateGcd(activeN, playersPerRound);
    const roundsInCycle = activeN / g;
    totalMatchesInCycle = roundsInCycle * effectiveCourts;

    currentCycleNumber = Math.floor(completedMatchesCount / totalMatchesInCycle) + 1;
    const targetCycleTotal = currentCycleNumber * totalMatchesInCycle;
    matchesToFullCycle = Math.max(0, targetCycleTotal - completedMatchesCount);
  }

  const isDivisibleBy4 = targetParticipants.length >= 4 && targetParticipants.length % 4 === 0;

  let allEqualMessage: string | null = null;
  if (isEqualized) {
    if (pausedParticipants > 0) {
      allEqualMessage = `Alle ${activeParticipants} aktive spillere har nå spilt like mange kamper (${maxMatchesPlayed} kamper hver, ${pausedParticipants} på pause)!`;
    } else {
      allEqualMessage = `Alle ${totalParticipants} spillere har nå spilt nøyaktig ${maxMatchesPlayed} kamper hver!`;
    }
  }

  return {
    totalParticipants,
    activeParticipants,
    pausedParticipants,
    completedMatchesCount,
    maxMatchesPlayed,
    minMatchesPlayed,
    isEqualized,
    matchesToEqualize,
    isDivisibleBy4,
    totalMatchesInCycle,
    matchesToFullCycle,
    currentCycleNumber,
    allEqualMessage,
    totalMinutesPlayed,
    avgMatchMinutes,
    playerMatchCounts,
    playerSatOutCounts
  };
}
