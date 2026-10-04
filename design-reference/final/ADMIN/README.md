# Admin Portal approved baseline

**PO APPROVED — ADMIN-DESIGN-01 = APPROVE_BASELINE (candidate commit `0bccca3`), promoted by ADMIN-PROD-08.** Byte-identical copies of `design-reference/candidate/admin/` at `0bccca3` (checksums: [SHA256SUMS](SHA256SUMS)); the candidate folder stays as the approval record. Like `../revision/`, these frames are read by their own spec (`admin-prod-08-pixel.spec.ts`), not by the M0-T11 `../manifest.yaml` harness, which is unchanged.

| Width | Status | Use |
|---|---|---|
| 1440 (`__1440x900.png`, `__1440__full.png`) | CANONICAL_REFERENCE | primary pixel baseline, DPR1 |
| 1024 / 768 (`__1024__full.png`, `__768__full.png`) | CANONICAL_REFERENCE | responsive references |
| 390 (`__390__full.png`) | KNOWN_DEBT | smoke only — pre-existing OpsShell sidebar |

Frames, routes and states: [candidate README](../../candidate/admin/README.md) · per-frame data: [capture-matrix.json](capture-matrix.json). Reproduce the actual side with the capture spec on a fresh DB (pinned timestamps, week 2026-W40).

Approved non-blocking debt (P2 / V2.1, PO): sparse desktop canvas on low-content pages; compact typography / controls; the 390 px OpsShell sidebar.

## Related
- [ADMIN-DESIGN-01-visual-baseline.md](../../../docs/implementation/reports/ADMIN-DESIGN-01-visual-baseline.md) · [../README.md](../README.md)
