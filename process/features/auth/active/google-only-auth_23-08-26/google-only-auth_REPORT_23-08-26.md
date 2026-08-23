---
phase: google-only-auth
date: 2026-08-23
status: COMPLETE_WITH_GAPS
feature: auth
plan: process/features/auth/active/google-only-auth_23-08-26/google-only-auth_PLAN_23-08-26.md
---

# EXECUTE report — Google-only authentication

TL;DR: All 17 code checklist items (1–17) applied. Type-check green, tests green except the known
pre-existing `useAddresses` failure. Lint + format:check are pre-existing repo-wide red (baseline
537 lint problems / 1285 unformatted files → 535 / 1282 after the change: strictly reduced, nothing
new introduced). Step 18 (manual Google probe) is human-owned and still outstanding → `CODE DONE`,
not `VERIFIED`.

## What Was Done

**Section A — server-side removal (items 1–5)**
1. Deleted `app/api/auth/email-status/` (route.ts + route.test.ts, dir removed).
2. Deleted `features/auth/services/auth-email.server.ts`.
3. Removed `emailStatusLimiter` + its F5 doc comment from `src/middlewares/rate-limit.middleware.ts`.
4. Reworked `src/middlewares/rate-limit.middleware.test.ts` (see Deviations D1).
5. Grep confirmed zero remaining `email-status` / `emailStatusLimiter` / `emailExistsInUsers` source refs.

**Section B — client auth layer (items 6–11)**
6. `auth.repository.ts`: removed `signInWithPassword` + `signUpWithPassword`; `mapAuthError` reduced
   to the default branch.
7. `lib/useAuthStore.ts`: removed `signIn` / `signUp` callbacks and their returned keys.
8. Deleted `features/auth/schemas/` (auth.schema.ts + auth.schema.test.ts, dir removed).
9. `features/auth/constants.ts`: removed `AuthModalTab` and the `tab` field; `returnTo` + `email` kept.
10. `lib/openAuthModal.ts`: removed the `AuthModalTab` import, `tab?` input field, and `tab:` line.
11. `components/checkout/CheckoutForm.tsx:181` → `openAuthModal(mutate, { returnTo: "/checkout" })`.

**Section C — AuthModal rewrite (items 12–15)**
12. `AuthModal.tsx` rewritten as a single-view Google-only modal. `useRouter`, `cn`, `apiRequest`,
    `useForm`, `zodResolver`, `Eye`/`EyeOff`, `Field`, `TextInput` all removed after confirming zero
    remaining usages (E3). `usePathname` KEPT — still used by `resolveAfterAuthPath`. All wiring
    listed as "keep verbatim" in the plan preserved.
13. `AuthModal.test.tsx` rewritten: 6 tests (dialog + Google CTA with no email/password inputs,
    CTA calls `signInWithGoogle` with the `/auth/callback?next=` URL, rejection → `notify.error` +
    button re-enabled, auto-close when logged in, Escape close, backdrop close). `@/lib/api-client`
    mock dropped.
14. `lib/useAuthStore.test.tsx` rewritten (see Deviations D2).
15. `auth.repository.test.ts`: both password describes deleted, mock entries swapped to
    `signInWithOAuth`; added a `signInWithGoogle` describe (see Deviations D3).

**Section D — verification (items 16–17)**
16. Grep for `signInWithPassword|signUpWithPassword|auth.signUp|loginSchema|registerSchema|AuthModalTab`
    returns ZERO source hits (only `node_modules/@supabase/auth-js` type declarations).
17. Gates run — results below.

## What Was Skipped or Deferred

- **Step 18 (manual Google probe)** — human-owned; requires a dev server and a real Google account.
  Not runnable by this agent. The plan is `CODE DONE`, not `VERIFIED`, until a human confirms it.
- Disabling Supabase's Email provider at the project level — explicitly out of scope (Known Gap 1).

## Test Gate Outcomes

| Gate | Baseline (pre-change) | Post-change | Verdict |
|---|---|---|---|
| `npm test` | 61 pass / 1 fail (62 files), 435 tests pass | 59 pass / 1 fail (60 files), 408 tests pass | **PASS** — only the known `lib/useAddresses.test.tsx` failure remains; no new failures. File/test count drop is the intentional deletions. |
| `npm run type-check` | clean | clean | **PASS** (needed one `rm -rf .next` — a stale generated route validator still referenced the deleted `email-status` route) |
| `npm run lint` | 537 problems (337 err / 200 warn) | 535 problems (335 err / 200 warn) | **PRE-EXISTING RED, reduced by 2.** No error in any file I touched except `CheckoutForm.tsx`'s 2 `react-hooks/refs` errors, which are byte-identical pre-existing (verified via `git stash` baseline). |
| `npm run format:check` | 1285 unformatted files | 1282 unformatted files | **PRE-EXISTING RED, reduced by 3.** The entire repo (1285 files) fails Prettier on `main`; this is a repo-wide baseline condition, not a regression. Deliberately did NOT run `prettier --write` — that would produce a 1282-file diff far outside the plan's blast radius. |

