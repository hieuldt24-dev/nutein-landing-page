# Auth & Security Domain — Production-Readiness Review

Date: 2026-08-19
Scope: full-domain audit (not a diff review) — features/auth/**, src/middlewares/*.middleware.ts,
proxy.ts, app/auth/**, app/api/auth/**, lib/supabase*.ts, lib/useAuthStore.ts,
components/shared/AuthModal*.

## TL;DR

The hybrid Supabase + custom-JWT model is well-built where it is wired up: every /staff/** and
/admin/** API route independently calls authenticate() + requireRole() (proxy.ts is correctly
treated as UX-only, not the security boundary), refresh-token rotation with reuse detection
exists, and every repository that uses the RLS-bypassing supabaseAdmin client scopes queries by
user_id. But three things will hurt in production: rate limiting is fully built but never wired
into any route (login/session/refresh are all unlimited), admin "lock account" does not actually
block the locked user from getting a new session (session mint and refresh never check
is_deleted), and the file-upload endpoint accepts attacker-controlled filenames/extensions with
only a client-supplied MIME-type check, letting SVG/script payloads land in the public static
tree. Fix these three before shipping; the rest is hardening.

---

## Scope

- Files read: 15 files in features/auth/** (schemas, 5 services, sanitize-return-to, constants,
  types), 10 files in src/middlewares/*.middleware.ts, proxy.ts, app/auth/callback/route.ts,
  all 4 files in app/api/auth/**, lib/supabase.ts, lib/supabase-server.ts,
  lib/supabase-browser.ts, lib/useAuthStore.ts, lib/openAuthModal.ts, lib/api-client.ts,
  components/shared/AuthModal.tsx. Cross-checked against every app/api/staff/**,
  app/api/admin/**, app/api/account/**, app/api/checkout/** route handler and the
  admin-users/account-address repositories that consume supabaseAdmin.
- LOC: roughly 1,800 across the domain (excluding tests).
- Focus: full domain as it exists on disk today (not a recent diff).
- Scout findings: see dedicated section below — scout was file-discovery via Grep/Glob rather
  than a spawned subagent, scoped to this domain per the request.

## Overall Assessment

Solid foundation, three production blockers. The two-layer model (Supabase Auth for
identity/OAuth, app JWT cookie nutein_access_token for authorization) is consistently applied:
every sensitive route pairs authenticate() (identity) with requireRole() (authorization) — no
route was found that checks only one. proxy.ts own comments correctly document that it is an
edge-optimistic UX gate, not the real security boundary, and the real boundary (per-route
authenticate/requireRole) is verified present on all 16 staff/admin API routes and all
account/checkout routes that need it. Refresh-token handling (hash storage, rotation, reuse
detection, revoke-on-logout) is above the median for a solo-dev project. The gaps are concrete
and fixable, not architectural.

---

## Critical Issues

### C1. Rate limiting is built but wired into zero routes
src/middlewares/rate-limit.middleware.ts implements authLimiter, sessionLimiter, globalLimiter,
and withAuthRateLimit (Redis INCR+EXPIRE sliding window, fail-open when Redis is absent). A
repo-wide grep for those four names outside the middleware file itself returns zero matches —
not app/api/auth/session/route.ts (password login to JWT mint), not
app/api/auth/refresh/route.ts, not app/api/auth/email-status, not any other route. POST
/api/auth/session in particular has no attempt cap: an attacker can brute-force Supabase
passwords by hammering signInWithPassword client-side (Supabase itself may rate-limit, but that
is an unverified external dependency, not this app's control) and, more importantly, once a
valid Supabase session exists, /api/auth/session mints app JWTs with zero throttling.
Fix: wire authLimiter into app/api/auth/session/route.ts and app/api/auth/refresh/route.ts (both
are POST, both are the actual brute-force/credential-stuffing surface), and sessionLimiter or a
dedicated tighter limiter onto app/api/auth/email-status/route.ts (see C2).

### C2. POST /api/auth/email-status is an unthrottled user-enumeration oracle
app/api/auth/email-status/route.ts takes any email and returns exists:boolean by querying
public.users with supabaseAdmin, unauthenticated, with no rate limiting (see C1). This is a
deliberate product feature (AuthModal switches tab based on the result), but combined with zero
rate limiting it lets an attacker enumerate the full customer email list at whatever throughput
the DB allows — valuable for phishing/credential-stuffing target lists, and itself a
GDPR-adjacent PII disclosure concern (confirms which real people are customers).
Fix: put this endpoint behind a strict per-IP rate limit (much stricter than 20/15min) and
consider a generic "if this email is registered you will get a code" copy pattern instead of a
direct boolean where the UX allows it.

### C3. Admin "lock account" does not block session issuance
features/admin-users/services/admin-users.repository.ts setLocked() flips users.is_deleted, and
the repo's own code comment (admin-users.repository.ts around line 29-32) states plainly that
locking only flips the admin-panel display flag and there is NO enforcement blocking login in
app/api/auth/session/route.ts. Verified: app/api/auth/session/route.ts reads profile.role from
public.users but never reads or checks is_deleted; neither does app/api/auth/refresh/route.ts,
authenticate.middlware.ts, nor refresh-token.service.ts. A locked/banned user can still: (a) sign
in with Supabase (their Supabase Auth account is not touched), (b) call POST /api/auth/session
and get a fresh, fully valid app JWT with their real role, and (c) keep calling
/api/auth/refresh indefinitely — the admin "lock" button is cosmetic only for any user who was
not already logged out at lock time. This is the kind of gap that looks fine in the demo (admin
UI shows "locked") and fails silently in production the first time it is used to actually
contain abuse.
Fix: check is_deleted in POST /api/auth/session (reject mint) and in POST /api/auth/refresh
(reject rotate + revoke all outstanding refresh tokens for that user_id), or migrate to
Supabase Auth's own ban-duration/admin API so a single mechanism owns "can this identity
authenticate at all."

---

## High Priority

### H1. Refresh-token reuse detection logs but does not revoke the session family
app/api/auth/refresh/route.ts (around lines 42-52) correctly detects reuse (JWT signature/expiry
valid, but DB says revoked_at is set) and logs TOKEN_REUSE_DETECTED, but it only rejects that one
request — it does not revoke ALL outstanding refresh tokens for that user. Because
refresh-token.service.ts has no concept of a token "family" (each rotation just revokes the
single old token and inserts one new row), the realistic theft scenario plays out badly for the
victim: if an attacker races the legitimate user and uses the token first, the attacker gets a
valid new token pair and continues indefinitely, while the legitimate user's next refresh attempt
is the one flagged as reuse and locked out. The party who should be blocked (the attacker) is the
one left with a working session.
Fix: on TOKEN_REUSE_DETECTED, revoke every active refresh_tokens row for that user_id, not just
the presented token, and consider force-invalidating the access-token trust window (short 15m TTL
already limits blast radius, but explicit revocation is still the correct response to a detected
compromise indicator).

### H2. File upload accepts attacker-controlled filename/extension with only a client-supplied MIME check
src/middlewares/upload.middleware.ts validates file.type.startsWith("image/") — File.type is
client-supplied and trivially spoofable. The stored filename's extension is taken directly from
file.name via path.extname(file.name) with no allowlist. Combined, an authenticated STAFF user
(this route sits behind app/api/staff/uploads/route.ts's authenticate()+requireRole(user,
"STAFF"), so the attack surface is compromised/malicious staff, not the public) can upload a file
named with an .svg extension containing an inline script tag while sending a spoofed image MIME
type (still passes the image/ prefix check), landing under public/uploads/ — a statically served
directory — producing stored XSS served from the site's own origin, exploitable against anyone
(including ADMIN) who later views the "image."
Fix: allowlist extensions explicitly (jpg/jpeg/png/webp/gif, no SVG unless sanitized), verify
actual file content via magic-byte sniffing (not file.type), and never trust file.name for the
extension used in the write path — derive it from the sniffed content type.

### H3. JWT secrets are never validated for presence/strength at boot
lib/env.ts's Zod schema validates only 4 vars (app URL, NODE_ENV, LOG_LEVEL, dead DATABASE_URL).
The access/refresh token secret variables are read directly in jwt.service.ts via a raw
runtime-environment lookup with no schema validation — the only guard is requireSecret() which
throws lazily, the first time a token is signed/verified, not at process start. There is also no
minimum-length/entropy check, so a short or default-looking secret in local configuration would
work silently. This matches the context doc's already-flagged gap.
Fix: add the two JWT secret vars to envSchema with a minimum length requirement (e.g. 32
characters) so a misconfigured/weak secret fails fast at boot, not on first login.

---

## Medium Priority

### M1. jwt.verify() calls do not pin an explicit algorithms allowlist
jwt.service.ts (verifyAccessToken/verifyRefreshToken, around lines 71-81) call jwt.verify(token,
secret) without an algorithms option. jsonwebtoken ^9 (confirmed in package.json) defaults
sensibly for a string/Buffer secret (restricts to the HMAC family), so the classic RS256-to-HS256
algorithm-confusion attack does not apply here since no asymmetric key is ever used — this is a
defense-in-depth gap, not an active vulnerability today. Still worth pinning explicitly so a
future refactor (e.g. someone adds an RS256 code path elsewhere and shares the verify helper)
cannot silently reopen it.
Fix: pass an explicit HS256-only algorithms allowlist in both verify calls.

### M2. CORS middleware and general audit-log middleware are dead code, not actually protecting anything
src/middlewares/cors.middleware.ts (applyCors/handleCorsPreflight) and
src/middlewares/audit-log.middleware.ts (logAudit) are never imported outside their own files or
tests (verified via repo-wide grep). This is not a live vulnerability (Next.js API routes are
same-origin by default, and there is no evidence of an intended cross-origin client), but it means
the hardcoded localhost-only allowed-origins list would need updating and wiring before any
legitimate cross-origin consumer (mobile app, separate admin domain, etc.) could actually work,
and there is no general structured audit trail for non-auth API calls today (only the 4
auth-specific events in audit-log.service.ts are captured).
Fix: either wire these in (if cross-origin/general audit-trail is actually a near-term need) or
delete them to avoid the "CORS is handled" false confidence.

### M3. IP address used for audit logs (and would be used for rate limiting) trusts forwarded-for headers unconditionally
src/api/request-context.ts getClientIp() and rate-limit.middleware.ts (around lines 25-30) both
take the first value of the x-forwarded-for header (or x-real-ip) at face value. If the
deployment target is behind a proxy that does not strip/overwrite inbound forwarded-for headers
(self-hosted Nginx misconfig, or any setup other than a trusted edge like Vercel that guarantees
the header), a client can spoof this header to (a) pollute audit logs with a fake IP, and (b) once
C1 is fixed and rate limiting is wired, trivially bypass per-IP throttling by rotating the spoofed
value per request.
Fix: document the trust assumption (which reverse proxy is guaranteed in front of this app) or
validate against a known proxy IP allowlist before trusting the header.

### M4. Weak password policy (6-char minimum, no complexity requirement)
features/auth/schemas/auth.schema.ts requires only a 6-character minimum for both login and
registration — this is Supabase Auth's own default minimum, not strengthened by this app. No
complexity check (no requirement for a mix of character classes), no check against
common/breached password lists.
Fix: raise the minimum (8+) and consider strength scoring client-side; this is a UX/policy call,
not a code defect, so treat as backlog rather than blocking.

### M5. No password-reset ("forgot password") flow exists
Grep for reset/forgot/update-password patterns across features/, app/, lib/, components/ returns
nothing, and the "Forgot password?" button in AuthModal.tsx (around lines 412-419) is disabled
with no handler — it is an intentionally stubbed-out feature, not a bug, but it means locked-out
users have no self-service recovery path today, which product/ops should be aware of before this
ships broadly.

---

## Low Priority

### L1. lib/supabase-server.ts and lib/supabase-browser.ts use non-null assertions on runtime config, inconsistent with the repo's own "nullable-client" convention
lib/supabase.ts follows the documented repo convention (nullable client when configuration is
missing, comments say "mirror lib/supabase.ts" elsewhere) but supabase-server.ts and
supabase-browser.ts use non-null assertions on the Supabase config values — these will throw a
raw, unguarded error at first use if the value is ever missing in a given deployment, instead of
failing the same predictable way as the rest of the auth surface. Not a security bug, just an
inconsistency that will produce a confusing crash instead of the app's usual guarded error
message.

### L2. Cache middleware (cache.middleware.ts) is unused
getCachedResponse/setCachedResponse are never called outside their own file/tests. Not a security
issue (no risk of caching auth-sensitive data across users since it is not wired at all), just
dead code worth a mental note if it is later wired to an authenticated endpoint — the cache key
builder must be scoped by user, not left as a fixed prefix, or it will leak one user's cached
response to another.

### L3. AUTH_COOKIE_OPTIONS.secure is conditioned on production mode only
features/auth/constants.ts — reasonable in isolation, but this means any deployment not running
in production mode (staging misconfigured, preview deploys, etc.) silently serves the app's JWT
cookies without the Secure flag, allowing them to be sent over plain HTTP if such an environment
is ever reachable over HTTP. httpOnly:true and sameSite:"lax" are both correctly set otherwise.
Verify deployment mode is always production in every internet-reachable environment.

---

## Edge Cases Found by Scout

- /staff/**  and /admin/** route coverage — confirmed via full listing of app/api/staff/** and
  app/api/admin/** (16 route.ts handlers) that every single one calls authenticate() +
  requireRole() independently of proxy.ts. No route relies on the edge gate alone. proxy.ts's
  matcher (broad catch-all excluding static assets) is broad enough to cover any newly added
  /staff/* or /admin/* page, but note it does NOT gate /api/staff/**  /  /api/admin/** by itself
  either — guardAdminArea() checks whether the pathname starts with /staff or /admin, and the API
  routes live under /api/staff/... and /api/admin/..., which do NOT start with /staff or /admin
  (they start with /api). This confirms proxy.ts provides zero edge protection for the API
  routes — the API routes' security is entirely and correctly delegated to each route's own
  authenticate()/requireRole() calls, exactly as the file's own comment states (the
  authenticate.middlware.ts docstring notes it does not replace per-route authenticate/requireRole
  calls). This is by design and verified correctly implemented — flagging only so it is explicit:
  if a future /api/staff/** route is ever added without its own authenticate()/requireRole()
  calls, there is no edge-level safety net to catch that mistake. Given C1-C3 exist, recommend
  adding a lightweight regression check (e.g. a small test asserting every file under
  app/api/staff/**  /  app/api/admin/** imports authenticate) so this invariant cannot silently
  regress as new admin/staff endpoints are added.
- IDOR on ownership-scoped resources — checked address.repository.ts, account-order.service.ts
  equivalents, and checkout retryPayment/getPaymentStatusForUser — all correctly pass
  user.userId into the repository/service layer and scope the query by user_id. No case found
  where a client-supplied resource ID alone (without a user_id join/filter) is used to
  fetch/mutate another user's data.
- OAuth callback / PKCE — app/auth/callback/route.ts uses exchangeCodeForSession, which is the
  correct PKCE-aware Supabase SSR API; the PKCE code verifier itself lives in a cookie written by
  supabaseBrowser (createBrowserClient) before redirect, matching the documented flow. The next
  param is passed through sanitizeAuthReturnTo before use in both the callback route and
  openAuthModal.ts — verified the sanitizer's leading-double-slash block is sufficient given the
  value is always concatenated onto a fixed origin (not parsed as a fresh relative URL), so
  backslash-based bypass tricks do not apply here the way they would if next were used as a bare
  router.push() target from scratch.
- returnTo round-trip via client-side router.push() (AuthModal.tsx around lines 237-241 and
  273-278) — already sanitized upstream at openAuthModal(), so no additional gap found here.

## Positive Observations

- Every /staff/** and /admin/** API route independently enforces both identity (authenticate())
  and role (requireRole()) — no authorization-without-authentication or
  authentication-without-authorization gaps found anywhere in the domain.
- Refresh tokens are stored as SHA-256 hashes only (hashRefreshToken,
  refresh-token.service.ts around lines 6-8) — the raw token is never persisted, matching best
  practice.
- Reuse detection exists at all (many hybrid-JWT implementations skip this entirely) and is
  correctly triggered off "signature/expiry valid but DB says revoked" rather than a weaker
  check.
- The rememberMe intent is correctly threaded through rotation (jwt.service.ts around lines
  53-58, refresh/route.ts around lines 56-59) so a session-only login does not silently get
  upgraded to persistent on the next auto-refresh — a subtle bug class this code explicitly
  guards against, with a comment explaining why.
- Every supabaseAdmin (service-role, RLS-bypassing) usage found in the domain and its immediate
  neighbors (account/, admin-users/, checkout/) is server-only-guarded and reachable only from
  routes that already gate on authenticate()/requireRole().
- sanitizeAuthReturnTo correctly blocks protocol-relative open-redirect payloads and is applied
  consistently at every entry point that accepts a return path.
- withErrorHandler wraps essentially all API routes, so AppError/ZodError map to clean responses
  and unexpected errors never leak raw stack traces to the client (mapped to a generic
  internal-server-error 500).

## Recommended Actions

1. (Critical) Wire authLimiter/a stricter limiter into POST /api/auth/session,
   POST /api/auth/refresh, and POST /api/auth/email-status. (C1, C2)
2. (Critical) Make admin "lock account" actually block session issuance — check is_deleted in
   /api/auth/session and /api/auth/refresh, revoking outstanding refresh tokens on lock. (C3)
3. (High) On refresh-token reuse detection, revoke all of that user's outstanding refresh
   tokens, not just the presented one. (H1)
4. (High) Harden upload.middleware.ts: extension allowlist + content-based (magic byte)
   validation instead of trusting the client-supplied MIME type/filename. (H2)
5. (High) Add the JWT secret vars to lib/env.ts's Zod schema with a minimum length so a
   weak/missing secret fails at boot. (H3)
6. (Medium) Pin an explicit HS256-only algorithms allowlist on both jwt.verify() calls. (M1)
7. (Medium) Either wire cors.middleware.ts/audit-log.middleware.ts in or remove them to avoid
   false confidence that they are active. (M2)
8. (Medium) Document/validate the forwarded-for trust assumption before relying on it for rate
   limiting once C1 is fixed. (M3)
9. (Backlog) Strengthen password policy; scope and build a password-reset flow. (M4, M5)
10. (Recommend) Add a lightweight regression check (test) asserting every
    app/api/staff/**  /  app/api/admin/** route file imports authenticate from
    authenticate.middlware.ts, since that is the only real security boundary for those routes —
    proxy.ts does not cover /api/** paths at all (see Scout findings).

## Metrics

- Type Coverage: not separately measured this pass (no typecheck run — this was a manual/static
  review per the task scope, not a build-gate check).
- Test Coverage: co-located *.test.ts files exist for the auth schema, audit-log service, auth
  repository, jwt service, refresh-token service, the authenticate middleware, the OAuth
  callback route, all four app/api/auth/** routes, plus AuthModal.test.tsx — good breadth of
  unit coverage on the pieces reviewed here. Did not execute the suite as part of this review
  (static read-only audit); recommend running it as a follow-up gate before acting on this
  report's fixes.
- Linting Issues: none run as part of this review (out of scope for a static security/production
  readiness read).

## Unresolved Questions

- Is this app deployed behind Vercel (which guarantees forwarded-for header integrity) or a
  self-managed reverse proxy? This determines how urgent M3 is.
- Is a password-reset flow intentionally deferred (product decision) or an oversight? (M5)
- Is cross-origin API access (mobile app, separate subdomain) planned? Determines whether M2's
  CORS middleware should be wired or deleted.

**Status:** DONE_WITH_CONCERNS
**Summary:** Auth domain has a sound two-layer identity/authorization model with no
auth-without-authz or authz-without-auth gaps on any staff/admin/account route, but three
production blockers exist: rate limiting is fully built and never wired to any route, admin
"lock account" does not block session (re)issuance, and the upload endpoint trusts
client-supplied filename/MIME-type for a statically-served destination. None require an
architecture change — each is a scoped wiring/validation fix.
**Concerns/Blockers:** C1 (no rate limiting anywhere), C2 (unthrottled email-enumeration
endpoint), C3 (admin lock does not block session mint/refresh) should be treated as pre-launch
blockers; H1-H3 should land before the next release; this is a standalone audit with no plan
file / validate-contract in scope, so no PVL/EVL loop or high-risk evidence pack applies —
routing any of these fixes through EXECUTE should go through the normal
RESEARCH-PLAN-VALIDATE-EXECUTE flow given they touch auth/security surfaces (high-risk class
per orchestration.md).
