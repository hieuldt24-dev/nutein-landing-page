---
name: context:all-tests
description: "Vitest runner, commands, mocking approach, and known test-coverage gaps -- the tests group entrypoint/router"
keywords: test, tests, testing, vitest, coverage, mock, vi.mock, jsdom, lint, type-check, ci
related: []
date: 20-08-26
---

# nutein-landing-page - All Tests

Last updated: 2026-08-20

Attach this file first when the task involves testing, verification, or test debugging.

This is the fast operator guide for the testing surface:

- which runner to use
- what command to start with
- how to quickly debug common failures
- which deeper file to read next

Do not load the whole `process/context/tests/` folder by default. Start here, then drill down.

---

## How This File Works

This is the `all-tests.md` entrypoint for the `tests/` context group. It follows the `all-*.md` routing convention:

1. Agents read `all-context.md` first and get routed here for testing tasks
2. This file gives quick decision rules and commands
3. For deeper details, agents follow the routing table below to specific docs

As the project grows, add deeper docs to this group (e.g., `e2e-tests.md`, `debugging-and-pitfalls.md`) and add routing entries below. This file stays the fast-start entrypoint.

---

## What This Covers

- test runner selection
- quick commands by package
- fast debugging procedures
- current testing gaps worth remembering

## Read This When

Use this file when you need to:

- run tests after implementation
- decide between test runners
- debug failing tests

## Quick Routing

(No deeper test docs yet. Add routing entries here as they are created.)

## Quick Decision Guide

### Use `vitest` for everything

- Single runner for the whole repo — no Jest, no Playwright/e2e suite exists yet.
- Config: `vitest.config.ts` (repo root). Plugin `@vitejs/plugin-react`, default `environment: "jsdom"`.
- Server-only files (repositories importing `import "server-only"`, etc.) need a `// @vitest-environment node` docblock at the top of the test file to override the jsdom default — otherwise you get a cryptic `server-only` import crash.
- Path aliases: `@` -> repo root, `server-only` -> `./vitest-stubs/server-only.ts` (no-op stub replacing Next's real `server-only` package, which throws when imported outside Next's build pipeline).
- `setupFiles: ["./vitest.setup.ts"]` imports `@testing-library/jest-dom/vitest` and manually registers `afterEach(cleanup)` from `@testing-library/react`. `test.globals` is NOT enabled, so every test file must explicitly `import { describe, it, expect, vi } from "vitest"`.
- `test.env` hardcodes JWT test secrets (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `EXPIRE_ACCESS_TOKEN=15m`, `EXPIRE_REFRESH_TOKEN=7d`) — tests never depend on real `.env` values, and `npm test` works standalone with no `.env` file present.
- `vitest run` for a single CI-equivalent pass, `vitest` (watch mode) for active development.
- No coverage thresholds are configured — `@vitest/coverage-v8` runs with library defaults; treat coverage output as informational only.
- Unit + integration-style service/repository tests with a mocked Supabase client cover the whole current suite; there is no separate e2e runner to choose between.

## Default Verification Order

Unless the task clearly needs a different path:

1. run the narrowest existing automated test
2. use unit/integration tests before browser tests
3. use end-to-end tests only when the real UI is the thing being verified

## Commands

This is a single-app repo (no monorepo workspaces) — one command set covers everything.

| Command | What it does | When to use it |
|---|---|---|
| `npm test` | `vitest run` — single-pass full suite (44 files), no watch | CI-equivalent local run before pushing/committing |
| `npm run test:watch` | `vitest` watch mode | Active TDD/development loop |
| `npm run test:coverage` | `vitest run --coverage` (v8 provider, no enforced thresholds) | Checking coverage gaps informationally |
| `npm run lint` | `eslint . --max-warnings=0` | Zero-warning lint check |
| `npm run type-check` | `tsc --noEmit` | Type-safety check |
| `npm run format` / `format:check` | Prettier write / check-only | Formatting |
| `npm run check` | `format:check && lint && type-check && test` | Full local pre-push gate — the closest thing to CI this repo has (no `.github/workflows/` exists) |

