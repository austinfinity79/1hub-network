# L6 Ecosystem Features

TASK 24.5 feature classes for the nine L6 frames ([l6-ecosystem-inventory.md](l6-ecosystem-inventory.md)). A search / browse / filter / directory · B explicit user action · C matching / ranking / recommendation · D future / vision. Rule of the task: build A and approved B; C only with an approved rule and data contract; D never.

## Features
| Feature | Frame | Class | Data today | Approved | Result |
|---|---|---|---|---|---|
| Account search (name / email / organisation) | L53 | A (admin) | email, status, region, roles exist | no: account list Future (DEC-2809-D7) | DEFER |
| Filters Chưa xác thực · Đang bị khoá · Tỉnh · Vai trò HUB | L53 | A (admin) | no "unverified" state (login proves the address); BLOCKED, region, roles exist | no | DEFER |
| Browse the chapter's next events | L47 | A | PUBLISHED standalone events per organisation (WF03-S09) | shown on `/organizations/:slug`; the L47 page is Future | NOT ADDED (already on L3) |
| Startup cover (tags, founded, location, team size) | L48–L51 | A (entity preview) | canonical Venture has name, summary, stage, domains, region; no founded year or FTE count | no: startup tabs Future; PUBLIC grants no read (DEC-PDF-D1) | DEFER |
| Startup tabs: traction, rounds, team, risks, needs, jobs, FAQ | L48–L51 | A | no fields (team: no public read) | no | DEFER |
| Đăng ký dự · Xác nhận dự · Vào danh sách chờ · Thêm vào lịch | L47 | B | no event registration or waitlist entity | no | DEFER |
| Ủng hộ startup này · 142 lượt ủng hộ | L48–L51 | B | no support capability or count | no | DEFER |
| Yêu cầu xem data room | L48–L51 | B / D | no data room | no (Future, matrix "dataroom") | DEFER |
| Ứng tuyển | L51 | B | no job entity | no | DEFER |
| Duyệt & gán người đứng đầu · Từ chối · Trả lời người đề xuất | L52 | B (admin) | no organisation proposal | no | DEFER |
| Xuất CSV | L53 | B (admin) | — | no | DEFER |
| Workroom tasks, sandbox access, commitments, room log | L46 | B / D | none | no (Workspace Future) | DEFER |
| "Hồ sơ đã qua duyệt của HUB" (HUB verification) | L48–L51 | C | no verification record; publication has no review (DEC-PDF-D1) | no | DEFER |
| Jury scores, weights, "Qua vòng · 7,8/10", "nhóm 5 đội dẫn đầu" | L46 | C | no scoring or judging | no (judging excluded, DEC-2909) | DEFERRED — MATCHING LOGIC NOT DEFINED |
| Parent-chapter suggestion "cách 60km" | L52 | C | no distance or geography | no | DEFERRED — MATCHING LOGIC NOT DEFINED |
| System status 404 / 500 / maintenance | L54 | D | no telemetry | no (HD-A9 default) | DEFER |

## Matching
**MATCHING ENGINE: DEFERRED.** No approved algorithm, ranking, weighting, fit score, recommendation or verification contract exists, and no frame draws a match list: the only computed outcomes on the board are jury scores (L46), a distance hint (L52) and a HUB approval badge (L48–L51), all without a rule or data. Nothing scores, ranks or recommends.

## CTAs with a real route today
| Drawn CTA | Real route | Where it lives |
|---|---|---|
| Xem lịch sự kiện của chapter | `/organizations/:slug` (upcoming events) | L3 public page |
| Về Thư viện bài toán | `/library` | L2 |
| Xem hồ sơ, Xem startup, Kết nối, Theo dõi | none (no public profile or venture path; no connect or follow capability) | not built |

## Related
- [l6-ecosystem-inventory.md](l6-ecosystem-inventory.md) · [../../design-revision/scope-refreeze/matrix-extensions.md](../../design-revision/scope-refreeze/matrix-extensions.md)
