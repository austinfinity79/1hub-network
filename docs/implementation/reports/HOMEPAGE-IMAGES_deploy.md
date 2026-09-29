# HOMEPAGE-IMAGES Deploy

**HOMEPAGE IMAGE REPLACEMENT + DEPLOY: DEPLOYED GREEN.** `91ba7a8` runs on https://1hubnetwork.io.vn. The homepage event, programme and pipeline cards show the Hub's own photos; layout, copy, links and logic are unchanged.

## Images
| Card | Asset (`public/home/`) | Size |
|---|---|---|
| Event 1 — HUB Demo Day 2026 | `event-hub-demo-day.webp` | 1200×799, 64 KB |
| Event 2 — Final Pitch — Open Innovation | `event-final-pitch-open-innovation.webp` | 1200×675, 109 KB |
| Event 3 — Founders & Mentors Night | `event-founders-mentors-night.webp` | 1200×800, 176 KB |
| Programme — APEC Innovation Challenge | `programme-apec-innovation-challenge.webp` | 1200×675, 62 KB |
| Programme — Fintech Challenge Vietnam | `programme-fintech-challenge-vietnam.webp` | 943×531, 37 KB |
| Programme — Honda Challenge | `programme-honda-challenge.webp` | 1200×800, 163 KB |
| Pipeline — iHUB Ventures | `pipeline-ihub-ventures.webp` | 1240×593, 70 KB |

Source: the PO's ZIP of 8 pictures (about 4.8 MB), mapped by file name, now 680 KB in total. The Kawai competition picture has no card and is not used; no card was added. Pictures render with `next/image`, `object-fit: cover`, over the existing gradients; a light top shade keeps the date and tag legible.

## Gates
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| `p0-landing` | 10 / 10; H1 pixel masks the replaced pictures as an intentional difference (max 0.99 % outside text, 1.44 % beyond ±2 px) |
| Visual 1440 / 390 | 7 / 7 pictures loaded; section heights equal before and after load; CLS 0 / 0.0014; overflow 0; #418 0 |

## Release
| Item | Value |
|---|---|
| Deployed SHA | `91ba7a8de792bb7e382a94050f620c1f61bc8bc5` |
| Previous / rollback SHA | `b3feee7e354e9692e2eda05f099215c785c59681` (`rollback.sh`) |
| DB backup | `onehub-20260929T101820Z.dump` (130 017 bytes, sha256 `4e97c3d9…a6d051`); no migration, no seed |
| Domain | `/` 200; 7 / 7 `/home/*.webp` and their `/_next/image` variants 200 `image/webp`; broken assets 0; #418 0; Nginx 5xx 0 (404 only the OneShield `/health` probe); app log errors 0 |

## Related
- [INTERNAL-ALPHA-L1-L2_deploy.md](INTERNAL-ALPHA-L1-L2_deploy.md) — previous release
