# Matrix Chapter

Screen / Route / Data / Permission matrix — L3 (9 screens). [DEC-2809-D3](overview.md#d3): executable Alpha capability = **dashboard, chapter information management, member approval**; the rest is Future unless independently approved. Legend as [matrix-homepage-auth.md](matrix-homepage-auth.md).

| Screen | Route | Actor | Data entities | Permission | Current implementation | Class | Delta | Migration / API | Batch |
|---|---|---|---|---|---|---|---|---|---|
| L19 CHP0 Trang chapter công khai | `/organizations/[slug]` | guest | Organization (public projection), children counts, published events | public | WF03-S09, 22.4 restyle | ALPHA — independently approved (WF03-S09, P0 CLOSED); public discovery page. PO confirm (HD-A2) | — | — | 22.4 done |
| L20 CHP1 Bảng điều khiển | `/ops/org/:id` | leader, admin | Organization, aggregates only | `org:read` | WF03-S02, 22.4 restyle | **ALPHA** (dashboard) | — | — | 22.4 done |
| L21 CHP2 Trình soạn summit | none | leader | — | — | none | FUTURE | — | — | — |
| L22 CHP3 Người đăng ký | none | leader | EventRegistration (foundation only) | — | none | FUTURE | — | — | — |
| L23 CHP4 Sự kiện của chapter | `/ops/org/:id/events` | leader, admin | Event (standalone) | `event:manage` | WF03-S07, 22.4 restyle | ALPHA — independently approved (WF03-S07, P0 CLOSED). PO confirm (HD-A2) | — | — | 22.4 done |
| L24 CHP5 Vòng loại khu vực | none | leader | — | — | none | FUTURE | — | — | — |
| L25 CHP6 Gửi mail chiến dịch | none | leader | — (no email provider) | — | none | FUTURE | — | — | — |
| L26 CHP7 Thành viên & duyệt | `/ops/org/:id/members` (+ `/members/:profileId`) | leader, admin | CommunityMembership, LeadershipRecord, discovery projection | `member:read`; review `membership:confirm` | WF03-S03 / S04, 22.4 tabs + inline review | **ALPHA** (member approval) | — | — | 22.4 done |
| L27 CHP8 Chuyển giao người đứng đầu | none | head + successor | LeadershipRecord | — | none | FUTURE (was B / HD-10) | — | — | — |

**Chapter information management** has no L3 frame. It runs today as WF03-S06 `/ops/org/:id/profile` (`org:manage`, P0 CLOSED) and stays as is; L14 ORGP1 is the only related corrected frame and is Bucket B (HD-08). Whether a subset of L14 should restyle S06 is HD-A2.

Totals: ALPHA 4 (L20, L26 by D3; L19, L23 independently approved) · FUTURE 5. 22.4 changed no behaviour, so nothing implemented in 22.4 conflicts with D3.

## Related
- [matrix-member.md](matrix-member.md) · [matrix-programme.md](matrix-programme.md)
- [../../decisions/DECISION_LOG.md](../../decisions/DECISION_LOG.md#dec-l3-d1) — DEC-L3 (TASK 22.4)
