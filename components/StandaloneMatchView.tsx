'use client';

import ResultCardModal from "./ResultCardModal";
import { useState, useEffect, useTransition, useMemo } from 'react';
import { 
  Swords, 
  Plus, 
  Trophy, 
  Play, 
  RotateCcw, 
  Check, 
  Share2, 
  Trash2, 
  Volume2, 
  VolumeX, 
  ChevronRight, 
  Sparkles, 
  Flame, 
  Activity, 
  Users, 
  ArrowLeft,
  Shuffle,
  X,
  Clock,
  Award
} from 'lucide-react';
import { 
  createStandaloneMatch, 
  getStandaloneMatches, 
  saveStandaloneMatch, 
  deleteStandaloneMatch,
  addPlayer
} from '@/app/actions';
import { useAuth } from './AuthContext';
import { isMatchEditable } from '@/lib/match-utils';


type StandaloneMatchViewProps = {
  allPlayers: any[];
};

type DeuceRule = 'GOLDEN_POINT' | 'ADVANTAGE';

type MatchScoreState = {
  sets: { teamA: number; teamB: number }[];
  currentSetIndex: number;
  currentPoints: { teamA: string; teamB: string }; // '0', '15', '30', '40', 'AD'
  isTiebreak: boolean;
  tiebreakScores: { teamA: number; teamB: number };
  servingTeam: 'A' | 'B';
  servingPlayer: 1 | 2;
  deuceRule?: DeuceRule;
  history: MatchScoreState[];
  events: string[];
  gameScoresHistory?: {
    setIndex: number;
    gameNumber: number;
    winner: 'A' | 'B';
    wasGoldenPoint: boolean;
    wasBreakPoint: boolean;
  }[];
  matchStats?: {
    teamAPointsTotal: number;
    teamBPointsTotal: number;
    goldenPointsPlayed: number;
    goldenPointsWonA: number;
    goldenPointsWonB: number;
    breakPointsA: number;
    breakPointsB: number;
    breakPointsConvertedA: number;
    breakPointsConvertedB: number;
  };
};

function playBeep(type: 'point' | 'game' | 'set' | 'match') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'match') {
      [0, 0.15, 0.3, 0.45].forEach((d, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(i === 3 ? 1046.5 : 523.25 + i * 130, ctx.currentTime + d);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + d);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + d + 0.14);
        osc.start(ctx.currentTime + d);
        osc.stop(ctx.currentTime + d + 0.15);
      });
    } else if (type === 'set' || type === 'game') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'set' ? 880 : 659.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch {
    // Ignore audio permission
  }
}

