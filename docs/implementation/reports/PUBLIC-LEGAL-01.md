# PUBLIC-LEGAL-01

`/legal/terms/v1.0` and `/legal/privacy/v1.0` answered 404 on both public domains. Fixed by runtime configuration only: no code, content or DB change, no image build.

| Item | Value |
|---|---|
| Cause | the demo app's `env/app.env` had no `LEGAL_CONTENT_DIR`; `src/lib/legal/content.ts` serves no text without it in production (release blocker PRODUCTION_LEGAL_CONTENT_REQUIRED) |
| Source | `content/legal/TERMS_ACCEPTANCE.v1.0.md`, `content/legal/PRIVACY_DATA_PROCESSING.v1.0.md` — PO-approved v1.0 (DEC-LEGAL-V1, 01/10/2026), verbatim with the two approved edits; source docx SHA-256 `fbd4f9eb…` / `cb3cf442…` re-checked against `content/legal/README.md`; image files identical to the repo |
| Change | VPS `env/app.env` += `LEGAL_CONTENT_DIR=content/legal` (backup `env/app.env.before-public-legal-01`); app container recreated on the same image `d54e864` |
| Result | v1.0 pages 200 (14 / 12 sections); `/legal/terms`, `/legal/privacy` → 307 to v1.0; unknown version 404; footer "Điều khoản" / "Quyền riêng tư" → v1.0; create-account combined link "Điều khoản sử dụng & Chính sách quyền riêng tư" → `/legal/terms`; sign-in view carries no legal line (DEC-S1A-D10) |
| QA | both domains, 1440 + 390: 84 / 84; console 0, hydration 0, broken 0, nginx 5xx 0 |
| Rollback | `cp env/app.env.before-public-legal-01 env/app.env && docker compose up -d --no-deps app` |

Not changed (reported): in the demo DB the `p0-2026-09` rows have `retired_at` NULL, so `/legal/terms/p0-2026-09` renders without "không còn hiệu lực" (migration 014 retires them; DB not touched here).

## Related
- [content/legal/README](../../../content/legal/README.md) · [demo-app-image-retention](../../ops/demo-app-image-retention.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
