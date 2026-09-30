# J6 Application

Journey 6 — startup → application on the server (DRAFT → SUBMITTED, owner only). Use **your own account** so every tester has their own application; `member@example.test`'s Demo Startup can submit only once for everybody.

### J6-01 · Quick team and form
| Field | Value |
|---|---|
| Persona · account | Founder · your own onboarded account |
| Start URL | `/programmes/d4000000-0000-0000-0000-000000000001/apply` |
| Preconditions | no venture yet, or use one of yours |
| Steps | 1. "Tạo nhanh hồ sơ đội": name `UAT <initials> <nn>`, type, field, stage, one line. 2. "Vào phiếu đăng ký" |
| Expected UI | the form opens on "Hiểu đề"; header "Chưa lưu"; steps Hiểu đề · Đội & kế hoạch · Cần hỗ trợ gì |
| Expected route | `/projects/<new id>/applications/d4000000-0000-0000-0000-000000000001` |
| Expected data / state | one new DRAFT venture; **no application yet** |
| Permission | owner |
| Negative | an empty required field is named; nothing is created |
| Reset | new venture next time |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J6-02 · Save a DRAFT
| Field | Value |
|---|---|
| Persona · account | same |
| Start URL | the form |
| Preconditions | J6-01 |
| Steps | 1. Answer question 1. 2. "Tiếp — Đội & kế hoạch". 3. "Tiếp — Cần hỗ trợ gì". 4. Answer question 2 and click outside the box |
| Expected UI | header "Đã lưu lúc HH:MM"; step 03 shows your team read-only; "Còn … việc" drops to "Đủ điều kiện nộp" |
| Expected route | `…?buoc=3`, `…?buoc=4` |
| Expected data / state | exactly one DRAFT application for (venture, programme) |
| Permission | owner only |
| Negative | answers over 2 000 characters are cut at 2 000 |
| Reset | keep editing the same draft |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J6-03 · Reload and resume
| Field | Value |
|---|---|
| Persona · account | same |
| Start URL | a new window / new sign-in |
| Preconditions | a DRAFT with one answer missing |
| Steps | 1. Close the window, sign in again. 2. `/demo/projects` → the venture → "Tiếp tục" |
| Expected UI | the form opens on the first unanswered step with saved answers in place |
| Expected route | the form URL |
| Expected data / state | the same draft (no second one) |
| Permission | owner |
| Negative | none |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J6-04 · Review and submit
| Field | Value |
|---|---|
| Persona · account | same |
| Start URL | "Soát lại trước khi nộp" |
| Preconditions | both questions answered |
| Steps | 1. Check both answers, "Sửa" links, the attached venture. 2. "Nộp hồ sơ" (a quick double click is fine) |
| Expected UI | "Đã nhận hồ sơ của bạn"; "Xem hồ sơ đã nộp" shows the answers; the venture row says "Đã nộp" / "Xem đơn" |
| Expected route | `…/review` → `…/submitted` |
| Expected data / state | exactly **one** SUBMITTED application; a snapshot of the answers and team |
| Permission | owner |
| Negative | with an answer missing "Nộp hồ sơ" stays disabled |
| Reset | SUBMITTED is final: a new venture to apply again |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J6-05 · Protected after submit; others refused
| Field | Value |
|---|---|
| Persona · account | the founder, then a second tester / `pending@example.test`, then persona 5 |
| Start URL | the founder's form URL |
| Preconditions | J6-04 done |
| Steps | 1. Founder: open the form URL and `…/review` again. 2. Another account: open the same URLs. 3. The venture's ACTIVE team member: same |
| Expected UI | founder: always the read-only submitted view, no text box; others: not-found page |
| Expected route | founder → `…/submitted`; others → not-found |
| Expected data / state | nothing changes; still one SUBMITTED |
| Permission | owner only (team members, organisers and admins cannot read it) |
| Negative | changing the venture id in the URL to another's → not-found |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

## Related
- [j5-programme.md](j5-programme.md) · [j8-privacy-security.md](j8-privacy-security.md)
