# About HUB Lead Deployment

Record of the release that shows Le Phuong Thao as TRƯỞNG HUB for HUB HN in the `/about` HUB structure panel. DEPLOYED. Governing record on `main`: `docs/implementation/reports/ABOUT-HUB-LEAD_deploy.md`.

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `c02cdd9ba4ab6b84bf87a569c02c608cc62804a0` |
| Previous / rollback SHA | `ec33ee258acb1d5d832c211d6efb1732e6cde8c4` (`rollback.sh`) |
| Image | `onehub-app:c02cdd9ba4ab6b84bf87a569c02c608cc62804a0` |
| Deployed | 2026-09-29, verified 11:16 UTC |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260929T111338Z.dump`; migrations 001–012 skip; no seed |
| `/about` on the domain | 200; HN panel portrait loaded, name and role visible; other HUBs unchanged; broken images 0 |
| Runtime | #418 0; console errors 0; Nginx 5xx since deploy 0 |

## Related

- [ABOUT_IMAGE_DEPLOYMENT.md](ABOUT_IMAGE_DEPLOYMENT.md) — ec33ee2
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
