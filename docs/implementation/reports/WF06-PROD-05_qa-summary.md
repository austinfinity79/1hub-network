# WF06-PROD-05_qa-summary

**WF06-PROD-05 — functional / security / quality QA (AUDIT + QA)** of candidate `d113d14` against the frozen [runtime contract](WF06-PROD-01_runtime-contract.md), [API §25](../../architecture/05_API_CONTRACT_P0_v1.0.md) and the PROD-02 … 04 evidence. Verdict: **PASS_WITH_EVIDENCE**. No runtime change; one QA spec added.

## Preflight (evidence 1)
| Check | Result |
|---|---|
| branch / HEAD | `feat/wf06-prod-hardening` at `d113d14` (PROD-04); unchanged until the commit |
| migrations | 001 → 016; `db/` unchanged since `83a84f4` (no migration from PROD-02 … 04) |
| origin/main · production | `78f21f2` · `78f21f2` (read only) |
| Claude B / other lanes | `fb2130f`, `a957876`, `c1b60c3` not in HEAD; their worktrees untouched |
| runtime fixture dependency | 0 (`src/lib/library/testing.ts` imported by tests only) |

## Full protected regression re-run (evidence 2)
After the PROD-04 spec correction, all specs in one run on the built candidate (`retries: 0`, so any flake would fail):

| SPEC_COUNT | PASS | FAIL | SKIP | FLAKY |
|---|---|---|---|---|
| 82 (81 + `wf06-prod-qa`) | 1102 | 0 | 26 | 0 |

## Skip accounting (evidence 3)
| Skipped | Count | Class | Evidence |
|---|---|---|---|
| `pixel-qa-screens` › WF01–WF03 screen pixel runs (opt-in by `PIXEL_QA_SCREENS`, M0-T11) | 24 | ENVIRONMENT_ONLY (WF03-S09: EXPECTED_LATER_PROD06) | run with all 24 ids: 7 screens pass, 17 fail on the runner's typography rule ("Space Grotesk unapproved", which predates DEC-HD-12) and 1 dimension check; the same 17 fail with the same 89 reason lines on a build of `5199e07` (before WF06) in a temporary worktree → pre-existing baseline debt, not a WF06 change |
| `wf06-prod-library` › external directory down | 1 | ENVIRONMENT_ONLY | server on an unreachable feed: 1 / 1 passed |
| `wf06-prod-qa` › crafted external rows | 1 | ENVIRONMENT_ONLY | server on the crafted feed: 1 / 1 passed |
No MISSING_EVIDENCE or UNEXPECTED_SKIP.

## Result index (evidence 4 – 24)
| # | Item | Result | Detail |
|---|---|---|---|
| 4 | happy path | PASS | [functional](WF06-PROD-05_functional-quality.md) |
| 5, 6 | guest / member privacy, private-data exclusion (incl. a real application answer) | PASS | [privacy](WF06-PROD-05_privacy-security.md) |
| 7 | direct-id / query bypass | PASS (422 / 404 / 401, nothing resolved) | privacy |
| 8 – 10 | filters, sort determinism, pagination | PASS | functional |
| 11 | canonical / external merge | PASS (canonical wins, failure isolated) | functional |
| 12, 13 | founder, organization visibility | PASS | privacy |
| 14 | session transition | PASS (real magic link → logout) | privacy |
| 15 | external-data security | PASS (crafted feed: no script, unsafe URLs nulled) | privacy |
| 16, 17 | query abuse, resource bounds | PASS (422 / 431, no 500) | functional |
| 18 | restart | PASS (8 answers byte-identical) | functional |
| 19, 20 | data quality, keyboard smoke | PASS | functional |
| 21 | console / hydration / unexpected 5xx | 0 / 0 / 0 across the QA journeys and the full run | functional |
| 22 | security logging | 0 hits for tokens, cookies, e-mails, private fields, hidden founders, raw external payload, application content in every server log of this task | privacy |
| 23 | fresh / existing DB | existing: 16 applied, `db:migrate` skips all, Library db-tests 42 / 42; fresh `db:reset` 16 / 16 + `test:db` 38 files / 611; unit 36 / 344; format, lint, typecheck PASS | — |
| 24 | cross-WF | WF01–WF06, auth, shell, API specs in the full run: GREEN; WF04 read paths untouched; no upstream mutation; canonical ids intact | — |

## Bugs found / fixed (evidence 25)
| Class | Finding | Action |
|---|---|---|
| TEST_GAP | no end-to-end proof that application answers, crafted external markup or oversized URLs stay out | `wf06-prod-qa.spec.ts` (76 recorded cases) |
| OUT_OF_SCOPE | 17 opt-in WF01–WF03 pixel runs fail identically before WF06 (runner typography rule vs DEC-HD-12; one reference size) | PROD-06 / design-system follow-up, no change here |
No FUNCTIONAL, SECURITY, PRIVACY, FILTER, PAGINATION, EXTERNAL_FALLBACK or QUALITY bug; no CONTRACT_CONFLICT.

## Files, git and confirmation (evidence 27 – 32)
Files: `tests/visual/specs/wf06-prod-qa.spec.ts` (new); the four `WF06-PROD-05_*` reports; `CLAUDE_LATEST_REPORT.md`. Local commit only (SHA in `CLAUDE_LATEST_REPORT.md` and the chat report); working tree clean except `AGENTS.md`; origin/main `78f21f2`; production `78f21f2`. Confirmed: no new discovery surface, no recommendation, no writes, no push, no merge, no deploy, PROD-06 not started.

## Self-audit (section 28)
All 21 items confirmed (full re-run after the spec fix; every skip explained with evidence; privacy, bypass, filters, sort, pages, merge, external failure, founder privacy, bounds, restart, data exclusion PASS; console 0, hydration 0, unexpected 5xx 0; fresh DB and cross-WF GREEN; no push / merge / deploy; PROD-06 not started).

## Related
- [WF06-PROD-05_functional-quality.md](WF06-PROD-05_functional-quality.md) · [WF06-PROD-05_privacy-security.md](WF06-PROD-05_privacy-security.md) · [WF06-PROD-05_prod06-handoff.md](WF06-PROD-05_prod06-handoff.md)
