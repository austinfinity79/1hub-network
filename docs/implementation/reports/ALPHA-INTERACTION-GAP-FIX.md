# ALPHA-INTERACTION-GAP-FIX

**ALPHA INTERACTION GAP FIX — PO DECISION FREEZE + P1/P2 CLOSURE.** Fix-only on the PO's 30/09 decisions ([DEC-AIG](../../decisions/DECISION_LOG.md#dec-aig)) for the gaps of the [interaction contract audit](../../uat/INTERACTION_CONTRACT_AUDIT.md). No new feature, no redesign, no deploy, no push.

## Result
| Severity | Before (instances) | Remaining |
|---|---|---|
| P1 | 20 | **0** (10 hidden, 10 plain labels) |
| P2 | 31 | **0** (19 fixed, 12 hidden) |
| P3 | 141 | 75 unchanged inert items outside the scope (66 resolved by the same changes) |

Per-row outcome: [INTERACTION_GAP_REGISTER.csv](../../uat/INTERACTION_GAP_REGISTER.csv), columns "Alpha fix status" / "Alpha fix outcome".

## Changes
| Item | Outcome |
|---|---|
| Public "Chương trình", "Sự kiện" (`/`, `/about`, footer) and the Library header's "Tin tức" | plain text labels (`NavLabel`), no link, no tooltip |
| Hero search | live form → `/library?q=<keyword>`; the Library reads `q` into its own search; blank keyword navigates nowhere; plain GET fallback without script; copy "Tìm kiếm trong Thư viện" (DEC-AIG-D10, final closure) |
| "Tạo hồ sơ startup của bạn" | member → `/projects/new`; guest → `/auth?redirect=/projects/new` → e-mailed link → `/projects/new`; a new account onboards first, then ACC-10's exit reads "Tiếp tục" → the path |
| Return path (BD-02 rule, browser side) | `lib/auth/return-path.ts`: same-origin relative path only (no `//`, scheme, backslash, `/auth`, `/api`), localStorage for 1 h, read once by the callback, carried through onboarding in sessionStorage |
| "Truy cập ihub.ventures" | `https://ihub.ventures`, new tab, `rel="noopener noreferrer"` |
| "Chi tiết" on event / programme cards | not drawn; the event card keeps the 28 px line so its picture keeps the approved size |
| Library cards | "Theo dõi", "Kết nối", "Xem bài toán" / "Theo dõi bài toán", "Xem hồ sơ" without a website: not drawn; the founder's startup row without a website is plain content |
| Account shell "Thư viện" / "Tổ chức của tôi" | `/library` / `/me/roles` |
| ME7 "Mạng lưới" / "Hồ sơ đăng ký" | `/library` / `/demo/projects` (L5 entry) |
| About phone | plain text |
| "Góp ý" | hidden on all 14 screens (component removed) |

## Tests
| Gate | Result |
|---|---|
| format, lint, typecheck | PASS |
| unit (`pnpm test`) | 33 files / 259 tests PASS (new: `return-path.test.ts`, `query.test.ts`; `nav.test.ts` updated) |
| production build | PASS |
| new `alpha-interaction-gaps.spec.ts` | 9 PASS: homepage search (8 criteria), public labels, About phone, ihub, Chi tiết, Library CTAs, Góp ý, account / workspace menus, auth return (existing and new account, unsafe paths, stale path), member direct, runtime |
| affected specs | landing, Library, shell navigation, WF01 onboarding (S05, S06, S08, S09, S10), WF02 S01, S08, T00, WF05 T00, UAT UC02: updated to the decisions and PASS |
| protected smoke | L1 (`wf01-uat-journey`, UAT L1–L2 19/19), L2 (`wf02-uat-journey`), L3 (`wf03-uat-journey`), L5 (`l5-startup-journey`): PASS |
| runtime | #418 0, 5xx 0, broken assets 0, console errors 0 |
| extra sweep (WF03, WF04, API, primitives) | 205 PASS, 1 pre-existing FAIL (`api-contract` expected `/me/ventures` → 404): fixed in the final closure below |

Pixel: no baseline changed. The removed pieces are recorded as intentional (landing "Chi tiết" strip excluded, Library L15b / L15c action row no longer compared, onboarding "Góp ý" segment dropped); every other segment passes its thresholds.

## Deviations / limits
- The return path is not stored with the magic-link request (BD-02's cross-device part): a link opened in another browser or device lands on the usual destination.
- New copy, minimal: callback success "Bạn sẽ được chuyển về trang bạn đã chọn"; ACC-10 exit "Tiếp tục" (only when a return path exists).

## Final closure (PO decisions, 30/09)
| Item | Before | After | Evidence |
|---|---|---|---|
| Hero placeholder | "Tìm kiếm chương trình, sự kiện" | "Tìm kiếm trong Thư viện" (placeholder and accessible name) | `hero-search.tsx`; `alpha-interaction-gaps.spec.ts` |
| Search behaviour | `/library?q=`, Back, one request | unchanged | interaction spec 9/9 |
| `/me/ventures` test | stale: expected 404 | follows contract 05 §5.3 / 05:1331 (`listOwnVentures`): guest 401 envelope, session 200 `{ items, page }` | `api-contract.spec.ts` 9/9 |

No API, schema or behaviour change: the contract, the implementation (since `c9c7cb5`) and the updated test agree. Gates: format, lint, typecheck PASS; unit 259/259; build PASS; targeted specs 28/28 (interaction 9, landing 10, API contract 9); regression 78/78 (auth-session, authz-session, idempotency, public-library, wf02-s08-projects, wf02-uat-journey, console-health). Landing pixel: the placeholder area is an intentional copy change (hero segment outside 0.04 %, beyond ±2 px 0.31 %).

## Related
- [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md) · [../../uat/INTERACTION_CONTRACT_AUDIT.md](../../uat/INTERACTION_CONTRACT_AUDIT.md)
