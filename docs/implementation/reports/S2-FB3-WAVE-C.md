# S2-FB3-WAVE-C

Feedback Sprint 2 (lần 3), Wave C: three scoped commits, one build, one deploy. No DB change.

| Task | Commit | Change |
|---|---|---|
| S2-HOME-TALENT-SECTION-01 | `e087245` | homepage "Nhân tài" (Figma 889:6350) between products and news; NETWORK member: canonical `listTalents` (NETWORK_ONLY, pinned first then by name), featured person over their picture, portrait rail, 6 s rotation, arrows / progress / pause (no autoplay under reduced motion), domain chips; guest: section shell + sign-in entry, no person read on the server |
| S2-ABOUT-HUB-CAROUSEL-01 | `4f9c9a5` | under the About map (Figma 880:4401): `about-carousel-hub-images.zip` (sha256 `23e54fd0…`) as supplied — row 1: 8 HUB covers running left, a card opens the existing HUB popup (ABT1.09); row 2: 6 activity pictures running right, a card opens /events; manifest order / labels / alts; WebP + JPG `<picture>`; pause on hover / focus; still under reduced motion |
| S2-ABOUT-MAP-HUB-LOGOS-01 | `980fcd4` | map quick card (hover and keyboard focus) shows the HUB_LOGOS file of the same HUB (9 of 11); HUB Úc, HUB UAE keep initials; popup, names and positions unchanged |

Not drawn (no source): talent update line, "Mời vào đội", verified / team-status tags; carousel "Xem thêm" (the map's existing "Xem thêm" stays).

Privacy: the guest homepage HTML carries no talent name, avatar URL or count (spec `s2-home-talents` checks every directory name / avatar against the guest HTML).

Tests: `s2-home-talents`, `s2-about-carousel`, `s2-about-map-logos` (new), `thao-04-about`, `demo-home-about-01`, `public-content-publish`, `hero-slider`, `s2-events`, `thao-05-discovery`: 74 / 75 — the one failure is the known homepage hero-counter typography (IBM Plex Mono 400).

## Related
- [S2-FB3-WAVE-B](S2-FB3-WAVE-B.md) · [S2-ABOUT-ASSETS-01](S2-ABOUT-ASSETS-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
