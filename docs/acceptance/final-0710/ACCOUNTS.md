# Accounts — final walkthrough

Identifiers and readiness only. **No password, OTP, token, cookie, magic link or other secret is ever written here or anywhere in the repo.** Credentials are handed over out of band to the presenter.

| Account identifier | Display name | Role | Purpose | Expected access | Readiness | Dependency |
|---|---|---|---|---|---|---|
| none (signed-out browser) | — | Guest | Steps 01–09, 10G, 12–21 | Public pages; `/talents` member gate; team and founder allow-list | READY | — |
| to be provisioned | to be chosen (natural, production-like, no "demo / test" in visible fields) | Member (synthetic) | Steps 10M, 11: browse and filter talents | NETWORK_ONLY talent rows per each profile's visibility choice; no admin scope | **NOT READY** | FINAL-ACCESS-PREP-01 |
| presenter's approved e-mail (owner-side) | — | External viewer | Steps 19, 20: open the iHUB Ventures and VNV decks | Deck content on `deck.ihub.ventures` and `vnv.ihub.ventures` | **NOT READY** | FINAL-ACCESS-PREP-01 |

## Why the seeded profiles cannot be the member account
The six fictional profiles of `db/seed/demo_0710.sql` (Đặng Kim Chi, Nguyễn Minh Anh, …) use `@example.test` addresses with no credential and cannot sign in (seed header). Their addresses also contain "demo0710". They stay public showcase profiles only.

## Requirements for the member account (FINAL-ACCESS-PREP-01)
- Created through the normal sign-up flow on the production domain; a real mailbox the team controls.
- One root profile, membership approved through the normal ops path; no role shortcut, no DB edit.
- Visible name and profile fields natural; does not impersonate a real person.
- Verified before the rerun: sign-in works on the presenter machine, `/talents` lists rows, filters respond, no private field visible.

## Related
- [PRESENTATION_DATA](PRESENTATION_DATA.md) · [PRECHECK](PRECHECK.md) · [RUNBOOK_SOT](RUNBOOK_SOT.md)
