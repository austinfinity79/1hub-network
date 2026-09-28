# Scope Refreeze

TASK 22 — ingest of the PO decisions of 2026-09-28 ("Thảo 28/09") and refreeze of the Internal Alpha scope. **Docs only:** runtime, schema, migration, API and RBAC changes are 0.

## Source (frozen)
| Field | Value |
|---|---|
| Named in the task | `Update 28_9(1).docx` |
| File on this machine | `~/Downloads/Update 28_9.docx` (no `(1)` copy exists; same situation as the corrected ZIPs, [00](../00_CORRECTED_SOURCE_MANIFEST.md)) |
| SHA-256 | `92f62747b1a20d60f2515f2de7960965bd42bd7ee18a8b3390d95e7ec1c5eb14` |
| Saved | 2026-09-27 18:56 (docx parts), 74 text lines, Vietnamese |

If the PO holds a different `(1)` file, compare its hash before implementation.

## Authority
| Question | Source of truth |
|---|---|
| UI (layout, copy, components) | Corrected design, `design-reference/final/revision` and the Task 21 v2 audit |
| Internal Alpha scope and behaviour | **The 28/09 decisions** (this folder); they supersede earlier defaults where they conflict |
| Anything neither covers | Earlier frozen decisions stay in force; a gap is a human decision, never a guess |

## Frozen decisions
| ID | Topic | Decision |
|---|---|---|
| <a id="d1"></a>DEC-2809-D1 | Homepage | `/` stays the public homepage. Discovery CTAs are public; create / register / submit / admin CTAs need login and return to the intended action. Hero search = public data only. No dead link: an out-of-scope CTA is hidden or shows "Coming soon". CTA targets: [homepage-cta-map.md](homepage-cta-map.md) |
| <a id="d2"></a>DEC-2809-D2 | L1 AI | The onboarding AI suggestion is **live Internal Alpha**. It never publishes a profile, never creates a Venture, never replaces validation; manual onboarding always works; AI failure or quota never blocks onboarding |
| <a id="d3"></a>DEC-2809-D3 | L3 | Executable Alpha capability: dashboard, chapter information management, member approval. Everything else is Future unless independently approved |
| <a id="d4"></a>DEC-2809-D4 | L4 | Directory screens for public discovery only. Challenge / Problem detail (expanded), Q&A, Updates, Submitted Teams, Chapter Summit, Summit Registration and other operating capability are Future |
| <a id="d5"></a>DEC-2809-D5 | L5 Venture | Project and Startup are one canonical Venture (`type` PROJECT \| STARTUP). The applicant selects an existing Venture or quick-creates a minimal canonical one. No temporary / session-only team. Detailed Startup Profile and team management are Future |
| <a id="d6"></a>DEC-2809-D6 | L5 Application | Application **persists server-side**: DRAFT → SUBMITTED; save, exit, resume; one active Application per (Venture, Programme / Challenge); submit stores an answer snapshot and a Venture / team snapshot that later edits never change |
| <a id="d7"></a>DEC-2809-D7 | L6 | Only Directory or Form screens present in the corrected design are Alpha. Workspace, booking, standalone Event Detail, Startup tabs, admin Chapter / CLB approval, account list and System Status are Future. A future Event Detail reuses the canonical Event |

L4, L5 and L6 in Alpha build only Directory and Form screens; operating, admin, community-interaction, workspace, event-detail, extended startup-profile and monitoring capability is Future, with no route or business logic in the Alpha batch.

## Files
| File | Content |
|---|---|
| [homepage-cta-map.md](homepage-cta-map.md) | Every homepage CTA: old target, new target, auth rule |
| [matrix-homepage-auth.md](matrix-homepage-auth.md) · [matrix-member.md](matrix-member.md) · [matrix-chapter.md](matrix-chapter.md) · [matrix-programme.md](matrix-programme.md) · [matrix-application.md](matrix-application.md) · [matrix-extensions.md](matrix-extensions.md) | Screen / Route / Data / Permission matrix, 62 screens |
| [application-persistence.md](application-persistence.md) | L5 backend foundation audit |
| [backend-deltas.md](backend-deltas.md) | Every backend delta with migration / API needs |
| [conflict-audit.md](conflict-audit.md) | OLD / NEW / IMPACT / REMEDIATION |
| [human-decisions.md](human-decisions.md) | Decisions still open |
| [task-sequence.md](task-sequence.md) | Recalculated Task 22 batches |

## Related
- [../05_BUSINESS_API_DATA_CONFLICT_MATRIX.md](../05_BUSINESS_API_DATA_CONFLICT_MATRIX.md) — HD-01…HD-12 (partly superseded here)
- [../06_SCOPE_BUCKETS.md](../06_SCOPE_BUCKETS.md) · [../07_TASK22_IMPLEMENTATION_ORDER.md](../07_TASK22_IMPLEMENTATION_ORDER.md)
- [../../decisions/DECISION_LOG.md](../../decisions/DECISION_LOG.md#dec-2809) — DEC-2809 and the superseded records
