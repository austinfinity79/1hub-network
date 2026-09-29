# Library Data Deployment

Record of the release that puts the supplied problem dataset in the Library "Bài toán" tab and removes the public data-source labels from all three Library tabs. DEPLOYED GREEN. Governing records on `main`: `docs/implementation/reports/LIBRARY-DATA_deploy.md`, DEC-L15-D9.

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `2c6cc4ac4f42df252d81afc467ec541c622a07af` |
| Previous / rollback SHA | `91ba7a8de792bb7e382a94050f620c1f61bc8bc5` (image and sources kept; `rollback.sh` returns to it) |
| Contents | `src/lib/library/dir-bai-toan.json` (47 problems) and its adapter, Library view model and client, `public-library` spec |
| Tooling | `deploy/vps-foundation`; scripts unchanged |
| Image | `onehub-app:2c6cc4ac4f42df252d81afc467ec541c622a07af` |
| Deployed | 2026-09-29, verified 10:52 UTC |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260929T104837Z.dump`, 130 017 bytes, sha256 `cd41a4a3…66be1f`, verified by `pg_restore --list` |
| Migrations | 001–012 skip; no seed; no database change |
| Server smoke | `/auth`, providers, session, `/dev/typography` 404, REGION vocabulary |
| Library on the domain | `/library` 200; Bài toán 47 (all reachable, dataset order), 27 domains / 4 stages / 4 areas matching the records, Logistics 3, search "mobifone" 7, no prize / team / countdown invented; Startup 72, Nhà sáng lập 84; no source wording on any tab or in the HTML |
| Widths | 1440 / 1024 / 768 / 390: overflow 0, broken images 0 |
| Runtime | #418 0; console errors 0; Nginx 5xx since deploy 0 (404 only `/health`); app log errors 0 |

## Related

- [HOMEPAGE_IMAGES_DEPLOYMENT.md](HOMEPAGE_IMAGES_DEPLOYMENT.md) — 91ba7a8
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
