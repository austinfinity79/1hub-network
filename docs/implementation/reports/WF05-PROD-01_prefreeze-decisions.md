# WF05-PROD-01_prefreeze-decisions

**WF05-PROD-01-PREFREEZE — the WF05-PROD-00 questions checked against the sources before any reaches the PO.** 2026-10-02, branch `feat/wf05-prod-hardening` (`f8f215e`). Docs only. Precedence: CLAUDE.md §1 (CLAUDE.md > Master Spec > workflow contracts > Data SOT > design > architecture > migrations), plus approved decision freezes. Freeze inputs for PROD-01: [WF05-PROD-01_freeze-inputs.md](WF05-PROD-01_freeze-inputs.md). Audit: [WF05-PROD-00_gap-audit.md](WF05-PROD-00_gap-audit.md).

## D1 — promotion scope: **A. ALREADY_DEFINED_BY_SOT**
- L5 application flow: server-side by PO freeze DEC-2809-D6 / DEC-L5-D1…D6, migration 013, deployed (RC `ff052d7`, DEP-1). The WF05-PROD task series is the explicit promotion CLAUDE.md §2 asks for.
- S01 `/demo/projects`: **the approved L5 entry** — DEC-AIG-D3 (PO, 30/09): ME7 "Hồ sơ đăng ký" → `/demo/projects`, "the L5 entry listing the member's ventures and applications. No new dashboard."
- S02 `/demo/projects/{id}`: S01's per-venture drill-down (programme rows with server eligibility, application status, links to WF02 edit / team). WF02 has no venture read page (`/projects/{id}` is 404); S02 duplicates no WF02 function.
- Both are a presentation layer over canonical WF02 / WF04 data (no table, no copy).
- **Contract boundary: B — L5 + S01 + S02.** Excluding S01 / S02 would leave the PO-approved entry pointing at an unhardened screen.

## D2 — S01 / S02 demo markers: **B. TECHNICAL_DECISION** (per item)
| Item | Finding | Disposition |
|---|---|---|
| "Dữ liệu demo · Internal Alpha" notice | false on real data; WF04 removed the same shared notice going to the API (contract §16, D13); HD-A10 forbids a "Demo" label on applications | REMOVE (`notice: false`, as WF04) |
| "Đặt lại demo" | clears a dead key, then reports success; confirmation claims to delete applications, which HD-A10 forbids | REMOVE |
| "trong bản demo" / "(demo)" copy, actor-key plumbing | text and code left from the session demo | REMOVE |
| shell entry "Dự án & Startup · Demo" (DEC-WF05-G2) | the production entry already exists (ME7 "Hồ sơ đăng ký", AIG-D3); relabelling repaints protected WF02 screens; WF04 kept its own "DEMO · INTERNAL ALPHA" entry | DEFER (unchanged; one joint WF04 / WF05 shell-label pass at promotion) |
| `/demo/projects*` route | internal name, target of the approved AIG-D3 link and of redirects; WF04 kept `/demo/programmes` (Q6) | KEEP |
| `/api/v1/demo/projects*` | internal read API; renaming adds risk only | KEEP (document in the API contract) |

## D3 — closed-programme application visibility: **A. ALREADY_DEFINED_BY_SOT**
API §21: `GET /me/applications` = "the caller's applications" and `GET /applications/{id}` reads a SUBMITTED one "from its snapshot only" — no programme-state condition. AIG-D3: S01 lists "the member's … applications". WF04: close stops new applications (D12); ARCHIVED is read compatibility only (D11). The current S01 / S02 behaviour (an application leaves every list once its programme closes) and the hidden draft answers deviate from these sources: implementation gaps (G11, G25), not a decision.

| Programme | Create | Edit draft | Submit | Read own draft | Read own submitted |
|---|---|---|---|---|---|
| DRAFT | no (404) | — | — | — | — |
| PUBLISHED | yes (eligible venture, form) | yes | yes | yes | yes, snapshot |
| CLOSED | no (404) | no (409) | no (409) | yes, read only, saved answers shown | yes, snapshot |
| ARCHIVED (compatibility) | no | no | no | yes, read only | yes, snapshot |

