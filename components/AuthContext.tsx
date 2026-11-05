'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, ArrowRight, UserCheck, X, RefreshCw, Layers, ShieldAlert, Sparkles, Hash, Zap } from 'lucide-react';
import PadelLogo from './PadelLogo';
import { useTranslation } from '@/lib/i18n';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  role: 'admin' | 'user' | null;
  accessCode: string;
  isAdmin: boolean;
  savedProfiles: string[];
  login: (codeOrPassword: string) => Promise<{ success: boolean; error?: string }>;
  switchProfile: (newCode: string) => Promise<{ success: boolean; error?: string }>;
  removeSavedProfile: (code: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SAVED_PROFILES_KEY = 'padelflex_saved_profiles';
const AUTH_TOKEN_KEY = 'padelflex_auth_token';
const ACCESS_CODE_KEY = 'padelflex_access_code';
const SHOW_TEST_BUTTON = process.env.NEXT_PUBLIC_ENABLE_TEST_PROFILE === 'true' || process.env.NEXT_PUBLIC_SHOW_TEST_BUTTON === 'true';

export function AuthProvider({ 
  children,
  enableTestProfile 
}: { 
  children: React.ReactNode;
  enableTestProfile?: boolean;
}) {
  const isTestEnabled = enableTestProfile !== undefined 
    ? enableTestProfile 
    : SHOW_TEST_BUTTON;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [accessCode, setAccessCode] = useState<string>('default');
  const [savedProfiles, setSavedProfiles] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(SAVED_PROFILES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (isTestEnabled && !parsed.includes('test')) {
              return ['test', ...parsed];
            }
            if (!isTestEnabled && parsed.includes('test')) {
              return parsed.filter(p => p !== 'test');
            }
            return parsed;
          }
        }
      } catch (e) {}
    }
    return isTestEnabled ? ['test'] : [];
  });

  // Load saved profiles and check current token
  useEffect(() => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    const savedCode = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_CODE_KEY) : null;

    if (savedToken) {
      fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: savedToken }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setToken(savedToken);
            setRole(data.role || (savedToken.startsWith('admin:') ? 'admin' : 'user'));
            setAccessCode(data.accessCode || savedCode || 'default');
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            setIsAuthenticated(false);
          }
        })
        .catch(() => {
          // If network error, trust stored token
          setToken(savedToken);
          setRole(savedToken.startsWith('admin:') ? 'admin' : 'user');
          setAccessCode(savedCode || 'default');
          setIsAuthenticated(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const addProfileToSaved = (code: string) => {
    if (!code || code === 'ADMIN' || code === 'default') return;
    const clean = code.trim().toLowerCase();
    setSavedProfiles((prev) => {
      const updated = Array.from(new Set([clean, ...prev])).slice(0, 10);
      try {
        localStorage.setItem(SAVED_PROFILES_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const removeSavedProfile = (code: string) => {
    const clean = code.trim().toLowerCase();
    setSavedProfiles((prev) => {
      const updated = prev.filter((p) => p !== clean);
      try {
        localStorage.setItem(SAVED_PROFILES_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const login = async (input: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(ACCESS_CODE_KEY, data.accessCode || 'default');
        setToken(data.token);
        setRole(data.role || 'user');
        setAccessCode(data.accessCode || 'default');
        setIsAuthenticated(true);

        if (data.role !== 'admin' && data.accessCode) {
          addProfileToSaved(data.accessCode);
        }

        // Trigger page refresh to ensure server components load new profile data
        window.location.reload();
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Innlogging feilet' };
      }
    } catch (err: any) {
      return { success: false, error: 'Kunne ikke koble til serveren' };
    }
  };

  const switchProfile = async (newCode: string) => {
    return await login(newCode);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(ACCESS_CODE_KEY);
    // Delete cookies
    document.cookie = 'padelflex_token=; path=/; max-age=0;';
    document.cookie = 'padelflex_code=; path=/; max-age=0;';
    setToken(null);
    setRole(null);
    setAccessCode('default');
    setIsAuthenticated(false);
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#BFFF00] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Laster PadelFlex...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen 
        onLogin={login} 
        savedProfiles={savedProfiles} 
        onRemoveProfile={removeSavedProfile}
        isTestEnabled={isTestEnabled}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      token, 
      role,
      accessCode,
      isAdmin: role === 'admin',
      savedProfiles,
      login,
      switchProfile,
      removeSavedProfile,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

type LoginScreenProps = {
  onLogin: (code: string) => Promise<{ success: boolean; error?: string }>;
  savedProfiles: string[];
  onRemoveProfile: (code: string) => void;
  isTestEnabled: boolean;
};

function LoginScreen({ onLogin, savedProfiles, onRemoveProfile, isTestEnabled }: LoginScreenProps) {
  const { t, locale, toggleLocale } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setIsSubmitting(true);
    const res = await onLogin(code.trim());
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || t.auth.invalidCode);
    }
  };

  const handleSelectSaved = async (saved: string) => {
    setCode(saved);
    setError(null);
    setIsSubmitting(true);
    const res = await onLogin(saved);
    setIsSubmitting(false);
    if (!res.success) {
      setError(res.error || t.auth.invalidCode);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-100 flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden w-full">
      <div className="w-full max-w-md bg-gradient-to-b from-[#161616] to-[#101010] p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-2xl space-y-5">
        {/* Top bar with language switcher */}
        <div className="flex justify-end -mt-1 -mr-1">
          <button
            type="button"
            onClick={toggleLocale}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-900/90 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
            title="Switch Language / Bytt språk"
          >
            <span className={locale === 'no' ? 'text-[#BFFF00] font-black' : 'text-gray-500'}>NO</span>
            <span className="text-gray-600">/</span>
            <span className={locale === 'en' ? 'text-[#BFFF00] font-black' : 'text-gray-500'}>EN</span>
          </button>
        </div>

        {/* Header with App Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center pb-1">
            <PadelLogo size="lg" showText={false} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            PADEL<span className="text-[#BFFF00]">FLEX</span>
          </h1>
          <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
            {t.common.tagline}
          </p>
        </div>

        {/* Standard Test Profile Button (Controlled by runtime enableTestProfile) */}
        {isTestEnabled && (
          <>
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#BFFF00]" /> {t.auth.standardProfile}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#BFFF00]/20 text-[#BFFF00] font-mono font-bold tracking-wide">
                  {t.auth.readyToUse}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleSelectSaved('test')}
                disabled={isSubmitting}
                id="login-test-profile-button"
                className="w-full group bg-gradient-to-r from-[#172412] via-[#131d10] to-[#0f160c] hover:from-[#1e3017] hover:to-[#172413] border-2 border-[#BFFF00]/50 hover:border-[#BFFF00] p-4 rounded-2xl flex items-center justify-between transition-all duration-200 shadow-[0_4px_20px_rgba(191,255,0,0.12)] hover:shadow-[0_4px_25px_rgba(191,255,0,0.22)] text-left active:scale-[0.98]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#BFFF00] text-black flex items-center justify-center font-black group-hover:scale-105 transition shadow-sm">
                    <Zap className="w-5 h-5 fill-black text-black" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white group-hover:text-[#BFFF00] transition">
                        {t.auth.tryTestProfile}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">
                      {t.auth.testProfileDesc}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-black/40 border border-gray-700/50 flex items-center justify-center text-gray-300 group-hover:text-[#BFFF00] group-hover:border-[#BFFF00]/50 transition shrink-0">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </div>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-800"></div>
              <span className="flex-shrink mx-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                {t.auth.orCustom}
              </span>
              <div className="flex-grow border-t border-gray-800"></div>
            </div>
          </>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#BFFF00]" /> {t.auth.inputLabel}
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                placeholder={t.auth.placeholder}
                required
                className="w-full bg-black/80 border border-gray-700 focus:border-[#BFFF00] text-white px-4 py-3 rounded-xl text-sm focus:outline-none transition font-medium"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !code.trim()}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white hover:text-[#BFFF00] py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 border border-gray-700"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.common.loading}
              </span>
            ) : (
              <>
                <span>{t.auth.loginButton}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Recent Saved Profiles */}
        {savedProfiles.length > 0 && (
          <div className="pt-3 border-t border-gray-800/80 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              {t.auth.savedProfiles}
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
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
                    onClick={() => handleSelectSaved(prof)}
                    className="px-2.5 py-1 font-mono flex items-center gap-1.5 group-hover:text-white"
                  >
                    {prof === 'test' && <Zap className="w-3 h-3 text-[#BFFF00]" />}
                    <span>{prof}</span>
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

        <div className="pt-2 border-t border-gray-800/80 flex items-center justify-center gap-2 text-[11px] text-gray-500">
          <ShieldCheck className="w-4 h-4 text-[#BFFF00]/70" />
          <span>Ingen forhåndskonfigurasjon nødvendig.</span>
        </div>
      </div>
    </div>
  );
}

