# WF05-PROD-01_freeze-inputs

**Inputs WF05-PROD-01 will freeze**, derived from the pre-freeze decisions ([WF05-PROD-01_prefreeze-decisions.md](WF05-PROD-01_prefreeze-decisions.md)). Preview only: PROD-01 is not started and nothing here is frozen until the PO approves the WF05 production contract.

## Canonical entity model
| Concept | Canonical | Notes |
|---|---|---|
| person | `user_accounts` 1:1 `individual_profiles` | WF01 / WF02 |
| Venture (Data SOT Team / Startup) | `projects`, `type` PROJECT \| STARTUP, `project_domains` | WF02 owns create / edit / publish |
| owner / founder | `projects.owner_profile_id` | no member row for the owner |
| team membership (Data SOT TeamMembership / StartupMembership) | `project_members`: PENDING → ACTIVE by the invitee, EDIT / VIEW | WF02 S06 |
| Programme | `programmes` (WF04 production, `programme_status`) | WF04 owns lifecycle |
| form | `programme_application_forms` (versioned) | WF04 writes, WF05 reads |
| Application | `applications` (`venture_id`, `programme_id`, derived `primary_applicant_type`, answers, snapshot) | WF05 owns |
| primary applicant | the Venture; PROJECT → TEAM, STARTUP → STARTUP | INDIVIDUAL applicant and Solution: FUTURE |

## Ownership and authority
| Action | Owner | ACTIVE member EDIT | ACTIVE member VIEW | other member | operator (`programme:manage`) | guest |
|---|---|---|---|---|---|---|
| venture edit / publish | yes | edit only | no | no | no | no |
| team mutation | yes | no | no | no | no | no |
| application create / edit / submit / read | yes | no | no | no | no (HD-A13) | no |
Refusals keep the frozen envelope and the existing codes: 401 guest, 403 member without the right, 404 anyone else; malformed ids 404, never 500.

## Application lifecycle
DRAFT → SUBMITTED (final). Created on first save; `missing` derived on the server; submit re-checks eligibility and required answers and writes the snapshot in one transaction; one active application per (venture, programme); no withdraw, discard, review or deadline in P0 (HD-A13, DEC-L5-D6). Programme-state matrix: [D3](WF05-PROD-01_prefreeze-decisions.md#d3--closed-programme-application-visibility-a-already_defined_by_sot).

## Visibility
| What | Who sees it |
|---|---|
| PUBLISHED programmes with a form | every onboarded member, through S01 / S02 / L5 only (DEC-W4P-D10); DRAFT, CLOSED, ARCHIVED never offered |
| own applications | the owner, in S01 / S02 whatever the programme state, read only once SUBMITTED or the programme is no longer PUBLISHED |
| application answers | the owner only; never in audit rows, logs or replay bodies |
| venture data | WF02 rules (owner, ACTIVE members; PUBLIC ventures per WF02) |

## Route / demo boundary
| Surface | Production rule |
|---|---|
| `/demo/projects`, `/demo/projects/{id}` | kept (internal name, AIG-D3 target) |
| `/programmes/{id}/apply`, `/projects/{id}/applications/{programmeId}[/review\|/submitted]` | member routes (HD-A10) |
| `/api/v1/demo/projects*` | kept, documented as production reads |
| demo notice, "Đặt lại demo", demo copy, actor key | removed |
| shell entry "Dự án & Startup · Demo" | unchanged in WF05 hardening (joint WF04 / WF05 decision at promotion) |
| old `/demo/projects/{id}/applications/…` | 307 to the member routes (kept) |

## Cross-WF references
- WF02 → WF05: the same `projects.id`; WF05 never copies a venture; SUB0 creates through `POST /ventures`; edits happen in WF02 screens.
- WF04 → WF05: the same `programmes.id` and form version; the form is locked once an application exists (and at create time); WF05 never invents programme data.
- Snapshot at submit is the only copy of venture / team / answers, by design.

## Production-only behaviour
No fixture, seed or `d4…0001` dependency in code or production tests; no business data in browser storage; idempotency replays keep no answers beyond their expiry; every 5xx is logged; malformed input never reaches 500.

## Forbidden
ProjectV2, StartupV2, VentureV2, ApplicationV2, a Team or Startup table, a per-programme venture copy, a WF05 application store, a second form model, any client-side lifecycle.

## Owner document updates (no business choice)
CLAUDE.md §2 wording for WF05 (pending since conflict-audit C-05); Data SOT annotation of the Venture mapping; mark DEC-WF05-G3, T00-D2 / D3 superseded; WF05 completion audit / UAT matrix / P0_STATUS "(DEMO)" notes.

## Related
- [WF05-PROD-01_prefreeze-decisions.md](WF05-PROD-01_prefreeze-decisions.md) · [WF05-PROD-00_gap-audit.md](WF05-PROD-00_gap-audit.md) · [WF05-PROD-00_gap-matrix.md](WF05-PROD-00_gap-matrix.md)
