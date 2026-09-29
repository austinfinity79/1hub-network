# ABOUT-HUB-LEAD Deploy

**ABOUT HUB LEAD HOTFIX + DEPLOY: DEPLOYED.** `c02cdd9` runs on https://1hubnetwork.io.vn. In the `/about` HUB structure panel, HUB HN shows Le Phuong Thao as TRƯỞNG HUB.

## Change
| Item | Value |
|---|---|
| Data | `about-data.ts`: optional `lead` on a HUB; HN only: name "Le Phuong Thao", the existing `humans/le-phuong-thao.webp` (focus `50% 22%`) |
| Panel | `about-client.tsx`: the lead's portrait replaces the placeholder; name line under "TRƯỞNG HUB" (`.orgPanelName`, the Humans name size) |
| Unchanged | HUB HN, KHU VỰC TP. HÀ NỘI, TỪ NĂM 2021, THÀNH VIÊN "—", CÂU LẠC BỘ "—", "Trưởng câu lạc bộ"; every other HUB keeps the placeholder |

## Checks (local and domain, 1440 / 390)
`/about` 200; HN panel: portrait loaded (cover), name and role visible; HCM still the placeholder; the HN panel (+34 px) stays inside the diagram frame; broken images 0; overflow 0; #418 0; console 0; Nginx 5xx 0.

## Release
| Item | Value |
|---|---|
| Deployed SHA | `c02cdd9ba4ab6b84bf87a569c02c608cc62804a0` |
| Previous / rollback SHA | `ec33ee258acb1d5d832c211d6efb1732e6cde8c4` |
| DB | untouched; backup `onehub-20260929T111338Z.dump` by procedure |

## Related
- [ABOUT-IMAGE_deploy.md](ABOUT-IMAGE_deploy.md) — previous release
