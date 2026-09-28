# Matrix Application

Screen / Route / Data / Permission matrix — L5 (8 screens + 2 annotations). [DEC-2809-D5 / D6](overview.md#d5): Directory + Form for the Application; one canonical Venture; server-side Application. Legend as [matrix-homepage-auth.md](matrix-homepage-auth.md). Routes marked *proposed* need HD-A10.

| Screen | Route | Actor | Data entities | Permission | Current implementation | Class | Delta | Migration / API | Batch |
|---|---|---|---|---|---|---|---|---|---|
| L37 SUB0 Tạo nhanh hồ sơ đội | *proposed* inside the application entry, shown only when the member owns no eligible Venture | onboarded member | Venture (`projects`: type, name, domain, one-line summary) | onboarding DONE; creator = owner | none | **ALPHA** (option A quick-create + option C select existing; B temporary team rejected) | BE | reuse `POST /ventures` (type + name required today; SUB0 also requires domain and summary; type choice HD-A11); add audit | 22.7 |
| L38 SUB1-B1 Hiểu đề | *proposed* `…/applications/:programmeId` (today `/demo/projects/:id/applications/:programmeId`) | venture owner | Application (DRAFT), Programme question set | owner; programme PUBLISHED; applicant type allowed | WF05-S03 (session store, **SUPERSEDED**) | **ALPHA** (form) | BE | Application API (BD-11) | 22.7 |
| L39 SUB1-B2 Cách giải | same, step 2 | venture owner | Application answers (uploads Future) | owner | WF05-S03 (**SUPERSEDED**) | **ALPHA** (form; diagram / file upload is Future) | BE | same | 22.7 |
| L40 SUB1-B3 Đội & kế hoạch | same, step 3 | venture owner | Application answers, Venture team (read) | owner | WF05-S03 (**SUPERSEDED**) | **ALPHA** (form; team shown read-only from the canonical Venture) | BE | same | 22.7 |
| L41 SUB1-B4 Cần hỗ trợ gì | same, step 4 | venture owner | Application answers | owner | WF05-S03 (**SUPERSEDED**) | **ALPHA** (form) | BE | same | 22.7 |
| L42 SUB2 Soát trước khi nộp | *proposed* `…/review` | venture owner | Application, snapshot preview | owner | WF05-S04 (**SUPERSEDED**) | **ALPHA** (review + submit; SUBMITTED final, no edit after submit) | BE | `POST …/submit` (BD-11) | 22.7 |
| L43 SUB3 Nộp thành công | after submit | venture owner | Application (SUBMITTED, submitted_at) | owner | WF05-S04 "Đã nộp" state (**SUPERSEDED**) | **ALPHA** (no application code or email: no provider) | BE | same | 22.7 |
| L44 SP1 Hồ sơ startup — Bài toán & Cách giải | none | guest | Venture (public), ActivityRecord | public | none (ventures private) | FUTURE (detailed Startup Profile) | — | — | — |
| L45 SP1-T5 Tiến trình | none | guest | ActivityRecord | public | none | FUTURE | — | — | — |
| Lối vào khác · PRJ1 | — | — | — | — | — | annotation: the PRJ1 wizard is the other entry to the same canonical Venture | — | — | — |

**Directory for L5:** the existing member lists do the job and need no new frame: WF05-S01 (`/demo/projects`: my Ventures + open programmes) and WF05-S02 (Venture detail + eligible programmes). Their status chips must read the server Application (22.7). Their `/demo` prefix and the "Demo" entry label become wrong once data persists (HD-A10).

Totals: ALPHA 7 (L37–L43) · FUTURE 2. Backend foundation first: [application-persistence.md](application-persistence.md).

## Related
- [matrix-programme.md](matrix-programme.md) · [matrix-extensions.md](matrix-extensions.md) · [conflict-audit.md](conflict-audit.md)
