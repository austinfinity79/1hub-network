# WF01 S08 Completion Contract

**Status: HUMAN DECISION REQUIRED** (audit only, 2026-09-26). No DB, API or runtime code was changed.

Sources:
- API = `05_API_CONTRACT_P0_v1.0.md`
- SCR = Screen Contracts
- Freeze = Data Decisions Freeze
- Ref = `WF01-S08__onboarding-complete__1440x900.png`

**What the reference shows:**
- header: stepper at step 3 (current, not done) and the skip link "Bỏ qua, làm sau";
- title "Xong. Giờ làm gì?";
- lede "Ba việc hợp với vai bạn vừa chọn. Không làm gì cũng được — mọi thứ vẫn ở đó.";
- three numbered cards (01 challenges, 02 team profile, 03 chapter);
- an info panel ("Hồ sơ của bạn đang ở mức 60% …") with an emoji ℹ;
- **no CTA to `/me` and no "complete" button.**

## 1. Completion trigger

The sources do not settle this: **COMPLETION_TRIGGER — HUMAN DECISION REQUIRED (H1)**.

**Evidence:**
- API:469 says `POST /me/onboarding/complete` "Maps: WF01-S08".
- SCR S08 writes `OnboardingCompletion`.
- The S07 CTA reads "Xong, vào HUB" and the S08 title reads "Xong.", and S08 has no confirm control. So completion is already done when S08 renders.

**Options:**
- **(C, recommended)** S08 issues the idempotent POST on entry, renders success, and on `ONBOARDING_REQUIREMENTS_MISSING` shows recovery. The S07 contract is unchanged.
- **(A)** The S07 CTA calls it after the consents, and S08 is read-only.

Explicit confirmation on S08 (B) has no control in the design.

## 2. Activation requirements

| Requirement | Required to activate | Source | Failure behavior |
|---|---|---|---|
| Valid authenticated account (ACTIVE) | Yes | API:474, Freeze:116 | 401 (none), or blocked → existing auth rules |
| `display_name` non-empty | Yes | same | `ONBOARDING_REQUIREMENTS_MISSING`, fields `{display_name: "missing"}` → S06 |
| `region` (REGION item linked) | Yes | same | `{region: "missing"}` → S06 |
| Current TERMS_ACCEPTANCE (by document id) | Yes | same; DEC-WF01-S07-D1 | `{TERMS_ACCEPTANCE: "missing"}` (also when only a superseded version was accepted) → S07 |
| Current PRIVACY_DATA_PROCESSING | Yes | same | `{PRIVACY_DATA_PROCESSING: "missing"}` → S07 |
| headline, ≥1 expertise | **No** (an S06 UI progression rule only, DEC-WF01-S06-D2) | — | never checked by this API |
| `primary_intent` | **No** (S05-D3 allows NULL) | — | — |
| ≥ 80% completion | **No** (a KPI, not a gate) | WF01 state rules | — |

No conflict found: S06 progression ≠ activation minimum. The client never sends `completion_percent`.

## 3. Atomic lifecycle transition

One transaction:
1. `SELECT … FOR UPDATE` on the profile.
2. If DEACTIVATED → `PROFILE_DEACTIVATED`.
3. Check the requirements; if any is missing → throw and write nothing.
4. `status = 'ACTIVE'`, `onboarding_completed_at = COALESCE(onboarding_completed_at, now())`.
5. **Audit** `PROFILE_ACTIVATED` (resource `individual_profile`; before/after status; request_id) and **analytics** `onboarding_completed`, both only when this call made the transition.

Response `{completed: true, profile_status, completion_percent (single service), next: "/me"}`. It is the same account and profile; the UNIQUE `account_id` rules out a second profile. `/session` reads the same row, so it reflects completion immediately.

## 4. Idempotency / revisit

| Case | Behavior |
|---|---|
| Double submit, retry, concurrent calls | The row lock serialises them; later calls see the completed state and return 200 with the same DTO. No second timestamp, audit or analytics event |
| Refresh S08 / return days later | Recommended: S08 stays viewable once completed (the POST is a no-op), S05–S07 keep redirecting to `/me`. Confirm in H1 |
| Legal version changed after completion | No re-completion; re-acceptance is WF02-S03 (DEC-WF01-S07-D8) |

## 5. Network read model

S08 reads `community_memberships` and `leadership_records`, and fabricates nothing.

| State | Shown | Allowed action |
|---|---|---|
| ACTIVE membership or leadership | The organisation (from data) | Open its context (route dependency R3) |
| PENDING_APPROVAL | Pending state | None; no duplicate request (partial UNIQUE index exists) |
| None | Suggestion only with a defined chapter source (gap D1) | Request membership → `POST /me/membership-requests` → PENDING (R3) |

**Gaps:**
- Pre-seed matching (`membership_bootstrap` consumption, Freeze D2) is **not implemented**, so ACTIVE rows exist only in the seed.
- `GET /me/network` is not implemented.

## 6. CTA / action routing matrix

