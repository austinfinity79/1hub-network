# TASK-22-FAVICON-HOTFIX Favicon Hotfix

**HOTFIX FAVICON — deploy to VPS: DEPLOYED GREEN.** `935fd4ada12160f744d87c64bcf17409309401a0` (tag `internal-alpha-preview-08`) runs on https://1hubnetwork.io.vn. Overall release stays NOT READY (edge blockers). Server record: `deploy/vps-foundation`, `docs/deployment/INTERNAL_ALPHA_FAVICON_DEPLOYMENT.md`.

## Source
| Item | Value |
|---|---|
| Prompt path | `/mnt/data/favicon-32x32(1).png` does not exist on this machine |
| File used | `favicon-32x32.png` of the package `favicon_io (1).zip` (downloaded 28/09 23:39, the newest; the same bytes lie on the Desktop) |
| Image | 32 × 32 PNG, 1,881 B, sha256 `654523e7ca1b4aa494f99cd5d72bd3e2245f1a7495130c755994f95e71fcf717` |
| Replaced | sha256 `74b35bcf154e…` (2,279 B, `08bbbb9`) |
| Treatment | copied byte for byte; nothing redrawn or recoloured |

## Favicon setup
| Item | Finding |
|---|---|
| Canonical asset | `src/app/icon.png` (Next.js file convention) → `<link rel="icon" href="/icon.png?<content hash>" type="image/png" sizes="32x32">` on every page |
| `src/app/favicon.ico`, `public/favicon*` | none |
| `metadata.icons`, manifest, apple-touch icon | none |
| Overrides | none to remove |

## QA
| Gate | Result |
|---|---|
| Gates | format, lint, typecheck, build PASS; unit 257 / 257 |
| Targeted specs | 73 / 73 (P0-LANDING 10, console-health 4, WF01-S01 13, shell-routes 33, Library 13) |
| Scope | the commit holds `src/app/icon.png` only; against the deployed `3fd00e4` the release differs by that file and docs |

## Deploy
| Item | Value |
|---|---|
| Backup | `onehub-20260928T164551Z.dump` |
| Deploy | `deploy.sh 935fd4a…` exit 0, 16:45 → 16:48 UTC; migrate 9 × skip |
| Image | `sha256:b66cfffdd49d4795d6835313a2314021d795d7095bd8ebdd187390775b41e31e` |
| State | `current` `935fd4a`, `previous` `3fd00e4` (image kept, `rollback.sh` present) |
| Env / DB | env keys present; row counts unchanged |

## Domain checks
| Check | Result |
|---|---|
| Link tag on `/`, `/auth`, `/about`, `/library` | `/icon.png?18acfe949f7832f0`, one icon link, no other icon or manifest link |
| Asset at that address | 200 `image/png`, bytes equal the new file on all three edge nodes |
| Fresh browser context (no cache) | the declared icon loads and decodes 32 × 32 on the four pages |
| Pages | `/`, `/auth`, `/about`, `/library` 200 |
| Runtime | #418 0; console errors 0; 4xx / 5xx in the browser 0; Nginx 5xx since deploy 0 |

## Observations
| Item | Detail |
|---|---|
| Bare `/icon.png` | two of three edge nodes still serve the previous icon from cache (`x-cache-status: HIT`, `max-age=31536000`). No page links to the bare address; purge `/icon.png` in the OneShield panel to clear it |
| Corners | the supplied image is fully opaque: its 24 corner pixels are black where the previous icon was transparent, so dark corners show on a light tab strip |
| `/favicon.ico` | 404 as before (no `.ico` in the app); the package contains one if it is wanted |
| Tab icon by eye | not captured by the automated check; confirm in a private window |

## Git
Branch `main`; start HEAD `63123ce`, checked again before each commit. Push **NOT RUN** for this task.

## Related
- [TASK-22-HOMEPAGE-FINAL-DEPLOY_homepage-deploy.md](TASK-22-HOMEPAGE-FINAL-DEPLOY_homepage-deploy.md)
