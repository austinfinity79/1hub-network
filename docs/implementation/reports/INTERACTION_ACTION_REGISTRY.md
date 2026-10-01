# Interaction Action Registry

**01/10/2026.** Full audit of `be5c0cc3e30f` (the SHA on https://1hubnetwork.io.vn), then **updated after the P3 UX cleanup** (local commit on `be5c0cc`, not pushed or deployed): the affected screens were re-audited and every changed element re-classified. One row per element group with every field: [INTERACTION_ACTION_REGISTRY.csv](INTERACTION_ACTION_REGISTRY.csv) (965 rows, after state).

## Summary

Total interactive elements: **1351** (965 element groups; 74 page states + 4 tab states; 13 personas). INTENTIONAL_NON_CLICKABLE items are display text counted so they are not mistaken for gaps.

| Status | Before cleanup | After cleanup | Groups (after) |
|---|---:|---:|---:|
| PASS | 1215 | 1219 | 878 |
| NO_ACTION | 93 | 0 | 0 |
| WRONG_ACTION | 0 | 0 | 0 |
| WRONG_ROUTE | 0 | 0 | 0 |
| WRONG_EXTERNAL_LINK | 0 | 0 | 0 |
| MISLEADING_UI | 3 | 3 | 2 |
| MISSING_BUSINESS_DECISION | 8 | 4 | 2 |
| INTENTIONAL_NON_CLICKABLE | 13 | 18 | 14 |
| DEFERRED | 19 | 107 | 69 |
| BROKEN | 0 | 0 | 0 |

Issues (every status except PASS, INTENTIONAL_NON_CLICKABLE, DEFERRED): **7 elements, 2 distinct findings**. Severity: P0 0 · P1 0 · P2 0 · P3 2.

| Method | What |
|---|---|
| Inventory | local production build of `be5c0cc` with the deterministic seed; links, buttons, tabs, menus, inputs, selects, disclosures, focusable regions, pointer-cursor elements, `aria-disabled` items, Library tab states |
| Re-audit (P3 cleanup) | the 18 affected page states (`/`, `/about`, `/library` states, the account and workspace shells, the 404 pages) inventoried and probed again; every inert item clicked and measured (opacity, cursor, focus); unaffected states keep the first run |
| Behaviour | every non-link control clicked on a fresh load (navigation, request, dialog, state, feedback); every internal href fetched with the persona's session; external hrefs fetched; anchors resolved; 83 inert items and plain labels clicked one by one (all: nothing) |
| Checked by hand | 5 About footer anchors (the automated click is blocked by the sticky reveal footer; a user click at the page end scrolls to `#su-menh`), the file choosers ("Tải ảnh lên", "Đổi ảnh": open), the Library keyword chip, the 404 pages, the account-shell look of inert vs working items (computed colour and class) |
| Production | first run only (the cleanup is not deployed): the 11 public states (`/`, `/about`, `/library`, `/library?q=`, `/auth`, `/auth?redirect=`, three organisation pages, two legal pages) have identical element lists on production and locally; the 30/09 production smoke (50/50) covers search, return-to and menus |
| SOT | DEC-2809-D1 + homepage CTA map, DEC-P0-SHELL-D2, DEC-L15, DEC-L1R, DEC-L2R / DEC-PDF, DEC-L3, DEC-WF04, DEC-L5, DEC-L6-D1, DEC-AIG; where a target is not decided the item is MISSING_BUSINESS_DECISION |

## P0/P1 Issues

None. Every core journey (sign-in and return-to, onboarding, profile, privacy, venture and team, membership, ops review and events, WF04 demo, L5 application) acts as its SOT says.

Previously fixed P1 / P2 items (DEC-AIG), re-verified on `be5c0cc`:

| Item (DEC-AIG) | Now | Evidence |
|---|---|---|
| D1 public "Chương trình" / "Sự kiện" / "Tin tức" | INTENTIONAL_NON_CLICKABLE | plain spans on `/` (4), `/about` (2), `/library` (3); click → nothing; no link of that name |
| D2 "Tạo hồ sơ startup của bạn" | PASS | guest → `/auth?redirect=%2Fprojects%2Fnew`, member → `/projects/new`; production smoke: sign-in returns to `/projects/new` |
| D3 "Hồ sơ đăng ký" → `/demo/projects` | PASS | link, 200 |
| D4 "Mạng lưới" → `/library` | PASS | link, 200 |
| D5 / D10 hero search | PASS | enabled; placeholder "Tìm kiếm trong Thư viện"; keyword → `/library?q=`; blank → no navigation |
| D6 About phone | INTENTIONAL_NON_CLICKABLE | plain span, no `tel:` link |
| D7 "Góp ý" | PASS | not present on any of the 74 screen states |
| D8 Library card actions, homepage "Chi tiết" | PASS | no dead card action on any tab; no "Chi tiết" control; record websites open in a new tab |
| D9 "Thư viện" / "Tổ chức của tôi" / ihub.ventures | PASS | `/library`, `/me/roles`; `https://ihub.ventures` new tab |

## P2 Issues

None.

## P3 / Deferred

Every finding below is P3: the element is secondary, a workaround exists, and no journey is blocked.

### Changed by the P3 UX cleanup (01/10)

PO decisions D1–D7 of the P3 cleanup. D5 (BD-01 sign-up copy) is **not implemented**: no approved sign-up copy exists (see C).

| Screen | Element | Before | After | Classification | Evidence |
|---|---|---|---|---|---|
| `/me/settings`, `/me/privacy`, `/me/roles`, `/demo/projects(/:id)` | "Challenge", "Sự kiện" (header) | inert, same class and colour as the working "Thư viện" | opacity 0.55, cursor default, not focusable; label kept | NO_ACTION → DEFERRED | member-shell `.productNav [aria-disabled]`; spec "member and workspace headers" |
| `/projects` | "Chương trình", "Sự kiện" (header) | inert, same colour as the working "Mạng lưới" | opacity 0.55, cursor default | NO_ACTION → DEFERRED | workspace-shell `.navItem[aria-disabled]`; same spec |
| `/me` | "Chương trình", "Sự kiện", "Tin tức" (header) | grey like other nav items | dimmed by the same shared rule | DEFERRED (look only) | same CSS rule |
| `/` | "Xem deck", "Yêu cầu truy cập", "Khám phá mạng lưới" ×2 | inert, styled as working links | disabled look + visible "Sắp có" | NO_ACTION → DEFERRED | shared `Cta` (`soon`); spec "homepage and About" |
| `/` closing | "Triển khai chương trình" | inert, styled as working | disabled look + "Sắp có"; no route | MISSING_BUSINESS_DECISION (kept, D7) | same spec |
| `/` closing | "Khám phá cơ hội" | anchor `#co-hoi`, target pending review | unchanged anchor (PO keeps it) | MISSING_BUSINESS_DECISION → PASS | spec: click → `/#co-hoi`, full opacity |
| `/` footer | "Giải pháp & Startup", "Nhà sáng lập & …", "Triển khai chương trình", "Đăng bài toán", "Kết nối hợp tác", "Câu hỏi thường gặp", "Mạng xã hội"; header "VI \| EN" | inert, styled as links | disabled look (opacity 0.55) | NO_ACTION → DEFERRED ("Triển khai chương trình" stays MBD) | shared `Cta` `.inert` |
| `/`, `/about` footer | "global@1hub.network" | inert span styled as a link | plain contact text (as the phone) | NO_ACTION → INTENTIONAL_NON_CLICKABLE | span, no `aria-disabled`, no `mailto:` |
| `/about` | "Kết nối hợp tác" ×2, "Khám phá các câu lạc bộ" | inert buttons styled as working | disabled look + "Sắp có" | NO_ACTION → DEFERRED | shared `Cta` (`soon`) |
| `/about` | "Xem thêm" ×37, "Xem tất cả", "Câu lạc bộ", "Câu hỏi thường gặp", "VI \| EN" | inert, styled as links | disabled look | NO_ACTION → DEFERRED | shared `Cta` `.inert` |
| `/library` (all states) | "VN · EN" | inert, barely dimmed | disabled look | NO_ACTION → DEFERRED | shared `Cta` `.inert` |
| `/library?q=…` | keyword chip `“…”` | pointer cursor, looked removable | display only (cursor default); no remove action added | NO_ACTION → INTENTIONAL_NON_CLICKABLE | `.chipStatic`; spec "Library keyword chip" |
| 404 pages | "Về trang chủ" | no control at all | link → `/` (`ui-button` primary); Back unchanged | MISSING_BUSINESS_DECISION → PASS | spec "404": keyboard Tab + Enter → `/`, Back → 404 |
| `/`, `/about` (guest) | "Tạo tài khoản" | → `/auth` ("Đăng nhập") | unchanged: D5 stopped | MISLEADING_UI (kept) | see C |

### A. Elements with no action

| # | Screen | Workflow | Element label | Type | Current behavior | Expected behavior | Source file | Status | Can fix without PO? |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | none: every element without an action is now drawn disabled, labelled "Sắp có", or plain text (see DEFERRED and D) | — | — | — | — | — | — |

### B. Elements with wrong action

| # | Screen | Workflow | Element label | Actual action | Expected action | Actual route | Expected route | Evidence | Severity |
|---|---|---|---|---|---|---|---|---|---|
| 1 | /, /about | Homepage | Tạo tài khoản (MISLEADING_UI) | → /auth (200) | "Tạo tài khoản" opens the sign-up wording of the same magic-link entry (`/login?mode=signup`, copy only) | `/auth` | `/login?mode=signup` (BD-01) | click → /auth, whose heading is "Đăng nhập"; open sign-up means the same form creates the account (DEC-L1R-D1), but the screen never says so | P3 |

No WRONG_ACTION, WRONG_ROUTE, WRONG_EXTERNAL_LINK or BROKEN element: every internal link answers < 400 for its persona, every external link answers, every anchor resolves.

### C. Elements requiring PO decision

Grouped by the decision the PO has to take; every element is in the CSV.

| # | Screen | Element | Why unclear | Current SOT evidence | Missing decision |
|---|---|---|---|---|---|
| 1 | `/` closing + footer | "Triển khai chương trình" (disabled, "Sắp có" in the closing section) | programme creation is WF04 demo only; the proposed `/login?redirect=/programmes/create` needs BD-06 / HD-A4 | homepage-cta-map closing row (proposed); PO P3 cleanup D7 keeps it open | destination (or keep "Sắp có") |
| 2 | `/`, `/about` (guest) | "Tạo tài khoản" → `/auth` (BD-01, D5 stopped) | BD-01 says `mode=signup` "changes copy only" but no sign-up copy is approved: AUTH1 ("Đăng nhập & đăng ký") has one frame, with "Đăng nhập" / "Gửi liên kết đăng nhập" only | backend-deltas BD-01; homepage-cta-map frozen row; AUTH1__auth-entry__SOURCE.png | the sign-up heading / button copy (and whether `/login` becomes an alias), or approve "Đăng nhập" for both |

### D. Intentional non-clickable items

| Screen | Element | Reason | Evidence |
|---|---|---|---|
| / | Chương trình ×2 | plain text: no approved destination (DEC-AIG-D1) | click → nothing (verified); data-nav-kind="LABEL" |
| / | Sự kiện ×2 | plain text: no approved destination (DEC-AIG-D1) | click → nothing (verified); data-nav-kind="LABEL" |
| /about | Chương trình ×1 | plain text: no approved destination (DEC-AIG-D1) | click → nothing (verified); data-nav-kind="LABEL" |
| /about | Sự kiện ×1 | plain text: no approved destination (DEC-AIG-D1) | click → nothing (verified); data-nav-kind="LABEL" |
| /library | Chương trình ×1 | plain text: no approved destination (DEC-AIG-D1) | click → nothing (verified); data-nav-kind="LABEL" |
| /library | Sự kiện ×1 | plain text: no approved destination (DEC-AIG-D1) | click → nothing (verified); data-nav-kind="LABEL" |
| /library | Tin tức ×1 | plain text: no approved destination (DEC-AIG-D1) | click → nothing (verified); data-nav-kind="LABEL" |
| /about | 0936 966 001 ×1 | plain text (DEC-AIG-D6) | no a[href^="tel:"] on the page |
| /library (tab Nhà sáng lập) | startup row without a website ×3 | plain content (DEC-AIG-D8) | rendered as span, cursor auto |
| / | global@1hub.network ×1 | contact text (PO P3 cleanup D2 / D3, as the About phone) | SPAN:auto:null:plain |
| / | global@1hub.network ×1 | contact text (PO P3 cleanup D2 / D3, as the About phone) | SPAN:auto:null:plain |
| /about | global@1hub.network ×1 | contact text (PO P3 cleanup D2 / D3, as the About phone) | SPAN:auto:null:plain |
| /library?q=giao%20thông | keyword chip “…” ("Đang lọc") ×1 | display only (PO P3 cleanup D4); a remove action is deferred | span, cursor default, no role: SPAN:default:null |
| /library?q=zzqqxx | keyword chip “…” ("Đang lọc") ×1 | display only (PO P3 cleanup D4); a remove action is deferred | span, cursor default, no role: SPAN:default:null |

### Deferred (known future, approved inert)

| Screen(s) | Element | Elements | Reason |
|---|---|---|---|
| /demo/projects, /demo/projects/:id, /me/privacy, /me/roles, /me/settings | Challenge | 7 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /me, /projects | Chương trình | 3 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /, /about | Câu hỏi thường gặp | 3 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /about | Câu lạc bộ | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /onboarding/profile | Dán nội dung hồ sơ | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| / | Giải pháp & Startup | 2 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /onboarding/profile | Gợi ý thông tin bằng AI | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /about | Khám phá các câu lạc bộ | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| / | Khám phá mạng lưới | 4 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /onboarding/profile | Kéo thả CV vào đây hoặc chọn tệp từ máy | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /, /about | Kết nối hợp tác | 4 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| / | Mạng xã hội | 2 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| / | Nhà sáng lập & Nhà đổi mới sáng tạo | 2 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /projects/new?venture=:id&step=team | Sao chép link | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /demo/projects, /demo/projects/:id, /me, /me/privacy, /me/roles, /me/settings, /projects | Sự kiện | 10 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /onboarding/profile | Thêm liên kết LinkedIn/Portfolio | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /demo/projects, /demo/projects/:id, /me/privacy, /me/roles, /me/settings | Thông báo | 7 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /me | Tin tức | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /onboarding/profile | Tải CV lên | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /projects/new | Tải pitch deck | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /, /about | VI \| EN | 3 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /library, /library?q=giao%20th%C3%B4ng, /library?q=zzqqxx, /me | VN · EN | 5 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| / | Xem deck | 2 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /about | Xem thêm | 34 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /about | Xem thêm <record> | 3 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /about | Xem tất cả | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| / | Yêu cầu truy cập | 2 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| / | Đăng bài toán | 2 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |
| /me | Ảnh bìa | 1 | FUTURE / not in this version, visibly unavailable (DEC-P0-SHELL-D2 and the screen decision); click → nothing |

## Homepage

Elements: PASS 99 · MISLEADING_UI 3 · MISSING_BUSINESS_DECISION 4 · INTENTIONAL_NON_CLICKABLE 10 · DEFERRED 66

| Label | Page / route | Source | Actual | Expected | Classification | Evidence | Next step |
|---|---|---|---|---|---|---|---|
| Tạo tài khoản ×3 | /, /about | `src/components/about/about.tsx · src/components/landing/landing.tsx` | → /auth (200) | "Tạo tài khoản" opens the sign-up wording of the same magic-link entry (`/login?mode=signup`, copy only) | MISLEADING_UI P3 | click → /auth, whose heading is "Đăng nhập"; open sign-up means the same form creates the account (DEC-L1R-D1), but the screen never says so | build BD-01 (`/login` alias, `mode=signup` copy) or approve the "Đăng nhập" wording |
| Triển khai chương trình ×4 | / | `src/components/landing/landing.tsx` | nothing | no approved destination yet (PO P3 cleanup D7 keeps it here); drawn disabled with "Sắp có" in the closing section | MISSING_BUSINESS_DECISION P3 | opacity 0.55, cursor default, not focusable; click → nothing (2 checked); visible "Sắp có" | PO: destination for "Triển khai chương trình" |

## Navigation

Elements: none

No issue: every element acts as its SOT says.


## Library

Elements: PASS 275 · INTENTIONAL_NON_CLICKABLE 8 · DEFERRED 4

No issue: every element acts as its SOT says.


## Auth

Includes the error states (404, callback expired / used, auth errors).

Elements: PASS 18

No issue: every element acts as its SOT says.


## WF01

Elements: PASS 90 · DEFERRED 10

No issue: every element acts as its SOT says.


## WF02

Elements: PASS 151 · DEFERRED 18

No issue: every element acts as its SOT says.


## WF03

Elements: PASS 402

No issue: every element acts as its SOT says.


## WF04

Elements: PASS 118

No issue: every element acts as its SOT says.


## WF05

Elements: PASS 66 · DEFERRED 9

No issue: every element acts as its SOT says.


## WF06

No interactive surface: L6 has no screen in Alpha ([DEC-L6-D1](../../decisions/DECISION_LOG.md#dec-l6-d1)); matching, ranking and the L46–L54 screens are FUTURE. The Library directories it would feed are audited under Library.

## Shared Components

| Component | Used by | Finding |
|---|---|---|
| `Cta` (`src/components/landing/landing-parts.tsx`) | homepage, About, Library | internal / anchor / approved external link, or inert span: since the P3 cleanup drawn disabled (opacity 0.55) and, for a planned capability, with a visible "Sắp có" |
| `NavLabel` (same file) | public headers and footer | plain text by design (DEC-AIG-D1) |
| `MemberShell` / `WorkspaceShell` (`src/components/shell/`) | account and workspace screens | links work; inert header items are dimmed (opacity 0.55) since the P3 cleanup, so they no longer read like the working "Thư viện" / "Mạng lưới" |
| `Inert` (`src/components/onboarding/inert.tsx`) | AI blocks, cover pencil, pitch deck | approved inert (DEFERRED) |
| `HeroSearch`, `LibraryBrowser` | homepage, Library | PASS; the keyword chip of the Library filter row is display only (default cursor) since the P3 cleanup |
| Auth (`auth-entry-form`, `callback-screen`, `auth-error-screen`) | sign-in | PASS; return-to verified; the blocked state has no link by design (WF01-S04) |
| `not-found.tsx` | every unknown route and scope 404 | "Về trang chủ" (`ui-button`) since the P3 cleanup |

## Related
- [INTERACTION_ACTION_REGISTRY.csv](INTERACTION_ACTION_REGISTRY.csv) · [ALPHA-INTERACTION-GAP-FIX.md](ALPHA-INTERACTION-GAP-FIX.md) · [../../uat/INTERACTION_CONTRACT_AUDIT.md](../../uat/INTERACTION_CONTRACT_AUDIT.md) · [../../design-revision/scope-refreeze/homepage-cta-map.md](../../design-revision/scope-refreeze/homepage-cta-map.md)
