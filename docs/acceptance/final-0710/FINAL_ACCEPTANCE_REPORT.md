# Final acceptance report — 07/10 walkthrough

| Item | Value |
|---|---|
| Live SHA | `57c1f14650e7c512f3f50d9ab424c5c1faa20269` (unchanged through DEMO-RUNBOOK-QA-01) |
| Script | [RUNBOOK_ORIGINAL](RUNBOOK_ORIGINAL.md), 21 steps, sha256 `1919884860a8bfa8…274d80a` |
| Result | 9 PASS · 7 PARTIAL · 5 BLOCKED ([RUNBOOK_RESULT](RUNBOOK_RESULT.md)) |
| Verdict | **NOT FINAL READY** against the original script. No product bug, no privacy / security / data-integrity issue. Every open item is a scope mismatch, a presentation gap, a PO input or an external access dependency |

## Findings by category
Each finding sits in exactly one category.

### PRODUCT BUG
None found. Every app link, route, filter, redirect and auth state behaved as specified.

### SCRIPT / SCOPE MISMATCH
| ID | Steps | Finding |
|---|---|---|
| SM-1 | 06, 07 | Script requires a public Event route and filters; P0 has no Event surface (`PUBLIC_ROUTES.events = null`, `/events` 404). Recommendation: remove from the P0 journey (PD-EVT) |
| SM-2 | 10, 11 | Script requires guests to see and filter talent cards; locked rule is NETWORK_ONLY, the guest gate is correct. Recommendation: guest gate = privacy PASS; browsing as MEMBER (PD-TAL) |
| SM-3 | 02 | Script expects a hero video; the PO cancelled it for six approved stills. Expectation updated |
| SM-4 | 15 | Script expects a prominent "CCCD" verification mark; DEMO-D10 allows only the demo state "Đã xác thực danh tính qua 1Hub" (PD-VER) |

### CONTENT / PRESENTATION GAP
| ID | Steps | Finding | Dependency |
|---|---|---|---|
| CP-1 | 04, 05, 21 | `/programmes` shows only "Chương trình ươm tạo (demo)" — "Chương trình mẫu cho Internal Alpha…"; violates the no-demo / no-sample presentation rule and differs from the four homepage programme cards | PROGRAMME-PRESENTATION-DATA-01 |
| CP-2 | 16 | About partner wall shows placeholder names ("Doanh nghiệp A", "Tập đoàn C", "Đại học A"…) labelled "Dữ liệu minh hoạ" (DEC-H1-R2 precedent); the 17 HanoiBA logos are held for lack of names | ABOUT-PARTNERS-PRESENTATION-01 (new) |
| CP-3 | About | The "iHUB Incubator" row shows an → arrow but has no link target (same pattern as APEC) | ABOUT-PARTNERS-PRESENTATION-01 (URL from PO) |

### PO INPUT REQUIRED
| ID | Steps | Input |
|---|---|---|
| PO-1 | 17 | Authoritative APEC Innovation Challenge URL (APEC-LINK-01). Not guessed |
| PO-2 | 04, 05 | Approved programme records or approval to hide the internal fixture (feeds CP-1) |
| PO-3 | homepage | Decision on the stale "Cập nhật chương trình" feed (now below the first screen) |

### EXTERNAL ACCESS DEPENDENCY
| ID | Steps | Finding | Dependency |
|---|---|---|---|
| EX-1 | 19 | `https://deck.ihub.ventures/` opens correctly in a new tab, then the external site asks for an approved e-mail (`/login`) | FINAL-ACCESS-PREP-01 |
| EX-2 | 20 | `https://vnv.ihub.ventures/` opens correctly, then asks for an authorised e-mail (`/access`) | FINAL-ACCESS-PREP-01 |
| EX-3 | 10M, 11 | No prepared member account exists; the seeded fictional profiles cannot sign in | FINAL-ACCESS-PREP-01 |

### ACCEPTED NON-BLOCKER
- Footer legal links 404 (PUBLIC-LEGAL-01, separate) — not clicked in the journey.
- Light-header symbol on product detail tabs (dark logo variant pending).
- Hero "Tổ chức chương trình" / "Gọi vốn" are disabled labels with a tooltip (DEMO-D6).
- Global search lands on Library › "Bài toán"; Library counts 114 startups (95 canonical + external WF06 records) vs 95 on `/products` — presenter does not submit search.
- `/auth` has no return-URL parameter; post-login landing not verified (no sign-in in this lane).

## PO decisions required
| ID | Decision | Recommendation |
|---|---|---|
| PD-EVT | Steps 06 / 07: A remove from P0 journey, or B keep as N/A · OUT_OF_SCOPE | A |
| PD-TAL | Steps 10 / 11: guest gate = PASS; browsing as MEMBER, or skip member rows | gate PASS + member rows if FINAL-ACCESS-PREP-01 is ready |
| PD-VER | Step 15: accept "Đã xác thực danh tính qua 1Hub" (demo state) in place of "CCCD nổi bật" | accept; no CCCD claim on a fictional profile |
| PD-PRG | Programme records to publish, or hide the fixture | supply approved records |
| PD-APEC | APEC URL | supply |
| PD-FEED | Stale programme-update feed | hide or accept as illustrative |

## Shortest path to FINAL READY
1. FINAL-ACCEPTANCE-SOT-01 (this) → PO signs PD-EVT, PD-TAL, PD-VER, PD-FEED on [RUNBOOK_SOT](RUNBOOK_SOT.md).
2. In parallel:
   - PROGRAMME-PRESENTATION-DATA-01 — approved programme data (PD-PRG);
   - ABOUT-PARTNERS-PRESENTATION-01 — approved partners or hide the wall;
   - APEC-LINK-01 — the URL (PD-APEC);
   - FINAL-ACCESS-PREP-01 — member account and deck access.
3. Precheck per [PRECHECK](PRECHECK.md) on the exact approved SHA.
4. Rerun final acceptance against RUNBOOK_SOT v2; FINAL READY = every KEEP / UPDATE / CHANGE_ACTOR row PASS and the removed rows recorded as approved.

## Related
- [RUNBOOK_SOT](RUNBOOK_SOT.md) · [RUNBOOK_RESULT](RUNBOOK_RESULT.md) · [PRESENTATION_DATA](PRESENTATION_DATA.md) · [ACCOUNTS](ACCOUNTS.md) · [PRECHECK](PRECHECK.md) · [evidence/](evidence/)
