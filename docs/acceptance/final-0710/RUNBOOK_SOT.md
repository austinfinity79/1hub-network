# Runbook SOT — final acceptance v2 (PROPOSED)

Status: **PROPOSED, awaiting PO approval.** Nothing here is approved until the PO signs the decisions in [FINAL_ACCEPTANCE_REPORT](FINAL_ACCEPTANCE_REPORT.md#po-decisions-required). The original script is archived unchanged in [RUNBOOK_ORIGINAL](RUNBOOK_ORIGINAL.md) (sha256 `1919884860a8bfa8…274d80a`). Every original step is kept here and classified; none is deleted.

Locked rules this version follows: no public Event surface in P0 (no `/events`); Talent directory = NETWORK_ONLY, the guest gate is correct behaviour; identity verification is a demo state (DEMO-D10); unbuilt targets are plain labels (DEMO-D6); hero video cancelled, six approved stills (HOMEPAGE-HERO-SLIDER-01); no invented content, URL or record.

## Classification
| # | Original action | Class | Actor (v2) | v2 expected result | Dependency |
|---|---|---|---|---|---|
| 01 | Open Home, signed out | KEEP | Guest | Root domain public, no login, no layout / font error | — |
| 02 | Let the hero video run 5–8 s | UPDATE_EXPECTATION | Guest | Six approved stills, 01 first, 10 s each, loop 06→01; artwork not covered; search + CTA inside the hero; no blank frame (video cancelled by PO) | — |
| 03 | Hero CTA + global search | UPDATE_EXPECTATION | Guest | Search visible; "Tham gia cộng đồng HUB Network" → `/auth`; "Tổ chức chương trình" / "Gọi vốn" are disabled labels ("Sắp có trong phiên bản tiếp theo", DEMO-D6) and are not clicked; global search is not submitted in the pitch | — |
| 04 | Menu Chương trình | BLOCKED_BY_PO_INPUT | Guest | Route + active state work; the directory shows only approved, source-backed programmes; no "demo" / "mẫu" / "Internal Alpha" text visible | PROGRAMME-PRESENTATION-DATA-01 |
| 05 | Programme filters | BLOCKED_BY_PO_INPUT | Guest | Filters update cards, empty state, reset — demonstrated on the approved programme set | PROGRAMME-PRESENTATION-DATA-01 |
| 06 | Menu Sự kiện | REMOVE_FROM_P0 (proposed) | — | SCRIPT_SCOPE_MISMATCH: P0 has no public Event surface; option A remove from the journey, option B keep as N/A · OUT_OF_SCOPE | PO decision PD-EVT |
| 07 | Event filters | REMOVE_FROM_P0 (proposed) | — | SCRIPT_SCOPE_MISMATCH (depends on 06) | PO decision PD-EVT |
| 08 | Menu Sản phẩm | KEEP | Guest | `/products`, active nav, list not empty, consistent cards | — |
| 09 | Product search / filters | KEEP | Guest | Search, sector, stage, empty state, clear-all back to the full list | — |
| 10 | Menu Nhân tài | CHANGE_ACTOR | Guest → gate; Member → browse | 10G Guest: `/talents` shows the member gate, no talent row (privacy PASS). 10M Member: talent cards with name, headline, skills, place | FINAL-ACCESS-PREP-01 (member account) |
| 11 | Talent filters | CHANGE_ACTOR | Member | Filters work; no private field visible | FINAL-ACCESS-PREP-01 |
| 12 | Back to Sản phẩm | KEEP | Guest | Back / navbar stable | — |
| 13 | Open the pinned product | KEEP | Guest | `/products/tracely`; sections with data; no broken image / link | — |
| 14 | Scroll to Đội ngũ | KEEP | Guest | Founder / team cards with correct roles; founders clickable | — |
| 15 | Open one founder | UPDATE_EXPECTATION | Guest | Founder profile from the team card; back-link to the product; public data only; verification chip shown as the DEMO state "Đã xác thực danh tính qua 1Hub" (no CCCD number, no document image) — PO confirms the wording replaces "ký hiệu CCCD" | PO decision PD-VER |
| 16 | Menu Giới thiệu | KEEP | Guest | About renders on desktop; no placeholder content visible | ABOUT-PARTNERS-PRESENTATION-01 |
| 17 | Click APEC Innovation Challenge | BLOCKED_BY_PO_INPUT | Guest | Opens the authoritative APEC URL in a new tab; 1hub tab unchanged | APEC-LINK-01 |
| 18 | Back to the 1hub tab, still on About | KEEP | Guest | Same tab and page, no reload error | — |
| 19 | Click deck iHUB Ventures | UPDATE_EXPECTATION | Presenter | App: `https://deck.ihub.ventures/` in a new tab (PASS today). Deck content visible only with access prepared on the presenter machine or public view granted by the owner | FINAL-ACCESS-PREP-01 |
| 20 | Click deck Vietnam's National Ventures | UPDATE_EXPECTATION | Presenter | Same rule for `https://vnv.ihub.ventures/` | FINAL-ACCESS-PREP-01 |
| 21 | End on About or back Home | KEEP | Guest | Logo → Home; no broken route or inconsistent data across the journey | all of the above |

Counts: KEEP 9 · UPDATE_EXPECTATION 5 · CHANGE_ACTOR 2 · REMOVE_FROM_P0 2 (proposed) · BLOCKED_BY_PO_INPUT 3 = 21.

## Event (06 / 07) — recommendation
Recommend **option A, remove from the P0 acceptance journey**, keeping the two rows here as SCRIPT_SCOPE_MISMATCH for traceability. Rationale: P0 production scope is WF01–WF03; Event is a canonical entity without a P0 public surface (`PUBLIC_ROUTES.events = null`, DM07 is REFERENCE only in the 07/10 demo SOT); the content pack holds no Event dataset (`docs/demo-content/sprint1/06-event-source-status.md`). Building Event only to satisfy the old script would invent unsupported behaviour. Option B (keep visible as N/A) is acceptable if the PO wants the gap shown in the walkthrough. PO decides.

## Talent (10 / 11) — recommendation
Keep the guest gate as an explicit privacy PASS (10G). Demonstrate browsing / filtering only as a signed-in MEMBER (10M, 11) on a prepared, production-like synthetic account ([ACCOUNTS](ACCOUNTS.md)); if no such account is ready, the two member rows are skipped and the journey stays guest-only. Never expose talent rows to guests.

## Setup changes vs the original section A
- "Incognito, signed out" holds for every Guest row; the Member rows (10M, 11) run in a separate signed-in window opened after step 09.
- The hero has no video, so the poster / muted rule does not apply.
- External decks and APEC need the backup tabs of section A, prepared per [PRECHECK](PRECHECK.md).

## Related
- [RUNBOOK_ORIGINAL](RUNBOOK_ORIGINAL.md) · [RUNBOOK_RESULT](RUNBOOK_RESULT.md) · [PRESENTATION_DATA](PRESENTATION_DATA.md) · [ACCOUNTS](ACCOUNTS.md) · [PRECHECK](PRECHECK.md) · [FINAL_ACCEPTANCE_REPORT](FINAL_ACCEPTANCE_REPORT.md)
