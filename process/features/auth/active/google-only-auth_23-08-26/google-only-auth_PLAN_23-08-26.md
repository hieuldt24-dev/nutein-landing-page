---
name: plan:google-only-auth
description: "Remove email/password login + registration entirely; Google OAuth becomes the only sign-in method (auth feature, SIMPLE plan)"
date: 23-08-26
feature: auth
---

# PLAN — Google-only authentication (SIMPLE)

TL;DR: 14 files touched. Delete password login/register UI + repository methods + store methods + Zod schemas + the `email-status` route and its dedicated rate limiter. Keep every shared session/JWT surface exactly as-is. Gate = `npm run check`.

Status: PLANNED (validate-contract written; awaiting ENTER EXECUTE MODE)
Complexity: **SIMPLE** — one cohesive removal, one feature area, no new architecture, no schema change.

## Overview / Context

The app today supports two sign-in methods: Supabase email+password (login + registration, driven by a
two-tab `AuthModal`) and Google OAuth. The decision is to keep only Google. The database has 2 users
(staff, admin), both email-verified, and both will sign in via Google with the same email — no
migration or backfill is needed. On top of Supabase Auth the app layers its own JWT (`nutein_access_token`)
minted by `POST /api/auth/session`; that bridge is shared infrastructure driven by `AuthProvider`'s
`onAuthStateChange` subscription, not by any password code path, so it stays untouched. This plan is a
purely subtractive application-layer removal: no DB/schema change, no new auth logic.

## Acceptance Criteria

- AC1 — No email, password, or confirm-password input exists in any component.
- AC2 — `supabase.auth.signInWithPassword` and `supabase.auth.signUp` have zero source call sites.
- AC3 — `signInWithGoogle`, `/auth/callback`, `/api/auth/session`, `/api/auth/refresh`, JWT/refresh-token
  services, and `proxy.ts` role-gating are byte-identical after the change.
- AC4 — No orphaned imports, dead Zod schemas, dead constants, or unused rate limiters remain.
- AC5 — `npm run check` passes, with only the pre-existing `lib/useAddresses.test.tsx` failure unchanged.

## Phase Completion Rules

- A section is CODE DONE when every checklist item in it is applied; it is not VERIFIED until Section D's
  gates run green.
- Sections must run in order A → B → C → D (B depends on A's deletions; C depends on B's contract changes).
- The plan is complete only when all four Section D gates pass and the manual Google probe (step 18) is
  confirmed by a human. Code-only completion is `CODE DONE`, never `VERIFIED`.
- Any required edit to a read-only Touchpoint halts execution and returns to PLAN.

---

## Research Findings (verified, not assumed)

| # | Question | Answer |
|---|---|---|
| R1 | How does Google OAuth get its app JWT? | **Not via any password code path.** `components/providers/AuthProvider.tsx` subscribes to `supabaseBrowser.auth.onAuthStateChange`; on any session with a new user id it calls `authRepository.mintApiSession()` → `POST /api/auth/session`, then writes role into `auth-role`. The OAuth callback route only does `exchangeCodeForSession` + redirect. Removing `signIn`/`signUp` cannot break this. |
| R2 | Other register/login-with-password UI entry points? | **None.** `openAuthModal` is called from `Navbar.tsx` (no args) and `CheckoutForm.tsx:181` (`{ tab: "login", returnTo: "/checkout" }`). Only the `tab` argument needs removing. `OPEN_AUTH_MODAL_STORAGE_KEY` (account layout + AccountShell) and `sanitize-return-to.ts` are auth-method-agnostic. No "Đăng ký" CTA exists outside `AuthModal.tsx`. |
| R3 | Separate staff/admin login page? | **No.** `find app/(staff) app/(admin) -iname "*login*" -o -iname "*auth*"` returns nothing; both use `proxy.ts` edge gating + `StaffOnlyGate`/`AdminOnlyGate` reading `useAuthStore().role`. They sign in through the same shared `AuthModal`. |
| R4 | E2E/integration tests asserting password behavior? | **No E2E suite exists** (per `process/context/tests/all-tests.md` — vitest only, no Playwright, no `*.spec.ts`). Affected unit tests: `components/shared/AuthModal.test.tsx`, `lib/useAuthStore.test.tsx`, `features/auth/services/auth.repository.test.ts`, `features/auth/schemas/auth.schema.test.ts`, `app/api/auth/email-status/route.test.ts`, `src/middlewares/rate-limit.middleware.test.ts` (partial). |
| R5 | "Quên mật khẩu?" button | `disabled` dead UI inside the login form, no handler, no backend. Removed with the form. |
| R6 | `emailExistsInUsers` / `auth-email.server.ts` | Sole consumer is `app/api/auth/email-status/route.ts`. Becomes dead once that route is gone. |
| R7 | `rememberMe` | Only the password login passed a non-default value. `mintApiSession(rememberMe = true)` and `jwt.service.ts`'s `remember` default stay untouched — the Google path already uses the default. |

