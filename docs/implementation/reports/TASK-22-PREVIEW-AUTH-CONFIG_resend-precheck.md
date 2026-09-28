# TASK-22-PREVIEW-AUTH-CONFIG Resend Precheck

**TASK 22-PREVIEW-AUTH-CONFIG — Resend domain + server env precheck: BLOCKED CONFIGURATION.** Verification only: no product code, no DNS change, no server change. No secret was read, printed or stored.

## Resend DNS (public, 1.1.1.1 and 8.8.8.8 agree, 2026-09-28)
| Record | Value | Result |
|---|---|---|
| DKIM `resend._domainkey.1hubnetwork.io.vn` TXT | RSA public key (`p=…`, 218 chars) | published |
| `send.1hubnetwork.io.vn` CNAME | `send.forge.rmta.net` (resolves to SPF `v=spf1 ip4:… ~all` and MX 10 `feedback.forge.rmta.net`) | published |
| `rsend.1hubnetwork.io.vn` CNAME | `rsend-apne1.forge.rmta.net` | published |
| `_dmarc.1hubnetwork.io.vn` TXT | none | optional, recommended `v=DMARC1; p=none;` |

`forge.rmta.net` is Resend's own sending infrastructure ("Forge", which replaced Amazon SES), so the records match a Resend domain setup. **Resend-side status (Verified / Pending) cannot be read without an API key or the dashboard.**

## Server env (read-only, presence only)
- Convention: `/opt/1hub-network/shared/env/app.env` (mode 600, root), loaded by `compose.yaml` `env_file: ../shared/env/app.env`; not managed by `deploy.sh` / `release.sh`, so editing it is an operator step.
- `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`: **missing** in `app.env` and absent in the running container. Also absent from the local environment.

## Secret safety
- Git (all branches, full history): 0 key-like strings, 0 `RESEND_API_KEY=value` additions; working tree 0; only `.env.example` exists (no secrets).
- `deploy/Dockerfile`, `deploy/compose.yaml`: 0 mentions; `src`: 0 `NEXT_PUBLIC_*`, 0 provider variables.
- Server app logs (all retained): 0 key-like strings.

## Operator steps
1. Resend dashboard: confirm `1hubnetwork.io.vn` is **Verified**; create a sending-only API key restricted to that domain.
2. On the server, edit `/opt/1hub-network/shared/env/app.env` with an editor (not `echo`, to keep the key out of shell history) and add:
   - `RESEND_API_KEY=<key from the dashboard>`
   - `EMAIL_FROM="1Hub Network <no-reply@1hubnetwork.io.vn>"`
   - `APP_PUBLIC_BASE_URL=https://1hubnetwork.io.vn`
3. Keep the file mode 600. The next deploy (or `docker compose up -d --force-recreate app` in `/opt/1hub-network/app`) loads it.
4. Name an operator-approved test recipient for the first real delivery.

## Related
- [TASK-22-PREVIEW-AUTH_email-config-stop.md](TASK-22-PREVIEW-AUTH_email-config-stop.md) · [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md)
