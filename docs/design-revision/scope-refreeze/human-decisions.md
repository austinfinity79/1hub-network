# Human Decisions

Decisions the 28/09 source leaves open. Each has a conservative default; "Blocks" names what cannot start without an answer. The earlier HD register is [05](../05_BUSINESS_API_DATA_CONFLICT_MATRIX.md).

## New (HD-A)
| ID | Question | Conservative default | Blocks |
|---|---|---|---|
| HD-A1 | AI suggestion: provider and credentials; inputs (pasted text, CV upload ≤ 10 MB, LinkedIn URL); CV / PII processing, retention and consent; quota size; whether requests are logged; placement (the current WF01-S06 profile step, or ACC-06 which belongs to the HD-02 flow) | Pasted text only, no CV retention, per-account daily quota, suggestions fill the six existing S06 fields after user confirmation | 22.9 |
| HD-A2 | L3: confirm L19 (public chapter page) and L23 (events) stay Alpha as independently approved WF03 screens; should a subset of L14 ORGP1 restyle chapter information management (WF03-S06)? | Both stay; S06 unchanged | nothing |
| HD-A3 | Which intent code "create-startup" preselects (the allowlist has none) and whether that preselection supersedes DEC-WF01-S05-D4 on this entry only | No preselection until decided; the return path still brings the user to `/projects/new` after onboarding | 22.8 (preselect only) |
| HD-A4 | `/programmes/create`: what "create" means in Alpha (the WF04 session demo, or persisted creation, which API §15 keeps out), who may create (today's WF04 scope or a new capability), and the contact-admin target (no support contact exists, DEC-L1-D6) | Holders of today's WF04 scope continue into the demo creation; others see a no-permission state with a plain "liên hệ ban điều hành HUB" line and no link | 22.8 (create CTA) |
| HD-A5 | `/about` content: no corrected frame and no approved copy | CTA shows "Sắp có" until content is approved | 22.8 (`/about`) |
| HD-A6 | `/programmes` directory: no corrected frame; which programmes are public | List of PUBLISHED server-side programmes in the L16 list pattern | 22.8 (`/programmes`) |
| HD-A7 | L4 directory: is L15 DIR1 (tab Bài toán) the L4 directory? It needs public problem data (entity Future) | FUTURE; L4 ships no screen | nothing |
| HD-A8 | Application form: programme-configured questions (current contract) or the fixed S1–S6 schema with word limits drawn in L38–L41; uploads; edit after submit; application code; e-mails | Programme-configured questions laid out across the SUB1 steps; SUBMITTED final; no uploads, code or e-mail | 22.7 (layout) |
| HD-A9 | May a plain 500 view (`error.tsx`, IA-P3-05) ship without the L54 design, as a quality fix outside Task 22? | No; L54 stays Future and IA-P3-05 stays open | nothing |
| HD-A10 | L5 routes and labels now that data persists: keep `/demo/projects/*` and the "Demo" entry, or move to member routes; what "Đặt lại demo" does | Move to member routes with redirects from the demo paths; drop the demo label for applications; reset no longer touches applications | 22.7 |
| HD-A11 | SUB0 venture type: the frame has no type choice and the type is immutable | Derived when the programme accepts one applicant type; asked when it accepts both | 22.7 |
| HD-A12 | Programme source for applications: seed the approved WF04 PUBLISHED programme as a read-only server row, or persist WF04 programmes fully | Seed the fixture row with its registration config; WF04 editing stays demo | nothing (default applies) |
| HD-A13 | Who may read an Application besides the owner (ACTIVE team members, organisers) | Owner only; review is Future | nothing |
| HD-A14 | PO review of the discovery CTA routes in the [CTA map](homepage-cta-map.md) (required by the 28/09 source before freeze) | Targets as proposed | 22.8 |

## Earlier decisions still open
| ID | Topic | Status after 28/09 |
|---|---|---|
| HD-02 | New onboarding flow (ACC-05…09) | Open |
| HD-03 | Consent step | Open |
| HD-05 | Profile model (FP1-OWN, L12, new fields) | Open |
| HD-08 | Public profiles, startups, org model | Open |
| HD-11 | Shell model and "Góp ý" | Open |

Superseded by 28/09 (fully or in part): HD-01, HD-04, HD-06, HD-07, HD-09, HD-10. HD-12 stays CLOSED.

## Related
- [conflict-audit.md](conflict-audit.md) · [task-sequence.md](task-sequence.md) · [overview.md](overview.md)
