# TALENT-TUAN-ANH-MEMBER-ACCOUNT-01

One walkthrough MEMBER account linked to the NETWORK_ONLY talent profile of Vũ Tuấn Anh. No secret is recorded here or anywhere in Git.

| Item | Value |
|---|---|
| Source | `1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx` (sha256 `4b023eaf…`), sheet "Nhân tài chi tiết", row 4 |
| Login identifier | username `vutuananh` (internal alias `vutuananh@1hub.internal`, authentication only, never projected) |
| Password | scrypt hash only (same mechanism as `src/lib/auth/password.ts`); plaintext handed to the PO out of band |
| Role | ordinary ACTIVE account: no role assignment, leadership or community membership; Smart Campus membership `VIEW` |
| Runtime DB (`hubnetwork_demo_0710`) | `user_accounts` +1, `individual_profiles` +1 (ACTIVE, onboarding complete, title "CMO 1hub", region TP. Hà Nội, bio), `profile_visibility_settings` +1 (NETWORK_ONLY), `vocabulary_items` +2 UNNORMALIZED DOMAIN ("Tài chính", "Công nghệ"), `profile_domains` +2, `project_members` +1 (1Hub - Smart Campus Solution, "Giám đốc Marketing", VIEW), `audit_events` +1; fixed ids `7a1e0000-…` |
| Not written | consent records (the person has not accepted the terms; the app asks at first use where required), avatar / cover (none in source), HUB role (N/A), verification claim |
| Code | `founders.ts`: entry `vu-tuan-anh` (`audience: 'NETWORK'`, experience, education, expertise, certificate as written); `founder-data.ts` + `/talents/[handle]`: a NETWORK_ONLY person is 404 for a guest (title too) and never an "other founder"; empty source fields are not drawn |
| Tests | `demo-sp1-founder-01` (+ guest 404 / no leak), `thao-05-discovery`: 34 / 34 |

## Related
- [PROGRAMME-PRESENTATION-DATA-01](PROGRAMME-PRESENTATION-DATA-01.md) · [THAO-05](THAO-05.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
