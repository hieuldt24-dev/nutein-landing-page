---
name: plan:full-codebase-review-critical-fixes
description: "Implementation plan for fixing 7 Critical production-readiness issues (F1-F7) found by the 19-08-26 full-codebase review"
date: 19-08-26
feature: N/A
---

# PLAN — Fix 7 Critical Production-Readiness Issues (F1-F7)

**Date**: 19-08-26
**Status**: Ready for VALIDATE
**Complexity**: COMPLEX

## Overview

Context loaded from `process/context/all-context.md` (root context router) and
`process/context/tests/all-tests.md` (test routing — confirms Vitest is the only runner in this
repo; no Playwright/e2e). See Resume and Execution Handoff for the full context-file list read
during PLAN.

This is a single COMPLEX plan (not a phase program) implementing 7 locked fixes from
`full-codebase-review_SPEC_19-08-26.md`. RESEARCH/SPEC/INNOVATE are complete; every design decision
below is locked, not open for reconsideration. Complexity classification: COMPLEX — 7 independent
checklist items, 1 new dependency (`sanitize-html`), 2 high-risk surfaces (auth/identity, billing).

Per INNOVATE's strategy recommendation, this plan produces ONE plan file with 7 checklist sections
(not 7 separate plans, not a phase program) because of the F2/F4 file-overlap coordination need.

## Goals

Close all 7 Critical gaps per the SPEC's 16 Acceptance Criteria, provable entirely with Vitest
(no Playwright/e2e in this repo).

## Scope

In scope: exactly the 7 items below, each mapped 1:1 to SPEC sections F1-F7.
Out of scope: everything listed in the SPEC's "Out Of Scope" section (Medium/High/Low findings,
password-reset flow, CSP rollout, coupon system, proxy.ts edge-gating scope, email-status response
shape change). Do not touch these during EXECUTE even if adjacent code looks related.

## Execution Order (checklist sections are numbered in this order — not a hard dependency, but the
recommended low-risk-first sequence from INNOVATE)

F7 → F6 → F1 → F2+F4 (combined) → F5 → F3 (last: new dependency, largest new surface)

---

## Implementation Checklist

### Section 1 — F7: Scope Cloudinary remotePatterns to own cloud name

**Touchpoints:** `next.config.ts`

1. In `next.config.ts`, import/read `process.env.CLOUDINARY_CLOUD_NAME` at config-build time (same
   env var already read at runtime in `lib/cloudinary.ts:4` — reuse as source of truth, do not
   introduce a second env var name).
2. Change the Cloudinary `remotePatterns` entry's `pathname` from `"/**"` to
   `` `/${process.env.CLOUDINARY_CLOUD_NAME}/**` `` (Cloudinary delivery URLs are shaped
   `https://res.cloudinary.com/<cloud_name>/...`, so scoping the first path segment to the cloud
   name rejects any other account's cloud name while still matching this project's own images,
   e.g. `image/upload/...`, `video/upload/...` variants under the same cloud).
3. Keep `hostname: "res.cloudinary.com"` and `protocol: "https"` unchanged — only `pathname` changes.
4. Do not add a fallback wildcard for when `CLOUDINARY_CLOUD_NAME` is unset — if unset, the pattern
   becomes `/undefined/**` which matches nothing real, matching the existing "nullable client, guard
   at call site" convention (Constraints) — no image proxying happens until the env var is set,
   same fail-safe posture as `isCloudinaryConfigured` elsewhere.

**Test gate (Section 1):** Run before moving to Section 2.
```
npx vitest run next.config.test.ts
```

---

### Section 2 — F6: Stop leaking internal error detail to clients

**Touchpoints:** `features/checkout/services/payos.service.ts` (lines 13-20 `requirePayosClient`),
`app/api/staff/uploads/route.ts` (lines 44-51 catch block), `src/middlewares/error-handler.middleware.ts`
(lines ~48-51, `AppError` branch — new item 7a added during VALIDATE)

5. In `features/checkout/services/payos.service.ts`, change `requirePayosClient()`'s
   `InternalServerError` call to mirror `features/contact/services/contact.repository.ts`'s pattern
   exactly: generic client-facing `message` (e.g. `"Không thể khởi tạo thanh toán — vui lòng thử lại
   sau."`) as the first constructor arg, and the current literal diagnostic string (`"Thiếu
   PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY — kiểm tra lại file .env"`) moved to the second
   constructor arg (`details`) — `InternalServerError`'s signature already supports
   `(message, details)` per `src/errors/app.error.ts:37-41`, no interface change needed.
6. In `app/api/staff/uploads/route.ts`'s catch block (lines 44-51), stop forwarding
   `err instanceof Error ? err.message : "Upload ảnh thất bại."` as the client-facing message.
   Change to: generic fixed message (e.g. `"Tải ảnh lên thất bại — vui lòng thử lại sau."`) as the
   first arg, raw caught error message as `details` (second arg) — same two-arg pattern as item 5.
7. In both cases, confirm the full diagnostic detail is still reaching server-side logs — check
   whether `withErrorHandler` (in `src/middlewares/error-handler.middleware.ts`) already logs the
   thrown error's `details`/stack before responding; if it does not currently log `details`, do NOT
   add new logging as part of this item (out of scope — SPEC only requires detail be "available"
   via the already-existing `details` field on the response envelope, not necessarily logged
   separately). Verify via a quick read of `error-handler.middleware.ts`, no code change required
   unless the read reveals `details` is silently dropped before reaching the response envelope.
7a. **[Added during VALIDATE — confirmed gap, not optional]** The read in item 7 DOES reveal
    `details` is silently dropped: `src/api/response.ts`'s `ApiResponse.error` shape is
    `{ message, code }` only (no `details` field exists anywhere in the response envelope — the
    SPEC/plan's original phrasing "the already-existing `details` field on the response envelope"
    is inaccurate, confirmed by direct source read), and `withErrorHandler`'s `AppError` branch
    (`src/middlewares/error-handler.middleware.ts`, `logger.warn({ path: req.nextUrl.pathname, code:
    error.code }, error.message)`) never logs `error.details` either. Without this item, the
    diagnostic detail moved into `details` by items 5/6 becomes invisible everywhere (correctly
    hidden from the client, but also unintentionally erased from server logs — a debuggability
    regression, not a security issue). Fix: extend that one `logger.warn` call to
    `logger.warn({ path: req.nextUrl.pathname, code: error.code, details: error.details },
    error.message)`. No response-shape change, no new touchpoint file beyond what Section 2 already
    covers, no new test mandated (this repo has no existing convention for asserting logger-call
    arguments — consistent with existing test conventions per `all-tests.md`).

**Test gate (Section 2):**
```
npx vitest run features/checkout/services/payos.service.test.ts
npx vitest run app/api/staff/uploads/route.test.ts
```
(If `app/api/staff/uploads/route.test.ts` does not exist yet, create it — this SPEC criterion (14)
requires a new/extended test on this route.)

---

### Section 3 — F1: Cancel orphaned PayOS link on order-create failure

**Touchpoints:** `features/checkout/services/checkout.service.ts` (`createOrder`, lines 84-216,
specifically the `orderRepository.create()` call at line 142 and everything between payment
resolution at line 132 and the `create()` call)

8. Wrap the `orderRepository.create(...)` call (line 142) in try/catch inside `createOrder()`.
9. On catch: only call `payosService.cancelPaymentLink(...)` when a PayOS link was actually created
   — i.e. `payosOrderCode` is defined (non-COD path; for COD, `resolvePayment()` returns
   `{ uiStatus: "pending" }` with no `payosOrderCode`, so the guard is simply
   `if (payosOrderCode) { ... }`).