export default function StandaloneMatchView({ allPlayers }: StandaloneMatchViewProps) {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
  const [scoreState, setScoreState] = useState<MatchScoreState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isNewMatchModalOpen, setIsNewMatchModalOpen] = useState<boolean>(false);
  const [resultCardMatch, setResultCardMatch] = useState<any | null>(null);

  // Form State for creating a match
  const [formMatchName, setFormMatchName] = useState<string>('Ordinær padelkamp');
  const [formTeamAPlayer1, setFormTeamAPlayer1] = useState<string>('');
  const [formTeamAPlayer2, setFormTeamAPlayer2] = useState<string>('');
  const [formTeamBPlayer1, setFormTeamBPlayer1] = useState<string>('');
  const [formTeamBPlayer2, setFormTeamBPlayer2] = useState<string>('');
  const [formFormat, setFormFormat] = useState<'BEST_OF_3' | 'BEST_OF_3_SUPER_TB' | 'BEST_OF_1'>('BEST_OF_3');
  const [formDeuceRule, setFormDeuceRule] = useState<DeuceRule>('GOLDEN_POINT');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick player addition inside modal
  const [isAddingQuickPlayer, setIsAddingQuickPlayer] = useState(false);
  const [quickPlayerName, setQuickPlayerName] = useState('');
  const [isPending, startTransition] = useTransition();

  // Load matches
  const loadMatches = async () => {
    try {
      setLoading(true);
      const data = await getStandaloneMatches();
      setMatches(data || []);
    } catch (err) {
      console.error('Failed to load standalone matches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getStandaloneMatches()
      .then((data) => {
        if (isMounted) {
          setMatches(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load matches:', err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectMatch = (match: any | null) => {
    setActiveMatch(match);
    if (match && match.scoresJson) {
      try {
        const parsed = JSON.parse(match.scoresJson);
        setScoreState(parsed);
      } catch (err) {
        console.error('Failed to parse match scores:', err);
      }
    } else {
      setScoreState(null);
    }
  };

  // Helper to determine where a player is placed in current form
  const getPlayerSlot = (name: string) => {
    if (!name) return null;
    if (formTeamAPlayer1.toLowerCase() === name.toLowerCase()) return 'A1';
    if (formTeamAPlayer2.toLowerCase() === name.toLowerCase()) return 'A2';
    if (formTeamBPlayer1.toLowerCase() === name.toLowerCase()) return 'B1';
    if (formTeamBPlayer2.toLowerCase() === name.toLowerCase()) return 'B2';
    return null;
  };

  const handleTogglePlayerInModal = (playerName: string) => {
    const slot = getPlayerSlot(playerName);
    if (slot) {
      // Remove from slot
      if (slot === 'A1') setFormTeamAPlayer1('');
      else if (slot === 'A2') setFormTeamAPlayer2('');
      else if (slot === 'B1') setFormTeamBPlayer1('');
      else if (slot === 'B2') setFormTeamBPlayer2('');
    } else {
      // Assign to first empty slot
      if (!formTeamAPlayer1) setFormTeamAPlayer1(playerName);
      else if (!formTeamAPlayer2) setFormTeamAPlayer2(playerName);
      else if (!formTeamBPlayer1) setFormTeamBPlayer1(playerName);
      else if (!formTeamBPlayer2) setFormTeamBPlayer2(playerName);
    }
  };

  const handleShuffleTeams = () => {
    const currentList = [formTeamAPlayer1, formTeamAPlayer2, formTeamBPlayer1, formTeamBPlayer2].filter(Boolean);
    if (currentList.length < 4) return;
    const shuffled = [...currentList].sort(() => Math.random() - 0.5);
    setFormTeamAPlayer1(shuffled[0]);
    setFormTeamAPlayer2(shuffled[1]);
    setFormTeamBPlayer1(shuffled[2]);
    setFormTeamBPlayer2(shuffled[3]);
  };

  const handleClearSlots = () => {
    setFormTeamAPlayer1('');
    setFormTeamAPlayer2('');
    setFormTeamBPlayer1('');
    setFormTeamBPlayer2('');
  };

  const handleCreateQuickPlayer = () => {
    if (!quickPlayerName.trim()) return;
    startTransition(async () => {
      try {
        const p = await addPlayer(quickPlayerName.trim());
        // Auto assign to empty slot
        if (!formTeamAPlayer1) setFormTeamAPlayer1(p.name);
        else if (!formTeamAPlayer2) setFormTeamAPlayer2(p.name);
        else if (!formTeamBPlayer1) setFormTeamBPlayer1(p.name);
        else if (!formTeamBPlayer2) setFormTeamBPlayer2(p.name);
        setQuickPlayerName('');
        setIsAddingQuickPlayer(false);
      } catch (err: any) {
        alert(err.message || 'Kunne ikke opprette spiller');
      }
    });
  };

  // Point scoring logic
  const handleScorePoint = async (team: 'A' | 'B') => {
    if (!activeMatch || !scoreState || activeMatch.isCompleted) return;

    if (soundEnabled) {
      playBeep('point');
    }

    const nextState: MatchScoreState = JSON.parse(JSON.stringify(scoreState));
    // Save snapshot in history for undo
    const snapshot: MatchScoreState = JSON.parse(JSON.stringify(scoreState));
    delete (snapshot as any).history;
    nextState.history = [...(scoreState.history || []), snapshot];

    // Update stats
    if (!nextState.matchStats) {
      nextState.matchStats = {
        teamAPointsTotal: 0,
        teamBPointsTotal: 0,
        goldenPointsPlayed: 0,
        goldenPointsWonA: 0,
        goldenPointsWonB: 0,
        breakPointsA: 0,
        breakPointsB: 0,
        breakPointsConvertedA: 0,
        breakPointsConvertedB: 0,
      };
    }
    if (team === 'A') nextState.matchStats.teamAPointsTotal++;
    else nextState.matchStats.teamBPointsTotal++;

    // 1. TIEBREAK SCORING
    if (nextState.isTiebreak) {
      if (team === 'A') nextState.tiebreakScores.teamA++;
      else nextState.tiebreakScores.teamB++;

      const tA = nextState.tiebreakScores.teamA;
      const tB = nextState.tiebreakScores.teamB;

      // Super tiebreak (10 pts in 3rd set) or normal tiebreak (7 pts)
      const isSuperTB = activeMatch.format === 'BEST_OF_3_SUPER_TB' && nextState.currentSetIndex === 2;
      const targetPts = isSuperTB ? 10 : 7;

      if ((tA >= targetPts || tB >= targetPts) && Math.abs(tA - tB) >= 2) {
        // Set Won in tiebreak
        handleSetWon(nextState, tA > tB ? 'A' : 'B', true);
      } else {
        // Switch serve every odd sum of points
        const sumPoints = tA + tB;
        if (sumPoints % 2 === 1) {
          nextState.servingTeam = nextState.servingTeam === 'A' ? 'B' : 'A';
        }
      }
    } else {
      // 2. REGULAR GAME SCORING
      const pA = nextState.currentPoints.teamA;
      const pB = nextState.currentPoints.teamB;

      const effectiveDeuceRule: DeuceRule = 
        nextState.deuceRule || 
        (activeMatch.deuceRule as DeuceRule) || 
        (activeMatch.goldenPoint === false ? 'ADVANTAGE' : 'GOLDEN_POINT');

      if (effectiveDeuceRule === 'GOLDEN_POINT') {
        if (pA === '40' && pB === '40') {
          nextState.matchStats.goldenPointsPlayed = (nextState.matchStats.goldenPointsPlayed || 0) + 1;
          if (team === 'A') nextState.matchStats.goldenPointsWonA = (nextState.matchStats.goldenPointsWonA || 0) + 1;
          else nextState.matchStats.goldenPointsWonB = (nextState.matchStats.goldenPointsWonB || 0) + 1;
          handleGameWon(nextState, team);
        } else {
          if (team === 'A') {
            if (pA === '0') nextState.currentPoints.teamA = '15';
            else if (pA === '15') nextState.currentPoints.teamA = '30';
            else if (pA === '30') nextState.currentPoints.teamA = '40';
            else if (pA === '40') {
              if (pB === '40') {
                // Now at 40-40 (Golden point next)
              } else {
                handleGameWon(nextState, 'A');
              }
            }
          } else {
            if (pB === '0') nextState.currentPoints.teamB = '15';
            else if (pB === '15') nextState.currentPoints.teamB = '30';
            else if (pB === '30') nextState.currentPoints.teamB = '40';
            else if (pB === '40') {
              if (pA === '40') {
                // Now at 40-40 (Golden point next)
              } else {
                handleGameWon(nextState, 'B');
              }
            }
          }
        }
      } else {
        // Traditional Advantage (Fordel inn / ut)
        if (team === 'A') {
          if (pA === '0') nextState.currentPoints.teamA = '15';
          else if (pA === '15') nextState.currentPoints.teamA = '30';
          else if (pA === '30') nextState.currentPoints.teamA = '40';
          else if (pA === '40') {
            if (pB === '40') nextState.currentPoints.teamA = 'AD';
            else if (pB === 'AD') nextState.currentPoints.teamB = '40';
            else handleGameWon(nextState, 'A');
          } else if (pA === 'AD') {
            handleGameWon(nextState, 'A');
          }
        } else {
          if (pB === '0') nextState.currentPoints.teamB = '15';
          else if (pB === '15') nextState.currentPoints.teamB = '30';
          else if (pB === '30') nextState.currentPoints.teamB = '40';
          else if (pB === '40') {
            if (pA === '40') nextState.currentPoints.teamB = 'AD';
            else if (pA === 'AD') nextState.currentPoints.teamA = '40';
            else handleGameWon(nextState, 'B');
          } else if (pB === 'AD') {
            handleGameWon(nextState, 'B');
          }
        }
      }
    }

    // Check if match won
    let matchWinner: 'A' | 'B' | null = null;
    const setsA = nextState.sets.filter((s, idx) => idx < nextState.currentSetIndex && s.teamA > s.teamB).length;
    const setsB = nextState.sets.filter((s, idx) => idx < nextState.currentSetIndex && s.teamB > s.teamA).length;
    const requiredSets = activeMatch.format === 'BEST_OF_1' ? 1 : 2;

    let isCompleted = false;
    if (setsA >= requiredSets) {
      matchWinner = 'A';
      isCompleted = true;
    } else if (setsB >= requiredSets) {
      matchWinner = 'B';
      isCompleted = true;
    }

    if (isCompleted && soundEnabled) {
      playBeep('match');
    }

    // Save update to server & local state
    setScoreState(nextState);
    const jsonStr = JSON.stringify(nextState);
    const updated = await saveStandaloneMatch(activeMatch.id, jsonStr, matchWinner, isCompleted);
    setActiveMatch(updated);
  };

  // Handle Game Won
  const handleGameWon = (state: MatchScoreState, winnerTeam: 'A' | 'B') => {
    state.currentPoints = { teamA: '0', teamB: '0' };
    state.servingTeam = state.servingTeam === 'A' ? 'B' : 'A';

    const currentSet = state.sets[state.currentSetIndex];
    if (winnerTeam === 'A') {
      currentSet.teamA++;
    } else {
      currentSet.teamB++;
    }

    const gA = currentSet.teamA;
    const gB = currentSet.teamB;

    // Check if set is won
    if ((gA >= 6 || gB >= 6) && Math.abs(gA - gB) >= 2) {
      handleSetWon(state, gA > gB ? 'A' : 'B', false);
    } else if (gA === 6 && gB === 6) {
      // Enter Tiebreak!
      state.isTiebreak = true;
      state.tiebreakScores = { teamA: 0, teamB: 0 };
      if (soundEnabled) playBeep('game');
    } else {
      if (soundEnabled) playBeep('game');
    }
  };

  // Handle Set Won
  const handleSetWon = (state: MatchScoreState, winnerTeam: 'A' | 'B', wasTiebreak: boolean) => {
    state.isTiebreak = false;
    state.tiebreakScores = { teamA: 0, teamB: 0 };
    state.currentPoints = { teamA: '0', teamB: '0' };

    // Move to next set index
    const nextSetIdx = state.currentSetIndex + 1;
    state.currentSetIndex = nextSetIdx;

    // Check if another set is needed
    const setsA = state.sets.filter((s, idx) => idx < nextSetIdx && s.teamA > s.teamB).length;
    const setsB = state.sets.filter((s, idx) => idx < nextSetIdx && s.teamB > s.teamA).length;
    const requiredSets = activeMatch.format === 'BEST_OF_1' ? 1 : 2;

    if (setsA < requiredSets && setsB < requiredSets) {
      state.sets.push({ teamA: 0, teamB: 0 });

      // If next set is 3rd set and format is BEST_OF_3_SUPER_TB, start super tiebreak right away
      if (nextSetIdx === 2 && activeMatch.format === 'BEST_OF_3_SUPER_TB') {
        state.isTiebreak = true;
        state.tiebreakScores = { teamA: 0, teamB: 0 };
      }
      if (soundEnabled) playBeep('set');
    }
  };

  // Handle Undo
  const handleUndo = async () => {
    if (!activeMatch || !scoreState || !scoreState.history || scoreState.history.length === 0) return;

    const history = [...scoreState.history];
    const prevSnapshot = history.pop();

    const restoredState: MatchScoreState = {
      ...prevSnapshot!,
      history,
    };

    setScoreState(restoredState);
    const jsonStr = JSON.stringify(restoredState);
    const updated = await saveStandaloneMatch(activeMatch.id, jsonStr, null, false);
    setActiveMatch(updated);
  };

  // Handle Create Match Form Submit
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTeamAPlayer1.trim() || !formTeamAPlayer2.trim() || !formTeamBPlayer1.trim() || !formTeamBPlayer2.trim()) {
      alert('Vennligst oppgi 2 spillere på Lag A og 2 spillere på Lag B.');
      return;
    }

    try {
      setIsSubmitting(true);
      const p1 = allPlayers.find(p => p.name.toLowerCase() === formTeamAPlayer1.trim().toLowerCase());
      const p2 = allPlayers.find(p => p.name.toLowerCase() === formTeamAPlayer2.trim().toLowerCase());
      const p3 = allPlayers.find(p => p.name.toLowerCase() === formTeamBPlayer1.trim().toLowerCase());
      const p4 = allPlayers.find(p => p.name.toLowerCase() === formTeamBPlayer2.trim().toLowerCase());

      const match = await createStandaloneMatch({
        name: formMatchName.trim() || 'Ordinær padelkamp',
        teamAPlayer1: formTeamAPlayer1.trim(),
        teamAPlayer2: formTeamAPlayer2.trim(),
        teamBPlayer1: formTeamBPlayer1.trim(),
        teamBPlayer2: formTeamBPlayer2.trim(),
        teamAPlayer1Id: p1?.id,
        teamAPlayer2Id: p2?.id,
        teamBPlayer1Id: p3?.id,
        teamBPlayer2Id: p4?.id,
        format: formFormat,
        goldenPoint: formDeuceRule !== 'ADVANTAGE',
        deuceRule: formDeuceRule,
      });

      setIsNewMatchModalOpen(false);
      await loadMatches();
      selectMatch(match);
    } catch (err: any) {
      console.error('Failed to create match:', err);
      alert('Kunne ikke opprette kampen: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMatch = async (id: string, matchDate: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin && !isMatchEditable(matchDate)) {
      alert('Kamper kan kun slettes på samme kalenderdag som de ble spilt. Kontakt administrator for sletting av eldre kamper.');
      return;
    }
    if (!confirm('Er du sikker på at du vil slette denne kampen?')) return;
    try {
      await deleteStandaloneMatch(id);
      if (activeMatch?.id === id) {
        selectMatch(null);
      }
      loadMatches();
    } catch (err: any) {
      alert(err.message || 'Kunne ikke slette kampen');
    }
  };

  // Calculate side change (Odd game sum in current set)
  const currentSet = scoreState?.sets[scoreState.currentSetIndex] || { teamA: 0, teamB: 0 };
  const totalGamesInSet = currentSet.teamA + currentSet.teamB;
  const isSideChangeNext = totalGamesInSet % 2 === 1;

  // Active / finished sets summary
  const teamASetsWon = scoreState?.sets.filter((s, idx) => idx < (scoreState?.currentSetIndex || 0) && s.teamA > s.teamB).length || 0;
  const teamBSetsWon = scoreState?.sets.filter((s, idx) => idx < (scoreState?.currentSetIndex || 0) && s.teamB > s.teamA).length || 0;

  // Selected count in modal
  const selectedInModalCount = [formTeamAPlayer1, formTeamAPlayer2, formTeamBPlayer1, formTeamBPlayer2].filter(Boolean).length;

  // ================= RENDER: ACTIVE MATCH PLAYING SCREEN =================
  if (activeMatch && scoreState) {
    const isCompleted = activeMatch.isCompleted;
    const winnerTeam = activeMatch.winnerTeam;

    const effectiveDeuceRule: DeuceRule = 
      scoreState.deuceRule || 
      (activeMatch.deuceRule as DeuceRule) || 
      (activeMatch.goldenPoint === false ? 'ADVANTAGE' : 'GOLDEN_POINT');

    const isGoldenPointNow = effectiveDeuceRule === 'GOLDEN_POINT' && !scoreState.isTiebreak && 
      scoreState.currentPoints.teamA === '40' && scoreState.currentPoints.teamB === '40';

    return (
      <div className="space-y-4 sm:space-y-6 animate-in fade-in">
        {/* Top bar with back button, sound toggle and status */}
        <div className="bg-[#141414] p-3.5 sm:p-4 rounded-3xl border border-gray-800 flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                selectMatch(null);
                loadMatches();
              }}
              className="p-2 sm:px-3 sm:py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 border border-gray-800"
            >
              <ArrowLeft className="w-4 h-4 text-[#BFFF00]" />
              <span className="hidden sm:inline">Alle kamper</span>
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00]">
                  Ordinær Padelkamp
                </span>
                <span className="px-2 py-0.5 bg-gray-900 border border-gray-800 text-gray-400 rounded-full text-[10px] font-mono">
                  {activeMatch.format === 'BEST_OF_3' ? 'Best av 3 sett' : activeMatch.format === 'BEST_OF_3_SUPER_TB' ? 'Best av 3 (Super-TB)' : '1 Sett'}
                </span>
                <span className="px-2 py-0.5 bg-black border border-gray-800 text-amber-400 rounded-full text-[10px] font-bold">
                  {effectiveDeuceRule === 'GOLDEN_POINT' ? 'Golden point' : 'Tradisjonell fordel'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">{activeMatch.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 sm:px-2.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs font-bold border transition flex items-center gap-1 ${
                soundEnabled 
                  ? 'bg-gray-900 text-[#BFFF00] border-gray-800 hover:bg-gray-800' 
                  : 'bg-gray-900/50 text-gray-500 border-gray-800'
              }`}
              title={soundEnabled ? 'Lyd er på' : 'Lyd er av'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {isCompleted && (
              <button
                type="button"
                onClick={() => setResultCardMatch(activeMatch)}
                className="px-3.5 py-2 bg-[#BFFF00] text-black font-extrabold text-xs rounded-xl sm:rounded-2xl flex items-center gap-1.5 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_15px_rgba(191,255,0,0.3)]"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Del resultatbilde</span>
              </button>
            )}
          </div>
        </div>

        {/* Winner Banner if match completed */}
        {isCompleted && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-[#BFFF00]/20 to-amber-500/20 border border-[#BFFF00]/50 rounded-3xl text-center space-y-2 animate-in zoom-in-95 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#BFFF00] text-black flex items-center justify-center mx-auto font-black shadow-[0_0_20px_rgba(191,255,0,0.4)]">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Vinner: {winnerTeam === 'A' ? `${activeMatch.teamAPlayer1} & ${activeMatch.teamAPlayer2}` : `${activeMatch.teamBPlayer1} & ${activeMatch.teamBPlayer2}`}!
            </h3>
            <p className="text-xs text-gray-300 font-medium">
              Gratulerer med seieren! Kampen er fullført og lagret i historikken.
            </p>
          </div>
        )}

        {/* Side switch indicator banner */}
        {!isCompleted && isSideChangeNext && (
          <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-between text-blue-300 text-xs">
            <span className="font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Oddetalls-game ({totalGamesInSet} games): Husk sidebytte etter dette gamet!
            </span>
          </div>
        )}

        {/* Golden Point alert */}
        {isGoldenPointNow && !isCompleted && (
          <div className="p-3.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-500/60 rounded-2xl text-center animate-pulse flex items-center justify-center gap-2 text-yellow-300">
            <Flame className="w-5 h-5 text-amber-400 fill-current" />
            <span className="font-black text-sm uppercase tracking-wider">
              ⭐ GOLDEN POINT (AVGJØRENDE BALL) ⭐
            </span>
          </div>
        )}

        {/* Main Live Scoreboard Container */}
        <div className="bg-[#141414] border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-6">
          {/* Sets Table Header & History */}
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-500 font-extrabold">
                  <th className="text-left py-2 px-3">Lag / Spillere</th>
                  <th className="w-12 py-2">S</th>
                  {scoreState.sets.map((_, idx) => (
                    <th 
                      key={idx} 
                      className={`w-14 py-2 ${
                        idx === scoreState.currentSetIndex && !isCompleted 
                          ? 'text-[#BFFF00] bg-[#BFFF00]/10 rounded-t-xl' 
                          : ''
                      }`}
                    >
                      Sett {idx + 1}
                    </th>
                  ))}
                  <th className="w-20 py-2 text-[#BFFF00]">Ball</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-sm sm:text-base font-black font-mono">
                {/* Team A Row */}
                <tr className={`${winnerTeam === 'A' ? 'bg-[#BFFF00]/5' : ''}`}>
                  <td className="text-left py-3 px-3">
                    <div className="flex items-center gap-2">
                      {scoreState.servingTeam === 'A' && !isCompleted && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#BFFF00] animate-ping" title="Server nå" />
                      )}
                      <div className="min-w-0">
                        <div className="text-white text-sm sm:text-base font-bold truncate">
                          {activeMatch.teamAPlayer1} & {activeMatch.teamAPlayer2}
                        </div>
                        <div className="text-[10px] text-gray-500 font-sans font-normal">Lag A</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-gray-400 py-3">{teamASetsWon}</td>
                  {scoreState.sets.map((s, idx) => (
                    <td 
                      key={idx} 
                      className={`py-3 text-lg sm:text-xl font-bold ${
                        idx === scoreState.currentSetIndex && !isCompleted
                          ? 'text-[#BFFF00] bg-[#BFFF00]/10' 
                          : s.teamA > s.teamB && idx < scoreState.currentSetIndex 
                          ? 'text-white' 
                          : 'text-gray-400'
                      }`}
                    >
                      {s.teamA}
                    </td>
                  ))}
                  <td className="py-3 text-2xl sm:text-3xl text-[#BFFF00] font-black">
                    {scoreState.isTiebreak 
                      ? scoreState.tiebreakScores.teamA 
                      : scoreState.currentPoints.teamA}
                  </td>
                </tr>

                {/* Team B Row */}
                <tr className={`${winnerTeam === 'B' ? 'bg-[#BFFF00]/5' : ''}`}>
                  <td className="text-left py-3 px-3">
                    <div className="flex items-center gap-2">
                      {scoreState.servingTeam === 'B' && !isCompleted && (
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" title="Server nå" />
                      )}
                      <div className="min-w-0">
                        <div className="text-white text-sm sm:text-base font-bold truncate">
                          {activeMatch.teamBPlayer1} & {activeMatch.teamBPlayer2}
                        </div>
                        <div className="text-[10px] text-gray-500 font-sans font-normal">Lag B</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-gray-400 py-3">{teamBSetsWon}</td>
                  {scoreState.sets.map((s, idx) => (
                    <td 
                      key={idx} 
                      className={`py-3 text-lg sm:text-xl font-bold ${
                        idx === scoreState.currentSetIndex && !isCompleted
                          ? 'text-[#BFFF00] bg-[#BFFF00]/10' 
                          : s.teamB > s.teamA && idx < scoreState.currentSetIndex 
                          ? 'text-white' 
                          : 'text-gray-400'
                      }`}
                    >
                      {s.teamB}
                    </td>
                  ))}
                  <td className="py-3 text-2xl sm:text-3xl text-cyan-300 font-black">
                    {scoreState.isTiebreak 
                      ? scoreState.tiebreakScores.teamB 
                      : scoreState.currentPoints.teamB}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Interactive Tap Scoring Pads for Lag A & Lag B */}
          {!isCompleted ? (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Lag A Poeng Button */}
                <button
                  type="button"
                  onClick={() => handleScorePoint('A')}
                  className="p-5 sm:p-7 rounded-3xl bg-gradient-to-b from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 border-2 border-gray-800 hover:border-[#BFFF00] text-left transition-all duration-200 active:scale-[0.98] shadow-xl group flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#BFFF00] bg-[#BFFF00]/10 px-2.5 py-1 rounded-full border border-[#BFFF00]/20">
                      Poeng til Lag A
                    </span>
                    <span className="text-xs text-gray-500 font-mono">Trykk for å score</span>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-[#BFFF00] transition truncate">
                      {activeMatch.teamAPlayer1} & {activeMatch.teamAPlayer2}
                    </h3>
                    <div className="text-xs text-gray-400 font-mono mt-1">
                      Nåværende: <span className="text-[#BFFF00] font-bold text-sm">
                        {scoreState.isTiebreak ? `${scoreState.tiebreakScores.teamA} p` : scoreState.currentPoints.teamA}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Lag B Poeng Button */}
                <button
                  type="button"
                  onClick={() => handleScorePoint('B')}
                  className="p-5 sm:p-7 rounded-3xl bg-gradient-to-b from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 border-2 border-gray-800 hover:border-cyan-400 text-left transition-all duration-200 active:scale-[0.98] shadow-xl group flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-full border border-cyan-400/20">
                      Poeng til Lag B
                    </span>
                    <span className="text-xs text-gray-500 font-mono">Trykk for å score</span>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-cyan-400 transition truncate">
                      {activeMatch.teamBPlayer1} & {activeMatch.teamBPlayer2}
                    </h3>
                    <div className="text-xs text-gray-400 font-mono mt-1">
                      Nåværende: <span className="text-cyan-400 font-bold text-sm">
                        {scoreState.isTiebreak ? `${scoreState.tiebreakScores.teamB} p` : scoreState.currentPoints.teamB}
                      </span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Score Control Bar (Undo, Switch Server) */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!scoreState.history || scoreState.history.length === 0}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 text-gray-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-gray-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Angre siste poeng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = JSON.parse(JSON.stringify(scoreState));
                    next.servingTeam = next.servingTeam === 'A' ? 'B' : 'A';
                    setScoreState(next);
                    saveStandaloneMatch(activeMatch.id, JSON.stringify(next));
                  }}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-gray-800"
                >
                  <span>Bytt serve ({scoreState.servingTeam === 'A' ? 'Lag A' : 'Lag B'})</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <button
                type="button"
                onClick={() => setResultCardMatch(activeMatch)}
                className="px-6 py-3 bg-[#BFFF00] text-black font-black text-sm rounded-2xl shadow-[0_0_20px_rgba(191,255,0,0.3)] hover:bg-[#b0eb00] transition inline-flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Generer og del resultatbilde</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ================= RENDER: MATCH LIST / OVERVIEW SCREEN =================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#BFFF00]/15 border border-[#BFFF00]/30 text-[#BFFF00] rounded-full text-[11px] font-extrabold uppercase tracking-wider">
              Ordinær Kamp
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {matches.length} {matches.length === 1 ? 'kamp' : 'kamper'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Ordinære Padelkamper</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Spill tradisjonell padel med sett (best av 3, super-tiebreak eller 1 sett), games og Golden point eller fordel.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            handleClearSlots();
            setIsNewMatchModalOpen(true);
          }}
          className="px-5 py-3 bg-[#BFFF00] text-black font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_20px_rgba(191,255,0,0.3)] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Start ny ordinær kamp</span>
        </button>
      </div>

      {/* Match List Grid */}
      <div>
        {loading ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <div className="w-8 h-8 border-2 border-[#BFFF00] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono">Henter kamper...</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="p-8 sm:p-12 bg-[#141414] rounded-3xl border border-gray-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-900 text-[#BFFF00] flex items-center justify-center mx-auto shadow-inner">
              <Swords className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-black text-white">Ingen ordinære kamper registrert ennå</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Trykk på &quot;Start ny ordinær kamp&quot; for å velge spillere fra spillerlisten og starte live poengtelling med sett og games.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                handleClearSlots();
                setIsNewMatchModalOpen(true);
              }}
              className="px-5 py-2.5 bg-[#BFFF00] text-black text-xs font-black rounded-xl hover:bg-[#b0eb00] transition shadow-md inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Start kamp nå</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {matches.map((m) => {
              let parsedScores: MatchScoreState | null = null;
              try {
                parsedScores = JSON.parse(m.scoresJson);
              } catch {}

              return (
                <div
                  key={m.id}
                  onClick={() => selectMatch(m)}
                  className="bg-[#141414] hover:bg-[#181818] border border-gray-800/90 hover:border-[#BFFF00]/50 rounded-3xl p-4 sm:p-5 transition-all cursor-pointer shadow-lg space-y-3 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono ${
                          m.isCompleted 
                            ? 'bg-green-500/15 text-green-400 border border-green-500/30' 
                            : 'bg-[#BFFF00]/15 text-[#BFFF00] border border-[#BFFF00]/30 animate-pulse'
                        }`}>
                          {m.isCompleted ? 'Fullført' : 'Pågår'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(m.startedAt || m.createdAt).toLocaleDateString('no-NO')}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white mt-1 group-hover:text-[#BFFF00] transition break-words">
                        {m.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1">
                      {m.isCompleted && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResultCardMatch(m);
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#BFFF00] hover:bg-[#BFFF00]/10 rounded-xl transition"
                          title="Del resultatbilde"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}

                      {isAdmin || isMatchEditable(m.completedAt || m.startedAt || m.createdAt) ? (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMatch(m.id, m.completedAt || m.startedAt || m.createdAt, e)}
                          className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                          title="Slett kamp"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span 
                          className="p-1.5 text-gray-700 cursor-not-allowed" 
                          title="Kamper kan kun slettes samme dag som de ble spilt"
                        >
                          <Trash2 className="w-4 h-4 opacity-30" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Teams and Set Score */}
                  <div className="bg-black/50 p-3.5 rounded-2xl border border-gray-800/80 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between gap-2 text-gray-200">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] text-[#BFFF00] font-bold shrink-0">A</span>
                        <span className="font-bold break-words leading-tight">
                          {m.teamAPlayer1} & {m.teamAPlayer2}
                        </span>
                      </div>
                      <span className="font-black text-sm text-[#BFFF00] shrink-0 tracking-wider">
                        {parsedScores?.sets?.map(s => s.teamA).join(' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-gray-200">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] text-cyan-400 font-bold shrink-0">B</span>
                        <span className="font-bold break-words leading-tight">
                          {m.teamBPlayer1} & {m.teamBPlayer2}
                        </span>
                      </div>
                      <span className="font-black text-sm text-cyan-300 shrink-0 tracking-wider">
                        {parsedScores?.sets?.map(s => s.teamB).join(' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                    <span>Format: {m.format === 'BEST_OF_3' ? 'Best av 3 sett' : m.format === 'BEST_OF_3_SUPER_TB' ? 'Super-TB' : '1 Sett'}</span>
                    <span className="text-[#BFFF00] font-bold flex items-center gap-1 group-hover:translate-x-1 transition">
                      Åpne scoreboard <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= NEW MATCH CREATION MODAL WITH TOURNAMENT-STYLE PLAYER PICKER ================= */}
      {isNewMatchModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-[#141414] border border-gray-800 w-full max-w-xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 my-6 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-800 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#BFFF00] text-black font-black flex items-center justify-center shadow-[0_0_15px_rgba(191,255,0,0.3)]">
                  <Swords className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Ny Ordinær Kamp</h3>
                  <p className="text-xs text-gray-400">Velg spillere fra samme liste som turnering</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewMatchModalOpen(false)}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <form onSubmit={handleCreateMatch} className="space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="text-xs font-extrabold text-gray-300 block mb-1">
                  Kampnavn / Anledning
                </label>
                <input
                  type="text"
                  value={formMatchName}
                  onChange={(e) => setFormMatchName(e.target.value)}
                  placeholder="f.eks. Fredagskamp, Treningsduell, Finale"
                  className="w-full bg-black border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-[#BFFF00] focus:outline-none"
                />
              </div>

              {/* PLAYER SELECTION FROM REGISTERED PLAYERS LIST (Tournament Style Chips) */}
              <div className="p-3.5 sm:p-4 bg-black/60 border border-gray-800/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-gray-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#BFFF00]" />
                    <span>Velg 4 spillere fra spillerlisten ({selectedInModalCount}/4 valgt)</span>
                  </label>
                  
                  <div className="flex items-center gap-2">
                    {selectedInModalCount >= 4 && (
                      <button
                        type="button"
                        onClick={handleShuffleTeams}
                        className="text-[11px] font-bold text-[#BFFF00] hover:underline flex items-center gap-1"
                        title="Bytt om lag tilfeldig"
                      >
                        <Shuffle className="w-3 h-3" />
                        <span>Bland lag</span>
                      </button>
                    )}
                    {selectedInModalCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSlots}
                        className="text-[11px] font-bold text-gray-400 hover:text-white"
                      >
                        Tøm
                      </button>
                    )}
                  </div>
                </div>

                {/* Player Chips Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-black/40 rounded-xl border border-gray-800/80">
                  {allPlayers.map((player) => {
                    const slot = getPlayerSlot(player.name);
                    const isSelected = !!slot;

                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => handleTogglePlayerInModal(player.name)}
                        className={`p-2 rounded-xl text-left border flex items-center justify-between transition-all text-xs font-bold ${
                          isSelected
                            ? slot?.startsWith('A')
                              ? 'bg-[#BFFF00]/15 border-[#BFFF00] text-white shadow-sm'
                              : 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                            : 'bg-gray-900/60 border-gray-800/80 text-gray-400 hover:text-white hover:border-gray-700'
                        }`}
                      >
                        <span className="truncate pr-1">{player.name}</span>
                        {isSelected ? (
                          <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded ${
                            slot?.startsWith('A') ? 'bg-[#BFFF00] text-black' : 'bg-cyan-400 text-black'
                          }`}>
                            Lag {slot}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-600">+</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Add Player Inline Toggle */}
                {!isAddingQuickPlayer ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingQuickPlayer(true)}
                    className="text-xs font-bold text-[#BFFF00] hover:underline flex items-center gap-1 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Opprett ny spiller som mangler i listen</span>
                  </button>
                ) : (
                  <div className="flex gap-2 p-2 bg-gray-900 rounded-xl border border-gray-800 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Navn på ny spiller..."
                      value={quickPlayerName}
                      onChange={(e) => setQuickPlayerName(e.target.value)}
                      className="flex-1 bg-black border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#BFFF00]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateQuickPlayer}
                      disabled={isPending || !quickPlayerName.trim()}
                      className="bg-[#BFFF00] text-black px-3 py-1.5 rounded-lg text-xs font-bold"
                    >
                      Legg til
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingQuickPlayer(false)}
                      className="px-2 text-gray-400 hover:text-white text-xs"
                    >
                      Avbryt
                    </button>
                  </div>
                )}
              </div>

              {/* LAG A OG LAG B SPESIFIKASJON */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Lag A */}
                <div className="p-3.5 bg-black/60 border border-[#BFFF00]/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#BFFF00]">
                      Lag A (2 spillere)
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Spiller A1 */}
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formTeamAPlayer1}
                        onChange={(e) => setFormTeamAPlayer1(e.target.value)}
                        placeholder="Spiller 1 (Lag A)"
                        list="allPlayersDatalist"
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#BFFF00] focus:outline-none"
                      />
                      {formTeamAPlayer1 && (
                        <button
                          type="button"
                          onClick={() => setFormTeamAPlayer1('')}
                          className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Spiller A2 */}
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formTeamAPlayer2}
                        onChange={(e) => setFormTeamAPlayer2(e.target.value)}
                        placeholder="Spiller 2 (Lag A)"
                        list="allPlayersDatalist"
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#BFFF00] focus:outline-none"
                      />
                      {formTeamAPlayer2 && (
                        <button
                          type="button"
                          onClick={() => setFormTeamAPlayer2('')}
                          className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lag B */}
                <div className="p-3.5 bg-black/60 border border-cyan-400/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
                      Lag B (2 spillere)
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Spiller B1 */}
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formTeamBPlayer1}
                        onChange={(e) => setFormTeamBPlayer1(e.target.value)}
                        placeholder="Spiller 1 (Lag B)"
                        list="allPlayersDatalist"
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      {formTeamBPlayer1 && (
                        <button
                          type="button"
                          onClick={() => setFormTeamBPlayer1('')}
                          className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Spiller B2 */}
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formTeamBPlayer2}
                        onChange={(e) => setFormTeamBPlayer2(e.target.value)}
                        placeholder="Spiller 2 (Lag B)"
                        list="allPlayersDatalist"
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      {formTeamBPlayer2 && (
                        <button
                          type="button"
                          onClick={() => setFormTeamBPlayer2('')}
                          className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Datalist for fast auto-completion */}
              <datalist id="allPlayersDatalist">
                {allPlayers.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>

              {/* Match Format Selector */}
              <div>
                <label className="text-xs font-extrabold text-gray-300 block mb-1">
                  Kampformat
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormFormat('BEST_OF_3')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left ${
                      formFormat === 'BEST_OF_3' 
                        ? 'bg-[#BFFF00]/15 text-[#BFFF00] border-[#BFFF00]' 
                        : 'bg-black border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-black">Best av 3 sett</span>
                    <span className="text-[10px] text-gray-500 font-normal">Vanlig 3. fullt sett</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormFormat('BEST_OF_3_SUPER_TB')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left ${
                      formFormat === 'BEST_OF_3_SUPER_TB' 
                        ? 'bg-[#BFFF00]/15 text-[#BFFF00] border-[#BFFF00]' 
                        : 'bg-black border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-black">Super-Tiebreak</span>
                    <span className="text-[10px] text-gray-500 font-normal">10p i 3. avgjørende sett</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormFormat('BEST_OF_1')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left ${
                      formFormat === 'BEST_OF_1' 
                        ? 'bg-[#BFFF00]/15 text-[#BFFF00] border-[#BFFF00]' 
                        : 'bg-black border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-black">1 Sett (Kort)</span>
                    <span className="text-[10px] text-gray-500 font-normal">Første til 6 games</span>
                  </button>
                </div>
              </div>

              {/* Deuce Rule Selector: Golden Point vs Advantage */}
              <div>
                <label className="text-xs font-extrabold text-gray-300 block mb-1">
                  Regel ved 40-40 (Deuce)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormDeuceRule('GOLDEN_POINT')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left ${
                      formDeuceRule === 'GOLDEN_POINT'
                        ? 'bg-[#BFFF00]/15 text-[#BFFF00] border-[#BFFF00]'
                        : 'bg-black border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-black flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>Golden point (standard)</span>
                    </span>
                    <span className="text-[10px] text-gray-500 font-normal mt-0.5 block">
                      Avgjørende ball ved 40-40 (mottaker velger returside)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormDeuceRule('ADVANTAGE')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left ${
                      formDeuceRule === 'ADVANTAGE'
                        ? 'bg-[#BFFF00]/15 text-[#BFFF00] border-[#BFFF00]'
                        : 'bg-black border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-black">Fordel (Advantage)</span>
                    <span className="text-[10px] text-gray-500 font-normal mt-0.5 block">
                      Klassisk fordel inn / ut inntil 2 poengs ledelse
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 shrink-0 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={() => setIsNewMatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formTeamAPlayer1 || !formTeamAPlayer2 || !formTeamBPlayer1 || !formTeamBPlayer2}
                  className="px-6 py-2.5 bg-[#BFFF00] text-black font-black text-xs rounded-xl hover:bg-[#b0eb00] transition active:scale-95 disabled:opacity-40 shadow-[0_0_15px_rgba(191,255,0,0.3)] flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isSubmitting ? 'Oppretter...' : 'Start Ordinær Kamp'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Result Card Image Modal for Standalone Match */}
      {resultCardMatch && (
        <ResultCardModal
          type="match"
          data={{ ...resultCardMatch, isStandalone: true }}
          onClose={() => setResultCardMatch(null)}
        />
      )}
    </div>
  );
}
