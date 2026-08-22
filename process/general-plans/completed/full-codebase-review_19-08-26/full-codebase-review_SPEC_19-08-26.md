---
name: spec:full-codebase-review-critical-fixes
description: "SPEC for fixing 7 Critical production-readiness issues found by the 19-08-26 full-codebase review (payment, auth, admin, public, infra domains)"
date: 19-08-26
metadata:
  node_type: memory
  type: spec
  feature: N/A
  phase: spec
---

# SPEC — Fix 7 Critical Production-Readiness Issues (Full Codebase Review, 19-08-26)

## Summary

On 19-08-26 we ran a full-codebase production-readiness review across five domains (payment/checkout,
auth/security, admin/staff back-office, public-facing site, shared infra). The review found 7 issues
rated Critical — the kind that either lose real money, let a "banned" user keep using the site, let an
attacker script-inject the public blog, or let anyone use our servers as a free image proxy. This SPEC
locks down what "fixed" means for each of the 7, so the next phase (INNOVATE) can pick how to build the
fix without re-litigating what the fix should accomplish. Nothing here is a new feature — every item is
closing a gap in something that already exists and is already live.

Two of the seven (account-lock enforcement and rate limiting) touch the exact same two files
(`app/api/auth/session/route.ts` and `app/api/auth/refresh/route.ts`) — this is called out explicitly so
PLAN/EXECUTE can sequence or scope them to avoid a merge conflict, not because they depend on each other.

## User Stories / Jobs To Be Done

1. **As the business owner**, I want a customer's money to never be taken without a corresponding order
   record, so that no customer pays and gets nothing, and there is always a trail if something goes wrong.
2. **As an admin**, when I lock a staff or customer account, I want that person locked out immediately —
   not just shown as "locked" in my dashboard while they can still log in and use the site.
3. **As a site visitor reading the blog**, I want the page to never run a script that a staff account
   (compromised or malicious) planted in a post, so my session and browser stay safe just from reading
   an article.
4. **As the business**, I want login, session-refresh, and the contact form to resist being hammered by
   bots/attackers, so a single bad actor can't brute-force logins, spam the inbox, or run up my costs.
5. **As a customer**, I want the app to not tell a stranger whether my email address has an account here,
   so my being a customer of this store isn't something anyone can probe for.
6. **As a customer**, when something goes wrong on the server (like a misconfigured payment key), I want
   a generic, safe error message — not a message that reveals which internal secret is missing or what
   the internal system looks like.
7. **As the business**, I want our image-optimization endpoint to only ever serve our own product/blog
   images — not become a free, anonymous image proxy for anyone else's Cloudinary account.

## What The User Wants (Behavioral Outcomes)

- **F1 — Orphaned PayOS payment link.** If placing an order fails for any reason *after* a PayOS payment
  link was created, that payment link stops being usable/payable. No live, payable link should ever exist
  without a matching order in the system.
- **F2 — Account lock.** The moment an admin locks an account, that person can no longer obtain a new
  session (login) and can no longer refresh an existing session. A locked account is functionally logged
  out and stays logged out until unlocked.
- **F3 — Blog stored XSS.** Blog post content saved by staff and shown to the public can never execute as
  script in a visitor's browser, regardless of what characters/tags a staff account submits.
- **F4 — Rate limiting.** Login (session-mint), session-refresh, and the public contact form each reject
  excessive rapid-fire requests from the same source instead of processing every request.
- **F5 — Email enumeration.** Checking whether an email is registered is throttled hard enough that
  scraping the full customer list is not practical.
- **F6 — Internal error leakage.** Any error response sent to a client (customer, staff, or attacker)
  never contains internal configuration names, environment variable names, or raw third-party SDK error
  text. Server-side logs still get the full diagnostic detail.
- **F7 — Open image proxy.** The image optimizer only accepts image URLs that belong to this project's own
  Cloudinary account/cloud — a URL pointing at any other Cloudinary account is rejected.

## Flow / State Diagram

### F1 — Order creation must not leave an orphaned payable link

```
[Customer confirms checkout]
        |
        v
  resolvePayment() -- non-COD --> [PayOS payment link created: LIVE, payable]
        |
        v
  orderRepository.create()
        |
   +----+----+
   | success |  failure (order_code collision OR stock race lost)
   v         v
[Order row  [PAYOS LINK MUST BE CANCELLED]
 exists,     |
 link is     v
 valid]    [Link is now unusable -- webhook has nothing to no-op silently against]
```

