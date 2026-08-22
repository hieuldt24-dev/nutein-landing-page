---
name: report:public-facing-review
description: "Production-readiness review of the public-facing marketing + shop domain (about, account, blog, contact, policies, product) -- non-admin, non-payment"
date: 19-08-26
metadata:
  node_type: memory
  type: report
  feature: full-codebase-review
  phase: review
---

# Code Review Summary — Public-Facing Domain (Marketing + Shop)

## TL;DR

The IDOR-sensitive stuff (addresses, profile, orders) is solid — every query is scoped by
user_id server-side. The two real problems are: (1) the blog renders raw admin-authored HTML
via dangerouslySetInnerHTML with zero sanitization anywhere in the pipeline (stored XSS on
every visitor browser), and (2) the public contact form has no rate limiting, CAPTCHA, or
honeypot — it is an open, unauthenticated write straight into the DB with a rate limiter already
built in the codebase but never wired to this route. Everything else is medium/low: an
unnecessary triple-fetch of the blog table on the list page, account routes gated client-side only
(no real data leak, just inconsistent with the staff/admin proxy pattern), a shared
module-level product cache that is a latent race condition, and confirmed zero test coverage on
about and contact.

### Scope
- Files: about 55 read directly (features/about, account, blog, contact, policies, product; their
  app/(marketing) and app/(account) pages; app/api/account, app/api/blog, app/api/contact,
  app/api/product/catalog; components/about, account, blog, contact, policies, product, layout,
  providers; app/layout.tsx, app/globals.css; the 8 named lib files)
- LOC: roughly 3500 across the above
- Focus: full domain audit (no diff — reviewed as it exists on disk today)
- Scout findings: folded into the sections below (IDOR, XSS, spam, N+1, a11y, bundle-size)

### Overall Assessment

Architecture is consistent and disciplined: repository/service split, every mutation scoped by
user_id from the JWT, withErrorHandler on every route, Zod validation on every input boundary.
The two Critical/High findings below are narrow and fixable in isolation — they do not reflect a
systemic pattern problem, they are gaps in two specific pipelines (blog HTML render, contact
abuse protection).

---

### Critical Issues

C1 — Stored XSS: blog post HTML is rendered with zero sanitization.
features/blog/services/blog.service.ts line 57 maps the raw content DB column straight to
bodyHtml: row.content with no transformation. components/blog/BlogArticle.tsx lines 55-58 render:

    <div className="blog-prose ..." dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />

The write side (features/admin-blog/schemas/admin-blog.schema.ts line 18) accepts
bodyHtml: z.string() with no HTML restriction. A grep for sanitize, DOMPurify, dompurify, and xss
across app/, components/, features/, lib/, src/ returns zero hits, and neither dompurify,
isomorphic-dompurify, nor sanitize-html is a package.json dependency. There is no sanitizer
anywhere in the pipeline — write or read side.

Impact: any HTML or JS saved into blog_posts.content (via a compromised staff/admin session, an
insider, a rich-text-editor bug that lets script or onerror attributes through, or direct DB
access) executes in every site visitor browser on /blog/[slug] — session/cookie theft, fake
login-form injection, defacement. This is public, unauthenticated-reach surface even though the
write path is admin-gated — defense-in-depth for HTML rendering is exactly the case sanitize-on-read
exists for, and it costs one library.

Fix: sanitize at read time (cheapest, catches any historical bad rows too) with
isomorphic-dompurify or sanitize-html in blog.service.ts before bodyHtml is set, and/or sanitize
at write time in admin-blog (out of this domain scope but worth flagging to the admin reviewer —
this pairs with whatever finding the admin-blog review already has for the identical write-side
gap).

Contrast: features/policies/parse-content.ts handles the analogous admin-authored-content case
correctly — it parses to plain text and PolicyPageView.tsx renders it as React text nodes (no
dangerouslySetInnerHTML anywhere in components/policies/). Blog is the outlier.

---

### High Priority

