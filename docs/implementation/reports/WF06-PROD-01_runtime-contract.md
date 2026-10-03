# WF06-PROD-01_runtime-contract

**WF06-PROD-01 — frozen WF06 P0 runtime contract.** 2026-10-04, branch `feat/wf06-prod-hardening` on `7004732`. Frozen on the PO's confirmed decisions (in chat, 2026-10-04): **D1 member directory NO · D2 public venture discovery NO · D3 public programme / challenge discovery NO · D4 Library source = canonical system data; founders only where canonical venture and profile visibility permit.** Recorded as [DEC-W6P-D01–D05](../../decisions/DECISION_LOG.md#dec-w6p). API / data / test details: [WF06-PROD-01_api-data-contract.md](WF06-PROD-01_api-data-contract.md); allowed work: [WF06-PROD-01_implementation-handoff.md](WF06-PROD-01_implementation-handoff.md).

## Preflight
`feat/wf06-prod-hardening`, HEAD `7004732` (WF06-PROD-00), tree clean except `AGENTS.md`; PROD-00 docs (4) present; WF04 `f40f70c` and WF05 `8c1fbd6` candidates in HEAD; migrations 001–016; `origin/main` and production `78f21f2`; no Claude B / shell lane. PO values match the contract exactly.

## P0 surfaces (no new page, route or nav entry)
| Surface | Route | Actor | Canonical source | Current → target | Search / filter | Visibility | Empty / error / loading |
|---|---|---|---|---|---|---|---|
| Library — Startup | `/library` (tab) | guest, member | `projects` STARTUP, ACTIVE, PUBLIC + `project_domains`, stage, region | external feed → canonical + TEMPORARY_EXTERNAL remainder | keyword; domain, stage (vocabulary ids) | PUBLIC published ventures only; same for every actor | existing states; external outage degrades to canonical rows |
| Library — Nhà sáng lập | `/library` (tab) | member (rows); guest (permission state) | venture owner via `individual_profiles` + PROFILE_DISCOVERY | external founders → canonical owners of listed ventures | keyword (members); domain | D03: visible venture AND NETWORK_ONLY owner; never guests | guests: permission state, no names |
| Library — Bài toán | `/library` (tab) | guest, member | none (TEMPORARY_EXTERNAL static file) | unchanged content; server-paged | keyword; existing facets | public, as approved (DEC-L15-D9) | existing states |
| Organization page | `/organizations/:slug` | guest, member | `organizations`, relationships, membership counts, events | unchanged; children bounded | none | PUBLISHED HUB / CHAPTER / CLB; no persons, no ids | uniform 404 |
| Home search | landing → `/library?q=` | guest, member | — | unchanged | keyword hand-off | n/a | n/a |

## Library contract
| Content | Classification | Rule |
|---|---|---|
| canonical PUBLIC STARTUP ventures | CANONICAL_TARGET | name, summary, stage label, domain labels, region label; no website / CTA (no canonical field); no id or slug |
| external startups without a canonical equivalent | TEMPORARY_EXTERNAL | kept (no content loss); suppressed when a canonical venture has the same folded name; no founder names, not even for search; stage via the existing DEC-2909-L2H2 map; domain only via a reviewed external-category → DOMAIN map, else no facet value |
| founders | CANONICAL_TARGET | D03 only; external founders dropped |
| "Bài toán" | TEMPORARY_EXTERNAL | static file unchanged; exit when a Problem entity is frozen or the PO retires the file |
| migration path | MIGRATION_PATH | PROD-02 canonical queries + map → PROD-03 API merges sources → PROD-04 page reads the API; the external feed is never written to PostgreSQL |
Exit for the external feed: every external startup has a canonical counterpart, or the PO retires the feed.

## Founder display rule (D03)
Show a founder only if A. the venture is visible to the viewer (PUBLIC, ACTIVE) and B. the owner's PROFILE_DISCOVERY is visible to the viewer (signed-in member and NETWORK_ONLY; account and profile ACTIVE). Fields: display name, avatar (through the existing media route), `owner_role_label`, listed venture names. If A or B fails, omit the identity: no initials, no inference, no `owner_profile_id`, no team members.

## Visibility contract
| Object | Guest | Member | Never |
|---|---|---|---|
| Venture | PUBLIC + ACTIVE STARTUP | same | DRAFT, PRIVATE, ARCHIVED, PROJECT in the Library; metadata, ids, slug, owner ids |
| Profile | nothing | D2A card fields of NETWORK_ONLY venture owners | PRIVATE profiles; e-mail, phone, CV, links, headline / bio beyond the card |
| Organization | PUBLISHED HUB / CHAPTER / CLB page | same | persons, ids, DRAFT / ARCHIVED |
| Programme / challenge | nothing in WF06 | nothing in WF06 | any programme or application |
| Application | — | — | always excluded |
ORG-SCOPED and OWNER-ONLY data stay in WF02–WF05 screens; WF06 reads none of it.

## Write boundary and actors
WF06 P0 is read-only: no follow, connect, save, bookmark, request, invite, message or application, and no upstream mutation. Existing actions outside WF06 stay as they are: membership request reached from the org page (WF02 / WF03), discovery visibility (WF01 / WF02), venture publish (WF02). Actors: guest and authenticated member only; no operator surface, no new role.

## Contract matrix
| Area | Frozen | Evidence | PROD task |
|---|---|---|---|
| scope / surfaces / actors | 3 existing surfaces, guest + member | D01; PROD-00 inventory | 03, 04 |
| canonical data / Library | canonical startups and owners; TEMPORARY_EXTERNAL remainder and problems | D02; DEC-PDF-D1; DEC-L15 | 02, 03, 04 |
| founder visibility | D03 | D2 / D2A; `projectDiscovery` | 03 |
| visibility / security | server-side, no ids, no bulk | D04; Data SOT :19, :438 | 03, 05 |
| search / filter / sort | existing filters on vocabulary ids; existing deterministic sorts | D04; DEC-L15; Freeze :206-212 | 02, 03 |
| read model / DB | direct reads; index only with evidence | D05; Arch 02 :201-234 | 02 |
| API / frontend | 3 read endpoints; existing page | D05 | 03, 04 |
| write boundary | read-only | D05 | 03, 05 |
| testing | deterministic WF06 fixture | api-data contract | 02, 05 |
| out of scope | directory, venture / programme / challenge discovery, matching, ML, writes, Admin Portal, Sprint1 | D01; DEC-WF06 | — |
TRUE_PO_DECISIONS_REMAINING = 0.

## Related
- [WF06-PROD-01_api-data-contract.md](WF06-PROD-01_api-data-contract.md) · [WF06-PROD-01_implementation-handoff.md](WF06-PROD-01_implementation-handoff.md) · [WF06-PROD-00_runtime-gap-audit.md](WF06-PROD-00_runtime-gap-audit.md)
