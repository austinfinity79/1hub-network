# Application Demo

**WF-TEST-06 — Founder / Project / Startup → programme → application draft → review → submit** · **DEMO / INTERNAL ALPHA**: the venture and the programme are real; the application exists only in your browser tab (not sent to the organiser, not stored). This follows the accepted WF05 demo contract.

| Preconditions | Account to use | Starting URL | Expected duration | Reset required before run |
|---|---|---|---|---|
| WF-TEST-03 done: your PROJECT "Dự án UAT …" and its ACTIVE member exist. Links for `member@`, the invitee and `pending@` | `member@example.test` (owner of Demo Startup and your PROJECT) | https://1hubnetwork.io.vn/me → "Dự án & Startup · Demo" | 20 min | YES: "Đặt lại demo" → "Đặt lại" |

| Step | Actor | Action | Expected UI / result | Expected route / state | PASS / FAIL | Notes |
|---|---|---|---|---|---|---|
| 1 | Owner | Sidebar "Dự án & Startup · Demo" | Banner; "Dự án / Startup của tôi" lists Demo Startup and your PROJECT; "Chương trình đang mở" lists only **Chương trình ươm tạo (demo)** | `/demo/projects` | ☐ PASS ☐ FAIL | The DRAFT challenge is absent |
| 2 | Owner | "Demo Startup" | "Thông tin", "Đội", "Chương trình đang mở"; "Sửa hồ sơ", "Xem đội", "Đăng ký" | `/demo/projects/<id>` | ☐ PASS ☐ FAIL | Eligible venture |
| 3 | Owner | "Đăng ký" | "Đăng ký: Chương trình ươm tạo (demo)"; "Đăng ký với tư cách: **Startup**"; 2 questions; "Lưu nháp", "Rà soát & nộp" | `…/applications/<programme>` | ☐ PASS ☐ FAIL | STARTUP → Startup |
| 4 | Owner | Answer question 1 only → "Lưu nháp" | Saved as a draft | same | ☐ PASS ☐ FAIL | Partial answers allowed |
| 5 | Owner | Refresh | Answer 1 still there | same | ☐ PASS ☐ FAIL | Resume |
| 6 | Owner | "Rà soát & nộp" | "Rà soát đơn: …"; the checklist flags the missing answer; "Nộp đơn" disabled | `…/review` | ☐ PASS ☐ FAIL | |
| 7 | Owner | Back → answer question 2 → "Rà soát & nộp" → "Nộp đơn" | Status "Đã nộp"; read only; no second "Nộp đơn" | `…/review` | ☐ PASS ☐ FAIL | Submit once |
| 8 | Owner | "← Dự án & Startup" | Demo Startup shows "Đã nộp" | `/demo/projects` | ☐ PASS ☐ FAIL | |
| 9 | Owner | Open your PROJECT → "Đăng ký" | "Đăng ký với tư cách: **Đội**" | `…/applications/<programme>` | ☐ PASS ☐ FAIL | PROJECT → Team |
| 10 | Owner | "Đặt lại demo" → "Đặt lại" | Applications cleared; "Đăng ký" available again; ventures and programmes unchanged | `/demo/projects/<id>` | ☐ PASS ☐ FAIL | Reset |

## Negative checks
| Check | Actor | Action | Expected | PASS / FAIL |
|---|---|---|---|---|
| ACTIVE team member cannot apply | Invitee (WF-TEST-03) | "Dự án & Startup · Demo" → your PROJECT | No "Đăng ký"; "Chỉ chủ sở hữu đăng ký được." | ☐ |
| Unrelated user | `pending@` | Open https://1hubnetwork.io.vn/demo/projects/50000000-0000-0000-0000-000000000001 | "Không tìm thấy trang" | ☐ |
| DRAFT programme not eligible | Owner | Look for "Thử thách đổi mới (demo)" | Never listed as open; cannot be applied to | ☐ |
| No duplicate submission | Owner | After step 7, reopen the application; press refresh / back | Still one application, "Đã nộp"; no submit button | ☐ |
| Archived venture | — | **NOT TESTABLE in the UI**: Internal Alpha has no archive action (covered by automated tests) | — | — |

## Related
- [programme-demo.md](programme-demo.md) — previous
- [../INTERNAL_ALPHA_UAT_CHECKLIST.md](../INTERNAL_ALPHA_UAT_CHECKLIST.md) — checklist
