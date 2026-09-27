# Corrected Design Revision Baselines

Approved pixel references from the corrected Homepage + L1–L6 revision ([audit](../../../docs/design-revision/00_CORRECTED_SOURCE_MANIFEST.md)). A frame is added here only when the task that implements it is authorised (TASK 22, Bucket A). The WF01–WF03 baselines and `../manifest.yaml` are unchanged; these files are read by their own specs, not by the M0-T11 manifest harness.

| Screen | File | Size | SHA-256 | Source | Added by |
|---|---|---|---|---|---|
| H1 Homepage `/` | `H1/H1__homepage__SOURCE.png` | 1440×17999 | `9f77830527ee7fa02cbab43e3f9329b88a28f858f45b20c67728efc05380e979` | `Homepage.zip` (`31d6e5cc…ae35`), `Sprint 1_ (DL29) new 25/Homepage.png`, byte-identical copy | TASK 22.1 |

Rules:
- Typography: Space Grotesk where the reference uses it (DEC-HD-12); mono labels keep IBM Plex Mono 500.
- Blocks omitted under HD-01 (placeholder or unverified content) are not compared; the P0-LANDING spec lists them.
- Never edit or re-export a file here to make a diff pass. A new source revision gets a new file and hash.

## Related
- [../README.md](../README.md) — WF01–WF03 baselines
- [../../../docs/decisions/DECISION_LOG.md](../../../docs/decisions/DECISION_LOG.md) — DEC-HD-12, DEC-H1
