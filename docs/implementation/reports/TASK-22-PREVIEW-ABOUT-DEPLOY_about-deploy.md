# TASK-22-PREVIEW-ABOUT-DEPLOY About Deploy

**TASK 22-PREVIEW-ABOUT-DEPLOY — About page + homepage link + deploy: DEPLOYED GREEN.** `04795794cd72e70c58652dfa037a4c2fab6c0304` (tag `internal-alpha-preview-04`) runs on https://1hubnetwork.io.vn. Server record: `deploy/vps-foundation`, `docs/deployment/INTERNAL_ALPHA_PREVIEW_ABOUT_DEPLOYMENT.md`.

## Precheck
| Item | Finding |
|---|---|
| Concurrency | `main` clean (only the untracked `AGENTS.md`); About worktree `feat/about-page` clean; the other local session idle; HEAD `3f5fbc2` stable |
| Content | HEAD contains `5a195f7` (real e-mail auth), `4d1e2dd` (About; patch-equal to `0b8baa9`), `0479579` (About photos + homepage link) |
| Homepage link | Already committed in `0479579` ("Về HUB Network" nav and footer → `/about`). The saved `homepage-about-link.patch` no longer applies and also added `data-cta="about"`; only the destination change was kept, as instructed |
| Deployed baseline | the server ran `5a195f7…acd916`. The prompt spelled it with 41 characters (`…acd1916`, the same typo the PO resolved in TASK 22-PREVIEW-03) |
| Scope since baseline | About components, `src/app/(public)/about`, `landing.tsx` and `public/about` only; `db/`, dependencies, `patches/`, `next.config.ts` unchanged |

## QA
| Gate | Local (production build) | Domain |
|---|---|---|
| Gates | format, lint, typecheck, build PASS; unit 245 / 245 | — |
| Regression | 129 / 129: P0-LANDING 10, P0-SHELL 14, shell-routes 33, WF01-S01 13, S02 14, S03 15, e-mail flow 5, auth-session 13, authz-session 8, console-health 4 | — |
| `/about` | 200 for guests, refresh, back / forward | same |
| Sections | hero, mission, values, scale (HUB Tổng), organisation, Humans of HUB, timeline (6 milestones, 5 photos), activities (filters work), closing CTA reachable, footer | same |
| Assets | 46 images, 0 broken, 0 distorted, 43 lazy (hero eager); 34 portraits inside the organisation section | same |
| Responsive 1440 / 1024 / 768 / 390 | overflow 0; off-screen controls 0; footer links 8 / 8 | same |
| Homepage | "Về HUB Network" → `/about` at 1440 and 390 | same |
| Auth | e-mail flow spec A–E PASS | UI request for the operator's test inbox 202, Resend accepted; new persona → `/onboarding/purpose`; `member@example.test` → `/me`, L2 routes 200; guest `/me` → `/auth` |
| Runtime | #418 0; console errors 0; 4xx / 5xx 0 | #418 0; console errors 0; Nginx 5xx 0 |
| Restart | — | same SHA, healthy, env present, DB row counts unchanged, `/about` and assets 200 |

## Observation (pre-existing, non-blocking for this deploy)
On the domain one callback of eight today (08:07:46 UTC, a headless run) sent `consume` twice: 200 (session created), then 409, so the page showed the "used" state although the session existed; the retry landed on `/me`. The guard in `callback-screen.tsx` is a `useRef`, which does not survive a remount. The code is unchanged since `5735d78` and identical in the baseline, and this task forbids auth changes, so it is recorded as follow-up **FU-AUTH-DOUBLE-CONSUME**. If a user hits it, opening `/me` works.

## Git
| Field | Value |
|---|---|
| About commits | `4d1e2dd` (page), `0479579` (photos + homepage link) |
| NEW APP PREVIEW SHA | `04795794cd72e70c58652dfa037a4c2fab6c0304` (tag `internal-alpha-preview-04`) |
| ROLLBACK SHA | `5a195f72acf05dd6537b6c70ad185e0737acd916` (image and sources kept) |

Branch `main`; start HEAD `3f5fbc2`, checked again before each commit. Push **NOT RUN**.

## Related
- [TASK-22-PREVIEW-ABOUT-PHOTOS_about-photos.md](TASK-22-PREVIEW-ABOUT-PHOTOS_about-photos.md) · [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md)
