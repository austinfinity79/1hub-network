# WF05-PROD-06_prod07-handoff

**Closure handoff for WF05-PROD-07** (prepared by WF05-PROD-06; PROD-07 not started). Candidate: the PROD-06 commit on `feat/wf05-prod-hardening` (HEAD of the branch; PROD-05 `0e07dca` underneath). `origin/main` and production `78f21f2`.

## Routes covered
| Route | Screens / states |
|---|---|
| `/demo/projects` | S01 owner, member, no venture, loading, API error, empty |
| `/demo/projects/{id}` | S02 owner (closed rows), member, ARCHIVED, long name, API error, not found |
| `/programmes/{id}/apply` | SUB0 (empty, client errors, server reasons), CHOOSE |
| `/projects/{id}/applications/{pid}[?buoc=…]` | SUB1 steps 01–03, save failed, CLOSED read only, ARCHIVED read only |
| `…/review`, `…/submitted` | SUB2 ready, incomplete, submit error; SUB3 open and closed programme |
| `/auth?redirect=…` | guest return to S01 / S02 / L5 |
| cross-WF | `/me/settings`, `/projects`, `/projects/{id}/edit`, `/projects/{id}/team` (WF02); `/demo/programmes/{id}` (WF04) |

## Results to carry
| Item | Value |
|---|---|
| viewport matrix | 1440, 1024, 768, 430, 390, 320 at DPR 1 |
| visual diff (144 pairs vs `f40f70c`) | IDENTICAL 70, STRUCTURAL 66 (intentional), MAJOR 0, COMPONENT 0, MINOR 8 (6 intentional, 2 baseline variance); REAL_REGRESSION 0 |
| responsive (150 state × width tests + 144 candidate captures) | overflow / escaping / overlap / clipped on WF05 states: 0 |
| cross-WF | WF02 → WF05 and WF04 → WF05: continuity PASS, same ids (PROD-04 / 05 specs) |
| protected regression | 68 specs / 981 passed on a fresh DB (WF01–WF05, L5, auth / authz, shell, API, release, console health); unit 307, DB 569; console, hydration, unexpected 5xx 0 |

## Known limitations (not WF05 regressions)
- SHELL-MOBILE-01 and the unmerged `fix/member-shell-mobile` lane (`a957876`): shared shell work, separate.
- WF02 project team page: 9 px overflow at 320 (editor header actions), pre-existing.
- WF04 OpsShell "DEMO · INTERNAL ALPHA" entry: WF04 scope.
- S01 venture-name link without a visible focus ring (pre-existing since WF05-S02): P2 a11y debt.
- G29: SUB0 / CHOOSE / SUB2 have no in-page back link (design decision; browser back works).

## Remaining P2 / debt and decisions for closure
| Item | Owner |
|---|---|
| PO flag (PROD-04): the draft is created on the first typed characters | PO |
| API §2.5 generic 400 wording vs the WF05 422 rule (DEC-W5P-D11): a global clarification, if wanted | PO / architecture |
| WF02: team invitation idempotency (G08), e-mail in a locked transaction (G13) | WF02 follow-up |
| global: rate limit, CSRF beyond SameSite, framework 400 / 405 envelope (G14) | platform |
| promotion runbook (Claude B): 014 → 015 → 016 rehearsal on a production-shaped copy; close `d4…0001` via WF04 | Claude B |
| owner documents: CLAUDE.md §2 WF05 wording, Data SOT venture note, superseded notes | owner |

## Related
- [WF05-PROD-06_pixel-responsive.md](WF05-PROD-06_pixel-responsive.md) · [WF05-PROD-06_screen-review.md](WF05-PROD-06_screen-review.md) · [WF05-PROD-05_functional-security-qa.md](WF05-PROD-05_functional-security-qa.md)
