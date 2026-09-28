# TASK-22-PREVIEW-03 Real Email Deploy

**TASK 22-PREVIEW-03 — deploy real-email auth preview: DEPLOYED GREEN.** Exact SHA `5a195f72acf05dd6537b6c70ad185e0737acd916` runs on https://1hubnetwork.io.vn. Full server record: `docs/deployment/INTERNAL_ALPHA_PREVIEW_REAL_EMAIL_DEPLOYMENT.md` on `deploy/vps-foundation` `958a2ae`.

## PO decisions during the task
| Question | Answer |
|---|---|
| The requested SHA had 41 characters (`…acd1916`, no such object) | Deploy `5a195f72acf05dd6537b6c70ad185e0737acd916` (tag `internal-alpha-preview-03`) |
| Real test inbox (none was provisioned on the server) | The operator's own Gmail (`q***@gmail.com`) |
| The server wrapper refuses real addresses | Run the same `issue-login-link.mjs` inside the app container; the app's callback creates the account |
| Inbox check (the Gmail connector has no read scope) | The operator confirmed receipt and opened the link in their browser; the server side was verified from the database and the access log |

## Result
| Area | Result |
|---|---|
| Deploy | `deploy.sh` → build (frozen install with the `next@15.5.26` patch, production build, image `sha256:10b9bd13a6fe…`), 9 × migration skip, container recreated, smoke PASS; release content hash equals `git archive` |
| Env | the three variables present in the container; `APP_PUBLIC_BASE_URL` = the domain; sender on the verified domain; no `NEXT_PUBLIC_*`; values not printed |
| Real e-mail | UI request 202 → Resend accepted → operator inbox received → callback → consume → session → `/onboarding/purpose` |
| Completed member | `member@example.test` link → `/me` |
| Negative | unknown address 403, no account / token / e-mail; reused → `used`; expired (> 15 min) → `expired`; malformed → `/auth/error` |
| Demo | Homepage → Login → onboarding → `/me` → profile → settings → privacy → project create / edit / team: PASS |
| Runtime | #418 = 0; unexpected console errors 0; broken assets 0; app 5xx 0 (one Nginx 502 for the external `/health` monitor during the planned restart) |
| Responsive | 1440 clean; 390 clean on home, auth, onboarding, settings, project create; `/me`, `/me/privacy`, project edit keep the desktop frame (PL-07), no hidden control |
| Restart | same SHA, healthy, env present, DB row counts unchanged, domain PASS |
| Rollback | `rollback.sh` → `cc6ca28` (image kept, schema-safe) |

## Follow-ups (non-blocking)
- No approved operator command provisions a real Internal Alpha tester (the wrapper allows `@example.test` only; roster import needs organisation data).
- PL-07 at 390 is conspicuous on `/me` (the main column is squeezed beside the sidebar); planned in 22.10.
- The Gmail connector lacks read scope, so inbox checks need the operator.

## Git
Branch `main`; start HEAD `aa8748a`, checked again before the commit. Deploy branch commit `958a2ae`. Push **NOT RUN**.

## Related
- [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md) · [TASK-22-PREVIEW-AUTH_real-email.md](TASK-22-PREVIEW-AUTH_real-email.md)
