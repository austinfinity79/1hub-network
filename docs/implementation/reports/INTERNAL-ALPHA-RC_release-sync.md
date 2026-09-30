# INTERNAL-ALPHA-RC Release Sync

**POST-DEPLOY RELEASE SYNC: GitHub synced and tagged; smoke-data cleanup IDENTIFIED, NOT RUN (awaiting approval).** Production still runs `ff052d70fe418cb092bd5e33fcc03ee712c76d14` (deploy: [INTERNAL-ALPHA-RC_deploy.md](INTERNAL-ALPHA-RC_deploy.md)). Team UAT pack: [../../uat/INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../../uat/INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md).

## Release state (2026-09-30)
| Item | Value |
|---|---|
| Production | `state/current` and `APP_SHA` = `ff052d70fe418cb092bd5e33fcc03ee712c76d14`; rollback `c02cdd9` |
| `main` | `b81eb95` before this record; fast-forward of `origin/main` `2b59f22` |
| `deploy/vps-foundation` | `dc2ae21`; fast-forward of `origin` `4519a84` |
| Working trees | clean except the untracked `AGENTS.md` |

## Secret scan before push
| Check | Result |
|---|---|
| Range | `main` 2b59f22..b81eb95 (10 commits, 97 files); deploy 4519a84..dc2ae21 (1 commit, 2 files) |
| Files | no `.env` (only `.env.example`), no `.dump`, key, certificate or secrets file |
| Added lines | 0 hits for API-key prefixes, `RESEND_API_KEY=`, private keys, credentialed database URLs, magic-link tokens, bearer tokens, password assignments |
| Addresses | no personal e-mail added (review personas `@example.test` only) |

## GitHub
| Ref | Remote after push |
|---|---|
| `main` | `b81eb9505f86a160d5f0e0e7d61062922bdfae14` (fast-forward; no force) |
| `deploy/vps-foundation` | `dc2ae210691984bd7d67748dcbd59ae05192548a` (fast-forward; no force) |
| Tag `internal-alpha-2026-09-30` (annotated, new) | object `90610d6d…`, peels to **`ff052d70fe418cb092bd5e33fcc03ee712c76d14`** = the deployed SHA. The earlier convention `internal-alpha-preview-NN` stays for previews |

## Smoke-data cleanup
Identified from the deploy report's ids and addresses, the creation window (02:00:36–02:00:45 UTC; the only accounts created on 30/09) and the rows that reference them. No other actor's row references them.

| Entity | Id | E-mail / name | Created (UTC) | Dependents |
|---|---|---|---|---|
| Account A | `5ae7cad8-592c-49b7-b763-b5de9dd889f3` | `smoke-rc-a-mungkft6@example.test` | 02:00:36 | profile, venture, application, 1 session, 2 consents, 3 idempotency keys, analytics, 1 sign-in request, audit |
| Account B | `ee40141e-367a-43f7-ad97-f5970f67fc0f` | `smoke-rc-b-mungkft6@example.test` | 02:00:45 | profile, 1 session, 2 consents, analytics, 1 sign-in request, audit |
| Profiles | `9d124b7c…` · `619fa8e0…` | Smoke RC Founder · Smoke RC Member | 02:00:36 · 02:00:45 | none |
| Venture | `d7163d57-8230-437c-87b6-7dd9a362f197` | SMOKE RC STARTUP mungkft6 (DRAFT, PRIVATE) | 02:00:39 | 1 field row |
| Application | `8b21dcd5-fa7a-499f-b5ed-9c64cecfc2c3` | SUBMITTED | 02:00:39 | 2 audit rows |

Total 33 rows: audit 9, application 1, venture field 1, venture 1, analytics 6, idempotency 3, consents 4, sessions 2, profiles 2, sign-in requests 2, accounts 2. No membership, team, role or leadership row exists for them.

| Step | State |
|---|---|
| Backup | `/opt/1hub-network/shared/backups/onehub-20260930T021349Z.dump` (142 567 bytes, sha256 `3dda033be1409f949dbc69d84f0eaec0763c5afd0004504ffa6fffb170ee361b`) |
| Deletion | **NOT RUN.** A guarded script is prepared: one transaction, identity re-check, each `DELETE` by exact id with its expected row count, any mismatch rolls everything back. The session's permission guard refused the production `DELETE`; it runs only with explicit approval (or by the operator) |
| Preserved | programme `d4000000-…01` (PUBLISHED) and its form; `chapter-01`; review personas; the earlier `smoke-alpha09-*`, `preview*`, `final0*` runs (not in the known list); Library data |

## Domain sanity after the sync
`/`, `/about`, `/library`, `/auth`, `/organizations/chapter-01` 200; `/me` and `/programmes/d4000000-…01/apply` → `/auth` as expected; `/api/v1/session` 200. #418 0, 5xx 0 (browser and Nginx), broken assets 0, console errors 0.

## Related
- [INTERNAL-ALPHA-RC_deploy.md](INTERNAL-ALPHA-RC_deploy.md) · [../INTERNAL_ALPHA_RELEASE_MANIFEST.md](../INTERNAL_ALPHA_RELEASE_MANIFEST.md)
