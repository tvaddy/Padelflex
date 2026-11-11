# Implementation Plan: Mobile Header Redesign & Space Optimization

The user requested: *"Den nye språkknappen dekker over padelflex-logoen på mobil. Enten må knappen bort, flyttes til hjelp, eller så må vi endre på topplinja."*
User choice: *(Anbefalt) Rydd i topplinja (kompakt mobilknapper, bevar NO/EN i toppen)*.

## 1. Root Cause Analysis
In `components/DashboardClient.tsx`, the `<header>` element contains:
1. Left side: `<PadelLogo />` + `PADELFLEX` text + Profile Pill button (`{accessCode}`).
2. Right side:
   - `NO / EN` language toggle button (`px-2.5 py-1.5`)
   - Switch Profile button (`<RefreshCw />`) — *redundant because the left Profile Pill badge already triggers `setIsSwitchProfileModalOpen(true)`!*
   - New Tournament button (`"Ny turnering"` with full text and padding `px-3.5`)
   - Logout button (`<LogOut />`)

On a standard mobile viewport (360px–410px width), having:
`[Logo + PADEL + FLEX + ProfileBadge] + [NO/EN] + [ProfileBtn] + [Play + "Ny turnering"] + [Logout]`
forces the left and right containers to collide, compressing or pushing the logo and brand text out of view.

## 2. Proposed Solution
Optimize the header specifically for mobile viewports without losing any functionality:

1. **Remove Duplicate Button on Mobile**:
   - The `<button onClick={() => setIsSwitchProfileModalOpen(true)}>` with `RefreshCw` on the right side is redundant because the left profile badge already opens the exact same modal. On mobile, we hide this duplicate button (`hidden md:flex`).
2. **Compact "New Tournament" button**:
   - On mobile, display the `<Play />` icon with a compact circle/rounded button, or icon-only on mobile (`<span className="hidden sm:inline">...</span>`). This saves ~90px of horizontal space!
3. **Streamline the NO / EN Language Toggle**:
   - Make it a sleek, compact pill badge (`px-2 py-1 text-[10px] sm:text-xs`) with clear active neon glow.
4. **Header Layout Safeguards**:
   - Ensure the left branding (`PadelLogo` + `PADELFLEX`) has `shrink-0` so the logo is never crushed or hidden under any circumstances.
   - Keep the Profile Badge visible on screens where space allows, or let it truncate smoothly.
5. **Add Language Selector in Profile Modal and Help tab as a convenience**:
   - Also allow changing language from the profile switch modal and the help page for maximum discoverability.

## 3. Verification Plan
- Verify compilation with `compile_applet` and linting with `lint_applet`.
- Verify mobile rendering at 360px, 390px, and 414px width in dev server.
- Confirm zero overlap between logo, brand name, and action buttons.
