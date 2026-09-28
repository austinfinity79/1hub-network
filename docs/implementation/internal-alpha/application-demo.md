# Application Demo

| Field | Value |
|---|---|
| Flow ID | **FLOW 6 · WF-TEST-06** — Founder / Project → programme application |
| Purpose | WF05 end to end: open the canonical Project / Startup, view an eligible programme, start, save and resume a draft, review, submit, read-only after submit |
| Classification | **DEMO / INTERNAL ALPHA** for the application. The venture and the programme list are real; the application lives only in this browser tab (accepted WF05 demo contract) |
| Actor | D Project / Startup owner; E team member and I unrelated (negative) |
| Account | `member@example.test`; the Flow 3 invitee; `pending@example.test` |
| Precondition | Flow 3 done (your PROJECT and its ACTIVE member exist); start from a clean demo (reset C) |
| Starting URL | https://1hubnetwork.io.vn/me → sidebar "Dự án & Startup · Demo" |
| Time | 20 min |

## Steps
| # | Action (as owner) | Expected result | Route |
|---|---|---|---|
| 1 | "Dự án & Startup · Demo" | Banner; "Dự án / Startup của tôi" lists Demo Startup and your PROJECT (count them); "Chương trình đang mở" lists only **Chương trình ươm tạo (demo)** | `/demo/projects` |
| 2 | "Demo Startup" | "Thông tin", "Đội", "Chương trình đang mở"; "Sửa hồ sơ", "Xem đội", "Đăng ký" | `/demo/projects/<id>` |
| 3 | "Đăng ký" | "Đăng ký: Chương trình ươm tạo (demo)"; "Đăng ký với tư cách: **Startup**"; 2 questions; "Lưu nháp", "Rà soát & nộp" | `…/applications/<programme>` |
| 4 | Answer question 1 only → "Lưu nháp" | Saved as a draft | same |
| 5 | Refresh | Answer 1 is still there (resume) | same |
| 6 | "Rà soát & nộp" | "Rà soát đơn: …"; the missing answer is flagged; "Nộp đơn" disabled | `…/review` |
| 7 | Back → answer question 2 → "Rà soát & nộp" → "Nộp đơn" | "Đã nộp"; read only; no second "Nộp đơn" | `…/review` |
| 8 | "← Dự án & Startup" | Demo Startup shows "Đã nộp"; **the venture list has the same entries as in step 1** (no new venture) | `/demo/projects` |
| 9 | Open your PROJECT → "Đăng ký" | "Đăng ký với tư cách: **Đội**" | `…/applications/<programme>` |
| 10 | "← Dự án & Startup" → "Demo Startup" → "Sửa hồ sơ" | Opens the same WF02 editor as in Flow 3: the application reuses the canonical venture | `/projects/<id>/edit` |
| 11 | Back → "Đặt lại demo" → "Đặt lại" | Applications cleared; "Đăng ký" available again; ventures and programmes unchanged | `/demo/projects/<id>` |

## Negative checks
| Actor | Action | Expected |
|---|---|---|
| Invitee (E) | "Dự án & Startup · Demo" → your PROJECT | No "Đăng ký"; "Chỉ chủ sở hữu đăng ký được." |
| `pending@` | Open https://1hubnetwork.io.vn/demo/projects/50000000-0000-0000-0000-000000000001 | "Không tìm thấy trang" |
| Owner | Look for "Thử thách đổi mới (demo)" | Never listed as open (it is a draft) |
| Owner | After step 7 reopen the application; refresh; back | Still one application, "Đã nộp"; no submit button |

## Reset procedure
Reset C: "Đặt lại demo" → "Đặt lại" (step 11), or close the private window (reset A). Ventures are real and stay.

## PASS criteria
The application uses the existing venture (no duplicate is created); a STARTUP applies as "Startup" and a PROJECT as "Đội"; drafts resume after refresh; review blocks an incomplete application; submit happens once and is then read only; a team member, an unrelated user and a draft programme cannot apply.

## Known Internal Alpha limitation
**DEMO**: the application is not stored, not sent to the organiser and not visible in another window. An archived venture cannot be tested (no archive action in the product). Investor / VC / dataroom features are FUTURE.

## Related
- [programme-demo.md](programme-demo.md) — previous · [../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — checklist
