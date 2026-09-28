# Matrix Homepage Auth

Screen / Route / Data / Permission matrix — Homepage and L1 (14 screens). Class: **ALPHA** = APPROVED INTERNAL ALPHA · **FUTURE** · **SUPERSEDED** (the current implementation or an earlier classification). Delta: **UI** only · **BE** backend. Batches: [task-sequence.md](task-sequence.md).

| Screen | Route | Actor | Data entities | Permission | Current implementation | Class | Delta | Migration / API | Batch |
|---|---|---|---|---|---|---|---|---|---|
| H1 Homepage | `/` | guest, member | Organization (HUB page link), Event, Programme (directories), public counts none | public; L CTAs need a session | P0-LANDING restyled to H1 (22.1); CTAs per DEC-H1-D3 (**SUPERSEDED** where the [CTA map](homepage-cta-map.md) differs) | ALPHA | UI + BE | `/login` alias, return path (BD-01, BD-02); public search read (BD-09) | 22.1 done · 22.8 CTA refreeze |
| AUTH1 Đăng nhập & đăng ký | `/auth` (+ `/login` alias, `?redirect`, `?mode=signup`) | guest | UserAccount, MagicLinkToken | public | WF01-S01 (22.2) | ALPHA | BE | return path stored with the link request; safe-path check (BD-02) | 22.2 done · 22.6 |
| AUTH2 Kiểm tra hộp thư | `/auth/check-email` | guest | MagicLinkToken | public | WF01-S02 (22.2) | ALPHA | — | — | 22.2 done |
| AUTH3 Kết quả bấm link | `/auth/callback` | guest (token) | Session, onboarding state | token | WF01-S03 (22.2); strips the query, goes to the resolver or `/me` | ALPHA | BE | callback honours the stored return path after onboarding (BD-02) | 22.2 done · 22.6 |
| AUTH4 Lỗi & chặn | `/auth/error` | guest | — | public | WF01-S04 (22.2) | ALPHA | — | — | 22.2 done |
| ACC-05 Giới thiệu onboarding | none | new account | — | session | none | FUTURE | — | — (HD-02 open) | — |
| ACC-06 Bước 1 Thông tin cơ bản | `/onboarding/profile` (partly) | new account | IndividualProfile (+ country, phone, LinkedIn, website: HD-05) | session, own profile | WF01-S06 (six fields) | FUTURE as a new step (HD-02 / HD-05); hosts the AI block on the existing fields (HD-A1) | — | — | — |
| L06b ACC-06 sau khi AI gợi ý | inside the profile step | new account | IndividualProfile (fields only suggested, never saved by AI), AI suggestion request | session, own profile; quota | none | **ALPHA** (DEC-2809-D2) | BE | AI suggestion API + provider + quota (BD-12); migration only if requests are logged (HD-A1) | 22.9 |
| L06c ACC-06 trạng thái khối AI | inside the profile step | new account | same | same | none | **ALPHA** (loading / error / quota states; manual path always open) | BE | same | 22.9 |
| ACC-07 Bước 2 Lĩnh vực & chuyên môn | `/onboarding/profile` (chips) | new account | DOMAIN / SKILL vocabulary | session | WF01-S06 chips | FUTURE (free-text skills conflict, HD-02 / HD-05) | — | — | — |
| ACC-08 Bước 3 Vai trò | `/onboarding/purpose` | new account | intent allowlist | session | WF01-S05 | FUTURE (HD-02); only the create-startup preselect is Alpha (HD-A3) | UI | — | 22.8 |
| ACC-09 Bước 4 Rà soát | `/onboarding/privacy` | new account | ConsentRecord | session | WF01-S07 (consent kept) | FUTURE (HD-02 / HD-03) | — | — | — |
| ACC-10 Hoàn tất | `/onboarding/complete` | new account | onboarding state | session | WF01-S08 (22.2); single exit `/me` (DEC-WF01-S08-D6, **SUPERSEDED** when a return path exists) | ALPHA | BE | exit to the stored return path (BD-02) | 22.2 done · 22.6 |
| FP1-OWN Hồ sơ của tôi | none | owner | IndividualProfile + new data | own | `/me` account overview | FUTURE (HD-05) | — | — | — |

Totals: ALPHA 8 (H1, AUTH1–4, ACC-10, L06b, L06c) · FUTURE 6.

## Related
- [overview.md](overview.md) · [matrix-member.md](matrix-member.md) · [homepage-cta-map.md](homepage-cta-map.md)
