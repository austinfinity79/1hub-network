# L1 Conflict Record

Traceable record for reopening the CLOSED workflow WF01 (CLAUDE.md §14; PROCESS-P0-ACCELERATED-SAFE-V2 §G, §J). New evidence: the BA workbook and the L1 flow board the PO supplied on 28/09, and the PO task of 29/09. Each conflict names the older rule, the newer source and the resolution, which is recorded as [DEC-L1R](../../decisions/DECISION_LOG.md#dec-l1r).

## Conflicts
| ID | Older rule | Newer source | Resolution |
|---|---|---|---|
| C-L1-01 | DEC-AUTH-EMAIL-D1: only provisioned addresses get a link | workbook row 53: sign in or create an account with Google or e-mail; PO task "IMPORTANT CHANGE" | open sign-up, DEC-L1R-D1 |
| C-L1-02 | WF01 contract: purpose → profile → privacy → complete | workbook row 56: four stages; board ACC-05 … ACC-10 | DEC-L1R-D3 |
| C-L1-03 | DEC-WF01-S06-D2: leaving the profile step needs name, headline, region, one expertise | board ACC-06: full name, display name, country, province marked required | DEC-L1R-D3, D4 |
| C-L1-04 | DEC-WF01-S06-D1 / D4: one picker, five items over domain and skill | board ACC-07: three pickers, "Đã chọn n/5" on specialisations | DEC-L1R-D4 |
| C-L1-05 | DEC-WF01-S05: one primary intent, investor excluded | board ACC-08: six roles, multi-select, investor representative among them | DEC-L1R-D5: a declaration, never a permission; no investor feature is opened |
| C-L1-06 | DEC-WF01-S08-D4: no chapter action, nothing inferred | workbook rows 58, 61, 69: the member names a HUB link; follow its verification | DEC-L1R-D5, D6: named by the member, filed as a pending request |
| C-L1-07 | DEC-WF01-S08-D1: opening the completion page completes | board ACC-09: "Hoàn tất hồ sơ" | DEC-L1R-D6 |
| C-L1-08 | DEC-L1-D3: terms line under the sign-in button | board AUTH1 without it; approved legal text A2.2–A2.3 | DEC-L1R-D2 |
| C-L1-09 | DEC-L1-D9: Google control disabled with "Sắp có" | board AUTH1; workbook row 53 | DEC-L1R-D2; provider is an external blocker |
| C-L1-10 | Freeze D3 activation minimum: display name, region, consents | board ACC-06 required marks; workbook row 56 | DEC-L1R-D6 extends it; nothing is removed |

## Workbook against board
| ID | Point | Workbook | Board | Handling |
|---|---|---|---|---|
| X-L1-01 | consent | not named in WF-01; approved legal text requires an active confirmation | ACC-09 has no acceptance control | PO decision D-L1: one required confirmation in stage 4 |
| X-L1-02 | completion | row 60: the system computes it | ACC-09 shows 75 % with website and phone as missing | PO decision D-C1: frozen ten groups; the list is what raises the percent |
| X-L1-03 | destination after onboarding | row 60: "Hồ sơ của tôi" | ACC-10, then FP1-OWN | `/me` today; FP1-OWN is built with L2 |
| X-L1-04 | HUB verification | rows 58, 69: recorded as pending | ACC-08: "quản trị viên hoặc đơn vị liên quan xác nhận" | no authority is invented: D-H1 stays open, the request stays pending |

## Not changed
| Item | Why |
|---|---|
| token, expiry, single use, rate limits, session, cookie | the PO task forbids weakening them; open sign-up needs no change to them |
| one account, one root profile | `individual_profiles.account_id` UNIQUE; first writes use upsert |
| WF02, WF03, WF04, WF05 behaviour | out of scope; their specs changed only where they drive onboarding |
| accounts completed before this change | the resolver reports them DONE as before |

## Related
- [overview.md](overview.md) · [open-decisions.md](open-decisions.md) · [l1-screen-contracts.md](l1-screen-contracts.md)
- [../../design-revision/scope-refreeze/conflict-audit.md](../../design-revision/scope-refreeze/conflict-audit.md) — the earlier conflict audit
