# TASK-22-FINAL-RELEASE Final Release

**FINAL PRE-PRODUCTION CONSOLIDATION + FIX + FREEZE + DEPLOY: DEPLOYED, NOT READY (open blockers).** `08bbbb9e25a2d51f41323dd93dab33cfcf04001c` (tag `internal-alpha-preview-05`) runs on https://1hubnetwork.io.vn. The approved surface works; the verdict is held by the legal BLOCKER (PO: "verdict not GREEN on legal") and the edge HTTP/3 login defect. Server record: `deploy/vps-foundation`, `docs/deployment/INTERNAL_ALPHA_FINAL_RELEASE_DEPLOYMENT.md`. Release sheet: [INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md).

## Consolidation
| Item | Finding |
|---|---|
| Inventory | `main` holds Homepage, `/about` (+ Humans of HUB), `/library` (real `startup.json`), login UI, Resend auth, L1, L2. The server ran `c535c35` (favicon on About, deployed from another branch by another session) |
| Merge | favicon cherry-picked as `08bbbb9` (patch-equal to `c535c35`; `src/app/icon.png` = the supplied `favicon-32x32.png`). No other branch pending. No product fix needed |
| Scope since `0479579` | `/library`, favicon, docs; `db/`, dependencies, `patches/`, `next.config.ts` unchanged; migrate 9 × skip |
| Not started | L4 / L5 / L6, AI, investor, summit, admin, system status |

## QA (local production build, before freeze)
| Gate | Result |
|---|---|
| Gates | format, lint, typecheck, clean build PASS |
| Unit / DB-API | 255 / 255 · 354 / 354 |
| Full visual suite | 673 passed, 24 skipped (opt-in `pixel-qa-screens` manifest), 0 failed. Library vs full L15 frame: P0 / P1 / P2 = 0 (max outside 0.0111, beyond 0.0114). About: section heights ±7 px; P3 only (photos, gradient approximation, footer 5.73 %) |
| Responsive 1440 / 1024 / 768 / 390 | clean, except PL-07 (`/me` desktop frame below 1024 px, pre-existing) |
| Security | 0 secrets in client chunks; `/library` payload: 0 e-mails, 0 phones, 0 raw `startup.json` fields, websites http(s) only; external links `noopener noreferrer` |

## Deploy
| Item | Value |
|---|---|
| Backup | `onehub-20260928T110146Z.dump` (107,419 B, sha256 `bab8cbf2a7d1…`, 31 table-data entries) |
| Deploy | `deploy.sh 08bbbb9…` exit 0; release content hash identical on both sides (911 files); image `sha256:3d616538131c…e68b87` |
| State | `current` `08bbbb9`, `previous` `c535c35` (image and release kept; `rollback.sh` present) |
| Env | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL` set (values not read); `ENABLE_DEV_ROUTES`, `LEGAL_CONTENT_DIR` unset; container reaches `startup.json` (200, 72 records) |

## Domain smoke (https://1hubnetwork.io.vn)
| Check | Result |
|---|---|
| Routes | `/`, `/about`, `/library`, `/auth`, `/icon.png` (`image/png`, same bytes as the repo icon), `/api/v1/auth/providers` 200; `/favicon.ico` 404 (no `.ico` by design) |
| Homepage links | "Về HUB Network" → `/about` (nav, footer); "Mạng lưới đổi mới sáng tạo" → `/library` |
| About | 46 images at 4 widths, 0 broken / distorted, 34 Humans of HUB portraits, footer 8 / 8, overflow 0; back / forward, filters, CTA → `/auth` |
| Library | tabs Bài toán 6 · Startup 72 · Nhà sáng lập 84; 3 / 2 / 1 / 1 columns; search, facets, "Xem thêm"; overflow 0; payload privacy scan clean |
| Auth | UI request to the PO inbox 202, Resend accepted (`q***@gmail.com`); new persona → `/onboarding/purpose`; `member@example.test` → `/me`, `/me/profile/edit`, `/me/settings`, `/me/privacy`, `/projects/new` 200; guest `/me` → `/auth` |
| Real inbox click | NOT RUN — the PO skipped it. Their click at 11:29:56 UTC opened an older, already-used link (single consume, 409); the new link stayed unused |
| Runtime | #418 0; nginx 5xx 0 since deploy; 499 × 3 (cancelled prefetches); 404 only `/health` (monitor), legal, `/favicon.ico`; one console `ERR_QUIC_PROTOCOL_ERROR` (edge, below) |
| Restart | `docker compose restart app`: healthy, same SHA and image, env present, DB counts unchanged (accounts 15, profiles 12, sessions 112, projects 6, roster 3, migrations 9), `/about` assets and Library data 200 |

## Edge HTTP/3 login defect (EDGE-H3-POST-RESEND)
| Evidence | Finding |
|---|---|
| Symptom | ~1 in 8 operator-link logins in Chrome (7 of 53) end on "Liên kết không còn hiệu lực" with no session |
| Page | sends exactly one `consume` (DevTools and Playwright count 1 every time) |
| Origin | each failure logs two POSTs from the same client in the same second: 200, then 409 |
| Chrome netlog | 38 of 65 POSTs to the domain restart after `ERR_QUIC_PROTOCOL_ERROR` (-356), vs 48 of 1,178 GETs; the resend goes over TCP |
| Edge | the origin (nginx 1.24, no QUIC) sends no `Alt-Svc`; the edge adds `alt-svc: h3=":443"` |
| A / B | QUIC on 7 / 8, QUIC off 8 / 8 |
| Conclusion | the earlier FU-AUTH-DOUBLE-CONSUME diagnosis (a `useRef` remount) is wrong. External go-live item (PO): disable HTTP/3 on the edge or fix its POST handling. No code or release change |

## Blocking gaps
1. `PRODUCTION_LEGAL_CONTENT_REQUIRED`: `/legal/terms`, `/legal/privacy` 404; no production copy exists (PO: deploy, legal = BLOCKER).
2. EDGE-H3-POST-RESEND (edge owner).

External, non-blocking: EDGE-REFERRER (edge rewrites `Referrer-Policy`; origin correct); HEALTH-MONITOR (use `/api/v1/auth/providers`).

## Git
Branch `main`; start HEAD `08bbbb9`, checked again before the commit. Push **NOT RUN**.

## Related
- [TASK-22-PREVIEW-LIBRARY-FIX_library-fix.md](TASK-22-PREVIEW-LIBRARY-FIX_library-fix.md)
- [TASK-22-PREVIEW-ABOUT-DEPLOY_about-deploy.md](TASK-22-PREVIEW-ABOUT-DEPLOY_about-deploy.md)
