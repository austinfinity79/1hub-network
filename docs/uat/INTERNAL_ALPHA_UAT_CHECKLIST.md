# Internal Alpha UAT Checklist

One page for the product owner while testing https://1hubnetwork.io.vn. Tick one status per line; log every FAIL / BLOCKED in the [results template](INTERNAL_ALPHA_UAT_RESULTS_TEMPLATE.md). This checklist does not change the release status: **Team UAT stays PENDING** until people have actually tested and signed off.

Tester: ____________ Date: ____________ Browser / width: ____________

## Workflows
| Workflow | Key checks | PASS | FAIL | BLOCKED | NOT TESTED | Worst severity |
|---|---|---|---|---|---|---|
| [WF-TEST-01](self-review/guest-auth.md) Guest → sign-in | Landing and CTA; `/auth`; operator link signs in; used / broken / expired link refused; guest sent to `/auth`; sign-out | ☐ | ☐ | ☐ | ☐ | |
| [WF-TEST-02](self-review/new-member-onboarding.md) New member onboarding | 3 steps; required name; lists only (province, expertise); visibility switch separate from consent; consent required; system-computed completion %; no repeat after finish | ☐ | ☐ | ☐ | ☐ | |
| [WF-TEST-03](self-review/member-profile-ventures.md) Member → profile → ventures | Profile edit persists; roles; settings; create PROJECT; invite → accept → ACTIVE member; member cannot edit; unrelated user gets "Không tìm thấy trang" | ☐ | ☐ | ☐ | ☐ | |
| [WF-TEST-04](self-review/leader-operations.md) Leader operations | Only own organization; dashboard; approve request; leadership separate; profile; relationships; create + publish event → public page; Chapter 02 and member denied | ☐ | ☐ | ☐ | ☐ | |
| [WF-TEST-05](self-review/programme-demo.md) Programme / Challenge (DEMO) | Create → journey → events → registration → team → review → publish → detail; stays in tab; reset; member denied | ☐ | ☐ | ☐ | ☐ | |
| [WF-TEST-06](self-review/application-demo.md) Application (DEMO) | Draft → save → resume → review (blocked when incomplete) → submit once; STARTUP → Startup, PROJECT → Đội; team member / unrelated / DRAFT programme denied; reset | ☐ | ☐ | ☐ | ☐ | |

## Across the product
| Check | PASS | FAIL | NOT TESTED |
|---|---|---|---|
| Vietnamese copy reads naturally; no technical words (DTO, enum, id, "mock") | ☐ | ☐ | ☐ |
| Burgundy 1hub identity; Be Vietnam Pro font; no broken layout at desktop width | ☐ | ☐ | ☐ |
| Back button and page refresh keep you on the right screen, signed in | ☐ | ☐ | ☐ |
| No link leads to a dead page (except the known legal links) | ☐ | ☐ | ☐ |
| Nothing shows another person's email or private data | ☐ | ☐ | ☐ |
| Tablet / phone: every button reachable (sideways scroll on member / ops pages is known) | ☐ | ☐ | ☐ |

## Severity
| Level | Use when | Examples |
|---|---|---|
| **P0** | Security, privacy or data loss; the product cannot be used | Sees another member's private data; a guest can change data; a sign-in link works twice |
| **P1** | A core journey is broken with no workaround | Onboarding cannot finish; a leader cannot approve a request |
| **P2** | One screen or feature behaves wrongly, but a workaround exists | Wrong status after save until refresh; a button unreachable at one width |
| **P3** | Cosmetic or copy; does not change behaviour | Typo, spacing, a label that could be clearer |

Not a defect: anything under "Known limitations" in the [guide](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md), and anything labelled FUTURE.

## Issue record (fields)
Workflow · Screen · Step · Account · Expected · Actual · Screenshot · Severity · Notes. Use the [results template](INTERNAL_ALPHA_UAT_RESULTS_TEMPLATE.md).

## Related
- [INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — journeys and status labels
- [INTERNAL_ALPHA_TEST_ACCOUNTS.md](INTERNAL_ALPHA_TEST_ACCOUNTS.md) — accounts
