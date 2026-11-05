'use client';

import { useEffect, useState } from 'react';
import { 
  X, 
  Trophy, 
  Swords, 
  Users, 
  Award, 
  Zap, 
  TrendingUp, 
  ShieldAlert, 
  Sparkles, 
  Activity,
  Flame,
  Crown,
  Skull,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { getPlayerCareerStats } from '@/app/actions';
import { useTranslation } from '@/lib/i18n';

type PlayerCareerModalProps = {
  playerId: string;
  playerName: string;
  onClose: () => void;
};

export default function PlayerCareerModal({
  playerId,
  playerName,
  onClose,
}: PlayerCareerModalProps) {
  const { isEnglish } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFormMatch, setSelectedFormMatch] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    getPlayerCareerStats(playerId)
      .then((data) => {
        if (isMounted) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [playerId]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-[#141414] border border-gray-800 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#BFFF00] to-[#99cc00] text-black font-black text-xl flex items-center justify-center shadow-[0_0_15px_rgba(191,255,0,0.3)] shrink-0">
              {playerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00]">
                  {isEnglish ? 'Player Profile & Analysis' : 'Spillerprofil & Analyse'}
                </span>
                {stats?.totalElo && (
                  <span className="px-2 py-0.5 bg-[#BFFF00]/15 border border-[#BFFF00]/30 text-[#BFFF00] rounded-full text-[10px] font-mono font-bold">
                    {isEnglish ? 'Rating' : 'Totalrating'}: {stats.totalElo}
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">{playerName}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto space-y-4 pt-4 pr-1">
          {loading ? (
            <div className="p-8 text-center text-gray-400 space-y-2">
              <div className="w-8 h-8 border-2 border-[#BFFF00] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono">{isEnglish ? 'Fetching statistics...' : 'Henter statistikk...'}</p>
            </div>
          ) : !stats || stats.matchesCount === 0 ? (
            <div className="p-8 bg-gray-900/50 rounded-2xl border border-gray-800 text-center space-y-1">
              <p className="text-gray-300 font-bold text-sm">{isEnglish ? 'No completed matches yet' : 'Ingen fullførte kamper enda'}</p>
              <p className="text-gray-500 text-xs">
                {isEnglish 
                  ? `Statistics, form curve, and partner synergy will appear here once ${playerName} has played matches.`
                  : `Statistikk, formkurve og makkersynergi vil vises her når ${playerName} har spilt kamper.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Nøkkeltall Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">{isEnglish ? 'Matches' : 'Kamper'}</span>
                  <span className="text-xl font-black text-white mt-0.5 block">{stats.matchesCount}</span>
                  <span className="text-[10px] text-gray-500">{stats.tournamentsCount} {isEnglish ? 'tournaments' : 'turneringer'}</span>
                </div>

                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">{isEnglish ? 'W - D - L' : 'S - U - T'}</span>
                  <span className="text-xl font-black text-white mt-0.5 block font-mono">
                    <span className="text-green-400">{stats.won}</span>-
                    <span className="text-amber-400">{stats.drawn}</span>-
                    <span className="text-red-400">{stats.lost}</span>
                  </span>
                  <span className="text-[10px] text-gray-500">{stats.winRate}% {isEnglish ? 'win rate' : 'seiersrate'}</span>
                </div>

                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">{isEnglish ? 'Total Rating' : 'Totalrating'}</span>
                  <span className="text-xl font-black text-[#BFFF00] mt-0.5 block font-mono">{stats.totalElo || 1500}</span>
                  <span className="text-[10px] text-gray-500">{isEnglish ? 'avg' : 'snitt'} {stats.avgPoints}p / {isEnglish ? 'match' : 'kamp'}</span>
                </div>

                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">{isEnglish ? 'Point Difference' : 'Måldifferanse'}</span>
                  <span className={`text-xl font-black mt-0.5 block font-mono ${
                    stats.pointDiff > 0 ? 'text-green-400' : stats.pointDiff < 0 ? 'text-red-400' : 'text-gray-200'
                  }`}>
                    {stats.pointDiff > 0 ? `+${stats.pointDiff}` : stats.pointDiff}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {stats.totalPointsScored || 0} {isEnglish ? 'scored' : 'scoret'} / {stats.totalPointsConceded || 0} {isEnglish ? 'conceded' : 'innsl.'}
                  </span>
                </div>
              </div>

              {/* TURNERINGER & HISTORIKK */}
              {stats.tournamentHistory && stats.tournamentHistory.length > 0 && (
                <div className="bg-black/60 border border-gray-800 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-[#BFFF00]" />
                      <span>{isEnglish ? 'Tournament History' : 'Turneringshistorikk'}</span>
                    </h4>
                    <span className="text-[10px] font-mono text-gray-500">
                      {stats.tournamentHistory.length} {isEnglish ? 'tournaments played' : 'turneringer spilt'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {stats.tournamentHistory.map((th: any) => {
                      const dateStr = new Date(th.date).toLocaleDateString(isEnglish ? 'en-US' : 'no-NB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <div
                          key={th.id}
                          className="p-3 bg-gray-900/80 rounded-xl border border-gray-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">
                                {th.name}
                              </span>
                              <span className="px-1.5 py-0.2 bg-gray-800 text-gray-400 rounded text-[9px] font-mono shrink-0">
                                {th.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                              <span>{dateStr}</span>
                              <span>•</span>
                              <span>
                                {th.placement === 1 ? (isEnglish ? '🥇 1st place' : '🥇 1. plass') : `${th.placement}${isEnglish ? 'th place' : '. plass'}`} ({th.totalParticipants} {isEnglish ? 'players' : 'spillere'})
                              </span>
                              <span>•</span>
                              <span className="text-white font-bold">{th.totalPoints}p</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Record */}
                            <span className="text-[11px] font-mono text-gray-400">
                              <span className="text-green-400 font-bold">{th.matchesWon}</span>{isEnglish ? 'W' : 'V'} -{' '}
                              <span className="text-amber-400 font-bold">{th.matchesDrawn}</span>{isEnglish ? 'D' : 'U'} -{' '}
                              <span className="text-red-400 font-bold">{th.matchesLost}</span>{isEnglish ? 'L' : 'T'}
                            </span>

                            {/* Score/Placement badge */}
                            <div className="text-right">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-black font-mono text-[#BFFF00]">
                                  {th.totalPoints}
                                </span>
                                <span className="text-[9px] text-gray-500 uppercase font-mono">{isEnglish ? 'pts' : 'poeng'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FORMKURVE & SEIERSREKKE */}
              {stats.formCurve && stats.formCurve.length > 0 && (
                <div className="bg-black/60 border border-gray-800 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#BFFF00]" />
                      <span>{isEnglish ? 'Form Curve (Recent matches)' : 'Formkurve (Siste kamper)'}</span>
                    </h4>
                    {stats.currentStreak && stats.currentStreak.count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        stats.currentStreak.type === 'WIN'
                          ? 'bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/30'
                          : stats.currentStreak.type === 'LOSS'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-gray-800 text-gray-300'
                      }`}>
                        {stats.currentStreak.label}
                      </span>
                    )}
                  </div>

                  {/* Form outcome chips */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {stats.formCurve.map((m: any, idx: number) => {
                      const isWon = m.result === 'WON';
                      const isDraw = m.result === 'DRAW';
                      const isSelected = selectedFormMatch?.matchId === m.matchId;

                      return (
                        <button
                          key={m.matchId || idx}
                          type="button"
                          onClick={() => setSelectedFormMatch(isSelected ? null : m)}
                          className={`w-9 h-9 rounded-xl font-mono text-xs font-black flex items-center justify-center transition active:scale-95 shrink-0 ${
                            isWon
                              ? 'bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30'
                              : isDraw
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                          } ${isSelected ? 'ring-2 ring-white shadow-lg' : ''}`}
                          title={`${isEnglish ? 'Match' : 'Kamp'} ${idx + 1}: ${m.myScore}-${m.oppScore} vs ${m.opponentNames?.join(', ')}`}
                        >
                          {isWon ? (isEnglish ? 'W' : 'V') : isDraw ? (isEnglish ? 'D' : 'U') : (isEnglish ? 'L' : 'T')}
                        </button>
                      );
                    })}
                    <span className="text-[10px] text-gray-500 font-mono ml-1 shrink-0">{isEnglish ? '← Recent' : '← Siste'}</span>
                  </div>

                  {/* Selected Form Match Popup Details */}
                  {selectedFormMatch && (
                    <div className="p-3 bg-gray-900/90 rounded-xl border border-gray-700 text-xs space-y-1 animate-in fade-in">
                      <div className="flex items-center justify-between text-gray-400 text-[11px]">
                        <span>{selectedFormMatch.tournamentName || (isEnglish ? 'Tournament' : 'Turnering')}</span>
                        <span className={`font-bold ${
                          selectedFormMatch.result === 'WON' ? 'text-green-400' : selectedFormMatch.result === 'DRAW' ? 'text-amber-300' : 'text-red-400'
                        }`}>
                          {isEnglish ? 'Result:' : 'Resultat:'} {selectedFormMatch.myScore} - {selectedFormMatch.oppScore}
                        </span>
                      </div>
                      <p className="text-gray-300 font-medium">
                        {isEnglish ? 'Partner:' : 'Makker:'} <strong className="text-white">{selectedFormMatch.partnerName}</strong>
                      </p>
                      <p className="text-gray-400 text-[11px]">
                        {isEnglish ? 'Opponents:' : 'Motstandere:'} {selectedFormMatch.opponentNames?.join(' & ')}
                      </p>
                      {selectedFormMatch.eloDelta !== undefined && (
                        <p className="text-[11px] font-mono text-gray-400">
                          {isEnglish ? 'Rating change:' : 'Rating-endring:'} <span className={selectedFormMatch.eloDelta >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {selectedFormMatch.eloDelta >= 0 ? `+${selectedFormMatch.eloDelta}` : selectedFormMatch.eloDelta} Elo
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* DRØMMEMAKKER OG KRYPTONITT GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* DRØMMEMAKKER */}
                <div className="bg-gradient-to-br from-black/80 to-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">
                      {isEnglish ? 'Dream Partner' : 'Drømmemakker'}
                    </span>
                  </div>

                  {stats.dreamPartner ? (
                    <div>
                      <h4 className="text-base font-black text-white">{stats.dreamPartner.name}</h4>
                      <p className="text-xs text-amber-300 font-bold mt-0.5">
                        {isEnglish
                          ? `${stats.dreamPartner.winRate}% win rate (${stats.dreamPartner.wonTogether} of ${stats.dreamPartner.matchesTogether} matches)`
                          : `${stats.dreamPartner.winRate}% seier (${stats.dreamPartner.wonTogether} av ${stats.dreamPartner.matchesTogether} kamper)`}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {isEnglish ? 'Average:' : 'Snitt:'} <strong className="text-white font-mono">{stats.dreamPartner.avgPointsTogether}p</strong> {isEnglish ? 'per match together' : 'per kamp sammen'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs">
                      {isEnglish ? 'No regular dream partner recorded yet.' : 'Ingen fast drømmemakker registrert enda.'}
                    </p>
                  )}
                </div>

                {/* KRYPTONITT */}
                <div className="bg-gradient-to-br from-black/80 to-purple-950/20 border border-purple-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Skull className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">
                      {isEnglish ? 'Kryptonite' : 'Kryptonitt'}
                    </span>
                  </div>

                  {stats.kryptonite ? (
                    <div>
                      <h4 className="text-base font-black text-white">{stats.kryptonite.name}</h4>
                      <p className="text-xs text-purple-300 font-bold mt-0.5">
                        {isEnglish
                          ? `${stats.kryptonite.lostAgainst} losses in ${stats.kryptonite.matchesAgainst} matches (${stats.kryptonite.lossRate}% loss rate)`
                          : `${stats.kryptonite.lostAgainst} tap på ${stats.kryptonite.matchesAgainst} møter (${stats.kryptonite.lossRate}% tap)`}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {isEnglish ? `Point diff vs ${stats.kryptonite.name}:` : `Måldifferanse mot ${stats.kryptonite.name}:`} <strong className={`font-mono ${
                          stats.kryptonite.pointDiffAgainst > 0 ? 'text-green-400' : stats.kryptonite.pointDiffAgainst < 0 ? 'text-red-400' : 'text-gray-300'
                        }`}>
                          {stats.kryptonite.pointDiffAgainst > 0 ? `+${stats.kryptonite.pointDiffAgainst}` : stats.kryptonite.pointDiffAgainst}
                        </strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs">
                      {isEnglish ? 'No specific kryptonite found yet.' : 'Ingen spesifikk kryptonitt funnet enda.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Topp Makkere */}
              <div className="bg-black/60 border border-gray-800 rounded-2xl p-3.5 space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#BFFF00]" />
                  <span>{isEnglish ? 'Frequent Partners' : 'Hyppigste makkere'}</span>
                </h4>

                {stats.partners.length === 0 ? (
                  <p className="text-gray-500 text-xs">{isEnglish ? 'No partners recorded.' : 'Ingen makkere registrert.'}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stats.partners.slice(0, 6).map((p: any) => (
                      <div key={p.id} className="p-2.5 bg-gray-900/80 rounded-xl border border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-200 truncate">{p.name}</span>
                        <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                          <span className="px-2 py-0.5 rounded-md bg-[#BFFF00]/15 text-[#BFFF00] font-bold text-[11px]">
                            {p.count}x
                          </span>
                          <span className="text-[10px] text-gray-400">({p.won} {isEnglish ? 'wins' : 'seire'})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Topp Motstandere */}
              <div className="bg-black/60 border border-gray-800 rounded-2xl p-3.5 space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isEnglish ? 'Frequent Opponents' : 'Hyppigste motstandere'}</span>
                </h4>

                {stats.opponents.length === 0 ? (
                  <p className="text-gray-500 text-xs">{isEnglish ? 'No opponents recorded.' : 'Ingen motstandere registrert.'}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stats.opponents.slice(0, 6).map((opp: any) => (
                      <div key={opp.id} className="p-2.5 bg-gray-900/80 rounded-xl border border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-200 truncate">{opp.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 font-bold text-[11px] font-mono shrink-0">
                          {opp.count}x
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
