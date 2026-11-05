'use client';

import { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function InstallPwaPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed app)
    const isRunningStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isRunningStandalone) {
      return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);

    const timer = setTimeout(() => {
      if (isAppleDevice) {
        setIsApple(true);
        const dismissed = localStorage.getItem('pwa_dismissed_ios');
        if (!dismissed) {
          setShowBanner(true);
        }
      }
    }, 1000);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isApple) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    if (isApple) {
      localStorage.setItem('pwa_dismissed_ios', 'true');
    }
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-[#171c14] to-gray-900 border border-[#BFFF00]/40 p-3 sm:p-4 rounded-2xl mb-4 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 shadow-[0_4px_20px_rgba(191,255,0,0.15)] animate-in slide-in-from-top-2 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#BFFF00] text-black flex items-center justify-center font-extrabold shrink-0 shadow-[0_0_12px_rgba(191,255,0,0.3)]">
            <Download className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 truncate">
              {t.pwa.installApp}
              <span className="px-1.5 py-0.2 bg-[#BFFF00]/20 text-[#BFFF00] text-[9px] font-bold rounded shrink-0">
                {t.pwa.appBadge}
              </span>
            </h4>
            <p className="text-[11px] sm:text-xs text-gray-300 line-clamp-2">
              {isApple 
                ? t.pwa.iosDesc 
                : t.pwa.androidDesc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end xs:self-center">
          <button
            type="button"
            onClick={handleInstallClick}
            className="bg-[#BFFF00] hover:bg-[#b0eb00] text-black px-3.5 py-2 rounded-xl text-xs font-extrabold transition active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isApple ? t.pwa.howTo : t.pwa.install}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 text-gray-400 hover:text-white rounded-lg transition cursor-pointer"
            aria-label={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Modal Guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#141414] border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-900 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#BFFF00]/15 text-[#BFFF00] border border-[#BFFF00]/30 flex items-center justify-center mx-auto mb-2">
                <Share className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">{t.pwa.iosTitle}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{t.pwa.iosSubtitle}</p>
            </div>

            <div className="space-y-3 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#BFFF00] text-black font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <p className="text-gray-200">
                  {t.pwa.iosStep1} (<Share className="w-3.5 h-3.5 inline mx-0.5 text-[#BFFF00]" />)
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#BFFF00] text-black font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <p className="text-gray-200">
                  {t.pwa.iosStep2} (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-[#BFFF00]" />)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {t.pwa.gotIt}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