10. Inside that guard, call `payosService.cancelPaymentLink(payosOrderCode, "order_create_failed")`
    — mirror the exact reason-string shape already used by `retryPayment()`'s CAS-loss branch
    (`"retry_race_lost"`, line 285) — use `"order_create_failed"` as the reason for this new branch.
11. Wrap the `cancelPaymentLink` call itself in its own try/catch, log-only on failure (use
    `serviceLogger.error(...)`, already available in scope at line 89-92) — a failure to cancel
    must NOT replace or mask the original `orderRepository.create()` error. After the inner
    try/catch (whether cancel succeeded or not), rethrow the original caught error from step 8 so
    the client still sees the original failure.
12. Do not alter any other branch of `createOrder()` — the COD path (no `payosOrderCode`) must be
    byte-for-byte unaffected by this change (SPEC AC2 — no regression on existing COD tests).

**Test gate (Section 3):**
```
npx vitest run features/checkout/services/checkout.service.test.ts
```
New test cases required (add to existing describe blocks, do not create a new file — this file
already has payOS/order-creation test coverage per the SPEC's `proven by:` note): (a) mirror the
existing "payOS fails → create is NOT called" case but reversed — payOS succeeds, `create()` throws,
assert `cancelPaymentLink` IS called with `(payosOrderCode, "order_create_failed")` and the original
error still propagates to the caller; (b) a case where `cancelPaymentLink` itself throws inside the
inner try/catch — assert the ORIGINAL `create()` error is what propagates, not the cancel error;
(c) confirm existing COD-path tests pass unmodified (no `cancelPaymentLink` call, no new code path
touched).

---

### Section 4 — F2+F4 combined: account lock enforcement + rate limiting on session/refresh
(SAME FILES — do not split into two independently-executable items; one combined change per file)

**Touchpoints:** `app/api/auth/session/route.ts`, `app/api/auth/refresh/route.ts`,
`features/auth/services/refresh-token.service.ts` (new method), `features/admin-users/services/
admin-users.repository.ts` (`setLocked`), `src/middlewares/rate-limit.middleware.ts` (read-only —
reuse `authLimiter`)

**Locked guard-clause order inside each handler (per SPEC's F2/F4 co-scoping requirement): rate-limit
check (F4) FIRST, then `is_deleted` lock check (F2) SECOND.**

**4a — `app/api/auth/session/route.ts`:**

13. Add `authLimiter` as the first guard clause inside the `POST` handler body (before any Supabase
    call) — call `const limited = await authLimiter(req); if (limited) return limited;` at the very
    top of the `withErrorHandler(async (req) => { ... })` callback, before line 35's body parsing.
    (`authLimiter` returns `NextResponse | null` per `rate-limit.middleware.ts:68-75` — a non-null
    return IS the 429 rejection response, return it directly; this matches the existing
    `rateLimiter()` contract, no new wrapper needed.)
14. Add the `is_deleted` guard as the second clause, after the Supabase `getUser()` call succeeds
    (after line 46, once `user.id` is known) and merged into the EXISTING `profile` query at line
    48-52 — extend `SELECT` from `"role"` to `"role, is_deleted"` (one query, not two) and read
    `profile?.is_deleted` from the already-fetched row.
15. If `profile?.is_deleted === true`, throw `new UnauthorizedError("Tài khoản đã bị khóa")` (403 —
    check whether `UnauthorizedError` maps to 403 or 401 in `src/errors/app.error.ts`; SPEC requires
    the response code semantically communicate "locked/forbidden", not "not authenticated" — if
    `UnauthorizedError` is 401-only, use a distinct error class if one exists for 403, otherwise use
    `UnauthorizedError` with a message that is at minimum externally distinguishable via error
    `code`, since introducing a brand-new error class is a larger surface than this SPEC scopes —
    confirm the existing error taxonomy in `src/errors/app.error.ts` during EXECUTE and choose the
    closest existing 4xx class; do not invent a new HTTP status code scheme).
16. Do NOT mint or store any tokens once the lock check fails — the guard must short-circuit before
    line 61 (`jwtService.signAccessToken`).

**4b — `app/api/auth/refresh/route.ts`:**

17. Add `authLimiter` (or `sessionLimiter` — confirm intended tier: SPEC AC9 says "limited the same
    way" as session, i.e. `authLimiter`; use `authLimiter` for consistency with AC8/AC9 phrasing) as
    the first guard clause, at the top of the handler before line 30's cookie read.
18. Add the `is_deleted` guard as the second clause. This route currently has NO DB user query at
    all (only JWT verify + `refreshTokenService.isActive` check) — add a new DB lookup by
    `payload.sub` after `jwtService.verifyRefreshToken()` succeeds (after line 40) and before the
    `isActive` check at line 42. Use the existing admin/service-role Supabase client pattern already
    used in this codebase for server-only, non-session-bound reads (see
    `refresh-token.service.ts`'s `requireAdminClient()` / `supabaseAdmin` pattern — reuse the same
    client, this route has no user session context to use `getSupabaseServerClient()` with). Select
    `is_deleted` only (minimal column selection matching existing repo convention).
19. If the looked-up user's `is_deleted === true`: (a) throw `UnauthorizedError` (same 4xx-class
    decision as item 15 — keep consistent between session and refresh routes), AND (b) before
    throwing, call the new bulk-revoke method from item 20 to revoke ALL of that user's outstanding
    refresh tokens — not just the currently-presented one. This satisfies SPEC AC4's "revoke-by-
    userId, not just the presented token" requirement and the admin-lock-time trigger in item 21
    below both call the same underlying revocation, but this route-level call handles the case where
    a user attempts to refresh AFTER being locked (defense in depth alongside the admin-side trigger).

**4c — new shared capability: bulk revoke-by-userId (used by both 4b's route-level defense AND the
admin lock-time trigger):**

20. Add a new method to `features/auth/services/refresh-token.service.ts`:
    `revokeAllForUser(userId: string): Promise<void>` — `UPDATE refresh_tokens SET revoked_at = now()
    WHERE user_id = $userId AND revoked_at IS NULL` (only touch not-yet-revoked rows; mirror the
    existing `revoke()` method's error-handling shape — throw a plain `Error` with the Supabase error
    message on failure, matching `revoke()`'s convention at lines 49-57). Use `requireAdminClient()`
    (already defined in this file) — do not duplicate the admin-client guard.

**4d — admin lock-time trigger (SPEC AC4's "immediate", not lazy-at-refresh-time" requirement):**

21. In `features/admin-users/services/admin-users.repository.ts`'s `setLocked(id, locked)` (lines
    92-108): after the existing `UPDATE users SET is_deleted = locked` succeeds AND only when
    `locked === true` (do not revoke tokens when unlocking — unlocking should not need to force
    re-login), call `refreshTokenService.revokeAllForUser(id)`. Import `refreshTokenService` from
    `features/auth/services/refresh-token.service.ts` into `admin-users.repository.ts`. This makes
    "lock" trigger immediate bulk revocation at the moment an admin locks the account, not only
    lazily the next time that user happens to hit `/api/auth/refresh` (item 19 is the safety-net for
    any refresh token minted in the race window between the admin's lock action and this call, or
    for tokens somehow already in flight — item 21 is the primary, immediate mechanism).

**Test gate (Section 4):**
```
npx vitest run app/api/auth/session/route.test.ts
npx vitest run app/api/auth/refresh/route.test.ts
npx vitest run features/admin-users/services/admin-users.repository.test.ts
```
New test cases: locked-user login attempt on session route returns rejection, not a fresh JWT pair
(AC3); locked-user refresh attempt is rejected AND a follow-up check confirms previously-valid
refresh tokens for that user no longer rotate after being bulk-revoked (AC4); unlocked account is
unaffected on both routes (AC5); N+1 rapid requests on session route — last one returns the
limiter's 429 rejection instead of proceeding to credential checks (AC8); same pattern on refresh
route (AC9); AC11 (fail-open when Redis unavailable) is proven in Section 5 below, not here —
`src/middlewares/rate-limit.middleware.test.ts` was confirmed DURING VALIDATE to not exist on disk
yet (despite the SPEC/original plan text calling it "existing") — it is created as new-file work in
Section 5 (which already touches this same file to add `emailStatusLimiter`), and its fail-open
case is a first-time test, not a regression check on a pre-existing file.
If `features/admin-users/services/admin-users.repository.test.ts` does not exist, create it scoped
to the `setLocked` → `revokeAllForUser` call.

---

### Section 5 — F5: Dedicated stricter limiter for email-status enumeration oracle

**Touchpoints:** `src/middlewares/rate-limit.middleware.ts` (new export), `app/api/auth/email-
status/route.ts`

22. In `src/middlewares/rate-limit.middleware.ts`, add a new exported limiter function following the
    exact pattern of `authLimiter`/`sessionLimiter` (lines 68-84) — e.g.
    `emailStatusLimiter`. Choose a threshold stricter than `authLimiter`'s `max: 20` (e.g. `max: 5`
    within the same `windowMs: 15 * 60 * 1000` window, or a shorter window with a low max — this is
    the PLAN-time parameter choice the SPEC explicitly delegates here; pick a concrete number during
    EXECUTE, document the chosen number and one-sentence rationale in the phase report). Use a
    distinct `code` (e.g. `"TOO_MANY_EMAIL_CHECKS"`) so client-side handling can distinguish this
    from the general auth limiter if ever needed.
23. In `app/api/auth/email-status/route.ts`, add the new limiter as the first guard clause inside
    the `POST` handler, before line 17's body parsing — same call shape as item 13
    (`const limited = await emailStatusLimiter(req); if (limited) return limited;`).
24. This route currently has NO auth/session requirement (intentionally — it's a pre-login check per
    its own docblock) and SPEC does not ask to add one; "add auth" in the SPEC's F5 description
    refers to adding the throttling guard itself, not a login requirement — do not add
    `authenticate()`/session checks to this route (that would break its documented pre-login use
    case in `AuthModal`). Confirm this reading matches the SPEC's actual AC12 wording (which only
    tests throttling, not auth) before implementing — if genuinely ambiguous, throttling-only is the
    correct, SPEC-consistent interpretation; do not gate this route behind login.

**Test gate (Section 5):**
```
npx vitest run app/api/auth/email-status/route.test.ts
npx vitest run src/middlewares/rate-limit.middleware.test.ts
```
New test file `app/api/auth/email-status/route.test.ts` (does not exist yet per repo scan) — assert
N+1 rapid requests from the same source return the new limiter's rejection response on the (N+1)th
attempt.

**[Added during VALIDATE — confirmed gap]** `src/middlewares/rate-limit.middleware.test.ts` does
NOT exist on disk (confirmed by direct filesystem check during VALIDATE), contrary to SPEC AC11's
and this plan's Section 4 original phrasing describing it as an "existing" test. CREATE this file as
part of Section 5's work (this section already modifies `rate-limit.middleware.ts` to add
`emailStatusLimiter`, so the new test file belongs here). It must cover TWO cases: (a) the new
`emailStatusLimiter`'s reject-after-N-requests behavior (this section's own new coverage), and (b)
`rateLimiter()`'s fail-open behavior when `redis` is `null` (mock `@/src/cache/redis` to export
`redis: null`, assert `rateLimiter()`/any exported limiter returns `null` and does not throw) —
this is what actually proves SPEC AC11, as a first-time test, not a re-run of a pre-existing file.

