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
  Key,
  RefreshCw,
  AlertTriangle,
  Check,
  ShieldCheck,
  Trash2,
  Calculator,
  Clock
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { deleteAllTournaments, deleteAllData } from '@/app/actions';
import AmericanoCalculatorModal from './AmericanoCalculatorModal';

type HelpFaqViewProps = {
  onStartNewTournament: (settings?: { targetScore?: number; courtCount?: number }) => void;
};

export default function HelpFaqView({ onStartNewTournament }: HelpFaqViewProps) {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Backup & Restore states
  const [downloadPassword, setDownloadPassword] = useState('');
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreJsonData, setRestoreJsonData] = useState<any | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [restoreStats, setRestoreStats] = useState<any | null>(null);

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
      exportDate: exportDate ? new Date(exportDate).toLocaleString('no-NO') : null,
    };
  }, [restoreJsonData]);

  // Admin Danger Zone actions
  const [dangerActionStatus, setDangerActionStatus] = useState<string | null>(null);

  const handleDeleteAllTournamentsAction = async () => {
    if (!isAdmin) {
      alert('Kun administrator kan utføre denne handlingen. Logg inn som admin øverst til høyre.');
      return;
    }
    const confirmed = prompt('ADVARSEL: Dette sletter ALLE turneringer og tilhørende kamper permanent. Skriv "SLETT TURNERINGER" for å bekrefte:');
    if (confirmed !== 'SLETT TURNERINGER') {
      if (confirmed !== null) alert('Bekreftelsesteksten matchet ikke. Avbrutt.');
      return;
    }
    setDangerActionStatus('deleting_tournaments');
    const res = await deleteAllTournaments();
    setDangerActionStatus(null);
    if (res.success) {
      alert('Alle turneringer og kamper ble slettet.');
      window.location.reload();
    } else {
      alert(res.error || 'Kunne ikke slette turneringer');
    }
  };

  const handleDeleteAllDataAction = async () => {
    if (!isAdmin) {
      alert('Kun administrator kan utføre denne handlingen. Logg inn som admin øverst til høyre.');
      return;
    }
    const confirmed = prompt('KRITISK ADVARSEL: Dette vil slette ALT (alle spillere, ligaer, turneringer og kamper) og nullstille systemet fullstendig. Skriv "NULLSTILL ALT" for å bekrefte:');
    if (confirmed !== 'NULLSTILL ALT') {
      if (confirmed !== null) alert('Bekreftelsesteksten matchet ikke. Avbrutt.');
      return;
    }
    setDangerActionStatus('deleting_all');
    const res = await deleteAllData();
    setDangerActionStatus(null);
    if (res.success) {
      alert('Alle data i systemet ble slettet og databasen er nullstilt.');
      window.location.reload();
    } else {
      alert(res.error || 'Kunne ikke nullstille data');
    }
  };

  const categories = [
    { id: 'all', label: 'Alle temaer' },
    { id: 'match', label: 'Ordinær kamp & Scoring' },
    { id: 'rules', label: 'Americano & Regler' },
    { id: 'courts', label: 'Baner & Trekning' },
    { id: 'tools', label: 'Funksjoner & Verktøy' },
    { id: 'leagues', label: 'Ligaer & Tabeller' },
    { id: 'pwa', label: 'Mobil & PWA' },
    { id: 'database', label: 'Database & Backup' },
  ];

  const faqs = [
    {
      category: 'match',
      question: 'Hvordan fungerer Golden point og Fordel i Ordinær kamp?',
      answer: 'I en ordinær kamp kan du velge mellom to anerkjente deuce-regler: 1) Golden point (standard i moderne padel): Ved stillingen 40-40 spilles ett enkelt avgjørende poeng hvor mottakerparet velger returside. 2) Fordel (Advantage): Tradisjonell regel der man må vinne med to poeng (fordel inn/ut).',
      tags: ['golden point', 'fordel', 'advantage', 'deuce', 'ordinær kamp', 'regler', 'tiebreak']
    },
    {
      category: 'match',
      question: 'Hvilke kampformater støttes i Ordinær kamp?',
      answer: 'Du kan velge mellom Best av 1 sett, Best av 3 sett eller Best av 5 sett, med valgfritt Tiebreak (førstemann til 7 poeng med 2 poengs ledelse) eller Super-tiebreak (til 10 poeng i avgjørende sett). Live-tavlen sporer også serverett, servende spiller, matchballer, settballer og breakballer.',
      tags: ['format', 'best av 3', 'sett', 'super tiebreak', 'serverett', 'statistikk']
    },
    {
      category: 'tools',
      question: 'Hvor mange runder rekker vi på banetiden i en Americano?',
      answer: 'Bruk Americano Tidskalkulatoren (knappen øverst på denne siden). Erfaringsmessig tar en 24-poengs kamp ca. 10 minutter. Med 2 minutter pause og 5 minutter oppvarming rekker 8 spillere på 2 baner akkurat 7 runder (en komplett Americano) på en standard 90-minutters booking!',
      tags: ['kalkulator', 'tid', 'runder', 'banetid', '90 minutter', 'varighet', 'americano']
    },
    {
      category: 'tools',
      question: 'Hvordan fungerer nedtellingstimeren?',
      answer: 'Timeren er som standard skjult for å gi ren og uforstyrret spillflate. Du kan aktivere den når som helst ved å trykke på «Timer»-knappen. Timeren tilbyr raske forhåndsvalg (10, 15, 20 min osv.) eller egendefinert tid, og varsler med lydsignal når tiden er ute.',
      tags: ['timer', 'nedtelling', 'stoppeklokke', 'tid', 'lydvarsel']
    },
    {
      category: 'rules',
      question: 'Hvordan fungerer Americano i PadelFlex?',
      answer: 'I Americano trekkes det nye makkere og motstandere for hver kamp. Hver kamp spilles om et fast antall poeng (f.eks. 21 eller 24 poeng). Hvis Lag A vinner 14–10, får hver spiller på Lag A 14 individuelle poeng på tabellen, mens spillerne på Lag B får 10 poeng. Algoritmen sørger for at alle spiller så jevnt som mulig med og mot hverandre.',
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
      answer: 'Må en spiller hvile, er skadet eller kom for sent? Sett spilleren på pause i tabellen. De utelates automatisk i neste trekning uten å miste poengene sine. Når spilleren er klar igjen (eller har ankommet), trykker du bare på «Aktiv» for å inkludere dem i neste runde.',
      tags: ['pause', 'spillerpause', 'skade', 'forsent', 'rotasjon']
    },
    {
      category: 'tools',
      question: 'Hva gjør «Halvér poeng»-funksjonen?',
      answer: 'Dersom tiden i padelhallen begynner å renne ut, kan du trykke på «Halvér poeng» i toppmenyen. Resterende kamper spilles da om halvparten av poengene (f.eks. fra 24p til 12p), slik at alle rekker å fullføre før banetiden er over.',
      tags: ['halvering', 'tid', 'score', 'kort tid']
    },
    {
      category: 'tools',
      question: 'Kan jeg korrigere poeng etter at en kamp er fullført?',
      answer: 'Ja. Under «Fullførte kamper» trykker du på «Korriger». Du kan justere poengfordeling, starttid og sluttid samme dag som turneringen ble spilt. Tabellen oppdateres umiddelbart.',
      tags: ['korreksjon', 'endre', 'rediger', 'feilregistrering']
    },
    {
      category: 'leagues',
      question: 'Hvem kan opprette, avslutte og gjenåpne ligaer?',
      answer: 'Alle brukere kan opprette nye ligaer, starte nye runder, legge til/fjerne faste spillere samt avslutte (arkivere) og gjenåpne ligaer ved behov. Permanent sletting av en liga er forbeholdt administrator.',
      tags: ['liga', 'opprett', 'avslutt', 'arkiver', 'gjenåpne', 'rettigheter', 'admin']
    },
    {
      category: 'leagues',
      question: 'Hvordan fungerer Elo-systemet og tabellen i Liga?',
      answer: 'I ligatabellen rangeres spillerne primært etter 2v2 Score-vektet Elo-rating (startverdi 1500). Hver spilte kamp oppdaterer din personlige rating basert på både forventet utfall, seier/tap og poengmargin. Seiersprosent og gjennomsnittlig score % fungerer som sekundære tie-breakers ved lik rating.',
      tags: ['elo', 'rating', 'liga', 'ranking', 'tabell', 'tiebreaker']
    },
    {
      category: 'leagues',
      question: 'Hva er forskjellen på en Enkeltturnering og en Liga?',
      answer: 'En Enkeltturnering er en frittstående kveldsturnering som avsluttes og lagres i historikken. En Liga lar deg samle en fast gruppe spillere og spille flere runder over uker eller måneder, med en felles sammenlagttabell som automatisk oppdateres etter hver spilte runde.',
      tags: ['liga', 'enkeltturnering', 'serie', 'sammenlagt']
    },
    {
      category: 'database',
      question: 'Hvor lagres alle data og hvem kan ta backup?',
      answer: 'PadelFlex benytter en SQLite-database på serveren. Sikkerhetskopi (eksport og import av JSON-backup) er forbeholdt administrator.',
      tags: ['database', 'sqlite', 'prisma', 'lagring', 'backup', 'admin']
    },
    {
      category: 'pwa',
      question: 'Hvordan installerer jeg PadelFlex på mobil (iOS / Android)?',
      answer: 'På iPhone (Safari): Trykk på Del-knappen og velg «Legg til på Hjem-skjerm». På Android (Chrome): Trykk på menyen og velg «Installer app». PadelFlex fungerer da i fullskjerm uten adressefelt.',
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

  // Functions for Download
  const handleOpenDownloadModal = () => {
    setDownloadError('');
    setIsDownloadModalOpen(true);
  };

  const handleConfirmDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadPassword && !isAdmin) {
      setDownloadError('Vennligst skriv inn admin-passord.');
      return;
    }
    setDownloadError('');
    setIsDownloading(true);

    try {
      const passParam = downloadPassword ? `&password=${encodeURIComponent(downloadPassword)}` : '';
      const url = `/api/backup?format=json${passParam}`;
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

      setIsDownloadModalOpen(false);
    } catch (err: any) {
      setDownloadError(err.message || 'Kunne ikke laste ned sikkerhetskopi.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Functions for Restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreStatus('idle');
    setRestoreMessage('');
    setRestoreStats(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setRestoreStatus('error');
      setRestoreMessage('Filen må være en gyldig .json-sikkerhetskopi.');
      return;
    }

    setRestoreFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Ugyldig JSON-format.');
        }
        setRestoreJsonData(parsed);
      } catch (err: any) {
        setRestoreStatus('error');
        setRestoreMessage('Kunne ikke lese JSON-filen: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreJsonData) {
      setRestoreStatus('error');
      setRestoreMessage('Velg en gyldig JSON-backupfil først.');
      return;
    }
    if (!restorePassword && !isAdmin) {
      setRestoreStatus('error');
      setRestoreMessage('Oppgi admin-passord for å bekrefte gjenoppretting.');
      return;
    }

    if (!confirm('ADVARSEL: Dette vil erstatte alle nåværende data i databasen med innholdet fra sikkerhetskopien. Er du sikker?')) {
      return;
    }

    setRestoreStatus('loading');
    setRestoreMessage('Gjenoppretter database fra JSON...');

    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: restorePassword,
          backupData: restoreJsonData
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gjenoppretting feilet');
      }

      setRestoreStatus('success');
      setRestoreStats(data.restored || data.stats);
      const userCount = data.restored?.users ?? backupSummary?.users ?? 0;
      const tournamentCount = data.restored?.tournaments ?? backupSummary?.tournaments ?? 0;
      const matchCount = data.restored?.matches ?? backupSummary?.matches ?? 0;
      setRestoreMessage(`Vellykket gjenopprettet (${userCount} spillere, ${tournamentCount} turneringer, ${matchCount} kamper)! Siden laster på nytt...`);

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setRestoreStatus('error');
      setRestoreMessage(err.message || 'Det oppstod en feil under gjenopprettingen.');
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#161616] via-[#141414] to-gray-900 p-4 sm:p-6 rounded-3xl border border-gray-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#BFFF00]/10 border border-[#BFFF00]/30 text-[#BFFF00] rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Veiledning
            </span>
            <span className="text-xs text-gray-500 font-mono">PadelFlex</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">Hjelp, Regler & FAQ</h2>
          <p className="text-xs text-gray-400 mt-0.5 max-w-xl">
            Lær hvordan du organiserer Americano-turneringer, håndterer spillere og bruker funksjonene i PadelFlex.
          </p>
        </div>

        <div className="w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => onStartNewTournament()}
            className="w-full sm:w-auto bg-[#BFFF00] text-black px-5 py-3 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_20px_rgba(191,255,0,0.25)] shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Ny turnering</span>
          </button>
        </div>
      </div>

      {/* TIDSKALKULATOR PROMO CARD */}
      <div className="bg-gradient-to-r from-[#172212] via-[#12190e] to-[#141414] border border-[#BFFF00]/30 rounded-2xl p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#BFFF00]/15 border border-[#BFFF00]/30 text-[#BFFF00] flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Planlegger du kvelden?
              </span>
              <span className="text-[10px] bg-[#BFFF00] text-black font-extrabold px-1.5 py-0.2 rounded font-mono uppercase">
                Tidskalkulator
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Beregn nøyaktig hvor mange runder dere rekker på banetiden (f.eks. 90 min) med rettferdig spilletid for alle deltakere.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCalculatorOpen(true)}
          className="bg-[#BFFF00] text-black hover:bg-[#b0eb00] font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 shadow-sm cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Åpne kalkulator</span>
        </button>
      </div>

      {/* 4-STEGS ARBEIDSFLYT */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#BFFF00] px-1 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#BFFF00]" /> Slik fungerer en turnering
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                1
              </div>
              <span className="font-extrabold text-sm text-white">Velg oppsett</span>
            </div>
            <p className="text-xs text-gray-400">
              Velg mellom Enkeltturnering eller Ligarunde. Velg 1–3 baner, målscore og deltakere.
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                2
              </div>
              <span className="font-extrabold text-sm text-white">Trekk kamper</span>
            </div>
            <p className="text-xs text-gray-400">
              Trykk «Trekk runde». Appen fordeler spillere på banene og roterer makkere og motstandere.
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                3
              </div>
              <span className="font-extrabold text-sm text-white">Lagre score</span>
            </div>
            <p className="text-xs text-gray-400">
              Velg poeng for det ene laget. Det andre lagets poeng regnes automatisk ut.
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                4
              </div>
              <span className="font-extrabold text-sm text-white">Live tabell</span>
            </div>
            <p className="text-xs text-gray-400">
              Følg plasseringer, individuelle poeng, seiere og differanser i sanntid.
            </p>
          </div>
        </div>
      </div>

      {/* SMARTE FUNKSJONER & VERKTØY HIGHLIGHTS */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#BFFF00] px-1 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-[#BFFF00]" /> Spesialfunksjoner
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs shrink-0">
                <UserX className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-white">Spillerpause</h4>
            </div>
            <p className="text-xs text-gray-400">
              Må en spiller hvile, er skadet eller kom for sent? Sett spilleren på pause i tabellen. De utelates i neste trekning uten å miste poengene.
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center justify-center text-xs shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-white">Halvér poeng</h4>
            </div>
            <p className="text-xs text-gray-400">
              Rask løsning dersom halltiden snart er ute. Halvér målscoren (f.eks. fra 24p til 12p) for resterende kamper.
            </p>
          </div>

          <div className="bg-[#141414] p-4 rounded-2xl border border-gray-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#BFFF00]/15 text-[#BFFF00] border border-[#BFFF00]/30 flex items-center justify-center text-xs shrink-0">
                <Edit3 className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-white">Korriger kamper</h4>
            </div>
            <p className="text-xs text-gray-400">
              Registrerte du feil score eller klokkeslett? Trykk «Korriger» for å oppdatere tallene – tabellen oppdateres umiddelbart.
            </p>
          </div>
        </div>
      </div>

      {/* SØK & FAQ SEKSJON */}
      <div className="bg-[#141414] p-4 sm:p-6 rounded-3xl border border-gray-800 shadow-xl space-y-4">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white">Spørsmål & Svar</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Søk etter nøkkelord eller filtrer på tema nedenfor.
          </p>
        </div>

        {/* Søkefelt */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Søk i spørsmål og svar (f.eks. baner, pause, poeng, installere)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black border border-gray-800 text-white rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:border-[#BFFF00]"
          />
        </div>

        {/* Kategori-knapper */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold transition text-center ${
                selectedCategory === cat.id
                  ? 'bg-[#BFFF00] text-black font-extrabold'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* FAQ Spørsmålsliste */}
        <div className="space-y-2.5 pt-2">
          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center bg-gray-900/40 rounded-2xl border border-gray-800">
              <p className="text-gray-400 text-xs">Ingen spørsmål matcher &quot;{searchQuery}&quot;.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                className="mt-3 text-xs text-[#BFFF00] font-bold hover:underline"
              >
                Nullstill
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
                    className="w-full text-left p-4 flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-white"
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

      {/* DATABASE, BACKUP & GJENOPPRETTING (KUN ADMINISTRATOR) */}
      {isAdmin && (
        <div className="bg-gradient-to-br from-[#151a14] via-[#141414] to-black p-5 sm:p-7 rounded-3xl border-2 border-[#BFFF00]/30 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800/80">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#BFFF00] text-black flex items-center justify-center font-extrabold shrink-0 shadow-[0_0_20px_rgba(191,255,0,0.35)]">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  Database & Sikkerhetskopi
                  <span className="px-2 py-0.5 bg-[#BFFF00]/20 text-[#BFFF00] text-[10px] font-mono font-extrabold rounded-lg">
                    Kun Admin
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Lokal SQLite-database under <span className="font-mono text-[#BFFF00]">/prisma/padel.db</span>. Kun administrator har tilgang til å laste opp eller ned backup.
                </p>
              </div>
            </div>
          </div>

          {/* TO KOLONNER: EKSPORT / NEDLASTING & IMPORT / GJENOPPRETTING */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* VENSTRE: LAST NED SIKKERHETSKOPI */}
            <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-gray-800 space-y-3.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                  <Download className="w-4 h-4 text-[#BFFF00]" />
                  <span>Last ned backup</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Eksporter alle data som en portabel JSON-fil (.json). Inneholder alle spillere, turneringer, kamper og ligaer.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenDownloadModal}
                  className="w-full bg-[#BFFF00] text-black py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_15px_rgba(191,255,0,0.25)]"
                >
                  <FileJson className="w-4 h-4 fill-current" />
                  <span>Last ned JSON</span>
                </button>
              </div>
            </div>

            {/* HØYRE: LAST OPP OG GJENOPPRETT JSON BACKUP */}
            <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-gray-800 space-y-3.5">
              <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>Gjenopprett fra JSON</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Gjenopprett database fra en tidligere nedlastet JSON-backup ved å oppgi admin-passord.
              </p>

              <form onSubmit={handleExecuteRestore} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">
                    Velg .json backupfil:
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
                      <span>Funnet i filen:</span>
                      <span className="truncate max-w-[170px] text-white font-mono text-[11px]">{restoreFile?.name}</span>
                    </div>
                    {backupSummary.exportDate && (
                      <div className="text-[10px] text-gray-400 font-mono">
                        Eksportert: {backupSummary.exportDate}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-300 font-mono pt-1.5 border-t border-gray-800/80">
                      <div>Spillere: <span className="text-[#BFFF00] font-bold">{backupSummary.users}</span></div>
                      <div>Turneringer: <span className="text-[#BFFF00] font-bold">{backupSummary.tournaments}</span></div>
                      <div>Kamper: <span className="text-[#BFFF00] font-bold">{backupSummary.matches}</span></div>
                      <div>Ligaer: <span className="text-[#BFFF00] font-bold">{backupSummary.leagues}</span></div>
                    </div>
                  </div>
                )}

                {!isAdmin && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">
                      Admin Passord:
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={restorePassword}
                        onChange={(e) => setRestorePassword(e.target.value)}
                        placeholder="Oppgi admin-passord..."
                        className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                      />
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
                  className="w-full bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-black py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                >
                  {restoreStatus === 'loading' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gjenoppretter...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Gjenopprett</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* FARESONE / NULLSTILLING FOR ADMINISTRATOR */}
          <div className="pt-5 border-t border-gray-800/80">
            <div className="flex items-center gap-2 mb-3 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="text-xs font-black uppercase tracking-wider">Faresone & Nullstilling (Kun Administrator)</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <span className="font-extrabold text-white text-xs block">Slett alle turneringer</span>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    Tømmer all turnerings- og kamphistorikk permanent. Spillere og ligaer beholdes intakt.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAllTournamentsAction}
                  disabled={dangerActionStatus !== null}
                  className="w-full py-2.5 px-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{dangerActionStatus === 'deleting_tournaments' ? 'Sletter turneringer...' : 'Slett alle turneringer'}</span>
                </button>
              </div>

              <div className="p-4 bg-red-950/30 border border-red-800/50 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <span className="font-extrabold text-white text-xs block">Fullstendig nullstilling (Slett alt)</span>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    Sletter ALLE data i systemet: spillere, ligaer, turneringer og kamper. Databasen tilbakestilles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAllDataAction}
                  disabled={dangerActionStatus !== null}
                  className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{dangerActionStatus === 'deleting_all' ? 'Nullstiller hele systemet...' : 'Nullstill alt (Slett alt)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: OPPGI ADMIN-PASSORD FOR NEDLASTING */}
      {isAdmin && isDownloadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border-2 border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#BFFF00]/20 text-[#BFFF00] flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-white">
                  Bekreft nedlasting
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="text-gray-500 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Sikkerhetskopien inneholder alle data. Oppgi admin-passord for å bekrefte.
            </p>

            <form onSubmit={handleConfirmDownload} className="space-y-4">
              {!isAdmin && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1.5">
                    Admin Passord:
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      autoFocus
                      value={downloadPassword}
                      onChange={(e) => setDownloadPassword(e.target.value)}
                      placeholder="Skriv admin-passord..."
                      className="w-full bg-black border border-gray-700 text-white rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono focus:outline-none focus:border-[#BFFF00]"
                    />
                  </div>
                </div>
              )}

              {downloadError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isDownloading}
                  className="bg-[#BFFF00] text-black px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 hover:bg-[#b0eb00] transition active:scale-95 shadow-[0_0_15px_rgba(191,255,0,0.3)] disabled:opacity-40"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Laster ned...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Last ned</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
