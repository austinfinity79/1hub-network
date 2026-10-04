# ADMIN-PROD-01-implementation-plan

**Approval architecture, Sprint1 dependencies and model ownership, task phases, PO decision check, self-audit and evidence index** (evidence 20, 28 – 36). Parent: [ADMIN-PROD-01-runtime-contract.md](ADMIN-PROD-01-runtime-contract.md). ADMIN-PROD-02 is not started.

## Approval architecture (evidence 20)
**Workflow-specific queues**, no generic `ReviewQueue` table. Role verification (unit handlers, routing and fallback, effects on leadership / membership), venture review (platform reviewer, versioned core fields, public version kept live) and account requests (platform only, irreversible-adjacent actions) differ in actor, state, ownership and rules; each keeps its state on its own canonical record. Shared only: the list / detail / approve-reject-with-reason UI pattern in the OpsShell, the `writeAudit` helper, the capability checks and the Admin Home counts.

## Sprint1 dependencies (evidence 28)
| Sprint1 item | Admin use | Class |
|---|---|---|
| S1-UAT-02 Feedback (modal, submission, rate limit) | feedback triage, summary | ARCHITECT_NOW · data BLOCKED_BY_SPRINT1_IMPLEMENTATION |
| S1-UAT-03 / 03B onboarding + RoleVerificationRequest (user side) | verification queue | ARCHITECT_NOW · data BLOCKED_BY_SPRINT1_IMPLEMENTATION |
| S1-UAT-06 venture flows (website, logo, submit for review) | venture review | ARCHITECT_NOW · owner side BLOCKED_BY_SPRINT1_IMPLEMENTATION |
| auth replacement (password + Google) | admin sign-in | READY_NOW (independent: admin rides on whatever session exists) |
| location catalog (countries, provinces, OTHER) | categories | READY_NOW for category admin · location data BLOCKED_BY_SPRINT1_IMPLEMENTATION |
| organizations, delegation, accounts, categories | — | READY_NOW |
**No fork rule.** Each shared model has one owner of its migration, built to this contract; the other side builds on it: `role_verification_requests` and the feedback columns → whichever of ADMIN-PROD-02 or the Sprint1 task lands first, the other reuses it unchanged; `venture_reviews`, `projects.website` / `logo_asset_id` → the same rule with S1-UAT-06. A conflicting Sprint1 shape is a CONTRACT_CONFLICT (STOP), not a second table.

## Task phases (evidence 29)
| Task | Content | Gate |
|---|---|---|
| ADMIN-DESIGN-01 | design only the required admin screens in OpsShell + the current design system (PD-8): verification list / detail, venture review list / diff, org access tab, feedback queue / summary, categories, accounts, Admin Home | this contract frozen; runs alongside 02–05 |
| ADMIN-PROD-02 | RBAC / scope / data foundation: capabilities, delegation column and enforcement, scope resolution, migrations for admin-owned tables / columns, audit codes | contract frozen |
| ADMIN-PROD-03 | role verification APIs (+ approval effects, fallback routing, notifications) | 02; RVR table owner settled |
| ADMIN-PROD-04 | venture review APIs (versioned core fields) + organization admin APIs (lifecycle, access grants) | 02; S1-UAT-06 coordination |
| ADMIN-PROD-05 | feedback (triage, summary, 90-day screenshot job), categories, account requests and lifecycle APIs | 02; S1-UAT-02 for feedback data |
| ADMIN-PROD-06 | admin frontend in OpsShell (sections, Admin Home, notifications list for users) | 03–05 + ADMIN-DESIGN-01 |
| ADMIN-PROD-07 | functional / security QA (RBAC per actor and scope, delegation ceilings, privacy, audit completeness) | 06 |
| ADMIN-PROD-08 | pixel / responsive / closure | 07 |
Each runtime task ends with an API contract amendment for its endpoints (05 §26 onward) and stays local until the PO authorizes push.

## PO decision check (evidence 30)
`TRUE_PO_DECISIONS_REMAINING = 0`. PD-1 … PD-8 are applied as written. Points PD-1 … PD-8 do not spell out were settled as contract choices from existing evidence, not reopened (recorded as DEC-ADM-C*): the venture reviewer is PLATFORM_ADMIN (ventures belong to no organization; UAT "Quản trị"); CORE = every publicly shown venture field; verification approval creates a leadership record (+ membership for a current term), never a role (DL:759, UAT 666); WITHDRAWN state for withdrawals; delegable capability list; feedback NEW → DONE shortcut and type OTHER for admin reclassification; hiding a public venture stays out of P0.

## Self-audit (section 32)
| Check | | Check | |
|---|---|---|---|
| PD-1 → PD-8 preserved exactly | ✓ | feedback 90-day screenshot retention | ✓ |
| no new role | ✓ | scoped delegation | ✓ |
| OpsShell reused | ✓ | PLATFORM_ADMIN owns lock / delete | ✓ |
| canonical entities reused | ✓ | no enterprise CMS | ✓ |
| one request per position | ✓ | workflow-specific queues | ✓ |
| fallback CLB → Chapter → HUB Tổng | ✓ | server-side RBAC | ✓ |
| venture review lifecycle | ✓ | audit requirements | ✓ |
| public version live during re-review | ✓ | Sprint1 dependencies mapped | ✓ |
| website + logo included | ✓ | no runtime code, no migration | ✓ |
| business registration / tax code excluded | ✓ | no push, merge, deploy | ✓ |
| hybrid location | ✓ | ADMIN-PROD-02 not started | ✓ |

## Evidence index, files and git (evidence 1 – 36)
1–3, 5–9, 11: [runtime contract](ADMIN-PROD-01-runtime-contract.md) · 4, 10, 14, 18, 19, 23, 24: [RBAC](ADMIN-PROD-01-rbac-matrix.md) · 12, 13, 15–17, 21, 22, 25–27: [data / API](ADMIN-PROD-01-data-api-handoff.md) · 20, 28–36: this file. Files: the four `ADMIN-PROD-01-*` reports, `DECISION_LOG.md` (DEC-ADM), `CLAUDE_LATEST_REPORT.md`. Local commit on `feat/admin-portal` (SHA in the chat report); working tree clean except `AGENTS.md`; origin/main `78f21f2`; production `78f21f2`. No runtime code, no migration, no push, no merge, no deploy; ADMIN-PROD-02 not started.

## Related
- [ADMIN-PROD-01-runtime-contract.md](ADMIN-PROD-01-runtime-contract.md) · [ADMIN-PORTAL-00-dependency-map.md](ADMIN-PORTAL-00-dependency-map.md)
