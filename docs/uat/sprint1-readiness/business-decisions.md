# Business decisions

Decision reconciliation (S1-UAT-09B-PREP final pass, 06/10). The 27 AC that were BUSINESS_DECISION_BLOCKED are resolved by provenance and chronology first; the two left without an authoritative answer were closed by the PO decision freeze of 06/10 (PD-5, PD-6). BUSINESS_DECISION_BLOCKED = 0.

## Chronology

| Source | Date | Provenance |
|---|---|---|
| DEC-WF01-S07, DEC-WF02 (H1–H13), DEC-WF02-S05, DEC-WF02-S07 | 26/09 | "HUMAN APPROVED — P0" |
| DEC-L1R, DEC-L2R, DEC-PDF | 29/09 | PO task / PO answers of 29/09 (DEC-PDF "for Internal Alpha") |
| Sprint 1 UAT pack (+ feedback list) | 02/10 | PO-issued; Appendix B "Quyết định đã áp dụng"; file created 02/10 10:42, first cited in repo 02/10 (`fb2130f`) |
| DEC-ADM (PD-1…PD-8) | 04/10 | PO approved (ADMIN-DECISION-01), stated verbatim in the ADMIN-PROD-01 contract; PD-1/3/4 were raised by ADMIN-PORTAL-00 against the UAT text |
| DEC-W6P (D1–D4) | 04/10 | PO explicitly confirmed (WF06-PROD-01-FIX / -FINAL-REFREEZE) |
| DEC-S1A, DEC-S1P, DEC-S1F, DEC-S1H; DEC-S1I (S1-UAT-07 branch) | 05/10 | PO decisions recorded on the Sprint 1 task contracts |
| PD-5, PD-6 (Sprint 1 UAT freeze, below) | 06/10 | explicit PO decision, authoritative for Sprint 1 UAT |

Rule applied: the latest explicit PO source governs; an older freeze is SUPERSEDED for Sprint 1 where the UAT pack states the behaviour (the practice already used by DEC-S1A, DEC-S1F-D1, DEC-S1P-D3).

## Groups

| # | Group · AC | UAT rule (02/10) | Conflicting rule (date) | Latest explicit PO decision | Final classification | PO decision still required |
|---|---|---|---|---|---|---|
| 1 | Existing e-mail at sign-up · US-01.02-AC02 | AUTH4 "Email này đã gắn…" + Đăng nhập | DEC-S1A-D11 neutral answer (05/10) | DEC-S1A-D11 (05/10) | READY (implemented and tested per D11) | NO — amend UAT wording |
| 2 | Bước 3 minimum role · US-01.10-AC02 | ≥ 1 role (App. B) | DEC-L1R-D5 none required (29/09) | UAT (02/10) | IMPLEMENTATION_PENDING (unassigned) | NO |
| 3 | Public profile / Xem như / URL · US-01.12-AC05, US-02.01-AC01/02/04, US-02.06-AC02/03, US-02.07-AC04, US-02.08-AC02 | public profile, "Xem như Guest", slug URL + redirect, LinkedIn public | DEC-WF02-H3 (26/09), DEC-L2R-D2 (29/09) | UAT (02/10); DEC-W6P (04/10) is WF06-scoped and declares Sprint 1 "its own lane" | IMPLEMENTATION_PENDING (unassigned; slug migration) | NO, except US-02.06-AC01 / AC04 below |
| 3a | Library member card · US-02.06-AC01 | "Thẻ của tôi trong Thư viện … Google tìm thấy được" | DEC-W6P-D01 "Member directory NO … no new route, page" (PO 04/10) | PD-5 (PO 06/10) | IMPLEMENTATION_PENDING (unassigned) | NO — frozen by PD-5 |
| 3b | "Quỹ đã xác minh" view · US-02.06-AC04 | 3 audiences incl. verified fund | no source defines a verified fund (no status, no flow; org profiles out of scope, App. D) | PD-6 (PO 06/10) | IMPLEMENTATION_PENDING (unassigned) | NO — frozen by PD-6 |
| 4 | Completion cards · US-01.13-AC03 | 2 cards (bài toán, Lập hồ sơ đội) | DEC-L1R-D7 card not drawn (29/09) | UAT (02/10); Library "Bài toán" tab exists (DEC-W6P-D02) | IMPLEMENTATION_PENDING (unassigned) | NO |
| 5 | Certificates · US-02.04-AC02/03 | certificate, "Không hết hạn", date checks | DEC-L2R-D2 not drawn (29/09) | UAT (02/10) | IMPLEMENTATION_PENDING (unassigned; migration) | NO |
| 6 | System-recorded sections · US-02.05-AC01…03 | badges, Dự án trên HUB, Tiến trình | DEC-L2R-D2 (29/09), DEC-WF02-H2/H5 (26/09) | UAT (02/10); data must be real (no fake activity) | IMPLEMENTATION_PENDING (unassigned) | NO |
| 7 | Contact purposes · US-02.07-AC01/02 | 4 purposes, default off | DEC-WF01-S07-D3, DEC-WF02-H4 (26/09) | UAT (02/10) | IMPLEMENTATION_PENDING (unassigned; consent model) | NO |
| 8 | Sole owner account deletion · US-02.08-AC03 | blocked, transfer first | DEC-WF02-S07-G3 always available (26/09) | UAT (02/10); DEC-ADM-PD7 (04/10) covers processing only | IMPLEMENTATION_PENDING (unassigned) | NO |
| 9 | Mã số doanh nghiệp · US-02.10-AC02/05 | required, unique | DEC-ADM-PD3 website + logo, no tax code (04/10) | DEC-ADM-PD3 (04/10, raised against UAT L1344) | AC02 IMPLEMENTATION_PENDING (website, S1-UAT-06); AC05 OUT_OF_SCOPE (superseded) | NO — amend UAT wording |
| 10 | PRJ3 summary · US-02.13-AC01/03 | "x/48 trường"; 3 cards | DEC-PDF-D3 no count, DEC-PDF-D1 (29/09) | UAT (02/10) | AC01 PO_CONTENT_PENDING (no source lists the 48 fields); AC03 IMPLEMENTATION_PENDING (S1-UAT-06) | NO (content, not decision) |
| 11 | Venture tabs · US-02.15-AC01 | 6 named tabs, traction editable | DEC-WF02-H6 (26/09, itself SUPERSEDED) | UAT (02/10) | PO_CONTENT_PENDING (tab fields undefined) | NO (content) |
| 12 | Project → Startup · US-02.15-AC03 | allowed, same record, no reverse (App. B) | DEC-WF02-S05-G4 (26/09), DEC-L2R-D4 (29/09) type fixed | UAT (02/10); no later decision | IMPLEMENTATION_PENDING (S1-UAT-06) | NO |

