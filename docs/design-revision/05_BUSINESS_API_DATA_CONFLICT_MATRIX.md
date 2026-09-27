# Business API Data Conflict Matrix

Behaviour is governed by the Business / Data SOT, API contract, RBAC and approved decisions; the design authorises presentation only.

Verified facts used below:
- **No AI:** no AI / LLM SDK in `package.json`, 0 AI references in `src/`, none in the SOT.
- **Onboarding intents:** allowlist `SUBMIT_SOLUTION · POST_CHALLENGE · ORGANIZE_COMMUNITY · EXPLORE_NETWORK` (DEC-WF01-S05-D1).
- **Consent:** TERMS + PRIVACY, versioned, recorded at onboarding step S07 (P0 must-exist).
- **`projects` columns:** `type`, `name`, `summary`, `status` (DRAFT / ACTIVE / ARCHIVED; created ACTIVE), `region_id`, `metadata`; plus domains and members. No traction, fundraising, risk, needs, recruitment or FAQ fields.
- **`org_type`:** HUB · CHAPTER · CLB · COMPANY · FUND · PARTNER.
- **`account_status`:** ACTIVE · BLOCKED · DEACTIVATED.
- **Future entities (Data SOT §C):** access / data-room entities, ConnectionRequest, deeper judge workflow. EventRegistration, Participation and Outcome are foundation-only.
- **No email provider.**
- **WF04** is a session demo; **WF05** is a session demo with SUBMITTED final (DEC-WF05-G1…G5); **WF06** is FUTURE.

## Delta summary by design group
| Group | UI only (existing behaviour) | Business / API / data delta | Future / external |
|---|---|---|---|
| HOME | Layout, copy, active CTAs | Guests pointed at the ops-only demo or leader-only pages; claims and placeholder blocks (DEC-P0-LANDING-D2 / D3) | Search, opportunities, post a problem, directories, matching, deck, data room, VI / EN |
| L1 | AUTH1–4 copy and layout; ACC-10 | New onboarding flow (intro + 4 steps); intents replaced by 6 multi-select ecosystem roles + self-declared **HUB position "chờ xác minh"**; **consent step removed**; new fields (country, phone, LinkedIn, website, experience items); **free-text skills** vs the controlled SKILL vocabulary; FP1-OWN owner profile (badges, activity sections, education, certificates, viewer statistics, public URL) | **AI suggestions** from CV (≤ 10 MB) / pasted text / LinkedIn: no service exists |
| L2 | ME0 and PRJ1–3 on existing fields; email invitation | Member-to-member profile view (FP1); invitation inbox (ME7); venture lifecycle with approval and completeness; Owner / Editor / Viewer permissions (RBAC); link invitations; ORGP1 **8 org types incl. `startup`** and "**một pháp nhân một tài khoản**" vs account = person; event calendar / detail read model | Library (DIR1), notifications (NOTI1), follow, connect via HUB |
| L3 | L19, L20, L23, L26 on existing data | Public KPIs and leadership (visibility); event type / owner / capacity fields; **leadership transfer** (2 signatures, 48 h reminder, 7-day expiry); join form with a 3-day SLA | Summit editor + HUB approval, registrants + CSV, regional qualification (judging), **email campaigns (no provider)** |
| L4 | — (the operator demo is not redrawn) | L28 public challenge page vs a demo whose data lives in the operator's tab (CONFLICT) | Problem entity + 6 tabs, benefits, partner organisations, Q&A, versioned updates, submitted teams, summit landing and registration; email and calendar exist as copy only |
| L5 | — | See HD-06 / HD-07 | Public startup profile SP1 (timeline from ActivityRecord) |
| L6 | L54 404 / 500 | EV1 partner variant (= L18); ADM15 new chapter / CLB approval (1 province = 1 chapter, QĐ-14 / BR-ORG-12); ADM17 platform account list (4 states vs `account_status`) + CSV | WS1 workspace = **new product scope**; SP1 tabs (traction, fundraising, risks, recruitment, FAQ, data room); maintenance mode |

