# Demo app image retention

OPS-DOCKER-IMAGE-RETENTION-01. Why: on 2026-10-08 the VPS disk reached 100 % (ENOSPC in the Next image cache) after 14 accumulated `hubnetwork-demo-0710-app` images (~1.5 GB each). Scope: the demo app on `hub-vps`, project `hubnetwork_demo_0710` (`/opt/hubnetwork-demo-0710`), which serves both public domains.

| Rule | Value |
|---|---|
| Keep | the LIVE image (`APP_SHA` in `.env`) + the 2 newest earlier releases that were live before (a `.env.rollback-<sha7>` exists) |
| Remove | every other `hubnetwork-demo-0710-app:<40-hex sha>` image, with `docker image rm` (never `-f`) |
| Never touch | volumes, containers, the build cache, other repositories (`onehub-app`, `postgres`, `node`), `releases/`, `.env.rollback-*` |
| Pre-deploy minimum | 6 GiB free (FAIL below), WARN below 12 GiB |

## Scripts
Source in Git: `deploy/demo-0710/bin/`; installed copies: `/opt/hubnetwork-demo-0710/bin/` (same sha256). Both refuse to run outside the demo project.

| Command (in `/opt/hubnetwork-demo-0710`) | Does |
|---|---|
| `bin/disk-precheck.sh [min_gib]` | read-only: free space, app image count, `docker system df`; exit 1 below the minimum |
| `bin/image-retention.sh` | dry run: prints LIVE, the 2 ROLLBACK images with their rollback command, OBSOLETE ones |
| `bin/image-retention.sh --apply` | removes the OBSOLETE images only; refuses if the running app is not `APP_SHA`, if fewer than 2 rollbacks exist, or `--keep` < 2; an image any container uses is kept; rerun-safe |

## Deploy sequence
```
bin/disk-precheck.sh || bin/image-retention.sh --apply   # then re-check
# build + switch as usual (git archive → releases/<sha> → docker build → .env.rollback-<prev> → APP_SHA → compose up)
bin/image-retention.sh --apply                            # keeps the new live + 2 rollbacks
```

## Rollback
`bin/image-retention.sh` prints the ready command per kept image, e.g. `cp .env.rollback-<sha7> .env && docker compose up -d --no-deps app`. Older `.env.rollback-*` files whose image was removed need a rebuild from `releases/<sha>` first.

## Not done (needs a decision)
The BuildKit cache (21.7 GB, 17.7 GB reclaimable on 2026-10-08) is shared with the `onehub` builds on the same daemon; it is not pruned here. `docker builder prune --filter until=168h` would reclaim most of it at the cost of slower next builds for both stacks.

## Related
- [DEMO_DEPLOY_ROLLBACK_CHECKLIST](../demo-0710/qa/DEMO_DEPLOY_ROLLBACK_CHECKLIST.md) · [PROGRAMME-PRESENTATION-DATA-01](../implementation/reports/PROGRAMME-PRESENTATION-DATA-01.md) (disk incident)
