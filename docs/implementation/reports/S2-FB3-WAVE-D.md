# S2-FB3-WAVE-D

S2-NAV-DROPDOWN-V2-01 — shared public header menus (Feedback Sprint 2 lần 3, NAV-DD-01 → 16; Figma "Nav / Menu xổ · Giới thiệu · VI" 881:4401, "· Chương trình · VI" 763:4100). One commit `bd3cfa8`, one deploy. No DB change.

| Rule | Implementation |
|---|---|
| Menus | Giới thiệu ▾, Chương trình ▾ (button triggers, never navigate); Sản phẩm, Nhân tài direct links; Tin tức direct entry (plain label: no screen yet) |
| N0 / N1 / N2 | menus only in `PublicHeader` (N1); `/auth` (N0) and onboarding / wizard / editor (N2) use their own shells — no menu |
| Timing | pointer: open 150 ms, close 250 ms after leaving trigger + menu (one hover area); a click right after a hover keeps it open |
| Close | choice, outside click, Escape (focus back on the trigger), route change, the other menu opening (each menu closes only itself) |
| Keyboard | Enter / Space toggle, ArrowDown enters, Tab walks, focus leaving closes; `aria-expanded`, `aria-controls`, "(mở tab mới)" on ↗ |
| Mobile | expandable groups inside ☰, one open at a time; blur does not close during a pointer press (no reflow under the tap) |
| Entries | G.02a /about · G.02b /about#ban-do · G.02c /about#humans-of-hub · G.02d Câu lạc bộ (CLB1 not built: text) · G.02e 1Hub ↗ · G.02f iHUB Incubator hidden · G.02g iHUB Ventures ↗ · G.02i VNV ↗ · G.02j Danh mục đầu tư (RC1 not built: text) · G.03a /programmes · G.03b /events |
| Same page | scrolls to the section (hash kept) or to the top, no reload |
| "Hơn {n} CLB" | canonical catalogue count (`loadAboutNetwork`, via `publicShellData`), floored to tens (55 → 50) |
| Language | VI strings only (EN copy of the Figma EN components not rendered: no EN version) |
| Analytics | `nav_menu_open` {menu, via}, `nav_menu_select` {menu, item, type, href} as a `hub:analytics` CustomEvent |

PO decisions — CLOSED (S2-NAV-V2-PO-DECISION-CLOSE-02, 2026-10-08):
- Analytics: the frontend events are accepted as done for Sprint 2; persistence / reporting deferred to backlog NAV-ANALYTICS-PERSISTENCE-01.
- G.02g iHUB Ventures: keep the approved `https://deck.ihub.ventures/` (new tab, `noopener noreferrer`); not replaced by `ihub.ventures`.
- G.02d Câu lạc bộ (CLB1) / G.02j Danh mục đầu tư (RC1): no authoritative destination — visible, non-clickable text until a destination is supplied in a separate task.

Tests: `s2-nav-dropdown` (new) + nav matrix (`thao-01-global-nav`, `demo-home-about-01`, `thao-05-discovery`, `alpha-interaction-gaps`, `public-library`, `demo-qa-vertical-flow`, `s2-events`, `thao-04-about`, `s2-home-talents`, `s2-about-carousel`, `hero-slider`, `public-content-publish`): 148 / 149 — the known hero-counter typography debt only. Specs updated to the new contract (THAO-01 "Giới thiệu is a direct link" superseded).

## Related
- [S2-FB3-WAVE-C](S2-FB3-WAVE-C.md) · [THAO-01](THAO-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
