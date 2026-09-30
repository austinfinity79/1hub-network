# J5 Programme

Journey 5 — Programme / Challenge, using the production programme **Chương trình ươm tạo (demo)** `d4000000-0000-0000-0000-000000000001` (PUBLISHED, Chapter 01). FUTURE operator screens (L28–L36) are not part of this journey.

### J5-01 · Founder sees the open programme
| Field | Value |
|---|---|
| Persona · account | Venture owner · your own account or `member@example.test` |
| Start URL | `/projects` → sidebar "Dự án & Startup · Demo" (`/demo/projects`) |
| Preconditions | onboarding complete |
| Steps | 1. Open "Dự án & Startup · Demo". 2. Find "Chương trình đang mở" |
| Expected UI | exactly one row "Chương trình ươm tạo (demo)" with its organiser (Chapter 01), dates, "Dành cho: Đội, Startup" and "Đăng ký" |
| Expected route | `/demo/projects` |
| Expected data / state | read only |
| Permission | every onboarded member sees open programmes |
| Negative | the DRAFT "Demo Challenge" never appears |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J5-02 · Programme detail from a venture
| Field | Value |
|---|---|
| Persona · account | same |
| Start URL | `/demo/projects` → your venture |
| Preconditions | you own a venture |
| Steps | 1. Open the venture. 2. Read its programme row |
| Expected UI | the programme with eligibility for this venture; "Đăng ký" (no application yet), "Tiếp tục" (draft) or "Xem đơn" (submitted) |
| Expected route | `/demo/projects/<venture id>`; "Đăng ký" → `/projects/<venture id>/applications/d4000000-0000-0000-0000-000000000001` |
| Expected data / state | opening the detail creates nothing |
| Permission | eligibility is decided by the server (owner, venture not archived, accepted type) |
| Negative | as an ACTIVE team member (persona 5) the row says only the owner can apply; no "Đăng ký" |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J5-03 · Founder starts an application
| Field | Value |
|---|---|
| Persona · account | same |
| Start URL | "Đăng ký" on J5-01 or J5-02 |
| Preconditions | none |
| Steps | click "Đăng ký" |
| Expected UI | no venture → "Tạo nhanh hồ sơ đội"; one venture → its form; several → "Chọn hồ sơ đội để nộp" |
| Expected route | `/programmes/d4000000-0000-0000-0000-000000000001/apply` → the form |
| Expected data / state | nothing saved until the first answer is saved (J6) |
| Permission | owner only |
| Negative | a guest opening the same URL is sent to `/auth` |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | Leaders may also open the WF04 operator demo (`/demo/programmes`): edits there live in the browser session only; "Đặt lại demo" clears them. Not required |

## Related
- [j6-application.md](j6-application.md) · [j4-chapter-ops.md](j4-chapter-ops.md)
