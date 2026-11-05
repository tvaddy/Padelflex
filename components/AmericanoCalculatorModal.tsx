'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { 
  X, 
  Calculator, 
  Clock, 
  Users, 
  Trophy, 
  Sparkles, 
  Check, 
  Copy, 
  Play, 
  Info, 
  Calendar, 
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Zap,
  Flame,
  LayoutGrid
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type AmericanoCalculatorModalProps = {
  onClose: () => void;
  initialPlayerCount?: number;
  initialTargetScore?: number;
  initialCourtCount?: number;
  onApplySettings?: (settings: { targetScore: number; courtCount: number; playerCount: number }) => void;
  onStartTournamentWithSettings?: (settings: { targetScore: number; courtCount: number; playerCount: number }) => void;
  confirmButtonLabel?: string;
};

// Greatest common divisor helper
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export default function AmericanoCalculatorModal({
  onClose,
  initialPlayerCount,
  initialTargetScore,
  initialCourtCount,
  onApplySettings,
  onStartTournamentWithSettings,
  confirmButtonLabel
}: AmericanoCalculatorModalProps) {
  const { t, isEnglish } = useTranslation();
  // Inputs
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number>(90); // standard booking: 90 min
  const [playerCount, setPlayerCount] = useState<number>(
    initialPlayerCount && initialPlayerCount >= 4 ? initialPlayerCount : 8
  );
  const [targetScore, setTargetScore] = useState<number>(initialTargetScore || 24);
  const [avgDurationPer24, setAvgDurationPer24] = useState<number>(10); // standard: 10 min
  const [pauseDuration, setPauseDuration] = useState<number>(2); // standard: 2 min
  const [warmupMinutes, setWarmupMinutes] = useState<number>(5); // standard: 5 min
  const [overrideCourtCount, setOverrideCourtCount] = useState<number | null>(
    initialCourtCount !== undefined && initialCourtCount !== null ? initialCourtCount : null
  );

  // Time format inputs (optional start time for schedule)
  const [startTimeStr, setStartTimeStr] = useState<string>('18:00');
  const [showDetailedSchedule, setShowDetailedSchedule] = useState<boolean>(false);
  const [copiedSchedule, setCopiedSchedule] = useState<boolean>(false);

  // Calculated courts: standard floor(players / 4), minimum 1
  const autoCourtCount = useMemo(() => {
    return Math.max(1, Math.min(6, Math.floor(playerCount / 4)));
  }, [playerCount]);

  const courtCount = overrideCourtCount !== null ? overrideCourtCount : autoCourtCount;

  // Active players per round
  const activePlayersPerRound = useMemo(() => {
    return Math.min(playerCount, courtCount * 4);
  }, [playerCount, courtCount]);

  const restingPlayersPerRound = useMemo(() => {
    return Math.max(0, playerCount - activePlayersPerRound);
  }, [playerCount, activePlayersPerRound]);

  // Duration per match based on target score scaled against 24 points
  const matchDurationMinutes = useMemo(() => {
    const raw = (targetScore / 24) * avgDurationPer24;
    return Math.round(raw * 100) / 100;
  }, [targetScore, avgDurationPer24]);

  // Effective time available for matches after warmup
  const effectivePlayTime = useMemo(() => {
    return Math.max(0, totalTimeMinutes - warmupMinutes);
  }, [totalTimeMinutes, warmupMinutes]);

  // Total time for N rounds: N * matchDuration + (N - 1) * pause
  const calcTotalTimeForRounds = useCallback((rounds: number) => {
    if (rounds <= 0) return 0;
    return rounds * matchDurationMinutes + (rounds > 1 ? (rounds - 1) * pauseDuration : 0);
  }, [matchDurationMinutes, pauseDuration]);

  // How many rounds fit in available time
  const maxRoundsPossible = useMemo(() => {
    if (matchDurationMinutes <= 0) return 0;
    if (effectivePlayTime < matchDurationMinutes) return 0;
    
    // R * match + (R - 1) * pause <= effectivePlayTime
    // R * (match + pause) - pause <= effectivePlayTime
    // R <= (effectivePlayTime + pause) / (match + pause)
    const rounds = Math.floor((effectivePlayTime + pauseDuration) / (matchDurationMinutes + pauseDuration));
    return Math.max(0, rounds);
  }, [effectivePlayTime, matchDurationMinutes, pauseDuration]);

  // Time used by max rounds + remaining buffer
  const actualTimeUsed = useMemo(() => {
    const matchTime = calcTotalTimeForRounds(maxRoundsPossible);
    return Math.round(warmupMinutes + matchTime);
  }, [maxRoundsPossible, warmupMinutes, calcTotalTimeForRounds]);

  const remainingBufferMinutes = useMemo(() => {
    return Math.max(0, totalTimeMinutes - actualTimeUsed);
  }, [totalTimeMinutes, actualTimeUsed]);

  // FAIRNESS CALCULATION:
  // For 4 players (1 court): 3 rounds = 1 complete Americano round-robin. Multiples of 3 (3, 6, 9...).
  // For N players with N = 4*C: all play every round. Full Americano partnership cycle = (N - 1) rounds.
  // For N > 4*C: To ensure everyone plays EXACTLY the same number of matches:
  // (R * activePlayersPerRound) % N === 0.
  // The minimal fair round block is N / gcd(activePlayersPerRound, N).
  const fairRoundStep = useMemo(() => {
    if (playerCount === 4 && courtCount === 1) {
      return 3; // 3 rounds for everyone against everyone
    }
    if (playerCount === activePlayersPerRound) {
      // Everyone plays every round! Every round count is fair in terms of matches played.
      // But a full partner cycle is playerCount - 1
      return playerCount - 1;
    }
    const g = gcd(activePlayersPerRound, playerCount);
    return playerCount / g;
  }, [playerCount, courtCount, activePlayersPerRound]);

  // Check if current max rounds is fair
  const isCurrentlyFair = useMemo(() => {
    if (maxRoundsPossible <= 0) return false;
    if (playerCount === 4 && courtCount === 1) {
      return maxRoundsPossible % 3 === 0;
    }
    if (playerCount === activePlayersPerRound) {
      // Everyone plays every single round, so all have identical matches!
      return true;
    }
    return (maxRoundsPossible * activePlayersPerRound) % playerCount === 0;
  }, [maxRoundsPossible, playerCount, courtCount, activePlayersPerRound]);

  // Nearest recommended fair round counts (e.g. closest <= maxRounds, or closest >= maxRounds)
  const recommendedFairRounds = useMemo(() => {
    if (maxRoundsPossible <= 0) return 0;
    if (playerCount === 4 && courtCount === 1) {
      const lower = Math.floor(maxRoundsPossible / 3) * 3;
      return lower > 0 ? lower : 3;
    }
    if (playerCount === activePlayersPerRound) {
      // If 8 players (7 rounds full cycle), suggest 7 if close, otherwise max is fair
      const fullCycle = playerCount - 1;
      if (maxRoundsPossible >= fullCycle) return fullCycle;
      return maxRoundsPossible;
    }
    // Odd rotation
    const step = fairRoundStep;
    const lower = Math.floor(maxRoundsPossible / step) * step;
    if (lower > 0) return lower;
    return step;
  }, [maxRoundsPossible, playerCount, courtCount, activePlayersPerRound, fairRoundStep]);

  // Statistics per player at current max rounds
  const statsPerPlayer = useMemo(() => {
    if (maxRoundsPossible <= 0) return { matches: 0, rests: 0, activePct: 0 };
    const totalPlayerSlots = maxRoundsPossible * activePlayersPerRound;
    const avgMatches = totalPlayerSlots / playerCount;
    const avgRests = maxRoundsPossible - avgMatches;
    const activePct = Math.round((avgMatches / maxRoundsPossible) * 100);
    return {
      matches: Math.round(avgMatches * 10) / 10,
      rests: Math.round(avgRests * 10) / 10,
      activePct
    };
  }, [maxRoundsPossible, activePlayersPerRound, playerCount]);

  // Smart recommendation: Optimal points for standard booking
  const smartPointSuggestions = useMemo(() => {
    // Check points 16, 21, 24, 32 and how many rounds they produce
    const testPoints = [16, 21, 24, 32];
    return testPoints.map(pts => {
      const matchMin = (pts / 24) * avgDurationPer24;
      const rounds = Math.floor((effectivePlayTime + pauseDuration) / (matchMin + pauseDuration));
      const isFair = playerCount === 4 
        ? rounds % 3 === 0 
        : playerCount === activePlayersPerRound 
        ? (rounds === playerCount - 1 || rounds % (playerCount - 1) === 0)
        : (rounds * activePlayersPerRound) % playerCount === 0;
      
      const time = warmupMinutes + (rounds * matchMin + (rounds > 1 ? (rounds - 1) * pauseDuration : 0));
      return {
        points: pts,
        matchMin: Math.round(matchMin * 10) / 10,
        rounds,
        isFair,
        totalTime: Math.round(time)
      };
    });
  }, [avgDurationPer24, effectivePlayTime, pauseDuration, playerCount, activePlayersPerRound, warmupMinutes]);

  // Generate timetable with timestamps
  const scheduleTimeline = useMemo(() => {
    if (maxRoundsPossible <= 0) return [];
    
    // Parse startTimeStr "HH:MM"
    const [startH, startM] = startTimeStr.split(':').map(n => parseInt(n, 10) || 0);
    let currentTotalMin = (startH * 60 + startM) % 1440;

    const formatTime = (totalMins: number) => {
      const h = Math.floor(totalMins / 60) % 24;
      const m = Math.floor(totalMins % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const items: Array<{
      type: 'warmup' | 'match' | 'pause';
      roundNumber?: number;
      label: string;
      start: string;
      end: string;
      duration: number;
    }> = [];

    // Warmup
    if (warmupMinutes > 0) {
      const wEnd = currentTotalMin + warmupMinutes;
      items.push({
        type: 'warmup',
        label: isEnglish ? 'Court warm-up & rally' : 'Oppvarming på banen',
        start: formatTime(currentTotalMin),
        end: formatTime(wEnd),
        duration: warmupMinutes
      });
      currentTotalMin = wEnd;
    }

    // Rounds
    for (let r = 1; r <= maxRoundsPossible; r++) {
      const mEnd = currentTotalMin + matchDurationMinutes;
      items.push({
        type: 'match',
        roundNumber: r,
        label: isEnglish ? `Round ${r} (${targetScore} pts)` : `Runde ${r} (${targetScore} poeng)`,
        start: formatTime(currentTotalMin),
        end: formatTime(mEnd),
        duration: Math.round(matchDurationMinutes * 10) / 10
      });
      currentTotalMin = mEnd;

      // Pause if not last round
      if (r < maxRoundsPossible && pauseDuration > 0) {
        const pEnd = currentTotalMin + pauseDuration;
        items.push({
          type: 'pause',
          label: isEnglish ? 'Break & rotation' : 'Pause & rotering',
          start: formatTime(currentTotalMin),
          end: formatTime(pEnd),
          duration: pauseDuration
        });
        currentTotalMin = pEnd;
      }
    }

    return items;
  }, [maxRoundsPossible, startTimeStr, warmupMinutes, matchDurationMinutes, targetScore, pauseDuration, isEnglish]);

  // Handle Copy schedule to clipboard
  const handleCopySchedule = () => {
    if (scheduleTimeline.length === 0) return;
    
    const lines = [
      `🎾 ${isEnglish ? 'PADEL AMERICANO SCHEDULE' : 'PADEL AMERICANO TIDSPLAN'} (${totalTimeMinutes} min)`,
      `👥 ${playerCount} ${isEnglish ? 'players' : 'spillere'} | 🏟️ ${courtCount} ${courtCount === 1 ? (isEnglish ? 'court' : 'bane') : (isEnglish ? 'courts' : 'baner')} | 🎯 ${targetScore} ${isEnglish ? 'pts/match' : 'poeng/kamp'}`,
      `⏱️ ${isEnglish ? 'Capacity:' : 'Rekker:'} ${maxRoundsPossible} ${maxRoundsPossible === 1 ? (isEnglish ? 'round' : 'runde') : (isEnglish ? 'rounds' : 'runder')} (${actualTimeUsed} ${isEnglish ? 'min used' : 'min brukt'})\n`,
      ...scheduleTimeline.map(item => {
        if (item.type === 'warmup') return `🔥 ${item.start} - ${item.end}: ${item.label} (${item.duration} min)`;
        if (item.type === 'match') return `🎾 ${item.start} - ${item.end}: ${item.label}`;
        return `⏸️ ${item.start} - ${item.end}: ${item.label} (${item.duration}m)`;
      }),
      `\n${isEnglish ? 'Organized with PadelFlex' : 'Organisert med PadelFlex'}`
    ];

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedSchedule(true);
      setTimeout(() => setCopiedSchedule(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/85 backdrop-blur-md" 
        onClick={onClose} 
      />

      <div className="min-h-full flex items-start sm:items-center justify-center p-2.5 sm:p-4 relative pointer-events-none">
        <div className="bg-[#141414] border border-gray-800 rounded-2xl sm:rounded-3xl max-w-2xl w-full p-3.5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative z-10 my-2 sm:my-8 text-white pointer-events-auto">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 sm:pb-4 sticky -top-3.5 sm:static bg-[#141414] z-20 pt-0.5 sm:pt-0">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#BFFF00]/15 border border-[#BFFF00]/30 flex items-center justify-center text-[#BFFF00] shrink-0">
                <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h3 className="font-extrabold text-sm sm:text-lg text-white truncate">
                    {isEnglish ? 'Americano Time Calculator' : 'Americano Tidskalkulator'}
                  </h3>
                  <span className="px-1.5 sm:px-2 py-0.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] text-[9px] sm:text-[10px] font-mono font-bold rounded-full uppercase shrink-0">
                    {isEnglish ? 'Calculator' : 'Beregner'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-400 truncate sm:whitespace-normal">
                  {isEnglish ? 'Find exactly how many rounds you can fit in your court booking' : 'Finn nøyaktig hvor mange runder dere rekker på banetiden'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition shrink-0 ml-2"
              aria-label={isEnglish ? 'Close' : 'Lukk'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* ================= 1. HOVEDRESULTAT BOKS ================= */}
        <div className="bg-gradient-to-br from-[#1c2613] via-[#141a0f] to-[#0d100b] border border-[#BFFF00]/40 rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-[0_0_30px_rgba(191,255,0,0.1)]">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#BFFF00]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#BFFF00] font-black flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> {isEnglish ? 'Calculated Result' : 'Beregnet resultat'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-black font-mono text-[#BFFF00]">
                  {maxRoundsPossible}
                </span>
                <span className="text-base sm:text-lg font-extrabold text-white">
                  {maxRoundsPossible === 1 ? (isEnglish ? 'round' : 'runde') : (isEnglish ? 'rounds' : 'runder')}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">
                {isEnglish
                  ? `Total ${actualTimeUsed} minutes of ${totalTimeMinutes} min booking (${remainingBufferMinutes} min buffer)`
                  : `Totalt ${actualTimeUsed} minutter av ${totalTimeMinutes} min booking (${remainingBufferMinutes} min buffer)`}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 shrink-0 font-mono text-xs">
              <div className="bg-black/50 border border-gray-800/80 rounded-xl p-2 sm:p-2.5">
                <span className="text-[10px] text-gray-400 block">{isEnglish ? 'Duration/match' : 'Varighet/kamp'}</span>
                <span className="font-extrabold text-white text-sm">
                  {Math.floor(matchDurationMinutes)}m {Math.round((matchDurationMinutes % 1) * 60)}s
                </span>
              </div>
              <div className="bg-black/50 border border-gray-800/80 rounded-xl p-2 sm:p-2.5">
                <span className="text-[10px] text-gray-400 block">{isEnglish ? 'Pause/swap' : 'Pause/bytte'}</span>
                <span className="font-extrabold text-white text-sm">{pauseDuration} min</span>
              </div>
            </div>
          </div>

          {/* Fairness Indicator Badge */}
          <div className="mt-4 pt-3 border-t border-gray-800/70 text-xs">
            {playerCount === 4 ? (
              isCurrentlyFair ? (
                <div className="flex items-start gap-2 text-green-300 bg-green-500/10 border border-green-500/30 p-2.5 rounded-xl">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
                  <div>
                    <strong>{isEnglish ? '100% Fair Americano (4 players):' : '100% Rettferdig Americano (4 spillere):'}</strong> {isEnglish ? `All 4 play with and against each other exactly ${maxRoundsPossible / 3} time(s).` : `Alle 4 spiller mot og med hverandre nøyaktig ${maxRoundsPossible / 3} gang(er).`}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <strong>{isEnglish ? 'Note with 4 players:' : 'Merk ved 4 spillere:'}</strong> {isEnglish ? `A complete Americano cycle requires 3 rounds (or 6 rounds). You have time for ${maxRoundsPossible} rounds.` : `En hel Americano-syklus der alle spiller med alle krever 3 runder (eller 6 runder). Dere rekker ${maxRoundsPossible} runder.`}
                    {recommendedFairRounds > 0 && recommendedFairRounds !== maxRoundsPossible && (
                      <button
                        type="button"
                        onClick={() => {
                          // Adjust time or points suggestion
                          const targetMin = calcTotalTimeForRounds(recommendedFairRounds) + warmupMinutes;
                          setTotalTimeMinutes(Math.round(targetMin));
                        }}
                        className="block mt-1 font-bold underline text-[#BFFF00] hover:text-white"
                      >
                        {isEnglish ? `Adjust to ${recommendedFairRounds} rounds (${Math.round(calcTotalTimeForRounds(recommendedFairRounds) + warmupMinutes)} min)?` : `Juster til ${recommendedFairRounds} runder (${Math.round(calcTotalTimeForRounds(recommendedFairRounds) + warmupMinutes)} min)?`}
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : playerCount === activePlayersPerRound ? (
              <div className="flex items-start gap-2 text-green-300 bg-green-500/10 border border-green-500/30 p-2.5 rounded-xl">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
                <div>
                  <strong>{isEnglish ? 'Equal playtime for all:' : 'Lik spilletid på alle:'}</strong> {isEnglish ? `All ${playerCount} players play in every round (${maxRoundsPossible} matches per person).` : `Alle ${playerCount} spillere spiller i samtlige runder (${maxRoundsPossible} kamper per person).`}
                  {maxRoundsPossible >= playerCount - 1 ? (
                    <span className="block text-[11px] text-gray-300 mt-0.5">
                      {isEnglish ? `🌟 You can fit a full rotation where everyone partners with everyone (${playerCount - 1} rounds)!` : `🌟 Dere rekker en full rotasjon der alle har vært makkere med alle (${playerCount - 1} runder)!`}
                    </span>
                  ) : (
                    <span className="block text-[11px] text-gray-300 mt-0.5">
                      {isEnglish ? `(A full rotation with all partner combinations requires ${playerCount - 1} rounds).` : `(For å rekke full rotasjon der alle er makkere med alle kreves ${playerCount - 1} runder).`}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              isCurrentlyFair ? (
                <div className="flex items-start gap-2 text-green-300 bg-green-500/10 border border-green-500/30 p-2.5 rounded-xl">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
                  <div>
                    <strong>{isEnglish ? `Fair rotation (${playerCount} players):` : `Rettferdig rotasjon (${playerCount} spillere):`}</strong> {isEnglish ? `With ${maxRoundsPossible} rounds, every player gets exactly ${statsPerPlayer.matches} matches each and ${statsPerPlayer.rests} resting rounds!` : `Ved ${maxRoundsPossible} runder får alle spillere nøyaktig ${statsPerPlayer.matches} kamper hver og ${statsPerPlayer.rests} runder pause!`}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <strong>{isEnglish ? `Uneven rest distribution at ${maxRoundsPossible} rounds:` : `Ujevn pausefordeling ved ${maxRoundsPossible} runder:`}</strong> {isEnglish ? 'Some players will play 1 match more than others.' : 'Noen spillere vil få 1 kamp mer enn andre.'}
                    <span className="block mt-0.5 text-gray-300">
                      {isEnglish ? `💡 For 100% equal playtime, play a multiple of ${fairRoundStep} rounds (e.g. ${recommendedFairRounds} rounds).` : `💡 For 100% lik spilletid må dere spille et multiplum av ${fairRoundStep} runder (f.eks. ${recommendedFairRounds} runder).`}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* ================= 2. PARAMETERE OG INPUTS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* VENSTRE: TID & SPILLERE */}
          <div className="space-y-3.5 bg-black/40 border border-gray-800/90 p-4 rounded-2xl">
            
            {/* Tilgjengelig tid / banetid */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#BFFF00]" /> {isEnglish ? 'Available court time' : 'Tilgjengelig halltid'}
                </label>
                <span className="text-xs font-mono font-black text-[#BFFF00]">{totalTimeMinutes} min</span>
              </div>

              {/* Raske presets */}
              <div className="grid grid-cols-5 gap-1 mb-2">
                {[60, 90, 120, 150, 180].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTotalTimeMinutes(t)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                      totalTimeMinutes === t
                        ? 'bg-[#BFFF00] text-black shadow-sm'
                        : 'bg-gray-850 text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {t}m
                  </button>
                ))}
              </div>

              <input
                type="range"
                min="30"
                max="240"
                step="5"
                value={totalTimeMinutes}
                onChange={(e) => setTotalTimeMinutes(Number(e.target.value))}
                className="w-full accent-[#BFFF00] cursor-pointer"
              />
            </div>

            {/* Antall spillere */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-400" /> {isEnglish ? 'Number of players' : 'Antall spillere'}
                </label>
                <span className="text-xs font-mono font-black text-cyan-400">{playerCount} {isEnglish ? 'players' : 'spillere'}</span>
              </div>

              {/* Raske presets for spillere */}
              <div className="grid grid-cols-5 gap-1 mb-2">
                {[4, 5, 8, 12, 16].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPlayerCount(p);
                      setOverrideCourtCount(null);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                      playerCount === p
                        ? 'bg-cyan-400 text-black shadow-sm'
                        : 'bg-gray-850 text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {p}p
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlayerCount(Math.max(4, playerCount - 1))}
                  className="w-8 h-8 rounded-lg bg-gray-850 hover:bg-gray-800 font-mono font-bold text-sm"
                >
                  -
                </button>
                <input
                  type="range"
                  min="4"
                  max="24"
                  step="1"
                  value={playerCount}
                  onChange={(e) => {
                    setPlayerCount(Number(e.target.value));
                    setOverrideCourtCount(null);
                  }}
                  className="flex-1 accent-cyan-400 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setPlayerCount(Math.min(24, playerCount + 1))}
                  className="w-8 h-8 rounded-lg bg-gray-850 hover:bg-gray-800 font-mono font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Antall baner */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-gray-400" /> {isEnglish ? 'Number of courts' : 'Antall baner'}
                </label>
                <span className="text-xs font-mono text-gray-400">
                  {courtCount} {courtCount === 1 ? (isEnglish ? 'court' : 'bane') : (isEnglish ? 'courts' : 'baner')}
                  {overrideCourtCount !== null && (isEnglish ? ' (overridden)' : ' (overstyrt)')}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setOverrideCourtCount(c)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                      courtCount === c
                        ? 'bg-gray-700 text-white border border-[#BFFF00]/50'
                        : 'bg-gray-850 text-gray-400 hover:text-white'
                    }`}
                  >
                    {c} {c === 1 ? (isEnglish ? 'court' : 'bane') : (isEnglish ? 'courts' : 'baner')}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* HØYRE: POENG & VARIGHET */}
          <div className="space-y-3.5 bg-black/40 border border-gray-800/90 p-4 rounded-2xl">
            
            {/* Målscore per kamp */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" /> {isEnglish ? 'Target score per match' : 'Målscore per kamp'}
                </label>
                <span className="text-xs font-mono font-black text-amber-400">{targetScore} {isEnglish ? 'points' : 'poeng'}</span>
              </div>

              {/* Raske presets for poeng */}
              <div className="grid grid-cols-4 gap-1 mb-2">
                {[16, 21, 24, 32].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setTargetScore(pts)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                      targetScore === pts
                        ? 'bg-amber-400 text-black shadow-sm'
                        : 'bg-gray-850 text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {pts}p
                  </button>
                ))}
              </div>

              <input
                type="range"
                min="12"
                max="40"
                step="1"
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Snitt varighet per 24 poeng */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#BFFF00]" /> {isEnglish ? 'Average time per 24 points' : 'Snitt-tid per 24 poeng'}
                </label>
                <span className="text-xs font-mono font-black text-[#BFFF00]">{avgDurationPer24} min</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-1.5">
                {isEnglish ? 'Experience shows 24p takes ~10 min. Adjust if your group plays faster or slower.' : 'Erfaringsmessig tar 24p ca. 10 min. Juster hvis gruppen spiller raskere eller saktere.'}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="6"
                  max="16"
                  step="0.5"
                  value={avgDurationPer24}
                  onChange={(e) => setAvgDurationPer24(Number(e.target.value))}
                  className="w-full accent-[#BFFF00] cursor-pointer"
                />
              </div>
            </div>

            {/* Pause & oppvarming */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-800/80">
              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">
                  {isEnglish ? 'Pause between matches' : 'Pause mellom kamper'}
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPauseDuration(p)}
                      className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition ${
                        pauseDuration === p ? 'bg-gray-700 text-white border border-gray-500' : 'bg-gray-850 text-gray-400'
                      }`}
                    >
                      {p}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">
                  {isEnglish ? 'Warm-up at start' : 'Oppvarming i starten'}
                </label>
                <div className="flex items-center gap-1">
                  {[0, 5, 10].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWarmupMinutes(w)}
                      className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition ${
                        warmupMinutes === w ? 'bg-gray-700 text-white border border-gray-500' : 'bg-gray-850 text-gray-400'
                      }`}
                    >
                      {w}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* ================= 3. SMARTE ANBEFALINGER (HVA OM VI ENDRER POENG?) ================= */}
        <div className="bg-black/40 border border-gray-800/90 rounded-2xl p-3.5 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#BFFF00] font-black flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> {isEnglish ? `Smart suggestions: Compare scores for ${totalTimeMinutes} min` : `Smarte forslag: Sammenlign poengsummer for ${totalTimeMinutes} min`}
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {smartPointSuggestions.map((s) => (
              <button
                key={s.points}
                type="button"
                onClick={() => setTargetScore(s.points)}
                className={`p-2.5 rounded-xl border text-left transition ${
                  targetScore === s.points
                    ? 'bg-[#BFFF00]/10 border-[#BFFF00] shadow-sm'
                    : 'bg-black/30 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-white">{s.points} {isEnglish ? 'points' : 'poeng'}</span>
                  {s.isFair && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-green-500/20 text-green-400 rounded">
                      {isEnglish ? 'Fair' : 'Rettferdig'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-300 font-mono mt-1">
                  <strong>{s.rounds}</strong> {isEnglish ? 'rounds' : 'runder'} ({s.totalTime}m)
                </div>
                <div className="text-[9px] text-gray-500 font-mono">
                  {isEnglish ? `~${s.matchMin} min/match` : `ca. ${s.matchMin} min/kamp`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ================= 4. DETALJERT TIDSPLAN / KAMPPROGRAM (OG KOPIERING) ================= */}
        <div className="border border-gray-800 rounded-2xl p-3.5 bg-black/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDetailedSchedule(!showDetailedSchedule)}
                className="text-xs font-bold text-white flex items-center gap-1 hover:text-[#BFFF00] transition"
              >
                <Calendar className="w-3.5 h-3.5 text-[#BFFF00]" />
                <span>{showDetailedSchedule ? (isEnglish ? 'Hide schedule' : 'Skjul tidsplan') : (isEnglish ? 'Show match schedule with times' : 'Vis kampprogram med klokkeslett')}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDetailedSchedule ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {showDetailedSchedule && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{isEnglish ? 'Start:' : 'Start:'}</span>
                <input
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded px-2 py-0.5 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={handleCopySchedule}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-750 text-xs font-bold rounded-lg flex items-center gap-1 transition"
                >
                  {copiedSchedule ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">{isEnglish ? 'Copied!' : 'Kopiert!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-gray-400" />
                      <span>{isEnglish ? 'Copy schedule' : 'Kopier plan'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {showDetailedSchedule && (
            <div className="pt-2 border-t border-gray-800/60 max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
              {scheduleTimeline.map((item, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded-xl border ${
                    item.type === 'warmup'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      : item.type === 'pause'
                      ? 'bg-gray-900/40 border-gray-800 text-gray-400 text-[11px]'
                      : 'bg-black/60 border-gray-800 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#BFFF00]">{item.start} - {item.end}</span>
                    <span>{item.label}</span>
                  </div>
                  <span className="text-gray-400 text-[10px]">{item.duration} min</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= 5. FOOTER ACTIONS ================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-800/80">
          <div className="text-[11px] text-gray-400 font-mono text-center sm:text-left">
            {isEnglish ? '🎯 Tip: Playing with 21 or 24 points fits the most balanced matches.' : '🎯 Tips: Spiller dere med 21 eller 24 poeng rekker dere flest mulig jevne kamper.'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {(onApplySettings || onStartTournamentWithSettings) && (
              <button
                type="button"
                onClick={() => {
                  if (onApplySettings) {
                    onApplySettings({
                      targetScore,
                      courtCount,
                      playerCount
                    });
                  } else if (onStartTournamentWithSettings) {
                    onStartTournamentWithSettings({
                      targetScore,
                      courtCount,
                      playerCount
                    });
                  }
                  onClose();
                }}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#BFFF00] hover:bg-[#b0eb00] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-[0_0_15px_rgba(191,255,0,0.3)]"
              >
                {onApplySettings ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{confirmButtonLabel || (onApplySettings ? (isEnglish ? 'Apply to tournament' : 'Overfør til turnering') : (isEnglish ? 'Use these settings' : 'Bruk dette oppsettet'))}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-850 hover:bg-gray-800 text-gray-300 hover:text-white font-bold text-xs rounded-xl transition"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
