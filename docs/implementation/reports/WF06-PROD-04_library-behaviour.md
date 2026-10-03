# WF06-PROD-04_library-behaviour

**What `/library` and the organization page now do** (evidence 5 – 16). Parent: [WF06-PROD-04_frontend-integration.md](WF06-PROD-04_frontend-integration.md). Tests: `tests/visual/specs/wf06-prod-library.spec.ts`, realigned `public-library.spec.ts`.

## Data path
| Step | Behaviour |
|---|---|
| first render | the server builds each tab's first page with the same functions as the API (`library-bodies.ts`), for the viewer of the session; no API request on load |
| any keyword, filter or sort change | one `GET /api/v1/library/{tab}` with the page's parameters (fixed order, `limit=9`); a newer request aborts an older one |
| "Xem thêm" | the same request plus the answer's `cursor`; cards appended, duplicates by key dropped |
| browser work | rendering only: no filtering, sorting, paging or visibility decision |

## Tab behaviour (evidence 5 – 13)
| Item | Result |
|---|---|
| canonical / external (5, 13) | Startup lists PUBLIC ACTIVE STARTUP ventures and the external records without a twin; the canonical "WF06 Kho Lạnh" wins; PRIVATE, DRAFT, ARCHIVED and PROJECT never show; canonical cards draw no website button and no member line (no field to draw) |
| founder privacy (6) | members: visible canonical owners (name, short role · startup, startup row as plain text); hidden, deactivated, blocked, nameless and private-only owners absent; guests: "Đăng nhập để xem nhà sáng lập" with a link to `/auth`, no name, no count ("–"), no filter panel |
| filters (7) | facets and counts from the answer; Startup / founders send DOMAIN / VENTURE_STAGE ids (`domain_id`, `stage_id`); Bài toán sends the file's text; quick chips: Bài toán the category labels, Startup / founders the DOMAIN items of the reviewed map (row kept in place, hidden, when none matches); "Xoá tất cả" resets keyword and filters; "Chưa xác định" (no stage) is gone: the API filters by VENTURE_STAGE id only |
| sort (8) | the API's keys: Startup "Giai đoạn phát triển" (STAGE) / "Tên A–Z" (NAME), founders "Tên A–Z", Bài toán "Sắp hết hạn" / "Giải thưởng cao nhất"; no relevance or recommendation wording |
| pagination (9) | first page 9; "Xem thêm N" from `total`; last page removes the button; no duplicate card; a refused next page keeps the cards and offers "Chưa tải được, thử lại (N …)" |
| loading / empty / error (10) | loading: the grid stays, dimmed, `aria-busy`, count "Đang tải…" (no blank, no spinner); empty: "Không có … nào khớp bộ lọc." + "Xoá tất cả bộ lọc"; error: "Chưa tải được danh bạ" + "Thử lại" (re-asks the API); a failed first read on the server renders the same error state, never a 5xx; no raw JSON or envelope shown |
| external failure (11) | server started with an unreachable feed: API `degraded: true`, the page lists the canonical startups, no external card, no error state; log line carries the error class only |
| organization page (12) | WF03 page unchanged except the children heading, which now shows the total (`stats.children`) while the list holds the first 200 by name; DRAFT child absent; canonical slugs only |

## URL, session and cache (evidence 14 – 16)
| Item | Result |
|---|---|
| URL (14) | only `?q=` is URL state (as before): refresh keeps it, the homepage search → `/library?q=` and Back work (`alpha-interaction-gaps`); tabs, filters and pages are not added to the URL (no new behaviour); no id in any URL |
| guest / member (15) | guest → sign-in state; a member session → founders on reload; sign-out → Back to `/library` shows the sign-in state and no founder name anywhere in the page; the founder API answers `restricted` for the revoked session |
| client cache (16) | none added: answers live in this page view's state only; requests `cache: 'no-store'`; API `Cache-Control: private, no-store`, `Vary: Cookie`; no localStorage / sessionStorage |

## Copy changes (no new product behaviour)
| Place | Before → after | Why |
|---|---|---|
| Startup search placeholder | "… lĩnh vực hoặc nhà sáng lập…" → "Tìm theo tên startup, sản phẩm hoặc lĩnh vực…" | founder names are not searchable (DEC-W6P-D03) |
| founder search placeholder | "… vai trò, startup…" → "Tìm theo tên nhà sáng lập hoặc startup…" | the API searches name and listed startups |
| founder tab, guest | — → "Đăng nhập để xem nhà sáng lập" / "Thông tin nhà sáng lập chỉ dành cho thành viên đã đăng nhập." / "Đăng nhập" | the frozen permission state; existing `.soon` block style; copy for PO / design review |

## Related
- [WF06-PROD-04_qa-evidence.md](WF06-PROD-04_qa-evidence.md) · [WF06-PROD-03_query-behaviour.md](WF06-PROD-03_query-behaviour.md)