**Follow-up note (tracked, NOT part of this EXECUTE scope):** Confirm `REDIS_URL`/Redis is actually
provisioned in the production deployment. Per `rate-limit.middleware.ts:20-22`, `rateLimiter()`
returns `null` (no-op) when `redis` is falsy — this is the existing, intentionally-preserved
fail-open behavior (SPEC AC11, Constraints). If Redis is not provisioned in prod, F4/F5's code
changes land correctly but throttle nothing at runtime. This is a non-blocking infra prerequisite —
raise it explicitly in the EVL handoff / UPDATE PROCESS closeout, do not silently bury it inside the
F4/F5 code tasks above.

---

### Section 6 — F3: Blog stored XSS — write-time AND read-time sanitization (last, new dependency)

**Touchpoints:** new dependency `sanitize-html` (+ `@types/sanitize-html` if not bundled), new
shared utility (suggested path: `lib/sanitize-blog-html.ts` — a `lib/` module, matching the existing
convention of cross-cutting server utilities like `lib/cloudinary.ts`/`lib/payos.ts` living outside
any single feature folder, since this utility is called from both `features/admin-blog` and
`features/blog`), `features/admin-blog/services/admin-blog.repository.ts` (write-time, `toInsertPayload`
line ~74-88 and `toUpdatePayload` line ~91-108), `features/blog/services/blog.service.ts` (read-time,
`toBlogPost` line ~41-56)

25. Add `sanitize-html` as a new dependency (`npm install sanitize-html` + `npm install -D
    @types/sanitize-html` if types are not bundled — confirm during EXECUTE whether the package
    ships its own types).
26. Create `lib/sanitize-blog-html.ts` exporting a single function `sanitizeBlogHtml(html: string):
    string`. Configure ONE `sanitize-html` options object (not duplicated across call sites) with an
    allowlist matching SPEC Acceptance Criterion 7's exact list: paragraphs (`p`), headings (`h1`-
    `h6`), bold (`b`, `strong`), italic (`i`, `em`), links (`a` — with `href` attribute allowed,
    consider restricting to `http`/`https`/relative schemes only via `sanitize-html`'s
    `allowedSchemes` option to avoid `javascript:` URLs sneaking through an allowed tag), lists
    (`ul`, `ol`, `li`), images (`img` — with `src`, `alt` attributes allowed; do NOT allow `onerror`/
    `onload` or any `on*` event-handler attribute on any tag — `sanitize-html`'s default behavior
    already strips unrecognized attributes when using an explicit `allowedAttributes` allowlist, but
    verify no wildcard attribute config accidentally reopens this).
27. Wire `sanitizeBlogHtml()` into `features/admin-blog/services/admin-blog.repository.ts` at
    write-time: call it on `input.bodyHtml` before it is placed into `toInsertPayload()`'s `content`
    field (line ~83) and `toUpdatePayload()`'s `content` field (line ~102) — sanitize the value right
    before it enters the payload object in both functions, do not sanitize earlier (e.g. at the
    schema/Zod layer) since `admin-blog.schema.ts`'s `bodyHtml: z.string()` should remain a plain
    string validator (SPEC does not ask for a schema change).
28. Wire `sanitizeBlogHtml()` into `features/blog/services/blog.service.ts` at read-time: call it on
    `row.content` inside `toBlogPost()` (line ~54, where `bodyHtml: row.content` is currently set) —
    sanitize on the way OUT to `components/blog/BlogArticle.tsx`'s `dangerouslySetInnerHTML` (line
    57), not inside `BlogArticle.tsx` itself (keep the sanitization boundary at the service layer,
    consistent with `blog.service.ts` already being the seam between DB rows and the `BlogPost`
    shape the component consumes).
