# S2-HOME-HIGHLIGHTS-ASSETS-01

Homepage "Nổi bật tuần này": the five rows that drew initials now show the PO's approved marks. Homepage only; no DB change.

| Row | Block | Source (Drive folder "Homepage - Nổi bật tuần này", `1oHQqE4LfU_ojnXzoEbH4DUGKJXxIo_7t`) | Served |
|---|---|---|---|
| APEC Innovation Challenge công bố 20 đội… | Cập nhật chương trình | `cập nhật-1-apec-innovation-challenge.png` (sha256 `6102fe9a…`) | `/home/highlights/apec-innovation-challenge.webp` |
| MBBank Open Challenge mở thêm bài toán thanh toán QR | Cập nhật chương trình | `cập nhật-2-qr-payment-open-challenge.png` (`e5690a68…`) | `/home/highlights/qr-payment-open-challenge.webp` |
| Chuyển đổi số logistics 2026 gia hạn… | Cập nhật chương trình | `cập nhật-3-logistics-2026.png` (`1e3bf73b…`) | `/home/highlights/logistics-2026.webp` |
| Bloom | Sản phẩm theo ngành | `sản phẩm-4-bloom.png` (`6bad5897…`) | `/home/highlights/bloom.webp` |
| Debatium | Sản phẩm theo ngành | `sản phẩm-5-Debatium.png` (`7ac8c229…`) | `/home/highlights/debatium.webp` |

- Files: 128 × 128 WebP (1–4 KB), drawn in the existing 44 px mark slot (`markImage`, contain); text, order, tags and layout unchanged.
- Programme updates: `logo` field in `PROGRAMME_UPDATES`; the mark is `data-pixel="data"` (INTENTIONAL-DATA, DEMO-D8).
- Products: `HIGHLIGHT_PRODUCT_LOGOS` (by slug) used only when the startup has no public logo; the canonical product logos (`projects.logo_asset_id`) are not touched — product cleanup is Priority 02.
- Tests: `demo-home-about-01` (gated pixel segment 04 PASS), `hero-slider`, `thao-03-home`; one known failure (hero counter typography, IBM Plex Mono 400) unchanged; one transient local DB connect timeout on a rerun did not repeat.

## Related
- [PUBLIC-CONTENT-PUBLISH-01](PUBLIC-CONTENT-PUBLISH-01.md) · [PAGE-TRANSITION-SKELETON-01](PAGE-TRANSITION-SKELETON-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
