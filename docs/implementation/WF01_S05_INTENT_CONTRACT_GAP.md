# WF01 S05 Intent Contract Gap

**ONBOARDING INTENT CONTRACT GAP** — WF01-S05 `/onboarding/purpose` stopped before implementation, as instructed. No code, API, DB or SOT change was made for S05.

## Evidence

| Source | What it says |
|---|---|
| API 05 §4.2 `PUT /me/onboarding/intent` | `primary_intent` is "config-backed/product-config data. The API contract intentionally does not freeze a permanent enum beyond values approved in launch configuration." The only example is `EXPLORE_NETWORK` |
| Repository | No launch/product configuration of intent values exists anywhere |
| DB 001 | `individual_profiles.primary_intent text`: no enum, no check constraint |
| Seed | Uses `EXPLORE_NETWORK` only |
| Data SOT / freeze / WF01 | No intent catalogue; WF01 says only "capture why user comes to HUB / initial intent" |
| Screen Contract | writes `OnboardingIntent`; actions `select_primary_intent`, `skip_later` |

## Approved bitmap options vs canonical values

| # | Option (bitmap) | Canonical value | Note |
|---|---|---|---|
| 1 | Tôi có giải pháp và muốn nộp cho bài toán | none | |
| 2 | Đơn vị tôi có bài toán cần giải | none | |
| 3 | Tôi tổ chức cộng đồng ở địa phương | none | |
| 4 | Tôi là nhà đầu tư | none | **Future scope:** Investor/VC/Dataroom is out of P0 (Master Prompt §2; its hint mentions a dataroom) |
| 5 | Tôi chỉ muốn xem trước đã | `EXPLORE_NETWORK`? | Only the contract example exists; its mapping to this label is not stated |

## Decisions required (proposed IDs DEC-WF01-S05-Dn)

| ID | Decision needed | Suggested option (for review only; not implemented) |
|---|---|---|
| D1 | Approved intent codes for options 1–5 (launch configuration) | e.g. `SUBMIT_SOLUTION`, `POST_CHALLENGE`, `ORGANIZE_COMMUNITY`, `INVESTOR`, `EXPLORE_NETWORK`, as a server-side allowlist |
| D2 | Investor option in P0: render, hide, or capture intent only with no investor flow | P0 excludes Investor/VC/Dataroom flows |
| D3 | `skip_later` semantics. The header "Bỏ qua, làm sau" skips the step or the whole onboarding; is anything recorded? `intent` stays `null`? | Contract gives the action, not its persistence |
| D4 | Default selection. The bitmap shows option 1 selected; the runtime must not fabricate a default intent | Default nothing selected; capture pixel QA with option 1 selected as a deterministic state |
| D5 | Unauthenticated access. No page guard exists yet (M0 enforces at the API) | Server-side redirect to `/auth` when there is no session |
| D6 | Revisit after this step (WF01: "resume at first incomplete step") | Allow revisit to change intent before onboarding completes; `/me` once completed |

## Non-blocking observations

- The header stepper (Vai trò · Thông tin · Quyền riêng tư) spans S05–S07, so an onboarding shell is expected to be shared by those three screens.
- `GET /me/onboarding` and `PUT /me/onboarding/intent` are frozen contract endpoints but not yet implemented; S05 would add them.

## Related

- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
