# WF06-PROD-00_runtime-gap-audit

**WF06-PROD-00 — runtime scope / production gap audit.** 2026-10-04, branch `feat/wf06-prod-hardening` (from `5199e07`, the WF05 closure head that carries the WF04 + WF05 candidates). Audit only: no runtime code, migration, push, merge or deploy; PROD-01 not started. Companion files: [scope matrix](WF06-PROD-00_scope-matrix.md) · [data and visibility](WF06-PROD-00_data-visibility.md) · [gap matrix and plan](WF06-PROD-00_gap-matrix.md).

## Verdict
WF06 runtime is **not implemented and not promoted**. DEC-WF06-INTERNAL-ALPHA-SCOPE (HUMAN APPROVED 2026-09-27, DECISION_LOG:1164) keeps it FUTURE / VISION; Task 18 decided scope, it built nothing. What runs today is a small **discovery layer** owned by other decisions: the public organization page (WF03-S09, canonical) and the public Library (DEC-L15 "static demo", non-canonical data). No people, venture or programme directory, no search API, no matching, no WF06 write. Promoting any new WF06 surface needs a PO decision (4 true decisions, below).

## Preflight
| Check | Result |
|---|---|
| branch, HEAD | `feat/wf06-prod-hardening` created at `5199e0728c35fd821a5ae698dacf4eea640826ee`; tree clean except `AGENTS.md` |
| `origin/main`, production | `78f21f2`, `78f21f2` |
| migrations | 001–016 |
| WF04 / WF05 candidates | `f40f70c` and `8c1fbd6` in HEAD, unchanged |
| lanes | Claude B `fb2130f`, `fix/member-shell-mobile` `a957876`, `fix/library-layout` `c1b60c3` (stale; its fix is in HEAD as `b6aa0fa`) not in HEAD; no other writer |

## SOT reviewed
Master Spec §1, §4 WF06 ("Future / data/read-model vision", :153-155), M6 (:264-265); CLAUDE.md §2; Data SOT §8 visibility (:254-273), §14 (:426), :438-441, :701-710; Data Freeze :153-212; Arch 01 :258, 02 :201-234 (discovery owns no data, projections only), 03 :173-194, 04 :260-266; API §4 profiles (:541-555), WF03-S09 (:872-876), §15 (:1165), §21–24; DECISION_LOG: DEC-WF06 (:1158-1176), DEC-WF01-S07-D2/D2A/D4/D5 (:71-75), DEC-WF02-H3 (:158-169), DEC-WF03-S09-D1..D4 (:972-975), DEC-2809-D4/D7 (:1250-1253), DEC-L6-D1 (:1324-1330), DEC-L15 (:1332-1350), DEC-PDF-D1 (:1476-1484), DEC-AIG (:1502-1511), DEC-P3UX-D2/D3 (:1522-1523), DEC-W4P-D10 (:1546); TASK-24.5 L6 inventory / features; design scope-refreeze matrices, `02_SCREEN_INVENTORY`, `revision/README`; code, routes and specs (inventory in the scope matrix).

## Runtime inventory (summary)
| Surface | Route / module | Class |
|---|---|---|
| Public organization page | `(public)/organizations/[slug]`, `GET /api/v1/organizations/by-slug/{slug}`, `lib/public/organization.ts` | REAL_RUNTIME + REAL_API |
| Library "Thư viện" (Bài toán, Startup, Nhà sáng lập) | `(public)/library`, `components/library/*`, `lib/library/*` | FIXTURE_BACKED (static `dir-bai-toan.json`) + external feed (`startup.1hub.cloud/data/startup.json`); filtering CLIENT_ONLY |
| Homepage search | `components/landing/hero-search.tsx` → `/library?q=` | CLIENT_ONLY |
| Landing network doors, metrics, rails, About | `components/landing/*`, `about-data.ts` | FIXTURE_BACKED (illustrative) / inert FUTURE links |
| Own network | `GET /api/v1/me/network`, `/me/roles` | REAL_API (own data, not discovery) |
| Open programmes (member) | `GET /api/v1/demo/projects` → `listOpenForms` | REAL_API (WF05) |
| Vocabularies | `GET /api/v1/vocabularies/{type}` | REAL_API (reusable) |
| Profile projection | `lib/profile/projection.ts` (`projectDiscovery`) | used by ops only; no discovery route |
| People / venture / programme directory, `/profiles/{id}`, `/search`, matching, L6 frames | — | NO_RUNTIME / VISION_ONLY (L6 9 frames FUTURE; `l6-discovery-privacy.spec` guards 24 future paths as 404) |

## Security findings
| # | Finding | Severity |
|---|---|---|
| S1 | `/library` shows real founder names and roles from the external feed to guests; no consent or PROFILE_DISCOVERY applies (not canonical people); contacts stripped by regex only; founders merged by folded name; the whole dataset (≤ 1000 startups) is serialised to every guest | PO_DECISION_REQUIRED (PO-D) / P1_HARDENING if kept |
| S2 | the problem dataset's own `_meta` lists fields to complete and "tags.linh_vuc … cần HUB duyệt" before going public (`dir-bai-toan.json:21-26`); it is public | PO_DECISION_REQUIRED (PO-D) |
| S3 | the privacy switch promises "Hiện thẻ của tôi trong Thư viện … chỉ thành viên mạng lưới thấy" but no surface shows member cards (safe, misleading) | PO-A |
| S4 | `listOpenForms` does not check the owning organization's status; unbounded with one query per row | P2_QUALITY (WF04 / WF05 boundary) |
| S5 | unbounded lists: org-page children, requestable organizations; ops members paged in memory | P2_QUALITY |
| S6 | guests can list ARCHIVED vocabulary items | P2_QUALITY |
No canonical private data (e-mail, phone, contacts, drafts, applications) leaks through any current discovery API; organization pages expose no person and no id.

## PO decisions (TRUE_PO_DECISIONS_COUNT = 4)
| # | Question | Why it is the PO's |
|---|---|---|
| PO-A | Add an in-network **member directory** (PROFILE_DISCOVERY fields, NETWORK_ONLY, members only)? | new surface + actor visibility; no approved frame (L10 FUTURE); the privacy copy already promises it |
| PO-B | Add **public venture discovery** (ventures the owner published PUBLIC)? | DEC-PDF-D1 says PUBLIC grants no read yet; L44 / L45 FUTURE |
| PO-C | Add **programme / challenge discovery** beyond the member's open list? | DEC-W4P-D10 "no public list in v1"; HD-A6 / HD-A7 open |
| PO-D | Library: keep the external / static showcase (with S1 / S2 accepted and governed) or move it to canonical data? | product + privacy of non-account founders |
Default sort for any new directory is part of A–C (proposal: name A→Z, id tiebreak); no ranking or matching is proposed. If A–C are "no", WF06 P0 = hardening of the existing discovery layer only.

## Related
- [WF06-PROD-00_scope-matrix.md](WF06-PROD-00_scope-matrix.md) · [WF06-PROD-00_data-visibility.md](WF06-PROD-00_data-visibility.md) · [WF06-PROD-00_gap-matrix.md](WF06-PROD-00_gap-matrix.md) · [WF06-SCOPE_internal-alpha-decision.md](WF06-SCOPE_internal-alpha-decision.md)
