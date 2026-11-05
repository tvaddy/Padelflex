'use client';

import ResultCardModal from "./ResultCardModal";
import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Trophy, 
  Play, 
  Shuffle, 
  Check, 
  Flame, 
  UserX, 
  UserCheck, 
  Trash2, 
  Plus, 
  RotateCcw, 
  Activity, 
  AlertTriangle,
  Zap,
  Clock,
  Timer,
  Edit3,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  Pause,
  Share2,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar
} from 'lucide-react';
import TournamentTimer from './TournamentTimer';
import { 
  drawNextMatches,
  drawNextMatch, 
  registerMatchScore,
  deleteMatch, 
  togglePlayerPause, 
  toggleHalvePoints, 
  endActiveTournament, 
  deleteTournament,
  addPlayersToTournament,
  addPlayer
} from '@/app/actions';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useAuth } from './AuthContext';
import { useTranslation } from '@/lib/i18n';
import PlayerStatsModal from './PlayerStatsModal';
import EditMatchModal from './EditMatchModal';

import { 
  calculateTournamentProgress, 
  formatDurationMinutes, 
  formatTimeOnly,
  isMatchEditable 
} from '@/lib/match-utils';

type TournamentViewProps = {
  tournament: any;
  allPlayers: any[];
  onStartNewTournament: () => void;
  onTournamentEnded?: () => void;
};

