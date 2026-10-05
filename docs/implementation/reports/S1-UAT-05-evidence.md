# S1-UAT-05 evidence

Evidence for [S1-UAT-05-profile](S1-UAT-05-profile.md) on the final build, isolated DB `hubnetwork_s1profile`.

## Gates
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 42 files · 444 / 444 (incl. `tag-input.test.ts` 5, suggestion cards 1) |
| DB | 53 files · 825 / 825 (incl. `profile-sprint1` 10, `profile-migration` 4, admin categories +1) |
| S1-UAT-05 browser spec | 11 / 11 |
| L1-L2 UAT (`tests/uat`) | 19 / 19 |
| Protected regression | **95 specs · 1248 tests · 1219 PASS · 0 FAIL · 29 SKIP · 0 FLAKY** on `2f73940` (20.7 min) |

Skips: opt-in / env-gated only, unchanged (`pixel-qa-screens` 24, `admin-design-01-capture` 2, `admin-prod-08-pixel` 1, `wf06-prod-library` 1, `wf06-prod-qa` 1). Earlier full runs: run 1 — 11 STALE_TEST in `wf01-uat-journey` (fixed); run 2 — 11 ENVIRONMENTAL timeouts in WF02/WF03/WF04 under load average 9.6 (those 9 specs re-run 205 / 205), then the clean final run above. Server log (final run): 0 unexpected 5xx, 0 hydration, 0 runtime exceptions; 1 expected `ApiError` (a deliberately refused `/dev/login`); 0 token / cookie / hash.

## Migration 019 (isolated scratch databases)
| Check | Result |
|---|---|
| Fresh 001 → 019 + seed; second run applies nothing; manual re-apply no-op | PASS |
| Upgrade 018 → 019 with vocabulary / profile / experience rows: 019 only, rows identical, new columns NULL | PASS |
| Recovery: rollback refused while a free tag or a type / place exists; lossless to 018 otherwise; re-apply | PASS |
| 017 / 018 tests unwind 019 first by its documented rollback | PASS |

## Targeted matrix
| Case | Where | Result |
|---|---|---|
| Completion empty / partial / 12 of 12; each item added then removed | DB | PASS (0 → 8 → … → 100 → … → 0) |
| US-01.12: no photo, website, phone → 75 %, exactly those 3 listed | DB + browser | PASS |
| Suggestions / education / skills / goal add nothing | DB + browser | PASS |
| Suggestion picked (keyboard, click); custom text; edit; reload | browser + DB | PASS (custom stored `UNNORMALIZED`) |
| Duplicates, 6th tag, 2–40 characters, ids + text together | browser + DB | PASS (refused) |
| Unnormalised value: not suggested, not a Library filter, not selectable by id, not an admin category | DB | PASS |
| Experience type / place: create, display, reload, edit, editor save keeps, clear, bounds | browser + DB | PASS |
| Skills: absent from every screen; stored links kept; legacy profile renders | browser + DB | PASS |
| Privacy: owner reads; guest 401 / `/auth`; other member never sees; projection carries no experience | browser + DB | PASS |

## Responsive · accessibility
| Check | Result |
|---|---|
| 1440 · 768 · 390 | stage 2 tags (40-char tag wraps), tag dialog, experience dialog, /me: no horizontal overflow, nothing clipped (long placeholder ellipsised) |
| Tag control | labelled `combobox` + `listbox`, `aria-activedescendant`, ArrowUp/Down, Enter, Escape closes only an open list, Backspace removes the last tag, error via `aria-describedby` + `role="alert"` |
| Dialogs | focus never reaches the page behind (checked at every Tab), Escape closes, focus returns |

## Stale-test audit
| Assumption | Files | Class |
|---|---|---|
| ten groups / old percents | `profile.db-test`, `profile-edit.db-test`, `complete.db-test`, `wf01-s07`, `wf02-s01`, `wf02-s02` | STALE_TEST → updated |
| skills on screen / closed lists / chips | `wf01-s10`, `wf02-s01`, `wf02-s02`, `wf01-s07`, `wf01-uat-journey` (stage-2 helper), UAT uc01–uc03 | STALE_TEST → updated |
| stage 2 passable empty | DB helper `passStages`, e2e `passStage` / `onboardThroughUi`, 7 specs with inline passes | STALE_TEST → minimum added, only when missing |
| migration inventory ends at 018 | `schema.db-test`, `password-auth-migration.db-test` | STALE_TEST → updated |
| 12 Tab presses stay in the dialog | `wf02-s01` keyboard test | STALE_TEST → every step checked |
| Escape swallowed by the tag field | `TagInput` | REAL_REGRESSION found and fixed |
| type / place, tags, 12-item formula, migration 019 | new tests | STILL_VALID_AND_MISSING = 0 |

## Pixel
ACC-07 (`wf01-s10`) and WF02-S02 PASS with INTENTIONAL-SCOPE regions recorded (FB-09 / FB-10: tag controls replace chips / "Nhóm chuyên môn", skills gone; the editor box keeps the approved metrics).

## Related
- [S1-UAT-05-profile](S1-UAT-05-profile.md)
- [DECISION_LOG DEC-S1P](../../decisions/DECISION_LOG.md#dec-s1p)
