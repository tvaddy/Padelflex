import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthContext';
import { I18nProvider, Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'PadelFlex',
  description: 'Mobile-first PWA for managing Padel tournaments, leagues, and Americano/Mexicano matches.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PadelFlex',
  },
  icons: {
    icon: '/icons/icon-192x192.svg',
    apple: '/icons/icon-192x192.svg',
  },
  openGraph: {
    title: 'PadelFlex',
    description: 'Mobile-first PWA for managing Padel tournaments, leagues, and Americano/Mexicano matches.',
    type: 'website',
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0A0A0A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Dynamically resolve runtime configuration on the Node.js server.
  // This allows Docker environment variables (e.g. from docker-compose.yml) to take effect
  // immediately at runtime without rebuilding the Docker container.
  const rawLang = (process.env.NEXT_PUBLIC_APP_LANGUAGE || process.env.APP_LANGUAGE || '').trim().toLowerCase();
  const runtimeLocale: Locale = rawLang.startsWith('en') ? 'en' : 'no';

  const enableTestProfile = 
    process.env.NEXT_PUBLIC_ENABLE_TEST_PROFILE === 'true' || 
    process.env.ENABLE_TEST_PROFILE === 'true' || 
    process.env.NEXT_PUBLIC_SHOW_TEST_BUTTON === 'true' ||
    process.env.SHOW_TEST_BUTTON === 'true';

  return (
    <html lang={runtimeLocale} className="overflow-x-hidden w-full max-w-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-[#0A0A0A] text-gray-100 antialiased min-h-screen selection:bg-[#BFFF00] selection:text-black overflow-x-hidden w-full max-w-full" suppressHydrationWarning>
        <I18nProvider initialLocale={runtimeLocale}>
          <AuthProvider enableTestProfile={enableTestProfile}>
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
