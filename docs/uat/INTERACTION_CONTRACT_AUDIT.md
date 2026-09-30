# Interaction Contract Audit

**ALPHA INTERACTION CONTRACT AUDIT — COMPLETE (audit only; no product change, no deploy, no push).** Every clickable or interactive element of the deployed Internal Alpha (`ff052d70fe418cb092bd5e33fcc03ee712c76d14`, https://1hubnetwork.io.vn), 2026-09-30. Full matrix (12 columns, one row per element group): [INTERACTION_CONTRACT_MATRIX.csv](INTERACTION_CONTRACT_MATRIX.csv). Non-working items with handling: [INTERACTION_GAP_REGISTER.csv](INTERACTION_GAP_REGISTER.csv).

## Method
| Step | How |
|---|---|
| Build | the production build of `ff052d7` (no `src` change since), locally with the deterministic seed, so every control could be clicked without writing production data |
| Parity | the public pages (`/`, `/about`, `/library`, `/auth`, three organisation pages) inventoried on production and locally: identical element lists |
| Screens | 68 screen states: guest, the five onboarding stages, member, founder with no / one / two ventures, DRAFT and SUBMITTED application, VIEW team member, invitee, chapter leader, platform admin; Library Startup / Nhà sáng lập tabs; members tabs |
| Inventory | links, buttons, tabs, menu items, inputs, selects, text areas, disclosures, focusable regions, pointer-cursor elements, and every `aria-disabled` item |
| Probe | each non-link control clicked on a fresh load: navigation, server call, dialog, state toggle, visible feedback, page change or nothing; file choosers and selects checked separately |
| Links | every internal href fetched with the persona's session (status and landing route); external links fetched; in-page anchors resolved |
| Review | every non-obvious result reviewed by hand against the SOT (DEC-2809-D1 and the CTA map, DEC-P0-SHELL-D2, DEC-L15 / DEC-2909, DEC-L1R, DEC-L2R / DEC-PDF, DEC-L3, DEC-WF04, DEC-L5, DEC-L6-D1) |

## Summary
| Class | Element instances | Groups |
|---|---|---|
| **Total** | **1 153** | **871** |
| A — WORKING | 924 | 738 |
| B — MISSING ACTION | 2 | 2 |
| C — WRONG ACTION | 15 | 15 |
| D — FUTURE (inert, visibly disabled or approved inert) | 37 | 37 |
| E — SHOULD NOT BE CLICKABLE (inert but styled as a working control) | 166 | 70 |
| F — NEEDS PO DECISION | 9 | 9 |
| G — BROKEN LINK | 0 | 0 |

Severity of B / C / E / F (instances): **P0 0 · P1 20 · P2 31 · P3 141**. No broken link, no 5xx, no dead form: every submit either acts or explains what is missing.

## What works (A)
All L1–L5 core journeys: sign-in, Google explaining it is not enabled, onboarding stages and uploads, profile and privacy, venture create / edit / publish rules, team invite / accept / remove, membership request, leader approve / reject / member detail / events / profile, the WF04 session demo, the L5 quick team, form, review, submit and read-only view; Library search (submit filters 47 → 3), tabs, facets, sort, "Xem thêm", external record links; every footer / legal link. Member-shell FUTURE items are dimmed with their reason (DEC-P0-SHELL-D2).

## Top P1 / P2 gaps
| Sev | Class | Element (where) | Now | Handling | PO |
|---|---|---|---|---|---|
| P1 | E | "Chương trình", "Sự kiện" in the public header (`/`, `/about`) | inert, styled like the working "Mạng lưới đổi mới sáng tạo"; reason only in a tooltip | DISABLE_WITH_LABEL | YES |
| P1 | E | "Xem hồ sơ" on every Startup and Nhà sáng lập card (`/library`) | primary dark button, inert (no startup / founder page, DEC-L6-D1) | DISABLE_WITH_LABEL | YES |
| P2 | B | "Truy cập ihub.ventures" (`/`) | inert; the 28/09 CTA map froze `https://ihub.ventures`, which answers 200 | WIRE_EXISTING_ROUTE | NO |
| P2 | C | "Thư viện" in the account shell (`/me/privacy`, `/me/roles`, `/me/settings`, `/demo/projects*`) | "Chưa có trong phiên bản này" although `/library` ships and the `/me` header links it | WIRE_EXISTING_ROUTE | NO |
| P2 | C | "Tổ chức của tôi" in the same shell | inert, while the `/projects` shell links the same item to `/me/roles` | WIRE_EXISTING_ROUTE | NO |
| P2 | C | "Tạo hồ sơ startup của bạn" for a guest (`/`) | goes to `/auth`; after sign-in the intent is lost (BD-02 not built; the form sends `return_to=/auth/callback`). Same for any sign-in-gated deep link | NEED_PO_DECISION | YES |
| P2 | E | "Chi tiết →" on the six event / programme cards (`/`) | inert, styled as links / coral buttons | DISABLE_WITH_LABEL | YES |
| P2 | F | "Hồ sơ đăng ký" in the `/projects` shell | labelled FUTURE, but applications ship (DEC-L5); today they are listed only in "Dự án & Startup · Demo" | NEED_PO_DECISION | YES |

P3 (141 instances, all in the register): the other homepage / About inert items styled as working (VI | EN, Xem deck, Yêu cầu truy cập, Khám phá mạng lưới, Triển khai chương trình, Đăng bài toán, Kết nối hợp tác, Câu hỏi thường gặp, e-mail, social, About "Xem thêm" / "Xem tất cả" / "Câu lạc bộ"), Library "Theo dõi", "Kết nối", "Xem startup" and header items, the floating "Góp ý" on 14 screens, the hero search (F), the About phone number (F), the member-shell "Mạng lưới" (F).

## PO decisions required
| # | Decision | Affects |
|---|---|---|
| 1 | Public inert items: a visible "Sắp có" label, or hide them for Alpha (DEC-2809-D1 allows either) | all 70 E groups (P1 header, Library card CTAs, homepage cards, About, footer) |
| 2 | BD-02 return-to-action: build it now (already approved in DEC-2809-D1) or accept the lost intent for Alpha | hero CTA, deep links such as `/programmes/:id/apply` |
| 3 | "Hồ sơ đăng ký": link to "Dự án & Startup · Demo" or a dedicated list of the member's applications | `/projects` shell |
| 4 | Member-shell "Mạng lưới": `/organizations/hub-network`, `/me/roles`, or hide | `/projects` shell |
| 5 | Hero search: keep disabled for Alpha, or scope the public search (BD-09) | homepage |
| 6 | About phone number: `tel:` link or plain text | `/about` |
| 7 | "Góp ý": hide for Alpha, or add a feedback channel (none exists) | 14 member / onboarding screens |

No PO decision needed to wire "Truy cập ihub.ventures", "Thư viện" and "Tổ chức của tôi" (approved or existing routes). D items (37: CV / AI blocks, "Sao chép link", pitch deck, cover image, Challenge, notifications, member-shell Chương trình / Sự kiện, Tin tức, VN · EN) stay DEFER_FUTURE.

## Limits
Second-level menu items that open only after an interaction are covered where the flow was exercised; mutations were clicked only on the local build. Production received read-only page loads.

## Related
- [INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) · [../design-revision/scope-refreeze/homepage-cta-map.md](../design-revision/scope-refreeze/homepage-cta-map.md)
