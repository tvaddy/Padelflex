'use client';

import { useState, useTransition } from 'react';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Sparkles, 
  Trophy, 
  TrendingUp, 
  Activity, 
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { addPlayer, updatePlayerName, deletePlayer, resetTestProfileData } from '@/app/actions';
import { useAuth } from './AuthContext';
import PlayerCareerModal from './PlayerCareerModal';

type PlayersViewProps = {
  allPlayers: any[];
  leagues: any[];
};

export default function PlayersView({ allPlayers, leagues }: PlayersViewProps) {
  const { accessCode } = useAuth();
  const [newPlayerName, setNewPlayerName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [playerToDelete, setPlayerToDelete] = useState<any | null>(null);
  const [viewingStatsPlayer, setViewingStatsPlayer] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    startTransition(async () => {
      try {
        await addPlayer(newPlayerName.trim());
        setNewPlayerName('');
        setStatusMessage(`Spiller "${newPlayerName.trim()}" ble lagt til!`);
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err: any) {
        setStatusMessage(err.message || 'Kunne ikke legge til spiller');
      }
    });
  };

  const handleStartEdit = (player: any) => {
    setEditingPlayerId(player.id);
    setEditNameValue(player.name);
  };

  const handleSaveEdit = (playerId: string) => {
    if (!editNameValue.trim()) return;
    startTransition(async () => {
      try {
        await updatePlayerName(playerId, editNameValue.trim());
        setEditingPlayerId(null);
      } catch (err: any) {
        setStatusMessage(err.message || 'Kunne ikke oppdatere navn');
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!playerToDelete) return;
    startTransition(async () => {
      try {
        await deletePlayer(playerToDelete.id);
        setPlayerToDelete(null);
        setStatusMessage(`Spiller "${playerToDelete.name}" ble fjernet.`);
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err: any) {
        setStatusMessage(err.message || 'Kunne ikke slette spiller');
      }
    });
  };

  const handleResetTestData = () => {
    if (!confirm('Vil du laste inn / gjenopprette standard testoppsett med 8 spillere, liga og kamper?')) return;
    startTransition(async () => {
      await resetTestProfileData();
      setStatusMessage('Testoppsettet ble gjenopprettet!');
      setTimeout(() => setStatusMessage(null), 3500);
    });
  };

  // Filter players by search query
  const filteredPlayers = allPlayers.filter(p => 
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#BFFF00]/15 border border-[#BFFF00]/30 text-[#BFFF00] rounded-full text-[11px] font-extrabold uppercase tracking-wider">
              Spilleroversikt
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {allPlayers.length} {allPlayers.length === 1 ? 'spiller' : 'spillere'} registrert
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Spillere</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Administrer spillere, se personlig karrierestatistikk, formkurver, drømmemakker og Elo-ranking.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {(accessCode === 'test' || accessCode === 'default' || allPlayers.length === 0) && (
            <button
              type="button"
              onClick={handleResetTestData}
              disabled={isPending}
              className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-[#BFFF00]/40 text-xs font-bold text-gray-300 hover:text-white transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Gjenopprett testoppsett med eksempelspillere og kamper"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#BFFF00]" />
              <span>{allPlayers.length === 0 ? 'Last inn testoppsett' : 'Gjenopprett testoppsett'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div className="p-3 bg-[#BFFF00]/10 border border-[#BFFF00]/30 rounded-2xl text-xs font-bold text-[#BFFF00] flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Add Player & Search Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Add Player Box */}
        <div className="lg:col-span-2 bg-[#141414] p-4 sm:p-5 rounded-3xl border border-gray-800/90 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#BFFF00]/20 text-[#BFFF00] flex items-center justify-center font-black text-xs">
                +
              </div>
              <span>Legg til ny spiller</span>
            </h3>
            <span className="text-[11px] text-gray-500 font-medium">
              Tilgjengelig for ordinær kamp og turnering
            </span>
          </div>

          <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Fullt navn eller kallenavn (f.eks. Alexander, Thomas)..."
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              className="flex-1 bg-black border border-gray-700/80 text-white rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#BFFF00] placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={isPending || !newPlayerName.trim()}
              className="bg-[#BFFF00] text-black px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-[#b0eb00] transition active:scale-95 disabled:opacity-40 shadow-[0_0_15px_rgba(191,255,0,0.2)] shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Legg til spiller</span>
            </button>
          </form>
        </div>

        {/* Search Player Box */}
        <div className="bg-[#141414] p-4 sm:p-5 rounded-3xl border border-gray-800/90 shadow-xl flex flex-col justify-center space-y-2">
          <label className="text-xs font-extrabold text-gray-300 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#BFFF00]" />
            <span>Søk i spillere</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Søk etter navn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-gray-700/80 text-white rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#BFFF00] placeholder-gray-500"
            />
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Players List Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="p-8 sm:p-12 bg-[#141414] rounded-3xl border border-gray-800/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 text-gray-500 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-white">
            {searchQuery ? `Ingen spillere matcher "${searchQuery}"` : 'Ingen spillere registrert ennå'}
          </h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {searchQuery
              ? 'Prøv et annet søkeord eller fjern søkefilteret.'
              : 'Legg til spillere ovenfor, eller klikk på knappen under for å laste inn et komplett testoppsett med 8 spillere.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleResetTestData}
              disabled={isPending}
              className="mt-2 px-5 py-2.5 bg-[#BFFF00] text-black font-extrabold text-xs rounded-xl hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_15px_rgba(191,255,0,0.25)] inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Last inn testoppsett (8 spillere)</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredPlayers.map((player) => {
            const memberLeagues = leagues.filter(l => 
              (l.members || []).some((m: any) => m.userId === player.id)
            );
            const isEditing = editingPlayerId === player.id;
            const elo = Math.round(player.eloRating || 1500);

            return (
              <div
                key={player.id}
                className="bg-[#141414] p-4 rounded-2xl border border-gray-800/90 flex flex-col justify-between group hover:border-gray-700 hover:shadow-lg transition-all"
              >
                <div className="space-y-3">
                  {/* Top Bar with Avatar, Name / Inline Edit, and Actions */}
                  <div className="flex items-start justify-between gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="bg-black border border-[#BFFF00] text-white text-xs px-2.5 py-1.5 rounded-lg w-full focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(player.id)}
                          disabled={isPending || !editNameValue.trim()}
                          className="p-1.5 bg-[#BFFF00] text-black rounded-lg hover:bg-[#b0eb00] transition shrink-0"
                          title="Lagre navn"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPlayerId(null)}
                          className="p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg transition shrink-0"
                          title="Avbryt"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewingStatsPlayer(player)}
                          className="flex items-center gap-3 text-left min-w-0 flex-1 group/btn"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gray-900 text-[#BFFF00] font-black flex items-center justify-center text-sm shadow-inner group-hover/btn:bg-[#BFFF00] group-hover/btn:text-black transition shrink-0">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-white group-hover/btn:text-[#BFFF00] transition truncate">
                              {player.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono font-bold text-[#BFFF00] bg-black/50 px-1.5 py-0.5 rounded border border-gray-800">
                                Totalrating {elo}
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* Edit & Delete Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(player)}
                            title="Endre navn"
                            className="p-1.5 text-gray-500 hover:text-[#BFFF00] hover:bg-gray-800 rounded-lg transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlayerToDelete(player)}
                            title="Slett spiller"
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* League tags */}
                  <div className="flex flex-wrap gap-1">
                    {memberLeagues.length > 0 ? (
                      memberLeagues.map(l => (
                        <span key={l.id} className="text-[9px] bg-[#BFFF00]/10 border border-[#BFFF00]/20 text-[#BFFF00] px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
                          {l.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-gray-500">Ingen ligaer</span>
                    )}
                  </div>
                </div>

                {/* View stats trigger button */}
                <button
                  type="button"
                  onClick={() => setViewingStatsPlayer(player)}
                  className="mt-3 w-full py-1.5 px-2 bg-gray-900/60 hover:bg-[#BFFF00]/10 border border-gray-800/80 hover:border-[#BFFF00]/30 rounded-xl text-[11px] font-bold text-gray-400 hover:text-[#BFFF00] transition flex items-center justify-center gap-1 group/btn"
                >
                  <Activity className="w-3 h-3 text-[#BFFF00]" />
                  <span>Se karrierestatistikk</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {playerToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#141414] border border-gray-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">Slett {playerToDelete.name}?</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Spilleren vil fjernes fra fremtidige kamper og turneringer. Historiske kampresultater forblir lagret.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isPending}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition"
              >
                {isPending ? 'Sletter...' : 'Slett'}
              </button>
              <button
                type="button"
                onClick={() => setPlayerToDelete(null)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Career Modal */}
      {viewingStatsPlayer && (
        <PlayerCareerModal
          playerId={viewingStatsPlayer.id}
          playerName={viewingStatsPlayer.name}
          onClose={() => setViewingStatsPlayer(null)}
        />
      )}
    </div>
  );
}
