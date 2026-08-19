---
name: report:admin-backoffice-review
description: "Production-readiness review of the admin/staff back-office domain (9 admin-* features, app/(admin), app/(staff), app/api/admin, app/api/staff, components/admin)"
date: 19-08-26
metadata:
  node_type: memory
  type: report
  feature: N/A
  phase: review
---

# Code Review Summary - Admin/Staff Back-Office Domain

## Scope

- Files reviewed: all 9 features/admin-*/** folders (schemas/services/repository/types),
  app/(admin)/admin/**, app/(staff)/staff/**, app/api/admin/**, app/api/staff/**
  (incl. app/api/staff/uploads/route.ts), components/admin/**, lib/cloudinary.ts,
  lib/admin-list-query.ts, lib/admin-swr-revalidate.ts, plus proxy.ts,
  src/middlewares/authenticate.middlware.ts, features/auth/** (session/login path), and the
  public rendering surfaces that consume admin-authored content (components/blog/BlogArticle.tsx,
  components/policies/PolicyPageView.tsx).
- LOC: ~60 files read directly (every route handler, every repository, every schema, plus the
  key editor/gate components).
- Focus: standalone security/production-readiness audit of the whole domain as it exists today
  - not a diff review.
- Scout findings: see inline in each finding below (evidence file:line cited per finding).

## Overall Assessment

The admin/staff back-office is structurally solid on the axis the task most worried about:
every single app/api/admin/** and app/api/staff/** route calls authenticate(req) +
requireRole(user, ...) itself - there is no route that relies on proxy.ts alone (confirmed by
reading all 17 route files). Role separation between STAFF and ADMIN is real and intentional (see
the repo's own "S3" convention: ADMIN does not inherit STAFF's order-operations rights). Two
genuinely serious gaps were found: a non-functional account-lock control (Critical) and a
stored-XSS path via the blog editor (Critical/High). Below that, the domain has a real but
narrow unbounded-query pattern across most list() repository methods, and one defense-in-depth
gap (repositories have zero independent authorization - they trust the route layer completely).

## Critical Issues

### C1 - "Lock account" (admin-users) does not block login; it is cosmetic only

- Evidence: features/admin-users/services/admin-users.repository.ts:28-33 - the code's own
  comment admits it: "khoa o day chi doi co hien thi/quan ly tren panel Admin, CHUA co enforcement
  chan dang nhap o app/api/auth/session/route.ts" ("locking here only changes the
  display/management flag on the Admin panel - login is NOT YET enforced to be blocked").
  setLocked(id, locked) just flips users.is_deleted.
- Confirmed by reading the actual login path: app/api/auth/session/route.ts:38-76 mints a fresh
  app JWT (access + refresh token, httpOnly cookies) purely from profile.role - it never reads or
  checks is_deleted. authenticate.middlware.ts:18-34 (every subsequent request) only verifies
  the JWT signature/expiry, never re-checks the DB row.
- Impact: when an ADMIN "locks" a compromised/terminated STAFF or ADMIN account via
  PATCH /api/admin/users/[id] ({ locked: true }), the target user can still (a) log in fresh via
  Supabase Auth + /api/auth/session and get a brand-new valid app JWT with their full role, and
  (b) keep using any pre-existing valid access/refresh token until natural expiry - the lock has
  zero runtime effect. This is the single highest-impact finding: the only "kill switch" the admin
  panel exposes for a compromised account does not work.
- Fix: add an is_deleted check to the profile lookup in app/api/auth/session/route.ts and
  reject with 403 when locked; also check it in authenticate()/refresh-token.service.ts (or accept
  the staleness window and document it) so existing tokens are invalidated too, not just new logins.

### C2 - Stored XSS: blog bodyHtml is raw admin-authored HTML rendered unsanitized on the public site

- Evidence chain:
  - features/admin-blog/schemas/admin-blog.schema.ts:18 - bodyHtml: z.string(), no
    sanitization/transform.
  - components/admin/blog/AdminBlogEditor.tsx:274-279 - the "editor" is a plain textarea
    where STAFF types literal HTML by hand, not a WYSIWYG editor with a safe serializer.
  - features/admin-blog/services/admin-blog.repository.ts - stores content (the HTML) verbatim,
    no sanitize step on write.
  - components/blog/BlogArticle.tsx:55-58 - dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
    on the public /blog/[slug] page, no sanitize step on read either.
  - Confirmed via repo-wide grep: no sanitize-html, DOMPurify, isomorphic-dompurify, or xss
    package exists anywhere in package.json/source. dangerouslySetInnerHTML has exactly one call
    site in the whole codebase - this one.
- Impact: any STAFF (or ADMIN) account can inject a script tag / onerror handler / etc. into a
  published blog post and it executes for every public site visitor, not just staff. Given this is
  a "trusted insider" surface (attacker needs STAFF credentials), severity is bounded by the STAFF
  compromise probability - but a phished/leaked STAFF cookie or JWT is a much lower bar than typical
  admin RCE, and the blast radius is the entire public storefront (session-cookie theft,
  credential-harvesting overlays, drive-by redirects for every customer).
  features/admin-content (policies/about pages) is NOT affected - that pipeline renders
  through plain JSX text nodes (components/policies/PolicyPageView.tsx), not
  dangerouslySetInnerHTML, so it is safe as-is.
- Fix: run bodyHtml through a server-side sanitizer (e.g. isomorphic-dompurify or
  sanitize-html with an explicit allow-list) either at write-time in
  admin-blog.repository.ts (create/update) or at read-time before
  dangerouslySetInnerHTML in BlogArticle.tsx - prefer both (defense in depth), but at minimum one.

## High Priority

### H1 - Unbounded queries across most admin list() repository methods (scales badly)

Per-row query loops (true N+1) were NOT found anywhere in the 9 repositories - every repository
uses single Supabase queries with embedded joins (e.g. order_items(...), actor:users(email)).
The real risk is unbounded result sets that will degrade as tables grow:

| Repository method | Evidence | Who calls it unbounded | Growth driver |
|---|---|---|---|
| admin-orders.repository.ts listSummary() (line 168-185) | no .range()/.limit() at all - the function has no limit parameter | GET /api/admin/orders-summary (STAFF+ADMIN dashboard), adminDashboardService.getRevenue(), getAdminHome() | order volume (unbounded by business growth) |
| admin-orders.repository.ts list() (line 187-227) when called with no limit | omitted limit = full table + full order_items join | staff-ops-from-api.ts dashboard call: adminOrdersService.list({}) | same - and this variant also drags the full order-items join per row |
| admin-users.repository.ts list() (line 45-72) | no pagination at all; q search filters in JS after fetching the whole table (line 64-69), not via ilike | AdminUsersPanel.tsx on every admin panel visit | real user signups |
| admin-contact.repository.ts list() (line 44-58) | no pagination | /staff/contact page | public-facing contact form - attacker-controllable growth (spam) |
| admin-blog.repository.ts list() (line 120-140) | no pagination | /staff/blog list | staff-authored, low volume today |
| admin-coupons.repository.ts list() (line 52-63) | no pagination | /staff/coupons list | staff-authored, low volume today |

admin-audit.repository.ts is the one repo that already does this right (limit/offset,
default 100, range()). The Orders list page itself (AdminOrdersList.tsx) does pass
ADMIN_LIST_PAGE_SIZE/offset correctly - the unbounded calls are specifically the dashboard
code paths (admin-dashboard) and the users/contact panels, which have no pagination UI at
all yet.

admin-contact is the most concerning of these long-term because it's fed by the public contact
form (features/contact), not staff input - an attacker who floods that form (no rate limiting was
found wired into any admin/staff route or the public contact route) directly inflates the table the
unbounded list() full-scans on every /staff/contact page load.

- Fix: add limit/offset to admin-users/admin-contact/admin-blog/admin-coupons
  list schemas + repositories (mirror admin-audit's pattern); move the admin-users q filter
  into the Supabase query (.ilike()) instead of post-fetch JS filtering; add a capped/paginated
  variant of admin-orders listSummary() for the dashboard, or precompute revenue server-side
  with a SQL aggregate instead of pulling every row into memory (buildRevenueSnapshotFromOrders in
  revenue-from-orders.ts is a clean pure function today - no N+1 there - but it's fed by an
  unbounded fetch).

### H2 - admin-orders.service.ts has no test coverage (confirmed) - but it's the thin client wrapper, not the business logic

Confirmed via find: no admin-orders.service.test.ts exists, while
admin-orders.repository.test.ts and admin-orders.schema.test.ts do. Important nuance for
prioritization: admin-orders.service.ts (features/admin-orders/services/admin-orders.service.ts)
is a thin client-side apiRequest() wrapper - all the actual business logic (status-transition
validation via ADMIN_ORDER_STATUS_TRANSITIONS, the COD-auto-PAID-on-delivery rule, the
single-round-trip update+refetch) lives in admin-orders.repository.ts, which is exhaustively
tested (updateStatus alone has 6 test cases covering NotFound, invalid transition, COD idempotency,
payOS non-interference). So the missing coverage here is real but lower-risk than it first appears.

However, this untested-service pattern is not unique to orders - it is the convention across
the entire domain: admin-users.service.ts, admin-coupons.service.ts, admin-audit.service.ts,
admin-contact.service.ts, admin-products.service.ts all lack .service.test.ts files too, while
their repositories are tested (admin-content routes are called via inline fetch/apiRequest in
components rather than through a dedicated client service file). Flagging admin-orders.service.ts
specifically implies it's an outlier; it is not - it's the domain norm. Worth a backlog item to
add thin integration/contract tests for the client wrappers as a set (verify query-string building,
error passthrough), not a single-file gap.

### H3 - File upload endpoint trusts client-supplied MIME type, no content sniffing

- Evidence: app/api/staff/uploads/route.ts:32 - if (!file.type.startsWith("image/")) is the
  only type check. file.type is the browser-supplied Content-Type from the multipart part,
  fully attacker-controlled - a non-image file can be uploaded with a spoofed
  image/png Content-Type header and this check will pass it straight to Cloudinary as
  resource_type: "image".
- Mitigating factors: the route is auth-gated (requireRole(user, "STAFF"), line 19), so this
  is not an unauthenticated attack surface; size is capped at 5MB (line 8, 35-37); Cloudinary
  performs its own server-side validation/re-encoding on ingest which meaningfully reduces (but does
  not eliminate) the practical exploitability. There is no path-traversal risk - Cloudinary
  generates its own public_id/URL, the code never uses the client filename for storage.
- Fix (defense in depth, not urgent given the auth gate): sniff magic bytes
  (file-type/sharp probe) before upload rather than trusting file.type alone.

## Medium Priority

### M1 - Repositories have zero independent authorization; the route layer is the only line of defense

Every one of the 9 features/admin-*/services/*.repository.ts files takes id/role-agnostic
arguments and performs the write unconditionally - none of them re-check role or call
requireRole themselves (e.g. admin-users.repository.ts setRole/setLocked,
admin-coupons.repository.ts update, admin-orders.repository.ts updateStatus all just trust
the caller). proxy.ts itself says this explicitly in its own comment (proxy.ts:12-16): the edge
check is "not a substitute for per-route authenticate()/requireRole(); this is only an early UX
block, not the sole security line" (translated from the Vietnamese source comment). That per-route
check IS present everywhere today (verified), so there is no live vulnerability - but there is
exactly one line of defense per operation. A single route handler that forgets requireRole()
(or a future refactor that calls a repository from a new, unguarded context) has no second gate
to catch it.
- Fix: low-cost, high-value - thread the caller's role (or at least a boolean
  "authorized"/an already-validated AuthenticatedUser) into the sensitive repository functions
  (setRole, setLocked, updateStatus) as a required parameter so misuse fails to compile/type
  rather than silently succeeding. Not urgent given today's 100% route-level coverage, but cheap
  insurance.

### M2 - Coupon discount value has no upper bound; usage caps/expiry are unenforced because there is no redemption path yet

- Evidence: features/admin-coupons/schemas/admin-coupons.schema.ts:10 -
  discount: z.number().min(0, ...) has no .max(). For discountType: "PERCENTAGE" a STAFF user
  (or a buggy client) can set discount: 500 (500%), which would produce a negative order total
  the moment this is wired into checkout.
- More important finding: grepped the entire repo for "coupon" outside features/admin-coupons/**
  - there is no checkout/cart redemption path at all. features/checkout/** and
  features/cart/** have zero references to coupons. The coupon feature today is a pure
  admin CRUD tool with no consumer - usage_limit, used_count, expires_at, is_active are
  all stored and displayed but never read/enforced anywhere at order time, because there is no order
  time code path that touches coupons yet.
- Impact today: none - there is no way to redeem/abuse a coupon because there is no redemption
  code. Impact when checkout integration ships: whoever builds it must (a) enforce
  usage_limit/used_count/expires_at/is_active server-side at order-creation time (not trust
  any client-supplied discount), and (b) clamp percentage discounts to a sane range - neither of
  which the current schema does, so it should not be treated as "this validation already exists."
- Fix: add .max(100) (or a documented product-specific ceiling) to discount for
  PERCENTAGE; when checkout integration is planned, treat coupon-limit/expiry enforcement as new
  work, not something already covered by this admin schema.

### M3 - Audit log append-only-ness is enforced by "no code path exists," not by an explicit guard

- Evidence: supabase/migrations/20260718000000_init_schema.sql:511-516 only defines a
  SELECT RLS policy ("Only admin can view audit log") on audit_log - no explicit
  UPDATE/DELETE policy exists. Under Postgres RLS, an operation with no matching policy is
  denied by default for roles subject to RLS. However, all admin writes go through
  supabaseAdmin (the Supabase service-role key), which always bypasses RLS regardless of
  policies (this is inherent to how Supabase's service role works, not a bug in this repo).
  Confirmed by grep: only .insert() (in audit-log.repository.ts record()) and .select() (in
  admin-audit.repository.ts list()) are ever called against audit_log anywhere in the
  codebase - no route or repository currently exposes update/delete.
- Practical read: the audit trail is safe today (append-only in practice), but that safety
  comes entirely from "nobody wrote a delete route," not from a hard DB-level backstop against the
  service-role key. This is a reasonable trade-off for a solo-dev project at this scale but worth
  flagging as the honest reason it's currently tamper-resistant.
- Fix (optional hardening): if this ever needs to be provably tamper-evident (e.g. compliance
  requirement), add explicit REVOKE UPDATE, DELETE grants on audit_log, or move audit writes to a
  Postgres trigger that the app can never bypass.

### M4 - Blog slug has no charset restriction

- Evidence: features/admin-blog/schemas/admin-blog.schema.ts:12 -
  slug: z.string().trim().min(1, "Slug bat buoc."), no regex. The value flows straight into
  revalidatePath(/blog/${post.slug}) (app/api/staff/blog/[id]/route.ts:41) and the public
  /blog/[slug] route. Only STAFF/ADMIN can set it (not public input), so this is low-severity, but
  an unrestricted slug can break canonical URLs, revalidatePath matching, or produce
  visually-confusing/homograph slugs.
- Fix: constrain to a safe slug pattern (lowercase letters, digits, hyphens only) in the schema.

## Low Priority

- No rate limiting on any /api/admin/** or /api/staff/** route
  (src/middlewares/rate-limit.middleware.ts exists in the codebase per the auth context doc but
  is not imported by any admin/staff route, confirmed by grep). Low priority because every route
  requires a valid STAFF/ADMIN JWT first - this only matters if a STAFF/ADMIN credential is
  already compromised (credential-stuffing against /api/staff/uploads or list endpoints by an
  already-authenticated attacker).
- admin-users.repository.ts setRole/setLocked return type is loosely typed
  (let updated = null; in the route, app/api/admin/users/[id]/route.ts:27-33 - both branches can
  silently run and only the last one's result is kept if both role and locked are sent in one
  PATCH; not a security bug, just a minor surprise - the second if silently overwrites/ignores
  the first update's returned object even though both writes did happen against the DB).
- ADMIN can end up locking/demoting the last ADMIN account (no "last admin" guard in
  admin-users.repository.ts setRole/setLocked) - a business-continuity foot-gun, not a security
  hole, since the self-modification guard (app/api/admin/users/[id]/route.ts:18-22) only blocks
  self-targeting, not "last remaining ADMIN" targeting another ADMIN.

## Edge Cases Found by Scout

- Self-role-change/self-lock is explicitly blocked (id === user.userId check,
  app/api/admin/users/[id]/route.ts:18-22) - correctly prevents an ADMIN from locking themselves
  out or accidentally demoting themselves.
- STAFF cannot reach any ADMIN-only action: requireRole(user, "ADMIN") gates
  /api/admin/users, /api/admin/users/[id], /api/admin/audit - confirmed no STAFF-reachable path
  to any of these three routes exists.
- ADMIN cannot reach STAFF's order-operations routes by design (requireRole(user, "STAFF") only,
  no "ADMIN" in the allowed list for /api/staff/orders/**) - this is intentional per the
  codebase's own "S3" comment convention, not a bug, but worth confirming with the product owner
  that this is still the desired behavior (an ADMIN literally cannot change an order's status or
  view full order PII through the panel today, only via /api/admin/orders-summary's
  non-PII aggregate).
- Products are single-SKU (NUTEIN_PRODUCT_DB_ID constant, admin-products.repository.ts:5,89) -
  there is structurally no IDOR surface on product edit since the ID is never client-supplied.
- Coupon/blog/contact-message IDs are UUIDs looked up by exact match with NotFoundError on miss -
  no IDOR concern in the traditional sense because this is a single-tenant back office: any STAFF is
  intentionally allowed to read/edit any coupon/post/contact message (no per-staff ownership model
  exists or is implied by the product).

## Positive Observations

- 100% of the 17 admin/staff route.ts files independently call authenticate() +
  requireRole() - no route was found relying on proxy.ts alone, matching the explicit warning in
  proxy.ts's own comments.
- Order status transitions are validated against an explicit state machine
  (ADMIN_ORDER_STATUS_TRANSITIONS) server-side, with thorough test coverage including the COD
  auto-PAID edge case and payOS non-interference.
- updateStatus (admin-orders.repository.ts:297-302) merges the update+refetch into a single
  round trip instead of update-then-getById - a real perf-consciousness pattern, and audit-log
  writes consistently use after() (best-effort, non-blocking) so a logging failure never blocks
  the primary write.
- admin-audit.repository.ts is the one list endpoint that already does pagination correctly
  (limit/offset, default 100) - worth using as the template when fixing H1.
- Zod schemas are used consistently at every route boundary; duplicate-key Postgres errors
  (code 23505) are mapped to clean BadRequestErrors in both coupons and blog repositories.

## Recommended Actions

1. [Critical] Fix account lock to actually block login - check is_deleted in
   app/api/auth/session/route.ts (and ideally in authenticate()/refresh-token verification too).
2. [Critical] Sanitize bodyHtml (blog) server-side before storage and/or before
   dangerouslySetInnerHTML render - isomorphic-dompurify or sanitize-html with an allow-list.
3. [High] Add pagination to admin-users, admin-contact, admin-blog, admin-coupons
   list() methods; move admin-users's q search into the DB query; consider a capped/aggregate
   variant for admin-orders.listSummary().
4. [High] Backlog: add contract-level tests for the admin *.service.ts client wrappers as a
   set (not just admin-orders.service.ts).
5. [High] Sniff upload magic bytes instead of trusting file.type.
6. [Medium] Cap coupon discount for PERCENTAGE type; treat coupon enforcement as net-new
   work when checkout integration is scoped (it doesn't exist today).
7. [Medium] Thread an authorized-caller signal into sensitive repository functions as
   defense-in-depth insurance against a future missing requireRole() call.
8. [Low] Wire rate limiting into /api/staff/uploads at minimum; add slug charset validation;
   add a "last remaining ADMIN" guard.

## Metrics

- Type Coverage: not measured (no tsc --noEmit run as part of this review - this was a read-only
  security/architecture audit, not a build validation pass).
- Test Coverage: repository layer well-tested across all 9 features (every *.repository.ts has a
  matching *.repository.test.ts, admin-orders additionally has admin-orders.schema.test.ts);
  client *.service.ts wrapper layer has zero test files domain-wide (see H2); admin-content's
  policy-sections.ts helper is separately tested (policy-sections.test.ts).
- Linting Issues: not run (out of scope for this read-only review).

## Unresolved Questions

1. Is the ADMIN/STAFF role separation on orders (S3: ADMIN cannot view/operate STAFF's order
   queue) still the intended product behavior, or should ADMIN inherit STAFF's operational rights?
   This is a design decision, not a bug - flagging for product-owner confirmation.
2. Is there a near-term plan to wire coupons into checkout? If yes, M2's enforcement gaps become
   pre-work, not backlog.
3. Is the account-lock feature (C1) expected to be a hard session kill (revoke live tokens too) or
   just block new logins? Affects how much of refresh-token.service.ts needs to change alongside
   app/api/auth/session/route.ts.
