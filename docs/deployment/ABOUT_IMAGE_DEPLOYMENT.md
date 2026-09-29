# About Image Deployment

Record of the release that replaces the `/about` mission 03 placeholder with the supplied Vietnam digital network picture. DEPLOYED GREEN. Governing record on `main`: `docs/implementation/reports/ABOUT-IMAGE_deploy.md`.

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `ec33ee258acb1d5d832c211d6efb1732e6cde8c4` |
| Previous / rollback SHA | `2c6cc4ac4f42df252d81afc467ec541c622a07af` (image and sources kept; `rollback.sh` returns to it) |
| Contents | `public/about/about-data-platform-vietnam.webp` (1600 × 900, 160 316 B), `about-data.ts` mission 03 photo |
| Tooling | `deploy/vps-foundation`; scripts unchanged |
| Image | `onehub-app:ec33ee258acb1d5d832c211d6efb1732e6cde8c4` |
| Deployed | 2026-09-29, verified 11:06 UTC |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260929T110300Z.dump` |
| Migrations | 001–012 skip; no seed; no database change |
| Server smoke | `/auth`, providers, session, `/dev/typography` 404, REGION vocabulary |
| `/about` on the domain | 200; asset 200 `image/webp`; picture loaded and filling the 03 frame at 1440 / 1024 / 768 / 390; placeholder caption gone; broken images 0; overflow 0; CLS 0 |
| Runtime | #418 0; console errors 0; Nginx 5xx since deploy 0 (404 only `/health`); app log errors 0 |

## Related

- [LIBRARY_DATA_DEPLOYMENT.md](LIBRARY_DATA_DEPLOYMENT.md) — 2c6cc4a
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