Today the failure branch does nothing to the link (this is C1). After the fix, every failure branch on
this path ends in the link being cancelled — no exceptions, no silent branch.

### F2 / F4 overlap — same two files, two independent requirements

```
app/api/auth/session/route.ts   (login / mint)          app/api/auth/refresh/route.ts (rotate)
        |                                                          |
        v                                                          v
 [1. Rate limit check]  <-- F4                          [1. Rate limit check]  <-- F4
        |                                                          |
        v                                                          v
 [2. is_deleted (locked) check]  <-- F2                 [2. is_deleted (locked) check]  <-- F2
        |  reject if locked/limited                                |  reject if locked/limited
        v                                                          v
 [3. Mint app JWT]                                       [3. Rotate refresh token]
```

F2 and F4 are independent requirements that both add a guard clause to the same two route handlers.
Neither depends on the other's outcome, but both must land without clobbering each other — the ordering
of the two checks and how each returns its rejection response should be decided once, together, not by
two separate uncoordinated edits.

### F3 — Blog content pipeline, before vs after

```
BEFORE (unsafe):
staff writes bodyHtml --> stored verbatim --> dangerouslySetInnerHTML on public /blog/[slug]
                                                        |
                                                        v
                                          any <script>/onerror runs in every visitor's browser

AFTER (required):
staff writes bodyHtml --> [content is neutralized against script execution]
                              at write time and/or read time --> rendered on /blog/[slug]
                                                        |
                                                        v
                                          no script tag/attribute ever executes, safe markup only
```

## Acceptance Criteria (Testable Outcomes)

**F1 — Orphaned PayOS link**

1. When `orderRepository.create()` throws after a non-COD payment link was created, the payment link is
   cancelled before the error propagates to the client.
   `proven by:` checkout.service.test.ts — new case mirroring the existing "payOS fails → create is NOT
   called" test but for the reverse direction ("create fails → cancelPaymentLink IS called").
   `strategy:` Fully-Automated (vitest, mocked PayOS + Supabase clients — matches existing test pattern
   in this file).
2. COD orders (no payment link ever created) are unaffected by this change — no regression on the
   existing COD order-creation path.
   `proven by:` checkout.service.test.ts — existing COD test cases continue to pass unmodified.
   `strategy:` Fully-Automated (vitest).

**F2 — Account lock enforcement**

3. A locked (`is_deleted = true`) account cannot obtain a new app JWT via `POST /api/auth/session`, even
   with valid Supabase credentials — the request is rejected.
   `proven by:` new test on `app/api/auth/session/route.test.ts` — locked user login attempt returns a
   rejection, not a fresh JWT pair.
   `strategy:` Fully-Automated (vitest, mocked Supabase + DB layer).
4. A locked account cannot rotate/refresh an existing session via `POST /api/auth/refresh` — the request
   is rejected and (per the default decision in Constraints) all of that user's outstanding refresh
   tokens are revoked so already-issued tokens stop working too, not just new ones.
   `proven by:` new test on `app/api/auth/refresh/route.test.ts` — locked user refresh attempt is
   rejected; a follow-up check confirms previously valid refresh tokens for that user no longer rotate.
   `strategy:` Fully-Automated (vitest).
5. An unlocked account is unaffected — login and refresh continue to work normally for accounts with
   `is_deleted = false`.
   `proven by:` existing session/refresh route tests continue to pass unmodified.
   `strategy:` Fully-Automated (vitest).

**F3 — Blog stored XSS**

6. Given a blog post whose `bodyHtml` contains a `<script>` tag or an `onerror`/`onload`-style event
   handler attribute, the content actually rendered on `/blog/[slug]` never executes that script — the
   dangerous tag/attribute is stripped or neutralized before being sent to the browser.
   `proven by:` new render-level test (component test on `BlogArticle.tsx` and/or a service-level test on
   the sanitization step) asserting a payload string containing `<script>alert(1)</script>` and an
   `<img onerror=...>` payload never survive into the rendered/stored output.
   `strategy:` Fully-Automated (vitest + jsdom — this repo's default test environment already supports
   component rendering assertions).
