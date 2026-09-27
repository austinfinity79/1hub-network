# Screen Inventory

> **SUPERSEDED — DO NOT IMPLEMENT.** Unfinished TASK 21 draft (paused 2026-09-28), built from the Homepage / L1–L6 ZIPs that the designer / PO has since replaced with a corrected revision. Nothing in this file is approved or frozen, and it is not a Design Revision SOT. Do not use it for Task 22. The corrected package will be audited from scratch; only the generic method in [AUDIT_METHODOLOGY.md](../AUDIT_METHODOLOGY.md) carries over.

36 canonical screens. Revision status tags: UNCHANGED · VISUAL_ONLY · LAYOUT_CHANGE · COMPONENT_CHANGE · COPY_CHANGE · NAVIGATION_CHANGE · BUSINESS_DELTA · NEW_SCREEN · REMOVED_SCREEN · CONFLICT · FUTURE. Current status: **IMPL** = implemented, **NEW** = no current equivalent (not implemented).

| ID | Screen | Assets | Current route / page | Workflow | Current | Revision status |
|---|---|---|---|---|---|---|
| HOME-1 | Public homepage | `Homepage.png` | `/` · `src/app/page.tsx` (public) | P0-LANDING | IMPL | LAYOUT · COMPONENT · COPY · NAVIGATION · BUSINESS_DELTA (CTAs) · FUTURE (items) |
| L1-1 | Feedback modal "Gửi góp ý cho HUB Network" + floating "Góp ý" button | `Luồng pop up góp ý.png`, `Nút góp ý…` ×27 | — (API contract `POST /feedback`, table `feedback_submissions`; no route, no UI) | P0 support | NEW | NEW_SCREEN · BUSINESS_DELTA |
| L2-FP1 | Founder profile, seen by another member | L10 | — | WF02 | NEW | NEW_SCREEN · BUSINESS_DELTA · FUTURE (connect, follow) |
| L2-FP1E | Edit one profile card (modal) | L12 | `/me/profile/edit` (WF02-S02) | WF02 | IMPL (other pattern) | LAYOUT · COMPONENT · BUSINESS_DELTA (org auto-link); host FP1-OWN not supplied |
| L2-ME0 | Settings — profile & account | L11 | `/me/settings` (WF02-S07) + `/me/privacy` (WF02-S03) | WF02 | IMPL (split) | LAYOUT · NAVIGATION · BUSINESS_DELTA (many new blocks) |
| L2-ME7 | My projects & startups (+ invitation card, empty state) | L13 | venture list inside `/me`; `/demo/projects` (WF05 demo) | WF02 | partial | NEW_SCREEN · BUSINESS_DELTA (invitation inbox, lifecycle) |
| L2-PRJ1 | Create venture — step 1 core info | L13a | `/projects/new` (WF02-S05) | WF02 | IMPL (one form) | LAYOUT · COMPONENT · BUSINESS_DELTA (stage, deck, AI) |
| L2-PRJ2 | Create venture — step 2 invite team | L13b | invite on `/projects/:id/team` (WF02-S06) | WF02 | IMPL (after create) | LAYOUT · BUSINESS_DELTA (permission levels, link invite) |
| L2-PRJ3 | Create venture — done / next | L13c | editor after "Lưu" | WF02 | partial | NEW_SCREEN (UI) · COPY |
| L2-ORGP1 | Organisation profile (unified) | L14 | `/organizations/[slug]` (WF03-S09); ops `/ops/org/:id/profile` (WF03-S06) | WF03 | IMPL (split) | LAYOUT · BUSINESS_DELTA · CONFLICT (org = shared account) |
| L2-DIR1 | Thư viện — tab Bài toán | L15 | — (header item "Thư viện" inert FUTURE, DEC-P0-SHELL-D2) | WF06 / WF04 | NEW | FUTURE |
| L2-EV2 | Event calendar | L16 | — (events only on the public org page and ops) | WF03 events | NEW | NEW_SCREEN · BUSINESS_DELTA |
| L2-NOTI1 | Notification centre | L17 | — (bell inert) | — | NEW | FUTURE |
| L2-EV1 | Event detail (+ external-partner variant) | L18 + L6 Frame-1…7 | — | WF03 events | NEW | NEW_SCREEN · BUSINESS_DELTA · FUTURE (calendar, waitlist) |
| L3-S1 | Chapter public page | Frame, Frame-1…6 | `/organizations/[slug]` (WF03-S09) | WF03 | IMPL | LAYOUT · COMPONENT · COPY · BUSINESS_DELTA (KPIs, leadership, summit) |
| L3-S2 | Chapter dashboard | Frame-7, 8 | `/ops/org/:id` (WF03-S02) | WF03 | IMPL | LAYOUT · BUSINESS_DELTA (analytics, funnel) |
| L3-S3 | Summit landing editor → "Gửi HUB duyệt" | Frame-9…11 | — | WF04+ | NEW | FUTURE |
| L3-S4 | Registrants, export with purpose, email | Frame-12, 13 | — | events+ | NEW | FUTURE |
| L3-S5 | Chapter events list | Frame-14, 15 | `/ops/org/:id/events` (WF03-S07) | WF03 | IMPL | LAYOUT · COMPONENT · BUSINESS_DELTA (event type, owner) |
| L3-S6 | Regional qualifier round | Frame-16, 17 | — | WF04+ | NEW | FUTURE |
| L3-S7 | Email campaign | Frame-18, 19 | — | — | NEW | FUTURE |
| L3-S8 | Chapter members (tabs, approve / reject, leadership) | Frame-20, 21 | `/ops/org/:id/members` (+ detail) (WF03-S03 / S04) | WF03 | IMPL | LAYOUT · NAVIGATION · BUSINESS_DELTA (invite by email, export, handover) |
| L3-S9 | Head handover (2 signatures) | Frame-22, 23 | — | WF03 | NEW | NEW_SCREEN · BUSINESS_DELTA |
| L4-1 | Public Challenge / Programme page | Frame, Frame-1…11 | — (WF04 demo is operator-only, session state) | WF04 | NEW | FUTURE · CONFLICT (demo state) |
| L4-2 | Chapter summit page | Frame-12…20 | — | WF04 | NEW | FUTURE |
| L4-3 | Participation registration form | Frame-21 | — | WF04 | NEW | FUTURE |
| L4-4 | Problem detail (Đề bài, tabs) | Bia, tab bars, S4-13…S22 | — | WF04 | NEW | FUTURE |
| L5-1 | SUB0 quick team profile | L37 | — | WF05 | NEW | BUSINESS_DELTA · CONFLICT |
| L5-2 | SUB1 solution form, 4 steps | L38–L41 | `/demo/projects/:id/applications/:programmeId` (WF05-S03) | WF05 | IMPL (other schema) | BUSINESS_DELTA · CONFLICT |
| L5-3 | SUB2 review before submit | L42 | `…/review` (WF05-S04) | WF05 | IMPL | LAYOUT · BUSINESS_DELTA · CONFLICT (edit after submit) |
| L5-4 | SUB3 submission success | L43 | "Đã nộp" state on WF05-S04 | WF05 | partial | NEW_SCREEN · BUSINESS_DELTA (code, emails) |
| SP1 | Public startup profile (6 tabs) | L44, L45 + L6 cover, tab bars, bodies | — (ventures are private: owner / members only) | WF05 / WF06 | NEW | FUTURE (data room, support, timeline) |
| L6-S3 | Collaboration room "GP-2026-0142" | L6 `Frame.png` | — | — | NEW | FUTURE (new product scope) |
| L6-S4 | HUB · approve a new organisation | L6 Frame-8, 9 | — (organisations are seeded) | WF03 | NEW | NEW_SCREEN · BUSINESS_DELTA |
| L6-S5 | HUB · accounts (verification states, CSV) | L6 Frame-10, 11 | — | ops | NEW | NEW_SCREEN · BUSINESS_DELTA |
| L6-S6 | 404 / 500 / maintenance | L6 Frame-12, 13 | Next 404 page exists; no `error.tsx` (IA-P3-05); no maintenance mode | shell | partial | VISUAL · LAYOUT (404 / 500) · BUSINESS_DELTA (maintenance) |

**Not redrawn (UNCHANGED):** WF01 auth and onboarding (S01–S08), WF02-S01 `/me`, WF02-S04 roles, the member detail page, WF03-S01 organisation list, WF03-S08 relationships, the whole WF04 operator demo (9 screens), and WF05-S01 / S02.

## Related
- [01_ASSET_INVENTORY.md](01_ASSET_INVENTORY.md) — files per screen
- [03_ROUTE_DELTA_MATRIX.md](03_ROUTE_DELTA_MATRIX.md) — routes
- 06_SCOPE_BUCKETS.md (never written) — buckets
