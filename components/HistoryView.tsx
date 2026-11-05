'use client';

import ResultCardModal from "./ResultCardModal";
import { useState, useTransition } from 'react';
import { 
  History, 
  Trophy, 
  Calendar, 
  Users, 
  Zap, 
  ChevronRight, 
  X, 
  Clock, 
  Edit3, 
  CheckCircle2,
  RotateCcw,
  Trash2,
  Share2
} from 'lucide-react';
import EditMatchModal from './EditMatchModal';

import { formatDurationMinutes, formatTimeOnly, isMatchEditable } from '@/lib/match-utils';
import { reopenTournament, deleteTournament } from '@/app/actions';
import { useAuth } from './AuthContext';
import { useTranslation } from '@/lib/i18n';

type HistoryViewProps = {
  tournamentHistory: any[];
  onOpenDetails?: (tournament: any) => void;
};

export default function HistoryView({ tournamentHistory }: HistoryViewProps) {
  const { t, isEnglish } = useTranslation();
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-full text-xs font-extrabold uppercase tracking-wider">
            {t.history.title}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            {tournamentHistory.length} {isEnglish ? 'completed tournaments' : 'fullførte turneringer'}
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">{t.history.title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {t.history.subtitle}
        </p>
      </div>

      {tournamentHistory.length === 0 ? (
        <div className="p-10 sm:p-12 text-center bg-gray-900/40 border border-gray-800 border-dashed rounded-3xl">
          <History className="w-14 h-14 text-gray-700 mx-auto mb-3" />
          <h3 className="text-lg sm:text-xl font-bold text-gray-200">{t.history.noHistory}</h3>
          <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mt-1">
            {isEnglish 
              ? 'When you complete a tournament, it will be archived here with complete final standings and timing statistics.' 
              : 'Når du fullfører en turnering (enten enkeltturnering eller ligarunde), arkiveres den her med komplett sluttresultat og tidsstatistikk.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournamentHistory.map((tourney) => {
            const isLeague = !!tourney.leagueId;
            const winner = tourney.participants && tourney.participants[0];
            const dateStr = new Date(tourney.createdAt).toLocaleDateString(isEnglish ? 'en-US' : 'no-NB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            const avgMinutes = tourney.avgMatchDurationMinutes || 12;
            const totalMatches = tourney.matches?.length || 0;

            return (
              <div
                key={tourney.id}
                onClick={() => setSelectedTournament(tourney)}
                className="bg-[#141414] hover:bg-[#181818] p-5 rounded-3xl border border-gray-800 hover:border-gray-700 transition-all cursor-pointer flex flex-col justify-between gap-3.5 group shadow-lg"
              >
                <div>
                  {/* Top Badge: Enkeltturnering vs Liga */}
                  <div className="flex items-center justify-between mb-2">
                    {isLeague ? (
                      <span className="px-2.5 py-0.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> {isEnglish ? 'League' : 'Liga'}: {tourney.league?.name}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {t.tournamentModal.singleTournamentTitle}
                      </span>
                    )}

                    <span className="text-[11px] font-mono text-gray-500">{dateStr}</span>
                  </div>

                  <h3 className="text-base font-extrabold text-white group-hover:text-[#BFFF00] transition">
                    {tourney.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {tourney.type} • {tourney.targetScore}p {isEnglish ? 'per match' : 'per kamp'} • {totalMatches} {isEnglish ? 'matches' : 'kamper'}
                  </p>

                  {/* Average match duration indicator */}
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5 text-[#BFFF00]" />
                    <span>{isEnglish ? 'Avg duration:' : 'Gj.snitt varighet:'} <strong className="text-white font-mono">{avgMinutes} {isEnglish ? 'min / match' : 'min / kamp'}</strong></span>
                  </div>
                </div>

                {/* Winner & Stats Summary */}
                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                  <div>
                    {winner ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Trophy className="w-4 h-4 text-[#BFFF00]" />
                        <span className="font-extrabold text-white">{winner.user?.name}</span>
                        <span className="font-mono text-[#BFFF00] font-bold">({winner.totalPoints}p)</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">{isEnglish ? 'No results' : 'Ingen resultater'}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-white transition">
                    <span>{tourney.participants?.length || 0} {isEnglish ? 'players' : 'spillere'}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#BFFF00]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detaljert Turneringsmodal */}
      {selectedTournament && (
        <PastTournamentDetailsModal
          tournament={selectedTournament}
          onClose={() => setSelectedTournament(null)}
        />
      )}
    </div>
  );
}

function PastTournamentDetailsModal({
  tournament,
  onClose
}: {
  tournament: any;
  onClose: () => void;
}) {
  const { isAdmin } = useAuth();
  const { t, isEnglish } = useTranslation();
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [resultCardData, setResultCardData] = useState<{ type: 'match' | 'tournament'; data: any } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLeague = !!tournament.leagueId;
  const dateStr = new Date(tournament.createdAt).toLocaleDateString(isEnglish ? 'en-US' : 'no-NB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const avgMinutes = tournament.avgMatchDurationMinutes || 12;

  // Sjekk om turneringen ble opprettet eller fullført i dag (slik at vanlige brukere kan gjenåpne samme dag)
  const isToday = () => {
    const today = new Date();
    const created = new Date(tournament.createdAt);
    const completed = tournament.completedAt ? new Date(tournament.completedAt) : null;

    const isSameCreated =
      today.getFullYear() === created.getFullYear() &&
      today.getMonth() === created.getMonth() &&
      today.getDate() === created.getDate();

    const isSameCompleted = completed ? (
      today.getFullYear() === completed.getFullYear() &&
      today.getMonth() === completed.getMonth() &&
      today.getDate() === completed.getDate()
    ) : false;

    return isSameCreated || isSameCompleted;
  };

  const canReopen = isAdmin || isToday();
  const canDelete = isAdmin || isToday();

  const handleReopen = () => {
    if (confirm(isEnglish ? `Do you want to reopen "${tournament.name}"? It will become active again.` : `Vil du gjenåpne turneringen "${tournament.name}"? Den vil settes som aktiv igjen.`)) {
      startTransition(async () => {
        const res = await reopenTournament(tournament.id);
        if (res.success) {
          onClose();
        } else {
          alert(res.error || (isEnglish ? 'Could not reopen tournament.' : 'Kunne ikke gjenåpne turnering.'));
        }
      });
    }
  };

  const handleDelete = () => {
    if (confirm(isEnglish ? `Are you sure you want to delete "${tournament.name}"? This cannot be undone.` : `Er du sikker på at du vil slette turneringen "${tournament.name}"? Dette kan ikke angres.`)) {
      startTransition(async () => {
        const res = await deleteTournament(tournament.id);
        if (res.success) {
          onClose();
        } else {
          alert(res.error || (isEnglish ? 'Could not delete tournament.' : 'Kunne ikke slette turnering.'));
        }
      });
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
        <div className="bg-[#141414] border border-gray-800 w-full max-w-2xl rounded-3xl p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto my-6">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full bg-gray-900 border border-gray-800 z-10">
            <X size={16} />
          </button>

          {/* Top Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5 pr-8">
            {isLeague ? (
              <span className="px-2.5 py-0.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                {isEnglish ? 'League' : 'Liga'}: {tournament.league?.name}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                {t.tournamentModal.singleTournamentTitle}
              </span>
            )}
            <span className="text-xs text-gray-500 font-mono">{dateStr}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white break-words pr-8">{tournament.name}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
            <span>{tournament.type} • {tournament.targetScore}p {isEnglish ? 'per match' : 'per kamp'}</span>
            <span>•</span>
            <span>{(tournament.matches || []).length} {isEnglish ? 'matches completed' : 'kamper fullført'}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[#BFFF00] font-bold font-mono">
              <Clock className="w-3 h-3" /> {isEnglish ? 'Avg' : 'Gj.snitt'} {avgMinutes} {isEnglish ? 'min / match' : 'min / kamp'}
            </span>
          </div>

          {/* Action Toolbar (Share / Reopen / Delete) */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setResultCardData({
                type: 'tournament',
                data: tournament
              })}
              className="px-3.5 py-1.5 bg-[#BFFF00] hover:bg-[#b0eb00] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition shadow-[0_0_12px_rgba(191,255,0,0.25)]"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t.resultCard.shareBtn}</span>
            </button>

            {canReopen && (
              <button
                type="button"
                onClick={handleReopen}
                disabled={isPending}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                title={isAdmin ? (isEnglish ? 'Reopen tournament (Admin)' : 'Gjenåpne turnering (Administrator)') : (isEnglish ? 'Reopen tournament (same day)' : 'Gjenåpne turnering (samme dag)')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.history.reopen}</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                title={isAdmin ? (isEnglish ? 'Delete tournament permanently' : 'Slett turnering permanent') : (isEnglish ? 'Delete tournament (same day)' : 'Slett turnering (samme dag)')}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.history.delete}</span>
              </button>
            )}
          </div>

          {/* Final Standings Table */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#BFFF00]" /> {isEnglish ? 'Final Standings' : 'Slutt-tabell'}
              </h4>
            </div>
            <div className="bg-black/40 rounded-2xl border border-gray-800 overflow-x-auto w-full max-w-full">
              <table className="w-full text-left text-xs whitespace-nowrap min-w-[280px]">
                <thead className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800 bg-gray-900/40">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 text-center w-10">#</th>
                    <th className="px-3 sm:px-4 py-2.5">{t.tournamentView.player}</th>
                    <th className="px-3 sm:px-4 py-2.5 text-center">{isEnglish ? 'W / D / L' : 'S / U / T'}</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right font-bold text-white">{t.common.points}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {(tournament.participants || []).map((p: any, idx: number) => (
                    <tr key={p.id} className={idx === 0 ? 'bg-[#BFFF00]/5' : ''}>
                      <td className="px-3 sm:px-4 py-2.5 text-center font-mono font-bold">
                        {idx === 0 ? <span className="text-[#BFFF00]">🥇 1</span> : idx + 1}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 font-bold text-white">
                        {p.user?.name}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-center font-mono text-gray-400 text-[11px]">
                        <span className="text-green-400">{p.matchesWon}</span> -{' '}
                        <span className="text-amber-400">{p.matchesDrawn}</span> -{' '}
                        <span className="text-red-400">{p.matchesLost}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono font-extrabold text-sm text-[#BFFF00]">
                        {p.totalPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Matches list with duration and correction support */}
          <div className="mt-6">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-gray-300" /> {isEnglish ? 'Played matches' : 'Spilte kamper'} ({(tournament.matches || []).length})
              </span>
              <span className="text-[10px] text-gray-500">
                {isEnglish ? 'Can be corrected same day' : 'Kan korrigeres samme dag'}
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
              {(tournament.matches || []).map((m: any, idx: number) => {
                const canEdit = isMatchEditable(m.completedAt || m.date);
                const duration = formatDurationMinutes(m.startedAt || m.date, m.completedAt);
                const startTime = formatTimeOnly(m.startedAt || m.date);
                const endTime = formatTimeOnly(m.completedAt);

                return (
                  <div key={m.id} className="p-3 bg-gray-900/60 rounded-xl border border-gray-800 flex flex-col justify-between gap-2 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                      <span>{isEnglish ? 'Match' : 'Kamp'} #{idx + 1} {m.courtNumber ? `(${t.common.court} ${m.courtNumber})` : ''}</span>
                      <span>{startTime} - {endTime} ({duration})</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-gray-300 text-[11px] font-bold break-words leading-tight">
                          {m.teamAPlayer1?.name} & {m.teamAPlayer2?.name}
                        </p>
                        <p className="text-gray-300 text-[11px] font-bold break-words leading-tight">
                          {m.teamBPlayer1?.name} & {m.teamBPlayer2?.name}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono bg-black px-2.5 py-1 rounded-lg text-white font-extrabold text-xs block">
                          {m.teamAScore} - {m.teamBScore}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-gray-800/60 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setResultCardData({
                          type: 'match',
                          data: {
                            match: m,
                            tournamentName: tournament.name
                          }
                        })}
                        className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 font-bold"
                      >
                        <Share2 className="w-3 h-3 text-[#BFFF00]" /> {isEnglish ? 'Share match' : 'Del kamp'}
                      </button>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setEditingMatch(m)}
                          className="text-[10px] text-[#BFFF00] hover:underline flex items-center gap-1 font-bold"
                        >
                          <Edit3 className="w-3 h-3" /> {t.tournamentView.editScore}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {editingMatch && (
        <EditMatchModal
          match={editingMatch}
          targetScore={tournament.targetScore}
          onClose={() => setEditingMatch(null)}
        />
      )}

      {/* Result Card Modal */}
      {resultCardData && (
        <ResultCardModal
          type={resultCardData.type}
          data={resultCardData.data}
          onClose={() => setResultCardData(null)}
        />
      )}
    </>
  );
}