7. Legitimate formatting HTML that staff already relies on (basic tags: paragraphs, headings, bold,
   italic, links, lists, images) continues to render correctly after the fix — the fix does not strip
   safe content.
   `proven by:` same test file as #6 — an allow-listed-tag payload is asserted to survive unchanged.
   `strategy:` Fully-Automated (vitest).

**F4 — Rate limiting wired to real routes**

8. `POST /api/auth/session` rejects further attempts from the same source once the existing
   `authLimiter` threshold is exceeded within its configured window.
   `proven by:` new test on `app/api/auth/session/route.test.ts` — N+1 rapid requests, last one asserted
   to return the limiter's rejection response instead of proceeding to credential checks.
   `strategy:` Fully-Automated (vitest, mocked Redis/limiter — mirrors how `rate-limit.middleware.ts` is
   already isolated and testable).
9. `POST /api/auth/refresh` is limited the same way.
   `proven by:` new test on `app/api/auth/refresh/route.test.ts`, same pattern as #8.
   `strategy:` Fully-Automated (vitest).
10. `POST /api/contact` rejects further submissions from the same source once its configured limiter
    threshold is exceeded.
    `proven by:` new test on `app/api/contact/route.test.ts` (this route currently has zero test
    coverage per the public-facing review — this is also the first test file for this route).
    `strategy:` Fully-Automated (vitest).
11. When the rate limiter's backing store (Redis) is unavailable, the limiter's existing fail-open
    behavior is preserved (a missing Redis must not turn into a hard outage for login/contact) — this is
    documented as a known, accepted trade-off, not silently changed by this work.
    `proven by:` existing `rate-limit.middleware.test.ts` fail-open case continues to pass unmodified;
    no new gate required beyond confirming no regression.
    `strategy:` Fully-Automated (vitest).

**F5 — Email enumeration**

12. `POST /api/auth/email-status` rejects further checks from the same source once a strict,
    dedicated limiter threshold (stricter than the general auth limiter) is exceeded.
    `proven by:` new test on `app/api/auth/email-status/route.test.ts`.
    `strategy:` Fully-Automated (vitest).

**F6 — Internal error leakage**

13. When `PAYOS_CLIENT_ID`/`PAYOS_API_KEY`/`PAYOS_CHECKSUM_KEY` are missing, the JSON error response a
    checkout client receives contains a generic, safe message — it never contains the literal env var
    names or the "kiem tra lai file .env" config-file hint. The full diagnostic detail is still available
    server-side (logged and/or in the `details` field the response envelope already supports but doesn't
    surface to the client).
    `proven by:` payos.service.test.ts — new/updated case asserting the thrown error's client-facing
    `message` does not contain `PAYOS_CLIENT_ID`/`PAYOS_API_KEY`/`PAYOS_CHECKSUM_KEY`/`.env`.
    `strategy:` Fully-Automated (vitest — this is a pure string-content assertion on an existing tested
    module).
14. When the Cloudinary upload SDK throws during a staff upload, the JSON error response returned by
    `app/api/staff/uploads/route.ts` contains a generic, safe message — never the raw caught SDK error
    text.
    `proven by:` new test on `app/api/staff/uploads/route.test.ts` (or extending an existing test file
    for this route if one exists) asserting the response body's `message` is a fixed generic string
    regardless of the underlying thrown error's content.
    `strategy:` Fully-Automated (vitest, mocked Cloudinary SDK throwing an arbitrary error).

**F7 — Open Cloudinary image proxy**

15. `next.config.ts`'s `images.remotePatterns` entry for Cloudinary scopes `pathname` to this project's
    own cloud name (read from `CLOUDINARY_CLOUD_NAME`), not a wildcard `/**` that matches every
    Cloudinary account.
    `proven by:` new lightweight config test asserting the exported Next.js config's Cloudinary
    `remotePatterns` entry's `pathname` value includes the project's cloud-name segment rather than a
    bare `/**`.
    `strategy:` Fully-Automated (vitest — a plain assertion against the imported/parsed config object,
    no browser or network involved).
16. A same-domain image URL under this project's own cloud name continues to work through the image
    optimizer (no regression on existing product/blog images).
    `proven by:` same config test file as #15 — an existing-shape "own cloud" URL is asserted to still
    match the pattern.
    `strategy:` Fully-Automated (vitest).

## Out Of Scope