## Human decisions
| ID | Group / screens | Design implies | Current approved behaviour | Required decision | Conservative default | Blocks Task 22 |
|---|---|---|---|---|---|---|
| HD-01 | HOME | ~25 CTAs, ~9 with a destination; claims ("30 bài toán Hà Nội", QĐ 1193, statistics); placeholder blocks | Real destinations only; no unverified claims (DEC-P0-LANDING-D2 / D3) | CTA policy, claims, content | No-destination CTAs become non-links or "Tương lai"; placeholder blocks omitted | No (default) |
| HD-02 | L1 ACC-05…09 | Intro + 4 steps; 6 ecosystem roles; HUB position claim; ACC-09 marked "BẢN ĐỀ XUẤT — CHỜ SPEC" | 3 steps (purpose / profile / privacy); intent allowlist; self-selection never creates ACTIVE membership | Adopt a new onboarding spec? | Keep the current flow; restyle only AUTH1–4 and ACC-10 | Yes (onboarding) |
| HD-03 | L1 AUTH1, ACC-09 | No Terms / Privacy acceptance anywhere | Versioned consent at S07 | Where consent is recorded | Keep the current consent step | Yes (onboarding redesign) |
| HD-04 | L1 L06b / L06c, ACC-05 / 09; L2 PRJ1 | AI suggestions from CV / text / LinkedIn | No AI service or API | Approve an AI backend + privacy (CV PII, retention) | No AI; manual fields only; never fake AI | Yes (AI UI) |
| HD-05 | L1 FP1-OWN, ACC-06 / 07; L2 L12 | New PII and fields, free-text skills, badges, activity sections, viewer statistics, public URL, "Xem như Guest", investor openness | Frozen profile fields; controlled vocabulary | Extend the profile model? | Existing fields only; no owner profile page yet | Yes (FP1-OWN, L12) |
| HD-06 | L2 L13 ME7, PRJ2; L5 L37 SUB0 | Invitation inbox; lifecycle Nháp → Chờ duyệt → Công khai; completeness; Owner / Editor / Viewer; link invites. **SUB0: A** creates a new canonical draft venture (the bridge annotation says PRJ1 and SUB0 create the same record) / **B** temporary team data / **C** reuse an owned venture | Venture ACTIVE on create; owner + members; email invitations; WF05 applies only with an owned venture | Venture lifecycle, permissions, which SUB0 option | Current venture behaviour; SUB0 not built (**C** only) | No (PRJ subset) · Yes (ME7, SUB0) |
| HD-07 | L5 L38–L43 | Target = problem; fixed S1–S6 schema with word limits, diagram upload, 3 files ≤ 25 MB, 90-day plan, support needs; autosave; **edit after submit until deadline**; code GP-…; milestone emails; profile snapshot | Target = programme; programme-configured questions; session store; SUBMITTED final and read only | **Session demo vs canonical persisted Application**; editability; target | Keep the WF05 demo contract; no L5 in Task 22 | Yes (L5) |
| HD-08 | L2 FP1, ORGP1; L3 L19; L5 / L6 SP1 | Public founder / startup profiles, startup data (traction, fundraising, risks, recruitment, FAQ, data room), org = shared account and 8 types, public chapter KPIs and leadership | Ventures private; visibility levels; account = person; OrganizationRepresentation separate | Public surfaces and data | No new public surface; L19 shows existing public data only | No (default) |
| HD-09 | L2 L16 / L18, L6 L47; L3 L23 | Calendar, one event page (L18 + L47), types, owner, capacity, registration, waitlist, calendar, recordings | Events: DRAFT → PUBLISHED; EventRegistration foundation only | Event discovery and registration | FUTURE; L23 shows existing statuses | No |
| HD-10 | L3 L21 / 22 / 24 / 25 / 27; L4 L28–L36; L6 L46 / 52 / 53 / 54 | Summit, registrants, qualification, campaigns, leadership transfer, public challenge / problem / summit, workspace, org approval, account admin, maintenance | Not in WF03 / WF04 contracts; WF06 FUTURE | Promote any of these? | FUTURE, except as decided per item | No |
| HD-11 | shells, all frames | New header / nav, ops sidebar items without screens, "Góp ý" button everywhere (feedback API only in the contract), mock inconsistencies, fonts not verifiable | DEC-P0-SHELL-D1…D7 | Shell model; feedback button | New visuals with existing destinations; inert items with a reason; no "Góp ý" button until a feedback flow is approved | No (default) |

## Related
- [03_ROUTE_DELTA_MATRIX.md](03_ROUTE_DELTA_MATRIX.md) · [06_SCOPE_BUCKETS.md](06_SCOPE_BUCKETS.md)
- [../product/1HUB_DATA_SOT_v1.1.md](../product/1HUB_DATA_SOT_v1.1.md) · [../decisions/DECISION_LOG.md](../decisions/DECISION_LOG.md)
