---
name: plan:infra-followups-19-08-26
description: "Non-blocking follow-ups raised by the 19-08-26 full-codebase-review critical fixes and priority bug fixes — deferred, not blocking, tracked here"
date: 19-08-26
feature: N/A
---

# Backlog — Non-Blocking Follow-Ups (19-08-26)

Source: `full-codebase-review_19-08-26` (F1-F7 critical fixes) and `priority-bug-fixes_19-08-26`
(5 priority bugs). Both plans are VERIFIED and archived to `process/general-plans/completed/`.
These three items were explicitly raised as non-blocking during EXECUTE/EVL and must not be lost.

## 1. Redis provisioning for rate limiting (F4/F5)

**Priority:** Medium — infra checklist item, not a code defect.

**Problem:** `src/middlewares/rate-limit.middleware.ts`'s `rateLimiter()` fail-opens (returns `null`,
no-op) when the `redis` client is falsy. This is the existing, intentionally-preserved behavior
(SPEC AC11) — never a hard outage on missing Redis. But it means the newly-added `authLimiter`
guards (session/refresh routes) and the new `emailStatusLimiter` (email-status route) throttle
nothing at runtime unless `REDIS_URL` is actually set in the production environment.

**Action:** Confirm `REDIS_URL` is provisioned in production. No code change needed — this is
purely an environment/infra checklist item.

## 2. Blog content-migration heads-up (F3, sanitize-html)

**Priority:** Low — content/editorial, not a code risk.

**Problem:** Blog `bodyHtml` is now sanitized through an explicit allowlist at BOTH write-time
(`admin-blog.repository.ts`) and read-time (`blog.service.ts`). Any EXISTING published blog post
containing tags outside the allowlist (e.g. `<table>`, `<iframe>`, inline `style` attributes) will
be silently stripped the next time it is rendered (read-time sanitize) and permanently stripped on
next save (write-time sanitize). This is SPEC-accepted behavior (AC6/AC7), not a bug.

**Action:** Give the content/business owner a heads-up before/around the next deploy so they aren't
surprised if an older post's formatting changes on next view. No code fix required.

## 3. `vitest.config.ts` missing public Supabase test env vars (harness-drift)

**Priority:** Low — pre-existing test-infra gap, unrelated to either plan's blast radius.

**Problem:** `vitest.config.ts`'s `test.env` block hardcodes JWT secrets but is missing
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `lib/useAddresses.test.tsx` fails at
import time (`@supabase/ssr: Your project's URL and API key are required`) because
`lib/supabase-browser.ts` calls `createBrowserClient` at module scope. Confirmed pre-existing —
neither plan touched `lib/useAddresses.test.tsx` or `lib/supabase-browser.ts`. Full suite result at
EVL: 323/323 passed except this one pre-existing unrelated failure.

**Action:** Add the two public Supabase env vars to `vitest.config.ts`'s `test.env` block. Already
documented as a Known Gap in `process/context/tests/all-tests.md`.

## Status

All three items are tracked here, not silently dropped. None block archival of either source plan.
