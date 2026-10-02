# WF05-PROD-00_gap-matrix

**WF05-PROD-00 — classified gaps and the proposed hardening plan.** Every gap has exactly one class. Evidence (file:line) in [runtime matrices](WF05-PROD-00_runtime-matrices.md) and [API / DB / security](WF05-PROD-00_api-db-security.md); verdict in [gap audit](WF05-PROD-00_gap-audit.md).

## Gaps
| ID | Gap | Class | Task |
|---|---|---|---|
| G01 | CLAUDE.md §2 and Master Spec still call WF05 demo, while the L5 Application is server-side and deployed (DEC-2809-D6); conflict-audit C-05 asked for the CLAUDE.md wording update, never done | SOT_CONFLICT | PROD-01 (PO-1) |
| G02 | Data SOT §2 / §12 Team, Startup, memberships, `primary_applicant_id` vs one Venture (DEC-2809-D5, DEC-WF05-G4, M013) | SOT_CONFLICT | PROD-01 (PO-4) |
| G03 | Data SOT review states after SUBMITTED; M013 has DRAFT / SUBMITTED only | NOT_REQUIRED_FOR_P0 | — |
| G04 | stale, unmarked: DEC-WF05-G3, T00-D2 / D3; WF05 completion audit, UAT matrix, P0_STATUS "(DEMO)"; reset copy vs HD-A10; snapshot `team` shape vs L5 contract | P2_QUALITY | PROD-01 |
| G05 | capability matrix `venture:manage` says owner only (code + DEC-L2R-D7: EDIT too), no application rows; OpenAPI YAML lacks `/applications*`, `/ventures/{id}/publish` | P2_QUALITY | PROD-01 |
| G06 | malformed 36-character venture id → 500 on `/ventures/{id}`, publish, team, `/demo/projects/{id}` (loose regex `venture.ts:209`) | P1_HARDENING | PROD-03 (WF02 code) |
| G07 | `GET /me/applications` returns a bare array, not the §2.4 list envelope | P1_HARDENING | PROD-03 |
| G08 | `POST …/team/invitations` ignores `Idempotency-Key` (declared, unused; contract §2.3) | P1_HARDENING | PROD-03 (WF02 code) |
| G09 | `PATCH /applications/{id}`: no ARCHIVED-venture re-check, unbounded `answers` array, no stale-version check | P1_HARDENING | PROD-03 |
| G10 | create reads the form without a lock; a concurrent `PUT …/registration` can bump the version after an application exists (Q3 rule) | P1_HARDENING | PROD-03 |
| G11 | draft of a CLOSED programme: `questions []` hides saved answers, review shows "eligible", submit → generic 409 | P1_HARDENING | PROD-03 / 04 |
| G12 | 500s are swallowed without a server log (`handler.ts:87-90`) | P1_HARDENING | PROD-03 |
| G13 | second pool connection inside write transactions (pool 10); invite e-mail sent inside a `FOR UPDATE` transaction | P1_HARDENING | PROD-03 |
| G14 | no rate limit; CSRF relies on SameSite=lax; framework 400 / 405 not in the envelope | P2_QUALITY | global, later |
| G15 | `idempotency_keys.response_body` keeps application DTOs with answers; `purgeExpiredIdempotencyKeys` is never called | P1_HARDENING | PROD-02 |
| G16 | a SUBMITTED application can be DELETEd (trigger covers UPDATE only) | P1_HARDENING | PROD-02 (migration) |
| G17 | DB-level immutability of DRAFT keys, venture type vs applicant type, snapshot shape check | P2_QUALITY | PROD-02, optional |
| G18 | app DB role owns the tables (trigger can be disabled) | P2_QUALITY | infra lane |
| G19 | no deterministic WF05 test fixtures (PROJECT venture, EDIT / VIEW members, second owner, ARCHIVED venture, DRAFT / SUBMITTED applications, CLOSED programme with applications, form-less programme, TEAM-only / STARTUP-only forms) | P1_HARDENING | PROD-02 |
| G20 | seeded venture ACTIVE + PRIVATE (unreachable) without DEC-L2R-D4 fields; seed re-run overwrites the d4 form; L5 spec mutates the shared form and leaves rows | P2_QUALITY | PROD-02 / 05 |
| G21 | "Đặt lại demo" clears an unused key, reports success and claims to delete applications | P1_HARDENING | PROD-04 (or removed by PO-2) |
| G22 | demo frame on real data: notice, "· Demo" entry, `/demo/projects`, `/api/v1/demo/projects*`, legacy actor key | PO_DECISION_REQUIRED | PROD-04 (PO-2) |
| G23 | expired session: S01 / S02 retry loop, form / review generic error; guest apply deep link loses its return path | P1_HARDENING | PROD-04 |
| G24 | cancel / back hard-wired to `/demo/projects/:id`; SUB3 → `/projects`, which shows no application status | P2_QUALITY | PROD-04 |
| G25 | a submitted application becomes unreachable once its programme closes (lists show open programmes only) | PO_DECISION_REQUIRED | PROD-04 (PO-3) |
| G26 | failed autosave has no retry; up to 20 s of typing lost on refresh while the copy promises resume | P2_QUALITY | PROD-04 |
| G27 | back-button step number off; QuickTeam maps every error to "Bắt buộc"; status wording; "Đăng ký" after submit; empty `<h1>`; client-side readiness; ineligible-draft hint | P2_QUALITY | PROD-04 |
| G28 | production service imports `project-demo` (`applicantTypeFor`); applicant type defined three times | P2_QUALITY | PROD-03 / 04 |
| G29 | SUB0 / CHOOSE / SUB2 navigation dead-ends (check against L37–L43 frames before any change) | P2_QUALITY | PROD-04 |
| G30 | team members cannot read their venture's applications | NOT_REQUIRED_FOR_P0 | HD-A13 |
| G31 | no withdraw / discard of a DRAFT | NOT_REQUIRED_FOR_P0 | M013 anticipates |
| G32 | programme `d4…0001` "(demo)" in production | PO_DECISION_REQUIRED | PO-5 (WF04 Q8) |
| G33 | operator / organiser read or review of applications | NOT_REQUIRED_FOR_P0 | HD-A13 Future |
| G34 | test gaps (API / security / restart; see API / DB / security) and no WF05 API spec | P1_HARDENING | PROD-05 |
| G35 | S01 / S02 have no approved reference (INTENTIONAL-DEMO); proposed baseline = released UI `78f21f2`, as WF04 D08 | P2_QUALITY | PROD-01 / 06 |
| G36 | unmerged `fix/member-shell-mobile` edits `(demo)/layout.tsx` too: merge order needed | P2_QUALITY | before PROD-04 |