H1 — Public contact form has zero abuse protection.
app/api/contact/route.ts leads to contactService.submit leads to contactRepository.create, a
fully unauthenticated POST that inserts directly into contact_messages via supabaseAdmin
(service role, bypasses RLS). There is:
- No rate limiting. src/middlewares/rate-limit.middleware.ts exists and is fully built
  (rateLimiter, globalLimiter, authLimiter, sessionLimiter), but grepping for rate-limit or
  rateLimit in app/api (excluding tests) returns zero matches — it is wired to nothing, not even
  the auth routes; contact never calls it at all.
- No CAPTCHA, no honeypot field, no per-IP or per-session throttle of any kind on the client
  (components/contact/ContactForm.tsx) or server.
- Zod validation (contact.schema.ts) checks shape and length only — no content-based spam
  heuristics (that is expected), but combined with zero rate limiting, a bot can flood
  contact_messages at whatever rate it wants.
- Note also: rateLimiter is itself fail-open when REDIS_URL/redis is not configured
  (rate-limit.middleware.ts lines 20-22) — so even if it were wired to /api/contact, it silently
  no-ops in any environment without Redis configured. Worth keeping in mind when fixing this.

Impact: spam/abuse flood of the contact table, and by extension whatever internal
staff/admin-contact inbox consumes it (out of this review scope, but flagging the upstream
insecure-input-source per the task brief).

Fix: add globalLimiter (or a dedicated, tighter contact-specific limiter) to
app/api/contact/route.ts, and add a honeypot field (cheap, no user-facing friction) as a second
layer independent of Redis availability.

---

### Medium Priority

M1 — Blog list page fetches the entire posts table three times per request.
app/(marketing)/blog/page.tsx lines 44-49 runs, in the non-filtering branch, listFeatured(4),
listLatest(8), and listFavoriteRecipes(4) inside one Promise.all. Each of those independently
calls fetchPublishedPosts() (features/blog/services/blog.service.ts lines 98-109), which does a
fresh select(...).eq(is_published, true) against blog_posts with no in-request memoization.
That is 3 identical full-table queries fired in parallel for one page render (the code own
comment says the dataset is small as the justification for doing filtering in-memory rather than
SQL — but it still re-fetches that small dataset 3 times instead of once). BlogDetailPage
([slug]/page.tsx) does the same pattern once extra: getPostBySlug (1 query) plus listRelated
(1 more full-table fetch) — 2 queries, less severe but same root cause.

Fix: fetch fetchPublishedPosts() once per request and derive featured, latest, favorites, and
related from the same array, or add a short-lived per-request cache (e.g. React.cache()) around
fetchPublishedPosts.

