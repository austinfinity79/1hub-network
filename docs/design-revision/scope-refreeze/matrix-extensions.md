# Matrix Extensions

Screen / Route / Data / Permission matrix — L6 (9 screens). [DEC-2809-D7](overview.md#d7): only Directory or Form screens present in the corrected design are Alpha. Legend as [matrix-homepage-auth.md](matrix-homepage-auth.md).

**Finding:** none of the nine L6 frames is a Directory or a Form (checked frame by frame on the corrected `L6.zip`, `0a2c91f8…fc56`). L6 therefore contributes **0 executable screens**; the PO confirms the list (the 28/09 source asks the team to name them).

| Screen | Route | Actor | Data entities | Permission | Current implementation | Class | Delta | Migration / API | Batch |
|---|---|---|---|---|---|---|---|---|---|
| L46 WS1 Phòng làm việc | none | team / org / HUB | booking, availability, inventory (none) | — | none | FUTURE (Workspace) | — | — | — |
| L47 EV1 Chi tiết sự kiện (đối tác) | none | guest / member | Event | public | none | FUTURE (standalone Event Detail; must reuse the canonical Event, no second model) | — | — | — |
| L48 SP1-T2 Traction & Gọi vốn | none | guest | none (no fields) | public | none | FUTURE (Startup tab) | — | — | — |
| L49 SP1-T3 Đội ngũ | none | guest | ProjectMember (public) | public | none | FUTURE (Startup tab) | — | — | — |
| L50 SP1-T4 Rủi ro & Đang cần | none | guest | none | public | none | FUTURE (Startup tabs Risks / Needs) | — | — | — |
| L51 SP1-T6 Tuyển dụng & FAQ | none | guest | none | public | none | FUTURE (Hiring / FAQ) | — | — | — |
| L52 ADM15 Duyệt chapter & CLB mới | none | platform admin | Organization | admin | none (orgs are seeded) | FUTURE (was B / HD-10) | — | — | — |
| L53 ADM17 Danh sách tài khoản | none | platform admin | UserAccount | admin | none | FUTURE (account management; was B / HD-10) | — | — | — |
| L54 SYS1 Trạng thái hệ thống | none (Next default 404; no `error.tsx`) | any | — (maintenance needs telemetry) | public | Next 404 only | FUTURE — the frame is "System Status" (404 / 500 / maintenance). Its earlier Bucket A class and batch 22.7 are **SUPERSEDED** | — | — | — |

**L54 note:** the frame draws three states, and the 28/09 source defers System Status until real telemetry / health checks exist. The plain 404 view already exists; the missing 500 view (`error.tsx`, IA-P3-05) is an open quality item. Whether that 500 view may ship without the L54 design, as a non-revision fix, is HD-A9.

Totals: ALPHA 0 · FUTURE 9.

## Related
- [matrix-application.md](matrix-application.md) · [overview.md](overview.md) · [task-sequence.md](task-sequence.md)