---

## Touchpoints

**Modify**
1. `components/shared/AuthModal.tsx` — rewrite as single-view modal.
2. `lib/useAuthStore.ts` — drop `signIn`, `signUp` (callbacks + returned keys).
3. `features/auth/services/auth.repository.ts` — drop `signInWithPassword`, `signUpWithPassword`; prune now-unreachable branches of `mapAuthError` (`"Invalid login credentials"`, `"Email not confirmed"`, `"User already registered"`).
4. `features/auth/constants.ts` — drop `AuthModalTab`; drop `tab` from `AuthModalOptions` + `AUTH_MODAL_OPTIONS_DEFAULT`.
5. `lib/openAuthModal.ts` — drop `tab` from `OpenAuthModalInput` and the options object.
6. `components/checkout/CheckoutForm.tsx:181` — `openAuthModal(mutate, { returnTo: "/checkout" })`.
7. `src/middlewares/rate-limit.middleware.ts` — delete `emailStatusLimiter` + its F5 comment block.
8. `src/middlewares/rate-limit.middleware.test.ts` — delete the `emailStatusLimiter` describe block and the authLimiter-comparison test; keep `authLimiter` / `rateLimiter` coverage.
9. `lib/useAuthStore.test.tsx` — delete signIn/signUp tests; keep the rest.
10. `features/auth/services/auth.repository.test.ts` — delete `signInWithPassword` / `signUpWithPassword` describes; keep the rest.
11. `components/shared/AuthModal.test.tsx` — rewrite for the Google-only modal.

**Delete**
12. `features/auth/schemas/auth.schema.ts` + `features/auth/schemas/auth.schema.test.ts` (whole `schemas/` dir becomes empty — remove the dir).
13. `app/api/auth/email-status/route.ts` + `route.test.ts`.
14. `features/auth/services/auth-email.server.ts`.

**Read-only (must not change)**
`app/auth/callback/route.ts`, `app/api/auth/session/route.ts`, `app/api/auth/refresh/route.ts`, `app/api/auth/logout/route.ts`, `features/auth/services/jwt.service.ts`, `refresh-token.service.ts`, `audit-log.service.ts`, `auth.service.ts`, `sanitize-return-to.ts`, `src/middlewares/authenticate.middlware.ts`, `proxy.ts`, `components/providers/AuthProvider.tsx`, `supabase/**`.

## Public Contracts

| Contract | Change |
|---|---|
| `useAuthStore()` return shape | `signIn`, `signUp` removed. Consumers verified: only `AuthModal.tsx` used them. `signOut` / `signInWithGoogle` / `user` / `role` / `isLoggedIn` / `isReady` / `isStaffOrAdmin` unchanged. |
| `AuthModalOptions` | `tab` field removed (`returnTo`, `email` kept). |
| `openAuthModal(mutate, input)` | `input.tab` removed; signature otherwise unchanged. |
| `POST /api/auth/email-status` | **Route deleted** — 404 after change. Only caller was the removed login form. |
| `POST /api/auth/session`, `/refresh`, `/logout`, `GET /auth/callback` | Unchanged. |

## Blast Radius

- 14 files (11 modified, 5 deleted, 1 dir removed) in one app; no packages, no monorepo.
- Risk class: **auth/identity** (high-risk per CLAUDE.md) — but the change is subtractive only; no new auth logic is introduced.
- Non-goals guarded: zero edits under `supabase/`, `features/checkout/`, `features/admin-*`, `features/blog/`.

## Implementation Checklist