export default function TournamentView({
  tournament,
  allPlayers,
  onStartNewTournament,
  onTournamentEnded
}: TournamentViewProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { t, isEnglish } = useTranslation();
  const [activeTab, setActiveTab] = useState<'matches' | 'standings'>('matches');
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isAddPlayersModalOpen, setIsAddPlayersModalOpen] = useState(false);
  const [isEndTournamentConfirmOpen, setIsEndTournamentConfirmOpen] = useState(false);
  const [isDeleteTournamentConfirmOpen, setIsDeleteTournamentConfirmOpen] = useState(false);
  
  // Match editing modal & Result card modal
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [resultCardData, setResultCardData] = useState<{ type: 'match' | 'tournament'; data: any } | null>(null);
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);

  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawWarning, setDrawWarning] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // Offline Sync hook
  const { isOnline, queue, isSyncing, submitMatchScore, syncQueue } = useOfflineSync();

  if (!tournament) {
    return (
      <div className="p-10 sm:p-12 text-center bg-gray-900/40 border border-gray-800 border-dashed rounded-3xl">
        <Trophy className="w-14 h-14 text-gray-700 mx-auto mb-3" />
        <h3 className="text-lg sm:text-xl font-bold text-gray-200">{t.tournamentView.noActiveTournament}</h3>
        <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mt-1">
          {t.tournamentView.noActiveDesc}
        </p>
        <button
          type="button"
          onClick={onStartNewTournament}
          className="mt-5 bg-[#BFFF00] text-black px-6 py-3 rounded-2xl font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_20px_rgba(191,255,0,0.3)]"
        >
          <Play className="w-4 h-4 fill-current" /> {t.tournaments.newTournament}
        </button>
      </div>
    );
  }

  const isLeague = !!tournament.leagueId;
  const participants = tournament.participants || [];
  const matches = tournament.matches || [];
  
  // Active queue matches (isCompleted: false)
  const activePendingMatches = matches.filter((m: any) => !m.isCompleted);
  // Completed matches (isCompleted: true)
  const completedMatches = matches.filter((m: any) => m.isCompleted);

  const isHalved = tournament.originalTargetScore != null;
  const courtCount = tournament.courtCount || 1;

  // Calculate Progress indicators
  const progress = calculateTournamentProgress(participants, completedMatches);

  // Draw full round according to court count
  const handleDrawRound = () => {
    setDrawError(null);
    setDrawWarning(null);
    startTransition(async () => {
      const res = await drawNextMatches(tournament.id);
      if (!res.success && res.error) {
        setDrawError(res.error);
      } else if (res.warning) {
        setDrawWarning(res.warning);
      }
    });
  };

  // Draw single match into queue
  const handleDrawSingleMatch = () => {
    setDrawError(null);
    setDrawWarning(null);
    startTransition(async () => {
      const res = await drawNextMatch(tournament.id);
      if (!res.success && res.error) {
        setDrawError(res.error);
      }
    });
  };

  const handleToggleHalve = () => {
    startTransition(async () => {
      await toggleHalvePoints(tournament.id);
    });
  };

  const handleEndTournament = () => {
    startTransition(async () => {
      await endActiveTournament(tournament.id);
      setIsEndTournamentConfirmOpen(false);
      if (onTournamentEnded) {
        onTournamentEnded();
      }
      router.refresh();
    });
  };

  const handleDeleteTournament = () => {
    startTransition(async () => {
      const res = await deleteTournament(tournament.id);
      setIsDeleteTournamentConfirmOpen(false);
      if (res.success) {
        if (onTournamentEnded) {
          onTournamentEnded();
        }
        router.refresh();
      } else {
        alert(res.error || 'Kunne ikke slette turnering');
      }
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Offline Status & Sync Queue Banner */}
      {(!isOnline || queue.length > 0) && (
        <div className="flex items-center justify-between p-3 px-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            {!isOnline ? (
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Wifi className="w-4 h-4 text-green-400 shrink-0" />
            )}
            <div>
              <span className="font-bold">
                {!isOnline ? (isEnglish ? 'Offline Mode' : 'Frakoblet modus (Offline)') : (isEnglish ? 'Online' : 'Tilkoblet')}
              </span>
              <span className="text-gray-400 ml-1.5">
                {queue.length > 0
                  ? isEnglish
                    ? `• ${queue.length} match(es) stored locally waiting for sync`
                    : `• ${queue.length} kamp(er) lagret lokalt og venter på synkronisering`
                  : isEnglish
                    ? '• Scores are saved locally and synced automatically when reconnected'
                    : '• Resultater lagres lokalt og synkes automatisk når nettet er tilbake'}
              </span>
            </div>
          </div>
          {isOnline && queue.length > 0 && (
            <button
              type="button"
              onClick={syncQueue}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition active:scale-95 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? (isEnglish ? 'Syncing...' : 'Synker...') : (isEnglish ? 'Sync now' : 'Synk nå')}</span>
            </button>
          )}
        </div>
      )}

      {/* Tournament Top Banner */}
      <div className="bg-gradient-to-br from-[#161616] via-[#141414] to-gray-900 p-4 sm:p-6 rounded-3xl border border-gray-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {isLeague ? (
                <span className="px-2.5 py-0.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {isEnglish ? 'League' : 'Liga'}: {tournament.league?.name}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {t.tournamentModal.singleTournamentTitle}
                </span>
              )}
              <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full text-[10px] font-mono font-bold">
                {courtCount} {courtCount === 1 ? t.common.court : isEnglish ? 'Courts' : 'Baner'}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {tournament.type || 'AMERICANO'} • {tournament.targetScore}p {isEnglish ? 'per match' : 'per kamp'}
              </span>
              {isHalved && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-bold">
                  {isEnglish ? `Halved points (${tournament.targetScore}p)` : `Halverte poeng (${tournament.targetScore}p)`}
                </span>
              )}
              {tournament.createdAt && (
                <span className="px-2.5 py-0.5 bg-gray-800/80 border border-gray-700/60 text-gray-300 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#BFFF00]" />
                  <span>
                    {new Date(tournament.createdAt).toLocaleDateString(isEnglish ? 'en-US' : 'no-NB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white break-words">{tournament.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {participants.length} {isEnglish ? 'players' : 'deltakere'} • {completedMatches.length} {isEnglish ? 'completed' : 'fullført'}
              {activePendingMatches.length > 0 && ` • ${activePendingMatches.length} ${isEnglish ? 'in queue' : 'i kø'}`}
            </p>
          </div>

          {/* Action Controls in Header */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Del Resultatkort */}
            <button
              type="button"
              onClick={() => setResultCardData({ type: 'tournament', data: tournament })}
              className="w-full sm:w-auto bg-[#BFFF00]/10 hover:bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/30 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
              title={isEnglish ? 'Generate and share results' : 'Generer og del resultat'}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isEnglish ? 'Share Result' : 'Del resultat'}</span>
            </button>

            {/* Tidskamp Timer Toggle */}
            <button
              type="button"
              onClick={() => setIsTimerOpen(!isTimerOpen)}
              className={`w-full sm:w-auto px-3 py-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                isTimerOpen
                  ? 'bg-[#BFFF00]/15 text-[#BFFF00] border-[#BFFF00]/40 shadow-[0_0_10px_rgba(191,255,0,0.2)]'
                  : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800 hover:text-white'
              }`}
              title={isEnglish ? 'Show or hide round timer' : 'Vis eller skjul nedtellingstimer for runder'}
            >
              <Timer className="w-3.5 h-3.5 text-[#BFFF00]" />
              <span>{t.tournamentView.timer}</span>
            </button>

            {/* Dybdestatistikk Modal Button */}
            <button
              type="button"
              onClick={() => setIsStatsModalOpen(true)}
              className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <Activity className="w-3.5 h-3.5 text-[#BFFF00]" />
              <span>{isEnglish ? 'Stats' : 'Statistikk'}</span>
            </button>

            {/* Halvér / Gjenopprett Poeng */}
            <button
              type="button"
              onClick={handleToggleHalve}
              disabled={isPending}
              className={`w-full sm:w-auto px-3 py-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                isHalved
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800 hover:text-white'
              }`}
              title={isHalved ? (isEnglish ? 'Restore full target score' : 'Gjenopprett full poengsum') : (isEnglish ? 'Halve score for remaining matches' : 'Halvér poeng i resterende kamper')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isHalved ? (isEnglish ? 'Restore' : 'Full sum') : (isEnglish ? 'Halve' : 'Halvér')}</span>
            </button>

            {/* Legg til flere spillere */}
            <button
              type="button"
              onClick={() => setIsAddPlayersModalOpen(true)}
              className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              title={isEnglish ? 'Add players to tournament' : 'Legg til spillere i turneringen'}
            >
              <Plus className="w-3.5 h-3.5 text-[#BFFF00]" />
              <span>{isEnglish ? 'Player' : 'Spiller'}</span>
            </button>

            {/* Avslutt Turnering */}
            <button
              type="button"
              onClick={() => setIsEndTournamentConfirmOpen(true)}
              className="w-full sm:w-auto bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              {isEnglish ? 'Finish' : 'Avslutt'}
            </button>

            {/* Slett Turnering (Kun for admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsDeleteTournamentConfirmOpen(true)}
                className="w-full sm:w-auto bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                title={isEnglish ? 'Delete this tournament permanently' : 'Slett hele denne turneringen permanent'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.common.delete}</span>
              </button>
            )}
          </div>
        </div>

        {/* PROGRESS INDICATOR WIDGET */}
        <div className="bg-black/40 border border-gray-800/80 rounded-2xl p-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Status 1: Tid og varighet */}
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold shrink-0 text-xs">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-extrabold text-white text-[11px] uppercase tracking-wider block">
                  {isEnglish ? 'Time Spent' : 'Tidsforbruk'}
                </span>
                <p className="text-gray-300 text-xs mt-0.5">
                  {isEnglish ? 'Total played:' : 'Totalt spilt:'} <strong className="text-white font-mono">{progress.totalMinutesPlayed} min</strong>
                  {completedMatches.length > 0 && (
                    <span> • {isEnglish ? 'Avg:' : 'Gj.snitt:'} <strong className="text-[#BFFF00] font-mono">{progress.avgMatchMinutes} {isEnglish ? 'min / match' : 'min / kamp'}</strong></span>
                  )}
                </p>
              </div>
            </div>

            {/* Status 2: Spillerpauser / Antall pausede kamper */}
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold shrink-0 text-xs">
                <Pause className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-extrabold text-white text-[11px] uppercase tracking-wider block">
                  {isEnglish ? 'Player Pauses' : 'Spillerpauser'}
                </span>
                {participants.some((p: any) => p.isPaused || (p.pausedCount || 0) > 0) ? (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {participants
                      .filter((p: any) => p.isPaused || (p.pausedCount || 0) > 0)
                      .map((p: any) => (
                        <span
                          key={p.userId}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            p.isPaused
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                              : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          {p.user?.name}: {p.pausedCount || 0}P{p.isPaused ? (isEnglish ? ' (paused)' : ' (pauset)') : ''}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs mt-0.5">
                    {isEnglish ? 'No players have been paused.' : 'Ingen spillere har hatt pause.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Kamper vs Live Tabell) */}
        <div className="grid grid-cols-2 bg-black/60 p-1 rounded-2xl border border-gray-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'matches'
                ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>{isEnglish ? `Matches (${activePendingMatches.length} active)` : `Kamper (${activePendingMatches.length} aktive)`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('standings')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'standings'
                ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>{t.tournamentView.standings}</span>
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: KAMPER ================= */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          {/* Tidskamp / Countdown Timer */}
          {isTimerOpen && (
            <TournamentTimer 
              tournamentName={tournament.name}
              defaultMinutes={12}
            />
          )}

          {/* Trekning Kontroller */}
          <div className="bg-[#141414] p-4 sm:p-5 rounded-3xl border border-gray-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-[#BFFF00]" /> {isEnglish ? 'Draw next matches' : 'Trekk neste kamper'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {courtCount > 1 
                  ? isEnglish 
                    ? `Drawing matches for ${courtCount} courts (${courtCount * 4} players rotate)` 
                    : `Trekker kamper for ${courtCount} baner (${courtCount * 4} spillere roteres)` 
                  : isEnglish 
                    ? 'Drawing 1 match (4 players rotate)' 
                    : 'Trekker 1 kamp (4 spillere roteres)'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {courtCount > 1 && (
                <button
                  type="button"
                  onClick={handleDrawSingleMatch}
                  disabled={isPending}
                  className="bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  title={isEnglish ? 'Add only 1 match to queue' : 'Legg til kun 1 kamp i køen'}
                >
                  <Plus className="w-3.5 h-3.5" /> {isEnglish ? '+1 match' : '+1 kamp'}
                </button>
              )}

              <button
                type="button"
                onClick={handleDrawRound}
                disabled={isPending}
                className="flex-1 sm:flex-none bg-[#BFFF00] text-black px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_20px_rgba(191,255,0,0.3)] disabled:opacity-40"
              >
                <Shuffle className="w-4 h-4" />
                {isPending ? t.tournamentView.drawing : courtCount > 1 ? t.tournamentView.drawRound : (isEnglish ? 'Draw match' : 'Trekk kamp')}
              </button>
            </div>
          </div>

          {drawError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{drawError}</span>
            </div>
          )}

          {drawWarning && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{drawWarning}</span>
            </div>
          )}

          {/* Aktive kamper i kø */}
          {activePendingMatches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#BFFF00] flex items-center gap-1.5">
                  <Flame className="w-4 h-4 fill-current" />
                  {isEnglish ? `Active & Queued Matches (${activePendingMatches.length})` : `Pågående & Trukne kamper (${activePendingMatches.length})`}
                </span>
                <span className="text-[10px] text-gray-500">
                  {isEnglish ? 'Record points or remove match' : 'Registrer poeng eller fjern kamp'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {activePendingMatches.map((match: any, idx: number) => {
                  const matchCourt = match.courtNumber || 1;
                  const earlierOnSameCourt = activePendingMatches.slice(0, idx).find((m: any) => {
                    const c = m.courtNumber || 1;
                    return c === matchCourt && !m.isCompleted;
                  });

                  const isLockedInQueue = !!earlierOnSameCourt;

                  return (
                    <ActiveMatchCard
                      key={match.id}
                      match={match}
                      queueIndex={idx + 1}
                      targetScore={tournament.targetScore}
                      isLockedInQueue={isLockedInQueue}
                      lockedByCourt={matchCourt}
                      onSubmitScore={submitMatchScore}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Fullførte kamper kronologisk liste */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
                {t.tournamentView.completedMatchesTitle} ({completedMatches.length})
              </span>
              <span className="text-[10px] text-gray-500">
                {isEnglish ? 'Chronological order' : 'Kronologisk rekkefølge'}
              </span>
            </div>

            {completedMatches.length === 0 ? (
              <div className="p-8 text-center bg-[#141414] border border-gray-800 rounded-3xl">
                <p className="text-gray-400 text-xs">
                  {t.tournamentView.noCompletedMatches}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {completedMatches.map((match: any, index: number) => {
                  const sA = match.teamAScore;
                  const sB = match.teamBScore;
                  const isAWon = sA > sB;
                  const isBWon = sB > sA;

                  const duration = formatDurationMinutes(match.startedAt || match.date, match.completedAt);
                  const startTime = formatTimeOnly(match.startedAt || match.date);
                  const endTime = formatTimeOnly(match.completedAt);

                  return (
                    <div
                      key={match.id}
                      className="bg-[#141414] p-4 rounded-2xl border border-gray-800/90 flex flex-col justify-between gap-3 group shadow-md"
                    >
                      {/* Top match header info */}
                      <div className="flex items-center justify-between text-[11px] text-gray-500 pb-2 border-b border-gray-800/60">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-400">#{index + 1}</span>
                          {match.courtNumber && (
                            <span className="px-1.5 py-0.2 bg-gray-800 text-gray-300 rounded text-[9px] font-bold">
                              {t.common.court} {match.courtNumber}
                            </span>
                          )}
                        </div>

                        {/* Timing info */}
                        <div className="flex items-center gap-2 font-mono">
                          <span className="flex items-center gap-1 text-gray-400" title={t.common.time}>
                            <Clock className="w-3 h-3 text-gray-500" />
                            {startTime} - {endTime}
                          </span>
                          <span className="px-1.5 py-0.2 bg-gray-800/80 text-[#BFFF00] font-bold rounded text-[10px]">
                            {duration}
                          </span>
                        </div>
                      </div>

                      {/* Teams & Scores */}
                      <div className="space-y-1.5">
                        {/* Lag A */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className={`font-bold break-words min-w-0 flex-1 leading-tight ${isAWon ? 'text-white' : 'text-gray-400'}`}>
                            {match.teamAPlayer1?.name} & {match.teamAPlayer2?.name}
                          </span>
                          <span className={`font-mono font-extrabold text-sm px-2.5 py-0.5 rounded-lg shrink-0 ${
                            isAWon ? 'bg-[#BFFF00]/20 text-[#BFFF00]' : 'text-gray-400'
                          }`}>
                            {sA}
                          </span>
                        </div>

                        {/* Lag B */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className={`font-bold break-words min-w-0 flex-1 leading-tight ${isBWon ? 'text-white' : 'text-gray-400'}`}>
                            {match.teamBPlayer1?.name} & {match.teamBPlayer2?.name}
                          </span>
                          <span className={`font-mono font-extrabold text-sm px-2.5 py-0.5 rounded-lg shrink-0 ${
                            isBWon ? 'bg-[#BFFF00]/20 text-[#BFFF00]' : 'text-gray-400'
                          }`}>
                            {sB}
                          </span>
                        </div>
                      </div>

                      {/* Elo Delta indicator if available */}
                      {match.eloDelta !== undefined && match.eloDelta !== null && match.eloDelta !== 0 && (
                        <div className="text-[10px] font-mono text-gray-400 flex items-center justify-between px-1">
                          <span className="text-gray-500">{isEnglish ? 'Elo delta:' : 'Elo justering:'}</span>
                          <span className={isAWon ? 'text-green-400 font-bold flex items-center gap-0.5' : 'text-red-400 font-bold flex items-center gap-0.5'}>
                            {isAWon ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isEnglish ? 'Team A' : 'Lag A'}: {isAWon ? `+${match.eloDelta}` : `-${Math.abs(match.eloDelta)}`} | {isEnglish ? 'Team B' : 'Lag B'}: {isBWon ? `+${Math.abs(match.eloDelta)}` : `-${Math.abs(match.eloDelta)}`}
                          </span>
                        </div>
                      )}

                      {/* Footer Actions: Del, Korriger & Slett */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 text-xs">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingMatch(match)}
                            className="text-[#BFFF00] hover:underline flex items-center gap-1 font-bold text-[11px]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {t.tournamentView.editScore}
                          </button>

                          <button
                            type="button"
                            onClick={() => setResultCardData({ type: 'match', data: { ...match, tournament } })}
                            className="text-gray-400 hover:text-white flex items-center gap-1 font-bold text-[11px] transition"
                            title={isEnglish ? 'Generate and share match card' : 'Generer og del kampresultatkort'}
                          >
                            <Share2 className="w-3.5 h-3.5 text-[#BFFF00]" />
                            <span>{isEnglish ? 'Share card' : 'Del kort'}</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(isEnglish ? 'Do you want to delete this match and update standings?' : 'Vil du slette denne kampen og oppdatere tabellen?')) {
                              startTransition(async () => {
                                await deleteMatch(match.id);
                              });
                            }
                          }}
                          className="text-gray-600 hover:text-red-400 p-1 transition opacity-80 hover:opacity-100"
                          title={isEnglish ? 'Delete match' : 'Slett kamp'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= VIEW 2: LIVE TABELL ================= */}
      {activeTab === 'standings' && (() => {
        const sortedParticipants = [...participants].sort((a: any, b: any) => {
          if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
          if ((b.matchesWon || 0) !== (a.matchesWon || 0)) return (b.matchesWon || 0) - (a.matchesWon || 0);
          return (b.matchesDrawn || 0) - (a.matchesDrawn || 0);
        });

        return (
        <div className="space-y-4">
          <div className="bg-[#141414] rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
            <div className="p-4 bg-gray-900/60 border-b border-gray-800/80 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#BFFF00]" />
                  {isEnglish ? 'Results & Standings (Points & Wins)' : 'Resultat & Plasseringer (Poeng & Seire)'}
                </span>
                <button
                  type="button"
                  onClick={() => setResultCardData({ type: 'tournament', data: tournament })}
                  className="px-2.5 py-1 bg-[#BFFF00]/10 hover:bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
                  title={isEnglish ? 'Share results as image' : 'Del resultat som bilde'}
                >
                  <Share2 className="w-3 h-3" />
                  <span>{isEnglish ? 'Share Result' : 'Del resultat'}</span>
                </button>
              </div>
            </div>

            {/* Mobile Compact 1-Row List (md:hidden) */}
            <div className="p-2 space-y-1.5 md:hidden">
              {sortedParticipants.map((p: any, index: number) => {
                const isFirst = index === 0 && p.totalPoints > 0;

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 px-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                      p.isPaused
                        ? 'opacity-60 bg-black/40 border-gray-800/50'
                        : isFirst
                        ? 'bg-[#181d14] border-[#BFFF00]/40 shadow-sm'
                        : 'bg-[#181818] border-gray-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isFirst ? 'bg-[#BFFF00] text-black' : 'bg-gray-800 text-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-white truncate">
                            {p.user?.name}
                          </span>
                          {p.isPaused && (
                            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] rounded font-bold">
                              {t.common.paused}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 font-mono">
                          <span>
                            {p.matchesWon}{isEnglish ? 'W' : 'V'} - {p.matchesDrawn}{isEnglish ? 'D' : 'U'} - {p.matchesLost}{isEnglish ? 'L' : 'T'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right font-mono">
                        <div className="text-sm font-extrabold text-[#BFFF00]">
                          {p.totalPoints} <span className="text-[10px] text-gray-500 font-normal">p</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            await togglePlayerPause(tournament.id, p.userId);
                          });
                        }}
                        disabled={isPending}
                        className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                          p.isPaused
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                        title={p.isPaused ? (isEnglish ? 'Activate player' : 'Aktiver spiller') : (isEnglish ? 'Pause player' : 'Sett spiller på pause')}
                      >
                        {p.isPaused ? (
                          <UserCheck className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800/80 bg-gray-900/30">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-center w-10 sm:w-12">#</th>
                    <th className="px-3 sm:px-4 py-3">{t.tournamentView.player}</th>
                    <th className="px-3 sm:px-4 py-3 text-center font-extrabold text-[#BFFF00]">
                      {isEnglish ? 'Total Points' : 'Total Poeng'}
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-center">
                      {isEnglish ? 'Win / Draw / Loss / Pause' : 'Seier / Uavgjort / Tap / Pause'}
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-center">{isEnglish ? 'Status' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-xs sm:text-sm">
                  {sortedParticipants.map((p: any, index: number) => {
                    const isFirst = index === 0 && p.totalPoints > 0;

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors hover:bg-gray-850/40 ${
                          p.isPaused ? 'opacity-50 bg-black/40' : isFirst ? 'bg-[#BFFF00]/5' : ''
                        }`}
                      >
                        <td className="px-3 sm:px-4 py-3.5 text-center font-mono font-bold">
                          {isFirst ? (
                            <span className="text-[#BFFF00] flex items-center justify-center">
                              <Trophy className="w-3.5 h-3.5 mr-1" /> 1
                            </span>
                          ) : (
                            <span className="text-gray-500">{index + 1}</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3.5 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{p.user?.name}</span>
                            {p.isPaused && (
                              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] rounded font-bold flex items-center gap-1">
                                <UserX className="w-3 h-3" /> {t.common.paused}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3.5 text-center font-mono font-extrabold text-base text-[#BFFF00]">
                          {p.totalPoints}
                        </td>
                        <td className="px-3 sm:px-4 py-3.5 text-center font-mono text-gray-300">
                          <span className="text-green-400 font-bold">{p.matchesWon}</span> -{' '}
                          <span className="text-amber-400 font-bold">{p.matchesDrawn}</span> -{' '}
                          <span className="text-red-400 font-bold">{p.matchesLost}</span>
                          {p.pausedCount > 0 && (
                            <span className="text-purple-400 font-bold ml-1.5" title={isEnglish ? 'Number of matches on pause' : 'Antall kamper på pause'}>
                              ({p.pausedCount}P)
                            </span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              startTransition(async () => {
                                await togglePlayerPause(tournament.id, p.userId);
                              });
                            }}
                            disabled={isPending}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
                              p.isPaused
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-gray-850 text-gray-300 hover:text-white hover:bg-gray-800'
                            }`}
                          >
                            {p.isPaused ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5 text-green-400" /> {isEnglish ? 'Set active' : 'Sett aktiv'}
                              </>
                            ) : (
                              <>
                                <UserX className="w-3.5 h-3.5 text-gray-400" /> {isEnglish ? 'Pause' : 'Pause'}
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Dybdestatistikk Modal */}
      {isStatsModalOpen && (
        <PlayerStatsModal
          tournament={tournament}
          onClose={() => setIsStatsModalOpen(false)}
        />
      )}

      {/* Modal for å legge til flere deltakere midtveis */}
      {isAddPlayersModalOpen && (
        <AddPlayersToTournamentModal
          tournamentId={tournament.id}
          allPlayers={allPlayers}
          existingUserIds={participants.map((p: any) => p.userId)}
          onClose={() => setIsAddPlayersModalOpen(false)}
        />
      )}

      {/* Modal for korrigering av en fullført kamp */}
      {editingMatch && (
        <EditMatchModal
          match={editingMatch}
          targetScore={tournament.targetScore}
          onClose={() => setEditingMatch(null)}
        />
      )}

      {/* Result Card Modal for Image Export & Social Sharing */}
      {resultCardData && (
        <ResultCardModal
          type={resultCardData.type}
          data={resultCardData.data}
          onClose={() => setResultCardData(null)}
        />
      )}
      

      {/* Bekreftelsesdialog for å avslutte turnering */}
      {isEndTournamentConfirmOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-gray-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">
                {isEnglish ? 'Complete tournament?' : 'Avslutt turnering?'}
              </h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {isEnglish 
                ? 'Results will be archived in history.' 
                : 'Resultatene arkiveres i historikken.'}
              {isLeague && (isEnglish ? ' Points will also update the league standings.' : ' Poengene oppdaterer også sammenlagttabellen for ligaen.')}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEndTournamentConfirmOpen(false)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleEndTournament}
                disabled={isPending}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold rounded-xl transition active:scale-95"
              >
                {isPending ? t.tournamentView.finishing : (isEnglish ? 'Finish' : 'Avslutt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bekreftelsesdialog for å slette turnering */}
      {isDeleteTournamentConfirmOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-red-900/50 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">
                {isEnglish ? 'Delete tournament permanently?' : 'Slett turnering permanent?'}
              </h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {isEnglish 
                ? `Are you sure you want to delete "${tournament.name}"? All associated matches and rounds will be permanently deleted.` 
                : `Er du sikker på at du vil slette turneringen «${tournament.name}»? Alle tilhørende kamper og runder slettes permanent og kan ikke gjenopprettes.`}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteTournamentConfirmOpen(false)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeleteTournament}
                disabled={isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold rounded-xl transition active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                {isPending ? (isEnglish ? 'Deleting...' : 'Sletter...') : (isEnglish ? 'Delete tournament' : 'Slett turnering')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= AKTIV KAMP KORT (KOLLAPSET SOM STANDARD, UTVIDES VED TRYKK) ================= */

function ActiveMatchCard({ 
  match, 
  queueIndex, 
  targetScore,
  isLockedInQueue,
  lockedByCourt,
  onSubmitScore
}: { 
  match: any; 
  queueIndex: number; 
  targetScore: number;
  isLockedInQueue: boolean;
  lockedByCourt: number;
  onSubmitScore?: (matchId: string, scoreA: number, scoreB: number, completedAt?: Date, version?: number) => Promise<{ success: boolean; offline?: boolean; error?: string }>;
}) {
  const { t, isEnglish } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  // Default to null so unscored match renders '-' as requested
  const [scoreA, setScoreA] = useState<number | null>(null);
  const [scoreB, setScoreB] = useState<number | null>(null);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pointsList = Array.from({ length: targetScore + 1 }, (_, i) => i);

  const handleSelectScoreA = (pts: number) => {
    setScoreA(pts);
    if (!isCustomMode) {
      setScoreB(Math.max(0, targetScore - pts));
    }
  };

  const handleSelectScoreB = (pts: number) => {
    setScoreB(pts);
    if (!isCustomMode) {
      setScoreA(Math.max(0, targetScore - pts));
    }
  };

  const handleSubmitScore = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLockedInQueue) {
      setErrorMessage(
        isEnglish
          ? `Previous match on court ${lockedByCourt} must be saved first.`
          : `Forrige kamp på bane ${lockedByCourt} må fullføres og lagres først.`
      );
      return;
    }

    if (scoreA === null || scoreB === null) {
      setErrorMessage(
        isEnglish
          ? 'Select scores for both teams before completing.'
          : 'Velg poengsum for kampen før du fullfører.'
      );
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        if (onSubmitScore) {
          const res = await onSubmitScore(match.id, scoreA, scoreB, new Date(), match.version);
          if (!res.success) {
            setErrorMessage(res.error || (isEnglish ? 'Could not save result' : 'Kunne ikke lagre resultat'));
          }
        } else {
          await registerMatchScore(match.id, scoreA, scoreB, new Date(), match.version);
        }
      } catch (err: any) {
        setErrorMessage(err.message || (isEnglish ? 'Could not save result' : 'Kunne ikke lagre resultat'));
      }
    });
  };

  const handleRemoveFromQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(isEnglish ? 'Do you want to remove this match from the queue?' : 'Vil du fjerne denne kampen fra køen?')) {
      startTransition(async () => {
        await deleteMatch(match.id);
      });
    }
  };

  const startTimeStr = formatTimeOnly(match.startedAt || match.date);

  return (
    <div 
      className={`bg-gradient-to-br rounded-3xl border-2 transition-all shadow-xl overflow-hidden ${
        isLockedInQueue
          ? 'from-[#141414] to-[#0f0f0f] border-gray-800 opacity-90 p-4 sm:p-5 space-y-3'
          : isExpanded 
          ? 'from-[#181818] to-[#111111] border-[#BFFF00] ring-2 ring-[#BFFF00]/20 p-4 sm:p-5 space-y-4' 
          : 'from-[#181818] to-[#111111] border-gray-800 hover:border-[#BFFF00]/60 p-4 sm:p-5 space-y-3 cursor-pointer'
      }`}
      onClick={() => {
        if (!isLockedInQueue && !isExpanded) {
          setIsExpanded(true);
        }
      }}
    >
      {/* Top Banner with Court, Start time, and Expand/Collapse indicators */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isLockedInQueue ? (
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-xs rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              {match.courtNumber ? `${isEnglish ? 'COURT' : 'BANE'} ${match.courtNumber} (${isEnglish ? 'QUEUED' : 'I KØ'})` : `${isEnglish ? 'MATCH' : 'KAMP'} #${queueIndex} (${isEnglish ? 'QUEUED' : 'I KØ'})`}
            </span>
          ) : (
            <span className="px-3 py-1 bg-[#BFFF00] text-black font-black text-xs rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(191,255,0,0.3)]">
              <Flame className="w-3.5 h-3.5 fill-current" />
              {match.courtNumber ? `${isEnglish ? 'COURT' : 'BANE'} ${match.courtNumber}` : `${isEnglish ? 'MATCH' : 'KAMP'} #${queueIndex}`}
            </span>
          )}

          <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-500" /> {isEnglish ? 'Started' : 'Startet'} {startTimeStr}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isExpanded && !isLockedInQueue && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCustomMode(!isCustomMode);
              }}
              className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                isCustomMode 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : 'bg-black/50 text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              {isEnglish ? 'Custom' : 'Egendefinert'}
            </button>
          )}

          {/* Remove from queue button */}
          <button
            type="button"
            onClick={handleRemoveFromQueue}
            disabled={isPending}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition text-xs flex items-center gap-1"
            title={isEnglish ? 'Remove match from queue' : 'Fjern kamp fra kø'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isEnglish ? 'Remove' : 'Fjern'}</span>
          </button>

          {/* Expand/Collapse Toggle Button */}
          {!isLockedInQueue && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={`p-1.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold ${
                isExpanded
                  ? 'bg-gray-800 text-gray-200 border-gray-700'
                  : 'bg-[#BFFF00]/10 text-[#BFFF00] border-[#BFFF00]/40'
              }`}
            >
              {isExpanded ? (
                <>
                  <span className="text-[11px] hidden xs:inline">{t.common.close}</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span className="text-[11px] font-extrabold hidden xs:inline">{t.common.points}</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Låst i kø informasjonsstripe */}
      {isLockedInQueue && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            {isEnglish 
              ? `Waiting for previous match on court ${lockedByCourt} to be finished and saved.` 
              : `Venter på at forrige kamp på bane ${lockedByCourt} fullføres og lagres før denne kan startes.`}
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KAMPOPPSETT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* LAG A */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isExpanded && !isLockedInQueue
            ? 'bg-black/70 border-gray-800 space-y-3' 
            : 'bg-black/40 border-gray-800/80 space-y-2'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-[#BFFF00] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#BFFF00]" />
              {isEnglish ? 'Team A' : 'Lag A'}
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-[#BFFF00]">
              {scoreA !== null ? `${scoreA}p` : '-'}
            </span>
          </div>

          <div className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide leading-snug">
            <span>{match.teamAPlayer1?.name}</span>
            <span className="text-[#BFFF00] mx-2 font-bold">&</span>
            <span>{match.teamAPlayer2?.name}</span>
          </div>

          {isExpanded && !isLockedInQueue && (
            <div className="pt-2 border-t border-gray-800/80 space-y-1.5 animate-in fade-in">
              {!isCustomMode ? (
                <>
                  <span className="text-[11px] font-bold text-gray-400 block">
                    {isEnglish ? 'Select points:' : 'Velg poeng:'}
                  </span>
                  <div className="grid grid-cols-5 xs:grid-cols-7 gap-1">
                    {pointsList.map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectScoreA(pts);
                        }}
                        className={`h-8 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center ${
                          scoreA === pts
                            ? 'bg-[#BFFF00] text-black font-extrabold shadow-[0_0_10px_rgba(191,255,0,0.4)] scale-105'
                            : 'bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800/80 active:scale-95'
                        }`}
                      >
                        {pts}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <input
                  type="number"
                  min="0"
                  value={scoreA ?? ''}
                  placeholder="0"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setScoreA(e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-black border border-gray-700 text-white rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#BFFF00]"
                />
              )}
            </div>
          )}
        </div>

        {/* LAG B */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isExpanded && !isLockedInQueue
            ? 'bg-black/70 border-gray-800 space-y-3' 
            : 'bg-black/40 border-gray-800/80 space-y-2'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              {isEnglish ? 'Team B' : 'Lag B'}
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-cyan-400">
              {scoreB !== null ? `${scoreB}p` : '-'}
            </span>
          </div>

          <div className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide leading-snug">
            <span>{match.teamBPlayer1?.name}</span>
            <span className="text-cyan-400 mx-2 font-bold">&</span>
            <span>{match.teamBPlayer2?.name}</span>
          </div>

          {isExpanded && !isLockedInQueue && (
            <div className="pt-2 border-t border-gray-800/80 space-y-1.5 animate-in fade-in">
              {!isCustomMode ? (
                <>
                  <span className="text-[11px] font-bold text-gray-400 block">
                    {isEnglish ? 'Select points:' : 'Velg poeng:'}
                  </span>
                  <div className="grid grid-cols-5 xs:grid-cols-7 gap-1">
                    {pointsList.map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectScoreB(pts);
                        }}
                        className={`h-8 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center ${
                          scoreB === pts
                            ? 'bg-cyan-400 text-black font-extrabold shadow-[0_0_10px_rgba(34,211,238,0.4)] scale-105'
                            : 'bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800/80 active:scale-95'
                        }`}
                      >
                        {pts}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <input
                  type="number"
                  min="0"
                  value={scoreB ?? ''}
                  placeholder="0"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setScoreB(e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-black border border-gray-700 text-white rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-400"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      {isLockedInQueue ? (
        <div className="w-full bg-gray-900/60 border border-gray-800 text-gray-400 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" />
          <span>{isEnglish ? 'Waiting in queue' : 'Venter i kø'}</span>
        </div>
      ) : !isExpanded ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="w-full bg-[#1c2217] hover:bg-[#232d1d] border border-[#BFFF00]/40 text-[#BFFF00] py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] shadow-sm"
        >
          <ChevronDown className="w-4 h-4 stroke-[3]" />
          <span>{t.tournamentView.enterScore}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmitScore}
          disabled={isPending || scoreA === null || scoreB === null}
          className="w-full bg-[#BFFF00] text-black py-3 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_25px_rgba(191,255,0,0.35)] disabled:opacity-40"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          {isPending ? t.tournamentView.saving : scoreA === null || scoreB === null ? (isEnglish ? 'Select score' : 'Velg score') : (isEnglish ? 'Save score' : 'Fullfør kamp')}
        </button>
      )}
    </div>
  );
}

/* ================= MODAL FOR Å LEGGE TIL FLERE DELTAKERE UNDERVEIS ================= */

function AddPlayersToTournamentModal({
  tournamentId,
  allPlayers,
  existingUserIds,
  onClose
}: {
  tournamentId: string;
  allPlayers: any[];
  existingUserIds: string[];
  onClose: () => void;
}) {
  const { t, isEnglish } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isPending, startTransition] = useTransition();

  const togglePlayer = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(p => p !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleAddExisting = () => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      await addPlayersToTournament(tournamentId, selectedIds);
      onClose();
    });
  };

  const handleCreateAndAdd = () => {
    if (!newPlayerName.trim()) return;
    startTransition(async () => {
      const p = await addPlayer(newPlayerName);
      await addPlayersToTournament(tournamentId, [p.id]);
      onClose();
    });
  };

  const availablePlayers = allPlayers.filter(p => !existingUserIds.includes(p.id));

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-[#141414] border border-gray-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl relative my-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1">
          <X size={16} />
        </button>

        <div className="mb-4">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00]">
            {isEnglish ? 'Participants' : 'Deltakere'}
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
            {isEnglish ? 'Add Players' : 'Legg til spillere'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEnglish 
              ? 'New players are automatically included in subsequent draws.' 
              : 'Nye spillere inkluderes automatisk i neste trekninger.'}
          </p>
        </div>

        {/* Hurtigopprett ny spiller */}
        <div className="flex gap-2 mb-4 p-2 bg-gray-900 rounded-xl border border-gray-800">
          <input
            type="text"
            placeholder={t.tournamentModal.playerNamePlaceholder}
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            className="flex-1 bg-black border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#BFFF00]"
          />
          <button
            type="button"
            onClick={handleCreateAndAdd}
            disabled={isPending || !newPlayerName.trim()}
            className="bg-[#BFFF00] text-black px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            {isEnglish ? 'Create' : 'Opprett'}
          </button>
        </div>

        {/* Existing unadded players */}
        <div className="space-y-1.5 mb-5">
          <label className="text-xs font-bold text-gray-400 block">
            {isEnglish ? 'Existing players' : 'Eksisterende spillere'}
          </label>
          {availablePlayers.length === 0 ? (
            <p className="text-xs text-gray-600 italic">
              {isEnglish ? 'All registered players are already in this tournament.' : 'Alle registrerte spillere er allerede med i denne turneringen.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 bg-black/40 rounded-xl border border-gray-800">
              {availablePlayers.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    className={`p-2 rounded-lg text-left text-xs border flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-[#BFFF00]/15 border-[#BFFF00]/50 text-white font-bold'
                        : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="truncate pr-1">{p.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#BFFF00] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-800 text-gray-300 py-3 rounded-xl text-xs font-bold hover:bg-gray-700"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleAddExisting}
            disabled={isPending || selectedIds.length === 0}
            className="flex-1 bg-[#BFFF00] text-black py-3 rounded-xl text-xs font-extrabold hover:bg-[#b0eb00] disabled:opacity-40"
          >
            {isPending ? (isEnglish ? 'Adding...' : 'Legger til...') : (isEnglish ? 'Add' : 'Legg til')}
          </button>
        </div>
      </div>
    </div>
  );
}
