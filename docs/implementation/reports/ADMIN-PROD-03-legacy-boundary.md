# ADMIN-PROD-03-legacy-boundary

**Evidence 10, 11, 17: legacy declaration conversion, the S1-UAT-03B boundary, DB / migration.** Parent: [ADMIN-PROD-03-verification-api.md](ADMIN-PROD-03-verification-api.md). Closes ADMIN-PROD-02 handoff items 1 and 2.

## 10. Legacy declaration conversion (`src/lib/admin/legacy-declarations.ts`, R5)
| Item | Rule |
|---|---|
| input | `community_memberships` with `hub_declaration` still PENDING_APPROVAL (the onboarding claim, D6B path) |
| enough information | position non-empty, ≤ 200; period with an explicit start **month** (`MM/YYYY` or `YYYY-MM`) and an explicit end month or "nay / hiện tại / present"; no future month; end ≥ start; unit a PUBLISHED HUB / CHAPTER / CLB; requester ACTIVE profile and account |
| never | a guessed month ("2024 – nay" is `period_year_only`), an approval, a membership or leadership change, a rewrite of the source row |
| result | a PENDING request, routed by PD-1 at conversion time (never to the requester), `submitted_at` = the declaration's time; provenance `VERIFICATION_REQUEST_MIGRATED` (system actor, `membership_id`) |
| re-run | idempotent: a declaration with a provenance event is `already_converted`; the declared-position index refuses a duplicate (`duplicate_position`) |
| report | `apply: false` = dry run, nothing written: `scanned`, `converted`, `skipped` by reason (`missing_position`, `position_too_long`, `missing_period`, `period_year_only`, `period_unparsed`, `period_future`, `period_order`, `unit_unavailable`, `requester_unavailable`, `already_converted`, `duplicate_position`), per-item ids only |
| after approval | a converted current-term request activates the legacy pending membership itself (R2), so the declaration ends as one ACTIVE membership |

Local result: the deterministic seed holds **0** legacy declarations (dry run `scanned 0`). Production: not queried by this task (no production data access); the dry run gives its count and reasons before anything is written. Test (`verification-queue.db-test.ts`): 6 declarations → 2 converted (explicit months), 4 left with `period_year_only`, `missing_position`, `missing_period`, `requester_unavailable`; re-run converts 0.

**When it runs.** At the S1-UAT-03B cut-over, not in this task: while onboarding still files declarations as memberships, a conversion now would leave two live paths for the same claim (the WF03 platform review of the membership and the unit queue), and nobody can see the unit queue before the admin frontend (ADMIN-PROD-06). Year-only declarations stay in the existing WF03 review (D6B) until decided or re-declared through the new form.

## 11. S1-UAT-03B boundary (frozen)
| Side | Owns | On |
|---|---|---|
| S1-UAT-03B (user) | create (`fileVerificationRequest`, ADMIN-PROD-02), edit while PENDING (`version + 1`, `…_UPDATED`), withdraw (PENDING → WITHDRAWN, `…_WITHDRAWN`), resubmit (REJECTED → PENDING, handled fields cleared, `version + 1`, `…_RESUBMITTED`); the 1 – 10 positions rule; the user's status view | `role_verification_requests` — the only request model |
| ADMIN-PROD-03 (unit) | queue, detail, approve, reject, effects, notifications | the same table |

**Compatibility gap today (documented, not changed here).** Onboarding stage 3 saves claims to `individual_profiles.onboarding_hub_claims`; `completeOnboarding` (`src/lib/onboarding/complete.ts`) calls `fileClaimedMemberships` (`src/lib/network/membership-request.ts`), which writes PENDING_APPROVAL memberships with `hub_declaration = true` and free-text position / period; ACC-10 "Theo dõi xác minh chức vụ HUB" reads those memberships (`listPendingClaims`). The cut-over (S1-UAT-03B): onboarding files one request per claim through `fileVerificationRequest` instead of creating memberships; ACC-10 reads requests; `convertLegacyDeclarations` runs once (dry run first); the WF03 platform-only review of `hub_declaration` memberships (05 §20.4) is retired for converted ones. No second request model, no membership created directly by onboarding after that point.

## 17. DB / migration
**NO_SCHEMA_CHANGE** (no migration 018). Everything sits on 017: requests, version, handler fields, notifications. Provenance is an audit event rather than a column, because one event per conversion is the history the queue already reads, and the declared-position index plus the event lookup make re-runs safe. Changes in code only: the `verification.decide` idempotent operation (A9), five audit codes, a nullable system actor in `writeAudit`. Fresh / upgrade / recovery of 017 unchanged (`admin-migration.db-test.ts` passes); the full DB suite ran on freshly reset databases.

## Related
- [ADMIN-PROD-03-verification-api.md](ADMIN-PROD-03-verification-api.md) · [ADMIN-PROD-03-qa.md](ADMIN-PROD-03-qa.md) · [ADMIN-PROD-02-prod03-handoff.md](ADMIN-PROD-02-prod03-handoff.md)
