# WF05-PROD-06_screen-review

**WF05-PROD-06 — visual impact map and per-surface results.** C = `wf05-visual-compare` state (baseline vs candidate, 6 widths), V = `wf05-prod-visual.spec` state (candidate, 6 widths). Main report: [WF05-PROD-06_pixel-responsive.md](WF05-PROD-06_pixel-responsive.md).

## Visual impact map
| Surface | Route | States | Baseline | Visual risk | Cross-WF dependency |
|---|---|---|---|---|---|
| S01 list | `/demo/projects` | owner, member, no venture (C, V); loading, API error, empty (V) | `f40f70c` S01 | notice / label removal; longer application line ("(đã đóng)") | MemberShell (WF02), WF04 programmes |
| S02 detail | `/demo/projects/{id}` | owner, member, ARCHIVED venture, not found (C, V); long name + team names, API error (V) | `f40f70c` S02 | closed rows added; wording; wrapping | WF02 venture / team, WF04 programmes |
| create / edit venture | `/programmes/{id}/apply` (SUB0), `/projects/{id}/edit` (WF02) | SUB0 empty, client errors (V), server reasons (PROD-04); WF02 editor (C) | L37; WF02 approved editor | none changed in PROD-06 | WF02 `POST /ventures`, editor |
| application entry | `/programmes/{id}/apply` | SUB0, CHOOSE (C, V) | L37; TASK 24.4 choice | `?tu=` links only | WF04 programme |
| form / draft | `/projects/{id}/applications/{pid}` | steps 01 / 02 / 03 (C, V), save failed + "Thử lại" (V) | L38–L41 | retry inline; step ordinal | WF04 form |
| submit / submitted | `…/review`, `…/submitted` | ready, incomplete, submit error (V); SUB3 open and closed programme (C, V) | L42, L43 | error copy | — |
| CLOSED programme | SUB1 read only, S02 closed row, SUB3 | C, V | baseline 404 / hidden (new state) | read-only rendering | WF04 close |
| ARCHIVED compatibility | S02 archived banner, SUB1 `ARCHIVED` read only | C, V | `f40f70c` | pill / autosave card | WF02 venture status |
| loading / empty / error / 403 / 404 | S01, S02, SUB1, SUB2 | V | — | blank or jumping containers | — |
| auth redirect return | guest → `/auth?redirect` → page | C (auth page), V (+ return test) | `f40f70c` auth page | stale skeleton, duplicate header | WF01 auth |

## Results
| # | Surface | Result |
|---|---|---|
| S01 | list | PASS — PROJECT / STARTUP type and relation lines unchanged; long application line wraps (1024: 1 → 2 lines) without overflow; 0 demo marker / wording at 6 widths; loading, error + "Thử lại", empty fit at 320 |
| S02 | detail | PASS — title / back / "Sửa hồ sơ" order unchanged; team rows with 60-character names wrap; closed rows reuse the row style; member sees the NOT_OWNER hint, no action; not-found identical to baseline; no duplicated block |
| C/E | create / edit | PASS — SUB0 identical to baseline at 6 widths; "Bắt buộc." under each field inside 320 (V); server reasons per field (PROD-04 spec); WF02 editor identical (0 %) |
| APP | entry, form, draft, submit | PASS — SUB0, CHOOSE, SUB1 01–03, SUB2, SUB3 identical (0 %); save failed line + "Thử lại" inside 320; incomplete / error alerts inside the viewport |
| RO | CLOSED / ARCHIVED / submitted | PASS — alert with the reason, pill "Chỉ xem", textarea disabled, "Soát lại trước khi nộp" disabled, no autosave card; SUB3 read only; history readable |
| ST | loading / empty / error / 404 | PASS — no blank container, no raw JSON or demo text; retry controls inside every width |
| AUTH | guest return | PASS — `/auth?redirect=<path>` page identical to baseline; after sign-in the intended S02, one header, no loading state left |
| X2 | WF02 → WF05 | PASS — settings / projects shells differ only by the removed demo label (0.05–0.1 % at ≥ 768; content up 24–29 px below); editor and team identical |
| X4 | WF04 → WF05 | PASS — WF04 programme detail identical (0 %); the same programme shows CLOSED in S01 / S02 / SUB1 / SUB3 |

## Interaction and accessibility smoke
| Check | Result |
|---|---|
| keyboard reach | every link / button of S01, S02, SUB1, SUB2 reached by Tab; no positive `tabindex` |
| visible focus | ring on every stop except the S01 venture-name link (pre-existing, baseline identical; reported) |
| labels | every input, select, textarea and button of SUB0 / SUB1 / SUB3 named (label, `aria-labelledby` or text) |
| decorative marks | avatars, venture marks, hero mark `aria-hidden` |
| disabled / read only | disabled controls carry `disabled`; no enabled write control on closed / archived drafts |
| hover | pointer cursor on view / edit actions |
| modal | none in WF05 (the domain list is a disclosure button with `aria-expanded`) |
| contrast | no colour change on any component (C: 0 style deltas) |

## Related
- [WF05-PROD-06_pixel-responsive.md](WF05-PROD-06_pixel-responsive.md) · [WF05-PROD-06_prod07-handoff.md](WF05-PROD-06_prod07-handoff.md)
