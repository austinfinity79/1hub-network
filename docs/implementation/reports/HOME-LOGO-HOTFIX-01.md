# HOME-LOGO-HOTFIX-01

The PO's approved logo replaces the drawn header symbol on the dark public header (homepage and every dark-header page). Visual asset hotfix only: no DB, API, auth or workflow change.

| Item | Value |
|---|---|
| Asset | `public/brand/hub-network-logo-white.png` = `HUB_Network_FINAL_white_transparent.png`, byte-identical (sha256 `ebee6841…`), 2048 × 2048 RGBA, transparent |
| Render | `next/image` 44 × 44 centred on the unchanged 33 × 34 slot: the mark (1560 × 1600 of the canvas) fills the slot; only transparent padding extends past it; `object-fit: contain`, no crop, no stretch |
| Light header | `/products/[slug]` (and tabs) keep the drawn symbol: the approved logo is white, would vanish on #efefef and may not be recoloured — a dark variant is needed from the PO |
| Validation | build · typecheck · lint PASS; slot 33 × 34 at the same x / y as before at 1440 / 1024 / 390; nav, logo → home, mobile menu; console 0; `home-logo` spec added. Full regression not run (PO: low-risk asset hotfix) |

## Related
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md) · [PUBLIC-CONTENT-PUBLISH-01](PUBLIC-CONTENT-PUBLISH-01.md)
