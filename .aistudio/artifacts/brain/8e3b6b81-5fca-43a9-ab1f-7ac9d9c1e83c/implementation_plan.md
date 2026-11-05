# Dynamic Runtime Environment Injection & In-App Language Switcher

A solution to allow `NEXT_PUBLIC_APP_LANGUAGE` and `NEXT_PUBLIC_ENABLE_TEST_PROFILE` to take effect dynamically at runtime in Docker without requiring image rebuilds, along with an interactive language switcher in the UI.

---

## 1. Problem Analysis & Root Cause

In Next.js App Router:
- **Build-time inlining**: Client components (`'use client'`) have `process.env.NEXT_PUBLIC_*` replaced by string literals during `npm run build` inside the Docker builder stage.
- **Runtime Docker limitation**: When passing `NEXT_PUBLIC_APP_LANGUAGE=en` or `NEXT_PUBLIC_ENABLE_TEST_PROFILE=true` under `environment:` in `docker-compose.yml`, Node.js receives them inside the runner container, but the browser JavaScript bundles (`.next/static/chunks/*.js`) already contain the hardcoded build-time values (`"no"` and `"false"`).
- **Result**: Docker runtime environment variables have zero effect on client components unless explicitly injected by the server on each request.

---

## 2. Proposed Architecture & Solution

### 2.1 Server-Side Runtime Config Injection
In `app/layout.tsx` (a Server Component executed by Node.js on every request):
1. Read runtime environment variables directly from Node's `process.env`:
   - `initialLanguage`: `(process.env.NEXT_PUBLIC_APP_LANGUAGE || process.env.APP_LANGUAGE || 'no').toLowerCase().startsWith('en') ? 'en' : 'no'`
   - `enableTestProfile`: `process.env.NEXT_PUBLIC_ENABLE_TEST_PROFILE === 'true' || process.env.ENABLE_TEST_PROFILE === 'true' || process.env.NEXT_PUBLIC_SHOW_TEST_BUTTON === 'true'`
2. Inject runtime config into client context:
   - Pass `initialLanguage` to a unified `<I18nProvider initialLanguage={...}>`.
   - Pass `enableTestProfile` directly to `<AuthProvider enableTestProfile={...}>`.
   - Optionally render a safe runtime config script `<script id="padelflex-config">window.__PADELFLEX_CONFIG__ = {...}</script>` so any client code can read it synchronously.

### 2.2 Client-Side Language Provider & In-App Switcher
In `lib/i18n.ts`:
- Create `I18nProvider` and `useTranslation()` hook that:
  - Initializes with the server's injected runtime language.
  - Checks `localStorage.getItem('padelflex_language')` if the user manually toggled their language preference in the browser.
  - Exposes `locale`, `setLocale(locale: 'no' | 'en')`, `toggleLocale()`, and the typed translation dictionary `t`.
- Add an interactive language switch button (`NO | EN`) to:
  1. The top header in `components/DashboardClient.tsx`.
  2. The login screen in `components/AuthContext.tsx`.

### 2.3 Test Profile Button Runtime Visibility
In `components/AuthContext.tsx`:
- Receive `enableTestProfile: boolean` from `app/layout.tsx`.
- Use this dynamic boolean to control whether the sample test profile button is rendered on the login screen.
- This guarantees that switching `NEXT_PUBLIC_ENABLE_TEST_PROFILE=true` in `docker-compose.yml` makes the button appear immediately upon `docker compose up -d` without needing `docker compose build`.

---

## 3. Implementation Steps

1. **Update `lib/i18n.tsx`**:
   - Convert to a React Context provider (`I18nProvider`, `useTranslation`) that accepts `initialLocale: Locale`.
   - Support `toggleLocale()` and persist user override to `localStorage`.
   - Maintain backward-compatible fallback for server or unprovided components.
2. **Update `app/layout.tsx`**:
   - Read Node runtime variables `process.env.NEXT_PUBLIC_APP_LANGUAGE || process.env.APP_LANGUAGE` and `process.env.NEXT_PUBLIC_ENABLE_TEST_PROFILE || process.env.ENABLE_TEST_PROFILE`.
   - Wrap application tree in `<I18nProvider initialLocale={runtimeLocale}>` and `<AuthProvider enableTestProfile={enableTestProfile}>`.
3. **Update `components/AuthContext.tsx`**:
   - Accept `enableTestProfile?: boolean` prop in `AuthProvider`.
   - Add language switcher toggle in the top-right corner of the login screen.
4. **Update `components/DashboardClient.tsx`**:
   - Add `NO | EN` language toggle button next to the profile badge in the top navigation bar.
5. **Update Documentation**:
   - Update `README.md`, `.env.example`, and `docker-compose.yml` explaining that both build-time and runtime environment variables are supported.
6. **Verification**:
   - Test compilation with `compile_applet` and `lint_applet`.
   - Verify that setting `NEXT_PUBLIC_APP_LANGUAGE=en` and `NEXT_PUBLIC_ENABLE_TEST_PROFILE=true` dynamically works without rebuilding.