- Any Medium/High/Low-severity finding not listed as one of the 7 Critical issues above (e.g. unbounded
  admin list queries, missing security response headers, dead dependencies, missing password-reset flow,
  weak password policy, upload magic-byte sniffing, JWT algorithm pinning, JWT-secret boot-time
  validation, CORS/audit-log dead-code wiring, coupon discount upper bound, refresh-token-family-wide
  revocation on reuse detection beyond what F2 already requires for the lock case specifically). These
  are tracked in the five domain review reports as backlog candidates for a future pass.
- Changing the email-status endpoint's response shape (boolean exists vs. a generic "check your email"
  copy pattern) — F5 only adds throttling, it does not change what the endpoint tells the caller.
- Adding a general-purpose structured audit-log / CORS layer (M2 in the auth report) — out of scope.
- Building a password-reset ("forgot password") flow — out of scope, unrelated to the 7 Critical items.
- Any change to the coupon system, checkout coupon redemption, or admin list pagination — out of scope,
  these are separate (non-Critical) findings.
- Choosing the specific HTML-sanitization library, rate-limit threshold numbers beyond what the existing
  `rate-limit.middleware.ts` already defines, or the exact mechanism for the F1 cancel-on-failure call —
  those are implementation approach decisions and belong to INNOVATE/PLAN, not this SPEC.
- Any change to `proxy.ts` edge-gating scope (e.g. adding `/account/**`) — unrelated to these 7 items.
- Building a full Content-Security-Policy or other security-header rollout — out of scope (High-priority
  item in the shared-infra report, not Critical).

## Constraints

- Must not require a rearchitecture of the two-layer auth model (Supabase Auth + app JWT) — fixes are
  additive guard clauses, not a redesign.
- Must not weaken the existing "nullable client, guard at call site" convention used across
  PayOS/Resend/Redis/Cloudinary clients.
- F1's fix must mirror the pattern already correctly implemented in `retryPayment()` (cancel-on-CAS-loss)
  rather than inventing a new failure-handling convention.
- F2 and F4 both edit `app/api/auth/session/route.ts` and `app/api/auth/refresh/route.ts` — PLAN must
  sequence or explicitly co-scope these two items to avoid a merge conflict; they are not sequence-
  dependent on each other (order does not matter functionally), only file-overlap-dependent.
- F3's fix must not break existing legitimate blog formatting relied on by staff today (see Acceptance
  Criterion 7) — this is a hard constraint, not a nice-to-have.
- **Default decision — F2 lock severity:** lock is a hard block: new session mint AND refresh are both
  rejected, and locking an account revokes that user's outstanding refresh tokens (matching the
  cross-confirmed recommendation from both the admin-backoffice and auth-security reports). This default
  is adopted here so the SPEC has no open blocking question; if the business wants a softer "block new
  logins only, let existing sessions expire naturally" behavior instead, that is a one-line change to
  Acceptance Criterion 4 before PLAN starts.
- **Default decision — F3 sanitization layering:** sanitize at both write-time and read-time (defense in
  depth), per both the admin-backoffice and public-facing reports' shared recommendation ("prefer both").
- **Default decision — F4/F5 thresholds:** reuse the already-built `authLimiter`/`sessionLimiter`
  thresholds in `src/middlewares/rate-limit.middleware.ts` for F4; F5 (email-status) gets a new, stricter
  dedicated limiter tier since both security reports flag the existing tiers as too loose for an
  enumeration-oracle endpoint. No new threshold numbers are specified here — that is a PLAN-time
  parameter choice within the existing limiter framework, not a new design.
- **Default decision — F6 client-facing messages:** use the response envelope's existing but currently
  unused `details` field for the safe pattern already correct in `features/contact/services/
  contact.repository.ts` — copy that pattern rather than inventing a new one.
- Testing constraint: this repo has Vitest only (no Playwright/e2e). All acceptance criteria above must be
  provable with Vitest unit/integration tests using this repo's existing mocking conventions (mocked
  Supabase client via `vi.mock`, mocked PayOS/Cloudinary/Redis clients) — no criterion in this SPEC
  requires a live external service or a browser automation tool.

## Open Questions

None outstanding. Three items that could have been blocking product-policy questions were resolved with
explicit, cross-confirmed defaults recorded under Constraints above (F2 lock severity, F3 sanitization
layering, F4/F5 threshold reuse) so PLAN is not blocked. If any default is wrong for the business, it is
a one-line correction to the relevant Acceptance Criterion before PLAN starts — flagging here for
visibility:

