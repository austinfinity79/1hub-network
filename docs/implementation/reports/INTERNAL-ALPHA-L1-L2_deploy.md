# INTERNAL-ALPHA-L1-L2 Deploy

**FINAL INTERNAL ALPHA — INTEGRATE UAT + LIBRARY HOTFIX + FREEZE + DEPLOY: DEPLOYED GREEN.** `b3feee7` runs on https://1hubnetwork.io.vn. Internal Alpha, not full business completeness: the [Alpha backlog](../l1-l2-realign/alpha-backlog.md) stays open.

## Integration
| Input | Commit | State |
|---|---|---|
| L1 (WF01) | `5fcbae1` … `5d8cf56` | GREEN |
| L2 (WF02) | `c9c7cb5` … `6686468` | GREEN |
| PO decision freeze | `0e39f94`, `2999c04` | GREEN |
| Thảo business UAT | `da685b3` | PASS 10, FAIL 0, DEFERRED 1 (invitation by link) |
| Library layout hotfix | `b6aa0fa` = cherry-pick of `c1b60c3` (`fix/library-layout`), no conflict | GREEN |
| Alpha backlog | `b3feee7` | docs |

## Gates on the integrated build
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| Library suite | 15 / 15 (layout, tabs, filters, search, sort, Startup, Nhà sáng lập, Bài toán, `startup.json`, L15 pixel) |
| Thảo UAT | 19 / 19 tests, 10 use cases, 53 s |
| Route smoke | `/`, `/about`, `/library`, `/auth`, `/me`, `/projects` at 1440 / 1024 / 768 / 390: #418 0, 4xx / 5xx 0, overflow 0 |
| Unit / DB | unchanged code since 254 / 254 and 448 / 448 (only UAT specs, Library CSS and docs changed) |

## Release
| Item | Value |
|---|---|
| Previous deployed SHA | `935fd4ada12160f744d87c64bcf17409309401a0` (favicon hotfix) |
| Deployed SHA | `b3feee7e354e9692e2eda05f099215c785c59681` (tag `internal-alpha-preview-09`, local) |
| Rollback SHA | `935fd4a` (`rollback.sh`; migrations 010–012 stay, additive) |
| DB backup | `/opt/1hub-network/shared/backups/onehub-20260929T100004Z.dump` (119 447 bytes, sha256 `a2148896…7f3a`) |
| Migrations | 010, 011, 012 applied; no seed |
| Domain smoke | 43 / 43 steps; #418 0; Nginx 5xx 0; restart kept SHA, env and data |
| Record | `docs/deployment/INTERNAL_ALPHA_L1_L2_DEPLOYMENT.md` on `deploy/vps-foundation` (`d0af6ea`) |

Smoke data left on the server: two `smoke-alpha09-…@example.test` accounts, `SMOKE PROJECT` (DRAFT) and `SMOKE STARTUP` (PUBLIC), one REMOVED invitation to Resend's sandbox address. Production reference data is still the review seed for REGION (3), DOMAIN (2), SKILL (2).

## Related
- [../l1-l2-realign/alpha-backlog.md](../l1-l2-realign/alpha-backlog.md) · [../l1-l2-realign/po-decision-freeze.md](../l1-l2-realign/po-decision-freeze.md) · [TASK-22-L1-L2-PO-DECISION-FREEZE.md](TASK-22-L1-L2-PO-DECISION-FREEZE.md)