**Section A — server-side removal**
1. Delete `app/api/auth/email-status/route.ts` and `app/api/auth/email-status/route.test.ts` (remove the now-empty dir).
2. Delete `features/auth/services/auth-email.server.ts`.
3. In `src/middlewares/rate-limit.middleware.ts`: delete the `emailStatusLimiter` export and its F5 doc comment. Leave `authLimiter`, `globalLimiter`, `rateLimiter` untouched.
4. In `src/middlewares/rate-limit.middleware.test.ts`: delete the `describe("emailStatusLimiter …")` block, the authLimiter-comparison test, the `emailStatusLimiter` import, and the `mod.emailStatusLimiter` fail-open assertion (keep an equivalent `authLimiter` fail-open assertion if the block would otherwise become empty).
5. Verify no references remain: `grep -rn "email-status\|emailStatusLimiter\|emailExistsInUsers" --include=*.ts --include=*.tsx .` returns only `.next/` build artifacts.

**Section B — client auth layer**
6. `features/auth/services/auth.repository.ts`: delete `signInWithPassword` and `signUpWithPassword`. Reduce `mapAuthError` to the `default` branch only (the three password-specific messages are unreachable once both methods are gone). Keep `toAuthUser`, `signInWithGoogle`, `signOut`, `mintApiSession`, `waitForInFlightApiSession`, `mintSessionInFlight` single-flight logic.
7. `lib/useAuthStore.ts`: delete the `signIn` and `signUp` `useCallback`s and their entries in the returned object. Keep everything else, including `mutate` (still used by `signOut`).
8. Delete `features/auth/schemas/auth.schema.ts` and `auth.schema.test.ts`; remove the empty `features/auth/schemas/` dir.
9. `features/auth/constants.ts`: delete `AuthModalTab`; remove `tab` from `AuthModalOptions` and `AUTH_MODAL_OPTIONS_DEFAULT`; update the `AUTH_MODAL_OPTIONS_SWR_KEY` doc comment ("returnTo, email prefill").
10. `lib/openAuthModal.ts`: remove the `AuthModalTab` import, `tab?` from `OpenAuthModalInput`, and the `tab:` line from the options object.
11. `components/checkout/CheckoutForm.tsx:181`: change to `openAuthModal(mutate, { returnTo: "/checkout" })`.

**Section C — AuthModal rewrite**
12. Rewrite `components/shared/AuthModal.tsx` as a single-view modal:
    - Remove imports: `useForm`, `zodResolver`, `loginSchema`/`registerSchema` + types, `Eye`/`EyeOff`, `apiRequest`, `useRouter` (only used by the removed post-password redirects — **verify** before deleting; if `resolveAfterAuthPath` still needs it, keep).
    - Remove state: `activeTab`, `showPassword`, `isSubmittingForm`. Keep `isGoogleLoading`, `returnToRef`, `appliedOpenRef`.
    - Remove both `useForm` instances, `onLogin`, `onRegister`, `switchToRegisterWithEmail`, the tab bar, both forms, "remember me", "Quên mật khẩu?", the divider, and the `Field` / `TextInput` helper components (both become unused).
    - Keep verbatim: the `useSWR(AUTH_MODAL_SWR_KEY)` / options store wiring and its `revalidateOn*: false` comment, `setIsOpen`/`closeAuthModal`, body-scroll lock, Escape handler, auto-close-when-logged-in effect, `OPEN_AUTH_MODAL_STORAGE_KEY` one-shot effect, the apply-options effect (minus `setActiveTab`/email prefill — the email prefill setters have no target now; drop them and leave `opts.email` unused), `resolveAfterAuthPath`, `onGoogleLogin`, backdrop, `role="dialog"` + `aria-modal` + `aria-labelledby="auth-modal-title"`, the close button, and `GoogleIcon`.
    - Header copy becomes static: keep the logo, `Tài khoản Nutein` eyebrow, title `Chào mừng trở lại` (id `auth-modal-title`), subtitle `Đăng nhập để theo dõi đơn hàng và ưu đãi.`
    - Body: one primary Google CTA — `<FillButton type="button" variant="ink-solid" …>` at `h-[52px] w-full`, disabled while `isGoogleLoading`, spinner ↔ `<GoogleIcon />`, label `Tiếp tục với Google`.
