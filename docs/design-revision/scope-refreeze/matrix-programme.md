# Matrix Programme

Screen / Route / Data / Permission matrix — L4 (9 screens). [DEC-2809-D4](overview.md#d4): **Directory screens only**, for public discovery; every other L4 capability is Future and is not Bucket A. Legend as [matrix-homepage-auth.md](matrix-homepage-auth.md).

**Finding:** the L4 asset group contains **no Directory frame**. L28 is a challenge detail (with an embedded problem search), L29–L34 are one problem page with six tabs, L35 / L36 are the summit landing and form. The only challenge / problem directory in the corrected set is **L15 DIR1** (L2 group), which needs public problem, startup and founder data that does not exist (HD-A7). So L4 contributes **0 executable screens** until the PO names one.

| Screen | Route | Actor | Data entities | Permission | Current implementation | Class | Delta | Migration / API | Batch |
|---|---|---|---|---|---|---|---|---|---|
| L28 CH1 Chi tiết challenge | none (`/demo/programmes/:id` is operator-only) | guest | Programme (CHALLENGE), problems, chapters, events | public | WF04 demo data (browser session) | FUTURE (challenge detail, expanded; was B / HD-10) | — | — | — |
| L29 P1 Đề bài | none | guest | Problem (Future entity) | public | none | FUTURE | — | — | — |
| L30 P1-T2 Quyền lợi | none | guest | Problem | public | none | FUTURE | — | — | — |
| L31 P1-T3 Đơn vị | none | guest | Problem, Organization | public | none | FUTURE | — | — | — |
| L32 P1-T4 Hỏi – đáp | none | guest / participant | Q&A (none) | — | none | FUTURE (Q&A) | — | — | — |
| L33 P1-T5 Cập nhật | none | guest | Updates (none) | public | none | FUTURE (Updates) | — | — | — |
| L34 P1-T6 Đội đã nộp | none | guest | Application (public list) | public | none | FUTURE (Submitted Teams) | — | — | — |
| L35 CS1 Landing chapter summit | none | guest | Summit (none) | public | none | FUTURE (Chapter Summit) | — | — | — |
| L36 CS2 Form đăng ký summit | none | participant | EventRegistration (foundation only) | member | none | FUTURE (Summit Registration) | — | — | — |

**Programme directory `/programmes`:** required by the homepage CTA map (D1) but drawn nowhere in the corrected set. It needs published programmes server-side (BD-08, shared with the Application foundation) and a design decision (HD-A6).

**WF04 operator demo** (`/demo/programmes/*`, 9 screens, DEC-WF04-H1…H5): unchanged, still a browser-session demo; not redrawn.

Totals: ALPHA 0 · FUTURE 9.

## Related
- [matrix-chapter.md](matrix-chapter.md) · [matrix-application.md](matrix-application.md) · [human-decisions.md](human-decisions.md)
