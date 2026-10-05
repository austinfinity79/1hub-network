# S1-UAT-02 feedback

Sprint1 FB-01 "Góp ý": popup, submit, context, optional screenshot / e-mail, persistence into the canonical feedback store. Decisions [DEC-S1F](../../decisions/DECISION_LOG.md#dec-s1f); contract [05 amendment A13](../../architecture/05_API_CONTRACT_P0_v1.0.md). Tests and git: [S1-UAT-02-evidence](S1-UAT-02-evidence.md).

## Preflight
| Check | Result |
|---|---|
| Base | `ade21cd` (S1-UAT-01 final); worktree `../1hub-network-s1-feedback`, branch `feat/s1-uat-02-feedback`; tree clean |
| Migrations | 001 → 018 intact; isolated DB `hubnetwork_s1fb` (shared `hubnetwork_p0` untouched, still 017) |
| Writers | no other session on this worktree / DB; `origin/main` `edd3d24` unchanged; production `78f21f2` not touched |
| Read | FB-01 (feedback.md), US-X.01, API 05 §2.3 / §6 / A11, migration 017, `src/lib/admin/feedback*.ts`, media store, shells, DEC-AIG-D7 |

## Existing model audit
| Item | Found | Used |
|---|---|---|
| Table | `feedback_submissions` (001 + 017): type, body, context jsonb, screenshot_asset_id, guest_email, status NEW, account / profile | as is — **no migration** |
| Types | enum BUG · UX · FEATURE · OTHER; `SENDER_FEEDBACK_TYPES` = BUG · UX · FEATURE | as is |
| Rules | `FEEDBACK_LIMITS` (2000 / 5 MB / 254), `parseGuestEmail`, `FEEDBACK_CONTEXT_KEYS` | reused |
| Media | asset store `asset_<32hex>`, served to feedback managers only, 90 days | reused (`saveAvatarAsset`) |
| Idempotency | operation `feedback.submit` registered | reused (`runIdempotent`) |
| Submit API | `POST /feedback` in contract §6, not implemented | implemented |
| UI | "Góp ý" hidden for Alpha (DEC-AIG-D7) | superseded on FB-01 surfaces |

## Architecture
| Piece | Role |
|---|---|
| `src/lib/feedback/surfaces.ts` | where "Góp ý" shows; route → screen / workflow / step (browser and server) |
| `src/components/feedback/feedback-launcher.tsx` | the one launcher + native modal, mounted once in `src/app/layout.tsx` |
| `src/app/api/v1/feedback/route.ts` | multipart POST, key required, session identity, idempotent run |
| `src/lib/feedback/submit.ts` | validation, context, limit, insert (+ asset cleanup on failure) |

## Behaviour
| Area | Result |
|---|---|
| Entry points | homepage, /about, /library, /auth*, /onboarding*, /me*, ME7, PRJ1, edit, team; none on WF03 / ops / admin / demo / legal / WF05 application screens |
| Types | Báo lỗi · Góp ý trải nghiệm · Đề xuất tính năng → BUG · UX · FEATURE; required, none preselected |
| Validation | type, content 1–2000, e-mail shape, screenshot type (sniffed) and ≤ 5 MB — client and server |
| Context | route (path only), screen, workflow, step, browser, os, device, user_agent (request header), viewport, locale; nothing else |
| Screenshot | only a chosen file; existing media store; refused file → message, text kept; none → still sends |
| E-mail | guests only, optional, private ("Chỉ dùng để phản hồi bạn, không hiển thị công khai."); members: their account |
| Persistence | NEW in `feedback_submissions`; answer `201 RECEIVED` |
| Idempotency | key per draft; double click = one request; retry = replay; edited draft = new key |
| UX | success "Cảm ơn bạn đã góp ý", same screen and state; draft kept across close / reopen and errors; cleared after send |
| Limit | 10 per hour (US-X.01) per account / guest address → 429 |

## Related
- [S1-UAT-02-evidence](S1-UAT-02-evidence.md)
- [DECISION_LOG DEC-S1F](../../decisions/DECISION_LOG.md#dec-s1f)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
