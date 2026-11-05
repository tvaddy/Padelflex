'use client';

import ResultCardModal from "./ResultCardModal";
import { useState, useTransition, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Plus, 
  Users, 
  Play, 
  Settings, 
  UserPlus, 
  UserMinus, 
  Calendar, 
  ChevronRight, 
  Info,
  X,
  Check,
  Archive,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Share2,
  TrendingUp,
  Sparkles,
  Trash2
} from 'lucide-react';
import { 
  createLeague, 
  addMemberToLeague, 
  removeMemberFromLeague, 
  getLeagueStats,
  archiveLeague,
  unarchiveLeague,
  deleteLeague,
  addPlayer
} from '@/app/actions';
import { useAuth } from './AuthContext';
import { useTranslation } from '@/lib/i18n';


type LeaguesViewProps = {
  leagues: any[];
  allPlayers: any[];
  onStartTournamentForLeague: (league: any) => void;
  onOpenTournamentDetails?: (tourneyId: string) => void;
};

type SortColumn = 'eloRating' | 'avgPointPct' | 'winRatePct' | 'matchesWon' | 'pointDiff' | 'totalPoints' | 'matchesPlayed' | 'tournamentsPlayed' | 'name';

export default function LeaguesView({
  leagues,
  allPlayers,
  onStartTournamentForLeague
}: LeaguesViewProps) {
  const { isAdmin } = useAuth();
  const { t, isEnglish } = useTranslation();
  const [leagueFilter, setLeagueFilter] = useState<'active' | 'archived'>('active');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(
    leagues.length > 0 ? leagues[0].id : null
  );
  const [isCreateLeagueModalOpen, setIsCreateLeagueModalOpen] = useState(false);
  const [isManageMembersModalOpen, setIsManageMembersModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [activeLeagueTab, setActiveLeagueTab] = useState<'leaderboard' | 'members' | 'tournaments'>('leaderboard');
  const [leagueStatsData, setLeagueStatsData] = useState<any | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [resultCardData, setResultCardData] = useState<{ type: 'match' | 'tournament' | 'league'; data: any } | null>(null);

  // Sorting state (defaults to 'eloRating' desc, primary ranking criterion)
  const [sortCol, setSortCol] = useState<SortColumn>('eloRating');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const [isPending, startTransition] = useTransition();

  const uniqueLeagues = useMemo(() => {
    const seen = new Set<string>();
    return (leagues || []).filter(l => {
      if (!l || !l.id || seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [leagues]);

  const filteredLeagues = uniqueLeagues.filter(l => 
    leagueFilter === 'active' ? !l.isArchived : l.isArchived
  );

  const selectedLeague = uniqueLeagues.find(l => l.id === selectedLeagueId) || filteredLeagues[0] || uniqueLeagues[0] || null;

  // Last ligastatistikk ved valg av liga
  useEffect(() => {
    const targetId = selectedLeague?.id;
    if (!targetId) return;

    let isCancelled = false;
    getLeagueStats(targetId)
      .then((data) => {
        if (!isCancelled) {
          setLeagueStatsData(data);
          setIsLoadingStats(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load league stats:', err);
        if (!isCancelled) {
          setIsLoadingStats(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedLeague?.id]);

  const handleHeaderClick = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDirection(col === 'name' ? 'asc' : 'desc');
    }
  };

  // Sortert ligatabell basert på aktiv kolonne
  const leaderboardList = leagueStatsData?.leaderboard;
  const sortedLeaderboard = useMemo(() => {
    if (!leaderboardList) return [];
    const list = [...leaderboardList];

    list.sort((a, b) => {
      if (sortCol === 'name') {
        const nameA = (a.user?.name || '').toLowerCase();
        const nameB = (b.user?.name || '').toLowerCase();
        return sortDirection === 'asc' ? nameA.localeCompare(nameB, isEnglish ? 'en' : 'no') : nameB.localeCompare(nameA, isEnglish ? 'en' : 'no');
      }

      let valA = a[sortCol];
      let valB = b[sortCol];

      if (typeof valA === 'number' && typeof valB === 'number') {
        if (valA !== valB) {
          return sortDirection === 'desc' ? valB - valA : valA - valB;
        }
      }

      // Tie breakers: eloRating -> avgPointPct -> winRatePct -> pointDiff
      const eloA = a.eloRating ?? 1500;
      const eloB = b.eloRating ?? 1500;
      if (eloB !== eloA) return eloB - eloA;
      if (b.avgPointPct !== a.avgPointPct) return b.avgPointPct - a.avgPointPct;
      if (b.winRatePct !== a.winRatePct) return b.winRatePct - a.winRatePct;
      return b.pointDiff - a.pointDiff;
    });

    return list;
  }, [leaderboardList, sortCol, sortDirection, isEnglish]);

  const handleArchiveToggle = () => {
    if (!selectedLeague) return;
    const isArchiving = !selectedLeague.isArchived;
    const msg = isArchiving
      ? isEnglish ? `Do you want to archive "${selectedLeague.name}"? It will be moved to the archive.` : `Vil du avslutte og arkivere "${selectedLeague.name}"? Den flyttes til arkiv.`
      : isEnglish ? `Do you want to reopen "${selectedLeague.name}" as an active league?` : `Vil du gjenåpne "${selectedLeague.name}" som en aktiv liga?`;

    if (confirm(msg)) {
      startTransition(async () => {
        if (isArchiving) {
          await archiveLeague(selectedLeague.id);
        } else {
          await unarchiveLeague(selectedLeague.id);
        }
      });
    }
  };

  const handleRenameLeague = () => {
    if (!selectedLeague) return;
    const newName = prompt(isEnglish ? 'Enter new league name:' : 'Skriv inn nytt navn for ligaen:', selectedLeague.name);
    if (newName && newName.trim() !== '' && newName.trim() !== selectedLeague.name) {
      startTransition(async () => {
        try {
          const { renameLeague } = await import('@/app/actions');
          await renameLeague(selectedLeague.id, newName);
        } catch (e: any) {
          alert(e.message || (isEnglish ? 'Could not rename league.' : 'Kunne ikke endre navn på liga.'));
        }
      });
    }
  };

  const handleChangeTargetScore = (newScore: number) => {
    if (!selectedLeague) return;
    if (newScore > 0 && newScore !== selectedLeague.defaultTargetScore) {
      startTransition(async () => {
        try {
          const { updateLeagueTargetScore } = await import('@/app/actions');
          await updateLeagueTargetScore(selectedLeague.id, newScore);
        } catch (e: any) {
          alert(e.message || (isEnglish ? 'Could not change target score.' : 'Kunne ikke endre målscore.'));
        }
      });
    }
  };

  const handleDeleteLeague = () => {
    if (!selectedLeague) return;
    if (confirm(isEnglish ? `Are you sure you want to delete league "${selectedLeague.name}" and all associated rounds/matches? This cannot be undone.` : `Er du sikker på at du vil slette ligaen "${selectedLeague.name}" og alle tilhørende runder/kamper? Dette kan ikke angres.`)) {
      startTransition(async () => {
        const res = await deleteLeague(selectedLeague.id);
        if (res && !res.success) {
          alert(res.error || (isEnglish ? 'Could not delete league' : 'Kunne ikke slette liga'));
        } else {
          const remaining = leagues.filter(l => l.id !== selectedLeague.id);
          const next = remaining.find(l => !l.isArchived) || remaining[0];
          setSelectedLeagueId(next ? next.id : null);
        }
      });
    }
  };

  const renderSortIndicator = (col: SortColumn) => {
    if (sortCol !== col) {
      return <ArrowUpDown className="w-3 h-3 text-gray-600 opacity-60 inline-block ml-1" />;
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="w-3 h-3 text-[#BFFF00] inline-block ml-1" />
      : <ArrowUp className="w-3 h-3 text-[#BFFF00] inline-block ml-1" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] rounded-full text-xs font-extrabold uppercase tracking-wider">
              {t.leagues.title}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {leagues.filter(l => !l.isArchived).length} {isEnglish ? 'active' : 'aktive'} • {leagues.filter(l => l.isArchived).length} {isEnglish ? 'archived' : 'arkiverte'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">{t.leagues.title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {t.leagues.subtitle}
          </p>
        </div>

        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 w-full sm:w-auto">
          {/* Active vs Archived Filter */}
          <div className="bg-black/60 p-1 rounded-xl border border-gray-800 flex text-xs font-bold w-full xs:w-auto">
            <button
              type="button"
              onClick={() => {
                setLeagueFilter('active');
                const firstActive = uniqueLeagues.find(l => !l.isArchived);
                if (firstActive) setSelectedLeagueId(firstActive.id);
              }}
              className={`flex-1 xs:flex-none px-3 py-1.5 rounded-lg transition text-center ${
                leagueFilter === 'active' ? 'bg-gray-800 text-white font-extrabold' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.common.active}
            </button>
            <button
              type="button"
              onClick={() => {
                setLeagueFilter('archived');
                const firstArchived = uniqueLeagues.find(l => l.isArchived);
                if (firstArchived) setSelectedLeagueId(firstArchived.id);
              }}
              className={`flex-1 xs:flex-none px-3 py-1.5 rounded-lg transition text-center ${
                leagueFilter === 'archived' ? 'bg-gray-800 text-white font-extrabold' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.common.archived}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateLeagueModalOpen(true)}
            className="w-full xs:w-auto bg-[#BFFF00] text-black px-4 sm:px-5 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_20px_rgba(191,255,0,0.25)] shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t.leagues.createLeague}</span>
          </button>
        </div>
      </div>

      {filteredLeagues.length === 0 ? (
        <div className="p-10 sm:p-12 text-center bg-gray-900/40 border border-gray-800 border-dashed rounded-3xl">
          <Trophy className="w-14 h-14 text-gray-700 mx-auto mb-3" />
          <h3 className="text-lg sm:text-xl font-bold text-gray-200">
            {leagueFilter === 'active' 
              ? (isEnglish ? 'No active leagues found' : 'Ingen aktive ligaer funnet')
              : (isEnglish ? 'No archived leagues found' : 'Ingen arkiverte ligaer funnet')}
          </h3>
          <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mt-1">
            {leagueFilter === 'active'
              ? (isEnglish 
                  ? 'Create a league to gather regular players and track persistent standings across rounds.' 
                  : 'Opprett en liga for å samle faste spillere og føre kontinuerlig tabell over flere runder.')
              : (isEnglish 
                  ? 'Finished or archived leagues will appear here.' 
                  : 'Avsluttede ligaer havner her i arkivet.')}
          </p>
          {leagueFilter === 'active' && (
            <button
              type="button"
              onClick={() => setIsCreateLeagueModalOpen(true)}
              className="mt-5 bg-[#BFFF00] text-black px-6 py-2.5 rounded-2xl font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" /> {t.leagues.createLeague}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar / Ligavelger */}
          <div className="lg:col-span-1 space-y-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 px-2 block">
              {leagueFilter === 'active' ? t.leagues.activeLeagues : t.leagues.archivedLeagues}
            </span>
            <div className="space-y-2">
              {filteredLeagues.map((league) => {
                const isSelected = selectedLeague?.id === league.id;
                const memberCount = league.members?.length || 0;
                const tourneyCount = league.tournaments?.length || 0;

                return (
                  <button
                    key={league.id}
                    type="button"
                    onClick={() => {
                      if (selectedLeagueId !== league.id) {
                        setSelectedLeagueId(league.id);
                      }
                    }}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-gray-900 to-gray-850 border-[#BFFF00]/60 shadow-[0_0_15px_rgba(191,255,0,0.1)]'
                        : 'bg-[#141414] border-gray-800/80 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-[#BFFF00] text-black' : 'bg-gray-800 text-gray-400'
                        }`}>
                          <Trophy className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`font-bold text-sm truncate max-w-[130px] ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                            {league.name}
                          </p>
                          <span className="text-[10px] text-gray-500 font-mono block">
                            {memberCount} {isEnglish ? 'players' : 'spillere'} • {tourneyCount} {isEnglish ? 'rounds' : 'runder'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-[#BFFF00]' : 'text-gray-600'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hovedvisning for Valgt Liga */}
          {selectedLeague && (
            <div className="lg:col-span-3 space-y-6">
              {/* League Banner */}
              <div className="bg-gradient-to-br from-[#161616] via-[#141414] to-gray-900 p-5 sm:p-6 rounded-3xl border border-gray-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      selectedLeague.isArchived 
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300' 
                        : 'bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00]'
                    }`}>
                      {selectedLeague.isArchived ? t.common.archived : (isEnglish ? 'Active League' : 'Aktiv Liga')}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {selectedLeague.defaultTargetScore || 21}p {isEnglish ? 'default target score' : 'standard målscore'}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1">{selectedLeague.name}</h3>
                  {selectedLeague.description && (
                    <p className="text-gray-400 text-xs mt-1 max-w-xl">{selectedLeague.description}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                  {!selectedLeague.isArchived && (
                    <button
                      type="button"
                      onClick={() => onStartTournamentForLeague(selectedLeague)}
                      className="w-full sm:w-auto bg-[#BFFF00] text-black px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_15px_rgba(191,255,0,0.25)]"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{t.leagues.startRound}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="w-full sm:w-auto bg-gray-900 text-gray-300 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-bold border border-gray-800 hover:bg-gray-800 transition flex items-center justify-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5 text-gray-400" />
                    <span>{isEnglish ? 'Settings' : 'Innstillinger'}</span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs for League */}
              <div className="flex border-b border-gray-800 gap-2 sm:gap-6 w-full overflow-x-auto no-scrollbar scroll-smooth">
                <button
                  type="button"
                  onClick={() => setActiveLeagueTab('leaderboard')}
                  className={`pb-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition shrink-0 whitespace-nowrap px-1 ${
                    activeLeagueTab === 'leaderboard'
                      ? 'border-[#BFFF00] text-[#BFFF00] font-extrabold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Trophy className="w-4 h-4 shrink-0" />
                  <span>{t.leagues.leaderboard}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLeagueTab('tournaments')}
                  className={`pb-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition shrink-0 whitespace-nowrap px-1 ${
                    activeLeagueTab === 'tournaments'
                      ? 'border-[#BFFF00] text-[#BFFF00] font-extrabold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>{isEnglish ? `Rounds (${selectedLeague.tournaments?.length || 0})` : `Runder (${selectedLeague.tournaments?.length || 0})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLeagueTab('members')}
                  className={`pb-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition shrink-0 whitespace-nowrap px-1 ${
                    activeLeagueTab === 'members'
                      ? 'border-[#BFFF00] text-[#BFFF00] font-extrabold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{isEnglish ? `Members (${selectedLeague.members?.length || 0})` : `Faste spillere (${selectedLeague.members?.length || 0})`}</span>
                </button>
              </div>

              {/* ================= TAB 1: LIGATABELL & STATISTIKK ================= */}
              {activeLeagueTab === 'leaderboard' && (
                <div className="space-y-4">
                  {/* Header bar */}
                  <div className="p-3.5 bg-gray-900/60 rounded-2xl border border-gray-800/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Trophy className="w-4 h-4 text-[#BFFF00] shrink-0" />
                      <span className="font-extrabold text-sm text-white">{t.leagues.eloRating}</span>
                    </div>
                    {leagueStatsData && leagueStatsData.leaderboard.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setResultCardData({
                          type: 'league',
                          data: {
                            name: `${selectedLeague.name} (${isEnglish ? 'League Standings' : 'Ligatabell'})`,
                            participants: sortedLeaderboard.map((s: any) => ({
                              userId: s.userId,
                              user: s.user,
                              totalPoints: s.totalPoints,
                              matchesWon: s.matchesWon,
                              matchesDrawn: s.matchesDrawn,
                              matchesLost: s.matchesLost,
                              eloRating: s.eloRating,
                              avgPointPct: s.avgPointPct,
                              winRatePct: s.winRatePct
                            })),
                            matches: []
                          }
                        })}
                        className="px-3 py-1.5 bg-[#BFFF00]/10 hover:bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{isEnglish ? 'Share Result' : 'Del resultat'}</span>
                      </button>
                    )}
                  </div>

                  {isLoadingStats ? (
                    <div className="p-12 text-center text-gray-500 text-xs">
                      {t.common.loading}
                    </div>
                  ) : !leagueStatsData || leagueStatsData.leaderboard.length === 0 ? (
                    <div className="p-8 text-center bg-[#141414] border border-gray-800 rounded-3xl">
                      <p className="text-gray-400 text-sm font-bold">
                        {isEnglish ? 'No matches recorded in this league yet.' : 'Ingen kamper er registrert i denne ligaen ennå.'}
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        {isEnglish ? 'Start a round to build up the league leaderboard.' : 'Start en runde for å bygge opp ligatabellen.'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-[#141414] rounded-3xl border border-gray-800 overflow-hidden shadow-xl space-y-2">
                      
                      {/* Mobile Sorteringsvelger (Pills) */}
                      <div className="p-3 bg-gray-900/40 border-b border-gray-800/80 md:hidden space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                          {isEnglish ? 'Sort table by:' : 'Sorter tabell etter:'}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { id: 'eloRating', label: t.leagues.eloRating },
                            { id: 'avgPointPct', label: t.leagues.avgScorePct },
                            { id: 'winRatePct', label: t.leagues.winRate },
                            { id: 'pointDiff', label: '+/-' },
                            { id: 'totalPoints', label: t.common.points },
                            { id: 'matchesPlayed', label: t.common.matches },
                            { id: 'name', label: isEnglish ? 'Name' : 'Navn' }
                          ].map((pill) => (
                            <button
                              key={pill.id}
                              type="button"
                              onClick={() => handleHeaderClick(pill.id as SortColumn)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 ${
                                sortCol === pill.id
                                  ? 'bg-[#BFFF00] text-black'
                                  : 'bg-black/60 text-gray-400 border border-gray-800'
                              }`}
                            >
                              <span>{pill.label}</span>
                              {sortCol === pill.id && (
                                sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Mobile Compact 1-Row List for League Leaderboard */}
                      <div className="p-2 space-y-1.5 md:hidden">
                        {sortedLeaderboard.map((stat: any, index: number) => {
                          const isLeader = index === 0 && stat.matchesPlayed > 0;
                          return (
                            <div
                              key={stat.userId}
                              className={`p-2.5 px-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                                isLeader
                                  ? 'bg-[#181d14] border-[#BFFF00]/40 shadow-sm'
                                  : 'bg-[#181818] border-gray-800/80'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                                  isLeader ? 'bg-[#BFFF00] text-black' : 'bg-gray-800 text-gray-300'
                                }`}>
                                  {index + 1}
                                </span>
                                <div className="min-w-0">
                                  <span className="font-extrabold text-xs text-white truncate block">
                                    {stat.user.name}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    {stat.matchesWon}{isEnglish ? 'W' : 'V'} - {stat.matchesDrawn}{isEnglish ? 'D' : 'U'} - {stat.matchesLost}{isEnglish ? 'L' : 'T'} ({stat.totalPoints}p)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 text-right font-mono">
                                <div className="text-right">
                                  <span className="text-[11px] text-[#BFFF00] font-black block">
                                    {stat.eloRating || 1500}
                                  </span>
                                  <span className="text-[9px] text-gray-400 block">
                                    {stat.avgPointPct.toFixed(0)}% • {stat.winRatePct.toFixed(0)}%{isEnglish ? 'W' : 'V'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View with Column Sorting */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                          <thead className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-800/80 bg-gray-900/40">
                            <tr>
                              <th className="px-4 py-3.5 text-center w-12">#</th>
                              <th 
                                onClick={() => handleHeaderClick('name')}
                                className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none"
                              >
                                <span>{t.tournamentView.player}</span>
                                {renderSortIndicator('name')}
                              </th>
                              <th 
                                onClick={() => handleHeaderClick('eloRating')}
                                className="px-4 py-3.5 text-center font-extrabold text-[#BFFF00] cursor-pointer hover:text-[#b0eb00] transition select-none"
                              >
                                <span>{t.leagues.eloRating}</span>
                                {renderSortIndicator('eloRating')}
                              </th>
                              <th 
                                onClick={() => handleHeaderClick('avgPointPct')}
                                className="px-4 py-3.5 text-center font-bold text-gray-200 cursor-pointer hover:text-white transition select-none"
                              >
                                <span>{t.leagues.avgScorePct}</span>
                                {renderSortIndicator('avgPointPct')}
                              </th>
                              <th 
                                onClick={() => handleHeaderClick('winRatePct')}
                                className="px-4 py-3.5 text-center cursor-pointer hover:text-white transition select-none"
                              >
                                <span>{t.leagues.winRate}</span>
                                {renderSortIndicator('winRatePct')}
                              </th>
                              <th 
                                onClick={() => handleHeaderClick('matchesWon')}
                                className="px-4 py-3.5 text-center cursor-pointer hover:text-white transition select-none"
                              >
                                <span>{isEnglish ? 'W / D / L' : 'S / U / T'}</span>
                                {renderSortIndicator('matchesWon')}
                              </th>
                              <th 
                                onClick={() => handleHeaderClick('pointDiff')}
                                className="px-4 py-3.5 text-center cursor-pointer hover:text-white transition select-none"
                              >
                                <span>+/-</span>
                                {renderSortIndicator('pointDiff')}
                              </th>
                              <th 
                                onClick={() => handleHeaderClick('totalPoints')}
                                className="px-4 py-3.5 text-center font-bold text-white cursor-pointer hover:text-[#BFFF00] transition select-none"
                              >
                                <span>{t.common.points}</span>
                                {renderSortIndicator('totalPoints')}
                              </th>
                              <th 
                                onClick={() => handleHeaderClick('matchesPlayed')}
                                className="px-4 py-3.5 text-center text-gray-400 cursor-pointer hover:text-white transition select-none"
                              >
                                <span>{t.common.matches}</span>
                                {renderSortIndicator('matchesPlayed')}
                              </th>
                              <th 
                                onClick={() => handleHeaderClick('tournamentsPlayed')}
                                className="px-4 py-3.5 text-center text-gray-400 cursor-pointer hover:text-white transition select-none"
                              >
                                <span>{isEnglish ? 'Rounds' : 'Runder'}</span>
                                {renderSortIndicator('tournamentsPlayed')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/50 text-xs sm:text-sm">
                            {sortedLeaderboard.map((stat: any, index: number) => {
                              const isLeader = index === 0 && stat.matchesPlayed > 0;
                              return (
                                <tr 
                                  key={stat.userId}
                                  className={`transition-colors hover:bg-gray-800/40 ${
                                    isLeader ? 'bg-[#BFFF00]/5' : ''
                                  }`}
                                >
                                  <td className="px-4 py-3.5 text-center font-mono font-bold">
                                    {isLeader ? (
                                      <span className="text-[#BFFF00] flex items-center justify-center">
                                        <Trophy className="w-4 h-4 mr-1" /> 1
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">{index + 1}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold ${isLeader ? 'text-white' : 'text-gray-200'}`}>
                                        {stat.user.name}
                                      </span>
                                      {stat.isMember && (
                                        <span className="px-1.5 py-0.2 bg-gray-800 text-gray-400 text-[9px] font-bold rounded">
                                          {isEnglish ? 'Member' : 'Fast'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  {/* Elo Rating (Primary) */}
                                  <td className="px-4 py-3.5 text-center font-mono">
                                    <span className="px-2.5 py-1 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] font-black text-xs sm:text-sm rounded-xl shadow-sm">
                                      {stat.eloRating || 1500}
                                    </span>
                                  </td>
                                  {/* Relative Point Percentage */}
                                  <td className="px-4 py-3.5 text-center font-mono">
                                    <span className="text-gray-300 font-bold text-xs">
                                      {stat.avgPointPct.toFixed(1)} %
                                    </span>
                                  </td>
                                  {/* Relative Win Rate Percentage */}
                                  <td className="px-4 py-3.5 text-center font-mono text-xs text-gray-200 font-bold">
                                    {stat.winRatePct.toFixed(1)} %
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-mono text-xs text-gray-300">
                                    <span className="text-green-400 font-bold">{stat.matchesWon}</span>
                                    <span className="text-gray-600 mx-1">/</span>
                                    <span className="text-amber-400 font-bold">{stat.matchesDrawn}</span>
                                    <span className="text-gray-600 mx-1">/</span>
                                    <span className="text-red-400 font-bold">{stat.matchesLost}</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-mono text-xs">
                                    <span className={stat.pointDiff > 0 ? 'text-green-400 font-bold' : stat.pointDiff < 0 ? 'text-red-400' : 'text-gray-500'}>
                                      {stat.pointDiff > 0 ? `+${stat.pointDiff}` : stat.pointDiff}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-mono font-bold text-white">
                                    {stat.totalPoints}
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-mono text-xs text-gray-400">
                                    {stat.matchesPlayed}
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-mono text-xs text-gray-500">
                                    {stat.tournamentsPlayed}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= TAB 2: SPILTE RUNDER ================= */}
              {activeLeagueTab === 'tournaments' && (
                <div className="space-y-3">
                  {(selectedLeague.tournaments || []).length === 0 ? (
                    <div className="p-8 text-center bg-[#141414] border border-gray-800 rounded-3xl">
                      <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm font-bold">
                        {isEnglish ? 'No rounds have been played in this league yet.' : 'Ingen runder er spilt i denne ligaen ennå.'}
                      </p>
                      {!selectedLeague.isArchived && (
                        <button
                          type="button"
                          onClick={() => onStartTournamentForLeague(selectedLeague)}
                          className="mt-4 bg-[#BFFF00] text-black px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> {t.leagues.startRound}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedLeague.tournaments.map((tourney: any) => {
                        const winner = tourney.participants && tourney.participants[0];
                        const dateStr = new Date(tourney.createdAt).toLocaleDateString(isEnglish ? 'en-US' : 'no-NB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        });

                        return (
                          <div
                            key={tourney.id}
                            className="bg-[#141414] p-4 sm:p-5 rounded-2xl border border-gray-800 flex flex-col justify-between gap-3"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-mono text-gray-500 block">{dateStr}</span>
                                <h4 className="text-sm font-extrabold text-white mt-0.5">{tourney.name}</h4>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tourney.isActive 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/40' 
                                  : 'bg-gray-800 text-gray-400'
                              }`}>
                                {tourney.isActive ? (isEnglish ? 'In Progress' : 'Pågår nå') : t.common.completed}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-800/80">
                              <span className="text-gray-400">
                                {tourney.participants?.length || 0} {isEnglish ? 'players' : 'spillere'} • {tourney.matches?.length || 0} {isEnglish ? 'matches' : 'kamper'}
                              </span>
                              {winner && !tourney.isActive && (
                                <span className="text-[#BFFF00] font-bold flex items-center gap-1">
                                  <Trophy className="w-3.5 h-3.5" /> {winner.user?.name} ({winner.totalPoints}p)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ================= TAB 3: FASTE SPILLERE ================= */}
              {activeLeagueTab === 'members' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {isEnglish ? 'League Members' : 'Faste ligamedlemmer'}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {isEnglish 
                          ? 'These are preselected automatically when starting a round in this league.' 
                          : 'Disse forhåndsvelges automatisk når du starter en runde i ligaen.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsManageMembersModalOpen(true)}
                      className="bg-gray-900 hover:bg-gray-800 text-[#BFFF00] border border-gray-800 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {isEnglish ? 'Edit Members' : 'Endre faste'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {(selectedLeague.members || []).map((m: any) => (
                      <div key={m.id} className="bg-[#141414] p-3.5 rounded-2xl border border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gray-800 text-[#BFFF00] font-extrabold flex items-center justify-center text-xs">
                            {m.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-white">{m.user.name}</p>
                            <span className="text-[10px] text-gray-500">
                              {isEnglish ? 'Member' : 'Fast medlem'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              await removeMemberFromLeague(selectedLeague.id, m.userId);
                            });
                          }}
                          disabled={isPending}
                          title={isEnglish ? 'Remove from league members' : 'Fjern fra faste medlemmer'}
                          className="text-gray-600 hover:text-red-400 p-1.5 transition"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* 1. Opprett Ny Liga Modal */}
      {isCreateLeagueModalOpen && (
        <CreateLeagueModal
          onClose={() => setIsCreateLeagueModalOpen(false)}
          allPlayers={allPlayers}
          onCreated={(newLeague) => {
            setSelectedLeagueId(newLeague.id);
          }}
        />
      )}

      {/* 2. Administrer Faste Spillere Modal */}
      {isManageMembersModalOpen && selectedLeague && (
        <ManageMembersModal
          league={selectedLeague}
          allPlayers={allPlayers}
          onClose={() => setIsManageMembersModalOpen(false)}
        />
      )}

      {/* 3. Resultatkort & Deling Modal for Ligatabell */}
      

      {/* 4. Innstillinger Modal for valgt liga */}
      {isSettingsModalOpen && selectedLeague && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-[#141414] border border-gray-800 w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl relative my-6">
            <button onClick={() => setIsSettingsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1">
              <X size={16} />
            </button>

            <div className="mb-5 border-b border-gray-800/80 pb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00]">
                {isEnglish ? 'Settings' : 'Innstillinger'}
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{selectedLeague.name}</h3>
            </div>

            <div className="space-y-4">
              {/* Administrer faste spillere */}
              <button
                type="button"
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  setIsManageMembersModalOpen(true);
                }}
                className="w-full bg-gray-900 text-gray-200 hover:text-white px-4 py-3 rounded-xl text-xs font-bold border border-gray-800 hover:bg-gray-800 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>{isEnglish ? `Members (${selectedLeague.members?.length || 0})` : `Faste spillere (${selectedLeague.members?.length || 0})`}</span>
                </div>
                <Settings className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {/* Endre navn */}
              <button
                type="button"
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  handleRenameLeague();
                }}
                disabled={isPending}
                className="w-full bg-gray-900 text-gray-200 hover:text-white px-4 py-3 rounded-xl text-xs font-bold border border-gray-800 hover:bg-gray-800 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-gray-400" />
                  <span>{isEnglish ? 'Rename league' : 'Endre liganavn'}</span>
                </div>
              </button>

              {/* Endre målscore */}
              <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-800 space-y-2">
                <label className="text-[11px] font-bold text-gray-400 block px-1">
                  {isEnglish ? 'Change default target score' : 'Endre standard målscore'}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[16, 21, 24, 32].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => {
                        handleChangeTargetScore(pts);
                        setIsSettingsModalOpen(false);
                      }}
                      className={`py-2 text-xs font-mono font-bold rounded-lg transition ${
                        selectedLeague.defaultTargetScore === pts
                          ? 'bg-[#BFFF00] text-black shadow-[0_0_10px_rgba(191,255,0,0.2)]'
                          : 'bg-black/60 text-gray-400 hover:text-white border border-gray-800'
                      }`}
                    >
                      {pts}p
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800/80 space-y-2">
                {/* Arkiver */}
                <button
                  type="button"
                  onClick={() => {
                    handleArchiveToggle();
                    setIsSettingsModalOpen(false);
                  }}
                  disabled={isPending}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                    selectedLeague.isArchived
                      ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-gray-900/60 hover:bg-gray-800 text-gray-400 hover:text-amber-300 border-gray-800'
                  }`}
                >
                  {selectedLeague.isArchived ? (
                    <>
                      <RotateCcw className="w-4 h-4" /> <span>{isEnglish ? 'Reopen league' : 'Gjenåpne liga'}</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" /> <span>{isEnglish ? 'Archive league' : 'Arkiver liga'}</span>
                    </>
                  )}
                </button>

                {/* Slett (Admin) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteLeague();
                      setIsSettingsModalOpen(false);
                    }}
                    disabled={isPending}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 mt-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isEnglish ? 'Delete league permanently' : 'Slett liga permanent'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Card Modal */}
      {resultCardData && (
        <ResultCardModal
          type={resultCardData.type}
          data={resultCardData.data}
          onClose={() => setResultCardData(null)}
        />
      )}
    </div>
  );
}

/* ================= MODAL SUB-COMPONENTS ================= */

function CreateLeagueModal({
  onClose,
  allPlayers,
  onCreated
}: {
  onClose: () => void;
  allPlayers: any[];
  onCreated: (league: any) => void;
}) {
  const { isEnglish } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultTargetScore, setDefaultTargetScore] = useState<number>(21);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const togglePlayer = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(p => p !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const newLeague = await createLeague(name, description, selectedMemberIds, defaultTargetScore);
      onCreated(newLeague);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-[#141414] border border-gray-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl relative my-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1">
          <X size={16} />
        </button>

        <div className="mb-4">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00]">
            {isEnglish ? 'New League' : 'Ny Liga'}
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
            {isEnglish ? 'Create New League' : 'Opprett ny liga'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEnglish 
              ? 'Group tournaments and track persistent standings for a regular group or season.' 
              : 'Samle turneringer og før tabell for en fast gjeng eller sesong.'}
          </p>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-bold text-gray-300 block mb-1">
              {isEnglish ? 'League Name' : 'Liganavn'}
            </label>
            <input
              type="text"
              placeholder={isEnglish ? 'e.g. Monday Padel, Winter League 2026' : 'f.eks. Mandagspadel, Vinterliga 2026, Bedriftsserien'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-gray-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#BFFF00]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-300 block mb-1">
              {isEnglish ? 'Default target score per match' : 'Standard målscore per kamp'}
            </label>
            <div className="grid grid-cols-4 gap-1 bg-black/60 p-1 rounded-xl border border-gray-800">
              {[16, 21, 24, 32].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setDefaultTargetScore(pts)}
                  className={`py-1.5 text-xs font-mono font-bold rounded-lg transition ${
                    defaultTargetScore === pts
                      ? 'bg-[#BFFF00] text-black font-extrabold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {pts}p
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-300 block mb-1">
              {isEnglish ? 'Description (optional)' : 'Beskrivelse (valgfritt)'}
            </label>
            <input
              type="text"
              placeholder={isEnglish ? 'e.g. Regular Tuesday tournament at Oslo Padel' : 'f.eks. Fast tirsdagsrunde på Oslo Padelklubb'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-black border border-gray-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#BFFF00]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-300 block mb-1">
              {isEnglish ? `Regular members (${selectedMemberIds.length} selected)` : `Faste spillere (${selectedMemberIds.length} valgt)`}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1 bg-black/40 rounded-xl border border-gray-800">
              {allPlayers.map((player) => {
                const isSelected = selectedMemberIds.includes(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(player.id)}
                    className={`p-2 rounded-lg text-left text-xs border flex items-center justify-between transition ${
                      isSelected 
                        ? 'bg-[#BFFF00]/15 border-[#BFFF00]/50 text-white font-bold' 
                        : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="truncate pr-1">{player.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#BFFF00] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            className="w-full bg-[#BFFF00] text-black font-extrabold text-xs sm:text-sm py-3.5 rounded-2xl hover:bg-[#b0eb00] transition active:scale-95 disabled:opacity-40"
          >
            {isPending ? (isEnglish ? 'Creating...' : 'Oppretter...') : (isEnglish ? 'Create league' : 'Opprett liga')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageMembersModal({
  league,
  allPlayers,
  onClose
}: {
  league: any;
  allPlayers: any[];
  onClose: () => void;
}) {
  const { isEnglish } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [quickPlayerName, setQuickPlayerName] = useState('');

  const currentMemberIds = (league.members || []).map((m: any) => m.userId);

  const handleToggleMember = (userId: string) => {
    startTransition(async () => {
      if (currentMemberIds.includes(userId)) {
        await removeMemberFromLeague(league.id, userId);
      } else {
        await addMemberToLeague(league.id, userId);
      }
    });
  };

  const handleAddQuickPlayer = () => {
    if (!quickPlayerName.trim()) return;
    startTransition(async () => {
      const p = await addPlayer(quickPlayerName);
      await addMemberToLeague(league.id, p.id);
      setQuickPlayerName('');
    });
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-[#141414] border border-gray-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl relative my-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1">
          <X size={16} />
        </button>

        <div className="mb-4">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00]">
            {isEnglish ? 'Members' : 'Medlemmer'}
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
            {isEnglish ? `Regular members in ${league.name}` : `Faste spillere i ${league.name}`}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEnglish ? 'Add or remove regular players for this league.' : 'Legg til eller fjern faste deltakere for denne ligaen.'}
          </p>
        </div>

        {/* Hurtigopprett ny spiller */}
        <div className="flex gap-2 mb-3 p-2 bg-gray-900 rounded-xl border border-gray-800">
          <input
            type="text"
            placeholder={isEnglish ? 'Create new player and add to league...' : 'Opprett ny spiller og legg til i liga...'}
            value={quickPlayerName}
            onChange={(e) => setQuickPlayerName(e.target.value)}
            className="flex-1 bg-black border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#BFFF00]"
          />
          <button
            type="button"
            onClick={handleAddQuickPlayer}
            disabled={isPending || !quickPlayerName.trim()}
            className="bg-[#BFFF00] text-black px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            + {isEnglish ? 'Add' : 'Legg til'}
          </button>
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto p-1 bg-black/40 rounded-xl border border-gray-800 mb-4">
          {allPlayers.map((player) => {
            const isMember = currentMemberIds.includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => handleToggleMember(player.id)}
                disabled={isPending}
                className={`p-2 rounded-xl text-left border flex items-center justify-between transition ${
                  isMember
                    ? 'bg-[#BFFF00]/15 border-[#BFFF00]/60 text-white font-bold'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <span className="text-xs truncate pr-1">{player.name}</span>
                {isMember ? (
                  <Check className="w-3.5 h-3.5 text-[#BFFF00] shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-gray-700 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs py-3 rounded-xl transition"
        >
          {isEnglish ? 'Done' : 'Ferdig'}
        </button>
      </div>
    </div>
  );
}
