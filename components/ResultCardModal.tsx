'use client';

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { 
  X, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  Trophy, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Eye,
  FileText
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import PadelLogo from './PadelLogo';
import { useTranslation } from '@/lib/i18n';

type ResultCardModalProps = {
  type: 'match' | 'tournament' | 'league';
  data: any;
  onClose: () => void;
};

// Pure helper function for filename generation
function getResultCardFileName(type: 'match' | 'tournament' | 'league'): string {
  const stamp = Math.floor(Math.random() * 100000);
  if (type === 'match') return `padelflex-kamp-${stamp}.png`;
  if (type === 'league') return `padelflex-ligatabell-${stamp}.png`;
  return `padelflex-turnering-${stamp}.png`;
}

export default function ResultCardModal({ type, data, onClose }: ResultCardModalProps) {
  const { t, isEnglish } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedType, setCopiedType] = useState<'image' | 'text' | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isLeagueCard = type === 'league';

  // Parse standalone set match if applicable
  const isStandaloneSetMatch = useMemo(() => {
    if (type !== 'match') return false;
    return Boolean(data?.scoresJson || data?.format || (data?.sets && Array.isArray(data.sets)));
  }, [type, data]);

  const parsedSets = useMemo(() => {
    if (!isStandaloneSetMatch) return [];
    if (Array.isArray(data?.sets)) return data.sets;
    if (typeof data?.scoresJson === 'string') {
      try {
        const p = JSON.parse(data.scoresJson);
        return p.sets || [];
      } catch {
        return [];
      }
    }
    return [];
  }, [isStandaloneSetMatch, data]);

  // Sortering for turnering (alltid basert på poeng, deretter seire, deretter målforskjell)
  const sortedTournamentParticipants = useMemo(() => {
    if (!data?.participants || !Array.isArray(data.participants)) return [];
    
    let enrichedParticipants = [...data.participants];
    
    if (type === 'tournament' && data.matches && Array.isArray(data.matches)) {
      const statsMap: Record<string, { scored: number; conceded: number; pctList: number[] }> = {};
      
      for (const m of data.matches) {
        if (!m.isCompleted) continue;
        const sA = m.teamAScore || 0;
        const sB = m.teamBScore || 0;
        const matchTargetScore = (sA + sB) > 0 ? (sA + sB) : (data.targetScore || 21);
        
        const addStats = (pid: string, myScore: number, oppScore: number) => {
          if (!statsMap[pid]) statsMap[pid] = { scored: 0, conceded: 0, pctList: [] };
          statsMap[pid].scored += myScore;
          statsMap[pid].conceded += oppScore;
          const matchPct = matchTargetScore > 0 ? Math.min(100, (myScore / matchTargetScore) * 100) : 50;
          statsMap[pid].pctList.push(matchPct);
        };
        
        if (m.teamAPlayer1Id) addStats(m.teamAPlayer1Id, sA, sB);
        if (m.teamAPlayer2Id) addStats(m.teamAPlayer2Id, sA, sB);
        if (m.teamBPlayer1Id) addStats(m.teamBPlayer1Id, sB, sA);
        if (m.teamBPlayer2Id) addStats(m.teamBPlayer2Id, sB, sA);
      }
      
      enrichedParticipants = enrichedParticipants.map(p => {
        const pStats = statsMap[p.userId];
        if (pStats) {
          const avgPointPct = pStats.pctList.length > 0 
            ? Math.round(pStats.pctList.reduce((a, b) => a + b, 0) / pStats.pctList.length)
            : 50;
          const matchesPlayed = (p.matchesWon || 0) + (p.matchesDrawn || 0) + (p.matchesLost || 0);
          const winRatePct = matchesPlayed > 0 
            ? Math.round((((p.matchesWon || 0) + (p.matchesDrawn || 0) * 0.5) / matchesPlayed) * 100)
            : 0;
            
          return {
            ...p,
            pointsScored: pStats.scored,
            pointsConceded: pStats.conceded,
            avgPointPct,
            winRatePct,
            matchesPlayed
          };
        }
        return p;
      });
    }

    return enrichedParticipants.sort((a: any, b: any) => {
      // 1. Total poeng
      const pA = Number(a.totalPoints) || 0;
      const pB = Number(b.totalPoints) || 0;
      if (pB !== pA) return pB - pA;

      // 2. Seire
      const wA = Number(a.matchesWon) || 0;
      const wB = Number(b.matchesWon) || 0;
      if (wB !== wA) return wB - wA;

      // 3. Målforskjell
      const diffA = (Number(a.pointsScored) || 0) - (Number(a.pointsConceded) || 0);
      const diffB = (Number(b.pointsScored) || 0) - (Number(b.pointsConceded) || 0);
      if (diffB !== diffA) return diffB - diffA;

      return (a.user?.name || '').localeCompare(b.user?.name || '', 'no');
    });
  }, [data, type]);

  // Lag A / Lag B navn hjelpere
  const teamAPlayer1Name = typeof data?.teamAPlayer1 === 'object' ? data?.teamAPlayer1?.name : data?.teamAPlayer1 || 'Spiller 1';
  const teamAPlayer2Name = typeof data?.teamAPlayer2 === 'object' ? data?.teamAPlayer2?.name : data?.teamAPlayer2 || 'Spiller 2';
  const teamBPlayer1Name = typeof data?.teamBPlayer1 === 'object' ? data?.teamBPlayer1?.name : data?.teamBPlayer1 || 'Spiller 1';
  const teamBPlayer2Name = typeof data?.teamBPlayer2 === 'object' ? data?.teamBPlayer2?.name : data?.teamBPlayer2 || 'Spiller 2';

  const teamAWonStandalone = data?.winnerTeam === 'A';
  const teamBWonStandalone = data?.winnerTeam === 'B';

  // Build clean text summary for WhatsApp / SMS / Messenger sharing
  const textSummary = useMemo(() => {
    const today = new Date().toLocaleDateString(isEnglish ? 'en-US' : 'no-NB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (type === 'match') {
      if (isStandaloneSetMatch) {
        const setsText = parsedSets.map((s: any) => `${s.teamA}-${s.teamB}`).join(', ');
        const winner = teamAWonStandalone ? `${teamAPlayer1Name} & ${teamAPlayer2Name}` : `${teamBPlayer1Name} & ${teamBPlayer2Name}`;
        return isEnglish
          ? `🎾 PADEL RESULT (${today}) 🎾\n\n${teamAPlayer1Name} & ${teamAPlayer2Name} vs ${teamBPlayer1Name} & ${teamBPlayer2Name}\nSets: ${setsText || 'Completed'}\nWinner: 🏆 ${winner}\n\nPlayed via PadelFlex`
          : `🎾 PADEL RESULTAT (${today}) 🎾\n\n${teamAPlayer1Name} & ${teamAPlayer2Name} vs ${teamBPlayer1Name} & ${teamBPlayer2Name}\nSett: ${setsText || 'Fullført'}\nVinner: 🏆 ${winner}\n\nSpilt via PadelFlex`;
      } else {
        const sA = data?.teamAScore ?? 0;
        const sB = data?.teamBScore ?? 0;
        const winner = sA > sB ? `${teamAPlayer1Name} & ${teamAPlayer2Name}` : sB > sA ? `${teamBPlayer1Name} & ${teamBPlayer2Name}` : (isEnglish ? 'Draw' : 'Uavgjort');
        return isEnglish
          ? `🎾 PADEL RESULT (${today}) 🎾\n\nTeam A (${sA}pts): ${teamAPlayer1Name} & ${teamAPlayer2Name}\nTeam B (${sB}pts): ${teamBPlayer1Name} & ${teamBPlayer2Name}\nWinner: 🏆 ${winner}\n\nPlayed via PadelFlex`
          : `🎾 PADEL RESULTAT (${today}) 🎾\n\nLag A (${sA}p): ${teamAPlayer1Name} & ${teamAPlayer2Name}\nLag B (${sB}p): ${teamBPlayer1Name} & ${teamBPlayer2Name}\nVinner: 🏆 ${winner}\n\nSpilt via PadelFlex`;
      }
    } else if (isLeagueCard) {
      const topList = (data?.participants || []).slice(0, 5).map((p: any, i: number) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `${medal} ${p.user?.name || (isEnglish ? 'Player' : 'Spiller')} - Rating: ${Math.round(p.eloRating || 1500)}`;
      }).join('\n');
      return isEnglish
        ? `🏅 LEAGUE STANDINGS: ${data?.name || 'League'} (${today}) 🏅\n\n${topList}\n\nSee full standings on PadelFlex`
        : `🏅 LIGATABELL: ${data?.name || 'Liga'} (${today}) 🏅\n\n${topList}\n\nSe full oversikt på PadelFlex`;
    } else {
      const topList = sortedTournamentParticipants.slice(0, 5).map((p: any, i: number) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return isEnglish
          ? `${medal} ${p.user?.name || 'Player'}: ${p.totalPoints || 0} pts (${p.matchesWon || 0}W-${p.matchesDrawn || 0}D-${p.matchesLost || 0}L)`
          : `${medal} ${p.user?.name || 'Spiller'}: ${p.totalPoints || 0} poeng (${p.matchesWon || 0}V-${p.matchesDrawn || 0}U-${p.matchesLost || 0}T)`;
      }).join('\n');
      return isEnglish
        ? `🏆 TOURNAMENT RESULTS: ${data?.name || 'Tournament'} (${today}) 🏆\n\n${topList}\n\nPlayed via PadelFlex`
        : `🏆 TURNERINGSRESULTAT: ${data?.name || 'Turnering'} (${today}) 🏆\n\n${topList}\n\nSpilt via PadelFlex`;
    }
  }, [type, isEnglish, isLeagueCard, isStandaloneSetMatch, data, parsedSets, teamAWonStandalone, teamAPlayer1Name, teamAPlayer2Name, teamBPlayer1Name, teamBPlayer2Name, sortedTournamentParticipants]);

  // Direct 2D Canvas Fallback Renderer in case DOM-to-image library hits an edge case
  const renderCanvasFallback = useCallback(async (): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 800, 1000);
    bgGradient.addColorStop(0, '#0f110d');
    bgGradient.addColorStop(0.5, '#141712');
    bgGradient.addColorStop(1, '#0a0c0a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 800, 1000);

    // Neon Accent Border
    ctx.strokeStyle = 'rgba(191, 255, 0, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 760, 960);

    // Top Header: PADEL + FLEX
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('PADEL', 50, 85);
    ctx.fillStyle = '#BFFF00';
    ctx.fillText('FLEX', 190, 85);

    // Date
    ctx.fillStyle = '#888888';
    ctx.font = '20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString('no-NB', { day: '2-digit', month: 'short', year: 'numeric' }), 750, 85);
    ctx.textAlign = 'left';

    // Divider
    ctx.strokeStyle = '#282828';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 115);
    ctx.lineTo(750, 115);
    ctx.stroke();

    // Title / Card Type
    ctx.fillStyle = '#BFFF00';
    ctx.font = 'bold 24px sans-serif';
    const cardTitle = type === 'match' 
      ? (isEnglish ? 'MATCH RESULT' : 'KAMPRESULTAT') 
      : isLeagueCard 
      ? (isEnglish ? 'LEAGUE RATING & STANDINGS' : 'LIGARATING & TABELL') 
      : (isEnglish ? 'TOURNAMENT RESULTS' : 'TURNERINGSRESULTAT');
    ctx.fillText(cardTitle, 50, 160);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px sans-serif';
    const subTitle = data?.name || (type === 'match' ? (isEnglish ? 'Padel Match' : 'Padelkamp') : (isEnglish ? 'Tournament' : 'Turnering'));
    ctx.fillText(subTitle.length > 32 ? subTitle.substring(0, 30) + '...' : subTitle, 50, 205);

    if (type === 'match') {
      // Draw Match Box
      const sA = data?.teamAScore ?? 0;
      const sB = data?.teamBScore ?? 0;
      
      // Team A Box
      ctx.fillStyle = '#182012';
      ctx.fillRect(50, 250, 700, 180);
      ctx.strokeStyle = sA >= sB ? '#BFFF00' : '#333333';
      ctx.strokeRect(50, 250, 700, 180);

      ctx.fillStyle = '#BFFF00';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText((isEnglish ? 'TEAM A' : 'LAG A') + (sA > sB ? (isEnglish ? ' (Winner 🏆)' : ' (Vinner 🏆)') : ''), 75, 290);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`${teamAPlayer1Name} & ${teamAPlayer2Name}`, 75, 340);
      ctx.fillStyle = '#BFFF00';
      ctx.font = 'bold 50px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${sA}p`, 720, 360);
      ctx.textAlign = 'left';

      // Team B Box
      ctx.fillStyle = '#101c22';
      ctx.fillRect(50, 460, 700, 180);
      ctx.strokeStyle = sB >= sA ? '#22d3ee' : '#333333';
      ctx.strokeRect(50, 460, 700, 180);

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText((isEnglish ? 'TEAM B' : 'LAG B') + (sB > sA ? (isEnglish ? ' (Winner 🏆)' : ' (Vinner 🏆)') : ''), 75, 500);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`${teamBPlayer1Name} & ${teamBPlayer2Name}`, 75, 550);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 50px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${sB}p`, 720, 570);
      ctx.textAlign = 'left';
    } else {
      // Draw Table (Tournament / League)
      const list = isLeagueCard ? (data?.participants || []).slice(0, 8) : sortedTournamentParticipants.slice(0, 8);
      let y = 260;
      list.forEach((p: any, idx: number) => {
        const isWinner = idx === 0;
        ctx.fillStyle = isWinner ? '#1c2613' : '#141414';
        ctx.fillRect(50, y, 700, 65);
        ctx.strokeStyle = isWinner ? '#BFFF00' : '#262626';
        ctx.lineWidth = isWinner ? 2 : 1;
        ctx.strokeRect(50, y, 700, 65);

        // Rank Badge
        ctx.fillStyle = isWinner ? '#BFFF00' : '#333333';
        ctx.fillRect(65, y + 15, 36, 36);
        ctx.fillStyle = isWinner ? '#000000' : '#FFFFFF';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${idx + 1}`, 83, y + 40);
        ctx.textAlign = 'left';

        // Player Name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = isWinner ? 'bold 22px sans-serif' : '20px sans-serif';
        const pName = p.user?.name || (isEnglish ? 'Player' : 'Spiller');
        ctx.fillText(pName.length > 22 ? pName.substring(0, 20) + '...' : pName, 120, y + 40);

        // Stats / Points
        ctx.textAlign = 'right';
        if (isLeagueCard) {
          const rating = Math.round(p.eloRating || 1500);
          ctx.fillStyle = '#BFFF00';
          ctx.font = 'bold 24px monospace';
          ctx.fillText(`${rating} R`, 720, y + 42);
        } else {
          ctx.fillStyle = '#888888';
          ctx.font = '16px monospace';
          const recordStr = isEnglish
            ? `${p.matchesWon || 0}W-${p.matchesDrawn || 0}D-${p.matchesLost || 0}L`
            : `${p.matchesWon || 0}V-${p.matchesDrawn || 0}U-${p.matchesLost || 0}T`;
          ctx.fillText(recordStr, 600, y + 40);
          ctx.fillStyle = '#BFFF00';
          ctx.font = 'bold 26px monospace';
          ctx.fillText(`${p.totalPoints || 0}p`, 720, y + 42);
        }
        ctx.textAlign = 'left';

        y += 75;
      });
    }

    // Footer
    ctx.fillStyle = '#666666';
    ctx.font = '18px monospace';
    ctx.fillText('padelflex.ev1.me', 50, 940);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#BFFF00';
    ctx.fillText('PadelFlex', 750, 940);
    ctx.textAlign = 'left';

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }, [type, isEnglish, isLeagueCard, data, teamAPlayer1Name, teamAPlayer2Name, teamBPlayer1Name, teamBPlayer2Name, sortedTournamentParticipants]);

  // Robust PNG Generator with fallback chain
  const generatePngBlob = useCallback(async (): Promise<Blob | null> => {
    // Attempt 1: html-to-image with skipFonts
    if (cardRef.current) {
      try {
        const blob = await toBlob(cardRef.current, {
          pixelRatio: 2,
          skipFonts: true,
          cacheBust: true,
          backgroundColor: '#0c0c0c',
          filter: (node) => {
            if (node instanceof HTMLElement && node.classList.contains('no-export')) {
              return false;
            }
            return true;
          }
        });
        if (blob && blob.size > 100) return blob;
      } catch (err) {
        console.warn('html-to-image toBlob warning:', err);
      }

      // Attempt 2: html-to-image toPng -> blob
      try {
        const dataUrl = await toPng(cardRef.current, {
          pixelRatio: 2,
          skipFonts: true,
          cacheBust: true,
          backgroundColor: '#0c0c0c'
        });
        if (dataUrl && dataUrl.startsWith('data:image')) {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          if (blob && blob.size > 100) return blob;
        }
      } catch (err) {
        console.warn('html-to-image toPng warning:', err);
      }
    }

    // Attempt 3: Pure 2D Canvas Fallback (100% reliable)
    try {
      const fallbackBlob = await renderCanvasFallback();
      if (fallbackBlob) return fallbackBlob;
    } catch (err) {
      console.error('Canvas fallback warning:', err);
    }

    return null;
  }, [renderCanvasFallback]);

  // Trigger download with iOS/iframe safety
  const triggerDownloadOrPreview = useCallback(async (blob: Blob, fileName: string) => {
    try {
      const url = URL.createObjectURL(blob);
      setPreviewImageUrl(url);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
        } catch {}
      }, 200);
    } catch (e: any) {
      console.error('Download trigger error:', e);
      setShowPreview(true);
    }
  }, []);

  // Handle Share (Web Share with fallback)
  const handleShare = async () => {
    setShareError(null);
    setIsExporting(true);
    try {
      const blob = await generatePngBlob();
      if (!blob) throw new Error('Kunne ikke generere resultatbilde');

      const fileName = getResultCardFileName(type);
      const file = new File([blob], fileName, { type: 'image/png' });

      let shared = false;
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: type === 'match' ? 'PadelFlex Kampresultat' : isLeagueCard ? 'PadelFlex Ligatabell' : 'PadelFlex Turneringsresultat',
            text: textSummary
          });
          shared = true;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            setIsExporting(false);
            return;
          }
          console.warn('File share failed, trying text share or download fallback:', shareErr);
        }
      }

      if (!shared) {
        await triggerDownloadOrPreview(blob, fileName);
      }
    } catch (err: any) {
      console.error('Share action error:', err);
      setShareError('Kunne ikke dele direkte. Bildet ble lastet ned eller kan kopieres under.');
      const fallbackBlob = await generatePngBlob();
      if (fallbackBlob) {
        await triggerDownloadOrPreview(fallbackBlob, 'padelflex-resultat.png');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Download Handler
  const handleDownload = async () => {
    setShareError(null);
    setIsExporting(true);
    try {
      const blob = await generatePngBlob();
      if (!blob) throw new Error('Kunne ikke generere bilde');

      const fileName = getResultCardFileName(type);
      await triggerDownloadOrPreview(blob, fileName);
    } catch (err: any) {
      console.error('Direct download error:', err);
      setShareError('Kunne ikke starte automatisk nedlasting. Bruk "Kopier" eller se bilde under.');
      setShowPreview(true);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy (Tries Image first, falls back to formatted Text)
  const handleCopy = async () => {
    setShareError(null);
    setIsExporting(true);
    try {
      const blob = await generatePngBlob();
      
      let copiedImage = false;
      if (blob && typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          copiedImage = true;
          setCopiedType('image');
          setTimeout(() => setCopiedType(null), 3000);
        } catch (clipErr) {
          console.warn('Image clipboard write failed, falling back to text:', clipErr);
        }
      }

      if (!copiedImage) {
        // Fallback: Copy clean formatted text
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(textSummary);
          setCopiedType('text');
          setTimeout(() => setCopiedType(null), 3000);
        } else {
          if (blob) {
            await triggerDownloadOrPreview(blob, 'padelflex-resultat.png');
          }
        }
      }
    } catch (err: any) {
      console.error('Copy error:', err);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(textSummary);
          setCopiedType('text');
          setTimeout(() => setCopiedType(null), 3000);
        } catch {
          setShareError('Kunne ikke kopiere til utklippstavle.');
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Generate preview URL on modal mount
  useEffect(() => {
    let active = true;
    const makeInitialPreview = async () => {
      try {
        const b = await generatePngBlob();
        if (b && active) {
          setPreviewImageUrl(URL.createObjectURL(b));
        }
      } catch {}
    };
    const t = setTimeout(makeInitialPreview, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [generatePngBlob]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Clickable Backdrop */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-md" 
        onClick={onClose}
      />
      
      {/* Floating Close Button for Mobile */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-50 p-3 bg-gray-900/80 text-white rounded-full border border-gray-700 backdrop-blur-sm hover:bg-gray-800 transition shadow-xl lg:hidden"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="bg-[#141414] border border-gray-800 rounded-3xl max-w-lg w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative z-10 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-[#BFFF00]" />
            <h3 className="font-extrabold text-base sm:text-lg">
              {type === 'match' 
                ? (isEnglish ? 'Match Result Card' : 'Resultatbilde for kamp') 
                : isLeagueCard 
                ? (isEnglish ? 'League Standings Card' : 'Ligatabell bilde') 
                : (isEnglish ? 'Tournament Result Card' : 'Turneringsresultat')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-gray-850 transition cursor-pointer"
            aria-label={t.common.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {shareError && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
            {shareError}
          </div>
        )}

        {/* ================= RESULT CARD CANVAS (Captured as High-Res PNG) ================= */}
        <div className="flex justify-center overflow-x-auto py-1">
          <div
            ref={cardRef}
            className="w-[360px] sm:w-[420px] bg-gradient-to-br from-[#0f110d] via-[#121411] to-[#0a0c0a] border border-[#BFFF00]/30 rounded-3xl p-5 sm:p-6 text-white space-y-4 shadow-2xl relative overflow-hidden"
            style={{
              boxShadow: '0 0 40px rgba(0,0,0,0.8), inset 0 0 20px rgba(191,255,0,0.03)'
            }}
          >
            {/* Ambient Background Accents */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#BFFF00]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Top Branding with PadelLogo */}
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
              <PadelLogo size="sm" showText={true} />

              <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-500" />
                {new Date().toLocaleDateString('no-NB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>

            {/* ================= 1. ORDINÆR KAMP (SETS & GAMES SCOREBOARD) ================= */}
            {type === 'match' && isStandaloneSetMatch && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <span className="px-2.5 py-0.5 bg-gray-900 border border-gray-800 text-gray-300 font-mono text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {data?.format === 'BEST_OF_3' ? 'Best av 3 sett' : data?.format === 'BEST_OF_3_SUPER_TB' ? 'Super-Tiebreak' : 'Ordinær Kamp'}
                  </span>
                  <h4 className="text-sm font-extrabold text-white truncate mt-1">
                    {data.name || (isEnglish ? 'Padel Match' : 'Padelkamp')}
                  </h4>
                </div>

                {/* Score Table */}
                <div className="bg-black/60 border border-gray-800 rounded-2xl p-3.5 space-y-2.5">
                  {/* LAG A */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    teamAWonStandalone 
                      ? 'bg-gradient-to-r from-[#1c2613] via-[#161d0f] to-black/40 border-[#BFFF00]/60' 
                      : 'bg-black/30 border-gray-800/70'
                  }`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-[#BFFF00] px-1 py-0.2 bg-[#BFFF00]/10 rounded">
                          {isEnglish ? 'Team A' : 'Lag A'}
                        </span>
                        {teamAWonStandalone && (
                          <span className="text-[9px] font-extrabold bg-[#BFFF00] text-black px-1.5 py-0.2 rounded uppercase">
                            {isEnglish ? 'Winner 🏆' : 'Vinner 🏆'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-white truncate mt-1">
                        {teamAPlayer1Name} & {teamAPlayer2Name}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0">
                      {parsedSets.map((s: any, idx: number) => (
                        <div 
                          key={idx} 
                          className={`w-7 h-8 rounded-lg flex items-center justify-center text-sm font-black ${
                            s.teamA > s.teamB 
                              ? 'bg-[#BFFF00] text-black shadow-sm' 
                              : 'bg-gray-900 text-gray-400 border border-gray-800'
                          }`}
                        >
                          {s.teamA}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LAG B */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    teamBWonStandalone 
                      ? 'bg-gradient-to-r from-[#0e2229] via-[#0a161b] to-black/40 border-cyan-400/60' 
                      : 'bg-black/30 border-gray-800/70'
                  }`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-cyan-400 px-1 py-0.2 bg-cyan-500/10 rounded">
                          {isEnglish ? 'Team B' : 'Lag B'}
                        </span>
                        {teamBWonStandalone && (
                          <span className="text-[9px] font-extrabold bg-cyan-400 text-black px-1.5 py-0.2 rounded uppercase">
                            {isEnglish ? 'Winner 🏆' : 'Vinner 🏆'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-white truncate mt-1">
                        {teamBPlayer1Name} & {teamBPlayer2Name}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0">
                      {parsedSets.map((s: any, idx: number) => (
                        <div 
                          key={idx} 
                          className={`w-7 h-8 rounded-lg flex items-center justify-center text-sm font-black ${
                            s.teamB > s.teamA 
                              ? 'bg-cyan-400 text-black shadow-sm' 
                              : 'bg-gray-900 text-gray-400 border border-gray-800'
                          }`}
                        >
                          {s.teamB}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= 2. AMERICANO TURNERINGSKAMP ================= */}
            {type === 'match' && !isStandaloneSetMatch && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <span className="px-2.5 py-0.5 bg-gray-900 border border-gray-800 text-gray-300 font-mono text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {data?.courtNumber 
                      ? (isEnglish ? `Court ${data.courtNumber} • Match completed` : `Bane ${data.courtNumber} • Kampfullført`) 
                      : (isEnglish ? 'Match Result' : 'Kampresultat')}
                  </span>
                  {data?.tournament?.name && (
                    <h4 className="text-xs font-bold text-gray-400 truncate mt-1">
                      {data.tournament.name}
                    </h4>
                  )}
                </div>

                {/* Score Showcase */}
                <div className="grid grid-cols-2 gap-3 relative">
                  {/* LAG A */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    data?.teamAScore > data?.teamBScore
                      ? 'bg-gradient-to-b from-[#1b2612] to-[#121a0c] border-[#BFFF00]/60 shadow-[0_0_20px_rgba(191,255,0,0.15)]'
                      : 'bg-black/40 border-gray-800/80'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#BFFF00]">
                        {isEnglish ? 'Team A' : 'Lag A'}
                      </span>
                      {data?.teamAScore > data?.teamBScore && (
                        <span className="px-1.5 py-0.2 bg-[#BFFF00] text-black text-[9px] font-extrabold rounded uppercase">
                          {isEnglish ? 'Winner' : 'Vinner'}
                        </span>
                      )}
                    </div>

                    <div className="text-3xl font-mono font-black text-[#BFFF00] my-1">
                      {data?.teamAScore}p
                    </div>

                    <div className="space-y-0.5 text-xs font-bold text-white leading-tight">
                      <div className="truncate">{teamAPlayer1Name}</div>
                      <div className="truncate">{teamAPlayer2Name}</div>
                    </div>

                    {data?.eloDelta !== undefined && data?.eloDelta !== null && data?.eloDelta !== 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-800/60 flex items-center gap-1 font-mono text-[10px]">
                        {data?.teamAScore > data?.teamBScore ? (
                          <span className="text-green-400 font-bold flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" /> +{Math.abs(data.eloDelta)}
                          </span>
                        ) : (
                          <span className="text-red-400 font-bold flex items-center gap-0.5">
                            <TrendingDown className="w-3 h-3" /> -{Math.abs(data.eloDelta)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* LAG B */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    data?.teamBScore > data?.teamAScore
                      ? 'bg-gradient-to-b from-[#0e2229] to-[#0a161b] border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.15)]'
                      : 'bg-black/40 border-gray-800/80'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                        {isEnglish ? 'Team B' : 'Lag B'}
                      </span>
                      {data?.teamBScore > data?.teamAScore && (
                        <span className="px-1.5 py-0.2 bg-cyan-400 text-black text-[9px] font-extrabold rounded uppercase">
                          {isEnglish ? 'Winner' : 'Vinner'}
                        </span>
                      )}
                    </div>

                    <div className="text-3xl font-mono font-black text-cyan-400 my-1">
                      {data?.teamBScore}p
                    </div>

                    <div className="space-y-0.5 text-xs font-bold text-white leading-tight">
                      <div className="truncate">{teamBPlayer1Name}</div>
                      <div className="truncate">{teamBPlayer2Name}</div>
                    </div>

                    {data?.eloDelta !== undefined && data?.eloDelta !== null && data?.eloDelta !== 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-800/60 flex items-center gap-1 font-mono text-[10px]">
                        {data?.teamBScore > data?.teamAScore ? (
                          <span className="text-green-400 font-bold flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" /> +{Math.abs(data.eloDelta)}
                          </span>
                        ) : (
                          <span className="text-red-400 font-bold flex items-center gap-0.5">
                            <TrendingDown className="w-3 h-3" /> -{Math.abs(data.eloDelta)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= 3. LIGATABELL RESULTATKORT ================= */}
            {type !== 'match' && isLeagueCard && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[#BFFF00]">
                    <Trophy className="w-5 h-5 fill-current" />
                    <span className="font-extrabold text-xs uppercase tracking-widest">
                      Ligarating & Tabell
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-white truncate">
                    {data?.name || 'Liga'}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-mono">
                    {data?.participants?.length || 0} spillere
                  </p>
                </div>

                {/* Top List for League: Rating, Score %, Seier % */}
                <div className="space-y-1.5">
                  {(data?.participants || []).slice(0, 8).map((p: any, index: number) => {
                    const isLeader = index === 0;
                    const rating = Math.round(p.eloRating || 1500);
                    const winPct = p.winRatePct !== undefined 
                      ? p.winRatePct 
                      : (p.matchesPlayed > 0 ? Math.round((p.matchesWon / p.matchesPlayed) * 100) : 0);
                    const scorePct = p.avgPointPct !== undefined
                      ? p.avgPointPct
                      : (p.pointsScored && p.pointsConceded ? Math.round((p.pointsScored / (p.pointsScored + p.pointsConceded)) * 100) : 50);

                    return (
                      <div
                        key={p.userId || index}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                          isLeader 
                            ? 'bg-gradient-to-r from-[#1c2613] via-[#161d0f] to-transparent border-[#BFFF00]/60'
                            : index === 1
                            ? 'bg-gray-900/70 border-gray-700/80'
                            : index === 2
                            ? 'bg-gray-900/50 border-amber-800/40'
                            : 'bg-black/30 border-gray-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                            isLeader
                              ? 'bg-[#BFFF00] text-black shadow-[0_0_10px_rgba(191,255,0,0.5)]'
                              : index === 1
                              ? 'bg-gray-300 text-black'
                              : index === 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-800 text-gray-400'
                          }`}>
                            {index + 1}
                          </span>

                          <span className={`text-xs truncate ${isLeader ? 'font-black text-white' : 'font-bold text-gray-200'}`}>
                            {p.user?.name || 'Spiller'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] sm:text-xs text-right">
                          <span className="text-cyan-300 font-bold hidden sm:inline-block">
                            {scorePct}% <span className="text-[9px] text-gray-500 font-normal">score</span>
                          </span>
                          <span className="text-gray-300 font-bold">
                            {winPct}% <span className="text-[9px] text-gray-500 font-normal">seier</span>
                          </span>
                          <span className="font-extrabold text-[#BFFF00] text-sm min-w-[50px] text-right">
                            {rating} <span className="text-[9px] sm:text-[10px] text-gray-400 font-normal block sm:inline">Rating</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================= 4. TURNERING RESULTATKORT (BASERT PÅ POENG & SEIRE) ================= */}
            {type !== 'match' && !isLeagueCard && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[#BFFF00]">
                    <Trophy className="w-5 h-5 fill-current" />
                    <span className="font-extrabold text-xs uppercase tracking-widest">
                      Turneringsresultat
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white truncate">
                    {data?.name || 'Turnering'}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-mono">
                    {sortedTournamentParticipants.length} spillere • {data?.matches?.filter((m: any) => m.isCompleted)?.length || 0} kamper fullført
                  </p>
                </div>

                {/* Podium / Top List (Ordered strictly by Total Points, then Wins, then Point Diff) */}
                <div className="space-y-1.5">
                  {sortedTournamentParticipants.slice(0, 8).map((p: any, index: number) => {
                    const isWinner = index === 0 && (p.totalPoints > 0 || p.matchesWon > 0);
                    return (
                      <div
                        key={p.userId || p.id || index}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          isWinner 
                            ? 'bg-gradient-to-r from-[#1c2613] via-[#161d0f] to-transparent border-[#BFFF00]/70 shadow-[0_0_15px_rgba(191,255,0,0.15)]'
                            : index === 1
                            ? 'bg-gray-900/70 border-gray-700/80'
                            : index === 2
                            ? 'bg-gray-900/50 border-amber-800/40'
                            : 'bg-black/30 border-gray-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                            isWinner
                              ? 'bg-[#BFFF00] text-black shadow-[0_0_10px_rgba(191,255,0,0.5)]'
                              : index === 1
                              ? 'bg-gray-300 text-black'
                              : index === 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-800 text-gray-400'
                          }`}>
                            {index + 1}
                          </span>

                          <span className={`text-xs truncate ${isWinner ? 'font-black text-white' : 'font-bold text-gray-200'}`}>
                            {p.user?.name || 'Spiller'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                          <span className="text-gray-400 text-[10px]">
                            <strong className="text-green-400">{p.matchesWon || 0}</strong>V -{' '}
                            <strong className="text-amber-400">{p.matchesDrawn || 0}</strong>U -{' '}
                            <strong className="text-red-400">{p.matchesLost || 0}</strong>T
                          </span>
                          <div className="text-right min-w-[48px]">
                            <span className="font-black text-[#BFFF00] text-base">
                              {p.totalPoints || 0}
                            </span>
                            <span className="text-[10px] text-gray-500 font-normal ml-0.5">p</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Badge */}
            <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between text-[10px] text-gray-500 font-mono">
              <span className="text-gray-400">padelflex.ev1.me</span>
              <span className="text-[#BFFF00] font-bold">PadelFlex</span>
            </div>
          </div>
        </div>

        {/* Actions Buttons: Del bilde, Last ned & Kopier */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={handleShare}
            disabled={isExporting}
            className="py-3 bg-[#BFFF00] hover:bg-[#b0eb00] text-black rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-[0_0_20px_rgba(191,255,0,0.3)] disabled:opacity-50 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{isExporting ? (isEnglish ? 'Generating...' : 'Genererer...') : (isEnglish ? 'Share Image' : 'Del bilde')}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="py-3 bg-gray-800 hover:bg-gray-750 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isEnglish ? 'Download' : 'Last ned'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={isExporting}
            className="py-3 bg-gray-900 hover:bg-gray-850 text-gray-300 hover:text-white border border-gray-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {copiedType === 'image' ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400">{isEnglish ? 'Image copied!' : 'Bilde kopiert!'}</span>
              </>
            ) : copiedType === 'text' ? (
              <>
                <FileText className="w-4 h-4 text-green-400" />
                <span className="text-green-400">{isEnglish ? 'Text copied!' : 'Tekst kopiert!'}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{isEnglish ? 'Copy' : 'Kopier'}</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile helper hint / preview trigger */}
        {previewImageUrl && (
          <div className="pt-2 text-center border-t border-gray-800/60">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-[11px] text-gray-400 hover:text-[#BFFF00] font-mono inline-flex items-center gap-1 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? (isEnglish ? 'Hide preview' : 'Skjul forhåndsvisning') : (isEnglish ? 'Tip: Show image to save on mobile' : 'Tips: Vis bilde for å lagre direkte på mobil')}</span>
            </button>

            {showPreview && (
              <div className="mt-3 p-3 bg-black/80 rounded-2xl border border-gray-800 text-center space-y-2">
                <p className="text-[11px] text-gray-300">
                  📱 <strong>{isEnglish ? 'Tip for iPhone/Android:' : 'Tips for iPhone/Android:'}</strong> {isEnglish ? 'Tap and hold the image below to choose "Save Image" or "Copy" directly to camera roll!' : 'Hold fingeren inne på bildet under for å velge «Lagre bilde» eller «Kopier» direkte til kamerarull!'}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={previewImageUrl} 
                  alt="Resultatkort forhåndsvisning" 
                  className="w-full max-w-[320px] mx-auto rounded-xl border border-[#BFFF00]/30 shadow-lg"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
