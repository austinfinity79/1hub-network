# TASK-22.1 Public Homepage

**TASK 22 — Bucket A, BATCH 22.1 Corrected Public Homepage: DONE.**
- Reference: corrected `Homepage.png`, now at `design-reference/final/revision/H1` (SHA-256 `9f778305…e979`).
- Governing decisions: HD-12 CLOSED as [DEC-HD-12](../../decisions/DECISION_LOG.md#dec-hd-12); implementation choices in [DEC-H1](../../decisions/DECISION_LOG.md#dec-h1-d1).

## Design rule and fonts
| Item | Result |
|---|---|
| Design SOT | §2.2 scoped rule: "Corrected Design Revision screens may use Space Grotesk where present in the approved corrected reference"; §2.3 weights 400–700 |
| CLAUDE.md | §5: one line added (Space Grotesk on revision screens only); nothing else rewritten |
| Font source | `@fontsource/space-grotesk` 5.3.0 (OFL-1.1), pinned devDependency; `pnpm fonts:sync` copies latin, latin-ext and vietnamese × 400 / 500 / 600 / 700 (12 files) into `public/fonts` and regenerates `fonts.css` |
| Delivery | Self-hosted `/fonts/*`; no CDN, no runtime fetch; `font-display: block` as for the other faces |
| Scope | The face is declared globally but only the homepage uses it. Legacy `/auth` loads no Space Grotesk face and has 0 typography violations against the approved set |
| Harness | `REVISION_FACES` (approved faces + Space Grotesk) for revision screens only. `APPROVED_FACES` stays the default, so Space Grotesk on a legacy screen is still a violation |

## Homepage
- **Root:** `/` returns 200 for guests with no redirect, and stays public for signed-in accounts (DEC-P0-LANDING-D1). Guards on `/me`, `/ops/*` and `/projects/new` are unchanged.
- **Sections, in reference order:**
  - header;
  - hero (search, CTAs, wordmark);
  - journey strip;
  - ĐIỂM NGHẼN;
  - GIẢI PHÁP (4 stacked cards);
  - GIÁ TRỊ ĐA TẦNG and bars 01–03 (with the organiser box);
  - Sự kiện (with the organiser box);
  - ALL-IN-ONE;
  - Mạng lưới (two doors);
  - Đơn vị tổ chức;
  - Vòng lặp (with the diagram);
  - Cộng đồng;
  - Đối tác;
  - closing;
  - footer.
- **Omitted (HD-01, placeholder or unverified):**
  - the problem catalogue;
  - programme cards;
  - the iHUB, deck and data-room cards;
  - event rows;
  - the unfinished quote;
  - metrics and the "13 chapter" line;
  - the partner wall and the "200+" line.
- **CTAs for a guest:**
  - 17 active links: entry `/auth` ×4, HUB page ×5, `#co-hoi` ×2, `#cong-dong` ×2, `/projects/new`, brand, 2 legal links;
  - 26 inert items, all `aria-disabled` with a reason;
  - 0 `href="#"` and 0 script URLs.
- **Member entry:** "Vào tài khoản của tôi" → `/me`, or "Tiếp tục thiết lập tài khoản" → the resolver step.
- **Files:** `src/components/landing/`: `landing.tsx` (header, hero, strip, footer), `landing-story.tsx` (pain → events), `landing-network.tsx` (all-in-one → closing), `landing-parts.tsx`, and `landing` / `story` / `network` CSS modules. Every TSX unit is under 500 lines. `page.tsx` and `entry.ts` are unchanged.

## Pixel QA (1440×900 DPR1, production build)
- **Method:**
  - Typography was calibrated per style: size from cap height, then letter-spacing from line width, then weight from ink mass, scored by glyph-mask IoU against the reference.
  - Geometry was matched line by line with a line-box comparator, to within ±3 px.
- **Gate** (`tests/visual/specs/p0-landing.spec.ts`):
  - 22 kept blocks, each compared at its own anchor;
  - pass requires diff outside text < 1.5 % and diff beyond a ±2 px shift < 2 % per block (new `shiftTolerance` option in `segments.ts`);
  - result: max outside **0.99 %**, max beyond ±2 px **1.40 %**; all 22 pass.

| Class | Count | Notes |
|---|---|---|
| P0 structural | 0 | Every kept block is present, in order |
| P1 major | 0 | Typeface, size, weight and colour match; no block displaced more than 3 px |
| P2 component | 0 | Cards, pills, bars, organiser boxes, doors and card shadow match within 1–2 px. 1.5 px strokes are emulated as a solid row plus a half-tone row |
| P3 raster | residual | Figma vs Chrome anti-aliasing; journey-strip words ±2 px; dash phase; stroke half-row on the other side in bar 02 / audience rows; ≤ 5 px tracking drift across 600–800 px heading lines |
| Intentional | 3 | HD-01 omissions, with the spacing collapsed; the fourth pain item wraps instead of being clipped at 1362 px; mono labels use IBM Plex Mono (the reference mono family is unproven) |
| Typography violations | 0 | `REVISION_FACES`; h1 / h2 / pill are Space Grotesk; eyebrows IBM Plex Mono; no fallback; fonts come only from `/fonts/` |

## Responsive (functional safety, IA-P2-03 rules)
- 1024, 768 and 390: 0 horizontal overflow, 0 covered or off-screen links or inert items.
- Only the inert VI | EN switch is hidden below 768.
- Nav, strip, grids, cards and doors stack or wrap.

## Regression and gates
- Gates: format, lint, typecheck, unit 237, DB 349, production build — all PASS.
- Full visual suite on the final build: 667 = **643 passed / 24 opt-in skipped / 0 failed**.
  - One first-run failure was expected: `typography-foundation` counted 15 `@font-face` rules; it now expects 27. The loaded set on that legacy page is still the five product faces. The rerun passes (7/7).
- Per group: P0-LANDING 10, P0-SHELL 14, M0-ENTRY 4, WF01 152, WF02 94, WF03 66, WF04 115, WF05 66, pixel-QA harness 15 (+24 opt-in skips), Internal Alpha release 7 — all green.
- Business, API, DB, RBAC and migration changes: 0.

## Git
- Branch `main`; start HEAD `d460914`, checked again before each commit.
- Implementation commit: `a05917a`. Report / docs commit: the commit that contains this report.
- Push: **NOT RUN** — LOCAL REVIEW MODE.

## Related
- [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md) · [TASK-22.1_homepage-typography-stop.md](TASK-22.1_homepage-typography-stop.md)
- [../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md](../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md)
