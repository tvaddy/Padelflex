'use client';

import { useState, useTransition } from 'react';
import { X, Check, Clock, AlertTriangle, Lock, Save, RotateCcw } from 'lucide-react';
import { updateMatchScore } from '@/app/actions';
import { isMatchEditable, formatTimeOnly, formatDurationMinutes } from '@/lib/match-utils';
import { useTranslation } from '@/lib/i18n';

type EditMatchModalProps = {
  match: any;
  targetScore?: number;
  onClose: () => void;
};

export default function EditMatchModal({ match, targetScore = 24, onClose }: EditMatchModalProps) {
  const { t, isEnglish } = useTranslation();
  const [scoreA, setScoreA] = useState<number>(match.teamAScore ?? Math.floor(targetScore / 2));
  const [scoreB, setScoreB] = useState<number>(match.teamBScore ?? (targetScore - (match.teamAScore ?? Math.floor(targetScore / 2))));
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    (match.teamAScore + match.teamBScore) !== targetScore
  );

  // Time editing
  const getIsoTimeString = (dateVal: any) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    return d.toTimeString().slice(0, 5); // "HH:MM"
  };

  const [startTimeStr, setStartTimeStr] = useState<string>(
    getIsoTimeString(match.startedAt || match.date)
  );
  const [endTimeStr, setEndTimeStr] = useState<string>(
    getIsoTimeString(match.completedAt || new Date())
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matchDate = match.completedAt || match.date;
  const canEdit = isMatchEditable(matchDate);

  // 7 buttons per row
  const scoreOptions = Array.from({ length: targetScore + 1 }, (_, i) => i);

  const handleSelectTeamAScore = (score: number) => {
    setScoreA(score);
    if (!isCustomMode) {
      setScoreB(Math.max(0, targetScore - score));
    }
  };

  const handleSelectTeamBScore = (score: number) => {
    setScoreB(score);
    if (!isCustomMode) {
      setScoreA(Math.max(0, targetScore - score));
    }
  };

  const handleSave = () => {
    if (!canEdit) {
      setErrorMessage(isEnglish ? 'This match is locked for editing because it was played on an earlier day.' : 'Denne kampen er låst for korrektur fordi den ble spilt en tidligere dag.');
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        // Construct updated start & end dates based on match original date + new times
        let newStartedAt: Date | undefined = undefined;
        let newCompletedAt: Date | undefined = undefined;

        const baseDate = new Date(match.date || new Date());

        if (startTimeStr) {
          const [h, m] = startTimeStr.split(':').map(Number);
          const d = new Date(baseDate);
          d.setHours(h, m, 0, 0);
          newStartedAt = d;
        }

        if (endTimeStr) {
          const [h, m] = endTimeStr.split(':').map(Number);
          const d = new Date(baseDate);
          d.setHours(h, m, 0, 0);
          newCompletedAt = d;
        }

        await updateMatchScore(match.id, scoreA, scoreB, newStartedAt, newCompletedAt);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || (isEnglish ? 'Failed to save correction' : 'Feil ved lagring av korrektur'));
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-[#141414] border border-gray-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl relative my-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-900 text-gray-400 hover:text-white border border-gray-800 transition"
          aria-label={isEnglish ? 'Close' : 'Lukk'}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              {isEnglish ? 'Correct Match' : 'Korriger Kamp'}
            </span>
            {match.courtNumber && (
              <span className="text-[10px] bg-gray-800 text-gray-300 font-bold px-2 py-0.5 rounded-full">
                {isEnglish ? `Court ${match.courtNumber}` : `Bane ${match.courtNumber}`}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1">
            {isEnglish ? 'Edit score and duration' : 'Endre poengsum og tidspunkt'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEnglish ? 'Corrects entry mistakes and updates standings immediately.' : 'Retter eventuelle feilføringer og oppdaterer tabeller umiddelbart.'}
          </p>
        </div>

        {/* Lock warning if not editable */}
        {!canEdit && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-2xl mb-4 flex items-center gap-2.5 text-xs text-red-300">
            <Lock className="w-4 h-4 shrink-0 text-red-400" />
            <span>
              <strong>{isEnglish ? 'Locked for editing:' : 'Låst for korrektur:'}</strong> {isEnglish ? 'The match was played on an earlier day and cannot be changed.' : 'Kampen ble spilt en tidligere dag og kan ikke endres.'}
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl mb-4 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Teams & Score Preview */}
        <div className="bg-black/50 p-4 rounded-2xl border border-gray-800 mb-4">
          <div className="grid grid-cols-2 gap-4 items-center">
            {/* Team A */}
            <div className={`p-3 rounded-xl border transition ${scoreA > scoreB ? 'bg-[#BFFF00]/10 border-[#BFFF00]/40' : 'bg-gray-900/60 border-gray-800'}`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block mb-1">
                {isEnglish ? 'Team A' : 'Lag A'} {scoreA > scoreB && (isEnglish ? '👑 Winner' : '👑 Vinner')}
              </span>
              <p className="text-xs font-bold text-white truncate">{match.teamAPlayer1?.name}</p>
              <p className="text-xs font-bold text-white truncate">{match.teamAPlayer2?.name}</p>
              <div className="mt-2 text-2xl font-mono font-extrabold text-[#BFFF00]">{scoreA}p</div>
            </div>

            {/* Team B */}
            <div className={`p-3 rounded-xl border transition ${scoreB > scoreA ? 'bg-[#BFFF00]/10 border-[#BFFF00]/40' : 'bg-gray-900/60 border-gray-800'}`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block mb-1">
                {isEnglish ? 'Team B' : 'Lag B'} {scoreB > scoreA && (isEnglish ? '👑 Winner' : '👑 Vinner')}
              </span>
              <p className="text-xs font-bold text-white truncate">{match.teamBPlayer1?.name}</p>
              <p className="text-xs font-bold text-white truncate">{match.teamBPlayer2?.name}</p>
              <div className="mt-2 text-2xl font-mono font-extrabold text-[#BFFF00]">{scoreB}p</div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/80">
            <span className="text-xs text-gray-400 font-medium">
              {isEnglish ? 'Target score:' : 'Målsum:'} <strong className="text-white">{targetScore}p</strong> ({scoreA + scoreB} {isEnglish ? 'selected' : 'valgt'})
            </span>
            <button
              type="button"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                isCustomMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
              }`}
            >
              {isCustomMode ? (isEnglish ? 'Custom score active' : 'Custom score aktiv') : (isEnglish ? 'Allow custom sum' : 'Tillat egendefinert sum')}
            </button>
          </div>
        </div>

        {/* 7 Buttons Per Row Score Selector */}
        <div className="space-y-4 mb-4">
          {/* Team A score buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-300">
                {isEnglish ? 'Points for' : 'Poeng for'} {match.teamAPlayer1?.name} & {match.teamAPlayer2?.name}:
              </label>
              <span className="text-xs font-mono font-extrabold text-[#BFFF00]">{scoreA}</span>
            </div>
            {/* Responsive score buttons */}
            <div className="grid grid-cols-5 xs:grid-cols-7 gap-1">
              {scoreOptions.map((pts) => {
                const isSelected = scoreA === pts;
                return (
                  <button
                    key={pts}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleSelectTeamAScore(pts)}
                    className={`h-8 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm scale-105'
                        : 'bg-gray-900 border border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white active:scale-95'
                    }`}
                  >
                    {pts}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team B score buttons (if custom mode or to adjust directly) */}
          {isCustomMode && (
            <div className="animate-in fade-in">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300">
                  {isEnglish ? 'Points for' : 'Poeng for'} {match.teamBPlayer1?.name} & {match.teamBPlayer2?.name}:
                </label>
                <span className="text-xs font-mono font-extrabold text-[#BFFF00]">{scoreB}</span>
              </div>
              <div className="grid grid-cols-5 xs:grid-cols-7 gap-1">
                {scoreOptions.map((pts) => {
                  const isSelected = scoreB === pts;
                  return (
                    <button
                      key={pts}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleSelectTeamBScore(pts)}
                      className={`h-8 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center ${
                        isSelected
                          ? 'bg-[#BFFF00] text-black font-extrabold shadow-sm scale-105'
                          : 'bg-gray-900 border border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white active:scale-95'
                      }`}
                    >
                      {pts}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Time Correction */}
        <div className="bg-black/40 p-3.5 rounded-2xl border border-gray-800 mb-5">
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-[#BFFF00]" /> {isEnglish ? 'Adjust match timing (duration)' : 'Juster kamp-tidspunkt (varighet)'}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-gray-500 block mb-1">{isEnglish ? 'Started at:' : 'Startet kl:'}</span>
              <input
                type="time"
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                disabled={!canEdit}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#BFFF00]"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 block mb-1">{isEnglish ? 'Finished at:' : 'Fullført kl:'}</span>
              <input
                type="time"
                value={endTimeStr}
                onChange={(e) => setEndTimeStr(e.target.value)}
                disabled={!canEdit}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#BFFF00]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-900 hover:bg-gray-800 text-gray-300 py-3 rounded-xl text-xs font-bold transition border border-gray-800"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !canEdit}
            className="flex-[2] bg-[#BFFF00] hover:bg-[#b0eb00] text-black py-3 rounded-xl text-xs font-extrabold transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-[0_0_15px_rgba(191,255,0,0.25)] flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {isPending ? (isEnglish ? 'SAVING...' : 'LAGRER...') : (isEnglish ? 'SAVE CORRECTION' : 'LAGRE KORRIGERING')}
          </button>
        </div>
      </div>
    </div>
  );
}
