# WF06-PROD-00_scope-matrix

**WF06-PROD-00 — discovery surfaces, matching, writes, ranking, actors and the proposed P0 scope.** Evidence ids are `DECISION_LOG` lines unless named. Main report: [WF06-PROD-00_runtime-gap-audit.md](WF06-PROD-00_runtime-gap-audit.md).

## Discovery-surface matrix
| Object | SOT | Design | Data | Classification |
|---|---|---|---|---|
| Organization (HUB / Chapter / CLB) public page | Data SOT :88; DEC-WF03-S09-D1..D4 (:972-975) | L19 CHP0 ALPHA (approved baseline) | `organizations`, relationships, memberships (counts), events | SUPPORTED_BY_SOT + DESIGN + DATA; **implemented** (harden) |
| Organization directory (list) | no list rule | L14 ORGP1 FUTURE (HD-08) | `organizations` + `idx_org_type_status` | FUTURE_ONLY |
| Member / profile | PROFILE_DISCOVERY NETWORK_ONLY (D2 / D2A :71-72); "P0 Library is inside the authenticated network" (:71); no public profile in P0 (DEC-WF02-H3 :158-169) | none approved (L10 FP1 FUTURE) | `individual_profiles`, `profile_visibility_settings`, `profile_domains`, region; `projectDiscovery` | SUPPORTED_BY_SOT + DATA, not DESIGN → PO-A |
| Venture (project / startup) | Data SOT :269 public startup data; DEC-PDF-D1 publish → PUBLIC, "grants no read … future" (:1476, :1484) | L44 / L45 SP1 FUTURE; L48–L51 FUTURE | `projects.visibility`, status, `project_domains`, region, stage | SUPPORTED_BY_DATA; SOT defers → PO-B |
| Programme / Challenge | Data SOT :326 "public detail"; DEC-W4P-D10 no public list v1 (:1546) | no directory frame; L28–L36 FUTURE; HD-A6 open | `programmes` (+ `metadata.challenge`), forms | member open list only (WF05); public FUTURE → PO-C |
| Challenge "Bài toán" (Problem entity) | Problem entity FUTURE; HD-A7 open; DEC-2809-D4 L4 = 0 | L15 DIR1 "Bài toán" approved as static demo (DEC-L15-D9) | static JSON, not canonical; WF04 problems are separate (:1542) | FIXTURE_BACKED; canonical version NO_EVIDENCE → PO-D |
| Library startups / founders | DEC-L15-D3 / D7 (:1340, :1344): external feed, "no venture or profile of our database is read" | L15b / L15c approved | external `startup.json` | external showcase; canonical version → PO-A / PO-B / PO-D |

## Matching / recommendation evidence
No documented rule: no target, actor, inputs, ranking, score, or AI / deterministic definition anywhere. Explicitly deferred or excluded: DEC-WF06 (:1171-1172), DEC-L6-D1 "MATCHING ENGINE: DEFERRED" (:1330, `task-24/l6-ecosystem-features.md:26`), DEC-AIG-D5 "no global, AI or matching search" (:1506), API §15 (:1165), Data SOT §14 (:426), Arch 01 :258, WF01 non-goals. Drawn but rule-less: jury scores (L46), "cách 60km" (L52), HUB-verified badge (L48–L51). Code: none (only Library sorts and facet frequency). **Matching is OUT of P0.**

## Write boundary
| Action | Status | Evidence |
|---|---|---|
| request organization membership (`POST /me/membership-requests`, from the org page) | APPROVED_P0 (WF02 / WF03, existing) | API :525-537; DEC-WF03-S09 :975 |
| profile discovery visibility (`PUT /me/visibility`) | APPROVED_P0 (WF01 / WF02, existing) | D2 :71 |
| venture publish | APPROVED_P0 (WF02, existing) | DEC-PDF-D1 |
| follow / connect / ConnectionRequest | FUTURE | Data SOT :121; DEC-WF06 :1173; DEC-AIG-D8 not drawn (:1509) |
| save / bookmark | NO_EVIDENCE | — |
| "Ủng hộ", data-room request, L6 "Ứng tuyển", event registration | FUTURE | l6-ecosystem-features :12-16, :32-33 |
WF06 adds no write.

## Ranking boundary
| List | DEFAULT_SORT | FILTER | RANKING |
|---|---|---|---|
| Library problems | deadline (approved "Sắp hết hạn"), alternatives prize / name | domain, stage, area (client, raw strings) | none |
| Library startups / founders | stage / name | category, stage / domain | none |
| Org page children; events | name (vi); `starts_at`, limit 6 | — | none |
| Member open programmes (WF05) | `starts_at`, name | — | none |
| Proposed member / venture / programme directory | PO_DECISION_REQUIRED (proposal name A→Z, id tiebreak) | vocabulary ids (domain, region, stage, type) | none |

## Actor matrix
| Actor | Surface | Allowed read / action | Evidence |
|---|---|---|---|
| Guest | `/library`, `/organizations/:slug`, home search | read; org page without persons; "Xin vào" → sign-in | DEC-L15-D2, DEC-WF03-S09 |
| Member (onboarding DONE) | the above + `/me/roles`, `/me/network`, S01 open programmes | own relations; request membership; manage own discovery visibility | API :525-537; D2 |
| Venture owner / ACTIVE team member | WF02 / WF05 venture screens | own venture only; no public venture read | DEC-PDF-D1 |
| Ops (`member:read`, `programme:read`) | `/ops/*` | scoped lists; identities via `projectDiscovery(NETWORK)` | DEC-WF03 :757, :919 |
No new actor is proposed.

## Proposed P0 runtime scope
| Bucket | Items |
|---|---|
| IN_P0 | harden the existing layer: public organization page (L19), Library as approved (L15 / L15b / L15c) with S1 / S2 governed, home search → Library, vocabularies API reuse; no new route |
| PO_DECISION_REQUIRED | PO-A member directory; PO-B public venture discovery; PO-C programme / challenge discovery; PO-D Library data source and founder exposure |
| OUT_OF_P0 | matching, recommendation, ranking, AI / global search, follow / connect / save, investor discovery, data room, analytics, data flywheel, Admin Portal, Sprint1 UAT items |
| FUTURE | L6 L46–L54, L10, L14, L28–L36, L44 / L45, L48–L51, Problem entity |

## Related
- [WF06-PROD-00_runtime-gap-audit.md](WF06-PROD-00_runtime-gap-audit.md) · [WF06-PROD-00_data-visibility.md](WF06-PROD-00_data-visibility.md) · [WF06-PROD-00_gap-matrix.md](WF06-PROD-00_gap-matrix.md)