29. Do NOT modify `components/blog/BlogArticle.tsx` — its `dangerouslySetInnerHTML` usage is safe by
    construction once both write-time and read-time sanitization are in place; changing the render
    layer is unnecessary surface expansion beyond the SPEC's scope.
30. Confirm the SAME allowlist config object from step 26 is imported and reused (not re-declared)
    at both call sites in steps 27/28 — this is a hard requirement from INNOVATE to prevent config
    drift between write-time and read-time sanitization.

**Test gate (Section 6):**
```
npx vitest run lib/sanitize-blog-html.test.ts
npx vitest run features/admin-blog/services/admin-blog.repository.test.ts
npx vitest run features/blog/services/blog.service.test.ts
```
New test cases: a `<script>alert(1)</script>` payload and an `<img onerror=...>` payload never
survive `sanitizeBlogHtml()`'s output (AC6) — test this directly against the shared utility, and
additionally assert it end-to-end at the `blog.service.ts`/`admin-blog.repository.ts` boundary
(mocked Supabase row containing the payload in `content`, assert sanitized output on read/write);
an allow-listed-tag payload (paragraphs, headings, bold, italic, links, lists, images) survives
unchanged (AC7) — assert byte-for-byte on the shared utility directly.

---

## Public Contracts

- `POST /api/auth/session` — new possible response: 429 (rate-limited) before existing 401 checks;
  new possible rejection when the authenticated user's `is_deleted = true` (previously silently
  succeeded). No change to the success response shape.
- `POST /api/auth/refresh` — same two new rejection paths as above (429 and locked-user rejection).
  No change to the success response shape.
- `POST /api/contact` — new possible response: 429 (rate-limited); wiring only, `authLimiter`-style
  limiter already exists as infrastructure, this item wires it in (SPEC lists this under F4's "public
  contact form" wiring — confirm during EXECUTE which existing limiter tier is intended for contact;
  if ambiguous, reuse `globalLimiter` or `sessionLimiter`'s general tier rather than `authLimiter`
  since contact is not a credential-guessing surface — pick the closest-fit existing tier, do not
  invent new numbers per SPEC Constraints).
- `POST /api/auth/email-status` — new possible response: 429 (new dedicated stricter limiter); no
  change to the existing `{ exists: boolean }` success shape or any auth requirement.
- Checkout order-create failure path — no client-visible contract change; internal-only change (the
  orphaned PayOS link is cancelled server-side before the existing error response is returned).
- `InternalServerError` client-facing `message` text changes for the PayOS-misconfiguration and
  Cloudinary-upload-failure cases (F6) — any client code asserting on the literal previous message
  text would break; grep the codebase for any such literal string matches before EXECUTE completes.
- Blog `bodyHtml` on both admin-write and public-read paths is now passed through `sanitizeBlogHtml()`
  — any existing blog post content containing tags OUTSIDE the allowlist (e.g. `<table>`, `<iframe>`,
  inline `style` attributes) will be silently stripped on next write or next read. This is an
  intentional, accepted behavior per SPEC AC6/AC7 — flag it in the phase report as a known content-
  migration consideration (existing published posts are re-sanitized on next read, not retroactively
  migrated in DB).
- `next.config.ts` Cloudinary `remotePatterns.pathname` scoping — any currently-working image URL
  NOT under this project's own `CLOUDINARY_CLOUD_NAME` cloud (there should be none in legitimate use)
  will stop optimizing/loading via `next/image`.

## Touchpoints

Full file-level touchpoints are listed per checklist section above (Sections 1-6) and summarized
in Blast Radius below. Summary by domain:
- Payment/checkout: `features/checkout/services/checkout.service.ts`, `features/checkout/services/payos.service.ts`
- Auth/identity: `app/api/auth/session/route.ts`, `app/api/auth/refresh/route.ts`, `features/auth/services/refresh-token.service.ts`, `app/api/auth/email-status/route.ts`, `src/middlewares/rate-limit.middleware.ts`
- Admin: `features/admin-users/services/admin-users.repository.ts`
- Blog/content: `features/admin-blog/services/admin-blog.repository.ts`, `features/blog/services/blog.service.ts`, new `lib/sanitize-blog-html.ts`
- Public: `app/api/contact/route.ts`
- Infra: `next.config.ts`, `app/api/staff/uploads/route.ts`

## Blast Radius

10 files modified, 1 new file created (`lib/sanitize-blog-html.ts`), 1 new dependency added
(`sanitize-html`), 0 new routes, 0 schema/migration changes. Risk class: **auth/identity** (Section 4
— session/refresh routes, token revocation) and **billing** (Section 3 — checkout order-create path)
are both touched — both are named High-Risk Classes per orchestration.md, requiring hybrid-minimum
test tiers (satisfied here — all F1-F7 criteria are Fully-Automated per the SPEC's `strategy:`
annotations, which exceeds the hybrid minimum).

Modified files:
1. `next.config.ts` (F7)
2. `features/checkout/services/payos.service.ts` (F6)
3. `app/api/staff/uploads/route.ts` (F6)
4. `features/checkout/services/checkout.service.ts` (F1)
5. `app/api/auth/session/route.ts` (F2+F4)
6. `app/api/auth/refresh/route.ts` (F2+F4)
7. `features/auth/services/refresh-token.service.ts` (F2 — new `revokeAllForUser` method)
8. `features/admin-users/services/admin-users.repository.ts` (F2 — lock-time trigger)
9. `src/middlewares/rate-limit.middleware.ts` (F5 — new `emailStatusLimiter` export)
10. `app/api/auth/email-status/route.ts` (F5)
11. `app/api/contact/route.ts` (F4 — wire existing limiter)
12. `features/admin-blog/services/admin-blog.repository.ts` (F3 — write-time)
13. `features/blog/services/blog.service.ts` (F3 — read-time)