Totals: P0_PRODUCTION_BLOCKER 0 · P1_HARDENING 14 · P2_QUALITY 13 · SOT_CONFLICT 2 · PO_DECISION_REQUIRED 3 · NOT_REQUIRED_FOR_P0 4 · DEMO_ONLY_ACCEPTABLE 0.

## Proposed PROD-01 → PROD-07
| Task | Actual scope | Prerequisites | Files / modules | Risks | PO |
|---|---|---|---|---|---|
| PROD-01 contract + canonical model | resolve G01 / G02 / G04 / G05; freeze the WF05 contract (one Venture, owner-only, DRAFT → SUBMITTED, closed-programme rule, envelope); baseline method (G35); authorise touching WF02 code for G06 / G08 | PO-1…PO-5 | CLAUDE.md §2 wording (owner), Data SOT amendment, DECISION_LOG, API contract + YAML, capability matrix | scope creep into review / withdraw | yes |
| PROD-02 persistence | G15 (no answers in replay body or scheduled purge), G16 (+ G17 optional) as migration 016, G19 fixtures in a test-only block, G20 | PROD-01 | `db/migrations/016_*`, `lib/idempotency`, seed, test helpers | migration on live data (applications exist in production) | no |
| PROD-03 lifecycle / API / RBAC | G06–G13, G28 service part; WF05 API spec like `wf04-prod-api` | PROD-02 | `lib/application`, `lib/venture` (WF02), `lib/team`, `lib/api/handler`, API routes | touches WF02-protected services | no |
| PROD-04 frontend + cross-WF | G21–G27, G29 per PO-2 / PO-3; session-expiry return path | PROD-03, G36 merge order | `components/project-demo`, `components/application`, `(demo)` + `(member)` routes, member nav | WF02 protected pixels if the entry label changes | via PO-2 / PO-3 |
| PROD-05 functional + security QA | G34: IDOR, spoofing, EDIT / VIEW members, idempotency per action, closed programme, archived venture, restart / relogin, concurrency | PROD-04 | new WF05 QA spec, restart check | — | no |
| PROD-06 pixel + responsive + cross-WF | S01 / S02 vs released UI, L5 frames, member shell 6 widths, WF02 / WF04 cross-checks | PROD-05 | visual spec + compare script | shell lane interaction | no |
| PROD-07 closure | closing gate, release boundary, PO-5 before promotion | PROD-06 | closure docs | — | promotion only |

## Related
- [WF05-PROD-00_gap-audit.md](WF05-PROD-00_gap-audit.md) · [WF05-PROD-00_runtime-matrices.md](WF05-PROD-00_runtime-matrices.md) · [WF05-PROD-00_api-db-security.md](WF05-PROD-00_api-db-security.md)
