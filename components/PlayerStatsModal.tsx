'use client';

import { useState } from 'react';
import { X, Users, Swords, Hash, Activity } from 'lucide-react';

type PlayerStatsModalProps = {
  tournament: any;
  onClose: () => void;
};

export default function PlayerStatsModal({ tournament, onClose }: PlayerStatsModalProps) {
  const participants = tournament?.participants || [];
  const matches = (tournament?.matches || []).filter((m: any) => m.isCompleted);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    participants.length > 0 ? participants[0].userId : ''
  );

  // 1. Bygg makkermatrise og motstandermatrise for alle spillere
  const partnerMatrix: Record<string, Record<string, number>> = {};
  const opponentMatrix: Record<string, Record<string, number>> = {};
  const playerStats: Record<string, {
    matchesPlayed: number;
    won: number;
    drawn: number;
    lost: number;
    pointsScored: number;
    pointsConceded: number;
  }> = {};

  for (const p of participants) {
    partnerMatrix[p.userId] = {};
    opponentMatrix[p.userId] = {};
    playerStats[p.userId] = {
      matchesPlayed: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      pointsScored: 0,
      pointsConceded: 0,
    };
    for (const p2 of participants) {
      partnerMatrix[p.userId][p2.userId] = 0;
      opponentMatrix[p.userId][p2.userId] = 0;
    }
  }

  for (const m of matches) {
    const a1 = m.teamAPlayer1Id;
    const a2 = m.teamAPlayer2Id;
    const b1 = m.teamBPlayer1Id;
    const b2 = m.teamBPlayer2Id;

    const sA = m.teamAScore;
    const sB = m.teamBScore;
    const isDraw = sA === sB;
    const isAWon = sA > sB;
    const isBWon = sB > sA;

    const recordStats = (pid: string, score: number, oppScore: number, won: boolean, drawn: boolean, lost: boolean) => {
      if (playerStats[pid]) {
        playerStats[pid].matchesPlayed++;
        playerStats[pid].pointsScored += score;
        playerStats[pid].pointsConceded += oppScore;
        if (won) playerStats[pid].won++;
        else if (drawn) playerStats[pid].drawn++;
        else if (lost) playerStats[pid].lost++;
      }
    };

    recordStats(a1, sA, sB, isAWon, isDraw, isBWon);
    recordStats(a2, sA, sB, isAWon, isDraw, isBWon);
    recordStats(b1, sB, sA, isBWon, isDraw, isAWon);
    recordStats(b2, sB, sA, isBWon, isDraw, isAWon);

    // Makkere
    if (partnerMatrix[a1]?.[a2] !== undefined) partnerMatrix[a1][a2]++;
    if (partnerMatrix[a2]?.[a1] !== undefined) partnerMatrix[a2][a1]++;
    if (partnerMatrix[b1]?.[b2] !== undefined) partnerMatrix[b1][b2]++;
    if (partnerMatrix[b2]?.[b1] !== undefined) partnerMatrix[b2][b1]++;

    // Motstandere
    const addOpp = (p1: string, p2: string) => {
      if (opponentMatrix[p1]?.[p2] !== undefined) opponentMatrix[p1][p2]++;
      if (opponentMatrix[p2]?.[p1] !== undefined) opponentMatrix[p2][p1]++;
    };
    addOpp(a1, b1);
    addOpp(a1, b2);
    addOpp(a2, b1);
    addOpp(a2, b2);
  }

  const selectedParticipant = participants.find((p: any) => p.userId === selectedUserId) || participants[0];
  const selectedStats = selectedParticipant ? playerStats[selectedParticipant.userId] : null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-[#141414] border border-gray-800 w-full max-w-3xl rounded-3xl p-4 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-800/80">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00]">Statistikk</span>
            <h3 className="text-lg sm:text-2xl font-extrabold text-white">Spillerstatistikk</h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition"
            aria-label="Lukk"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto space-y-4 pt-4 pr-1">
          {/* Spiller-velger (Pills) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Velg spiller:
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {participants.map((p: any) => {
                const isSelected = p.userId === selectedUserId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedUserId(p.userId)}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#BFFF00] text-black shadow-[0_0_10px_rgba(191,255,0,0.3)]'
                        : 'bg-gray-900 border border-gray-800 text-gray-300 hover:text-white'
                    }`}
                  >
                    {p.user?.name}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedParticipant && selectedStats && (
            <div className="space-y-4">
              {/* KPI Cards for valgt spiller */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Kamper</span>
                  <span className="text-lg font-black text-white mt-0.5 block">{selectedStats.matchesPlayed}</span>
                </div>
                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">S - U - T</span>
                  <span className="text-lg font-black text-white mt-0.5 block font-mono">
                    <span className="text-green-400">{selectedStats.won}</span>-
                    <span className="text-amber-400">{selectedStats.drawn}</span>-
                    <span className="text-red-400">{selectedStats.lost}</span>
                  </span>
                </div>
                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Måldiff</span>
                  <span className={`text-lg font-black mt-0.5 block font-mono ${
                    selectedStats.pointsScored - selectedStats.pointsConceded > 0 ? 'text-green-400' : selectedStats.pointsScored - selectedStats.pointsConceded < 0 ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    {selectedStats.pointsScored - selectedStats.pointsConceded > 0 ? '+' : ''}
                    {selectedStats.pointsScored - selectedStats.pointsConceded}
                  </span>
                </div>
                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Snittscore</span>
                  <span className="text-lg font-black text-white mt-0.5 block font-mono">
                    {selectedStats.matchesPlayed > 0 
                      ? (selectedStats.pointsScored / selectedStats.matchesPlayed).toFixed(1) 
                      : '0.0'}
                  </span>
                </div>
                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Turnering-Elo</span>
                  <span className="text-lg font-black text-[#BFFF00] mt-0.5 block font-mono">
                    {Math.round((selectedParticipant.tournamentElo || 1500) * 10) / 10}
                  </span>
                  {selectedParticipant.eloDelta !== 0 && (
                    <span className={`text-[10px] font-mono ${selectedParticipant.eloDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedParticipant.eloDelta > 0 ? `+${Math.round(selectedParticipant.eloDelta * 10) / 10}` : Math.round(selectedParticipant.eloDelta * 10) / 10}
                    </span>
                  )}
                </div>
                <div className="p-3 bg-black/60 border border-gray-800 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Total-Elo</span>
                  <span className="text-lg font-black text-gray-200 mt-0.5 block font-mono">
                    {Math.round((selectedParticipant.user?.eloRating || 1500) * 10) / 10}
                  </span>
                </div>
              </div>

              {/* Samspill Seksjon */}
              <div className="bg-black/60 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="p-3 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#BFFF00]" />
                    <span>Samspill for {selectedParticipant.user?.name}</span>
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {matches.length} kamper fullført
                  </span>
                </div>

                {/* Mobilvisning (Cards - Krystallklart på mobil) */}
                <div className="block md:hidden divide-y divide-gray-850 p-2 space-y-2">
                  {participants
                    .filter((p: any) => p.userId !== selectedUserId)
                    .map((other: any) => {
                      const asTeammate = partnerMatrix[selectedUserId]?.[other.userId] || 0;
                      const asOpponent = opponentMatrix[selectedUserId]?.[other.userId] || 0;
                      const totalEncounters = asTeammate + asOpponent;

                      return (
                        <div key={other.id} className="p-3 bg-gray-950/80 rounded-xl border border-gray-850 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm text-white">
                              {other.user?.name}
                            </span>
                            <span className="text-[11px] font-mono text-gray-400">
                              Totalt: <strong className="text-white">{totalEncounters}</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className={`p-2 rounded-lg flex items-center justify-between ${
                              asTeammate > 0 ? 'bg-[#BFFF00]/15 border border-[#BFFF00]/30 text-[#BFFF00]' : 'bg-gray-900 text-gray-500'
                            }`}>
                              <span className="text-[10px] font-bold uppercase">På lag:</span>
                              <span className="font-mono font-black">{asTeammate}x</span>
                            </div>

                            <div className={`p-2 rounded-lg flex items-center justify-between ${
                              asOpponent > 0 ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300' : 'bg-gray-900 text-gray-500'
                            }`}>
                              <span className="text-[10px] font-bold uppercase">Motstander:</span>
                              <span className="font-mono font-black">{asOpponent}x</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Skrivebordsvisning (Tabell) */}
                <div className="hidden md:block">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-800 bg-gray-900/30">
                      <tr>
                        <th className="px-4 py-3">Medspiller</th>
                        <th className="px-4 py-3 text-center">Spilt på lag</th>
                        <th className="px-4 py-3 text-center">Spilt mot</th>
                        <th className="px-4 py-3 text-right">Totalt møter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {participants
                        .filter((p: any) => p.userId !== selectedUserId)
                        .map((other: any) => {
                          const asTeammate = partnerMatrix[selectedUserId]?.[other.userId] || 0;
                          const asOpponent = opponentMatrix[selectedUserId]?.[other.userId] || 0;
                          const totalEncounters = asTeammate + asOpponent;

                          return (
                            <tr key={other.id} className="hover:bg-gray-850/40">
                              <td className="px-4 py-3 font-bold text-gray-200">
                                {other.user?.name}
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  asTeammate > 0 ? 'bg-[#BFFF00]/15 text-[#BFFF00]' : 'text-gray-600'
                                }`}>
                                  {asTeammate} {asTeammate === 1 ? 'gang' : 'ganger'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  asOpponent > 0 ? 'bg-cyan-500/15 text-cyan-300' : 'text-gray-600'
                                }`}>
                                  {asOpponent} {asOpponent === 1 ? 'gang' : 'ganger'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-gray-300 font-bold">
                                {totalEncounters}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
