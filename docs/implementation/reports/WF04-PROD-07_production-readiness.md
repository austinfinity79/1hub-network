# WF04-PROD-07_production-readiness

**WF04-PROD-07 — production readiness closure.** 2026-10-02, branch `feat/wf04-prod-hardening`. Verdict: **WF04 PROD HARDENED / NOT YET DEPLOYED.** Closure audit only: no runtime code, API, DB, design or business rule changed. Closure matrix and test totals: [WF04-PROD-07_closure-matrix.md](WF04-PROD-07_closure-matrix.md). Not pushed, not merged, not deployed.

## Scope closed
WF04 Programme / Challenge, PROD-01 → PROD-06, all PASS_WITH_EVIDENCE: contract freeze (`b4463e2`), persistence + migration 015 (`2a77a1e`), API / RBAC / lifecycle (`e0dc779`), screens on the API (`6e99d15`), scope fix + test audit (`7ea892d`), functional / security QA (`cdcf17e`), pixel / responsive QA (`5005ec1`). All seven lane commits are WF04-only; the docs they touch outside the WF04 reports are WF04 amendments (API §22, DEC-W4P, `programme:manage` matrix row, DB gap D1).

## Final architecture
| Layer | Shape |
|---|---|
| Data | `programmes` (`programme_status` DRAFT / PUBLISHED / CLOSED, ARCHIVED read-compatible only; `organization_id` NOT NULL → one operational unit; `ends_at ≥ starts_at`); stages in `metadata.journey`, problems in `metadata.challenge`; form `programme_application_forms`; applications `applications` (WF05). No other WF04 table |
| API | `GET/POST /api/v1/programmes`, `GET/PATCH /programmes/{id}`, `PUT …/registration`, `POST …/publish`, `POST …/close`; frozen error envelope; optional Idempotency-Key; audit `PROGRAMME_*` |
| Authority | server only: `programme:read` / `programme:manage` = HUB_COMMUNITY_LEADER of the owning unit or PLATFORM_ADMIN; no PROGRAMME_ORGANIZER grant (0 assignments; the string survives only as an unused S06 display label) |
| Screens | S01–S08 at `/demo/programmes/*` (Q6) on the API; no fixture, session store or demo API at runtime; no close or archive control |

## Invariants (verified)
| Invariant | Evidence |
|---|---|
| DRAFT → PUBLISHED → CLOSED only; no reopen, no jump | QA-LIFE, `programme.db-test`, S08 / UAT |
| ARCHIVED legacy only: no archive action, CTA or API | route tree has `close`, `publish`, `registration` only; `/archive` 404; legacy row read only (QA-LIFE) |
| one canonical owning organization | 015 `SET NOT NULL` + FK; persistence DB test (4)(8) |
| Challenge in canonical metadata | `metadata.challenge`; no Challenge / Problem / Stage table (DB test (11)) |
| Application / Form reused | only `programme_application_forms` + `applications`; no ProgrammeV2 / ChallengeV2 / ProblemV2 / WF04Application in code or schema |
| no WF04 Event write | QA-EVT snapshot + static scan |
| no fixture runtime | T00 static scan; demo APIs 404 in production mode |

## Q3(b) disposition: **A. NOT_REQUIRED_FOR_P0**
- Defined: the canonical question `{id, prompt, required, step 1–4}` and the four steps (Hiểu đề, Cách giải, Đội & kế hoạch, Cần hỗ trợ gì) — [L5 contract](../task-24/l5-startup-contract.md) "Question layout", DEC-L5-D1, API §22.
- Not defined anywhere: how an operator sets `required` / `step` for a new question. The approved S05 drew plain-text questions only (DEC-WF04-S05-D1); contract §9 (b) forbids inventing a default.
- P0 does not depend on it: a form may hold 0 questions (013 default `[]`); publish needs no form (§8, Q7); WF05 skips empty steps and reuses profile / venture data. UAT-WF04 configures its form through the UI (0 questions) and the member reaches the apply flow; PROD-07 smoke: 0-question form → application → submit → SUBMITTED, `missing: []`.
- Frozen for P0: operator-authored programme questions are out of current P0; "Thêm câu hỏi" stays disabled with its reason (D13, D14); existing questions keep their `required` / `step` on edit or removal; the API keeps accepting fully specified questions.
- Reopen only if the PO wants question authoring in P0; then the one question is: "Khi operator thêm câu hỏi ở S05, màn hình hỏi bước (1–4) và bắt buộc có/không, hay dùng một vị trí cố định — và là gì?" (either needs a design addition).

## OpsShell disposition: **C. ACCEPTED_BASELINE_LIMITATION**
| Item | Record |
|---|---|
| Basis | DEC-P0-SHELL-D7 (member / ops / onboarding shells desktop-first, not certified) and IA-L1 "documented limitation"; DEC-WF03-T00-D1 draws a 216 px sidebar; CLAUDE.md §5 target 1440 |
| Affected | every OpsShell route: `/ops/network`, `/ops/org/:orgId/*` (WF03), `/demo/programmes/*` (WF04); plus WF02 project team (member shell) 20 px at 320 |
| Severity | P2 usability, not functional: every control reachable; WF04 content column ≈ 142 px at 390; 10–40 px sideways scroll at 320 (WF03 dashboard 40 px) |
| Origin | identical on production `78f21f2`; shell files untouched by WF04 |
| Follow-up | separate shell task: OpsShell small-screen layout below 1024 px + WF04 primitive wrapping at 320, after a design decision (no approved mobile ops frame) |
| WF04 closure | may proceed; PROD-06 pins the 320 causes so they cannot spread |

## Release boundary
| Item | Value |
|---|---|
| Candidate | the WF04-PROD-07 commit on `feat/wf04-prod-hardening` (child of `5005ec1`); runtime identical since `7ea892d` |
| Base / production / origin/main | `78f21f2` |
| Migration range | 015 only (001–014 already applied); 015 pre-checks every row and STOPS, changing nothing, on a violation |
| Rollback | redeploy `78f21f2`; no DB rollback needed (015 COMPATIBILITY note); the manual 015 rollback refuses while a CLOSED row exists |
| Promotion | separate PO-controlled action (PROCESS V2 §K: exact approved SHA, Claude B deploys) |

## Known limitations and deferred decisions
OpsShell (above); close control on screen (design decision, D14); Q2 remainder (discard a DRAFT); Q4 team source; Q5 application counts; Q6 routes stay `/demo/programmes/*`; Q8 production row "(demo)" — decide before promotion; Q9 baseline method applied in PROD-06 (record as answered); Q10 document approvals; cleanup candidate after closure (no behaviour change): unused demo write helpers and the S06 PROGRAMME_ORGANIZER display label in `lib/programme-demo`.

## Related
- [WF04-PROD-07_closure-matrix.md](WF04-PROD-07_closure-matrix.md) · [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md) · [WF04-PROD-05_functional-security-qa.md](WF04-PROD-05_functional-security-qa.md) · [WF04-PROD-06_pixel-responsive.md](WF04-PROD-06_pixel-responsive.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
