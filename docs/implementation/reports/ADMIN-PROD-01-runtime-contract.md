# ADMIN-PROD-01-runtime-contract

**ADMIN PORTAL P0 CONTRACT — FROZEN 04/10/2026** (ADMIN-PROD-01, contract only). Inputs: the [ADMIN-PORTAL-00 audit](ADMIN-PORTAL-00-gap-audit.md) and PD-1 … PD-8, approved by the PO (ADMIN-DECISION-01) and stated verbatim in this task; recorded as [DEC-ADM](../../decisions/DECISION_LOG.md#dec-adm). Companions: [RBAC](ADMIN-PROD-01-rbac-matrix.md) · [data / API](ADMIN-PROD-01-data-api-handoff.md) · [plan](ADMIN-PROD-01-implementation-plan.md).

## Preflight (evidence 1)
Branch `feat/admin-portal` at `9a52bb4` (ADMIN-PORTAL-00 on WF06 closure `1ed6010`); tree clean except `AGENTS.md`; origin/main and production `78f21f2`; WF04 / WF05 / WF06 PROD HARDENED, NOT DEPLOYED; ADMIN-PORTAL-00 docs present; no concurrent writer.

## P0 scope (evidence 2)
| Module | In P0 |
|---|---|
| A. Role verification | per-position requests, routed to the receiving unit, approve / reject in the portal |
| B. Project / startup review | first publish and core-field changes reviewed; the approved public version stays live |
| C. Organizations + delegated administration | create, edit, activate / deactivate; assign scoped managers; scoped delegation (PD-6) |
| D. Feedback operations | triage (type, priority, owner, status, resolution), 90-day screenshots, weekly summary |
| E. Categories | label, order, active / archived for existing vocabulary types |
| F. Account lifecycle (PD-7) | lock / deactivate / soft-delete by PLATFORM_ADMIN; leaders submit or escalate |
Not built: CMS, page builder, generic workflow engine, BI, new account system, permission-builder UI, notification centre, runtime action registry, application review, structural-change approval queue.

## Information architecture (evidence 3) — one `OpsShell`, flat
| Section | Route (proposal) | Visible to |
|---|---|---|
| Admin Home (pending counts per section, in scope) | `/ops` | any operator |
| Xác minh — Verification | `/ops/verification` | holders of `verification:review` |
| Dự án & Startup — Projects & Startups | `/ops/ventures` | PLATFORM_ADMIN |
| Tổ chức — Organizations (existing list + pages, new "Phân quyền" tab, lifecycle) | `/ops/network`, `/ops/org/[id]/access` | leaders (own scope), PLATFORM_ADMIN |
| Góp ý — Feedback (queue, weekly summary) | `/ops/feedback` | PLATFORM_ADMIN |
| Danh mục — Categories | `/ops/categories` | PLATFORM_ADMIN |
| Tài khoản — Accounts (requests, lock / deactivate) | `/ops/accounts` | PLATFORM_ADMIN |
Existing WF03 / WF04 tools keep their routes (`/ops/org/*`, `/demo/programmes/*`).

## A. Role verification (evidence 5) — PD-1
| Item | Rule |
|---|---|
| unit of work | one declared position = one `RoleVerificationRequest` |
| fields | requester (profile), position (title), level + organization of the position, period (from / to; past or current), receiving unit (organization), submitted_at, status, handler (account), handled_at, reject_reason (optional), history (audit events) |
| lifecycle | PENDING → APPROVED · PENDING → REJECTED · PENDING → WITHDRAWN (user) · REJECTED → PENDING (user edits and resubmits); APPROVED and WITHDRAWN are final |
| routing | HUB Tổng position → HUB Tổng; Chapter position → that Chapter; CLB position → that CLB's delegated handler. Never by the user's highest role |
| fallback | at submission, if the receiving unit has no handler: CLB → its parent Chapter → HUB Tổng; the request records the unit it was routed to |
| handler | an account holding `verification:review` on the receiving unit (role or delegated grant, [RBAC](ADMIN-PROD-01-rbac-matrix.md)); PLATFORM_ADMIN may act on any |
| approval effect | a `leadership_records` row for the title and period (ACTIVE if current, ALUMNI if ended: shown as "Cựu …"); for a current period also an ACTIVE membership of that unit (source ORGANIZATION_VERIFIED); never a RoleAssignment (DL:759) |
| while pending | grants nothing (no membership, no admin right); the user may withdraw or edit |
Supersedes D6B (DL:1482, platform-only verification) when the request model ships; existing `hub_declaration` memberships move into requests at that point.

## B. Project / startup review (evidence 6, 7) — PD-2
| Item | Rule |
|---|---|
| user-facing lifecycle | DRAFT → PENDING_REVIEW → PUBLIC; PENDING_REVIEW → REJECTED → (edit) → PENDING_REVIEW |
| first publish | "Công khai" submits a review; the venture stays DRAFT / PRIVATE until approval, then ACTIVE / PUBLIC |
| core-field change on a PUBLIC venture | the edit goes into a pending review; the approved public version stays live and unchanged; on approval the new values replace it; on rejection the live version stays |
| CORE fields | every field shown on a public surface: name, one-line summary, sectors (domains), stage, region, website, logo, creator role label (`owner_role_label`, the founder line). Team membership is private and not core |
| while pending | the owner may keep editing the pending version (UAT 1655); approve / reject carry the version the reviewer saw (a stale action gets 409) |
| criteria | completeness, accuracy, duplication, representation / identity, legal / spam / impersonation risk; never investment or viability scoring |
| reject | reason optional; the owner sees it, edits, resubmits |
| reviewer | `venture:review`, PLATFORM_ADMIN only (ventures belong to no organization) |
| out of P0 | hiding a public venture, public venture pages (D2 OUT) |
Supersedes DEC-PDF-D1 self-publish when venture review ships. The public projection (Library) keeps reading only approved values.

## Venture fields (evidence 8) — PD-3
Add `website` (http / https only, as the existing `safeUrl` rule) and `logo` (an asset reference through the existing media asset store, like avatars). Business registration / tax code: **not added**.

## C. Organization governance (evidence 9)
Hierarchy HUB Tổng → Chapter → CLB (existing PARENT relationships). PLATFORM_ADMIN: create (DRAFT), activate (PUBLISHED), deactivate (ARCHIVED, read-only) on canonical `organizations`; leaders: edit their own profile (existing `org:manage`); managers: assigned and delegated per [RBAC](ADMIN-PROD-01-rbac-matrix.md). Parent changes stay the existing close + create (no approval queue in P0). No admin organization table.

## Location (evidence 11) — PD-4
| Case | Stored |
|---|---|
| Việt Nam | `country_vocab_id` = Việt Nam + `region_vocab_id` (canonical province / city) |
| other listed country | `country_vocab_id` + optional `region_vocab_id` (a REGION item of that country, if any) + `location_text` fallback |
| country = Other | `country_vocab_id` = OTHER item + `location_text` (≤ 60) |
One store: the COUNTRY / REGION vocabulary plus one free-text column. No catalog-only rule worldwide; no curation queue in P0.

## Related
- [ADMIN-PROD-01-rbac-matrix.md](ADMIN-PROD-01-rbac-matrix.md) · [ADMIN-PROD-01-data-api-handoff.md](ADMIN-PROD-01-data-api-handoff.md) · [ADMIN-PROD-01-implementation-plan.md](ADMIN-PROD-01-implementation-plan.md)