**Lint config:** flat ESLint config extending only `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, no custom rules, zero-tolerance (`--max-warnings=0`).

**Type-check config:** `tsconfig.json` has `"strict": true` but no extra strictness flags (e.g. no `noUncheckedIndexedAccess`).

To run a single test file directly: `npx vitest run path/to/file.test.ts` (or `npx vitest path/to/file.test.ts` for watch mode on just that file).

## Debugging Quick Reference

- **jsdom vs node environment trap:** default environment is jsdom. Repository/server test files that hit `import "server-only"` chains need a `// @vitest-environment node` docblock at the top of the file — omitting it produces a cryptic `server-only` import crash that looks unrelated to the environment setting.
- **`server-only` stub:** `vitest-stubs/server-only.ts` is a no-op stub (`export {}`) aliased in place of Next's real `server-only` package (which throws when imported outside Next's build pipeline). This lets server modules be imported under Vitest at all — it does not fix the jsdom-vs-node environment issue above, which is a separate concern.
- **No env setup needed locally:** `vitest.config.ts`'s hardcoded `test.env` block (JWT secrets, token expiry) means `npm test` works standalone with no `.env` file. Real `.env`/`.env.example` JWT values never affect test behavior — don't waste time checking `.env` when a JWT-related test fails.
- **Mocking boundary:** repository tests mock the Supabase client at the module boundary via `vi.hoisted` + `vi.mock` (34 of 44 test files use `vi.mock`), building a fake chainable query-builder (`select/eq/neq/gte/lte/or/order/limit/range`, awaitable via `.then`). No `msw`/`nock` — mocking happens above the HTTP layer entirely, so no live DB/network is ever required to run tests.
- **No `test.globals`:** every test file must explicitly `import { describe, it, expect, vi } from "vitest"` — a missing import (not a config issue) is the usual cause of "describe is not defined"-style failures.
- **Optional integrations:** `RESEND_API_KEY` is optional in real dev (checkout does not block on missing email config); `order-email.service.test.ts` mocks Resend rather than requiring a real key, so email tests never need real credentials.
- **No enforced coverage gate:** `npm run test:coverage` has no configured thresholds — a coverage drop will not fail `npm run check` or any gate; it is informational only.
- **`beforeEach` concise-arrow teardown footgun:** writing `beforeEach(() => mock.mockReset())` (concise-body arrow, implicit return) makes Vitest treat the returned value as a teardown callback. If `mock` is a rejecting mock, Vitest re-invokes it after the test runs and fails the test with an unhandled rejection that looks unrelated to the reset call. Always use a block-body arrow for `beforeEach`/`afterEach` resets: `beforeEach(() => { mock.mockReset(); })`. Found 20-08-26 while writing the 6 new `admin-*.service.test.ts` files (`process/general-plans/completed/admin-hardening-batch_20-08-26/`).
- **`file-type` package + jsdom Buffer/Uint8Array realm mismatch:** `file-type@22` (pure ESM, requires Node ≥22) rejects a Node `Buffer` under Vitest's jsdom environment with `TypeError: Expected the input argument to be of type Uint8Array` — the Buffer and Uint8Array realms differ between Node and jsdom. Fix: normalize with `Uint8Array.from(buffer)` (or equivalent plain-Uint8Array copy) before passing to `file-type` APIs. See `lib/sniff-image-type.ts` (`sniffImageType()`) for the working pattern — any future consumer of `file-type` must do the same normalization, not just this file.

## Route-Handler Test Pattern

`app/api/staff/uploads/route.test.ts` is the established recipe for testing a Next.js App Router
`route.ts` handler directly (mock `authenticate`/`requireRole` and the third-party client via
`vi.mock`, then call the exported `POST`/`GET` function with a real `NextRequest`). This closes the
gap that was previously documented as "no route-handler test infra exists" — that claim is now
stale (corrected 20-08-26 in `admin-hardening-batch_PLAN_20-08-26.md`). Copy this pattern for future
HTTP-layer route tests instead of assuming one must be invented from scratch.

## Known Gaps

- `vitest.config.ts`'s `test.env` block hardcodes JWT secrets but is MISSING
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `lib/useAddresses.test.tsx` fails at
  import time (`@supabase/ssr: Your project's URL and API key are required`) because
  `lib/supabase-browser.ts` calls `createBrowserClient` at module scope. Confirmed pre-existing and
  unrelated to any change on 19-08-26 (harness-drift, not a code defect) — see backlog note
  `process/general-plans/backlog/infra-followups-19-08-26.md`. Fix: add the two public Supabase vars
  to `vitest.config.ts`'s `test.env`.
- `features/about` — zero tests (low-risk, static content only).
- `features/contact` — zero tests despite having schema/repository/service files parallel to tested features.
- `features/admin-orders/services/admin-orders.service.ts` — untested (only its `.repository.ts` and `.schema.ts` siblings are tested).
- React components/hooks/pages layer — near-zero coverage across the whole app (105 source files under `components/` vs 2 test files; 103 source files under `features/` vs 24 feature test files, nearly all non-UI).
- No E2E/integration test suite exists (no Playwright, no `*.spec.ts` files — only `*.test.ts(x)`).
- No CI pipeline runs tests automatically — `.github/workflows/` does not exist. Husky is installed (`prepare: husky` script) but has no actual hook files (`.husky/pre-commit`, etc. are absent), so nothing is enforced on commit/push; `npm run check` must be run manually before pushing.
- No coverage thresholds enforced (`npm run test:coverage` is informational only, no failure gate).
