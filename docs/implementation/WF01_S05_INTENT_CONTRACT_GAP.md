# WF01 S05 Intent Contract Gap

> **SUPERSEDED 2026-09-29 by [DEC-L1R](../decisions/DECISION_LOG.md#dec-l1r) (TASK 22-L1-L2-SOT-REALIGN).** The purpose step left the onboarding. `/onboarding/purpose` now holds stage 3, "Vai trò trong hệ sinh thái" (ACC-08); the intent endpoint stays as contracted and no screen calls it. Current contracts: [l1-screen-contracts.md](l1-l2-realign/l1-screen-contracts.md). The text below is kept as history.

**Status: HUMAN APPROVED — P0** (2026-09-26). The gap recorded before WF01-S05 was resolved by
decisions DEC-WF01-S05-D1..D6; `/onboarding/purpose` is implemented against them.

## Evidence (at the time of the gap)

| Source | What it says |
|---|---|
| API 05 §4.2 `PUT /me/onboarding/intent` | `primary_intent` is config-backed; no permanent enum beyond values approved in launch configuration; example `EXPLORE_NETWORK` |
| Repository | No launch/product configuration of intent values existed |
| DB 001 | `individual_profiles.primary_intent text`: no enum, no check constraint |
| Data SOT / freeze / WF01 | No intent catalogue; WF01 says only "capture why user comes to HUB / initial intent" |
| Screen Contract | writes `OnboardingIntent`; actions `select_primary_intent`, `skip_later` |

## Approved mapping (DEC-WF01-S05-D1)

| # | Option (bitmap) | P0 code |
|---|---|---|
| 1 | Tôi có giải pháp và muốn nộp cho bài toán | `SUBMIT_SOLUTION` |
| 2 | Đơn vị tôi có bài toán cần giải | `POST_CHALLENGE` |
| 3 | Tôi tổ chức cộng đồng ở địa phương | `ORGANIZE_COMMUNITY` |
| 4 | Tôi là nhà đầu tư | not in P0 — not rendered (INTENTIONAL-P0-SCOPE) |
| 5 | Tôi chỉ muốn xem trước đã | `EXPLORE_NETWORK` |

## Approved decisions

| ID | Decision |
|---|---|
| [D1](../decisions/DECISION_LOG.md#dec-wf01-s05-d1) | Server-side allowlist of the four codes; no `INVESTOR`; unknown values rejected (422), no coercion |
| [D2](../decisions/DECISION_LOG.md#dec-wf01-s05-d2) | Frozen `PUT /me/onboarding/intent`; persist only `primary_intent` |
| [D3](../decisions/DECISION_LOG.md#dec-wf01-s05-d3) | "Bỏ qua, làm sau" skips this step only: intent stays NULL, go to S06, onboarding not completed |
| [D4](../decisions/DECISION_LOG.md#dec-wf01-s05-d4) | No default selection; a saved value is preselected |
| [D5](../decisions/DECISION_LOG.md#dec-wf01-s05-d5) | No session → server redirect to `/auth` |
| [D6](../decisions/DECISION_LOG.md#dec-wf01-s05-d6) | Editable on revisit before completion; completed → `/me` |

## Notes

- No DB schema change was required: `primary_intent text` already exists.
- The onboarding header (stepper Vai trò · Thông tin · Quyền riêng tư) is shared by S05–S08;
  S05 introduced `OnboardingShell`.

## Related

- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
