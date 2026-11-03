'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Trophy, 
  Flame, 
  History, 
  Users, 
  Plus, 
  Play, 
  Zap, 
  Layers, 
  ShieldCheck, 
  Activity, 
  HelpCircle, 
  LogOut, 
  RefreshCw, 
  Hash, 
  X, 
  ArrowRight, 
  Sparkles, 
  Check,
  Swords
} from 'lucide-react';
import { useAuth } from './AuthContext';
import PadelLogo from './PadelLogo';

import TournamentView from './TournamentView';
import StandaloneMatchView from './StandaloneMatchView';
import LeaguesView from './LeaguesView';
import HistoryView from './HistoryView';
import PlayersView from './PlayersView';
import HelpFaqView from './HelpFaqView';
import StartTournamentModal from './StartTournamentModal';
import InstallPwaPrompt from './InstallPwaPrompt';

type DashboardClientProps = {
  activeTournament: any;
  allPlayers: any[];
  initialLeagues: any[];
  initialHistory: any[];
};

export default function DashboardClient({
  activeTournament,
  allPlayers,
  initialLeagues,
  initialHistory
}: DashboardClientProps) {
  const router = useRouter();
  const { logout, accessCode, isAdmin, savedProfiles, switchProfile, removeSavedProfile } = useAuth();
  
  const [overrideTournament, setOverrideTournament] = useState<{ value: any } | null>(null);
  const [prevActiveTournament, setPrevActiveTournament] = useState(activeTournament);

  if (prevActiveTournament !== activeTournament) {
    setPrevActiveTournament(activeTournament);
    setOverrideTournament(null);
  }

  const currentActiveTournament = overrideTournament !== null 
    ? overrideTournament.value 
    : activeTournament;

  const [activeMainTab, setActiveMainTab] = useState<'tournament' | 'match' | 'leagues' | 'history' | 'players' | 'help'>(
    activeTournament ? 'tournament' : 'leagues'
  );
  const [isStartTournamentModalOpen, setIsStartTournamentModalOpen] = useState(false);
  const [selectedLeagueForTournament, setSelectedLeagueForTournament] = useState<any | null>(null);
  const [prefillTournamentSettings, setPrefillTournamentSettings] = useState<{ targetScore?: number; courtCount?: number } | null>(null);
  const [isSwitchProfileModalOpen, setIsSwitchProfileModalOpen] = useState(false);

  const handleStartTournamentForLeague = (league: any) => {
    setSelectedLeagueForTournament(league);
    setPrefillTournamentSettings(null);
    setIsStartTournamentModalOpen(true);
  };

  const handleStartGeneralTournament = (prefill?: { targetScore?: number; courtCount?: number } | React.MouseEvent) => {
    setSelectedLeagueForTournament(null);
    if (prefill && 'targetScore' in prefill) {
      setPrefillTournamentSettings(prefill);
    } else {
      setPrefillTournamentSettings(null);
    }
    setIsStartTournamentModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#BFFF00] selection:text-black overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-gray-800/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <PadelLogo size="sm" showText={false} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold tracking-tight text-base sm:text-lg text-white">
                PADEL<span className="text-[#BFFF00]">FLEX</span>
              </span>
              
              {/* Profile Pill Badge */}
              <button
                type="button"
                onClick={() => setIsSwitchProfileModalOpen(true)}
                className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-[10px] sm:text-[11px] font-mono rounded-full transition truncate"
                title="Klikk for å bytte tilgangskode/profil"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#BFFF00] shrink-0" />
                <span className="truncate max-w-[90px] sm:max-w-[120px] font-bold">
                  {isAdmin ? 'ADMIN (Alt)' : accessCode}
                </span>
                <RefreshCw className="w-2.5 h-2.5 text-gray-500 ml-0.5 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Bytt Profil Button */}
          <button
            type="button"
            onClick={() => setIsSwitchProfileModalOpen(true)}
            className="p-2 sm:py-2 sm:px-3 bg-gray-900/90 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 rounded-xl sm:rounded-2xl transition flex items-center gap-1.5 text-xs font-bold shrink-0"
            title="Bytt til en annen gruppe/kode"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#BFFF00]" />
            <span className="hidden sm:inline">Bytt profil</span>
          </button>

          {/* Ny Turnering */}
          <button
            type="button"
            onClick={handleStartGeneralTournament}
            className="bg-[#BFFF00] text-black px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-extrabold text-xs sm:text-sm flex items-center gap-1.5 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_20px_rgba(191,255,0,0.3)] shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Ny turnering</span>
          </button>

          {/* Logg ut */}
          <button
            type="button"
            onClick={logout}
            title="Logg ut"
            className="p-2 sm:py-2 sm:px-2.5 bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 rounded-xl sm:rounded-2xl transition flex items-center gap-1 text-xs font-bold shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-x-hidden max-w-full">
        <InstallPwaPrompt />

        {/* Navigation Tabs Bar - 2 rows on mobile (3 cols each), 1 row on desktop */}
        <div className="grid grid-cols-3 lg:grid-cols-6 bg-[#141414] p-1.5 rounded-2xl border border-gray-800/80 gap-1.5 w-full">
          <button
            type="button"
            onClick={() => setActiveMainTab('match')}
            className={`min-h-[44px] py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeMainTab === 'match'
                ? 'bg-[#BFFF00] text-black shadow-[0_0_15px_rgba(191,255,0,0.25)] font-extrabold'
                : 'text-gray-300 hover:text-white hover:bg-gray-900/80'
            }`}
          >
            <Swords className="w-4 h-4 shrink-0" />
            <span className="leading-tight text-center">Kamp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('tournament')}
            className={`min-h-[44px] py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeMainTab === 'tournament'
                ? 'bg-[#BFFF00] text-black shadow-[0_0_15px_rgba(191,255,0,0.25)] font-extrabold'
                : 'text-gray-300 hover:text-white hover:bg-gray-900/80'
            }`}
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span className="leading-tight text-center">Turnering</span>
            {currentActiveTournament && (
              <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${
                activeMainTab === 'tournament' ? 'bg-black' : 'bg-[#BFFF00]'
              }`} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('leagues')}
            className={`min-h-[44px] py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeMainTab === 'leagues'
                ? 'bg-[#BFFF00] text-black shadow-[0_0_15px_rgba(191,255,0,0.25)] font-extrabold'
                : 'text-gray-300 hover:text-white hover:bg-gray-900/80'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <span className="leading-tight text-center">Ligaer</span>
            {initialLeagues.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono shrink-0 ${
                activeMainTab === 'leagues' ? 'bg-black/20 text-black font-extrabold' : 'bg-gray-800 text-gray-400'
              }`}>
                {initialLeagues.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('history')}
            className={`min-h-[44px] py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeMainTab === 'history'
                ? 'bg-[#BFFF00] text-black shadow-[0_0_15px_rgba(191,255,0,0.25)] font-extrabold'
                : 'text-gray-300 hover:text-white hover:bg-gray-900/80'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="leading-tight text-center">Historikk</span>
            {initialHistory.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono shrink-0 ${
                activeMainTab === 'history' ? 'bg-black/20 text-black font-extrabold' : 'bg-gray-800 text-gray-400'
              }`}>
                {initialHistory.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('players')}
            className={`min-h-[44px] py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeMainTab === 'players'
                ? 'bg-[#BFFF00] text-black shadow-[0_0_15px_rgba(191,255,0,0.25)] font-extrabold'
                : 'text-gray-300 hover:text-white hover:bg-gray-900/80'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="leading-tight text-center">Spillere</span>
            {allPlayers.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono shrink-0 ${
                activeMainTab === 'players' ? 'bg-black/20 text-black font-extrabold' : 'bg-gray-800 text-gray-400'
              }`}>
                {allPlayers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('help')}
            className={`min-h-[44px] py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeMainTab === 'help'
                ? 'bg-[#BFFF00] text-black shadow-[0_0_15px_rgba(191,255,0,0.25)] font-extrabold'
                : 'text-gray-300 hover:text-white hover:bg-gray-900/80'
            }`}
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span className="leading-tight text-center">Hjelp</span>
          </button>
        </div>

        {/* Tab Views */}
        {activeMainTab === 'match' && (
          <StandaloneMatchView
            allPlayers={allPlayers}
          />
        )}

        {activeMainTab === 'tournament' && (
          <TournamentView
            tournament={currentActiveTournament}
            allPlayers={allPlayers}
            onStartNewTournament={handleStartGeneralTournament}
            onTournamentEnded={() => {
              setOverrideTournament({ value: null });
              router.refresh();
            }}
          />
        )}

        {activeMainTab === 'leagues' && (
          <LeaguesView
            leagues={initialLeagues}
            allPlayers={allPlayers}
            onStartTournamentForLeague={handleStartTournamentForLeague}
          />
        )}

        {activeMainTab === 'history' && (
          <HistoryView
            tournamentHistory={initialHistory}
          />
        )}

        {activeMainTab === 'players' && (
          <PlayersView
            allPlayers={allPlayers}
            leagues={initialLeagues}
          />
        )}

        {activeMainTab === 'help' && (
          <HelpFaqView
            onStartNewTournament={handleStartGeneralTournament}
          />
        )}
      </main>

      {/* Start Tournament Modal */}
      {isStartTournamentModalOpen && (
        <StartTournamentModal
          onClose={() => {
            setIsStartTournamentModalOpen(false);
            setSelectedLeagueForTournament(null);
            setPrefillTournamentSettings(null);
          }}
          leagues={initialLeagues}
          allPlayers={allPlayers}
          defaultLeagueId={selectedLeagueForTournament?.id || null}
          initialTargetScore={prefillTournamentSettings?.targetScore || null}
          initialCourtCount={prefillTournamentSettings?.courtCount || null}
          onTournamentStarted={(newTournament) => {
            if (newTournament) {
              setOverrideTournament({ value: newTournament });
            }
            setActiveMainTab('tournament');
            router.refresh();
          }}
        />
      )}

      {/* Switch Profile Modal */}
      {isSwitchProfileModalOpen && (
        <SwitchProfileModal
          currentCode={accessCode}
          isAdmin={isAdmin}
          savedProfiles={savedProfiles}
          onSwitch={switchProfile}
          onRemoveProfile={removeSavedProfile}
          onClose={() => setIsSwitchProfileModalOpen(false)}
        />
      )}
    </div>
  );
}

/* ================= SWITCH PROFILE MODAL ================= */

function SwitchProfileModal({
  currentCode,
  isAdmin,
  savedProfiles,
  onSwitch,
  onRemoveProfile,
  onClose
}: {
  currentCode: string;
  isAdmin: boolean;
  savedProfiles: string[];
  onSwitch: (code: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveProfile: (code: string) => void;
  onClose: () => void;
}) {
  const [newCode, setNewCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    setError(null);
    setIsSubmitting(true);
    const res = await onSwitch(newCode.trim());
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Kunne ikke bytte profil.');
    } else {
      onClose();
    }
  };

  const handleSelect = async (code: string) => {
    setError(null);
    setIsSubmitting(true);
    const res = await onSwitch(code);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Kunne ikke bytte profil.');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-[#141414] border border-gray-800 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative my-6 space-y-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1">
          <X size={16} />
        </button>

        <div className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#BFFF00] flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Profil & Tilgangskode
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-white">Bytt gruppe / tilgangskode</h3>
          <p className="text-xs text-gray-400">
            Aktiv kode: <strong className="text-[#BFFF00] font-mono">{isAdmin ? 'ADMIN' : currentCode}</strong>
          </p>
        </div>

        {/* Input form for new profile */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-300 block mb-1">
              Skriv inn ny tilgangskode:
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => {
                setNewCode(e.target.value);
                setError(null);
              }}
              placeholder="f.eks. padelklubben, kveldsgjengen..."
              className="w-full bg-black border border-gray-700 focus:border-[#BFFF00] text-white rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none transition"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !newCode.trim()}
            className="w-full bg-[#BFFF00] text-black py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-[#b0eb00] transition active:scale-95 disabled:opacity-40"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Bytter...
              </span>
            ) : (
              <>
                <span>Bytt profil</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Tidligere brukte profiler */}
        {savedProfiles.length > 0 && (
          <div className="pt-3 border-t border-gray-800/80 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Tidligere brukte tilgangskoder:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {savedProfiles.map((prof) => (
                <div
                  key={prof}
                  className={`inline-flex items-center rounded-lg text-xs transition group overflow-hidden border ${
                    prof === 'test'
                      ? 'bg-emerald-950/40 border-[#BFFF00]/40 text-[#BFFF00]'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700 text-gray-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(prof)}
                    className="px-2.5 py-1 font-mono flex items-center gap-1 group-hover:text-white"
                  >
                    {prof === 'test' && <Zap className="w-3 h-3 text-[#BFFF00]" />}
                    <span>{prof}</span>
                    {prof === currentCode && (
                      <Check className="w-3 h-3 text-[#BFFF00] ml-0.5" />
                    )}
                  </button>
                  {prof !== 'test' && (
                    <button
                      type="button"
                      onClick={() => onRemoveProfile(prof)}
                      title={`Fjern ${prof} fra listen`}
                      className="px-1.5 py-1 text-gray-500 hover:text-red-400 hover:bg-gray-800 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white font-bold"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
}
