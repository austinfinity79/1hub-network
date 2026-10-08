# S2-QUICKFIX-234-01

Three PO quick fixes. No DB change.

| # | Target | Change |
|---|---|---|
| 02 | `/products` | "1Hub - Smart Campus Solution" pinned first ahead of every sort and page (`HIGHLIGHT_PRODUCT_SLUG`, no duplicate); title "Các sản phẩm trong mạng lưới" |
| 03 | `/talents` | title "Các nhân tài trong mạng lưới" (copy only) |
| 04 | About → Hệ sinh thái | APEC Innovation Challenge → `https://apec.1hub.cloud/` (new tab, `noopener noreferrer`, via `ECOSYSTEM_LINKS`) |

Unchanged: AgriTrace / Kho Lạnh Miền Tây PRIVATE (data), detail link only for Smart Campus, talent order and gate, other ecosystem rows.

Tests: `demo-dir2-01`, `thao-04-about` 20/20 (title / APEC assertions updated; `thao-05-discovery` talent title assertion updated).

## Related
- [S2-PRODUCT-CATALOG-CLEANUP-01](S2-PRODUCT-CATALOG-CLEANUP-01.md) · [S2-TALENT-DIRECTORY-CLEANUP-01](S2-TALENT-DIRECTORY-CLEANUP-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
