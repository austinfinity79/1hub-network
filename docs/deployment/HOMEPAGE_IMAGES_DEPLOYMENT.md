# Homepage Images Deployment

Record of the release that replaces the homepage event, programme and pipeline placeholder art with the Hub's own photos. DEPLOYED GREEN. Governing record on `main`: `docs/implementation/reports/HOMEPAGE-IMAGES_deploy.md`.

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `91ba7a8de792bb7e382a94050f620c1f61bc8bc5` |
| Previous / rollback SHA | `b3feee7e354e9692e2eda05f099215c785c59681` (image and sources kept; `rollback.sh` returns to it) |
| Contents | `public/home/*.webp` (7), landing activity cards, `p0-landing` pixel mask |
| Tooling | `deploy/vps-foundation`; scripts unchanged |
| Image | `onehub-app:91ba7a8de792bb7e382a94050f620c1f61bc8bc5` |
| Deployed | 2026-09-29, verified 10:22 UTC |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260929T101820Z.dump`, 130 017 bytes, sha256 `4e97c3d9…a6d051`, verified by `pg_restore --list` |
| Migrations | 001–012 skip; no seed |
| Server smoke | `/auth`, providers, session, `/dev/typography` 404, REGION vocabulary |
| Domain | `/` 200; `/home/*.webp` 7 / 7 and `/_next/image` variants 7 / 7 200 `image/webp`; 1440 and 390: 7 / 7 pictures loaded, no layout shift, no overflow |
| Runtime | #418 0; Nginx 5xx since deploy 0 (404 only `/health`); app log errors 0 |

## Related

- [INTERNAL_ALPHA_L1_L2_DEPLOYMENT.md](INTERNAL_ALPHA_L1_L2_DEPLOYMENT.md) — b3feee7
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
