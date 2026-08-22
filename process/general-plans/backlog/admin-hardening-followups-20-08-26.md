---
name: plan:admin-hardening-followups-20-08-26
description: "Non-blocking follow-ups raised by the 20-08-26 admin-hardening-batch — deferred, not blocking, tracked here"
date: 20-08-26
feature: N/A
---

# Backlog — Non-Blocking Follow-Ups (Admin Hardening Batch, 20-08-26)

Source: `admin-hardening-batch_20-08-26` (H1 pagination, H3 upload sniffing, M2 coupon cap, H2
service tests). Plan is VERIFIED and archived to `process/general-plans/completed/`. These two
items were explicitly raised as deferred/accepted known gaps during EXECUTE/EVL and must not be
lost.

## 1. `getAdminHome()` role counts are now page-scoped

**Priority:** Medium — behavior change, not a defect, but should be a deliberate decision.

**Problem:** Adding pagination to `adminUsersRepository.list()` (Section A of the hardening batch)
changed `getAdminHome()`'s role-count derivation. It previously computed `newLast7Days` and
per-role counts from a full-table fetch; it now calls `list({ limit: 100 })` and derives those
counts from only the first 100 items (page-scoped), while `total` itself remains correct (from the
`count: "exact"` Supabase response). A code comment was added at the call site during EXECUTE
noting this tradeoff.

**Action:** Decide between (a) a dedicated SQL aggregate query for role counts (correct, adds one
more DB round trip) or (b) formally accepting page-scoped counts as good-enough for a dashboard
summary widget. Not a regression — the batch's plan explicitly scoped this as "outside this batch,
correct fix is a SQL aggregate" (see `admin-hardening-batch_PLAN_20-08-26.md` Known gaps table).

**Files:** `features/admin-dashboard/services/admin-dashboard.service.ts` (`getAdminHome()`).

## 2. Manual pagination/chip-count UX probe (step 33) not yet run

**Priority:** Low — agent-probe tier, no automated gate exists for this by design (UI/UX
end-to-end behavior).

**Problem:** The hardening batch's plan Section F step 33 required a manual browser probe of
`/admin/users` and `/staff/contact`: verify pagination works, search works, and filter-chip counts
stay correct after the `AdminListPagination` + `limit:1`-count-calls rewrite (Sections A/B). This
step was never executed — all automated gates (A1–A3, A5–A8) passed, but A4 ("Users and Contact
panels paginate via the existing `AdminListPagination`") remains proven only by code-level test
coverage (query-string/shape assertions), not by an actual browser session.

**Action:** Run the manual probe next time `/admin/users` or `/staff/contact` is touched, or
schedule a dedicated UX-verification pass. Not urgent — the underlying pagination pattern
(`AdminListPagination` + `count:"exact"` + `.range()`) is proven and already working in production
for `admin-audit` and `admin-orders`; this batch is the 3rd/4th application of the same pattern.

## Status

Both items are tracked here, not silently dropped. Neither blocks archival of the source plan.