New files:
- `lib/sanitize-blog-html.ts` (F3 — shared allowlist utility)
- `lib/sanitize-blog-html.test.ts`
- `app/api/staff/uploads/route.test.ts` (if not already existing)
- `app/api/auth/email-status/route.test.ts`
- `app/api/contact/route.test.ts`
- `features/admin-users/services/admin-users.repository.test.ts` (if not already existing)
- `src/middlewares/rate-limit.middleware.test.ts` (confirmed net-new during VALIDATE — despite
  SPEC AC11's original "existing" framing; see Section 5 test gate note)

Not touched (explicitly out of scope): `components/blog/BlogArticle.tsx`, `proxy.ts`,
`features/admin-blog/schemas/admin-blog.schema.ts`, any migration file, coupon system, admin list
pagination.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| checkout.service.test.ts — create() fails after payOS link created → cancelPaymentLink called | Fully-Automated | AC1 |
| checkout.service.test.ts — existing COD test cases pass unmodified | Fully-Automated | AC2 |
| app/api/auth/session/route.test.ts — locked user login rejected | Fully-Automated | AC3 |
| app/api/auth/refresh/route.test.ts — locked user refresh rejected + prior tokens revoked | Fully-Automated | AC4 |
| session/refresh route tests — unlocked account unaffected (existing tests pass) | Fully-Automated | AC5 |
| lib/sanitize-blog-html.test.ts + BlogArticle render assertion — script/onerror payload stripped | Fully-Automated | AC6 |
| lib/sanitize-blog-html.test.ts — allow-listed tags survive unchanged | Fully-Automated | AC7 |
| app/api/auth/session/route.test.ts — N+1 requests → 429 | Fully-Automated | AC8 |
| app/api/auth/refresh/route.test.ts — N+1 requests → 429 | Fully-Automated | AC9 |
| app/api/contact/route.test.ts (new) — N+1 requests → 429 | Fully-Automated | AC10 |
| rate-limit.middleware.test.ts (NEW — confirmed non-existent during VALIDATE) — fail-open case proven for the first time, plus new emailStatusLimiter reject-after-N case | Fully-Automated | AC11 |
| app/api/auth/email-status/route.test.ts (new) — N+1 requests → dedicated limiter 429 | Fully-Automated | AC12 |
| payos.service.test.ts — client message excludes PAYOS_*/`.env` literal strings | Fully-Automated | AC13 |
| app/api/staff/uploads/route.test.ts — generic message regardless of thrown SDK error content | Fully-Automated | AC14 |
| next.config.test.ts (new) — remotePatterns.pathname includes cloud-name segment, not bare `/**` | Fully-Automated | AC15 |
| next.config.test.ts (new) — own-cloud URL still matches pattern | Fully-Automated | AC16 |

All 16 SPEC Acceptance Criteria are Fully-Automated per the SPEC's own `strategy:` annotations —
pulled verbatim from the SPEC file, not re-derived. No Hybrid or Agent-Probe tier is required or
used in this plan; this repo has Vitest only and every criterion is provable via mocked
Supabase/PayOS/Cloudinary/Redis clients per existing test-file conventions (`vi.mock`,
`// @vitest-environment node`, co-located `*.test.ts(x)`).

## Test Infra Improvement Notes

(none identified yet)

## Acceptance Criteria

All 16 SPEC Acceptance Criteria (F1-F7) from `full-codebase-review_SPEC_19-08-26.md` apply verbatim
to this plan — see the Verification Evidence table above for the 1:1 mapping of each criterion to
its proving test gate and strategy. No criteria are added, dropped, or reworded here; this plan
implements exactly the 16 locked SPEC criteria.

## Phase Completion Rules

- A checklist section (1-6) is **CODE DONE** when its listed checklist items are implemented and its
  per-section test gate command(s) run and exit green.
- A checklist section is **VERIFIED** only after: (a) CODE DONE, AND (b) the section's mapped
  Verification Evidence rows (SPEC Acceptance Criteria) are independently re-confirmed during EVL
  (vc-tester re-running the exact gate commands — execute-agent's own internal green claim is not
  sufficient per orchestration.md's EVL confirmation-run rule).
- The whole plan is **VERIFIED** only when all 6 sections are VERIFIED and the full regression suite
  (all commands listed under Verification Evidence + Section test gates) is green in one final pass.
- Do not mark any section VERIFIED based on code review alone — a green Vitest run is required
  evidence for every Fully-Automated criterion in this plan (all 16 are Fully-Automated).
- If a section's test gate cannot be made green within the plan's declared scope (e.g. a genuine
  blast-radius conflict discovered during EXECUTE), follow the EVL Hybrid Failure Resolution priority
  from `vc-test-coverage-plan`: fix now if in-scope, else create a follow-up plan/backlog note — do
  not silently mark the section done.

## Risks

- **F2/F4 file-overlap risk**: both edit `app/api/auth/session/route.ts` and
  `app/api/auth/refresh/route.ts`. Mitigated by combining into one Section 4 checklist item with a
  locked guard-clause order (rate-limit first, lock check second) — do not execute F2 and F4 as
  separate, uncoordinated edits.
- **F2 error-class ambiguity (item 15/19)**: `UnauthorizedError`'s exact HTTP status mapping needs
  confirming in `src/errors/app.error.ts` during EXECUTE — if it is strictly 401, using it for a
  "locked" (conceptually 403) case is a minor semantic mismatch but functionally still blocks the
  request, which is what SPEC AC3/AC4 actually test (rejection, not a specific status code). Do not
  invent a new error class solely for this — reuse the closest existing one; note the choice in the
  phase report.
- **F4 contact-route limiter tier choice (Public Contracts section)**: SPEC does not specify which
  existing tier (`authLimiter`/`sessionLimiter`/`globalLimiter`) applies to `/api/contact` — pick the
  closest-fit existing tier during EXECUTE (recommend `globalLimiter` or `sessionLimiter`, NOT
  `authLimiter`, since contact-form spam is not credential-guessing) and document the choice; this is
  a PLAN-time-deferred, EXECUTE-time-resolved parameter choice, consistent with how SPEC already
  treats F5's threshold number.
- **F5 threshold number**: not specified by SPEC (explicitly deferred to PLAN/EXECUTE) — pick a
  concrete `max`/`windowMs` stricter than `authLimiter`'s `max: 20` and document the number + one-
  line rationale in the phase report (item 22).
- **F3 content-migration side effect**: sanitizing at read-time means any EXISTING published blog
  post with out-of-allowlist tags will visibly change on next render (SPEC-accepted, see Public
  Contracts) — flag for the business/content team in the closeout, not a code risk but an editorial
  one.
- **Redis provisioning (F4/F5 infra prerequisite)**: tracked explicitly as a non-blocking follow-up
  note in Section 5, not silently buried in the code tasks — production must have `REDIS_URL` set
  for F4/F5 to have real throttling effect at runtime (existing fail-open behavior, unchanged by this
  plan, is preserved regardless).
- **VALIDATE-time corrections (audit note, 19-08-26)**: two factual inaccuracies inherited from the
  SPEC were found and fixed in-plan during VALIDATE, both non-blocking (0 FAILs): (1) the response
  envelope (`src/api/response.ts`) has NO `details` field — item 7a was added to Section 2 so
  diagnostic detail moved into `AppError.details` by F6 doesn't silently vanish from server logs
  too; (2) `src/middlewares/rate-limit.middleware.test.ts` does not exist on disk — Section 4/5 text
  corrected from "existing test" to an explicit new-file creation step in Section 5, which is what
  actually proves SPEC AC11.

## Dependencies

- New npm dependency: `sanitize-html` (+ `@types/sanitize-html` if needed) — Section 6 only, must
  land AFTER Sections 1-5 land cleanly per the low-risk-first execution order.
- No new environment variables. `CLOUDINARY_CLOUD_NAME` (F7) and `REDIS_URL` (F4/F5 follow-up) are
  both already-defined env vars, reused, not newly introduced.
- No DB migration required — `is_deleted` (F2) and `refresh_tokens` table (F2) already exist.

## Resume and Execution Handoff

1. **Selected plan file path:** `process/general-plans/active/full-codebase-review_19-08-26/full-codebase-review_PLAN_19-08-26.md`
2. **Last completed phase or step:** PLAN — this file. RESEARCH/SPEC/INNOVATE complete (see the SPEC
   file and the 5 domain review reports in this same task folder).
3. **Validate-contract status:** pending — see placeholder below, `vc-validate-agent` writes this
   section before EXECUTE.
4. **Supporting context files loaded during PLAN:** `full-codebase-review_SPEC_19-08-26.md` (locked
   SPEC, this task folder), all 5 `*_REPORT_19-08-26.md` files (this task folder) — read for
   file:line-level evidence beyond the SPEC's summary; direct source reads of
   `checkout.service.ts`, `payos.service.ts`, `rate-limit.middleware.ts`, `session/route.ts`,
   `refresh/route.ts`, `refresh-token.service.ts`, `admin-users.service.ts`,
   `admin-users.repository.ts`, `app/api/staff/uploads/route.ts`, `next.config.ts`,
   `lib/cloudinary.ts`, `contact.repository.ts`, `app/api/contact/route.ts`,
   `app/api/auth/email-status/route.ts`, `admin-blog.repository.ts`, `blog.service.ts` — confirmed
   exact current code shape referenced throughout this plan's checklist items.
5. **Next step for a fresh agent picking up mid-execution:** confirm which checklist sections (1-6)
   are already code-complete by checking git diff / running the per-section test gates listed above;
   resume at the first section whose test gate is not yet green, following the locked execution
   order (F7 → F6 → F1 → F2+F4 → F5 → F3).

## Validate Contract

Status: PASS
Date: 19-08-26
date: 2026-08-19
generated-by: outer-pvl

Parallel strategy: parallel-subagents (recommended for V2 fan-out; performed via deep-mode source-grounded review by this validate-agent — see Rationale)
Rationale: Score 3/7 (S2 schema/API/auth surface touched, S6 high-risk class in plan [auth/identity + billing], S7 5+ files in blast radius) → MEDIUM tier → parallel subagents recommended (4 Layer-1 dimension agents + 6 Layer-2 section agents ≈ 10-13 agents, well under the 30-agent cost-guard threshold). No S1/S3/S4/S5 signals (single-package repo, design already locked at INNOVATE, not a phase program, no explicit depth request).

Test gates (C3 5-column table — ADDITIVE; existing consumers still parse the legacy line form below it):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | orderRepository.create() throw after non-COD link created -> cancelPaymentLink called before error propagates | Fully-Automated | `npx vitest run features/checkout/services/checkout.service.test.ts` (new case) | B |
| AC2 | COD order-creation path unaffected by F1 change (no regression) | Fully-Automated | `npx vitest run features/checkout/services/checkout.service.test.ts` (existing cases unmodified) | B |
| AC3 | Locked (is_deleted=true) account cannot obtain new app JWT via POST /api/auth/session | Fully-Automated | `npx vitest run app/api/auth/session/route.test.ts` (new case) | B |
| AC4 | Locked account cannot refresh via POST /api/auth/refresh; all outstanding refresh tokens revoked | Fully-Automated | `npx vitest run app/api/auth/refresh/route.test.ts` (new case) | B |
| AC5 | Unlocked account unaffected on both session and refresh routes | Fully-Automated | existing session/refresh route tests continue to pass unmodified | B |
| AC6 | `<script>`/`onerror` payload in blog bodyHtml never survives into rendered/stored output | Fully-Automated | `npx vitest run lib/sanitize-blog-html.test.ts` (new file) + repository/service boundary assertions | B |
| AC7 | Allow-listed blog tags (p/h1-h6/b/strong/i/em/a/ul/ol/li/img) survive sanitization unchanged | Fully-Automated | `npx vitest run lib/sanitize-blog-html.test.ts` (new file) | B |
| AC8 | POST /api/auth/session rejects after authLimiter threshold exceeded | Fully-Automated | `npx vitest run app/api/auth/session/route.test.ts` (new N+1 case) | B |
| AC9 | POST /api/auth/refresh limited the same way | Fully-Automated | `npx vitest run app/api/auth/refresh/route.test.ts` (new N+1 case) | B |
| AC10 | POST /api/contact rejects after configured limiter threshold exceeded | Fully-Automated | `npx vitest run app/api/contact/route.test.ts` (new file — first test for this route) | B |
| AC11 | Rate limiter fail-open preserved when Redis unavailable (no hard outage) | Fully-Automated | `npx vitest run src/middlewares/rate-limit.middleware.test.ts` (NEW FILE — confirmed non-existent on disk during VALIDATE; corrected from SPEC's "existing test" framing, see Section 4/5 VALIDATE-time correction notes) | B |
| AC12 | POST /api/auth/email-status rejects after dedicated stricter limiter threshold exceeded | Fully-Automated | `npx vitest run app/api/auth/email-status/route.test.ts` (new file) | B |
| AC13 | PayOS misconfiguration error message excludes PAYOS_*/`.env` literal strings | Fully-Automated | `npx vitest run features/checkout/services/payos.service.test.ts` (new/updated case) | B |
| AC14 | Cloudinary upload SDK error message is generic regardless of thrown SDK error content | Fully-Automated | `npx vitest run app/api/staff/uploads/route.test.ts` (new file) | B |
| AC15 | next.config.ts Cloudinary remotePatterns.pathname scoped to own cloud-name segment, not bare `/**` | Fully-Automated | `npx vitest run next.config.test.ts` (new file) | B |
| AC16 | Own-cloud image URL still matches the scoped remotePatterns entry (no regression) | Fully-Automated | `npx vitest run next.config.test.ts` (new file, same as AC15) | B |

gap-resolution legend:
- A - proven now (gate passes in this cycle)
- B - fixed in this plan (gate added by this plan's checklist)
- C - deferred to a named later phase/plan
- D - backlog test-building stub (named residual; keep-active; continue)

C-4 reconciliation: all 16 rows above use the 3 proving strategies (Fully-Automated is the only one used here — no Hybrid or Agent-Probe rows exist because this repo is Vitest-only and every SPEC criterion is mockable per existing conventions, confirmed in `process/context/tests/all-tests.md`). Known-Gap is not used as a strategy anywhere in this contract — no developed behavior in this plan rests on Known-Gap alone (see Net-gate vacuous-green check below).

Legacy line form (retained so existing validate-contract consumers still parse):
- F1 (orphaned PayOS link): Fully-automated: `npx vitest run features/checkout/services/checkout.service.test.ts`
- F2+F4 (account lock + rate limiting, session/refresh): Fully-automated: `npx vitest run app/api/auth/session/route.test.ts && npx vitest run app/api/auth/refresh/route.test.ts && npx vitest run features/admin-users/services/admin-users.repository.test.ts`
- F3 (blog stored XSS): Fully-automated: `npx vitest run lib/sanitize-blog-html.test.ts && npx vitest run features/admin-blog/services/admin-blog.repository.test.ts && npx vitest run features/blog/services/blog.service.test.ts`
- F4 (contact rate limiting): Fully-automated: `npx vitest run app/api/contact/route.test.ts`
- F5 (email enumeration): Fully-automated: `npx vitest run app/api/auth/email-status/route.test.ts && npx vitest run src/middlewares/rate-limit.middleware.test.ts`
- F6 (error leakage): Fully-automated: `npx vitest run features/checkout/services/payos.service.test.ts && npx vitest run app/api/staff/uploads/route.test.ts`
- F7 (Cloudinary scoping): Fully-automated: `npx vitest run next.config.test.ts`

Failing stubs (Fully-Automated rows — TDD red-first starting point for execute-agent):

```
// AC1
test("should call cancelPaymentLink with (payosOrderCode, \"order_create_failed\") and rethrow the original error when orderRepository.create() throws after a non-COD payment link was created", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: create() throws after link created -> cancelPaymentLink called, original error rethrown")
})

// AC2
test("should leave the existing COD order-creation path byte-for-byte unaffected by the F1 change", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: COD path regression check")
})

// AC3
test("should reject POST /api/auth/session for a locked (is_deleted=true) account instead of minting a fresh JWT pair", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: locked user login rejected")
})

// AC4
test("should reject POST /api/auth/refresh for a locked account and revoke all of that user's outstanding refresh tokens", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: locked user refresh rejected + bulk revoke")
})

// AC5
test("should leave login and refresh working normally for an account with is_deleted=false", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: unlocked account unaffected regression check")
})

// AC6
test("should strip a <script>alert(1)</script> payload and an <img onerror=...> payload so they never survive into rendered/stored blog output", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: blog XSS payload stripped at write-time and read-time")
})

// AC7
test("should leave allow-listed blog formatting tags (p, h1-h6, b, strong, i, em, a, ul, ol, li, img) unchanged after sanitization", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: allow-listed tags survive unchanged")
})

// AC8
test("should reject the (N+1)th POST /api/auth/session request from the same source once authLimiter's threshold is exceeded", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: session route rate-limited")
})

// AC9
test("should reject the (N+1)th POST /api/auth/refresh request from the same source once authLimiter's threshold is exceeded", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: refresh route rate-limited")
})

// AC10
test("should reject the (N+1)th POST /api/contact submission from the same source once its configured limiter threshold is exceeded", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: contact route rate-limited (first test file for this route)")
})

// AC11
test("should preserve fail-open behavior (allow the request through) when the rate limiter's backing Redis store is unavailable", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: rate-limit fail-open when redis is null — NEW FILE, not a pre-existing regression check")
})

// AC12
test("should reject the (N+1)th POST /api/auth/email-status check from the same source once the dedicated stricter emailStatusLimiter threshold is exceeded", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: email-status dedicated limiter")
})

// AC13
test("should return a client-facing error message that never contains PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY, or .env when PayOS credentials are missing", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: payos misconfiguration message is generic")
})

// AC14
test("should return a fixed generic error message from app/api/staff/uploads/route.ts regardless of the underlying Cloudinary SDK error content", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: upload route error message is generic")
})

// AC15
test("should scope next.config.ts's Cloudinary remotePatterns.pathname to this project's own cloud-name segment instead of a bare /**", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: cloudinary remotePatterns scoped pathname")
})

// AC16
test("should continue matching an own-cloud image URL through the scoped remotePatterns entry (no regression on existing product/blog images)", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: own-cloud URL still matches pattern")
})
```

Dimension findings:
- Infra fit: PASS — single-package Next.js repo, no container/infra/port surface; all 20 touchpoint file paths confirmed to exist on disk via direct filesystem check; no new env vars (CLOUDINARY_CLOUD_NAME, REDIS_URL both already defined and reused); `sanitize-html` confirmed absent from package.json/package-lock.json, correctly identified as the one new dependency.
- Test coverage: PASS (after in-plan fix) — 2 CONCERNs found and resolved via plan-text updates during this VALIDATE pass (not left as unresolved gaps): (1) `src/middlewares/rate-limit.middleware.test.ts` was cited by SPEC AC11 and the original plan text as an "existing" test but was confirmed absent from disk — plan Section 5 now explicitly instructs creating it (covering both the new emailStatusLimiter case AND the AC11 fail-open case as first-time tests); (2) plan item 7's own conditional logic ("no code change required unless the read reveals details is silently dropped") was resolved by direct source read — `details` IS silently dropped (src/api/response.ts's ApiResponse.error has no details field; withErrorHandler never logs error.details) — plan Section 2 now has a new item 7a closing this gap with a one-line logger.warn extension. All 16 SPEC ACs remain Fully-Automated, matching this repo's Vitest-only test infra (confirmed via process/context/tests/all-tests.md) — no Hybrid/Agent-Probe/Known-Gap tier required, which exceeds the Hybrid minimum required for the two High-Risk Classes present (auth/identity, billing).
- Breaking changes: PASS — plan's own Public Contracts section correctly and completely enumerates every client-visible change found during source review (3 new 429 paths, locked-account rejection on 2 routes, 2 InternalServerError message-text changes, blog sanitization side-effect on existing content, Cloudinary pathname narrowing); no undocumented breaking change was found. Confirmed `UnauthorizedError` is 401-only and `ForbiddenError` (403) already exists in `src/errors/app.error.ts` — plan item 15's own decision logic ("use a distinct error class if one exists for 403") should resolve to `ForbiddenError`; this is passed to EXECUTE as an instruction below rather than a plan-text change, since AC3/AC4 only require rejection (not a specific status code) and the plan's existing language already anticipates and defers this choice correctly.
- Security surface: PASS — vc-security STRIDE quick-scan found no FAIL-level issues. F2/F4 guard-clause order (rate-limit first, then lock-check) is correctly locked in Section 4, preventing a DB-query-before-throttle timing issue. F3's sanitize-html allowlist plan (item 26) already anticipates the two most common misconfiguration risks (javascript: URI schemes via `<a href>`, on\* event-handler attributes) with explicit mitigation language. F1's cancellation is correctly fail-safe (log-only on cancel failure, never masks the original error) — noted as technically redundant with `cancelPaymentLink`'s own internal try/catch (confirmed: it never throws today, lines 76-86 of payos.service.ts) but harmless belt-and-suspenders, not a defect. Both named high-risk classes (auth/identity: Section 4; billing: Section 3) are correctly identified in the plan's own Blast Radius section.
- Section 1 (F7 Cloudinary scoping) feasibility: PASS — mechanical feasibility confirmed byte-exact against next.config.ts (lines 1-23) and lib/cloudinary.ts:4. No gaps, no conflicts. Highest-risk edit: template-literal typo in the pathname string — low risk, purely mechanical.
- Section 2 (F6 error leakage) feasibility: CONCERN -> resolved in-plan — mechanical feasibility confirmed against payos.service.ts:13-20 and app.error.ts:37-40 (near-exact line match). Gap found: item 7's own conditional logic was unresolved by the plan text; VALIDATE performed the read the plan deferred and closed it with new item 7a (see Test coverage dimension above for detail). No conflicts found. Highest-risk edit: none material — this section is a pure message-text change plus one logging line.
- Section 3 (F1 orphaned PayOS link) feasibility: PASS — mechanical feasibility confirmed at byte-exact precision: `orderRepository.create()` call site at checkout.service.ts:142 exactly matches the plan's cited line number; the `"retry_race_lost"` CAS-loss mirror pattern at line 285 also confirmed exact. No gaps, no conflicts. Highest-risk edit: ensuring the rethrow in item 11 preserves the original error identity (not swallowed by the inner try/catch) — plan's own item 11 already specifies this correctly.
- Section 4 (F2+F4 combined, session/refresh) feasibility: PASS — mechanical feasibility confirmed against both route files' current line numbers (session/route.ts, refresh/route.ts) and admin-users.repository.ts's `setLocked` (lines 92-108, exact match to plan's citation). No conflicts between the F2 and F4 edits in the combined-section approach. Highest-risk edit: the 403-vs-401 error-class choice for the lock rejection (item 15/19) — see Breaking changes dimension above; passed to EXECUTE as an instruction, not a blocker.
- Section 5 (F5 email enumeration) feasibility: CONCERN -> resolved in-plan — mechanical feasibility confirmed against rate-limit.middleware.ts's existing authLimiter/sessionLimiter pattern (lines 68-84) and email-status/route.ts's current shape. Gap found and fixed: the section's own test gate cited a test file that does not exist (see Test coverage dimension above). No conflicts. Highest-risk edit: choosing the concrete threshold number — plan already defers this correctly to EXECUTE with a documented rationale requirement.
- Section 6 (F3 blog stored XSS) feasibility: PASS — mechanical feasibility confirmed against admin-blog.repository.ts's toInsertPayload/toUpdatePayload, blog.service.ts's toBlogPost (line 54, bodyHtml: row.content — matches plan's ~line 54 citation), and BlogArticle.tsx's dangerouslySetInnerHTML at line 57 (byte-exact match to plan's citation). `sanitize-html` confirmed absent from dependencies — correctly flagged as new. No gaps, no conflicts. Highest-risk edit: ensuring the SAME allowlist config object is imported (not re-declared) at both write-time and read-time call sites — plan item 30 already makes this an explicit hard requirement.

Execute-Agent Instructions:

| # | Instruction | Trigger condition |
|---|---|---|
| E1 | For the lock-rejection error class (plan items 15 and 19), prefer `ForbiddenError` (403, already exists in `src/errors/app.error.ts`) over `UnauthorizedError` (401-only) — a distinct 403 class DOES exist in the taxonomy, which resolves the plan's own conditional ("use a distinct error class if one exists for 403") in favor of ForbiddenError. Document the final choice in the phase report either way — AC3/AC4 only assert rejection, not a specific status code, so this does not block EXECUTE if a different reasonable choice is made, but ForbiddenError is the more semantically correct default. | Section 4, items 15 and 19 |
| E2 | When implementing item 7a (new — added during VALIDATE), confirm the exact current line number of the `AppError` branch's `logger.warn` call in `src/middlewares/error-handler.middleware.ts` before editing (line ~50 at VALIDATE time) — do not assume the line number is still exact if other unrelated changes have landed on this file since VALIDATE. | Section 2, item 7a |
| E3 | When creating `src/middlewares/rate-limit.middleware.test.ts` (Section 5), mock `@/src/cache/redis` at the module boundary (`vi.mock`) the same way other repository tests mock the Supabase client boundary, per `process/context/tests/all-tests.md`'s documented mocking convention — set `redis: null` for the fail-open case and a working mock for the emailStatusLimiter reject-after-N case. | Section 5, new test file |
| E4 | Sections 3 (F1, billing) and 4 (F2+F4, auth/identity) touch named High-Risk Classes per `orchestration.md` (billing/destructive-writes and auth/identity respectively). Test coverage already exceeds the Hybrid minimum (Fully-Automated), so this is process guidance, not a blocking requirement: consider a manual-first evidence pack per `vc-risk-evidence-pack` before treating these two sections as ready for finalize/push, particularly the token-revocation and payment-cancellation code paths. | Sections 3 and 4, before EVL closeout |
| E5 | When configuring `sanitize-html`'s options object in `lib/sanitize-blog-html.ts` (item 26), explicitly extend (not silently rely on) the library's default `allowedSchemes`/`allowedAttributes` base — confirm during EXECUTE that no wildcard attribute config accidentally reopens an `on*` event-handler or `javascript:` URI path; the plan's own item 26 already flags this, this instruction elevates it from a checklist reminder to an execute-agent verification step. | Section 6, item 26 |

Open gaps: none — the 2 CONCERNs found during this VALIDATE pass (missing test file misdescribed as "existing"; response-envelope details field claim was inaccurate) were both resolved via in-plan checklist additions (Section 2 item 7a; Section 5 test-gate creation note) rather than left open. No FAILs were found. No Known-Gap rows exist in the Test gates table above.

What this coverage does NOT prove:
- AC1/AC2 (checkout.service.test.ts): does not prove behavior under concurrent/racing order-create requests beyond the existing CAS-loss handling already covered by retryPayment's tests — this plan's new cases are sequential-call assertions on mocked repositories, not a live-DB race simulation.
- AC3/AC4/AC5 (session/refresh route tests): does not prove Supabase Auth's own session-cookie behavior end-to-end (mocked at the Supabase client boundary) — a live Supabase session expiring mid-request is not exercised.
- AC6/AC7 (sanitize-blog-html tests): does not prove browser-level rendering safety beyond jsdom's dangerouslySetInnerHTML simulation — no real-browser XSS execution probe (this repo has no Playwright/e2e, consistent with the SPEC's own testing constraint).
- AC8/AC9/AC10/AC11/AC12 (rate-limit tests): does not prove real-world throttling effectiveness in production — all rely on a mocked/null Redis client; whether `REDIS_URL` is actually provisioned in production is explicitly tracked as a separate non-blocking follow-up note in plan Section 5 (not part of this EXECUTE scope), consistent with SPEC AC11 and the Constraints section's fail-open acceptance.
- AC13/AC14 (error-message tests): does not prove server-side log completeness beyond the new item 7a's one-line logger extension — no test asserts logger-call arguments (this repo has no existing convention for that, confirmed during VALIDATE).
- AC15/AC16 (next.config tests): does not prove actual image-loading behavior through Next's real image optimizer at runtime — assertions are against the exported config object shape only, no live `next/image` request is made.
(Required until C3 is implemented — temporary C3 mitigation)

Gate: PASS (no FAILs, plan updated — 2 CONCERNs found during V2 fan-out were resolved via in-plan checklist additions before this contract was written)
Accepted by: N/A — Gate is PASS; no unresolved CONCERNs remain that require explicit acceptance. Both CONCERNs found during VALIDATE (Section 2 item 7a; Section 5 rate-limit.middleware.test.ts creation note) were fixed in the plan text itself, not carried forward as accepted gaps.

## Autonomous Goal Block

SESSION GOAL: Fix 7 Critical production-readiness issues (F1-F7) found by the 19-08-26 full-codebase review — orphaned PayOS payment link, account-lock enforcement, blog stored XSS, rate limiting on session/refresh/contact, email-enumeration throttling, internal error-message leakage, open Cloudinary image proxy.
Charter + umbrella plan: N/A — single COMPLEX plan (not a phase program). This plan file IS the governing artifact: `process/general-plans/active/full-codebase-review_19-08-26/full-codebase-review_PLAN_19-08-26.md`
Autonomy: Standard RIPER-5 autonomy rules apply (process/development-protocols/orchestration.md §Autonomy Mode) — CONDITIONAL findings apply-and-proceed, BLOCKED items go to backlog with continuation, irreversible/outward-facing actions without explicit contract instruction are a hard stop. This plan currently carries Gate: PASS with 0 open gaps, so no autonomous-acceptance decisions are pending.
Hard stop conditions / safety constraints:
- Do not touch anything listed in the SPEC's Out Of Scope section (Medium/High/Low findings, password-reset flow, CSP rollout, coupon system, proxy.ts edge-gating scope, email-status response-shape change) even if adjacent code looks related.
- Section 4 (F2+F4) touches the SAME two files (session/route.ts, refresh/route.ts) — execute as ONE combined change per file with the locked guard-clause order (rate-limit first, then is_deleted check), never as two separate uncoordinated edits.
- Do not mark any checklist section VERIFIED based on code review alone — a green Vitest run is required evidence for every criterion (all 16 are Fully-Automated).
- Section 6 (F3, new `sanitize-html` dependency) must land LAST, after Sections 1-5 land cleanly, per the plan's locked low-risk-first execution order (F7 -> F6 -> F1 -> F2+F4 -> F5 -> F3).
- Sections 3 and 4 touch named High-Risk Classes (billing, auth/identity) — see Execute-Agent Instruction E4 above regarding evidence-pack consideration before treating those sections as finalize-ready.
Next phase: EXECUTE — spawn vc-execute-agent with this plan file path and this validate-contract's gate status (PASS) and test gate commands.
Validate contract: inline in this plan file, section `## Validate Contract` above.
Execute start: `npx vitest run <section-specific test file(s), per each section's Test gate block above>` | no e2e spec exists in this repo (Vitest-only, confirmed via process/context/tests/all-tests.md) | no agent-probe scenario required (all 16 criteria are Fully-Automated) | high-risk pack: recommended-not-required (see E4) — yes for Sections 3 and 4 if the team wants belt-and-suspenders evidence before merge, no otherwise since test coverage already exceeds the Hybrid minimum.
