# PAGE-TRANSITION-SKELETON-01

Skeleton loading (PO option 03) for navigation between the primary public pages. UI only: no data, auth, route or status change.

| Item | Value |
|---|---|
| Shared component | `src/components/public-shell/page-skeleton.tsx` + `.module.css`: one `PageSkeleton` with kinds `home`, `about`, `directory`, `startup`, `founder`; header bar in the destination's tone; bones at the measured first-screen geometry (1440 / 390); bones fade in after 100 ms; shimmer = transform only, off under reduced motion; no client JS |
| Directories | `/products`, `/programmes`, `/talents`, `/problems`: their existing route `loading.tsx` → `DiscoveryLoading` → `PageSkeleton kind="directory"` with the directory's label (was a bare "Đang tải…") |
| Home, About, product detail (+ tabs), talent detail | client overlay `RouteSkeleton` (root layout): a same-origin link click towards these routes shows the skeleton over the page until the address changes; 10 s give-up; tabs of the same startup excluded; no overlay on Back / Forward, reload or direct load |
| Why not `loading.tsx` there | a route loading boundary streams a 200 before the page runs: `notFound()` answered 200 instead of 404 (hidden startup, NETWORK_ONLY founder for a guest) and the hero preload left `<head>` — both caught by the specs and reverted |
| Tests | targeted 78 / 79 (thao-05, thao-01, demo-home-about-01, hero-slider, demo-sp1-founder-01, product-detail-smart-campus, thao-04); the one failure is the known hero-counter typography (IBM Plex Mono 400), unchanged |
| Navigation QA | RSC answer held 1.2 s (test only): skeleton shown, single, gone on arrival; CLS 0; Back / Forward, reload, direct load 200 without skeleton; console / hydration 0 |

## Related
- [THAO-05](THAO-05.md) · [demo-app-image-retention](../../ops/demo-app-image-retention.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
