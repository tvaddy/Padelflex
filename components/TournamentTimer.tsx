'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Volume2, 
  VolumeX, 
  Timer, 
  Flame, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type TournamentTimerProps = {
  tournamentName?: string;
  defaultMinutes?: number;
  onTimeExpired?: () => void;
};

// Web Audio synthesizer for alert sound (Zero external asset dependencies, works offline!)
function playTone(type: 'warning' | 'finish') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'finish') {
      // 3-tone high pitch whistle / finish buzzer
      [0, 0.2, 0.4].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 2 ? 880 : 660, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.18);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.2);
      });
    } else {
      // 1-minute warning chime (gentle ding)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Ignore audio permission or autoplay restrictions
  }
}

const PRESETS = [8, 10, 12, 15, 20];

export default function TournamentTimer({ 
  tournamentName, 
  defaultMinutes = 12,
  onTimeExpired 
}: TournamentTimerProps) {
  const { isEnglish } = useTranslation();
  const [targetDuration, setTargetDuration] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('padelflex_tournament_timer');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.targetDuration) return parsed.targetDuration;
        }
      } catch {}
    }
    return defaultMinutes * 60;
  });

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('padelflex_tournament_timer');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.isRunning && parsed.endTime) {
            const rem = Math.max(0, Math.round((parsed.endTime - Date.now()) / 1000));
            return rem;
          }
          if (parsed.secondsRemaining !== undefined) return parsed.secondsRemaining;
        }
      } catch {}
    }
    return defaultMinutes * 60;
  });

  const [isRunning, setIsRunning] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('padelflex_tournament_timer');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.isRunning && parsed.endTime) {
            const rem = Math.max(0, Math.round((parsed.endTime - Date.now()) / 1000));
            return rem > 0;
          }
        }
      } catch {}
    }
    return false;
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('padelflex_tournament_timer');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.soundEnabled !== undefined) return parsed.soundEnabled;
        }
      } catch {}
    }
    return true;
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('12');

  const endTimeRef = useRef<number | null>(null);
  const warningPlayedRef = useRef<boolean>(false);
  const finishPlayedRef = useRef<boolean>(false);

  // Initialize endTimeRef if running on load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('padelflex_tournament_timer');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isRunning && parsed.endTime) {
          endTimeRef.current = parsed.endTime;
        }
      }
    } catch {}
  }, []);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('padelflex_tournament_timer', JSON.stringify({
        targetDuration,
        secondsRemaining,
        isRunning,
        endTime: isRunning ? endTimeRef.current : null,
        soundEnabled,
      }));
    } catch {
      // Ignore
    }
  }, [targetDuration, secondsRemaining, isRunning, soundEnabled]);

  // Main countdown loop with timestamp synchronization
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (!endTimeRef.current) return;
      const now = Date.now();
      const diff = Math.max(0, Math.round((endTimeRef.current - now) / 1000));
      
      setSecondsRemaining(diff);

      // Warning at 60 seconds
      if (diff <= 60 && diff > 58 && !warningPlayedRef.current && soundEnabled) {
        warningPlayedRef.current = true;
        playTone('warning');
      }

      // Finish at 0
      if (diff === 0) {
        setIsRunning(false);
        endTimeRef.current = null;
        if (!finishPlayedRef.current) {
          finishPlayedRef.current = true;
          if (soundEnabled) playTone('finish');
          if (onTimeExpired) onTimeExpired();
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, soundEnabled, onTimeExpired]);

  const handleStart = () => {
    if (secondsRemaining <= 0) {
      setSecondsRemaining(targetDuration);
      endTimeRef.current = Date.now() + targetDuration * 1000;
    } else {
      endTimeRef.current = Date.now() + secondsRemaining * 1000;
    }
    finishPlayedRef.current = false;
    warningPlayedRef.current = false;
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    endTimeRef.current = null;
  };

  const handleReset = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    setSecondsRemaining(targetDuration);
    finishPlayedRef.current = false;
    warningPlayedRef.current = false;
  };

  const handleSelectPreset = (mins: number) => {
    const secs = mins * 60;
    setTargetDuration(secs);
    setSecondsRemaining(secs);
    setIsRunning(false);
    endTimeRef.current = null;
    finishPlayedRef.current = false;
    warningPlayedRef.current = false;
    setShowCustomInput(false);
  };

  const handleAddMinute = (extraMinutes: number = 1) => {
    setSecondsRemaining(prev => {
      const next = prev + extraMinutes * 60;
      if (isRunning && endTimeRef.current) {
        endTimeRef.current += extraMinutes * 60 * 1000;
      }
      return next;
    });
    setTargetDuration(prev => prev + extraMinutes * 60);
    finishPlayedRef.current = false;
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMinutesInput, 10);
    if (!isNaN(val) && val > 0 && val <= 180) {
      handleSelectPreset(val);
    }
  };

  // Time formatters
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = targetDuration > 0 
    ? Math.max(0, Math.min(100, (secondsRemaining / targetDuration) * 100))
    : 0;

  const isExpired = secondsRemaining === 0;
  const isUrgent = secondsRemaining > 0 && secondsRemaining <= 60;

  return (
    <div className={`rounded-2xl sm:rounded-3xl border transition-all duration-300 shadow-xl overflow-hidden ${
      isExpired 
        ? 'bg-red-950/40 border-red-500/60 shadow-[0_0_25px_rgba(239,68,68,0.25)]' 
        : isUrgent 
        ? 'bg-amber-950/30 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse'
        : 'bg-[#141414] border-gray-800'
    }`}>
      {/* Header Bar */}
      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 border-b border-gray-800/80 bg-black/40">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold transition ${
            isExpired 
              ? 'bg-red-500 text-white' 
              : isUrgent 
              ? 'bg-amber-500 text-black' 
              : isRunning 
              ? 'bg-[#BFFF00] text-black shadow-[0_0_10px_rgba(191,255,0,0.4)]' 
              : 'bg-gray-800 text-gray-300'
          }`}>
            <Timer className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00]">
                {isEnglish ? 'Match Timer' : 'Tidskamp / Timer'}
              </span>
              {isRunning && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#BFFF00]/20 text-[#BFFF00]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#BFFF00] animate-ping" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-gray-200">
              {isExpired ? (isEnglish ? '🚨 Time is up!' : '🚨 Tiden er ute!') : isRunning ? (isEnglish ? 'Match in progress' : 'Spilletid pågår') : (isEnglish ? 'Ready to start' : 'Klar til start')}
            </p>
          </div>
        </div>

        {/* Compact Right Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl text-xs font-bold transition ${
              soundEnabled ? 'text-[#BFFF00] bg-gray-900 hover:bg-gray-800' : 'text-gray-500 bg-gray-900/50'
            }`}
            title={soundEnabled ? (isEnglish ? 'Sound alert is on' : 'Lydvarsel er på') : (isEnglish ? 'Sound alert is off' : 'Lydvarsel er av')}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition"
            title={isExpanded ? (isEnglish ? 'Minimize timer' : 'Minimer timer') : (isEnglish ? 'Expand timer' : 'Utvid timer')}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Siste ball / Golden point notification */}
          {isExpired && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-2xl flex items-center justify-between gap-3 text-red-200 animate-bounce">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
                    {isEnglish ? 'Final Ball / Golden Point!' : 'Siste ball / Golden Point!'}
                  </h4>
                  <p className="text-[11px] text-red-300">
                    {isEnglish 
                      ? 'Finish the ongoing rally or play a deciding ball to determine the winner.'
                      : 'Fullfør pågående poeng eller spill avgjørende ball for å kåre vinneren.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shrink-0 transition"
              >
                {isEnglish ? 'New round' : 'Ny runde'}
              </button>
            </div>
          )}

          {/* Large Clock Display */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <div className={`font-mono text-5xl sm:text-6xl font-black tracking-tight ${
                isExpired 
                  ? 'text-red-500' 
                  : isUrgent 
                  ? 'text-amber-400' 
                  : 'text-white'
              }`}>
                {formattedTime}
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {isEnglish ? 'of' : 'av'} {Math.round(targetDuration / 60)} min
              </div>
            </div>

            {/* Quick Actions (Start/Pause, Reset, +1 Min) */}
            <div className="flex flex-wrap items-center gap-2">
              {isRunning ? (
                <button
                  type="button"
                  onClick={handlePause}
                  className="px-4 py-2.5 bg-amber-500 text-black hover:bg-amber-400 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-md"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStart}
                  className="px-5 py-2.5 bg-[#BFFF00] text-black hover:bg-[#b0eb00] font-black text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-[0_0_15px_rgba(191,255,0,0.3)]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{secondsRemaining === 0 ? (isEnglish ? 'Start new' : 'Start ny') : secondsRemaining < targetDuration ? (isEnglish ? 'Resume' : 'Gjenoppta') : 'Start'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleAddMinute(1)}
                className="px-3 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 font-bold text-xs rounded-xl flex items-center gap-1 transition active:scale-95"
                title={isEnglish ? 'Add 1 minute' : 'Legg til 1 minutt'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>1m</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddMinute(2)}
                className="px-3 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 font-bold text-xs rounded-xl flex items-center gap-1 transition active:scale-95"
                title={isEnglish ? 'Add 2 minutes' : 'Legg til 2 minutter'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>2m</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-2.5 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 rounded-xl transition active:scale-95"
                title={isEnglish ? 'Reset time' : 'Tilbakestill tid'}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800/80">
            <div 
              className={`h-full transition-all duration-300 rounded-full ${
                isExpired 
                  ? 'bg-red-500' 
                  : isUrgent 
                  ? 'bg-amber-400' 
                  : 'bg-[#BFFF00]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Presets Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] uppercase font-extrabold text-gray-500 mr-1">
              {isEnglish ? 'Presets:' : 'Valg:'}
            </span>
            {PRESETS.map((mins) => {
              const isSelected = targetDuration === mins * 60 && !showCustomInput;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSelectPreset(mins)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    isSelected
                      ? 'bg-[#BFFF00] text-black shadow-sm'
                      : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800'
                  }`}
                >
                  {mins} min
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                showCustomInput 
                  ? 'bg-gray-700 text-white' 
                  : 'bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-800'
              }`}
            >
              {isEnglish ? 'Custom...' : 'Tilpass...'}
            </button>

            {showCustomInput && (
              <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 ml-1">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  className="w-16 bg-black border border-gray-700 text-white text-xs px-2.5 py-1.5 rounded-lg text-center font-mono focus:border-[#BFFF00] focus:outline-none"
                  placeholder="Min"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-[#BFFF00] text-black text-xs font-bold rounded-lg hover:bg-[#b0eb00] transition"
                >
                  {isEnglish ? 'Set' : 'Sett'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