## D4 — canonical venture / team / applicant: **A. ALREADY_DEFINED_BY_SOT**
| # | Question | Answer | Source |
|---|---|---|---|
| 1 | canonical entity | one Venture = `projects`, `type` PROJECT \| STARTUP | Master Spec :101, :151, :175; CLAUDE.md §3; WF02 FINAL; DEC-2809-D5; M001 |
| 2 | owner / founder | `projects.owner_profile_id` (IndividualProfile); never a member row | DEC-WF02-S05-G5; M001 (`owner_profile_id`), M008 header |
| 3 | team membership | `project_members` (PENDING → ACTIVE by the invitee, EDIT / VIEW) = Data SOT TeamMembership / StartupMembership, "requires confirmation" honoured | WF02 S06 "Team / venture membership"; M001 table, M008 states |
| 4 | application references | `applications.venture_id` → `projects`, `programme_id` → `programmes` | M013; API §21 |
| 5 | primary applicant | the Venture; type derived PROJECT → TEAM, STARTUP → STARTUP; INDIVIDUAL is FUTURE; the submitting user is the owner (`created_by_account_id`) | DEC-WF05-G4; DEC-WF05-T00-D1 ("`primary_applicant_id` (= the venture id)"); DEC-L5-D1 |
| 6 | obsolete identifiers | separate Team / Startup ids, `primary_applicant_id` as a free reference, the session application store | DEC-2809-D5 / D6 supersede T00-D1 storage |
| 7 | true conflict? | no: Data SOT (rank 4) lists Team / Startup as "foundation entities — model now, activate by later workflow"; the higher sources and the PO freezes activated them as the one Venture | — |
Action: annotate Data SOT §A–§C / §12 with this mapping in PROD-01 (document owner sign-off on the wording; no business choice).

## D5 — programme `d4…0001`: **C. TRUE_PO_DECISION** (production row only; = WF04 Q8, not new)
| Question | Finding |
|---|---|
| seed / test / demo? | local / CI seed row (HD-A12); in production a real row inserted by DEP-1 (PO option A): PUBLISHED, Chapter 01, "Chương trình ươm tạo (demo)", form v1 |
| needed by tests? | locally (`SEED_PROGRAMME`); production never runs the seed (WF04 contract D09) |
| visible to end users? | yes: the only programme open to applications in production |
| production-safe? | technically yes; its name and summary say "(demo)" / "Chương trình mẫu cho Internal Alpha" to real members |
| lifecycle in SOT? | HD-A12 "read-only server row" was written while WF04 was demo; WF04 production now governs it (rename by PATCH, close by API) |
| may hardening depend on it? | no: code reads no fixture; tests use their own fixtures (G19) |
Local / CI seed: KEEP_AS_PROTECTED_SEED. Production row: PO chooses keep, rename (PATCH) or close; nothing is deleted. Non-blocking for the PROD-01 freeze.

## The two PROD-00 SOT conflicts
| | C1 — "WF05 demo-only" | C2 — Team / Startup vs Venture |
|---|---|---|
| source A | CLAUDE.md §2; Master Spec "WF05 … Demo" | Data SOT §A–§C, §12 (`PrimaryApplicant ∈ {Individual, Team, Startup}`) |
| source B | DEC-2809-D6, DEC-L5, RC deploy | Master Spec :101 / :151 / :175, CLAUDE.md §3, WF02 FINAL, DEC-2809-D5, DEC-WF05-G4 |
| contradiction | demo label vs a persisted, deployed application | two entities vs one typed Venture |
| runtime follows | B | B |
| safest reading | L5 is promoted; the WF05-PROD series promotes S01 / S02 (D1) | B by precedence; Team ≡ PROJECT venture + members, Startup ≡ STARTUP venture |
| PO needed? | no — CLAUDE.md §2 wording update (owner, pending since conflict-audit C-05) | no — Data SOT annotation (owner) |

## Readiness
| Decision | Classification | Evidence | Proposed freeze | Needs PO? |
|---|---|---|---|---|
| D1 scope | A | DEC-AIG-D3, DEC-2809-D6, DEC-L5 | L5 + S01 + S02 | no |
| D2 markers | B | contract §16 / D13, HD-A10, AIG-D3, WF04 Q6 | remove notice / reset / demo copy; keep routes; defer shell label | no |
| D3 closed programme | A | API §21, AIG-D3, D11, D12 | matrix above | no |
| D4 model | A | Master Spec, CLAUDE.md §3, WF02 FINAL, DEC-2809-D5, G4, T00-D1, M001 / M008 / M013 | one Venture; applicant = venture | no |
| D5 `d4…0001` | C | DEP-1, HD-A12, WF04 D09 / Q8 | seed kept; production row per PO | yes (shared with WF04 Q8) |
| C1, C2 | A (precedence) | above | owner doc updates | no |

**TRUE_PO_DECISIONS_COUNT = 1** (D5, already open as WF04 Q8; it does not block the WF05 contract freeze). Residual uncertainty, stated: if the PO wants the "· Demo" shell labels gone before promotion, that is one joint WF04 / WF05 copy change on protected shells, not a WF05 decision.

## Related
- [WF05-PROD-01_freeze-inputs.md](WF05-PROD-01_freeze-inputs.md) · [WF05-PROD-00_gap-matrix.md](WF05-PROD-00_gap-matrix.md) · [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md)
