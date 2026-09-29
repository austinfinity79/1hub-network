# TASK-24.1 L2 Library Delta

**TASK 24.1 — L2 LIBRARY DELTA: GREEN.** The Startup and Nhà sáng lập tabs of `/library` follow the white-card frames of the 29/09 L2 board with the data the sources hold; Bài toán is unchanged (its frame is pixel-identical to L15). Delta matrix and open decisions: [../task-24/l2-library-delta.md](../task-24/l2-library-delta.md); decisions [DEC-L15-D10…D13](../../decisions/DECISION_LOG.md#dec-l15-d10). Not deployed, not pushed.

## Screens changed
| Screen | Change |
|---|---|
| DIR1 Startup tab | white card (square mark, name, stage pill, "N thành viên", tagline, domain chips, "Xem hồ sơ" → website or inert, "Theo dõi" inert); placeholder from the frame; search covers product and founder names |
| DIR1 Nhà sáng lập tab | white card (round mark, name, "role · startup", startup row → website, "Xem hồ sơ" and "Kết nối" inert) |
| DIR1 Bài toán tab | none |

## Data
Sources unchanged: problem dataset (47), `startup.json` (72 startups, 84 founders). New reads: `san_pham_chinh` and founder names for search only; the founder's startup stage for the row. Not drawn (no source data): verified mark, city, needs, programmes (D7), badges, expertise, openness, the "do hệ thống ghi nhận" note. No entity, API, migration or database change.

## Files
| Class | Files |
|---|---|
| FLOW-LOCAL | `src/components/library/library-client.tsx`, `library-model.ts`, `library-model.test.ts` (new), `library.module.css`; `src/lib/library/startup-adapter.ts`, `startup-adapter.test.ts`; `tests/visual/specs/public-library.spec.ts` |
| Baselines (new, L15 untouched) | `design-reference/final/revision/L2/L15b__library-startup__SOURCE.png`, `L15c__library-founder__SOURCE.png`, README |
| Docs | `DECISION_LOG.md` (D10–D13), `task-24/l2-library-delta.md`, this report, `CLAUDE_LATEST_REPORT.md`, `P0_STATUS.md`, `alpha-backlog.md` item 10 |
| SHARED | none |

## Tests
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| Unit (`src/lib/library`, `src/components/library`) | 21 / 21 (4 new) |
| `public-library` | 18 / 18 (2 new: L15b, L15c) |
| Responsive 1440 / 1024 / 768 / 390, three tabs | overflow 0; buttons reachable; #418 0; console 0; 4xx / 5xx 0; broken images 0; no source wording |

## Pixel (1440, DPR1)
| Audit | Segments (outside / beyond ±2 px) |
|---|---|
| L15b Startup | D-search 0.02 / 0.32 %; card actions 0.83 / 1.01 %; geometry: columns 358 / 705 / 1052, 324 wide, radius 18, border #e3dddd, buttons 44 / 47 |
| L15c Nhà sáng lập | D-search 0.06 / 0.07 % (placeholder text excluded, H4 of the matrix); card actions 0.83 / 0.76 % |
| L15 (unchanged) | hero, directory, load-more (moved to the Bài toán tab, L15's own) all within limits |

P0 0, P1 0, P2 0. P3 / design inconsistencies: the L15b / L15c tab bar leaves the inactive "Bài toán" bold (L15 style kept); single-word marks drawn both "Tr" and "CR" (the lead "Tr" followed). Intentional: data-omitted sections, so the grid starts 37 px above the frame's.

## Related
- [../task-24/l2-library-delta.md](../task-24/l2-library-delta.md) · [LIBRARY-DATA_deploy.md](LIBRARY-DATA_deploy.md)
