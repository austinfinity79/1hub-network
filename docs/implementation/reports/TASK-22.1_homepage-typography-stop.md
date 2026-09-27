# TASK-22.1 Homepage Typography Stop

**TASK 22 — Bucket A, BATCH 22.1 Public Homepage: BLOCKED at precheck — Design SOT conflict (typography, HD-12).** Nothing implemented; no runtime, DB, API or RBAC change. Source: corrected `Homepage.png` (SHA-256 `31d6e5cc…ae35`, [manifest](../../design-revision/00_CORRECTED_SOURCE_MANIFEST.md)).

## Precheck
| Check | Result |
|---|---|
| Start HEAD / tree | `836a344`; clean except the untracked `AGENTS.md` |
| Root `/` | Already public for guests and members (P0-LANDING, DEC-P0-LANDING-D1); no route change needed |
| Business / API / data need | None found; placeholder blocks omitted, CTAs per the plan below |
| Typography | **Conflict**: the revision is set in Space Grotesk |

## Evidence
Method: render each candidate face (with its Vietnamese subset) and trim ink to its bbox; fit it to the frame's ink bbox; score the binary overlap (IoU). Aspect = ink width / height. Test fonts came from `@fontsource` v5 (OFL-1.1) and were used in scratch only; nothing was added to the repo.

| Sample (frame) | Frame aspect | Space Grotesk best | Be Vietnam Pro best |
|---|---|---|---|
| Giant wordmark "1hub.network" (H1) | visual | 700: same glyphs (flagged "1", "k", "w") | 600 and Archivo 700: different glyphs |
| Hero "những hành trình đổi mới sáng tạo" (H1) | 13.47 | 600: IoU **0.600** | 600: IoU 0.243 |
| Journey strip "Xác thực" (H1) | 4.50 | 400: IoU **0.811** (4.75) | 500: IoU 0.416 (4.25) |
| Lead "Nơi những nhà sáng lập …" (H1) | 22.95 | 500: IoU **0.621** | 600: IoU 0.301 |
| Brand heading "cộng đồng đổi mới sáng" (AUTH1) | 10.21 | 600: IoU **0.837** | 500: IoU 0.716 |
| Button "Tiếp tục với Google" (AUTH1) | 9.13 | 400: IoU **0.677** (9.07) | 400: IoU 0.512 (8.34) |

Findings:
- Space Grotesk wins all 6 samples.
- Headings are narrower than Space Grotesk's default spacing, so the design probably uses negative letter-spacing.
- The mono labels ("1HUB.NETWORK — ĐƯỢC PHÁT TRIỂN BỞI HUB NETWORK", "ĐIỂM NGHẼN", "TÌM", "01") are monospace, but at this size the family is not provable: IBM Plex Mono 500 and Space Mono 400 are both plausible.

## Conflict
- `CLAUDE.md` §5: the default UI font is Be Vietnam Pro; Archivo Bold / IBM Plex Mono are allowed only where the Design SOT approves them.
- The same faces are frozen in `docs/design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md` (typography, lines 50–63).
- The pixel harness (`tests/visual/pixel-qa/capture.ts` `APPROVED_FACES`) fails any other family.
- The Task 22 closure gate requires P0 = P1 = P2 = 0. A page-wide face mismatch is at least P1. Measured width-to-height ratios differ from Be Vietnam Pro by 3–9 % per line, so line breaks and block heights move, which can reach P0 structural.
- AUTH1 has the same face, so HD-12 blocks every Bucket A batch, not only 22.1.

Why no default was applied:
- CLAUDE.md §1: "If sources conflict, do not guess. Stop."
- CLAUDE.md §14: "a Design/SOT conflict is a STOP."
- Task 22: "DO NOT GUESS OPEN HUMAN DECISIONS."
- Task 22: never modify the reference to make a diff pass.

## Decision needed: HD-12
| Option | Result | Needs |
|---|---|---|
| **A — adopt Space Grotesk** | Pixel match possible | PO / Design approval that updates the Design SOT typography, CLAUDE.md §5 and `APPROVED_FACES`. Self-host latin, latin-ext and vietnamese subsets for 400 / 500 / 600 / 700 (upstream subsets exist; Vietnamese renders). Choose scope: revision screens only (mixed faces until 22.8) or global (every WF01–WF03 pixel baseline must be re-approved). Choose the mono face: keep IBM Plex Mono 500, or Space Mono 400 / 700 (no 500 upstream) |
| B — keep the approved faces | No SOT change; the pages visibly differ from the frames | PO records a typography deviation. Pixel audit classifies type metrics as Intentional; layout is matched on structure |
| C — re-export the frames | Clean match with the current SOT | New source revision and new hashes |

**Recommendation: A.** The wordmark and every sampled text are Space Grotesk, so B ships a Homepage that is not the approved revision. Decide the scope (revision-only or global) in the same decision.

## Prepared plan (applies once HD-12 is decided)
- Keep structure, visuals and narrative copy.
- Omit (HD-01, DEC-P0-LANDING-D2 / D3):
  - problem strip (3 of 30 cards drawn);
  - programme cards naming real brands;
  - venture / deck / data-room cards;
  - mock event rows;
  - metrics ("13 chapter · 9 quốc gia", "200+ đối tác");
  - partner wall;
  - the unfinished quote.

CTA plan:
| CTA | Destination |
|---|---|
| Đăng nhập · Tạo tài khoản · Tham gia mạng lưới | Guest `/auth`; member: entry CTA (`routeFor`) per DEC-P0-LANDING-D1 |
| Tạo hồ sơ startup của bạn | `/projects/new` (guest → existing guard → `/auth`) |
| Mạng lưới đổi mới sáng tạo · Khám phá mạng lưới · Tìm hiểu về HUB Network | `/organizations/{published HUB slug}` |
| Về HUB Network · Khám phá cơ hội | In-page section anchor only if that section ships; otherwise inert |
| Chương trình · Sự kiện · VI \| EN · search · Đăng bài toán · Triển khai / Tạo chương trình · Tạo sự kiện · Kết nối hợp tác · Trao đổi giải pháp · Kết nối nguồn lực · FAQ · social · footer future items | Inert `aria-disabled` with a reason (DEC-P0-SHELL-D1…D7); no `href="#"`, no javascript placeholder |
| Legal links · contact email | Server legal documents · plain text |

## Audit correction
- **What was wrong:** TASK 21 v2 stated that the typography "looks consistent with Be Vietnam Pro / Archivo / IBM Plex Mono".
- **Cause:** the method named typography but gave no way to test a typeface from a PNG, so an impression was recorded as a finding.
- **Fixed:**
  - [04 UI delta](../../design-revision/04_UI_DELTA_MATRIX.md) corrected;
  - HD-12 added to [05](../../design-revision/05_BUSINESS_API_DATA_CONFLICT_MATRIX.md);
  - the blocker noted in [07](../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md);
  - a glyph-mask typeface test added to [AUDIT_METHODOLOGY](../../design-revision/AUDIT_METHODOLOGY.md) step 7.

## Git
- Branch: `main`; start HEAD `836a344`
- Implementation commit: none
- Push: **NOT RUN** — LOCAL REVIEW MODE

## Related
- [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md) · [TASK-21v2_design-revision-audit.md](TASK-21v2_design-revision-audit.md)
