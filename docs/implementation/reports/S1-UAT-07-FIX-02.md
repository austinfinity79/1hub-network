# S1-UAT-07-FIX-02

Closes US-02.14 AC4 ("Từ chối → Chủ sở hữu thấy 'Đã từ chối'", "có thể mời lại") and the order dependency of `s1-uat-07-invite.spec.ts`. Branch `feat/s1-uat-07-fix02` from the Sprint 1 candidate `9c5b52b` (`int/sprint1-candidate-01`); not integrated into the candidate yet. Decision [DEC-S1I-D7](../../decisions/DECISION_LOG.md#dec-s1i-d7); contract [05 amendment A16](../../architecture/05_API_CONTRACT_P0_v1.0.md).

## Before

| Area | Found |
|---|---|
| Decline | PENDING → REJECTED, idempotent, recipient only (404 otherwise); revoked / accepted → 409; **an expired invitation could still be declined** |
| Owner | `GET …/team` rows: owner, ACTIVE, pending only; a declined invitation vanished from the owner's view |
| Notification | `notifications` types fixed by migration 017 (verification, venture review); "Thông báo" outside the Sprint 1 UAT (Appendix D) |
| Spec | relied on another spec to create the "Logistics" catalogue item; first on a fresh DB, 12 / 12 failed at setup |

## Change

| Area | After |
|---|---|
| API | `GET …/team` + owner-only `declined[]`: latest declined invitation per address while that address has no pending invitation and is not ACTIVE; `rows` / `counts` unchanged (WF05 readers, PRJ2 untouched); member → `[]` |
| Decline | expired → 409 (as accept); rest unchanged |
| Team page | owner sees a "Đã từ chối · dd/mm" line (email, role, level, no action) after reload; "Mời thành viên" invites the address again, which replaces the line |
| Signal | the existing audit event `VENTURE_TEAM_INVITATION_REJECTED` (once); no new notification type, table or migration |
| Spec | `beforeAll(applyVocabularyFixture)`, the canonical idempotent QA fixture used by the other suites; assertions unchanged |

Test changed for behaviour, not to hide a regression: the G8 case asserted that the owner's view never carries a declined address; it now asserts that the address is absent from `rows`, present only in the owner's `declined`, and still absent for a member (DEC-WF02-S06-G8 restricts members; the newer UAT requires the owner line).

## Evidence

| Check | Result |
|---|---|
| decline security (DB) | wrong account / owner / malformed id 404; expired 409; revoked 409; accepted 409; concurrent + repeated decline → one REJECTED row, one event |
| owner side (DB + browser) | "Đã từ chối" after reload; re-invite → new pending row, line gone; declined again → only the latest; re-invited and accepted → one ACTIVE membership, no line; member sees none |
| standalone spec first, fresh DB | run 1: 13 / 13 · run 2 (DB dropped and recreated): 13 / 13 |
| DB suite | 56 files · 856 / 856 |
| targeted (S1-UAT-07, WF02-S05 / S06 / S08, WF02 UAT journey, PDF decisions, L2 runtime) | 72 / 72 · UAT L1-L2 19 / 19 |

Full regression, gates, git and the takeover verification (S1-UAT-07-FIX-02-TAKEOVER, which supersedes the figures above where they differ): [S1-UAT-07-FIX-02-evidence](S1-UAT-07-FIX-02-evidence.md).

## Related

- [S1-UAT-07-invite](S1-UAT-07-invite.md)
- [S1-CANDIDATE-INT-01](S1-CANDIDATE-INT-01.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