Other reconciled rows: US-02.11-AC01 — DEC-S1I-D5 (PO 05/10) is newer than the UAT; the "chưa có tài khoản" note is not shown; stays IMPLEMENTATION_PENDING under the S1-UAT-07 rule. US-02.10-AC01 — UAT stage labels (02/10) supersede DEC-PDF-D5 (29/09); a S1-UAT-06 change, not asserted by that AC.

## PO decision freeze (06/10/2026)

Explicit PO decisions answering Q1 and Q2 of the final pass; authoritative for Sprint 1 UAT; they supersede the conflicting older notes named below for Sprint 1 only. Not to be confused with DEC-ADM-PD5 (feedback) and DEC-ADM-PD6 (delegation) of 04/10, which are unchanged.

| ID | Topic · AC | Decision | Supersedes for Sprint 1 |
|---|---|---|---|
| PD-5 | "Thẻ của tôi trong Thư viện" · US-02.06-AC01 | No Library-specific visibility setting. The card reuses the canonical "Hiển thị hồ sơ trong Mạng lưới" state. ON: the profile is eligible for Library, Network and Search under the existing canonical visibility / query rules. OFF: absent from Library, Network and Search; direct public access follows the existing hidden-profile behaviour. No new flag, DB field or Library-specific privacy model. | the Q1 conflict with DEC-W6P-D01 "Member directory NO" (04/10) for the Sprint 1 card; WF06 runtime rules otherwise unchanged |
| PD-6 | "Xem như Quỹ đã xác minh" · US-02.06-AC04 | A preview mode only. No verified-fund privilege, role, capability, AccessGrant rule, investor behaviour or schema. It obeys canonical visibility, consent / privacy and profile-safe DTO rules and never exposes e-mail, phone, private profile fields, private team / application data, investor-only data, or any capability granted because the viewer is a fund. Without a distinct verified-fund viewer context it behaves as the safest authenticated / public member view until an investor access model is approved. | the Q2 gap ("Quỹ đã xác minh" undefined) |

TRUE_PO_DECISIONS_REMAINING = 0.

PO content (not decisions): the list of 48 venture fields (US-02.13-AC01, ME7 / PRO1 counters) and the fields of the 6 venture tabs (US-02.15-AC01, US-02.16-AC01). Legal note, not a block: the UAT default "Hiện" with Google indexing vs Privacy v1.0 "thông tin bạn chọn công khai" should be confirmed by LEGAL before the public profile ships (PD-5 keeps the canonical switch; it does not settle the default).

## Related

- [overview](overview.md)
- [readiness-gaps](readiness-gaps.md)
- [DECISION_LOG](../../decisions/DECISION_LOG.md)