- F2 default (hard revoke on lock) assumes "locked" should mean "fully logged out everywhere," not just
  "can't log in again." Owner: user — confirm or override before/at PLAN kickoff.
- F4/F5 assumes Redis (`REDIS_URL`) is actually provisioned in the production deployment; if it is not,
  the rate limiter's existing fail-open behavior means F4/F5 will not actually throttle anything at
  runtime even after the wiring fix lands. Owner: user — confirm Redis is provisioned in production, or
  flag as a prerequisite/parallel infra task.

## Background / Research Findings

Source: five parallel domain-scoped `vc-code-reviewer` production-readiness audits, all dated 19-08-26,
read in full for this SPEC:

- `process/general-plans/active/full-codebase-review_19-08-26/payment-checkout-review_REPORT_19-08-26.md`
  — C1: orphaned PayOS link on `orderRepository.create()` failure (checkout.service.ts:132-159,
  order.repository.ts:140-200). No try/catch exists today; `retryPayment()` already has the correct
  cancel-on-failure pattern to mirror.
- `process/general-plans/active/full-codebase-review_19-08-26/auth-security-review_REPORT_19-08-26.md`
  — C1: rate limiting built (`authLimiter`, `sessionLimiter`, `globalLimiter`,
  `withAuthRateLimit`) but wired into zero routes (confirmed by repo-wide grep). C2: `POST
  /api/auth/email-status` is an unauthenticated, unthrottled enumeration oracle. C3: account lock
  (`setLocked` → `is_deleted`) is never checked by `/api/auth/session` or `/api/auth/refresh`.
- `process/general-plans/active/full-codebase-review_19-08-26/admin-backoffice-review_REPORT_19-08-26.md`
  — C1 independently cross-confirms the same account-lock gap with the exact same file evidence (own
  in-code comment admits it: "locking here only changes the display flag ... login is NOT YET enforced to
  be blocked"). C2 independently cross-confirms the blog stored-XSS gap end-to-end (schema → editor
  textarea → repository → `dangerouslySetInnerHTML` in `BlogArticle.tsx`), and notes `features/policies`
  already handles the analogous admin-authored-content case safely (plain-text rendering, no
  `dangerouslySetInnerHTML`) as the reference pattern to match or to sanitize against.
- `process/general-plans/active/full-codebase-review_19-08-26/public-facing-review_REPORT_19-08-26.md`
  — C1 independently cross-confirms blog XSS from the read-side render path
  (`blog.service.ts` → `BlogArticle.tsx`), confirms zero sanitizer package exists anywhere in the repo.
  H1 independently cross-confirms rate limiting is wired to zero routes, specifically calling out the
  public contact form (`POST /api/contact`) as unauthenticated and fully unthrottled, with zero test
  coverage today.
- `process/general-plans/active/full-codebase-review_19-08-26/shared-infra-review_REPORT_19-08-26.md`
  — Critical #1: `InternalServerError` messages leak verbatim to clients in two call sites
  (`payos.service.ts:15-17` naming the exact missing PayOS env vars; `app/api/staff/uploads/
  route.ts:22-24,49-51` forwarding raw Cloudinary SDK error text). `features/contact/services/
  contact.repository.ts:45-47` already does this correctly (diagnostic detail in the unused `details`
  field, safe generic string in `message`) and is the pattern to copy. Critical #2:
  `next.config.ts`'s `images.remotePatterns` scopes Cloudinary by hostname only
  (`pathname: "/**"`), making the image optimizer usable as a free proxy for any Cloudinary account's
  content, not just this project's own (`CLOUDINARY_CLOUD_NAME` is already read at runtime in
  `lib/cloudinary.ts` and can be reused at config-build time).

Cross-domain confirmation pattern worth noting: two findings (account lock, blog XSS) were independently
discovered by two separate domain reviewers reading different code paths (write-side vs. read-side, or
admin-domain vs. public-domain), which is a strong signal both are real, not reviewer noise.

Repo test context (from `process/context/tests/all-tests.md`): Vitest is the only test runner in this
repo (no Playwright/e2e suite exists). Existing conventions this SPEC's acceptance criteria rely on:
`vi.mock` at the Supabase-client module boundary, `// @vitest-environment node` docblock for
server-only-guarded files, `test.env` hardcoded JWT test secrets (no real `.env` needed to run tests),
and co-located `*.test.ts(x)` files next to source.
