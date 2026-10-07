# Runbook result — DEMO-RUNBOOK-QA-01

Execution of the original 21 steps ([RUNBOOK_ORIGINAL](RUNBOOK_ORIGINAL.md)) on the live domains, read-only.

| Item | Value |
|---|---|
| Live SHA | `57c1f14650e7c512f3f50d9ab424c5c1faa20269` (local = origin/main = container label; unchanged before / after; RestartCount 0) |
| Domains | `https://1hubnetwork.io.vn` (primary, screenshots) and `https://1hub.network` (full rerun, identical per-step results: [JSON](evidence/execution-1hub-network.json)) |
| Setup | Fresh browser context (incognito-equivalent), signed out, desktop 16:9 1920 × 1080, Playwright, actions as written in the script |
| Totals | PASS 9 · PARTIAL 7 · BLOCKED 5 · N/A 0 |
| Runtime | console errors 0 (only the 404 document at `/events`) · hydration 0 · 5xx 0 · broken assets 0 · demo data mutation none |

| Step | Actor | Expected (original) | Actual | Result | Evidence | Notes |
|---|---|---|---|---|---|---|
| 01 | Guest | Home public, no login, no layout / video / font error | `/` 200, P0-LANDING, viewer GUEST, no login wall; Be Vietnam Pro / Space Grotesk / IBM Plex Mono | PASS | [step-01](evidence/step-01-home-guest.png) | |
| 02 | Guest | Hero video autoplay muted, poster, CTA not covered | No video (PO cancelled); six stills, 10 s each, 01/06 after 8 s; search 737–812 px and intents 825–867 px inside the hero | PASS | [step-02](evidence/step-02-hero-slider.png) | Approved deviation (HOMEPAGE-HERO-SLIDER-01) |
| 03 | Guest | Search visible; CTAs correct; login CTA has correct route / return URL | Search visible; "Tham gia cộng đồng" → `/auth` sign-in page; "Tổ chức chương trình" / "Gọi vốn" disabled labels; submitting "Tracely" opens `/library?q=Tracely` on the "Bài toán" tab (Tracely only on the "Startup" tab) | PARTIAL | [cta](evidence/step-03-hero-cta-search.png) · [search](evidence/step-03-global-search-library.png) · [auth](evidence/step-03-join-cta-auth.png) | `/auth` carries no return URL; post-login landing not verified (no sign-in in this lane) |
| 04 | Guest | Programme route, active nav, directory has data | Dropdown "Chương trình, cuộc thi" → `/programmes`; active nav OK; one record "Chương trình ươm tạo (demo)" — "Chương trình mẫu cho Internal Alpha…" | PARTIAL | [menu](evidence/step-04-programme-menu.png) · [directory](evidence/step-04-programmes-directory.png) | Visible demo / sample wording |
| 05 | Guest | Filters update cards, reset works, no blank reload | "Sắp tới" / "Challenge" → 0 + empty state; "Xoá tất cả" → back to 1; URL params update | PARTIAL | [step-05](evidence/step-05-programme-filters.png) | Mechanism works; one record only |
| 06 | Guest | Event route works, list / calendar | "Sự kiện" is a plain label in the dropdown; `/events` → 404 | BLOCKED | [step-06](evidence/step-06-events-404.png) | No P0 Event surface |
| 07 | Guest | Event filters | Not reachable | BLOCKED | see step-06 | Depends on 06 |
| 08 | Guest | Products route, list not empty | `/products`, active nav, "95 sản phẩm", 9 cards, 0 empty card | PASS | [step-08](evidence/step-08-products.png) | |
| 09 | Guest | Search / filter, empty state, clear | Giáo dục → 5; clear → 95; MVP → 60; clear → 95; nonsense keyword → 0 + "Không có sản phẩm phù hợp với bộ lọc"; clear → 95 | PASS | [step-09](evidence/step-09-product-filters.png) | |
| 10 | Guest | Talent cards with name, headline, skills, place | `/talents` 200, active nav; member gate "Dành cho thành viên HUB Network … Đăng nhập để xem"; 0 talent card | BLOCKED | [step-10](evidence/step-10-talents-guest-gate.png) | Gate is correct NETWORK_ONLY behaviour |
| 11 | Guest | Talent filters, no private data | No filter, no row for guests; no private data | BLOCKED | see step-10 | |
| 12 | Guest | Back to Products stable | Back → `/products`, 95 | PASS | [step-12](evidence/step-12-back-to-products.png) | |
| 13 | Guest | Product detail by slug, sections with data | `/products/tracely`; 13 sections, 3 tabs; 7 internal links all 200; 0 broken image | PASS | [step-13](evidence/step-13-product-tracely.png) | |
| 14 | Guest | Founder / team cards, clickable | Đặng Kim Chi (CEO) and Nguyễn Minh Anh linked; Phạm Quốc Việt, Trần Hạnh not linked | PASS | [step-14](evidence/step-14-team.png) | |
| 15 | Guest | Founder profile, back-link, public data, prominent CCCD mark | `/talents/dang-kim-chi`; back-link → Tracely works; no CCCD number / email / phone; chip "Đã xác thực danh tính qua 1Hub" (data-verified=demo), 211 × 25 px | PARTIAL | [step-15](evidence/step-15-founder-profile.png) | Wording / prominence differ from "CCCD nổi bật" (DEMO-D10) |
| 16 | Guest | About renders | `/about` PUBLIC-ABOUT, 9 sections, no overflow | PASS | [step-16](evidence/step-16-about.png) · [partners](evidence/step-16-about-partners-placeholder.png) | Partner wall shows "Dữ liệu minh hoạ", "Doanh nghiệp A…" (gap logged in the report) |
| 17 | Guest | APEC opens in a new tab | Row has an → arrow but no link; click does nothing; `PUBLIC_ROUTES.apecInnovationChallenge = null` | BLOCKED | [step-17](evidence/step-17-apec-row-no-link.png) | No authoritative URL |
| 18 | Guest | Same tab, no state loss | Still `/about`, one tab | PASS | [step-18](evidence/step-18-still-about.png) | |
| 19 | Guest | iHUB Ventures deck in a new tab, deck visible | Link `https://deck.ihub.ventures/`, `_blank`, noopener; 1hub tab stays; external site → `/login` "Sign in to the deck" | PARTIAL | [link](evidence/step-19-ihub-link.png) · [external](evidence/step-19-ihub-deck-external-gate.png) | External access dependency |
| 20 | Guest | VNV deck in a new tab, no access error | Link `https://vnv.ihub.ventures/`; external site → `/access` "Access the proposal dossier" | PARTIAL | [link](evidence/step-20-vnv-link.png) · [external](evidence/step-20-vnv-deck-external-gate.png) | External access dependency |
| 21 | Guest | No broken link / route, consistent data | Logo → `/`; inconsistencies remain: programme fixture vs the four homepage programme cards; Library "114 startup" vs `/products` 95 | PARTIAL | [step-21](evidence/step-21-home-end.png) | |

## Related
- [RUNBOOK_SOT](RUNBOOK_SOT.md) · [FINAL_ACCEPTANCE_REPORT](FINAL_ACCEPTANCE_REPORT.md) · [evidence/](evidence/)