| Visible action | Contract action | Scope | Route/API | Runtime rule |
|---|---|---|---|---|
| 01 "Xem 12 bài toán đang mở" / "Xem bài toán" | `open_challenge_library` | **NOT_AVAILABLE_P0**: no route in the 25 frozen routes; Programme/Challenge is WF04 demo; "12 open" and "Bốn bài trùng chuyên môn" need Challenge data and matching (WF01 non-goal, WF06 future) | none | Omit (INTENTIONAL_DEMO/FUTURE_SCOPE) unless H2 says otherwise; never a fake working link |
| 02 "Lập hồ sơ đội" | `create_project_profile` | PRODUCTION (WF02-S05) | `/projects/new` (frozen, placeholder); `POST /ventures` not implemented | Link to the frozen route, or omit until WF02-S05 (H3). Copy "Ba trường là xong" and "Cần có đội mới nộp được giải pháp" claim unfrozen rules |
| 03 "Xin vào chapter Đà Nẵng" / "Xin vào chapter" | `request_or_open_chapter` | PRODUCTION action, but no region → chapter source | `POST /me/membership-requests` (not implemented); open: `/me/roles` or `/organizations/:slug` (placeholders) | By state (§5); chapter name only from data, never invented (H4). Copy "cố vấn địa phương và vòng loại khu vực" is not data |
| Info panel "…mức 60%…" | — | INTENTIONAL_RUNTIME_DATA | completion service | Percent from the server; clauses "vẫn dự sự kiện được" and "chỉ khi nộp giải pháp mới cần điền nốt" state unfrozen rules (H7) |
| Header "Bỏ qua, làm sau" | not a contract action; `next: WF02-S01` | — | `/me` | Candidate safe exit (H6) |
| (none visible) | `next → WF02-S01` | PRODUCTION | `/me` (placeholder until WF02-S01) | S08 must offer one exit to `/me` regardless of the cards (H6) |

**Intent.** The bitmap is the SUBMIT_SOLUTION variant ("vai bạn vừa chọn"). Card sets for the other three intents and for NULL are not designed (H5). No default intent may be invented.

## 7. WF02 handoff

`/me` resolves (M0-T03 placeholder, WF02-S01 not implemented). Completion never depends on the optional cards.

## 8. Completion / analytics

- The info panel percent comes from `getProfileCompletion`; below 80% is allowed.
- API §10 freezes the event names `onboarding_completed` and `profile_completion_changed`, with common properties `event_name, occurred_at, account_id, profile_id, workflow, screen_id` and no profile or consent content.
- **Gap:** `analytics_events` exists, but **no analytics writer exists anywhere**, so no P0 event has been emitted since M0. One writer on the existing table, not a second system (H8).

## 9. Release dependencies

- `PRODUCTION_LEGAL_CONTENT_REQUIRED` (UAT/release): production must not complete onboarding against fixture documents.
- Local fixtures satisfy local tests.

## 10. API / DB gaps

| ID | Type | Gap |
|---|---|---|
| A1 | API | `ONBOARDING_REQUIREMENTS_MISSING` status and `fields` shape, and the already-completed response, are not specified (proposed: 422 plus the §2 field map; 200 idempotent) |
| A2 | API | No lookup for "the chapter for my region" |
| D1 | DB | `organizations` has no region link (only unfrozen `metadata`) and no "accepting members" flag |
| R1 | Route | `/me` WF02-S01 placeholder |
| R2 | Route | `/projects/new` WF02-S05 + `POST /ventures` |
| R3 | Route | `POST /me/membership-requests`, `GET /me/network`, chapter context route |
| R4 | Code | `membership_bootstrap` consumption and the analytics writer are absent |
| Schema | — | `OnboardingCompletion` is **logical** (`onboarding_completed_at` + `status`). No table or migration is needed |

## 11. Human decisions required

| ID | Decision |
|---|---|
| H1 | COMPLETION_TRIGGER (C: S08 entry, or A: S07 CTA) and revisit behaviour |
| H2 | Card 01: omit (recommended) or clearly marked Demo |
| H3 | Card 02: link to `/projects/new` now, or omit until WF02-S05; copy claims |
| H4 | Card 03: chapter source per region, request flow placement, per-state copy |
| H5 | Card set and lede for the other intents and for NULL |
| H6 | Exit to `/me`: header link reused as the exit, or a new CTA; S08 stepper state |
| H7 | Info panel clauses and emoji icon |
| H8 | Audit code `PROFILE_ACTIVATED` (proposed); build the analytics writer now for `onboarding_completed` (once only), and whether to backfill S05–S07 events |

## Security test plan (implementation)

| Area | Tests |
|---|---|
| Access | 401 without a session |
| Requirements | missing name, region, Terms or Privacy each → 422 with its field and no change; a superseded-only acceptance → 422 |
| Allowed | below 80% passes; intent NULL passes |
| Transition | DRAFT → ACTIVE; `onboarding_completed_at` set once; repeat and concurrent calls idempotent (one audit, one analytics row) |
| Session and profile | `/session` shows completed/ACTIVE; `completion_percent` equals the service; still one profile |
| Membership | no ACTIVE membership created; PENDING stays PENDING |
| Atomicity | a forced failure leaves DRAFT |
| Payloads | audit and analytics carry no profile or consent content |

## Related

- [WF01_S07_PRIVACY_CONSENT_CONTRACT.md](WF01_S07_PRIVACY_CONSENT_CONTRACT.md) — previous step contract
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
