# S1-CANDIDATE-INT-01

Sprint 1 candidate integration: S1-UAT-07 (incl. FIX-01) and S1-UAT-09 (incl. the S1-UAT-09B readiness docs) on one isolated branch, `int/sprint1-candidate-01`, from `6ab6cbc`. Local only: not pushed, not merged into main, not deployed.

## Preflight

| Item | Value |
|---|---|
| origin/main = local main | `edd3d24` (unchanged) |
| Base | `6ab6cbc` (S1-UAT-05 final), ancestor of both branches |
| A head `feat/s1-uat-07-invite` | `202fe94`, worktree clean |
| B head `feat/s1-uat-09-polish` | `c0493a1`, worktree clean |
| Shared DB `hubnetwork_p0` | 17 migrations, max 017, fingerprint `903b0842…`; unchanged at the end |

## Commit graph

| Set | Commits (base → head) | Kind |
|---|---|---|
| S1-UAT-07 | `d37c36c` code + migration 020 · `6a3a485` test · `309574a` docs · `63eb2cb` code (FIX-01) · `202fe94` docs | linear on `6ab6cbc` |
| S1-UAT-09 | `4ad5149` code + tests · `5a13ccb` docs | linear on `6ab6cbc` |
| Readiness docs | `5eb2dd2` · `3e3b614` · `c0493a1` | on `5a13ccb` |

Not in the task list but required: `6a3a485` (inside the S1-UAT-07 chain) and `5eb2dd2` (creates the files `3e3b614` / `c0493a1` edit). No listed commit contains another; no duplicate. Overlap: `CLAUDE_LATEST_REPORT.md`, `wf02-s05-project-startup.spec.ts`.

## Integration

| Step | Result |
|---|---|
| fast-forward base → `202fe94` | S1-UAT-07 kept with its original SHAs |
| cherry-pick `4ad5149` → `0fc580d` | clean; `wf02-s05` spec merged both hunks |
| cherry-pick `5a13ccb` → `270f6be` | 1 conflict, `CLAUDE_LATEST_REPORT.md`, DOC_ONLY: kept the S1-UAT-07-FIX-01 report; the S1-UAT-09 report stays archived |
| cherry-pick `5eb2dd2`, `3e3b614`, `c0493a1` → `172c7d3`, `a3db5a1`, `0d23b64` | clean |
| tree check | every A file equals `202fe94`, every B file equals `c0493a1`, except the two overlaps (union) |

No BUSINESS_LOGIC or ARCHITECTURE conflict.

## Evidence

| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| unit | 42 files · 444 / 444 |
| DB (`hubnetwork_s1cand_dbt` + scratch DBs) | 55 files · 849 / 849, incl. migration 020 FRESH / UPGRADE 019 → 020 / RECOVERY (rollback refused while a link exists, lossless otherwise, re-apply) and 019 / 018 suites |
| migration on `hubnetwork_s1cand` | 001 → 020 + seed; second run skips everything |
| targeted (S1-UAT-07, S1-UAT-09, WF01-S10, WF02-S05 / S06 / S08) | 69 / 69 (S1-UAT-07 12 / 12 on re-run, see below) |
| full protected regression (`hubnetwork_s1cand_reg`, fresh) | 97 specs · 1265 tests · 1236 PASS · 0 FAIL · 29 SKIP (opt-in, unchanged) · 0 FLAKY (no retries) · 21.0 min |
| UAT L1-L2 | 10 specs · 19 / 19 |

Test-order note (pre-existing on the S1-UAT-07 branch, not caused by integration): `s1-uat-07-invite.spec.ts` does not call `applyVocabularyFixture()` and relies on an earlier spec to create the "Logistics" item; run first on an empty DB its 12 tests fail at setup (422 unknown vocabulary). The full suite order applies the fixture first. Recorded, not changed here.

## Readiness refresh

17 invitation AC → READY with evidence; US-02.14-AC04 stays pending (owner never sees "Đã từ chối"); US-X.02-AC01…03 stay pending (S1-UAT-06 / 03B cases). READY 79 · IMPLEMENTATION_PENDING 63 · BUSINESS 0 · LEGAL 11 · ENV 4 · PO content 2 · OOS 1 = 160 ([overview](../../uat/sprint1-readiness/overview.md)).

## Release prerequisites

`INVITE_LINK_SECRET` (≥ 32 random characters, server env only) on the UAT server; e-mail provider for invitations and reset; migrations 018 → 020 on the UAT database.

## Related

- [S1-UAT-07-evidence](S1-UAT-07-evidence.md)
- [S1-UAT-09-polish](S1-UAT-09-polish.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