Read-only Touchpoints: `git status` confirms ZERO changes to `app/auth/callback/route.ts`,
`app/api/auth/{session,refresh,logout}/route.ts`, `jwt.service.ts`, `refresh-token.service.ts`,
`audit-log.service.ts`, `auth.service.ts`, `sanitize-return-to.ts`, `authenticate.middlware.ts`,
`proxy.ts`, `AuthProvider.tsx`, `supabase/**`. AC3 holds.

## Plan Deviations

All three are within-blast-radius, coverage-preserving, and documented per the deviation protocol.

- **D1 — `rate-limit.middleware.test.ts`.** The plan said delete the whole `emailStatusLimiter`
  describe. Two of its four tests covered generic `rateLimiter` behavior (per-code Redis key format,
  OPTIONS preflight bypass) that nothing else covers. Rather than lose that, I retargeted the describe
  to `authLimiter` (threshold 20/21, key `ratelimit:TOO_MANY_LOGIN_ATTEMPTS:<ip>`, OPTIONS bypass) and
  deleted the authLimiter-comparison test as instructed. Rationale: task brief says "don't delete tests
  wholesale without checking what else they cover."
- **D2 — `useAuthStore.test.tsx`.** Could not surgically "delete the signIn/signUp tests" — the
  `signOut` test used `signIn` to reach a logged-in state, so it had no valid setup left. Rewrote the
  file: kept default-state, signOut-calls-repository, and role/`isStaffOrAdmin` coverage; added an
  explicit assertion that `signIn`/`signUp` are no longer exposed, plus `signInWithGoogle` delegation.
- **D3 — `auth.repository.test.ts`.** Added a `signInWithGoogle` describe (2 tests) beyond the plan's
  "delete only" instruction. The mock had to change anyway (`signInWithPassword`/`signUp` →
  `signInWithOAuth`), and this gives AC3 real automated coverage of the surviving Google path.
- **D4 (trivial)** — reworded a comment in `rate-limit.middleware.ts` that referenced the now-deleted
  `emailStatusLimiter` (in `couponPreviewLimiter`'s doc block).

No hard-stop-class deviation occurred. No read-only Touchpoint required editing.

## Test Infra Gaps Found

- `CONTEXT_PARTIAL: lint/format baseline` — `process/context/tests/all-tests.md` documents
  `npm run check` as the pre-push gate but does NOT record that `lint` and `format:check` are
  **already failing repo-wide on `main`** (537 problems / 1285 unformatted files). Any agent treating
  `npm run check` as a green gate will be misled. Worth adding to the Known Gaps section during
  UPDATE PROCESS.
- Stale `.next/dev/types/validator.ts` breaks `type-check` after any route deletion until `.next` is
  cleared. Not documented anywhere; cost one confusing failure.
- Pre-existing `lib/useAddresses.test.tsx` failure unchanged (already in backlog
  `infra-followups-19-08-26.md`).

## Closeout Packet

- **Selected plan:** `process/features/auth/active/google-only-auth_23-08-26/google-only-auth_PLAN_23-08-26.md`
- **Finished:** checklist items 1–17 (all code + automated verification).
- **Verified:** AC1, AC2, AC4 (automated + grep). AC3 verified structurally (read-only files byte-identical,
  Google path unit-tested); AC5 verified modulo the pre-existing failure.
- **Unverified:** step 18 manual Google end-to-end probe (Navbar + `/checkout` returnTo + STAFF/ADMIN
  reaching `/staff` `/admin`) — human-owned.
- **Remaining cleanup:** disable the Email/Password provider in the Supabase Dashboard (Known Gap 1);
  record the lint/format baseline gap in `all-tests.md`.
- **Best next state:** `Keep in active/testing` — code-complete, awaiting the human Google probe.

## Forward Preview

**Test Infra Found:** vitest only, 60 test files. `npm test` is the reliable gate; `lint`/`format:check`
are baseline-red and must be compared against a `git stash` baseline, not read as pass/fail.

**Blast Radius Changes:** 16 files (11 modified, 5 deleted) + 2 directories removed
(`app/api/auth/email-status/`, `features/auth/schemas/`). Nothing outside `features/auth/`,
`components/shared/`, `components/checkout/`, `lib/`, `src/middlewares/`.

**Commands to Stay Green:** `rm -rf .next && npm run type-check && npm test`.

**Dependency Changes:** none. Note `react-hook-form` / `@hookform/resolvers` / `zod` are still used
elsewhere — do NOT uninstall them on the strength of this change.
