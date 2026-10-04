# ADMIN-PROD-05-accounts

**Evidence 10 – 13: account operations, lock / deactivate semantics, session invalidation, self-action protection.** Parent: [ADMIN-PROD-05-feedback-categories.md](ADMIN-PROD-05-feedback-categories.md). PD-7; rules R15, R16.

> **Superseded in part (ADMIN-PROD-07-CONTRACT-FIX):** revoke authority is now exact-unit only ([DEC-ADM-D02](../../decisions/DECISION_LOG.md#dec-adm-d02)); `account:escalate` and the leader account-request route are withdrawn ([DEC-ADM-D04](../../decisions/DECISION_LOG.md#dec-adm-d04)). Historical evidence below is kept as recorded.

## 10. Account operations
| Call | Who | Effect |
|---|---|---|
| `POST /ops/accounts/{profileId}/lock` · `unlock` · `deactivate` · `reactivate` · `soft-delete` `{ reason? }` | PLATFORM_ADMIN (`account:administer`) | below; anyone else 403 before the id is read (no enumeration) |
| `POST /ops/organizations/{orgId}/members/{profileId}/account-requests` `{ action, reason? }` | leader with `account:escalate` on exactly the unit | files LOCK / DEACTIVATE / SOFT_DELETE for an ACTIVE member of that unit → 201; never executes |
| `GET /ops/account-requests` · `GET …/{id}` · `POST …/{id}/process` · `…/decline` | PLATFORM_ADMIN | one queue: leader escalations + users' own deletion requests (WF02-S07); process executes the action, decline closes it — declining a deletion request needs a reason ([DEC-ADM-PD7.1](../../decisions/DECISION_LOG.md#dec-adm-pd7-1), [FIX](ADMIN-PROD-05-FIX-deletion-policy.md)); a profile-less account's deletion is processable |
The target is the person's profile id (account ids are never serialized; an account without a profile cannot be targeted). Every action: actor, target, optional reason (≤ 500), timestamp, audit. No hard-delete endpoint or code path exists.

## 11. Semantics
| Operation | Account | Profile | Sessions | Roles | Notes |
|---|---|---|---|---|---|
| LOCK | ACTIVE → BLOCKED | kept | all revoked | kept | data kept; UNLOCK → ACTIVE (old sessions stay revoked) |
| DEACTIVATE | ACTIVE / BLOCKED → DEACTIVATED | → DEACTIVATED | all revoked | organization-scoped ACTIVE → CLOSED | REACTIVATE → ACTIVE; profile ACTIVE if onboarding was completed, else DRAFT; roles not restored |
| SOFT_DELETE | → DEACTIVATED | → DEACTIVATED | all revoked | closed | the privacy request: the account's deletion request (the user's own, or recorded now) → PROCESSED with handler and time; flagged for the separate retention procedure; nothing deleted; REACTIVATE refused (409) |
Transitions: the same state again is no change (200, `changed: false`, no audit); LOCK / UNLOCK of a DEACTIVATED account and REACTIVATE of a BLOCKED one → 409. Audit: `ACCOUNT_LOCKED` / `_UNLOCKED` / `_DEACTIVATED` / `_REACTIVATED` (before / after statuses, revoked and closed counts, retention flag), `ACCOUNT_SOFT_DELETE_REQUESTED` (the task's SOFT_DELETE_REQUESTED), `ACCOUNT_REQUEST_FILED` / `_PROCESSED` / `_DECLINED`.

## 12. Session invalidation (shared auth, changed)
| Path | Before | Now |
|---|---|---|
| existing session of a locked / deactivated account | revoked by the operation only | revoked in the operation's transaction **and** `resolveSession` authenticates only an ACTIVE account — a session minted by a sign-in racing the lock is useless too |
| new sign-in (magic-link consume) | refused for BLOCKED only | refused for any non-ACTIVE account (`AUTH_ACCOUNT_BLOCKED`, 403) |
| refresh | no refresh token exists (fixed-TTL sessions) | re-authentication is the sign-in above, refused |
Nothing in the repo sets an account status before this task or relies on a session of a non-ACTIVE account. Tests: a live session is refused right after LOCK / DEACTIVATE (DB and over HTTP), sign-in refused, UNLOCK lets a new sign-in in.

## 13. Self-action protection
An admin can never lock, deactivate or soft-delete their own account, nor process or decline a request about it: 403 `SCOPE_FORBIDDEN`, audited `ACCOUNT_SELF_ACTION_REFUSED` before any transaction (with or without an Idempotency-Key, so a replay cannot skip it). Every operation locks the actor's and the target's accounts together (id order) and requires the actor to be still ACTIVE: two admins locking each other at once → one wins, the other 403. Administration therefore cannot be orphaned by one action; another admin can be acted on (no second-admin approval invented). Leaders cannot file against themselves (422). A self-deletion row names its requester only when WF02's `ACCOUNT_DELETION_REQUESTED` audit proves the user filed it.

## Concurrency
Actor + target accounts (id order), then the target's profile, then any request row (one order everywhere). Two locks → one change, one audit; lock vs deactivate → always DEACTIVATED (deactivate first makes the lock a 409); processing a request twice → 409.

## Related
- [ADMIN-PROD-05-feedback-categories.md](ADMIN-PROD-05-feedback-categories.md) · [ADMIN-PROD-05-qa.md](ADMIN-PROD-05-qa.md) · [ADMIN-PROD-05-FIX-deletion-policy.md](ADMIN-PROD-05-FIX-deletion-policy.md) · [ADMIN-PROD-01-rbac-matrix.md](ADMIN-PROD-01-rbac-matrix.md)
