# ADMIN-PORTAL-00-scope-matrix

**Proposed smallest Admin Portal: canonical data map, write authority, approval architecture, audit and notification rules, IA, P0 scope, phasing and readiness** (evidence 12 – 16, 19, 23, 24, 26 – 32). Parent: [ADMIN-PORTAL-00-gap-audit.md](ADMIN-PORTAL-00-gap-audit.md); blocked items and PO decisions: [ADMIN-PORTAL-00-dependency-map.md](ADMIN-PORTAL-00-dependency-map.md). A proposal for PO review, not a contract.

## Canonical data map (evidence 12)
| Admin capability | Canonical record (no admin copy) |
|---|---|
| profiles (read only for admins; no edit of another user, no impersonation) | `individual_profiles`, `profile_visibility_settings` |
| role verification | `community_memberships` (`hub_declaration`, `claimed_position`, `claimed_period`), `leadership_records`; UAT `RoleVerificationRequest` = PD-1 |
| organizations | `organizations`, `organization_relationships` |
| roles | `role_assignments` (`assigned_by`, `valid_from` / `valid_to`, `state`) |
| ventures | `projects`, `project_domains` (review fields = PD-2 / PD-3) |
| programmes | `programmes` (WF04, existing operator tools) |
| applications | `applications`: operators read none (DL:1568) — not an admin object |
| feedback | `feedback_submissions` (+ Sprint1 FB-01 columns) |
| vocabulary / location | `vocabulary_items` (COUNTRY, REGION, DOMAIN, SKILL, SPECIALIZATION, VENTURE_STAGE) |
| legal / static content | `legal_documents` + `content/legal/*` (release-managed); homepage / About in code |
| audit | `audit_events` |

## Write authority matrix (evidence 13) — server-side RBAC on every call
| Actor | Entity | Read | Create | Edit | Approve | Reject | Close / Delete | Scope |
|---|---|---|---|---|---|---|---|---|
| PLATFORM_ADMIN | HUB declaration / position | ✓ | — | — | ✓ | ✓ (reason) | — | platform (D6B; PD-1 may add units) |
| PLATFORM_ADMIN | join request | ✓ | — | — | ✓ | ✓ | — | platform |
| PLATFORM_ADMIN | organization | ✓ | ✓ (P1) | ✓ name, description | publish (P1) | — | archive (P1) | platform |
| PLATFORM_ADMIN | parent relationship | ✓ | ✓ | — | — | — | close | platform |
| PLATFORM_ADMIN | role assignment | ✓ | grant | — | — | — | revoke | platform |
| PLATFORM_ADMIN | vocabulary item | ✓ | ✓ | label, order | — | — | archive (never delete) | platform |
| PLATFORM_ADMIN | feedback | ✓ | — | status | — | — | CLOSED | platform |
| PLATFORM_ADMIN | venture review | BLOCKED (PD-2) | — | — | — | — | — | — |
| PLATFORM_ADMIN | audit log | ✓ (P1) | — | — | — | — | — | platform |
| HUB_COMMUNITY_LEADER | join request, members, leadership, events, relationships, programmes, own org profile | ✓ | as today | as today | join requests | join requests | as today | exact org, no inheritance |
| HUB_COMMUNITY_LEADER | declaration, roles, vocabulary, feedback, audit | — | — | — | — (PD-1 / PD-6 may change) | — | — | — |
| member / owner | own records | as today | — | — | — | — | — | self |
No role can edit another user's profile, read applications, publish legal text or change homepage content from the portal.

## Approval architecture (evidence 14)
Recommendation: **workflow-specific queues, shared building blocks.** Each queue keeps its state on the canonical record (membership `state` + `hub_declaration`; later the venture status), so a generic `ReviewQueue` table would duplicate that state and blur different rules (who decides, what approval creates). Shared parts only: a list / detail / approve-reject-with-reason UI pattern, the `writeAudit` helper, and capability checks. Dashboard counts are plain queries.

