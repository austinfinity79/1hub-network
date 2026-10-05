# Business decisions

The 27 BUSINESS_DECISION_BLOCKED AC, grouped by the decision the PO must make. In each case the UAT pack and a frozen decision disagree; nothing here is resolved by assumption. Closing a group means either amending the UAT expectation or reopening the frozen decision (then an implementation task).

| # | Topic | UAT expects | Frozen decision says | AC |
|---|---|---|---|---|
| 1 | Sign-up with an existing e-mail | AUTH4 "Email này đã gắn với một tài khoản khác" + Đăng nhập | DEC-S1A-D11 (PO 05/10): neutral "Không thể tạo tài khoản với thông tin này…" (no enumeration) | US-01.02-AC02 |
| 2 | Bước 3 roles | at least 1 role (Appendix B) | DEC-L1R-D5: six roles, multi-select, none required | US-01.10-AC02 |
| 3 | Public profile, "Xem như", public URL | other users / guests open the profile; "Xem như Guest"; slug URL with redirect; 3 audiences | DEC-WF02-H3 "No guest/public profile in P0"; DEC-L2R-D2 not drawn: public URL, "Xem như Guest"; DEC-W6P-D01 member directory NO | US-01.12-AC05, US-02.01-AC01/02/04, US-02.06-AC01…04, US-02.07-AC04, US-02.08-AC02 |
| 4 | Completion screen cards | 2 cards when no HUB position | DEC-L1R-D7: the challenge card has no production route and is not drawn | US-01.13-AC03 |
| 5 | Certificates | certificate with "Không hết hạn" and date checks | DEC-L2R-D2: certificates not drawn | US-02.04-AC02/03 |
| 6 | System-recorded sections | badges, "Dự án trên HUB", "Tiến trình phát triển" | DEC-L2R-D2 not drawn; DEC-WF02-H2/H5 activity journal future | US-02.05-AC01…03 |
| 7 | Contact consent purposes | 4 purposes, default off, summary sentence | DEC-WF01-S07-D3 future purposes not implemented; DEC-WF02-H4 | US-02.07-AC01/02 |
| 8 | Sole owner closing the account | blocked, "Chuyển giao" first | DEC-WF02-S07-G3: the request is enabled for every member | US-02.08-AC03 |
| 9 | Mã số doanh nghiệp | required for Startup, unique | DEC-ADM-PD3: website and logo only, no business registration / tax code | US-02.10-AC02/05 |
| 10 | PRJ3 summary | "Hồ sơ x/48 trường"; 3 buttons incl. "Xem như" | DEC-PDF-D3 no field count; DEC-PDF-D1 / DEC-WF02-H3 no public venture path | US-02.13-AC01/03 |
| 11 | Venture 6-tab content | Biên tập edits traction etc. | DEC-WF02-H6: other A–J fields not in P0; no field definition in UAT or SOT | US-02.15-AC01 |
| 12 | Project → Startup conversion | allowed, same record (Appendix B) | DEC-WF02-S05-G4: type fixed at creation | US-02.15-AC03 |

Total: 1 + 1 + 10 + 1 + 2 + 3 + 2 + 1 + 2 + 2 + 1 + 1 = 27.

## Conflicts recorded on other rows

| AC | Status | Conflict |
|---|---|---|
| US-02.11-AC01 | IMPLEMENTATION_PENDING (S1-UAT-07 rule) | UAT row note "chưa có tài khoản" vs DEC-L2R-D8 and DEC-S1I-D5 on the S1-UAT-07 branch (PO 05/10: not shown, privacy) |
| US-02.10-AC01 | READY | stage labels: UAT "Ý tưởng · Prototype · Pilot · Đang bán · Đã mở rộng" vs repo "Ý tưởng, MVP, Pilot / Thử nghiệm, Đang bán, Tăng trưởng" (DEC-PDF-D5) |
| US-01.11-AC06 | IMPLEMENTATION_PENDING | UAT allows two terms in one Chapter; today one claim per unit (DEC-L1R-D5), superseded only when the PD-1 request model ships (S1-UAT-03B) |

## Related

- [overview](overview.md)
- [readiness-gaps](readiness-gaps.md)
- [DECISION_LOG](../../decisions/DECISION_LOG.md)