13. Rewrite `components/shared/AuthModal.test.tsx` covering: renders dialog with Google CTA and no email/password inputs; clicking the CTA calls `signInWithGoogle` with a `/auth/callback?next=` redirect URL; a `signInWithGoogle` rejection shows `notify.error` and re-enables the button; modal auto-closes when `isLoggedIn` is true; Escape/backdrop close. Drop the `@/lib/api-client` mock. Reuse the existing `next/image` mock, `SWRConfig` wrapper, and `OpenAuthModal` helper.
14. `lib/useAuthStore.test.tsx`: delete the signIn/signUp tests and the `signInWithPassword`/`signUpWithPassword` mock entries; keep `signOut`, role, and `isStaffOrAdmin` coverage.
15. `features/auth/services/auth.repository.test.ts`: delete the two password describes and the `signInWithPassword`/`signUp` entries from the `supabaseBrowser.auth` mock; keep the rest.

**Section D — verification**
16. `grep -rn "signInWithPassword\|signUpWithPassword\|supabaseBrowser.auth.signUp\|loginSchema\|registerSchema\|AuthModalTab" --include=*.ts --include=*.tsx .` → only `.next/` hits.
17. `npm run type-check`, `npm run lint`, `npm test`, `npm run format:check` (or `npm run check` for all four).
18. Manual probe: dev server → open modal from Navbar and from `/checkout`; confirm single Google button, no password fields; confirm the `/account` guest-redirect still auto-opens the modal.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `npm run type-check` exits 0 | Fully-Automated | AC4 (no orphaned imports/types) |
| `npm run lint` exits 0 (`--max-warnings=0`) | Fully-Automated | AC4 (no unused vars/imports) |
| `npm test` — full vitest suite | Fully-Automated | AC5 |
| `AuthModal.test.tsx` — no email/password inputs rendered | Fully-Automated | AC1 |
| `AuthModal.test.tsx` — CTA calls `signInWithGoogle` with callback URL | Fully-Automated | AC3 (Google path intact) |
| grep for `signInWithPassword` / `supabase.auth.signUp` returns no source hits | Fully-Automated | AC2 |
| `git diff --stat` shows zero changes under the read-only list | Fully-Automated | AC3 |
| Manual: Google sign-in end-to-end (Navbar + `/checkout` returnTo) | Agent-Probe / manual | AC3, U1, U2 |
| Manual: STAFF/ADMIN Google sign-in reaches `/staff` / `/admin` | Agent-Probe / manual | AC3, U5 |

**Failing stubs (red-first, from vc-test-coverage-plan):**

```
test("should render dialog with Google CTA and no email/password inputs", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: no email/password inputs rendered")
})
test("should call signInWithGoogle with a /auth/callback redirect URL on CTA click", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: CTA calls signInWithGoogle")
})
test("should show an error toast and re-enable the CTA when signInWithGoogle rejects", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: Google failure path")
})
```

**High-risk class table**

| Area | High-risk class | Minimum tier | Gap rationale |
|---|---|---|---|
| AuthModal Google path | auth/identity | Fully-automated (unit) + manual probe | Real OAuth round-trip needs a live Google client; no test infra exists (see Known Gaps below) |
| App-JWT minting bridge | auth/identity | Fully-automated (untouched-file diff check) | File is not modified; regression risk is import-graph only, caught by type-check |

## Test Infra Improvement Notes

