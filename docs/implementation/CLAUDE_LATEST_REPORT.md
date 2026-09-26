# Claude Task Report

## 1. Task
- Task ID / name: WF01-REMEDIATION-01 — GAP-ROSTER (launch cohort membership/leadership bootstrap)
- Status: **DONE — GAP-ROSTER CLOSED**. Real production roster data remains an operational input.
- Mode: LOCAL REVIEW. Committed locally, not pushed. GAP-ANALYTICS-REG, DEFECT-RESUME and WF02 not started.
- Business rule: Data Decisions Freeze D2 "PRESEED + PENDING FALLBACK" (no new decision was needed).

## 2. Pre-flight
| Item | Finding |
|---|---|
| Bootstrap storage | `membership_bootstrap` (001): normalized email, organization, `membership_state`, `leadership_role_label`, `source_batch`, `consumed_by_account_id/at`, UNIQUE (email, org, batch) — sufficient; no new roster model |
| Template | `db/seed/production_roster_template.csv`: `email,organization_slug,membership_state,leadership_role_label,source_batch` |
| Matching key | normalized email, `trim().toLowerCase()` exactly as auth (`src/lib/auth/email.ts`) |
| Uniqueness | memberships: `uq_open_membership` (002); leadership: **none**, so it was added |
| Account creation | `consumeMagicLink` (sign-in); the profile is created by the first onboarding write |
| Integration point | after the account is resolved in `consumeMagicLink`, on every sign-in |

## 3. Implementation
| Part | Result |
|---|---|
| Migration `004_p0_roster_bootstrap.sql` (additive) | `uq_active_leadership` (profile, org, title WHERE ACTIVE), plus the single attach routine `roster_reconcile_account(account)`. It locks the account's pending rows `FOR UPDATE` and ensures the one profile. Per row: no membership → ACTIVE, source `ORGANIZATION_VERIFIED` (SOT provenance), `started_at`; ACTIVE → reused; any other state → `CONFLICT_<STATE>`, not overwritten, row left unconsumed; leadership only when the row has a label; marks the row consumed. One statement = one transaction |
| Importer | `pnpm roster:import <file> [--dry-run]` (`scripts/roster.mjs` + `scripts/roster-lib.mjs`). Validates header, email, organization (exists; HUB/CHAPTER/CLB; not archived), `membership_state = ACTIVE`, label length, batch; any invalid row aborts the whole import; in-file duplicates collapse; re-import is a no-op; a changed row in the same batch is refused. Late import reconciles existing accounts in the same transaction. Output: counts plus masked references (`l***@example.org`), never file contents |
| Sign-in | `consumeMagicLink` → `reconcileRoster`. Idempotent; a failure never blocks sign-in (logged without personal data; retried on the next sign-in or import) |
| RBAC | no RoleAssignment is created. Leaders and members hold no capability from roster data (approved matrix rule 2) |
| Unmatched | nothing attached, not even a profile; onboarding unchanged |
| Pending fallback | a self-declared PENDING_APPROVAL membership stays pending (reported as a conflict). `POST /me/membership-requests` is still WF02 scope, not built here |

## 4. QA
- **Unit** (`roster-lib.test.ts`, 5): normalization and plausibility identical to auth; CSV quoting/CRLF/BOM; header; duplicates.
- **DB** (`roster.db-test.ts`, 9):
  - malformed rows rejected with nothing written and no full email in errors;
  - dry run writes nothing; import and re-import idempotent;
  - normalized match; member ACTIVE with no leadership; Chapter and CLB leaders get leadership; one person in two chapters;
  - unmatched → no profile;
  - late import reconciles an existing account;
  - existing ACTIVE reused; PENDING and SUSPENDED not overwritten;
  - 6 concurrent sign-ins → one attach;
  - atomicity: a failing leadership insert leaves no membership and an unconsumed row;
  - no RoleAssignment and no capability.
- **UAT-11** (`wf01-uat-journey.spec.ts`), now **PASS**, expected-fail marker removed:
  - member → one profile, ACTIVE membership, no leadership, onboarding completes, a second sign-in adds nothing;
  - leader → membership and leadership, `capabilities` and `managed_scopes` empty.
  - The UAT-03b and UAT-12 markers are untouched.
- **Fresh DB proof** (clean clone of `a6a454e` plus the fix, new PostgreSQL 17.6 on 55433):
  - migrate 001→004, then a repeat run skips;
  - invalid fixture: exit 1, nothing written; dry run writes nothing;
  - import: 6 new, 1 duplicate collapsed, seed `member` already ACTIVE, seed `pending` → CONFLICT_PENDING_APPROVAL;
  - sign-in of fixture users (real magic-link consume): member 2× ACTIVE; leaders membership + leadership; unknown user nothing; roles 0; capabilities [];
  - **app and DB restarted: relationships identical**; re-import and re-login: no duplicates;
  - DB 190/190 and UAT + auth specs 41/41 on the fresh DB; app logs contain no email or roster content.

## 5. Validation (dev)
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS |
| Unit / DB | 120 / 190 (schema ledger test now lists 004) |
| Build | PASS |
| Full Playwright | 263 passed, 24 skipped by design (includes the WF01 UAT suite, auth/session, RBAC, onboarding, consent, completion) |
| Pixel | unchanged: S01 0/0/0/0/1; S02 0/0/0/14/3; S04 1, 1/3; S05 193/245; S06 6/503; S07 26/75; S08 all 0; S03 PASS |

## 6. Notes
- **Not built here.** `POST /me/membership-requests` (the PENDING fallback endpoint) and an operator UI for conflicts are WF02/WF03 scope.
- **Seed row.** The seed keeps its intentionally unconsumed row (`unclaimed@example.test`), which now attaches on that address's first sign-in, as it was designed to.

## 7. Git
- Branch: `main`; start HEAD `fed0b25`
- Implementation commits: `a6a454e` feat(wf01): launch-roster bootstrap…; `d79f68f` fix(roster): dry run predicts conflicts…
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `fed0b25`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [WF01_COMPLETION_AUDIT.md](WF01_COMPLETION_AUDIT.md) — audit (updated)
- [WF01_UAT_MATRIX.md](WF01_UAT_MATRIX.md) — UAT matrix (updated)
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
