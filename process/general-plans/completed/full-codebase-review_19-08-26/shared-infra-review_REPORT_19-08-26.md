---
name: report:shared-infra-review
description: "Full production-readiness review of shared infra/config/test-setup domain"
date: 19-08-26
metadata:
  node_type: memory
  type: report
  feature: general
  phase: standalone-review
---

# Code Review Summary

## TL;DR
Two real bugs worth fixing before the next release: (1) internal config-error text (env var names, raw SDK error messages) leaks straight to API clients through InternalServerError messages in payos.service.ts and staff/uploads/route.ts, and (2) next.config.ts Cloudinary remotePatterns is scoped by hostname only, so the app can be used as an open image proxy for any Cloudinary account, not just this project. Everything else is either a documented/intentional trade-off (test infra, nullable-client env pattern) or a lower-priority hygiene item (dead deps, missing security headers, no CI). The pino err logging pattern that looked suspicious on first read is actually correct, verified against pino own docs.

### Scope
- Files: src/api/**, src/cache/redis.ts, src/errors/app.error.ts, src/logging/logger.ts, src/middlewares (error-handler, cache, correlation-id, request-logger, validate), lib/env.ts, lib/resend.ts, lib/utils.ts, components/ui/** (17 files), components/shared/** (excl. AuthModal), src/components/charts/** (spot-check, ~70 files), next.config.ts, tsconfig.json, eslint.config.mjs, vitest.config.ts, vitest.setup.ts, vitest-stubs/server-only.ts, package.json, components.json, proxy.ts (config.matcher only)
- LOC: small-to-medium per file; charts library spot-checked (not exhaustive), all other files read in full
- Focus: full-domain audit (not a diff review) -- standalone quality/security request
- Scout findings: cross-repo grep confirmed dead dependencies and traced how InternalServerError messages flow to API responses (see Critical Issues)

### Overall Assessment
This is a well-organized, small solo-dev codebase. The AppError hierarchy, response envelope, and nullable-client pattern (Redis/Resend/PayOS/Cloudinary all degrade to null instead of crashing at import time) are consistently applied and genuinely good design. The src/components/charts library is unexpectedly sophisticated for a chart folder -- it has a deliberate stable/hover React context split purely to stop cold consumers re-rendering on every mouse move. The real problems are narrower than they look at first glance: one concrete info-disclosure bug, one image-proxy scoping bug, and the rest is dependency/process hygiene.

### Critical Issues

1. InternalServerError messages leak internal config/SDK details straight to API clients

src/middlewares/error-handler.middleware.ts catches any AppError and returns error.message verbatim to the caller:

    if (error instanceof AppError) {
      logger.warn({ path: req.nextUrl.pathname, code: error.code }, error.message);
      return errorResponse(error.message, error.code, error.statusCode);
    }

That is fine for errors whose message is meant to be user-facing. But two call sites throw InternalServerError with internal implementation details as the first argument, which then becomes the client-visible message:

- features/checkout/services/payos.service.ts lines 15-17:

      throw new InternalServerError(
        "Thieu PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY -- kiem tra lai file .env",
      );

  Any customer who hits checkout while PayOS credentials are misconfigured gets a JSON response naming the exact missing config keys and the local-config-file convention. This is architecture disclosure, not just a leaked stack trace -- an attacker probing the site learns the app runs on local-config-file style setup and exactly which payment-provider secrets it expects.

- app/api/staff/uploads/route.ts lines 22-24 (same pattern for Cloudinary) and lines 49-51:

      throw new InternalServerError(
        err instanceof Error ? err.message : "Upload anh len that bai.",
      );

  This forwards whatever the Cloudinary SDK caught error message says, unfiltered, into the API response. Depending on the failure mode that could include SDK-internal text, account state details, or other Cloudinary-side diagnostics. Scope is staff-only (authenticated), which lowers severity vs the PayOS case, but the pattern -- catch anything, forward the caught error message as the client-facing error -- is the actual bug, and it will resurface wherever it is copy-pasted next.

Contrast with features/contact/services/contact.repository.ts lines 45-47, which does this correctly -- the raw Supabase error goes into the details param (third constructor argument), which errorResponse() never reads, while a safe generic string goes into message. That is the pattern the two leaking call sites should follow.

Fix: for both leaking call sites, put the diagnostic string in details (or logger.error) and use a generic client-facing message. This is a small, mechanical fix -- no withErrorHandler restructuring needed, since it already logs the real error server-side either way.

2. next.config.ts remotePatterns for Cloudinary is scoped by hostname only, not by account

    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" }]

res.cloudinary.com is a shared hostname across every Cloudinary account -- the account/cloud identity is encoded in the URL path (the cloud name segment), not the host. pathname: "/**" means any URL of the form https://res.cloudinary.com/{any-cloud-name}/... -- including other accounts -- is a valid next/image optimization target through this app _next/image route. That turns the app image optimizer into a de-facto open image proxy: anyone can make the server fetch, resize, and re-serve arbitrary Cloudinary-hosted images through this app own domain, for free, at the app bandwidth/CPU cost. It is not a credential leak, but it is a real abuse/cost/DoS vector and a content-laundering vector (attacker-controlled images appear to be served from this app own domain).

Fix: scope pathname to this project own cloud, e.g. pathname set to the cloud name segment plus /** (the cloud name value is already read from the environment in lib/cloudinary.ts line 4 -- next.config.ts can read the same environment variable at build time, since Node makes the process environment available in config files too).

### High Priority

3. lib/env.ts validates 4 of about 16 real env vars -- confirmed real fail-fast gap, now with a concrete consequence

The context-doc-flagged gap is real: envSchema only covers DATABASE_URL (dead/Prisma), NEXT_PUBLIC_APP_URL, NODE_ENV, LOG_LEVEL. Everything else (PayOS credentials, Cloudinary credentials, RESEND_API_KEY, the JWT access/refresh secrets, Supabase credentials) is read directly from the process environment in each file individually, each with its own nullable-fallback (payos/resend/cloudinary become inert rather than crashing at import time). This means:
- The app builds and boots successfully with the PayOS checksum key (or any of the above) missing.
- The gap is only discovered when a real request needs that integration -- for PayOS specifically, that is the checkout flow, i.e. a paying customer, and (per Critical 1) the failure now also leaks internal config-key names to that customer.
- The JWT signing secrets missing in production would be a much worse silent failure mode (auth/session signing) -- worth double-checking with the auth-domain reviewer whether jwt.service.ts has its own fail-fast guard, since env.ts provides none.

This is not a your-validation-is-wrong issue -- the nullable-client pattern is a deliberate, reasonable design for genuinely optional integrations (Resend is documented as optional). The gap is that required-for-checkout vars (PayOS, and likely the JWT secrets) get the same soft-fail treatment as genuinely optional ones (Resend), with no boot-time signal distinguishing the two.

Fix (proportionate, not a rewrite): add a lightweight boot-time check -- either extend envSchema with the required vars as optional Zod fields plus a manual logger.warn for any that are missing (preserves today graceful-degrade runtime behavior, just makes the gap visible in server startup logs instead of silent), or add a small assertRequiredEnv() helper called once at server startup that warns (not throws, to avoid breaking the existing intentional-optional cases) for the known-required set: PayOS client id/api key/checksum key, the two JWT signing secrets, and Supabase credentials.

4. No security response headers configured anywhere

Grepped the whole repo for X-Frame-Options, Content-Security-Policy, Strict-Transport-Security, poweredByHeader, and a next.config.ts headers() export -- none exist outside the vc-web-testing skill reference docs. next.config.ts has no headers() function, proxy.ts does not set any either, and poweredByHeader is not disabled (default X-Powered-By: Next.js is still emitted). For a payment-handling e-commerce site with staff/admin panels, the complete absence of CSP/clickjacking/HSTS headers is a meaningful gap -- not exploitable on its own, but it removes a real layer of defense-in-depth against XSS (see Low 12 below re: dangerouslySetInnerHTML in blog content) and clickjacking on the checkout/admin pages.

Fix: add a headers() block to next.config.ts with at minimum X-Frame-Options SAMEORIGIN (or CSP frame-ancestors self), X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, and poweredByHeader set to false. A full CSP is a bigger lift (needs auditing every inline script/style) -- worth a follow-up plan item rather than blocking this review.

### Medium Priority

5. Confirmed dead dependencies (repo-wide grep, zero usages found)

Beyond the already-known Prisma stack, a full-repo grep (not just this domain files) confirms these are unused:
- @prisma/client, @prisma/adapter-pg, prisma -- 0 PrismaClient/import hits (matches all-database.md existing flag)
- pg + @types/pg -- 0 "from pg" / new Pool / new Client hits
- @tanstack/react-query -- 0 useQuery/QueryClient hits
- yup -- 0 "from yup" hits
- swagger-jsdoc, swagger-ui-express (plus their @types/*) -- 0 usage in any .ts/.tsx/.js/.mjs; only appear in package.json/package-lock.json and the stray "package copy.json" (see Low 9)

None of these were found silently used somewhere -- every hit was package.json/lockfile only. Recommend removing all of them from dependencies/devDependencies: smaller install size, smaller supply-chain surface, and it stops future contributors from assuming Prisma/React Query/Yup are the real data/validation/query layer (the actual stack is raw-SQL-via-Supabase, Zod, and SWR-as-store -- already documented in all-context.md and all-database.md).

6. REDIS_URL confirmed undocumented in the example env file

Confirmed by reading the example env file in full -- it has sections for App/Logging/Supabase/JWT/Cloudinary/PayOS/Resend, but no Cache/Redis section at all, despite src/cache/redis.ts gating optional caching and rate-limiting on it. Functional risk is low (the nullable-client pattern means the app runs fine without it -- redis.ts logs an info-level message and moves on), but it is a discoverability gap: a new contributor has no way to learn Redis caching/rate-limiting exists as an opt-in feature short of reading redis.ts source directly. Add a Cache/Redis section documenting the variable to the example env file.

7. proxy.ts matcher -- pattern is functionally correct but has two scope side-effects worth flagging

The matcher itself does what it says: it correctly excludes Next-internal static/image routes and files ending in common image extensions, and correctly leaves /staff/** and /admin/** (and everything else) matched. No routes that should be gated are being accidentally excluded -- this part is correct.

Two side-effects from its intentionally broad scope, both worth a note to whoever owns proxy.ts or the auth review:
- a) It also matches /api/** (nothing excludes API routes), so guardAdminArea() runs for /api/admin/** and /api/staff/** API calls too, not just page navigations. Since guardAdminArea() responds with an HTTP redirect on auth failure, a fetch-based API client hitting a protected API route without valid auth gets a 3xx redirect to the home/staff/admin root instead of a clean 401/403 JSON body -- fetch follows redirects by default, so the caller ends up trying to json-parse an HTML page. This is a boundary interaction between the matcher scope (correct as designed) and the guard response type (redirect vs JSON) -- flagging for the auth-domain review to decide whether the guard should special-case API paths and return JSON instead.
- b) It also matches every non-image static asset under public/ (fonts, css, pdf, xml, robots.txt, etc are not in the excluded extension list) -- negligible perf cost since guardAdminArea short-circuits on two prefix checks, but it is needless work on every static-asset request. Not worth a fix on its own, just noting it is not fully optimized.

8. Husky installed, lint-staged configured, but zero active hooks wired up

Confirmed: the husky directory only contains the internal helper subfolder -- no pre-commit file exists -- despite package.json already having a full lint-staged config (prettier check plus eslint zero-warnings on staged files) sitting unused, and a prepare husky script already installing the git hooks machinery. No CI workflows directory exists either, so there is genuinely zero automated gate between a commit and main -- the full local check script is 100 percent manual. For a solo-dev project this is a process gap rather than a code defect, but it is a cheap fix given the lint-staged config already exists: creating the pre-commit hook file that invokes lint-staged wires up what is already configured. Recommend as a real (if non-blocking) action item -- the config sitting there unused is the kind of thing that looks intentional but is very likely just an incomplete setup step.

### Low Priority

9. Stray tracked file: "package copy.json"

Committed to git (confirmed via git log, commit 9688732, "Initiative frontend developement"). It is an old snapshot with a different name field and different dependency set (includes the same swagger-* packages, confirming they were dead even earlier). Dead weight in the repo, mildly confusing (a diff/grep tool matching package*.json will pick it up). Recommend deleting it.

10. pino logger has no redact option configured

Not an active leak -- grepped every logger call site in this domain and found no raw request bodies, tokens, passwords, or full user objects being logged (see Positive Observations for the err-key pattern verification). But there is no structural guardrail (a redact list for auth headers, cookies, password/token fields) preventing a future call site from doing so. Cheap defense-in-depth to add given this is a payment-handling app, not urgent.

11. X-Powered-By Next.js header not disabled

poweredByHeader is not set in next.config.ts (defaults to emitting the header). Minor fingerprinting/info-disclosure, standard low-effort hardening item -- bundle with High 4 headers() work.

12. components/blog/BlogArticle.tsx line 57 uses dangerouslySetInnerHTML on post.bodyHtml -- technically outside this review assigned scope (components/blog, not components/shared or components/ui), surfacing as a cross-domain flag: confirm with whichever reviewer owns the blog/admin-blog feature that bodyHtml is sanitized server-side (not just author-trusted) before storage -- this is a stored-XSS vector if not.

### Edge Cases Found by Scout
- Traced InternalServerError message flow end-to-end from throw site through withErrorHandler catch through errorResponse() to client JSON, confirming the message field (not details) is what actually reaches the client -- this is what surfaced Critical 1 and distinguished it from the safe contact.repository.ts pattern.
- Verified pino err-key auto-serialization behavior against upstream docs before flagging it (see Positive Observations) -- avoided a false-positive "errors serialize to an empty object" finding.
- Full-repo (not domain-scoped) grep for Prisma/react-query/pg/yup/swagger usage, per the task explicit "final sanity check across the whole repo" instruction -- all confirmed dead, zero silent usages found anywhere.

### Positive Observations
- withErrorHandler does NOT leak stack traces for unexpected (non-AppError) errors -- the generic 500 branch logs the full error server-side via pino and returns a fixed, safe Vietnamese message to the client. This is the correct pattern; the leak (Critical 1) is specifically in the AppError/InternalServerError branch where the thrown message itself is the leak, not a middleware design flaw.
- The { err: error } logging pattern used consistently across error-handler.middleware.ts, cache.middleware.ts, redis.ts, rate-limit.middleware.ts is correct, not a bug. Pino ships with a default serializer applied automatically to any key literally named err -- verified against pino own docs before writing this up. So despite src/logging/logger.ts not explicitly configuring custom serializers, every err call site does correctly serialize message and stack, not an empty object. Good, idiomatic usage.
- Nullable-client defensive pattern is applied consistently and correctly across Redis, Resend, PayOS, and Cloudinary -- all four instantiate to null/inert when their env vars are absent, with explicit guard checks at each call site, and the code comments in each file explicitly cross-reference each other. This is genuinely good, deliberate design.
- src/errors/app.error.ts is clean and minimal -- one base class, six purpose-built subclasses, no over-engineering.
- src/components/charts (spot-checked, not exhaustive) shows real performance engineering: chart-context.tsx deliberately splits a stable context (data/scales/dimensions/animation config) from a hover context (tooltip/selection/hover-index state) specifically so that cold consumers like axes, grid lines, and pattern fills do not re-render on every mouse move -- documented in the file own comments. 169 useMemo/useCallback/memo() call sites found across 29 of the roughly 70 chart files. No obvious missing-memoization issue surfaced in the spot-check.
- Test infra (vitest.config.ts, vitest.setup.ts, vitest-stubs/server-only.ts) is well-reasoned, not fragile -- every non-standard choice (hardcoded test-only JWT secrets isolated from real config, no test.globals requiring explicit imports, the server-only no-op stub) has an inline comment explaining why, and matches what process/context/tests/all-tests.md already documents as intentional. No action needed here.

### Recommended Actions
1. (Critical) Fix the two InternalServerError call sites (payos.service.ts lines 15-17, app/api/staff/uploads/route.ts lines 22-24 and 49-51) to put diagnostic detail in details/server logs, not the client-facing message.
2. (Critical) Scope next.config.ts remotePatterns pathname to the project own Cloudinary cloud path instead of /**.
3. (High) Add a boot-time warning (not necessarily a hard throw) for the required-but-unvalidated env vars (PayOS credentials, JWT signing secrets, Supabase credentials) in lib/env.ts or a small startup helper -- coordinate with the auth-domain reviewer on the JWT secrets specifically.
4. (High) Add baseline security headers (X-Frame-Options/CSP frame-ancestors, X-Content-Type-Options, Referrer-Policy, poweredByHeader false) to next.config.ts.
5. (Medium) Remove dead dependencies: @prisma/client, @prisma/adapter-pg, prisma, pg, @types/pg, @tanstack/react-query, yup, swagger-jsdoc, swagger-ui-express, @types/swagger-jsdoc, @types/swagger-ui-express.
6. (Medium) Document the Redis URL variable in the example env file.
7. (Medium) Flag the proxy.ts matcher/API-redirect interaction (finding 7a) to the auth-domain review.
8. (Medium) Wire up a husky pre-commit hook to run the already-configured lint-staged (one-line fix, config already exists).
9. (Low) Delete stray "package copy.json".
10. (Low) Add a redact config to the pino logger as defense-in-depth.
11. (Low) Flag components/blog/BlogArticle.tsx dangerouslySetInnerHTML to the blog/content-domain reviewer for a sanitization check.

### Metrics
- Type Coverage: not separately measured this pass -- tsconfig.json has strict true, no noUncheckedIndexedAccess (pre-existing, documented in all-tests.md)
- Test Coverage: this domain is thinly covered -- src/api/request-context.test.ts exists; src/middlewares middleware files (error-handler, cache, correlation-id, validate) have no test files; lib/env.ts, lib/resend.ts, lib/utils.ts have no test files. Not blocking for this review (infra glue code, low branch complexity) but worth noting as a gap if this domain gets touched again.
- Linting Issues: not run in this pass (read-only review, no lint command invoked -- this is a source review, not a gate run)

### Unresolved Questions
- Does features/auth/services/jwt.service.ts (or wherever the JWT signing secrets are consumed) have its own fail-fast guard independent of lib/env.ts? This domain file list did not include that file -- worth the auth-domain reviewer confirming, since it is the highest-severity instance of the env.ts gap if unguarded.
- Whether staff product/blog image uploads (Cloudinary) accept arbitrary MIME types including SVG -- relevant to Medium 7/3 interaction with dangerouslyAllowSVG and the broad remotePatterns. upload.middleware.ts was explicitly out of this review scope (owned by auth-domain review per the task instructions) -- flagging the cross-domain question rather than answering it here.
