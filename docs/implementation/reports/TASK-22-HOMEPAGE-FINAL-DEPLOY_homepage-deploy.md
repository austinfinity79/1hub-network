# TASK-22-HOMEPAGE-FINAL-DEPLOY Homepage Deploy

**TASK 22-HOMEPAGE-FINAL-DEPLOY — homepage alignment deployed: DEPLOYED GREEN.** `3fd00e4c30103aa6ffcc36753c6b5f11324948e9` (tag `internal-alpha-preview-07`) runs on https://1hubnetwork.io.vn. Overall release: NOT READY, the edge blockers remain. Server record: `deploy/vps-foundation`, `docs/deployment/INTERNAL_ALPHA_HOMEPAGE_DEPLOYMENT.md`.

## Precheck
| Item | Finding |
|---|---|
| Homepage commit | `3fd00e4…` "fix(homepage): align content with latest Figma", read from git; its parent is `2033264…` |
| Deployed baseline | `2033264…` (legal), previous `08bbbb9…`; app and DB healthy |
| Merge | none needed: the baseline is an ancestor of the homepage commit; `db/`, dependencies, `patches/`, `next.config.ts`, `content/`, `public/`, `src/app`, `src/lib` identical between the two |
| Later commits | `83b2e12` is docs only, so the app sources at HEAD equal `3fd00e4` |
| Concurrency | `main` clean except the untracked `AGENTS.md`; no other session wrote; HEAD stable |

## QA before deploy (rebuilt from the exact sources)
| Gate | Result |
|---|---|
| Targeted specs | 131 / 131: P0-LANDING 10, shell 14 + 33, Library 13, WF01-S01 13, e-mail flow 5, auth-session 13, authz 8, console-health 4, root 4, WF02-S01 14 |
| Homepage evidence (`3fd00e4`) | pixel P0 / P1 / P2 = 0 over 16 segments; format, lint, typecheck, build PASS; unit 257 / 257 |

## Deploy
| Item | Value |
|---|---|
| Backup | `onehub-20260928T152004Z.dump` |
| Deploy | `deploy.sh 3fd00e4…` exit 0, 15:20 → 15:23 UTC; migrate 9 × skip; no seed |
| Identity | release content hash equal on both sides (923 files, `b562fb474bafa4b2`) |
| Image | `sha256:34f4403f693649ac7a6677f1e5404d0db70810218a9a8cdb21086f2e8c850f3f` |
| State | `current` `3fd00e4`, `previous` `2033264` (image and release kept; `rollback.sh` present) |
| Env | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`, `LEGAL_CONTENT_DIR` set; dev routes off; values not read |

## Domain checks
| Check | Result |
|---|---|
| Render | the domain capture equals the verified local capture pixel for pixel (1440 × 12636, 0 differing pixels) |
| Removed copy | none of the six PO removals is in the rendered text |
| Required content | 13 sections in reference order; hero, strip, short Điểm nghẽn copy, four solution cards, value rows, 3 + 3 + 3 rail cards, One profile, doors, community numbers and card, closing, footer |
| Partner matrix | five categories, placeholder names, label "Dữ liệu minh hoạ", 0 links, 0 logos |
| Navigation | "Về HUB Network" → `/about`; "Mạng lưới đổi mới sáng tạo" → `/library`; "Đăng nhập", "Tạo tài khoản" → `/auth`; "Tìm hiểu về HUB Network" → `/about`; legal links 200 |
| Responsive 1440 / 1024 / 768 / 390 | overflow 0; hero controls reachable; rails and matrix scroll; buttons work |
| Preserved | About 46 images, 34 portraits; Library 6 · 72 · 84, `startup.json` 200 (72); favicon bytes equal the repository icon; guest `/me` → `/auth` |
| Auth | real e-mail request 202, Resend accepted (`q***@gmail.com`); new persona → `/onboarding/purpose`; `member@example.test` → `/me`, L2 routes 200 |
| Runtime | #418 0; console errors 0; broken assets 0 |
| Restart | healthy, same SHA and image, env present, DB counts unchanged (accounts 16, profiles 12, sessions 114, projects 6), assets 200 |

## HTTP 5xx
| When (UTC) | What | Assessment |
|---|---|---|
| 15:27:27 | 2 × 504 on `/_next/image` (two About photos, `w=640`) | the image cache is empty after a deploy and the four-width About check asked for many sizes at once; both files answer 200 in under a second since, and two later runs gave 69 / 69 image responses 200. Follow-up FU-IMAGE-CACHE: keep the image cache across deploys or warm it |
| 15:30:16 | 1 × 502 on `/health` | the edge health check hit the planned restart |
| after 15:31 | 0 | — |

## Outstanding release blockers (checked 16:14 UTC)
| Item | State |
|---|---|
| Legal | CLOSED: `/legal/terms`, `/legal/privacy` 307 → 200 |
| HTTP/3 | OPEN: `alt-svc: h3=":443"; ma=7200` still served (EDGE-H3-POST-RESEND) |
| Referrer-Policy | OPEN: edge value `strict-origin-when-cross-origin` |
| Monitor | OPEN: still `GET /health` → 404; canonical `/api/v1/auth/providers` → 200 |

## Git
Branch `main`; start HEAD `83b2e12`, checked again before the commit. Push **NOT RUN**.

## Related
- [TASK-22-HOMEPAGE-FINAL-ALIGN_homepage-align.md](TASK-22-HOMEPAGE-FINAL-ALIGN_homepage-align.md)
- [TASK-22-FINAL-BLOCKER-CLOSURE_blocker-closure.md](TASK-22-FINAL-BLOCKER-CLOSURE_blocker-closure.md)