M2 — /account/** route group has no server-side auth gate; relies entirely on a client component.
proxy.ts explicitly gates only /staff/** and /admin/** (confirmed by reading the file — its own
comment enumerates exactly these two). app/(account)/account/layout.tsx is a use-client
component that checks useAuthStore() client-side and calls window.location.replace(/) when
isReady and not isLoggedIn. This is not a data leak — every actual data fetch on account pages
goes through authenticate(req)-gated API routes (/api/account/profile, /api/account/orders,
/api/account/addresses), and the layout correctly renders an empty placeholder (not children)
before redirecting. But it is a defense-in-depth and consistency gap versus the staff and admin
pattern: an unauthenticated request (bot, crawler, no-JS client) gets a 200 with the account-shell
skeleton HTML instead of an edge redirect, and a no-JS client never redirects at all (stuck on the
loading skeleton indefinitely).

Fix: consider adding /account to proxy.ts edge guard for consistency (optimistic JWT check, same
as staff/admin — not the only security layer per the file own comment, but matches the
established pattern and avoids serving account-shell HTML to anonymous crawlers).

M3 — Missing global error.tsx for the marketing/shop route tree.
Searching for error.tsx or not-found.tsx anywhere under app/ returns zero results. Every RSC data
call in this domain (policyService.getBySlug, blogService.getPostBySlug, getProductDetailServer)
throws a plain new Error(...) on a Supabase failure with no try/catch at the page level (blog
detail page is the one exception — it catches NotFoundError specifically for notFound(),
everything else propagates). Without an error.tsx, a transient Supabase outage serves Next
generic default error page on /product, /blog, /policies/[slug] instead of a branded, recoverable
error state.

M4 — Module-level mutable product cache is a latent race condition.
features/product/services/product.service.ts lines 46-47 declare cachedDetail and cachedCatalog
as plain module-level let bindings, mutated by setProductDetail(). Both
app/api/product/catalog/route.ts (dynamic = force-dynamic, called per-request) and
app/(marketing)/product/page.tsx (ISR, revalidate = 3600) call getProductDetailServer(), which
calls refreshProductCatalogServer(), which calls setProductDetail() against this shared, global,
per-process cache. In a warm Node process handling concurrent requests, two interleaved async
calls can race: request A await on the Supabase fetch can complete after request B, so A stale
write can land after B newer one, and there is a window between the await
refreshProductCatalogServer() resolving and the immediate productService.getProductDetail() read
where a third concurrent request can have already overwritten the cache. Currently low real-world
impact (single product, same DB row, values are usually identical across concurrent fetches — a
genuinely different read requires an in-flight staff price or stock edit racing a customer
request), but this pattern breaks outright the moment a second product is introduced, and is
worth flagging now while it is cheap to fix (this is the N+1/data flow concern called out in the
review brief, structural not incidental).

M5 — AccountAddressList delete button has no confirmation step
(components/account/AccountAddressList.tsx lines 154-172) — a misclick permanently removes a
saved address with only a toast afterward, no undo. Low-effort fix (confirm dialog, same pattern
already used elsewhere in the codebase per useUnsavedChangesGuard.tsx AdminConfirmLeaveDialog).

---

### Low Priority

L1 — Unnecessary use-client on presentational product components.
components/product/ProductGallery.tsx and components/product/ProductBuySection.tsx are both
marked use-client but contain no hooks, no event handlers, no browser-only APIs — they are pure
composition/presentation wrapping the genuinely-interactive ProductPurchasePanel. Only the leaf
that needs interactivity should carry the client boundary; the current setup ships more JS to the
browser than necessary for the product page. AboutHero.tsx is similarly use-client but this one
is more defensible (uses view-triggered animation helpers BounceChars/FadeInOnView that likely
need IntersectionObserver/client lifecycle) — not flagged as an issue, only noted for contrast.

L2 — Global window.history.pushState/replaceState monkey-patching.
lib/useUnsavedChangesGuard.tsx lines 149-169 overwrites window.history.pushState and
replaceState globally while the guard is active, restoring the originals on cleanup. Functionally
sound (used correctly and scoped to enabled), but this is a fragile pattern if any other library
or future code also patches history — flagging as a maintainability note, not a bug.

---

### Test Coverage — Explicit Gap Confirmation

Per the task brief explicit ask, confirmed via direct find for asterisk.test.asterisk:

| Feature | Service/repo tests | API route tests | Component tests | Verdict |
|---|---|---|---|---|
| features/about | none | n/a (no API route) | none | Zero coverage, confirmed |
| features/contact | none | none (app/api/contact has no test) | none (ContactForm.tsx untested) | Zero coverage, confirmed — worst case given H1 above: the one unauthenticated public write path in this domain has no test coverage at all, including no spam/abuse regression test |
| features/account | address.repository.test.ts, address.service.test.ts only | address routes tested (addresses/route.test.ts plus [id] plus [id]/default) | none | Partial — profile.service.ts, profile.repository.ts, and account-order.service.ts are untested, as are app/api/account/profile and app/api/account/orders routes |
| features/blog | blog.service.test.ts | none (app/api/blog, app/api/blog/[slug] untested) | none — notably BlogArticle.tsx (the C1 XSS-risk render path) is untested | Partial |
| features/policies (not in the flagged list, checked anyway) | policy.service.test.ts | n/a | parse-content.ts and PolicyPageView.tsx untested | Partial |
| features/product | product.service.test.ts | none | none | Partial |

---

### Positive Observations

- IDOR is a non-issue across the board. address.repository.ts, profile.repository.ts, and
  account-order.service.ts all scope every select, update, and delete with eq(user_id, userId)
  sourced from authenticate(req) (JWT), never from client-supplied input. address.service.ts
  findById plus NotFoundError pattern before mutating correctly prevents cross-user address
  enumeration via error-message differences.
- Policies content rendering is done right — plain-text parsing (parsePolicyContent), rendered as
  React text nodes, no dangerouslySetInnerHTML anywhere in that component tree. This is the
  correct pattern that blog (C1) should be matched to, or sanitized if raw HTML must be kept.
- lib/api-client.ts and lib/swr-fetcher.ts have no silent error swallowing — every non-2xx or
  success-false response is normalized into a thrown FetchError with status and code, and the
  single-flight restoreApiSession correctly de-dupes concurrent 401 remint attempts.
- Zod validation is present and reasonably strict on every public input boundary reviewed
  (contact, address, profile, blog query params).
- Navbar.tsx has solid accessibility groundwork: aria-expanded, aria-label on icon-only and
  dynamic buttons, aria-hidden on decorative glyphs, Escape-to-close and click-outside handling
  on both the mobile menu and the desktop mega-dropdown, role dialog and aria-modal on the mobile
  panel. Product images consistently carry real alt text sourced from data, not empty strings.
- server-only guard is consistently present at the top of every repository and service file
  reviewed.

---

### Recommended Actions

1. (Critical) Add HTML sanitization to the blog render pipeline — sanitize content before it
   becomes bodyHtml, or sanitize at render time in BlogArticle.tsx immediately before
   dangerouslySetInnerHTML. Coordinate with the admin-blog reviewer since the write side needs the
   matching fix.
2. (High) Wire globalLimiter (or a new contact-specific limiter) into app/api/contact/route.ts and
   add a honeypot field to ContactForm.tsx. Do not rely on Redis alone given the fail-open
   behavior when REDIS_URL is unset.
3. (Medium) Collapse the blog list page 3 redundant fetchPublishedPosts() calls into 1 shared
   fetch (M1).
4. (Medium) Decide whether /account/** should join the proxy.ts edge guard for consistency with
   /staff and /admin (M2) — not urgent since there is no data leak, but worth a deliberate
   decision rather than an implicit gap.
5. (Medium) Add a root or route-group error.tsx for the marketing/shop tree (M3).
6. (Medium) Refactor product.service.ts module-level cache to a per-request pattern (e.g.
   React.cache()) before a second product is ever added (M4).
7. (Low) Write test coverage for features/contact first (it is the only unauthenticated public
   write path with zero tests), then features/about, then fill the partial gaps in
   account, blog, and product noted in the coverage table.
8. (Low) Drop unnecessary use-client from ProductGallery.tsx and ProductBuySection.tsx (L1).

### Metrics
- Type Coverage: not separately measured this pass (no tsc --noEmit run — read-only review)
- Test Coverage: see table above — 2 of 6 features in scope (about, contact) at 0 percent, 4 at
  partial coverage
- Linting Issues: not run this pass
- Findings: 1 Critical, 1 High, 5 Medium, 2 Low

### Unresolved Questions
- Is blog_posts.content actually intended to hold raw HTML long-term, or was
  dangerouslySetInnerHTML a stopgap for a markdown or rich-text migration that has not landed yet?
  Affects whether the fix is sanitize the HTML versus stop storing and rendering HTML at all and
  switch to the same plain-text pipeline policies already uses.
- Does the admin-contact inbox (out of this review scope) render contact_messages.message
  anywhere with dangerouslySetInnerHTML? If so, H1 blast radius extends to staff sessions too —
  worth a one-line cross-check from whoever reviews admin-contact.
- Confirm intended REDIS_URL provisioning in production — if Redis is not actually deployed, H1
  fix needs a non-Redis-dependent layer (e.g. honeypot) as the primary defense, not a backup.
