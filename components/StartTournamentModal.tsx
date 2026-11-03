'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { 
  X, 
  Play, 
  Trophy, 
  Zap, 
  Users, 
  Check, 
  Plus, 
  LayoutGrid, 
  Sparkles,
  Calculator,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { createTournament, addPlayer } from '@/app/actions';
import AmericanoCalculatorModal from './AmericanoCalculatorModal';

type StartTournamentModalProps = {
  onClose: () => void;
  leagues: any[];
  allPlayers: any[];
  defaultLeagueId?: string | null;
  initialTargetScore?: number | null;
  initialCourtCount?: number | null;
  onTournamentStarted?: (tournament?: any) => void;
};

export default function StartTournamentModal({
  onClose,
  leagues,
  allPlayers,
  defaultLeagueId = null,
  initialTargetScore = null,
  initialCourtCount = null,
  onTournamentStarted,
}: StartTournamentModalProps) {
  const defaultTargetLeague = defaultLeagueId ? leagues.find(l => l.id === defaultLeagueId) : null;

  const [step, setStep] = useState<'select_type' | 'configure'>(defaultTargetLeague || initialTargetScore ? 'configure' : 'select_type');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(defaultTargetLeague?.id || null);
  
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() => {
    if (defaultTargetLeague) {
      return (defaultTargetLeague.members || []).map((m: any) => m.userId);
    }
    return [];
  });
  const [courtCount, setCourtCount] = useState<number>(() => {
    if (initialCourtCount) return initialCourtCount;
    if (defaultTargetLeague) {
      const len = (defaultTargetLeague.members || []).length;
      if (len >= 12) return 3;
      if (len >= 8) return 2;
    }
    return 1;
  });
  const [targetScore, setTargetScore] = useState<number>(initialTargetScore || defaultTargetLeague?.defaultTargetScore || 21);
  const [tournamentType, setTournamentType] = useState<string>('AMERICANO');
  const [customName, setCustomName] = useState<string>('');

  // Kalkulator integrasjon
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calculatorNotice, setCalculatorNotice] = useState<string | null>(null);

  // Planlegging & Dato
  const [scheduleMode, setScheduleMode] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return tom.toISOString().split('T')[0];
  });

  // Dato-hjelpere for i morgen
  const tomorrowDate = useMemo(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return tom;
  }, []);

  const tomorrowFormatted = useMemo(() => {
    return tomorrowDate.toLocaleDateString('no-NB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }, [tomorrowDate]);

  // Rask ny spiller opprettelse
  const [isAddingNewPlayer, setIsAddingNewPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  const [isPending, startTransition] = useTransition();

  // Velg en spesifikk liga
  const handleSelectLeague = (league: any) => {
    setSelectedLeagueId(league.id);
    const memberIds = (league.members || []).map((m: any) => m.userId);
    setSelectedPlayerIds(memberIds);
    setTargetScore(league.defaultTargetScore || 21);
    setTournamentType('AMERICANO');

    if (memberIds.length >= 12) setCourtCount(3);
    else if (memberIds.length >= 8) setCourtCount(2);
    else setCourtCount(1);

    setStep('configure');
  };

  // Velg Enkeltturnering: Ingen spillere skal være forhåndsvalgt!
  const handleSelectStandalone = () => {
    setSelectedLeagueId(null);
    setSelectedPlayerIds([]); // Ingen navn forhåndsvalgt
    setTargetScore(21);
    setCourtCount(1);
    setTournamentType('AMERICANO');
    setStep('configure');
  };

  const togglePlayer = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter(p => p !== id));
    } else {
      setSelectedPlayerIds([...selectedPlayerIds, id]);
    }
  };

  const handleCreateQuickPlayer = () => {
    if (!newPlayerName.trim()) return;
    startTransition(async () => {
      const p = await addPlayer(newPlayerName);
      setSelectedPlayerIds(prev => [...prev, p.id]);
      setNewPlayerName('');
      setIsAddingNewPlayer(false);
    });
  };

  const handleStartTournament = () => {
    if (selectedPlayerIds.length < 4) return;

    let scheduledDate: Date | undefined = undefined;
    if (scheduleMode === 'tomorrow') {
      const tom = new Date(tomorrowDate);
      tom.setHours(12, 0, 0, 0);
      scheduledDate = tom;
    } else if (scheduleMode === 'custom') {
      const [year, month, day] = customDate.split('-').map(Number);
      if (year && month && day) {
        scheduledDate = new Date(year, month - 1, day, 12, 0, 0, 0);
      }
    }

    startTransition(async () => {
      const tourney = await createTournament({
        name: customName.trim() || undefined,
        leagueId: selectedLeagueId,
        type: tournamentType,
        courtCount,
        targetScore,
        playerIds: selectedPlayerIds,
        scheduledDate: scheduledDate ? scheduledDate.toISOString() : undefined,
      });
      if (onTournamentStarted) {
        onTournamentStarted(tourney);
      }
      onClose();
    });
  };

  const selectedLeague = leagues.find(l => l.id === selectedLeagueId);
  const activeLeagues = leagues.filter(l => !l.isArchived);

  return (
    <div className="fixed inset-0 bg-black/85 z-50 overflow-y-auto overscroll-contain p-2.5 sm:p-4 animate-in fade-in">
      <div className="min-h-full flex items-start sm:items-center justify-center pointer-events-none">
        <div className="bg-[#141414] border border-gray-800 w-full max-w-xl rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl relative my-2 sm:my-6 pointer-events-auto">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full bg-gray-900 text-gray-400 hover:text-white border border-gray-800 transition"
        >
          <X size={16} />
        </button>

        {/* ================= STEP 1: VELG TYPE ================= */}
        {step === 'select_type' && (
          <div className="space-y-5">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#BFFF00]">
                Ny Turnering
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                Hva slags turnering vil du starte?
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
                Velg en frittstående enkeltturnering eller spill en runde i en eksisterende liga.
              </p>
            </div>

            <div className="space-y-3">
              {/* 1. ENKELTTURNERING KNAPP */}
              <button
                type="button"
                onClick={handleSelectStandalone}
                className="w-full text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-gray-900 to-[#171c14] border-2 border-[#BFFF00]/50 hover:border-[#BFFF00] hover:shadow-[0_0_20px_rgba(191,255,0,0.2)] transition-all group active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-[#BFFF00] text-black flex items-center justify-center font-extrabold shadow-[0_0_15px_rgba(191,255,0,0.3)] shrink-0">
                      <Zap className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-extrabold text-base sm:text-lg group-hover:text-[#BFFF00] transition">
                          Enkeltturnering
                        </span>
                        <span className="px-2 py-0.5 bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/40 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                          Frittstående
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5">
                        Uavhengig Americano eller Mexicano for kvelden.
                      </p>
                    </div>
                  </div>
                  <Play className="w-4 h-4 text-[#BFFF00] shrink-0" />
                </div>
              </button>

              {/* Skillelinje */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-800"></div>
                <span className="flex-shrink mx-3 text-[10px] font-extrabold tracking-widest text-gray-500 uppercase">
                  Eller velg en liga
                </span>
                <div className="flex-grow border-t border-gray-800"></div>
              </div>

              {/* 2. EN KNAPP PER EKSISTERENDE LIGA */}
              {activeLeagues.length === 0 ? (
                <div className="p-5 bg-gray-900/40 border border-gray-800/80 rounded-2xl text-center">
                  <p className="text-gray-400 text-xs font-medium">Ingen aktive ligaer funnet.</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    Opprett en liga i «Ligaer»-fanen for å samle runder og føre tabell.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activeLeagues.map((league) => {
                    const memberCount = league.members?.length || 0;
                    const tourneyCount = league.tournaments?.length || 0;
                    return (
                      <button
                        key={league.id}
                        type="button"
                        onClick={() => handleSelectLeague(league)}
                        className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-gray-600 hover:bg-gray-850 transition-all flex items-center justify-between group active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gray-800 group-hover:bg-[#BFFF00]/20 group-hover:text-[#BFFF00] text-gray-300 flex items-center justify-center font-bold transition shrink-0">
                            <Trophy className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold text-sm sm:text-base group-hover:text-[#BFFF00] transition">
                                {league.name}
                              </span>
                              <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-[9px] font-bold rounded">
                                {league.defaultTargetScore || 21}p
                              </span>
                            </div>
                            <span className="text-gray-500 text-xs block">
                              {memberCount} faste spillere • {tourneyCount} runder spilt
                            </span>
                          </div>
                        </div>
                        <Play className="w-4 h-4 text-gray-500 group-hover:text-[#BFFF00] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 2: KONFIGURER TURNERING ================= */}
        {step === 'configure' && (
          <div className="space-y-4">
            {/* Header with back button */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setStep('select_type')}
                  className="text-xs text-gray-400 hover:text-white underline"
                >
                  ← Velg annen type
                </button>
                <span className="text-gray-600">•</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  selectedLeague 
                    ? 'bg-[#BFFF00]/10 text-[#BFFF00] border border-[#BFFF00]/30' 
                    : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                }`}>
                  {selectedLeague ? `Liga: ${selectedLeague.name}` : 'Enkeltturnering'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">Konfigurer turnering</h2>
            </div>

            {/* Americano Tidskalkulator Snarvei */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(true)}
                className="w-full text-left p-3 rounded-2xl bg-gradient-to-r from-gray-900 via-[#121c0e] to-gray-900 border border-gray-800 hover:border-[#BFFF00]/50 hover:bg-[#152310] transition-all flex items-center justify-between group shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#BFFF00]/15 border border-[#BFFF00]/30 text-[#BFFF00] flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-extrabold text-xs sm:text-sm group-hover:text-[#BFFF00] transition">
                        Tidskalkulator for Americano
                      </span>
                      <span className="px-1.5 py-0.2 bg-[#BFFF00]/20 text-[#BFFF00] text-[9px] font-extrabold rounded">
                        Beregn runder
                      </span>
                    </div>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      Beregn hvor mange runder dere rekker på banetiden og overfør oppsettet hit.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#BFFF00] shrink-0" />
              </button>

              {calculatorNotice && (
                <div className="flex items-center justify-between px-3 py-2 bg-[#BFFF00]/10 border border-[#BFFF00]/30 rounded-xl text-[11px] text-[#BFFF00] animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>{calculatorNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalculatorNotice(null)}
                    className="text-gray-400 hover:text-white p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Spillform (Americano vs Mexicano) */}
            <div>
              <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5">
                Spillform
              </label>
              <div className="grid grid-cols-2 gap-2 bg-black/60 p-1 rounded-xl border border-gray-800">
                <button
                  type="button"
                  onClick={() => setTournamentType('AMERICANO')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center ${
                    tournamentType === 'AMERICANO'
                      ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>Americano</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTournamentType('MEXICANO')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center ${
                    tournamentType === 'MEXICANO'
                      ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>Mexicano</span>
                </button>
              </div>
            </div>

            {/* Antall Baner (1-3) & Målscore (16, 21, 24, 32) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Baner Selector */}
              <div>
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <LayoutGrid className="w-3 h-3 text-[#BFFF00]" /> Antall baner
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {courtCount * 4} spillere / runde
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-black/60 p-1 rounded-xl border border-gray-800">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCourtCount(num)}
                      className={`py-2 text-xs font-bold rounded-lg transition ${
                        courtCount === num
                          ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {num} {num === 1 ? 'Bane' : 'Baner'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Målscore - Standard 21 poeng */}
              <div>
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Målscore / kamp</span>
                  {selectedLeague && (
                    <span className="text-[10px] text-[#BFFF00]">Ligastandard: {selectedLeague.defaultTargetScore || 21}p</span>
                  )}
                </label>
                <div className="grid grid-cols-4 gap-1 bg-black/60 p-1 rounded-xl border border-gray-800">
                  {[16, 21, 24, 32].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setTargetScore(pts)}
                      className={`py-2 text-xs font-mono font-bold rounded-lg transition ${
                        targetScore === pts
                          ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {pts}p
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Spillere Valg */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#BFFF00]" />
                  Velg Spillere ({selectedPlayerIds.length} valgt, min. {courtCount * 4})
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewPlayer(true)}
                  className="text-xs font-bold text-[#BFFF00] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Ny spiller
                </button>
              </div>

              {/* Rask ny spiller input */}
              {isAddingNewPlayer && (
                <div className="flex gap-2 mb-2 p-2 bg-gray-900 rounded-xl border border-gray-800 animate-in fade-in">
                  <input
                    type="text"
                    placeholder="Spillernavn..."
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="flex-1 bg-black border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#BFFF00]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateQuickPlayer}
                    disabled={isPending || !newPlayerName.trim()}
                    className="bg-[#BFFF00] text-black px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    Legg til
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewPlayer(false)}
                    className="px-2 text-gray-400 hover:text-white text-xs"
                  >
                    Avbryt
                  </button>
                </div>
              )}

              {/* Spillere Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-1 bg-black/40 rounded-2xl border border-gray-800">
                {allPlayers.map((player) => {
                  const isSelected = selectedPlayerIds.includes(player.id);
                  const isFixedMember = selectedLeague?.members?.some((m: any) => m.userId === player.id);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => togglePlayer(player.id)}
                      className={`p-2 rounded-xl text-left border flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'bg-[#BFFF00]/15 border-[#BFFF00]/60 text-white font-bold' 
                          : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                      }`}
                    >
                      <div className="truncate pr-1">
                        <span className="text-xs truncate block">{player.name}</span>
                        {isFixedMember && (
                          <span className="text-[9px] text-[#BFFF00]/80 block font-normal leading-none mt-0.5">Fast i liga</span>
                        )}
                      </div>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-[#BFFF00] shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-700 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Planlegging & Dato med Hurtigvalg for "I morgen" */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#BFFF00]" />
                  Tidspunkt & Planlegging
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {scheduleMode === 'today' && 'Starter nå (i dag)'}
                  {scheduleMode === 'tomorrow' && 'Klargjort for i morgen'}
                  {scheduleMode === 'custom' && 'Frem i tid'}
                </span>
              </label>

              {/* Hurtigvalg: I dag, I morgen, Velg dato... */}
              <div className="grid grid-cols-3 gap-1.5 bg-black/60 p-1 rounded-xl border border-gray-800">
                <button
                  type="button"
                  onClick={() => setScheduleMode('today')}
                  className={`py-2 px-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    scheduleMode === 'today'
                      ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>I dag</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleMode('tomorrow')}
                  className={`py-2 px-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    scheduleMode === 'tomorrow'
                      ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>I morgen</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleMode('custom')}
                  className={`py-2 px-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    scheduleMode === 'custom'
                      ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>Velg dato...</span>
                </button>
              </div>

              {/* Detaljer ved "I morgen" */}
              {scheduleMode === 'tomorrow' && (
                <div className="p-3 bg-[#BFFF00]/10 border border-[#BFFF00]/30 rounded-2xl text-xs flex items-center gap-3 text-white animate-in fade-in">
                  <div className="w-8 h-8 rounded-xl bg-[#BFFF00]/20 border border-[#BFFF00]/40 flex items-center justify-center text-[#BFFF00] shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-[#BFFF00] block capitalize text-xs">
                      I morgen: {tomorrowFormatted}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Turneringen opprettes og dateres til i morgen.
                    </span>
                  </div>
                </div>
              )}

              {/* Detaljer ved "Egendefinert" */}
              {scheduleMode === 'custom' && (
                <div className="p-3 bg-gray-900/90 border border-gray-800 rounded-2xl animate-in fade-in space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 block">Velg dato frem i tid</label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full bg-black border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#BFFF00]"
                  />
                </div>
              )}
            </div>

            {/* Valgfritt turneringsnavn */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Turneringsnavn (valgfritt)
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={
                  selectedLeague 
                    ? `${selectedLeague.name} - Runde X (${scheduleMode === 'tomorrow' ? tomorrowDate.toLocaleDateString('no-NB', { day: '2-digit', month: '2-digit' }) : 'i dag'})` 
                    : (scheduleMode === 'tomorrow' ? `Turnering ${tomorrowDate.toLocaleDateString('no-NB', { day: '2-digit', month: '2-digit' })}` : "f.eks. Fredagsturnering")
                }
                className="w-full bg-black border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#BFFF00]"
              />
            </div>

            {/* Start / Planlegg Knappen */}
            <button
              type="button"
              onClick={handleStartTournament}
              disabled={isPending || selectedPlayerIds.length < 4}
              className="w-full bg-[#BFFF00] text-black font-extrabold text-xs sm:text-sm py-3 rounded-2xl hover:bg-[#b0eb00] transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-[0_0_20px_rgba(191,255,0,0.3)] flex items-center justify-center gap-2"
            >
              {scheduleMode === 'today' ? (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  {isPending ? 'Starter...' : 'Start turnering'}
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  {isPending 
                    ? 'Planlegger...' 
                    : `Planlegg turnering (${scheduleMode === 'tomorrow' ? 'I morgen' : customDate})`}
                </>
              )}
            </button>
          </div>
        )}
      </div>
      </div>

      {/* Americano Calculator Modal overlay */}
      {isCalculatorOpen && (
        <AmericanoCalculatorModal
          onClose={() => setIsCalculatorOpen(false)}
          initialPlayerCount={selectedPlayerIds.length >= 4 ? selectedPlayerIds.length : 8}
          initialTargetScore={targetScore}
          initialCourtCount={courtCount}
          confirmButtonLabel="Overfør til turnering"
          onApplySettings={(settings) => {
            setTargetScore(settings.targetScore);
            setCourtCount(settings.courtCount);
            setIsCalculatorOpen(false);
            setCalculatorNotice(
              `Overførte innstillinger: ${settings.targetScore} poeng • ${settings.courtCount} ${settings.courtCount === 1 ? 'bane' : 'baner'} (beregnet for ${settings.playerCount} spillere)`
            );
          }}
        />
      )}
    </div>
  );
}
