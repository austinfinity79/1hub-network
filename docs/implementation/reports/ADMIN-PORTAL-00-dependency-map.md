# ADMIN-PORTAL-00-dependency-map

**Blocked items, Sprint1 dependencies, API / DB gaps and the true PO decisions** (evidence 5 – 9, 17, 18, 22, 25). Parent: [ADMIN-PORTAL-00-gap-audit.md](ADMIN-PORTAL-00-gap-audit.md). No resolution is invented here: where sources disagree, both are quoted and the choice goes to the PO.

## Role verification — BIZ-CLARIFY-01 (evidence 5)
| Source | Rule |
|---|---|
| DL:1482 (D6B, implemented) · WF01:10 | only a Platform Admin verifies a declared HUB membership / position; a leader gets 403; uses the membership row (`hub_declaration`) |
| UAT 664–668 (Sprint1) | one request per declared position, routed to that unit's person in charge (HUB Tổng / Chapter / CLB); CLB without one → its Chapter; PENDING / VERIFIED / NOT_VERIFIED with reason; resubmit; past term → "Cựu …" tag; unit-side processing out of sprint 1 |
| task contract | per-position routing vs "highest level handles" unresolved |
| Ready now | a scope-aware declarations queue over existing rows (list, approve, reject) that works under D6B (platform sees all) and under per-unit routing (leader sees own unit) |
| Blocked | routing rule; NOT_VERIFIED reason shown to the user; past-term tags; whether verification creates a LeadershipRecord; the per-position request entity (UAT `RoleVerificationRequest` is in no SOT or schema) |

## Venture review — BIZ-CLARIFY-02 (evidence 6)
| Item | Status | Evidence |
|---|---|---|
| review queue mechanics (list, approve, reject with reason) | READY to architect | UAT 1649–1669 |
| review required before PUBLIC at all | BLOCKED | DEC-PDF-D1 self-publish vs UAT DRAFT → PENDING_REVIEW → PUBLIC / REJECTED; WF06 Library already lists PUBLIC ventures unmoderated (DL:1584) |
| approved PUBLIC venture edits core fields → re-review? | BLOCKED | UAT silent (only un-hide → re-review, UAT 1650) |
| previous public version visible during re-review | BLOCKED | no source |
| website / business registration number / logo | BLOCKED | UAT 1344, 1358, 1661 require them; `projects` has none; WF06 canonical cards have no website |
| ADM6 screen, "hội đồng" (council) wording, AI import review | OUT_OF_SCOPE (UAT 1664, 1890; AI import is user-confirmed) | — |

## Master data and location (evidence 7, 8)
| Capability | Proposal (canonical `organizations`, `organization_relationships`, `role_assignments`, `vocabulary_items` only) |
|---|---|
| create (DRAFT) / publish / close (ARCHIVED) HUB · CHAPTER · CLB | PLATFORM_ADMIN only; `publication_status` is the lifecycle (SOT:196 states conflict, decisions use DRAFT / PUBLISHED / ARCHIVED); launch catalog (13 / 55) = seed |
| edit profile | existing name / description (`org:manage`); logo later |
| delegated ownership | grant / revoke `HUB_COMMUNITY_LEADER` per org by PLATFORM_ADMIN; leader-to-leader delegation = PO |
| structural change | existing close + create parent relationship; approval queue for parent change FUTURE (DL:821) |
| location under catalog-only (SOT / FRZ / DL:1396) | COUNTRY / REGION vocabulary CRUD; nothing else |
| location under UAT (11 countries + "Khác" free text; provinces + "Khác"; ≤ 60-char locality) | the same CRUD + free-text staging columns on the profile + a curation list mapping staging text to items (FRZ:210 "staging until curated") |
Either outcome uses one vocabulary store; only the staging part waits for the decision.

## Feedback operations — OPS-CLARIFY-01 (evidence 9)
| Basic MVP (no policy needed) | Unresolved policy |
|---|---|
| PLATFORM_ADMIN lists, filters (type, date, status), opens an item (text, screenshot, context) and moves it NEW → REVIEWED → CLOSED (the existing enum; A05 "must not invent statuses"); weekly summary = an in-portal count by type and week, no e-mail or Slack | screenshot retention; guest e-mail use (reply? how long kept?); whether REVIEWED / CLOSED mean what ops expects; API `RECEIVED` vs DB enum wording |
Depends on Sprint1 FB-01 storing type, context, screenshot and guest e-mail (columns not in the table today).

