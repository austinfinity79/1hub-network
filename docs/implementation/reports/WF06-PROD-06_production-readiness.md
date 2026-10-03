# WF06-PROD-06_production-readiness

**WF06 closure — WF06 PROD HARDENED / NOT YET DEPLOYED.** Visual evidence: [WF06-PROD-06_visual-closure.md](WF06-PROD-06_visual-closure.md); debt register: [WF06-PROD-06_known-debt.md](WF06-PROD-06_known-debt.md). Verdict: **PASS_WITH_EVIDENCE**.

## Final protected regression (evidence 14)
| SPEC_COUNT | PASS | FAIL | SKIP | FLAKY |
|---|---|---|---|---|
| 83 (all visual specs, incl. `wf06-prod-visual`) | 1111 | 0 | 26 | 0 (`retries: 0`) |
Skips: 24 opt-in M0-T11 pixel runs (executed: 7 PASS_EXECUTED, 17 KNOWN_BASELINE identical on `5199e07`), 2 environment cases (ENVIRONMENT_ONLY_WITH_PROOF). Also: unit 36 files / 344, DB 38 files / 611, format, lint, typecheck PASS; server log: 7 start-up lines, no error.

## Contract check (evidence 15)
| Item | Final |
|---|---|
| D1 member directory | OUT — no directory route; the founder tab lists only owners of listed startups, to members |
| D2 public venture discovery | OUT — no venture page or list beyond the Library tab; `/ventures/{id}` stays 404 to others |
| D3 public programme / challenge discovery | OUT — "Bài toán" is the static file; no challenge id or programme read |
| Library source | canonical system data, TEMPORARY_EXTERNAL remainder isolated |
| founder | only where canonical venture and profile visibility allow (DEC-W6P-D03) |
| matching, recommendation, ML ranking, writes, Admin Portal, Sprint1 | none (WF06 added three GET routes, no page, no table) |
| H3 (DEC-L6-D1 / DEC-PDF-D1 vs `/library`) | closed by the record, no new decision: DEC-W6P-D02 (PO D4, confirmed 04/10, later and specific) makes published STARTUP ventures readable in the Library tab only; DEC-PDF-D1 / DEC-L6-D1 still govern every other path |

## Canonical data check (evidence 16)
Organizations: the WF03 slug read, unchanged. Ventures / founders: keys derived from `projects.id` / `individual_profiles.id` (WF02 / WF05 ids), resolvable by nothing. No discovery table or store (`db/` unchanged since `5199e07`). No application or private data in any answer or page (PROD-05, incl. a real application answer).

## Production readiness matrix (evidence 17)
| Area | Status | Evidence |
|---|---|---|
| scope | GREEN | runtime contract, D1–D4; inventory PROD-03 / 04 |
| canonical data | GREEN | PROD-02 source matrix, db-tests |
| Library | GREEN | API §25, PROD-04 integration |
| visibility / privacy | GREEN | PROD-03 matrix, PROD-05 exclusion and bypass |
| API | GREEN | 3 GET routes, 422 envelope, private no-store |
| filters / sort | GREEN | deterministic, PROD-05 |
| pagination | GREEN | stateless cursor, restart-stable |
| external fallback | GREEN | unreachable and crafted feeds |
| frontend | GREEN | API-only rendering, zero runtime fixture |
| functional QA | GREEN | PROD-05 (76 cases) |
| security QA | GREEN | bypass, XSS, abuse, logs |
| pixel QA | GREEN with KNOWN_BASELINE | 1440 audits under thresholds; M0-T11 debt pre-existing |
| responsive | GREEN with KNOWN_BASELINE | 84 states × 0 overflow; 320 px tab bar pre-existing |
| accessibility smoke | GREEN with KNOWN_BASELINE | focus 2 px; `--muted` contrast pre-existing |
| restart / determinism | GREEN | 8 answers byte-identical |
| cross-WF regression | GREEN | 83 specs |
| console / hydration / 5xx | GREEN | 0 / 0 / 0 |
| known debt | listed | [debt register](WF06-PROD-06_known-debt.md) |
| deployment | NOT DEPLOYED | production `78f21f2`; nothing pushed |

## Blocker check (evidence 18)
```
P0_BLOCKERS = 0
P1_PRE_PROMOTION = 2
P2_DEBT = 6
REAL_REGRESSION = 0
SOT_CONFLICT = 0
PO_DECISIONS_REMAINING = 0
```
P1 are reviews before promotion (DOMAIN slug map against the production vocabulary; the guest founder sign-in copy), not open product decisions; see the [register](WF06-PROD-06_known-debt.md).

## Candidate, boundary and next (evidence 21 – 26)
| Item | Value |
|---|---|
| candidate | the WF06-PROD-06 closure commit on `feat/wf06-prod-hardening` (SHA in `CLAUDE_LATEST_REPORT.md`); last runtime change `d113d14` |
| branch contents | WF04 (`f40f70c`) and WF05 (`8c1fbd6`, closure `5199e07`) hardened candidates are its ancestors |
| promotion | WF06 closure deploys nothing: WF45-PROMO-01 (the WF04 / WF05 pre-promotion gate) stays separate and comes first, since this branch carries WF04 / WF05; deploy only the exact approved SHA |
| Admin Portal | WF06 CLOSED; ADMIN PORTAL MAY BE PLANNED NEXT (not started) |
| files changed | `tests/visual/specs/wf06-prod-visual.spec.ts`; the three `WF06-PROD-06_*` reports; `CLAUDE_LATEST_REPORT.md`; no runtime file |
| confirmation | no push, no merge, no deploy, production untouched, Admin Portal not started |

## Related
- [WF06-PROD-06_visual-closure.md](WF06-PROD-06_visual-closure.md) · [WF06-PROD-06_known-debt.md](WF06-PROD-06_known-debt.md) · [WF06-PROD-05_qa-summary.md](WF06-PROD-05_qa-summary.md)
