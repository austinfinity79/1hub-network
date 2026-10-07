# Out of scope post-demo — 07/10 demo

Part of [DEMO_SOT_v1](DEMO_SOT_v1.md). Nothing below is production-complete in the demo.

- No demo screen may show a success, a status change or a record write for these items.
- A control drawn for one of them is visual-only. For a guest it may open `/auth`.

## Mandatory exclusions (J)
| Excluded capability | What the demo shows instead | Where drawn |
|---|---|---|
| Real CCCD / 1Hub identity verification (ID1 → ID1b → ID1c) | DEMO STATE ONLY: the fixture flag renders "Đã xác thực danh tính qua 1Hub" for allow-listed demo profiles only; no flow, no DB field, no badge for real users | DM13, DM09 |
| Investor / GP / LP authorisation | any investor-only area of the UPDATED DM11 frame renders as static, locked presentation; its request control is inert | DM11 |
| Investor / GP & LP metric tiers (SP1-MET) | THAO-06 ships PUBLIC / PRIVATE per metric only (DEC-THAO-SP-D2); no investor tier | DM11 |
| Automatic Updates activity engine (quarterly report, programme, connection, team, investment events) | THAO-06 ships manual plain-text updates only (DEC-THAO-SP-D3) | DM12 |
| Follow beyond a startup (people, organisations), counts, lists, notifications | startup Follow v1 is live on DM10–12 (THAO-06, DEC-THAO-SP-D4); elsewhere inert, or → `/auth` for a guest | DM08, DM13 |
| Connect production workflow ("Đề nghị kết nối", "Kết nối", OPN0–OPN4) | inert, or → `/auth` for a guest | DM10–DM13 |
| Dataroom production workflow ("Hồ sơ đầy đủ & dataroom", DRM4 / DRM5) | inert, or → `/auth` for a guest | DM10 |

## Also not in the demo
| Item | Note |
|---|---|
| Programme / challenge directory and detail, event directory and detail | DM06 / DM07 are reference only; routes reserved |
| Talent directory | Promoted by the PO on 07/10 (THAO-05, DEC-THAO-DIR-D3): `/talents` for signed-in members, a gate for guests |
| Bài toán directory (DIR1), Tin tức, EN content | not supplied |
| Recruitment overlay, FAQ, newsletter subscription, partner links | visual-only |
| Owner editing on the public pages (SP1-OWN / SP1-EDIT, "+ Tạo sản phẩm") | hidden on the public view |
| Role-position verification shown as verified (ADM26, S1-UAT-03B) | the DM13 HUB badge is fixture text and is not linked to a claim |
| Real roster / production data for demo people and startups | demo data never ships to production (DB-SAFETY-01) |
| Public profile visibility for real members (US-02.01-AC04) | unchanged: only the demo allow-list renders on `/talents/[profileId]` |

## Wording guard
- **Banned copy:** the demo UI must not claim "đã xác minh", "đã kết nối", "đã theo dõi" or "đã gửi yêu cầu" for any action, because none of these actions exist.
- **Demo-verified mark:** carries a code-level `DEMO` marker, so a later search can remove it in one place.

## Related
- [DEMO_SOT_v1](DEMO_SOT_v1.md) · [DEMO_DATA_CONTRACT](DEMO_DATA_CONTRACT.md) · [SUPERSESSION_MATRIX](SUPERSESSION_MATRIX.md)
