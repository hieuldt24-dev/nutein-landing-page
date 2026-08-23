---
name: spec:google-only-auth
description: "Remove email/password login + registration entirely; Google OAuth becomes the only sign-in method"
date: 23-08-26
feature: auth
---

# SPEC — Google-only authentication

TL;DR: strip every password login/register code path and its UI, leaving a single-view AuthModal with one Google CTA. All shared session/JWT infrastructure stays untouched.

## Goal

Only one way to authenticate: Google OAuth. No email/password anywhere, client or server.

## Use cases (must keep working identically)

| # | Flow | Expected |
|---|---|---|
| U1 | Guest clicks account icon in Navbar | Modal opens with branding + single Google CTA |
| U2 | Guest at `/checkout` clicks login | Modal opens; after Google returns, user lands back on `/checkout` |
| U3 | Guest hits `/account*` | Redirect to `/`, `OPEN_AUTH_MODAL_STORAGE_KEY` flag opens the modal once |
| U4 | Logged-in user, modal open | Modal auto-closes |
| U5 | Existing STAFF/ADMIN account | Signs in via Google with the same email; role from `public.users` unchanged |
| U6 | Escape / backdrop / X | Modal closes and resets options |

## Acceptance criteria

- AC1 — No email, password, or confirm-password input exists in any component.
- AC2 — `supabase.auth.signInWithPassword` and `supabase.auth.signUp` have zero call sites in the repo.
- AC3 — `signInWithGoogle`, `/auth/callback`, `/api/auth/session`, `/api/auth/refresh`, JWT/refresh-token services, `proxy.ts` gating: byte-identical.
- AC4 — No orphaned imports, dead Zod schemas, dead constants, or unused rate limiters.
- AC5 — `npm run check` (format:check + lint + type-check + test) passes, with the one known pre-existing `lib/useAddresses.test.tsx` failure unchanged.

## Out of scope

- `supabase/migrations/**` and any DB/schema change.
- Supabase dashboard provider config (disabling the email provider server-side) — application-layer only.
- `supabase/email-templates/confirm-signup.html` — Supabase-owned asset, left in place.
- PayOS/checkout/admin/blog logic beyond the one `openAuthModal(..., { tab })` call-site argument.
- Password reset / "forgot password" backend — never existed.

## Constraints

- Auth is a high-risk change class: when unsure whether something is password-specific or shared, keep it and flag it.
- `rememberMe` plumbing in `jwt.service.ts` / `mintApiSession(rememberMe)` stays (defaults to `true`; Google path already relies on the default).
