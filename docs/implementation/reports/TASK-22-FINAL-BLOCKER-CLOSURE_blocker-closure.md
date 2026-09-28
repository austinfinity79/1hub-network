# TASK-22-FINAL-BLOCKER-CLOSURE Blocker Closure

**FINAL RELEASE BLOCKER CLOSURE: BLOCKED (edge).** Legal is closed and deployed: `2033264b9f8314cee8e8c1bf9c0022d2906ac4e9` (tag `internal-alpha-preview-06`) runs on https://1hubnetwork.io.vn. HTTP/3, Referrer-Policy and the health check are OneShield settings; they were still unchanged at 2026-09-28 15:03 UTC. The task was paused there by the PO's next task.

## Legal (closed)
| Item | Value |
|---|---|
| Approved source | `1Hub_Dieu_khoan_su_dung_va_Chinh_sach_quyen_rieng_tu_v1.5.docx` (v1.5, 24/09/2026, 1Hub Holding), approved by the PO on 28/09; sha256 `dec6f075…9ba2` |
| Content | verbatim: opening + Phần A → `TERMS_ACCEPTANCE`, Phần B → `PRIVACY_DATA_PROCESSING`, version `p0-2026-09`; identical to an independent extraction (26,214 characters) |
| Mechanism | `content/legal/` in the image, `LEGAL_CONTENT_DIR=content/legal` in `app.env` ([DEC-LEGAL](../../decisions/DECISION_LOG.md#dec-legal)); no DB change |
| `/legal/terms`, `/legal/privacy` | 307 → the current version, then 200; unknown kind 404 |
| Footer links (`/`, `/about`) | 200 at 1440 / 1024 / 768 / 390, refresh stable, overflow 0 |

## Deploy
| Item | Value |
|---|---|
| Code change | YES: `src/app/legal/[kind]/page.tsx`, `content/legal/`, one unit test, one spec assertion |
| Gates | format, lint, typecheck, build PASS; unit 257 / 257; DB-API 354 / 354; targeted visual 210 / 210 |
| Backup | `onehub-20260928T122736Z.dump`; `app.env.bak-20260928T122736Z` |
| Deploy | `deploy.sh 2033264…` exit 0, 12:27 → 12:30 UTC; migrate 9 × skip; release content hash equal on both sides (917 files) |
| Image | `sha256:2f5e2f9bc32682409d0f05473c44b4d0ac04207b0e475cc7732ea595649b8cc8` |
| Restart | healthy, same SHA and image, env present, DB counts unchanged (accounts 15, profiles 12, sessions 112, projects 6) |
| Rollback | `rollback.sh` → `08bbbb9` (image and release kept); env: restore `app.env.bak-…` and recreate the container |
| Domain | `/`, `/about`, `/library`, `/auth`, legal, `/api/v1/auth/providers` 200; About 46 images; Library 6 · 72 · 84; #418 0; 5xx 0 |

## Edge (open, owner: OneShield operator)
| Item | Public value (15:03 UTC) | Required |
|---|---|---|
| HTTP/3 | `alt-svc: h3=":443"; ma=7200` on all four edge nodes | disable HTTP/3 / QUIC for the domain; no `Alt-Svc` header |
| Referrer-Policy | `strict-origin-when-cross-origin` (origin sends `no-referrer` on `/auth/callback`) | pass the origin header through, or set `no-referrer` |
| Health check | `GET /health` → 404 every ~15 s from 103.72.96–98.x | `GET /api/v1/auth/providers` → 200 |
| Rollback of the edge change | — | re-enable HTTP/3, restore the previous header rule and check path in the panel |

## Not run (waits for the edge)
20 consecutive auth POSTs over a QUIC-capable browser, the real inbox end-to-end login, the rate-limit and unknown-address checks on the domain.

## Verdict
NOT READY. Blocking gaps: 1 (EDGE-H3-POST-RESEND); external: Referrer-Policy, monitor endpoint.

## Git
Branch `main`; implementation `2033264`. Push **NOT RUN**.

## Related
- [TASK-22-FINAL-RELEASE_final-release.md](TASK-22-FINAL-RELEASE_final-release.md)
- [TASK-22-HOMEPAGE-FINAL-ALIGN_homepage-align.md](TASK-22-HOMEPAGE-FINAL-ALIGN_homepage-align.md)
