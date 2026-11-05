'use client';

import { useState, useMemo } from 'react';
import { 
  HelpCircle, 
  Search, 
  Trophy, 
  RotateCcw, 
  UserX, 
  Edit3, 
  ChevronDown, 
  Play, 
  Sparkles, 
  Zap,
  Database,
  Download,
  Upload,
  FileJson,
  Lock,
  RefreshCw,
  AlertTriangle,
  Check,
  Trash2,
  Calculator,
  Clock
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { deleteAllTournaments, deleteAllData } from '@/app/actions';
import AmericanoCalculatorModal from './AmericanoCalculatorModal';
import { useTranslation } from '@/lib/i18n';

type HelpFaqViewProps = {
  onStartNewTournament: (settings?: { targetScore?: number; courtCount?: number }) => void;
};

export default function HelpFaqView({ onStartNewTournament }: HelpFaqViewProps) {
  const { isAdmin } = useAuth();
  const { t, isEnglish } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Backup & Restore states
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreJsonData, setRestoreJsonData] = useState<any | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [restoreMessage, setRestoreMessage] = useState('');

  // Parse counts accurately from either { counts: {...} }, { data: {...} }, or flat root objects
  const backupSummary = useMemo(() => {
    if (!restoreJsonData) return null;
    const dataContainer = restoreJsonData.data || restoreJsonData;
    const usersCount =
      restoreJsonData.counts?.users ??
      (Array.isArray(dataContainer.users) ? dataContainer.users.length : null) ??
      0;

    const tournamentsCount =
      restoreJsonData.counts?.tournaments ??
      (Array.isArray(dataContainer.tournaments) ? dataContainer.tournaments.length : null) ??
      0;

    const matchesCount =
      restoreJsonData.counts?.matches ??
      (Array.isArray(dataContainer.matches) ? dataContainer.matches.length : null) ??
      0;

    const leaguesCount =
      restoreJsonData.counts?.leagues ??
      (Array.isArray(dataContainer.leagues) ? dataContainer.leagues.length : null) ??
      0;

    const exportDate = restoreJsonData.exportDate || restoreJsonData.date || null;

    return {
      users: usersCount,
      tournaments: tournamentsCount,
      matches: matchesCount,
      leagues: leaguesCount,
      exportDate: exportDate ? new Date(exportDate).toLocaleString(isEnglish ? 'en-US' : 'no-NO') : null,
    };
  }, [restoreJsonData, isEnglish]);

  // Admin Danger Zone actions
  const [dangerActionStatus, setDangerActionStatus] = useState<string | null>(null);

  const handleDeleteAllTournamentsAction = async () => {
    if (!isAdmin) {
      alert(isEnglish ? 'Only administrators can perform this action.' : 'Kun administrator kan utføre denne handlingen.');
      return;
    }
    const confirmKeyword = isEnglish ? 'DELETE TOURNAMENTS' : 'SLETT TURNERINGER';
    const confirmed = prompt(
      isEnglish 
        ? `WARNING: This permanently deletes ALL tournaments and associated matches. Type "${confirmKeyword}" to confirm:`
        : `ADVARSEL: Dette sletter ALLE turneringer og tilhørende kamper permanent. Skriv "${confirmKeyword}" for å bekrefte:`
    );
    if (confirmed !== confirmKeyword) {
      if (confirmed !== null) alert(isEnglish ? 'Confirmation text did not match. Cancelled.' : 'Bekreftelsesteksten matchet ikke. Avbrutt.');
      return;
    }
    setDangerActionStatus('deleting_tournaments');
    const res = await deleteAllTournaments();
    setDangerActionStatus(null);
    if (res.success) {
      alert(isEnglish ? 'All tournaments and matches were deleted.' : 'Alle turneringer og kamper ble slettet.');
      window.location.reload();
    } else {
      alert(res.error || (isEnglish ? 'Could not delete tournaments' : 'Kunne ikke slette turneringer'));
    }
  };

  const handleDeleteAllDataAction = async () => {
    if (!isAdmin) {
      alert(isEnglish ? 'Only administrators can perform this action.' : 'Kun administrator kan utføre denne handlingen.');
      return;
    }
    const confirmKeyword = isEnglish ? 'RESET ALL' : 'NULLSTILL ALT';
    const confirmed = prompt(
      isEnglish
        ? `CRITICAL WARNING: This deletes ALL data (players, leagues, tournaments, and matches) and resets the database completely. Type "${confirmKeyword}" to confirm:`
        : `KRITISK ADVARSEL: Dette vil slette ALT (alle spillere, ligaer, turneringer og kamper) og nullstille systemet fullstendig. Skriv "${confirmKeyword}" for å bekrefte:`
    );
    if (confirmed !== confirmKeyword) {
      if (confirmed !== null) alert(isEnglish ? 'Confirmation text did not match. Cancelled.' : 'Bekreftelsesteksten matchet ikke. Avbrutt.');
      return;
    }
    setDangerActionStatus('deleting_all');
    const res = await deleteAllData();
    setDangerActionStatus(null);
    if (res.success) {
      alert(isEnglish ? 'All data was erased and the database was reset.' : 'Alle data i systemet ble slettet og databasen er nullstilt.');
      window.location.reload();
    } else {
      alert(res.error || (isEnglish ? 'Could not reset data' : 'Kunne ikke nullstille data'));
    }
  };

  // Categories & FAQs in active language
  const categories = isEnglish ? [
    { id: 'all', label: 'All Topics' },
    { id: 'match', label: 'Match & Scoring' },
    { id: 'rules', label: 'Americano & Rules' },
    { id: 'courts', label: 'Courts & Rotation' },
    { id: 'tools', label: 'Features & Tools' },
    { id: 'leagues', label: 'Leagues & Elo' },
    { id: 'pwa', label: 'Mobile & PWA' },
    { id: 'database', label: 'Database & Backup' },
  ] : [
    { id: 'all', label: 'Alle temaer' },
    { id: 'match', label: 'Ordinær kamp & Scoring' },
    { id: 'rules', label: 'Americano & Regler' },
    { id: 'courts', label: 'Baner & Trekning' },
    { id: 'tools', label: 'Funksjoner & Verktøy' },
    { id: 'leagues', label: 'Ligaer & Tabeller' },
    { id: 'pwa', label: 'Mobil & PWA' },
    { id: 'database', label: 'Database & Backup' },
  ];

  const faqs = isEnglish ? [
    {
      category: 'match',
      question: 'How do Golden Point and Advantage work in standard matches?',
      answer: 'In standard matches you can choose between two recognized deuce rules: 1) Golden point (standard in modern padel): At 40-40, a single deciding point is played with the receiving team choosing the service side. 2) Advantage: Traditional rule where a team must win by two clear points.',
      tags: ['golden point', 'advantage', 'deuce', 'rules', 'tiebreak']
    },
    {
      category: 'match',
      question: 'Which match formats are supported in Standard Match?',
      answer: 'You can select Best of 1 set, Best of 3 sets, or Best of 5 sets, with optional standard 7-point Tiebreak or 10-point Super-tiebreak for deciding sets. The live scoreboard also tracks server position, match points, set points, and break points.',
      tags: ['format', 'best of 3', 'sets', 'super tiebreak', 'server']
    },
    {
      category: 'tools',
      question: 'How many rounds can we fit during our court booking in an Americano?',
      answer: 'Use the Americano Time Calculator (button above). A 24-point match takes roughly 10 minutes. With 2 minutes rest between rounds and 5 minutes warmup, 8 players on 2 courts complete exactly 7 rounds (a full Americano cycle) within a standard 90-minute slot.',
      tags: ['calculator', 'time', 'rounds', 'booking', '90 minutes', 'duration', 'americano']
    },
    {
      category: 'tools',
      question: 'How does the countdown timer work?',
      answer: 'The timer is hidden by default to provide an uncluttered scoreboard. Tap "Timer" anytime to display it. Choose quick presets (10, 15, 20 min) or set a custom duration with audio alerts when time expires.',
      tags: ['timer', 'countdown', 'sound', 'time']
    },
    {
      category: 'rules',
      question: 'How does Americano tournament scoring work?',
      answer: 'In Americano, new partners and opponents are drawn every round. Each match is played for a fixed total number of points (e.g. 21 or 24). If Team A wins 14–10, each player on Team A receives 14 individual points on the leaderboard, while Team B players get 10 points. The algorithm ensures balanced playtime and fresh pairings.',
      tags: ['americano', 'rules', 'points', 'draw']
    },
    {
      category: 'courts',
      question: 'How does multi-court assignment work (1, 2, or 3 courts)?',
      answer: 'When starting a tournament, choose how many courts you have available (1–3 courts). Clicking "Draw Round" automatically pairs players and assigns active matches to all free courts simultaneously.',
      tags: ['courts', 'parallel', 'queue', 'multi-court']
    },
    {
      category: 'tools',
      question: 'What does the Player Pause feature do?',
      answer: 'If a player needs to rest, gets injured, or arrives late, pause them directly from the leaderboard. They will be skipped in upcoming rounds without losing their earned points. Unpause whenever they are ready to return.',
      tags: ['pause', 'injury', 'rotation', 'standby']
    },
    {
      category: 'tools',
      question: 'What does the "Halve Points" button do?',
      answer: 'If court booking time is running short, tap "Halve points" in the top menu. Remaining matches will be played for half the points (e.g. 12 instead of 24), allowing everyone to complete the tournament before court time expires.',
      tags: ['halving', 'time', 'score', 'short time']
    },
    {
      category: 'tools',
      question: 'Can I edit scores after a match is completed?',
      answer: 'Yes. Under "Completed Matches", tap "Correct". You can modify scores and timestamps on the day of the tournament. The leaderboard and ratings recalculate immediately.',
      tags: ['correction', 'edit', 'score']
    },
    {
      category: 'leagues',
      question: 'How does the 2v2 Elo rating system work in Leagues?',
      answer: 'Players start at 1500 Elo. Each match updates ratings based on expected outcomes, win/loss, and score margin. Superior wins (e.g. 21–3) award more rating points than narrow wins (21–19). Win percentage and average score percentage serve as secondary tie-breakers.',
      tags: ['elo', 'rating', 'league', 'ranking', 'standings']
    },
    {
      category: 'database',
      question: 'Where is data stored and how are backups handled?',
      answer: 'PadelFlex stores all data securely in a local database on the server. Full JSON backup export and restore capabilities are reserved for administrators.',
      tags: ['database', 'sqlite', 'backup', 'admin']
    },
    {
      category: 'pwa',
      question: 'How do I install PadelFlex on iOS or Android?',
      answer: 'On iPhone (Safari): Tap the Share button and select "Add to Home Screen". On Android (Chrome): Tap the menu and select "Install app". PadelFlex runs in clean fullscreen mode like a native app.',
      tags: ['iphone', 'ios', 'safari', 'android', 'chrome', 'pwa']
    }
  ] : [
    {
      category: 'match',
      question: 'Hvordan fungerer Golden point og Fordel i Ordinær kamp?',
      answer: 'I en ordinær kamp kan du velge mellom to anerkjente deuce-regler: 1) Golden point (standard i moderne padel): Ved stillingen 40-40 spilles ett enkelt avgjørende poeng hvor mottakerparet velger returside. 2) Fordel (Advantage): Tradisjonell regel der man må vinne med to poeng.',
      tags: ['golden point', 'fordel', 'advantage', 'deuce', 'ordinær kamp', 'regler', 'tiebreak']
    },
    {
      category: 'match',
      question: 'Hvilke kampformater støttes i Ordinær kamp?',
      answer: 'Du kan velge mellom Best av 1 sett, Best av 3 sett eller Best av 5 sett, med valgfritt Tiebreak (til 7 poeng) eller Super-tiebreak (til 10 poeng i avgjørende sett). Live-tavlen sporer også serverett, matchballer, settballer og breakballer.',
      tags: ['format', 'best av 3', 'sett', 'super tiebreak', 'serverett', 'statistikk']
    },
    {
      category: 'tools',
      question: 'Hvor mange runder rekker vi på banetiden i en Americano?',
      answer: 'Bruk Americano Tidskalkulatoren (knappen øverst på denne siden). En 24-poengs kamp tar ca. 10 minutter. Med 2 minutter pause og 5 minutter oppvarming rekker 8 spillere på 2 baner akkurat 7 runder (en komplett Americano) på en 90-minutters booking!',
      tags: ['kalkulator', 'tid', 'runder', 'banetid', '90 minutter', 'varighet', 'americano']
    },
    {
      category: 'tools',
      question: 'Hvordan fungerer nedtellingstimeren?',
      answer: 'Timeren er som standard skjult for å gi en ren spillflate. Du kan aktivere den når som helst ved å trykke på «Timer»-knappen. Den tilbyr raske forhåndsvalg (10, 15, 20 min) eller egendefinert tid med lydvarsel når tiden er ute.',
      tags: ['timer', 'nedtelling', 'stoppeklokke', 'tid', 'lydvarsel']
    },
    {
      category: 'rules',
      question: 'Hvordan fungerer Americano i PadelFlex?',
      answer: 'I Americano trekkes det nye makkere og motstandere for hver kamp. Hver kamp spilles om et fast antall poeng (f.eks. 21 eller 24 poeng). Hvis Lag A vinner 14–10, får hver spiller på Lag A 14 poeng på tabellen, mens spillerne på Lag B får 10 poeng.',
      tags: ['americano', 'regler', 'poeng', 'trekk']
    },
    {
      category: 'courts',
      question: 'Hvordan fungerer 1, 2 eller 3 baner?',
      answer: 'Når du starter en turnering, velger du hvor mange baner du har til rådighet (1–3 baner). Trykker du på «Trekk runde», genererer PadelFlex automatisk kamper for alle ledige baner samtidig.',
      tags: ['baner', 'parallelle', 'kø', 'multi-court']
    },
    {
      category: 'tools',
      question: 'Hva gjør «Pause»-knappen (Hopp over spiller)?',
      answer: 'Må en spiller hvile, er skadet eller kom for sent? Sett spilleren på pause i tabellen. De utelates i neste trekning uten å miste poengene sine. Når spilleren er klar igjen, trykker du bare på «Aktiv».',
      tags: ['pause', 'spillerpause', 'skade', 'forsent', 'rotasjon']
    },
    {
      category: 'tools',
      question: 'Hva gjør «Halvér poeng»-funksjonen?',
      answer: 'Dersom tiden i padelhallen begynner å renne ut, trykk på «Halvér poeng». Resterende kamper spilles da om halvparten av poengene (f.eks. fra 24 til 12 poeng), slik at alle rekker å fullføre.',
      tags: ['halvering', 'tid', 'score', 'kort tid']
    },
    {
      category: 'tools',
      question: 'Kan jeg korrigere poeng etter at en kamp er fullført?',
      answer: 'Ja. Under «Fullførte kamper» trykker du på «Korriger». Du kan justere poengfordeling, starttid og sluttid samme dag. Tabellen oppdateres umiddelbart.',
      tags: ['korreksjon', 'endre', 'rediger', 'feilregistrering']
    },
    {
      category: 'leagues',
      question: 'Hvordan fungerer Elo-systemet og tabellen i Liga?',
      answer: 'I ligatabellen rangeres spillerne primært etter 2v2 Score-vektet Elo-rating (startverdi 1500). Hver spilte kamp oppdaterer din rating basert på forventet utfall og seiersmargin. Seiersprosent og gjennomsnittlig score % fungerer som tie-breakers.',
      tags: ['elo', 'rating', 'liga', 'ranking', 'tabell', 'tiebreaker']
    },
    {
      category: 'database',
      question: 'Hvor lagres alle data og hvem kan ta backup?',
      answer: 'PadelFlex benytter en SQLite-database trygt lagret på serveren. Sikkerhetskopi (eksport og import av JSON-backup) er forbeholdt administrator.',
      tags: ['database', 'sqlite', 'prisma', 'lagring', 'backup', 'admin']
    },
    {
      category: 'pwa',
      question: 'Hvordan installerer jeg PadelFlex på mobil (iOS / Android)?',
      answer: 'På iPhone (Safari): Trykk på Del-knappen og velg «Legg til på Hjem-skjerm». På Android (Chrome): Trykk på menyen og velg «Installer app». PadelFlex kjører da i fullskjerm uten nettleserfelt.',
      tags: ['iphone', 'ios', 'safari', 'android', 'chrome', 'pwa']
    }
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesCat = selectedCategory === 'all' || faq.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      faq.question.toLowerCase().includes(query) || 
      faq.answer.toLowerCase().includes(query) ||
      faq.tags.some(t => t.toLowerCase().includes(query));
    return matchesCat && matchesSearch;
  });

  // Direct download for logged in admin
  const handleDownloadBackup = async () => {
    setDownloadError('');
    setIsDownloading(true);

    try {
      const url = `/api/backup?format=json`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Feil under nedlasting (${res.status})`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `padelflex-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setDownloadError(err.message || (isEnglish ? 'Could not download backup file.' : 'Kunne ikke laste ned sikkerhetskopi.'));
    } finally {
      setIsDownloading(false);
    }
  };

  // Restore logic
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreStatus('idle');
    setRestoreMessage('');

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setRestoreStatus('error');
      setRestoreMessage(isEnglish ? 'File must be a valid .json backup.' : 'Filen må være en gyldig .json-sikkerhetskopi.');
      return;
    }

    setRestoreFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error(isEnglish ? 'Invalid JSON format.' : 'Ugyldig JSON-format.');
        }
        setRestoreJsonData(parsed);
      } catch (err: any) {
        setRestoreStatus('error');
        setRestoreMessage((isEnglish ? 'Could not read JSON file: ' : 'Kunne ikke lese JSON-filen: ') + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreJsonData) {
      setRestoreStatus('error');
      setRestoreMessage(isEnglish ? 'Please select a valid JSON backup file first.' : 'Velg en gyldig JSON-backupfil først.');
      return;
    }

    const warningText = isEnglish
      ? 'WARNING: This will replace all current data in the database with the contents of this backup file. Are you sure?'
      : 'ADVARSEL: Dette vil erstatte alle nåværende data i databasen med innholdet fra sikkerhetskopien. Er du sikker?';

    if (!confirm(warningText)) {
      return;
    }

    setRestoreStatus('loading');
    setRestoreMessage(isEnglish ? 'Restoring database from JSON...' : 'Gjenoppretter database fra JSON...');

    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: restorePassword || undefined,
          backupData: restoreJsonData
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (isEnglish ? 'Restore failed' : 'Gjenoppretting feilet'));
      }

      setRestoreStatus('success');
      const userCount = data.restored?.users ?? backupSummary?.users ?? 0;
      const tournamentCount = data.restored?.tournaments ?? backupSummary?.tournaments ?? 0;
      const matchCount = data.restored?.matches ?? backupSummary?.matches ?? 0;
      setRestoreMessage(
        isEnglish
          ? `Successfully restored (${userCount} players, ${tournamentCount} tournaments, ${matchCount} matches)! Reloading page...`
          : `Vellykket gjenopprettet (${userCount} spillere, ${tournamentCount} turneringer, ${matchCount} kamper)! Siden laster på nytt...`
      );

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setRestoreStatus('error');
      setRestoreMessage(err.message || (isEnglish ? 'An error occurred during restore.' : 'Det oppstod en feil under gjenopprettingen.'));
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#161616] via-[#141414] to-gray-900 p-4 sm:p-6 rounded-3xl border border-gray-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> {t.help.guideBadge}
            </span>
            <span className="text-xs text-gray-500 font-mono">PadelFlex</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">{t.help.title}</h2>
          <p className="text-xs text-gray-400 mt-0.5 max-w-xl">
            {t.help.subtitle}
          </p>
        </div>

        <div className="w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => onStartNewTournament()}
            className="w-full sm:w-auto bg-[#BFFF00] text-black px-5 py-3 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_20px_rgba(191,255,0,0.25)] shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{t.tournaments.newTournament}</span>
          </button>
        </div>
      </div>

      {/* TIME CALCULATOR PROMO CARD */}
      <div className="bg-gradient-to-r from-[#172212] via-[#12190e] to-[#141414] border border-[#BFFF00]/30 rounded-2xl p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#BFFF00]/15 border border-[#BFFF00]/30 text-[#BFFF00] flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white uppercase tracking-wider">
                {t.help.calcPromoTitle}
              </span>
              <span className="text-[10px] bg-[#BFFF00] text-black font-extrabold px-1.5 py-0.2 rounded font-mono uppercase">
                {t.help.calcPromoBadge}
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              {t.help.calcPromoDesc}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCalculatorOpen(true)}
          className="bg-[#BFFF00] text-black hover:bg-[#b0eb00] font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 shadow-sm cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t.help.openCalc}</span>
        </button>
      </div>

      {/* 4-STEP WORKFLOW */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#BFFF00] px-1 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#BFFF00]" /> {t.help.howItWorks}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                1
              </div>
              <span className="font-extrabold text-sm text-white">{t.help.step1Title}</span>
            </div>
            <p className="text-xs text-gray-400">
              {t.help.step1Desc}
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                2
              </div>
              <span className="font-extrabold text-sm text-white">{t.help.step2Title}</span>
            </div>
            <p className="text-xs text-gray-400">
              {t.help.step2Desc}
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                3
              </div>
              <span className="font-extrabold text-sm text-white">{t.help.step3Title}</span>
            </div>
            <p className="text-xs text-gray-400">
              {t.help.step3Desc}
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                4
              </div>
              <span className="font-extrabold text-sm text-white">{t.help.step4Title}</span>
            </div>
            <p className="text-xs text-gray-400">
              {t.help.step4Desc}
            </p>
          </div>
        </div>
      </div>

      {/* SPECIAL FEATURES HIGHLIGHTS */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#BFFF00] px-1 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-[#BFFF00]" /> {t.help.specialFeatures}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs shrink-0">
                <UserX className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-white">{t.help.pauseTitle}</h4>
            </div>
            <p className="text-xs text-gray-400">
              {t.help.pauseDesc}
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center justify-center text-xs shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-white">{t.help.halveTitle}</h4>
            </div>
            <p className="text-xs text-gray-400">
              {t.help.halveDesc}
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00]/15 text-[#BFFF00] border border-[#BFFF00]/30 flex items-center justify-center text-xs shrink-0">
                <Edit3 className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-white">{t.help.correctTitle}</h4>
            </div>
            <p className="text-xs text-gray-400">
              {t.help.correctDesc}
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH & FAQ SECTION */}
      <div className="bg-[#141414] p-4 sm:p-6 rounded-3xl border border-gray-800 shadow-xl space-y-4">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white">{t.help.faqTitle}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {t.help.faqSubtitle}
          </p>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder={t.help.faqPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black border border-gray-800 text-white rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:border-[#BFFF00]"
          />
        </div>

        {/* Category Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#BFFF00] text-black font-extrabold'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className="space-y-2.5 pt-2">
          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center bg-gray-900/40 rounded-2xl border border-gray-800">
              <p className="text-gray-400 text-xs">{t.help.noFaqsFound} &quot;{searchQuery}&quot;.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                className="mt-3 text-xs text-[#BFFF00] font-bold hover:underline cursor-pointer"
              >
                {t.help.resetSearch}
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={faq.question}
                  className={`rounded-2xl border transition-all ${
                    isOpen 
                      ? 'bg-gray-900/90 border-[#BFFF00]/40 shadow-sm' 
                      : 'bg-black/50 border-gray-800/80 hover:border-gray-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full text-left p-4 flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-white cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-lg bg-gray-800 text-[#BFFF00] flex items-center justify-center text-[10px] shrink-0 font-mono">
                        ?
                      </span>
                      {faq.question}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[#BFFF00]' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-gray-300 border-t border-gray-800/60 leading-relaxed animate-in fade-in">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* DATABASE, BACKUP & RESTORE (ADMIN ONLY) */}
      {isAdmin && (
        <div className="bg-gradient-to-br from-[#151a14] via-[#141414] to-black p-5 sm:p-7 rounded-3xl border-2 border-[#BFFF00]/30 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800/80">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#BFFF00] text-black flex items-center justify-center font-extrabold shrink-0 shadow-[0_0_20px_rgba(191,255,0,0.35)]">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  {t.backup.title}
                  <span className="px-2 py-0.5 bg-[#BFFF00]/20 text-[#BFFF00] text-[10px] font-mono font-extrabold rounded-lg">
                    {t.backup.adminBadge}
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  {t.backup.databaseDesc}
                </p>
              </div>
            </div>
          </div>

          {/* TWO COLUMNS: EXPORT / DOWNLOAD & IMPORT / RESTORE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* LEFT: DOWNLOAD BACKUP */}
            <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-gray-800 space-y-3.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                  <Download className="w-4 h-4 text-[#BFFF00]" />
                  <span>{t.backup.downloadJson}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t.backup.downloadDesc}
                </p>
              </div>

              {downloadError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isDownloading}
                  className="w-full bg-[#BFFF00] text-black py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_15px_rgba(191,255,0,0.25)] cursor-pointer disabled:opacity-40"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.common.loading}</span>
                    </>
                  ) : (
                    <>
                      <FileJson className="w-4 h-4 fill-current" />
                      <span>{t.backup.downloadJson}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RIGHT: UPLOAD & RESTORE JSON BACKUP */}
            <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-gray-800 space-y-3.5">
              <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>{t.backup.restoreJson}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.backup.restoreDesc}
              </p>

              <form onSubmit={handleExecuteRestore} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">
                    {t.backup.chooseFile}
                  </label>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gray-800 file:text-white hover:file:bg-gray-700 cursor-pointer bg-gray-950 p-1.5 rounded-xl border border-gray-800"
                  />
                </div>

                {backupSummary && (
                  <div className="p-3 bg-gray-900/90 rounded-xl border border-gray-800 space-y-1.5 text-xs text-gray-300 animate-in fade-in">
                    <div className="flex items-center justify-between text-[#BFFF00] font-bold">
                      <span>{t.backup.fileSummary}</span>
                      <span className="truncate max-w-[170px] text-white font-mono text-[11px]">{restoreFile?.name}</span>
                    </div>
                    {backupSummary.exportDate && (
                      <div className="text-[10px] text-gray-400 font-mono">
                        {isEnglish ? 'Exported:' : 'Eksportert:'} {backupSummary.exportDate}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-300 font-mono pt-1.5 border-t border-gray-800/80">
                      <div>{t.common.players}: <span className="text-[#BFFF00] font-bold">{backupSummary.users}</span></div>
                      <div>{t.common.tournaments}: <span className="text-[#BFFF00] font-bold">{backupSummary.tournaments}</span></div>
                      <div>{t.common.matches}: <span className="text-[#BFFF00] font-bold">{backupSummary.matches}</span></div>
                      <div>{t.common.leagues}: <span className="text-[#BFFF00] font-bold">{backupSummary.leagues}</span></div>
                    </div>
                  </div>
                )}

                {restoreStatus === 'error' && (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{restoreMessage}</span>
                  </div>
                )}

                {restoreStatus === 'success' && (
                  <div className="p-2.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 rounded-xl text-[#BFFF00] text-xs flex items-center gap-2 animate-in fade-in">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{restoreMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!restoreJsonData || restoreStatus === 'loading'}
                  className="w-full bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-black py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-[0_0_15px_rgba(34,211,238,0.25)] cursor-pointer"
                >
                  {restoreStatus === 'loading' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.backup.restoring}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>{t.backup.restoreButton}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* DANGER ZONE / FACTORY RESET (ADMIN ONLY) */}
          <div className="pt-5 border-t border-gray-800/80">
            <div className="flex items-center gap-2 mb-3 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="text-xs font-black uppercase tracking-wider">{t.backup.dangerZone}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <span className="font-extrabold text-white text-xs block">{t.backup.deleteAllTournaments}</span>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    {t.backup.deleteAllTournamentsDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAllTournamentsAction}
                  disabled={dangerActionStatus !== null}
                  className="w-full py-2.5 px-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {dangerActionStatus === 'deleting_tournaments' 
                      ? (isEnglish ? 'Deleting tournaments...' : 'Sletter turneringer...') 
                      : t.backup.deleteAllTournaments}
                  </span>
                </button>
              </div>

              <div className="p-4 bg-red-950/30 border border-red-800/50 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <span className="font-extrabold text-white text-xs block">{t.backup.resetAllData}</span>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    {t.backup.resetAllDataDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAllDataAction}
                  disabled={dangerActionStatus !== null}
                  className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {dangerActionStatus === 'deleting_all' 
                      ? (isEnglish ? 'Resetting entire system...' : 'Nullstiller hele systemet...') 
                      : t.backup.resetAllData}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Americano Calculator Modal */}
      {isCalculatorOpen && (
        <AmericanoCalculatorModal
          onClose={() => setIsCalculatorOpen(false)}
          onStartTournamentWithSettings={(settings) => {
            setIsCalculatorOpen(false);
            onStartNewTournament({
              targetScore: settings.targetScore,
              courtCount: settings.courtCount
            });
          }}
        />
      )}
    </div>
  );
}