- Known pre-existing failure: `lib/useAddresses.test.tsx` fails at import because `vitest.config.ts` `test.env` lacks `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (documented in `process/context/tests/all-tests.md` Known Gaps and `process/general-plans/backlog/infra-followups-19-08-26.md`). **Baseline it before editing** (`npm test` first) so it is not misread as a regression. Out of scope to fix here.
- Known gap: no E2E runner — the real Google OAuth round-trip cannot be automated in this repo. Covered by the manual probe in step 18.
- `beforeEach` block-body rule and jsdom/node docblock rules from `all-tests.md` apply to the rewritten test files.

## Resume and Execution Handoff

1. Selected plan file: `process/features/auth/active/google-only-auth_23-08-26/google-only-auth_PLAN_23-08-26.md`
2. Last completed step: PLAN + VALIDATE complete; awaiting `ENTER EXECUTE MODE`.
3. Validate-contract status: **written** (see below).
4. Context loaded: `process/context/all-context.md`, `process/context/auth/all-auth.md`, `process/context/tests/all-tests.md`, `process/development-protocols/orchestration.md`.
5. Next step for a fresh agent: run `npm test` to capture the baseline, then execute Sections A → B → C → D in order.

## Validate Contract

Date: 23-08-26
date: 2026-08-23
generated-by: outer-pvl
Gate: CONDITIONAL (2 concerns, accepted with mitigations below)
Mode: Deep (auth context group + tests context group + blast-radius test files read)

### Layer 1 dimensions

| Dimension | Status | Findings |
|---|---|---|
| Infra fit | PASS | Single Next.js app, no container/port surface. All 14 target paths verified to exist. `features/auth/schemas/` contains only the two files being deleted, so removing the dir is safe. |
| Test coverage | CONCERN | Pre-existing `lib/useAddresses.test.tsx` failure will appear in the post-change run. Mitigation: baseline `npm test` before editing. Real OAuth round-trip is a known gap — manual probe only. |
| Breaking changes | PASS | `useAuthStore` consumers enumerated by grep (11 files); only `AuthModal.tsx` used `signIn`/`signUp`. `openAuthModal` has exactly 2 call sites, both handled. `/api/auth/email-status` has exactly 1 caller, removed in the same change. |
| Security surface | CONCERN | Application-layer removal does NOT disable Supabase's email/password provider server-side — a direct Supabase API call could still create a password account. Out of scope per SPEC; recorded as a known gap requiring a Supabase dashboard change. Otherwise the change strictly reduces attack surface (removes the unauthenticated `email-status` enumeration oracle and its throttle need). |

### Layer 2 sections

| Section | Status | Notes |
|---|---|---|
| A — server-side removal | PASS | `emailStatusLimiter` referenced only in its own route, its route test, and the limiter test. `emailExistsInUsers` referenced only by the deleted route. Highest-risk edit: gutting `rate-limit.middleware.test.ts` — mitigate by deleting only the named blocks, not the file. |
| B — client auth layer | PASS | `mapAuthError` reduction verified safe: remaining callers are `signInWithGoogle` and `signOut`, which only surface generic messages. `mutate` still needed in `useAuthStore` (`signOut`). |
| C — AuthModal rewrite | CONCERN→handled | `useRouter` may become unused after the password redirects go; step 12 explicitly requires verifying before deleting the import (lint would otherwise fail on `--max-warnings=0`). `opts.email` becomes unused — either keep the field unread or drop the prefill lines; do not delete the `email` field from `AuthModalOptions` (checkout may set it). |
| D — verification | PASS | Commands match `process/context/tests/all-tests.md` exactly. |

**Totals: 0 FAILs / 2 CONCERNs / 6 PASSes → Net Gate: CONDITIONAL**

### Plan updates applied
- P1 — Added the `npm test` baseline requirement (Test Infra Improvement Notes + handoff step 5) so the known `useAddresses` failure is not misread as a regression.
- P2 — Step 12 now requires verifying `useRouter` usage before removing the import.
- P3 — Step 9 clarified: remove only `tab` from `AuthModalOptions`; `email` and `returnTo` stay.

### Execute-agent instructions

| # | Instruction | Trigger |
|---|---|---|
| E1 | Run `npm test` and record the pass/fail counts BEFORE any edit. Compare against the post-change run; only new failures count. | Before Section A |
| E2 | Do not delete `src/middlewares/rate-limit.middleware.test.ts` wholesale — remove only the `emailStatusLimiter` describe and the authLimiter-comparison test. | Section A step 4 |
| E3 | Before removing any import from `AuthModal.tsx`, confirm zero remaining usages in the rewritten file. `--max-warnings=0` turns an unused import into a hard failure. | Section C step 12 |
| E4 | Do not touch any file in the read-only Touchpoints list. If a change appears necessary there, STOP and report instead of editing. | Throughout |
| E5 | If `mapAuthError` reduction causes a type or lint issue, keep the full switch rather than blocking — it is inert either way. | Section B step 6 |
| E6 | Run `npm run check` as the final gate; report the exact diff vs the E1 baseline. | Section D |

### Test gates

```
npm run type-check
npm run lint
npm test
npm run format:check
```
(or `npm run check` for all four in sequence)

### Known gaps (accepted)
1. Supabase's email/password auth provider remains enabled at the Supabase project level — application-layer removal only. Follow-up: disable the Email provider in the Supabase dashboard. Out of scope per SPEC.
2. No automated coverage of the real Google OAuth round-trip (no E2E runner in this repo). Covered by manual probe.
3. Pre-existing `lib/useAddresses.test.tsx` import failure is unrelated and stays.
