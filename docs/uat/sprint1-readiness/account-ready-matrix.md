# Account ready matrix

Sprint 1 UAT test data (UAT pack Appendix A, U1–U9 plus files and units) against what exists. Sources: `db/seed/seed_p0_deterministic.sql` (5 `@example.test` personas, 2 fixture units "Chapter 01" / "Chapter 02", 1 STARTUP), [INTERNAL_ALPHA_TEST_ACCOUNTS](../INTERNAL_ALPHA_TEST_ACCOUNTS.md) (the same personas on the review server, read 30/09). No account was created by this audit; production accounts must not be created by an implementation task.

## Accounts

| ID | Role (UAT) | Expected state | Used by | Data prerequisite | Closest existing | Status |
|---|---|---|---|---|---|---|
| U1 | Guest → new user | e-mail with no account | US-01.01–01.04, 01.06–01.14, X.01 | fresh `@example.test` address per run; e-mail delivery for reset (US-01.04) | any new address | READY (generated per run) · reset e-mail needs a mail provider on the UAT server |
| U2 | Activated member, visible; sole Owner of Project P1 (Nháp); Owner of Startup S1 (Đã duyệt · công khai, with pitch deck) | profile ACTIVE + "Hiển thị trong Mạng lưới" on; P1 DRAFT; S1 approved PUBLIC | US-02.01–02.17, X.02 | P1 DRAFT owned alone; S1 approved via the review lifecycle (S1-UAT-06); pitch deck on S1 | `member@` owns Demo Startup (STARTUP, ACTIVE, private); no PROJECT; no review state | MISSING (P1, approved S1, pitch deck) |
| U3 | Activated member, in no team | ACTIVE, no venture membership | US-02.11, 02.12, 02.14, X.02 | none beyond onboarding | `pending@` (onboarded, no venture; Chapter 01 request pending) | READY (shared persona; or create fresh) |
| U4 | Activated member, hidden | ACTIVE, network visibility off | US-01.01, 02.06, X.02 | visibility off | none suitable (`ops@` is PRIVATE but PLATFORM_ADMIN) | MISSING |
| U5 | Biên tập on S1 | ACTIVE member of S1, permission EDIT | US-02.17, X.02 | EDIT row on S1 (migration 011 `permission`) | none | MISSING |
| U6 | Xem on S1 | ACTIVE member of S1, permission VIEW | US-02.12, 02.17, X.02 | VIEW row on S1 | none (`leader@` is only a PENDING "Contributor" invitee) | MISSING |
| U7 | Created, stopped at step 2 | onboarding at CAPABILITY | US-01.14 | an account saved through step 1 | `newcomer@` is DRAFT before step 1 (single use) | MISSING (creatable in the UI per run) |
| U8 | 3 HUB positions, all Chờ xác minh: Phó Chủ tịch HUB Tổng · Chủ tịch HUB Network Hà Nội · Trưởng Ban Truyền thông HIEC | 3 RoleVerificationRequests PENDING | US-01.11, 01.13 | S1-UAT-03 / 03B and the real roster (HUB Tổng, HUB Network Hà Nội, HIEC) | none; units do not exist | MISSING · BLOCKED by S1-UAT-03/03B + roster |
| U9 | Google-only, no password | `auth_identities` GOOGLE, `password_hash` NULL | US-01.05, 01.03 | live Google OAuth client on the UAT server | none | MISSING · ENV_BLOCKED (no OAuth credentials) |

## Files and master data

| Item | Needed by | Status |
|---|---|---|
| Real CV PDF (~2 MB), CV DOCX, 12 MB file | US-01.08 | MISSING (PO / tester supplies); feature LEGAL_BLOCKED |
| Real pitch deck PDF, public startup website | US-02.10, 02.15 | MISSING (PO / tester supplies); feature LEGAL_BLOCKED |
| HUB Network Tổng + 13 Chapter + 55 CLB (Appendix E) | US-01.11, 01.13, U8 | MISSING: seed has fixture "Chapter 01" / "Chapter 02" only; import through the roster tool from the PO list, never invented |
| 11 countries, 34 provinces + Khác (Appendix E) | US-01.07 | MISSING until S1-UAT-03 |

## Totals

READY 2 (U1, U3) · MISSING 7 (U2, U4, U5, U6, U7, U8, U9).

"READY" here means the account can be produced; the invitation flows U3 / U6 are used in (US-02.11, 02.12, 02.14) stay IMPLEMENTATION_PENDING until S1-UAT-07 is accepted and integrated. Every account and file must exist on the UAT environment that runs the frozen candidate (gate G11).

## Related

- [overview](overview.md)
- [traceability.csv](traceability.csv)
- [task-coverage](task-coverage.md)
- [readiness-gaps](readiness-gaps.md)