## Audit and notifications (evidence 15, 16)
| Rule | Detail |
|---|---|
| fields | existing `audit_events`: actor, action, resource type / id, before / after state deltas, `request_id`, time; a reason goes in `after_data` |
| new codes (P0) | `ROLE_ASSIGNED`, `ROLE_REVOKED`, `VOCABULARY_ITEM_CREATED` / `_UPDATED` / `_ARCHIVED`, `FEEDBACK_STATUS_CHANGED`; declarations reuse `MEMBERSHIP_APPROVED` / `_REJECTED` |
| never stored | names, e-mails, phone, feedback text or screenshots, profile fields; no read events (DL:767) |
| notifications | none required for P0: verification and review results show as in-app status (UAT 667, 1649); weekly feedback summary is an in-portal view; no e-mail / Slack per item; Resend stays for auth and invitations |

## Proposed IA (evidence 19) — inside the existing `/ops` shell, flat
| Section | Who | P0 |
|---|---|---|
| Mạng lưới (existing org list → org pages) | leaders, admin | existing |
| Xác minh (declarations queue) | admin (PD-1: + unit leaders) | IN_P0 |
| Phân quyền (role assignments per org) | admin | IN_P0 |
| Danh mục (vocabulary) | admin | IN_P0 |
| Góp ý (feedback + weekly counts) | admin | IN_P0 after Sprint1 FB-01 |
| Duyệt dự án (venture review) | admin | BLOCKED |
| Nhật ký (audit) · Tổ chức mới / đóng | admin | P1_LATER |
No Dashboard, Content, Settings or Legal section in P0.

## P0 scope proposal (evidence 23)
| Class | Items |
|---|---|
| IN_P0 | declarations verification queue (scope-aware, D6B now); role assignment for HUB / Chapter / CLB leaders; vocabulary management (no new types); feedback triage with existing statuses and weekly counts (after FB-01) |
| P1_LATER | audit log view; organization create / publish / archive in the portal (launch catalog by seed); org logo; post-login landing for admins; deletion-request list (after PD-7) |
| FUTURE | org approval queue (ADM15), parent-change approval, account list (ADM17), system status (SYS1), notification centre, CMS / page builder, runtime feature flags or action registry, application review |
| BLOCKED | per-position verification model (PD-1), venture review + website / MST (PD-2, PD-3), location staging / curation (PD-4), feedback retention / guest e-mail (PD-5), leader delegation (PD-6), account lock / deletion processing (PD-7), screen design source (PD-8) |

## Phasing (evidence 24)
| Task | Content | Gate |
|---|---|---|
| ADMIN-PROD-01 | contract: P0 scope, PD-1 / 5 / 6 / 8 answers, API amendment, capability names | PO decisions |
| ADMIN-PROD-02 | RBAC + data foundation: platform capabilities (`role:manage`, `vocabulary:manage`, `feedback:manage`, declaration review scope); no new table | contract frozen |
| ADMIN-PROD-03 | APIs: role assignment, vocabulary write, declarations queue, feedback read / status | Sprint1 FB-01 for feedback |
| ADMIN-PROD-04 | screens in the ops shell | PD-8 |
| ADMIN-PROD-05 / 06 | QA (RBAC, privacy, audit) · pixel / closure | — |
Venture review gets its own track once PD-2 / PD-3 are answered.

## Readiness diagnostic (evidence 26)
Scope 60 % · roles / RBAC 70 % · data 65 % · APIs 35 % · frontend 30 % · business rules 35 % · testability 70 % · **overall ≈ 45 %** (diagnostic only).

## Files, git and confirmation (evidence 27 – 32)
Files: the three `ADMIN-PORTAL-00-*` reports and `CLAUDE_LATEST_REPORT.md`. Local commit only (SHA in the chat report); working tree clean except `AGENTS.md`; origin/main `78f21f2`; production `78f21f2`. No runtime change, no migration, no push, no merge, no deploy, no implementation task started.

## Related
- [ADMIN-PORTAL-00-gap-audit.md](ADMIN-PORTAL-00-gap-audit.md) · [ADMIN-PORTAL-00-dependency-map.md](ADMIN-PORTAL-00-dependency-map.md)
