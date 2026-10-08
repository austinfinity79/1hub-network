# S2-NAV-V2-PO-DECISION-CLOSE-02

Closes the three PO decisions left by S2-FB3-WAVE-D. Production (`b78a7c0`) already matched all three: no code change, no build, no deploy. Docs only.

| Decision | Expected | Live (both domains, 1440 + 390) |
|---|---|---|
| Nav analytics | frontend events only for Sprint 2; persistence deferred (NAV-ANALYTICS-PERSISTENCE-01) | `nav_menu_open` {menu, via, at} and `nav_menu_select` {menu, item, type, href, at} emitted as `hub:analytics` |
| G.02g iHUB Ventures | `https://deck.ihub.ventures/`, new tab, safe rel | href `https://deck.ihub.ventures/`, `target=_blank`, `rel=noopener noreferrer`; opens a new tab |
| G.02d Câu lạc bộ (CLB1) | visible, not a link | `<span aria-disabled="true">`, no href, no anchor; click leaves the URL unchanged |
| G.02j Danh mục đầu tư (RC1) | visible, not a link | same as CLB1 |

Not built (per decision): analytics endpoint / persistence / dashboard / SDK, CLB or portfolio pages, placeholder or `#` links.

## Related
- [S2-FB3-WAVE-D](S2-FB3-WAVE-D.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