## API and DB gaps (evidence 17, 18)
| Capability | API | DB |
|---|---|---|
| membership review | REUSE | NO_CHANGE |
| declarations queue (cross-org, scope-aware) | NEW_READ_API + HARDEN (reject reason) | INDEX_ONLY (if measured); reason: COLUMN only if shown to the user |
| per-position verification (UAT model) | BLOCKED | BLOCKED (likely NEW_TABLE or columns) |
| venture review | BLOCKED | BLOCKED (status values, reviewed_at, reject_reason, website, MST, logo; snapshot table only if PD-2b says so) |
| org create / publish / archive | NEW_WRITE_API | NO_CHANGE |
| org profile / relationships | REUSE | NO_CHANGE |
| role assignment | NEW_READ_API + NEW_WRITE_API | NO_CHANGE (`assigned_by`, `valid_from` / `valid_to`, `state` exist) |
| vocabulary | REUSE (GET) + NEW_WRITE_API | NO_CHANGE |
| location staging + curation | BLOCKED | BLOCKED (COLUMN) |
| feedback triage | NEW_READ_API (`GET /ops/feedback` already in A05) + NEW_WRITE_API (status) | COLUMN via Sprint1 FB-01 |
| audit log view | NEW_READ_API | INDEX_ONLY |
| account lock / deletion processing | BLOCKED | BLOCKED |
| legal publish, homepage / CTA content | OUT (release-managed / code) | NO_CHANGE |

## Sprint1 dependency map (evidence 22)
| Feature | Class |
|---|---|
| role assignment; vocabulary CRUD; declarations queue under D6B; org create / archive; audit view | CAN_BUILD_NOW |
| feedback triage; scope-aware verification queue | CAN_ARCHITECT_NOW (feedback data BLOCKED_UNTIL_SPRINT1 FB-01) |
| per-position RoleVerificationRequest; venture review; location staging; deletion processing | BLOCKED_BY_BUSINESS_DECISION (+ Sprint1 user-side forms) |
| admin sign-in | CAN_BUILD_NOW on today's auth; follows the Sprint1 auth replacement unchanged |

## True PO decisions (evidence 25) — TRUE_PO_DECISIONS_COUNT = 8
| # | Question | Options | Recommendation | Impact |
|---|---|---|---|---|
| PD-1 | Who verifies a declared position? | (a) Platform Admin only (D6B) (b) the unit's leader, CLB → Chapter fallback (UAT) (c) unit leader, Platform Admin when none | (c): matches UAT, keeps D6B as the fallback | queue scope, RBAC, notifications to leaders |
| PD-2 | Must a venture be reviewed before PUBLIC; on core edits; does the old public version stay up? | (a) keep self-publish (b) review first publish only (c) review first publish + core edits, old version stays | (b) until review capacity is known | WF02 lifecycle, Library, DB |
| PD-3 | Add website / MST / logo to the canonical venture (UAT) | yes / no / website only | yes, with PD-2 | WF02 form, WF06 cards |
| PD-4 | Location: catalog-only or catalog + "Khác" free text; 11 countries or Việt Nam | catalog-only / UAT model | UAT model with curation (FRZ:210 allows staging) | profile data, Library filter |
| PD-5 | Feedback: screenshot retention, guest e-mail use, status meaning | e.g. 90 days / reply-only / NEW-REVIEWED-CLOSED | short retention, reply-only, existing enum | privacy, storage |
| PD-6 | May a Chapter / HUB leader assign leaders below them? | Platform Admin only / leader delegates in subtree | Platform Admin only in P0 | RBAC, audit |
| PD-7 | Who processes account deletion requests and account locks, within what time? | Platform Admin with SLA / out of portal | Platform Admin, list + mark processed, SLA set by PO | privacy compliance |
| PD-8 | What do the new admin screens look like? No approved frame exists for a verification queue, role assignment, vocabulary or feedback (ADM6 is an annotation; ADM15 / ADM17 are FUTURE) | (a) design frames first (b) PO accepts the approved ops primitives (ADM17 / ADM18 / ADM5 patterns) as the baseline | (b) for P0: no new visual language | design gate, pixel QA |

## Related
- [ADMIN-PORTAL-00-scope-matrix.md](ADMIN-PORTAL-00-scope-matrix.md) · [ADMIN-PORTAL-00-gap-audit.md](ADMIN-PORTAL-00-gap-audit.md)
