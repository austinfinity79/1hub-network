# Corrected Design Revision Baselines

Approved pixel references from the corrected Homepage + L1–L6 revision ([audit](../../../docs/design-revision/00_CORRECTED_SOURCE_MANIFEST.md)). A frame is added here only when the task that implements it is authorised (TASK 22, Bucket A). The WF01–WF03 baselines and `../manifest.yaml` are unchanged; these files are read by their own specs, not by the M0-T11 manifest harness.

| Screen | File | Size | SHA-256 | Source | Added by |
|---|---|---|---|---|---|
| H1 Homepage `/` | `H1/H1__homepage__SOURCE.png` | 1440×17999 | `9f77830527ee7fa02cbab43e3f9329b88a28f858f45b20c67728efc05380e979` | `Homepage.zip` (`31d6e5cc…ae35`), `Sprint 1_ (DL29) new 25/Homepage.png`, byte-identical copy | TASK 22.1 |
| AUTH1 `/auth` | `L1/AUTH1__auth-entry__SOURCE.png` | 1440×900 | `2c453178d14a4e750efd152adb048022b0b08748ac61f4bb3e63ef1b6153d7da` | `L1.zip` (`c1049e5c…4467`), `AUTH1 · Đăng nhập & đăng ký.png`, byte-identical copy | TASK 22.2 |
| AUTH2 `/auth/check-email` | `L1/AUTH2__check-email__SOURCE.png` | 1440×900 | `53601c955da37d54281feb9f1ac211e35cc2e604c1d83db3ea2dca7bf81a757c` | `L1.zip` (`c1049e5c…4467`), `AUTH2 · Kiểm tra hộp thư.png`, byte-identical copy | TASK 22.2 |
| AUTH3 `/auth/callback` | `L1/AUTH3__auth-callback-states__SOURCE.png` | 1440×900 | `640190da2e0fb3ccd96e954aa15491f579a5e6f4d8cdda8541922533cf835971` | `L1.zip` (`c1049e5c…4467`), `AUTH3 · Kết quả bấm link.png`, byte-identical copy | TASK 22.2 |
| AUTH4 `/auth/error` | `L1/AUTH4__auth-errors__SOURCE.png` | 1440×900 | `7d3369e837d1f4d77b917842d7053326f7e89a2b27f827c4742724b324d0e884` | `L1.zip` (`c1049e5c…4467`), `AUTH4 · Lỗi & chặn.png`, byte-identical copy | TASK 22.2 |
| ACC-10 `/onboarding/complete` | `L1/ACC-10__onboarding-complete__SOURCE.png` | 1440×897 | `19463544539acd05be87deb423e3283e466be75bacda230bb8911c6762e094e0` | `L1.zip` (`c1049e5c…4467`), `ACC-10 · Hoàn tất — làm gì tiếp.png`, byte-identical copy | TASK 22.2 |
| L11 ME0 `/me/settings` | `L2/L11__me-settings__SOURCE.png` | 1440×1974 | `19f1f9ee35fb5f557ec6a8322fe379cfda5e9917366a2149df50a3f57d26ccab` | `L2.zip` (`6fee10fb…04b9`), `L11 · ME0 · Cài đặt hồ sơ & tài khoản.png`, byte-identical copy | TASK 22.3 |
| L13a PRJ1 `/projects/new` step 1 | `L2/L13a__project-create-core__SOURCE.png` | 1440×1385 | `032197acb4f9a5fd53c843feafbf5582aa43875de39628ede6bbe176559eb22f` | `L2.zip` (`6fee10fb…04b9`), `L13a · PRJ1 · Tạo dự án/startup — B1 Thông tin cốt lõi.png`, byte-identical copy | TASK 22.3 |
| L13b PRJ2 `/projects/new` step 2 | `L2/L13b__project-create-team__SOURCE.png` | 1440×1084 | `42d4b8a10aa71a566b9220887a7220c93252b65c92aa1c08f784323e75644592` | `L2.zip` (`6fee10fb…04b9`), `L13b · PRJ2 · Tạo dự án/startup — B2 Mời đội ngũ.png`, byte-identical copy | TASK 22.3 |
| L13c PRJ3 `/projects/new` step 3 | `L2/L13c__project-create-done__SOURCE.png` | 1440×912 | `d9eeb249e53e569565eb49d7b8051f95f68bc8295f5a473ef9de40601412f312` | `L2.zip` (`6fee10fb…04b9`), `L13c · PRJ3 · Tạo xong — làm gì tiếp.png`, byte-identical copy | TASK 22.3 |

Rules:
- Typography: Space Grotesk where the reference uses it (DEC-HD-12); mono labels keep IBM Plex Mono 500.
- Blocks omitted under HD-01 (placeholder or unverified content) are not compared; the P0-LANDING spec lists them.
- L1: only AUTH1–AUTH4 and the ACC-10 subset are Bucket A (DEC-L1-D1). The other L1 frames stay out of the repository until their decisions (HD-02 … HD-05) are made.
- L2: only L11 and L13a–c are Bucket A (DEC-L2-D1). L10, L12, L13, L14, L16, L18 (B) and L15, L17 (C) stay out of the repository.
- Never edit or re-export a file here to make a diff pass. A new source revision gets a new file and hash.

## Related
- [../README.md](../README.md) — WF01–WF03 baselines
- [../../../docs/decisions/DECISION_LOG.md](../../../docs/decisions/DECISION_LOG.md) — DEC-HD-12, DEC-H1, DEC-L1, DEC-L2
