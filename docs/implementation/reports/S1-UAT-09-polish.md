# S1-UAT-09 polish

Sprint 1 P1/P2 copy polish: FB-08 (P1, US-01.09) and FB-16 (P2, US-02.10) from the Sprint 1 feedback pack (`1hubnetwork_feedback_sprint1.md`, `1hubnetwork_uat_sprint1_wf01_wf02.md` lines 532 and 1368). Copy only: no behaviour, validation, taxonomy, schema, API or migration change.

## Audit (before change)

| Occurrence | Surface | Class | Action |
|---|---|---|---|
| Guide block "LĨNH VỰC / Ngành hoặc chủ đề… / Ví dụ…" + "CHUYÊN MÔN / Chức năng… / Ví dụ…" | onboarding stage 2 `capability-form.tsx` | STALE_REMOVE (FB-08) | removed, orphan CSS removed |
| "Chọn các ngành hoặc chủ đề bạn đang hoạt động hoặc quan tâm." | stage 2, under "Lĩnh vực quan tâm" | STALE_REMOVE (FB-08) | removed |
| "Chọn những chức năng hoặc năng lực chuyên môn nổi bật nhất." | stage 2, under "Chuyên môn" | STALE_REMOVE (FB-08) | removed |
| Stage lede "Thông tin này giúp hệ thống…", "Kinh nghiệm nổi bật" lede | stage 2 | VALID_CURRENT (not named by FB-08) | kept |
| Placeholders "Gõ lĩnh vực / chuyên môn, Enter để thêm" | stage 2, /me dialog, editor | VALID_CURRENT | kept |
| "Dưới 20 từ. Viết như nói với người ngồi cạnh." | `/projects/new` wizard, "Một dòng mô tả" | STALE_REMOVE (FB-16) | now "Dưới 20 từ." |
| "Vài câu về việc dự án đang làm." | venture editor (edit) | VALID_CURRENT | kept |
| "≤ 60 từ. Viết như nói với người ngồi cạnh." | WF02-S02 profile editor, "Giới thiệu ngắn" | OUT_OF_SCOPE (profile bio, not FB-16) | kept, PO question |
| "Viết như nói với người ngồi cạnh." (`APPLICATION_COPY.summaryHelp`) | WF05 programme apply, quick team (SUB0) | OUT_OF_SCOPE (WF05, not Sprint 1 UAT) | kept, PO question |

## Other P1/P2 items

No in-repo tracker maps any other item to S1-UAT-09. Remaining P1/P2 items belong elsewhere: FB-02/03/04/19/20 (S1-UAT-08 / PO), FB-14 invitation detail (S1-UAT-07, protected). None implemented.

## Changes

| File | Change |
|---|---|
| `src/app/(onboarding)/onboarding/capability/capability-form.tsx` | guide block and two field ledes removed |
| `src/app/(onboarding)/onboarding/capability/capability.module.css` | orphaned `.guide*` rules removed |
| `src/app/(member)/projects/new/project-wizard.tsx` | `summaryHint` → "Dưới 20 từ." |
| `tests/visual/specs/wf01-s10-onboarding-capability.spec.ts` | FB-08 assertion; ACC-07 pixel: guide segment dropped, field heads cut to the title row, INTENTIONAL-SCOPE recorded |
| `tests/visual/specs/wf02-s05-project-startup.spec.ts` | FB-16 assertion on `#ve-summary-hint` |
| `tests/visual/specs/s1-uat-09-polish.spec.ts` | new: 1440 / 768 / 390 overflow, fit, gap and CTA checks |

## Evidence

| Gate | Result |
|---|---|
| format / lint / typecheck / build | PASS |
| unit | 42 files / 444 tests PASS |
| targeted (stage 2, runtime, S1-UAT-05 taxonomy, WF02-S05) | 44 / 44 PASS |
| S1-UAT-09 responsive | 3 / 3 PASS; screenshots under `tests/visual/diff/s1-uat-09/` (not committed) |
| protected regression (Auth, WF01, WF02, shell, feedback, S1-UAT-05/09) | 33 specs · 459 tests: run 1 454 PASS, 5 FAIL ENVIRONMENTAL; rerun 15 / 15 PASS |

The 5 run-1 failures were all in `wf01-email-magic-link`: the task `.env.local` was copied from `.env.example`, whose `APP_PUBLIC_BASE_URL` is the public domain, so the e-mailed link pointed away from the local server. The line was removed (as in the S1-UAT-05 env) and the spec re-ran green. No code change was involved. Isolated DB `hubnetwork_s1polish`; shared `hubnetwork_p0` untouched.

## PO questions

- Should the profile bio hint and the WF05 quick-team summary help also drop "Viết như nói với người ngồi cạnh"? FB-16 names only the project creation field, so both were left.

## Related

- [S1-UAT-05-profile](S1-UAT-05-profile.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
