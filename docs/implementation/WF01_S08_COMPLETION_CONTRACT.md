# WF01 S08 Completion Contract

**Status: HUMAN APPROVED — P0** (2026-09-26). The audit's H1–H8 were resolved as [DEC-WF01-S08-D1..D8](../decisions/DECISION_LOG.md#dec-wf01-s08-d1). Implemented by WF01-S08.

## 1. Completion trigger

S07 saves consent and visibility, then navigates to `/onboarding/complete`. For a not-yet-completed account, S08 performs `POST /me/onboarding/complete` on entry ([D1](../decisions/DECISION_LOG.md#dec-wf01-s08-d1)) and renders success only after the 200.

| Situation | S08 renders |
|---|---|
| Already completed | The success view directly (no redirect) |
| 422 | What is missing, linked to S06 or S07 |
| Other failure | A retry |

## 2. Activation requirements

| Requirement | Required to activate | Source | Failure behavior |
|---|---|---|---|
| Authenticated ACTIVE account | Yes | API:474 | 401 |
| `display_name` non-empty | Yes | Freeze:116 | 422 `ONBOARDING_REQUIREMENTS_MISSING`, `fields.display_name = "missing"` → link to S06 |
| REGION linked | Yes | same | `fields.region_id = "missing"` → S06 |
| Current TERMS_ACCEPTANCE (by document id) | Yes | same | `fields.TERMS_ACCEPTANCE = "missing"` → S07 |
| Current PRIVACY_DATA_PROCESSING | Yes | same | `fields.PRIVACY_DATA_PROCESSING = "missing"` → S07 |
| headline, expertise, avatar, bio, intent, membership, 80% | **No** | DEC-WF01-S06-D2, D5 | never checked |

## 3. Atomic lifecycle transition

`src/lib/onboarding/complete.ts` runs one transaction with the profile row locked (`FOR UPDATE`):

1. Check the requirements.
2. Set `status = ACTIVE` (from DRAFT) and `onboarding_completed_at = now()`.
3. Write the audit `PROFILE_ACTIVATED` (only on DRAFT → ACTIVE) and the analytics event `onboarding_completed` (first completion only).

Any failure rolls everything back. `OnboardingCompletion` is logical; there is no table and no migration.

## 4. Idempotency / revisit

- **Already completed:** 200 with the same `{completed, profile_status, completion_percent, next}`. The original timestamp is kept, and no second audit or analytics event is written.
- **Concurrent calls:** serialised by the row lock.
- **Request body:** ignored; a client `completion_percent` is never read.
- **Revisit:** S08 stays viewable; S05–S07 redirect a completed account to `/me`.

## 5. Network read model

S08 creates and infers nothing ([D4](../decisions/DECISION_LOG.md#dec-wf01-s08-d4)). Existing ACTIVE and PENDING rows stay as they are; S08 does not display network data because there is no approved component.

## 6. CTA / action routing matrix

| Visible action | Contract action | Scope | Route/API | Runtime rule |
|---|---|---|---|---|
| 01 "Xem bài toán" | `open_challenge_library` | INTENTIONAL-DEMO-SCOPE | none | Not rendered ([D2](../decisions/DECISION_LOG.md#dec-wf01-s08-d2)) |
| 02 "Lập hồ sơ đội" | `create_project_profile` | TEMPORARY-PRODUCTION-DEPENDENCY | `/projects/new` + `POST /ventures` (WF02-S05) | Not rendered until WF02-S05 ([D3](../decisions/DECISION_LOG.md#dec-wf01-s08-d3)) |
| 03 "Xin vào chapter" | `request_or_open_chapter` | TEMPORARY-PRODUCTION-DEPENDENCY | membership request, network read, chapter route | Not rendered (D4) |
| "Vào 1hub.network" (added) | `next → WF02-S01` | PRODUCTION | `/me` | The only exit ([D6](../decisions/DECISION_LOG.md#dec-wf01-s08-d6)) |
| Header "Bỏ qua, làm sau" | — | — | — | Not rendered (D6) |

## 7. WF02 handoff

`/me` is the frozen WF02-S01 route (M0-T03 placeholder). It resolves safely, and completion never depends on it.

## 8. Completion / analytics

- The panel shows the percent from the single completion service. Completing below 80% is allowed.
- One writer (`src/lib/analytics/analytics.ts`) on `analytics_events`:
  - `onboarding_completed` once;
  - `profile_completion_changed` from `PATCH /me/profile` and avatar upload, only when the percent moves, with `from_percent` and `to_percent`.
- Only the API §10 common properties are sent; no profile or consent content ([D8](../decisions/DECISION_LOG.md#dec-wf01-s08-d8)).

## 9. Release dependencies

`PRODUCTION_LEGAL_CONTENT_REQUIRED` (UAT/release): production must not complete onboarding against fixture documents.

## 10. API / DB gaps

| Item | Status |
|---|---|
| A1 (422 shape, already-completed response) | Resolved as above |
| A2, D1 (chapter by region) | Deferred with D4 |
| R1–R3 (WF02 routes/APIs) | Deferred with D3/D4; `/me` placeholder resolves |
| R4 | Analytics writer done; `membership_bootstrap` consumption still absent (WF02/roster task) |
| Other API §10 events | Not emitted yet (account_created, consent_accepted, visibility_changed, …); same writer, later task |
| Schema | No migration |

## 11. Human decisions required

None open for S08.

## Related

- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [WF01_S07_PRIVACY_CONSENT_CONTRACT.md](WF01_S07_PRIVACY_CONSENT_CONTRACT.md) — previous step contract
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
