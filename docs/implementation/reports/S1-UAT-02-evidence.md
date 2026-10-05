# S1-UAT-02 evidence

Evidence for [S1-UAT-02-feedback](S1-UAT-02-feedback.md) on final HEAD `5ec1b8f` (clean build `SqGCZLMLkAlRSk_Fyojr0`), isolated DB `hubnetwork_s1fb`.

## Gates
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 39 files · 415 / 415 (incl. surfaces, route sanitising, UA parsing) |
| DB | 50 files · 804 / 804 (incl. `feedback.db-test.ts` 15) |
| FB-01 browser spec `s1-uat-02-feedback` | 14 / 14 |
| Protected regression | **93 specs · 1227 tests · 1198 PASS · 0 FAIL · 29 SKIP · 0 FLAKY** |

Skips: opt-in / env-gated only, unchanged (`pixel-qa-screens` 24, `admin-design-01-capture` 2, `admin-prod-08-pixel` 1, `wf06-prod-library` 1, `wf06-prod-qa` 1).

## Test matrix
| Case | Where | Result |
|---|---|---|
| Homepage submit (guest, e-mail) | browser | PASS — NEW, no account, e-mail kept, context HOME / PUBLIC |
| WF01 submit from Bước 3 | browser | PASS — route `/onboarding/purpose`, `WF01-S05`, step "Bước 3/4"; chosen role still checked |
| WF02 submit (PRJ1 and /me) | browser | PASS — typed venture name kept; screenshot stored; `WF02-S05` / `WF02-S01` |
| Required content / missing type | browser + DB | PASS — blocked before sending; server 422 `type` / `content` |
| Screenshot optional / wrong type / > 5 MB | browser + DB | PASS — sends without; refused with message; magic-byte sniff on the server |
| Upload failure (server) | browser | PASS — message, text kept |
| Guest e-mail optional, member none | browser + DB | PASS — member's sent e-mail ignored |
| Identity from session | browser + DB | PASS — forged `account_id` ignored |
| Context captured / stripped | DB | PASS — exact keys; query, fragment, cookie, forged screen / workflow dropped |
| Duplicate protection / retry | browser + API | PASS — double click → 1 request; same key replay → 1 row; 500 then retry → 1 row |
| Rate limit (10 / hour) | DB | PASS — 11th → 429, member and guest |
| Form state preserved | browser | PASS — stage 3, PRJ1, open → close → open keeps the draft |
| Success state | browser | PASS — "Cảm ơn bạn đã góp ý", same URL |
| Admin store compatibility | DB | PASS — same rows in `listFeedback` / `getFeedback` (sender, context, guest e-mail), still PLATFORM_ADMIN only, screenshot recognised by `isFeedbackScreenshot` |
| Not offered on WF03 / ops / demo / legal / WF05 forms | browser + unit | PASS |

## Accessibility and responsive
| Check | Result |
|---|---|
| Labels, names | dialog labelled by its title; radios in a fieldset with legend; every field labelled; "Đóng" named |
| Focus | first type radio on open; Tab trapped (radio group = one stop); Escape closes; focus back on "Góp ý"; first invalid field focused |
| Errors | `aria-invalid` + `aria-describedby` to the message (`role="alert"`) |
| 1440 · 768 · 390 | dialog inside the viewport, textarea / file / buttons usable, no horizontal overflow |
| Overlay | WF05 layout detector and REL-RESP treat the pill as an overlay; controls under it are brought clear by scrolling (checked) |

## Privacy / security
| Check | Result |
|---|---|
| Stored context | only A11 keys; no password, token, cookie, header, session id or form value |
| Server log (final run) | 0 unexpected 5xx; 0 `token=`, session cookie or hash |
| Cross-site | `Idempotency-Key` required → no preflight-free post |
| Screenshot serving | unchanged: feedback managers only, 90 days |

## Regression findings fixed in this task
Launcher shown on WF05 application screens (surface narrowed); dialog controls present while closed (rendered only when open); bottom spacer changed page length (removed); "hidden for Alpha" assertions and button counts (test drift). One discovery pass ran during a network outage (external startup feed failing): its timeouts did not recur.

## Git
| Field | Value |
|---|---|
| Branch | `feat/s1-uat-02-feedback` (worktree `../1hub-network-s1-feedback`), base `ade21cd` |
| Implementation commit | `5ec1b8f` |
| Report commit | the docs commit after `5ec1b8f` |
| Push / merge / deploy | NOT RUN |
| origin/main · production | `edd3d24` · `78f21f2` (untouched) |

## Related
- [S1-UAT-02-feedback](S1-UAT-02-feedback.md)
- [DECISION_LOG DEC-S1F](../../decisions/DECISION_LOG.md#dec-s1f)
