# L1 Delta Matrix

WF-01 Individual Onboarding & Profile Activation. "Row" is the row of sheet `2. Actor`. Type: B business, U screen, D data, A API.

## Sign-in and account
| SOT requirement | Frame | Route | Today | Match | Change | Type |
|---|---|---|---|---|---|---|
| Guest browses public content (row 51–52) | — | `/`, `/about`, `/library` | public | yes | none | — |
| Sign in or create an account with e-mail (row 53–54) | AUTH1, AUTH2 | `/auth`, `/auth/check-email` | an address that is no account and not on the roster gets 403 `AUTH_ACCOUNT_NOT_PROVISIONED` | **no** | any plausible address gets a link; the account row is still created only on consume | B A |
| Account active only after verification | AUTH3 | `/auth/callback` | account inserted on consume, one-time token, 15 min | yes | none | — |
| Rate limit, no token leak, cookie flags | — | — | 10 / address, 30 / IP per 15 min; HttpOnly, Secure, SameSite lax | yes | none; limits now also protect open sign-up | — |
| Sign in with Google (row 53) | AUTH1 | `/auth` | no OAuth code, env or table; control drawn disabled "Sắp có" | **no** | control drawn as in the board; OAuth path only with credentials ([D-G1](open-decisions.md)) | B U A |
| No profile → onboarding; profile usable → Hồ sơ của tôi (row 55, 60) | AUTH3 | resolver | next step from `getOnboardingState` | partly | resolver steps renamed to the four stages | B |
| One account, one root profile | — | — | `individual_profiles.account_id UNIQUE` | yes | none | — |

## Onboarding
| SOT requirement | Frame | Route | Today | Match | Change | Type |
|---|---|---|---|---|---|---|
| Entry with the four stages and "Để sau" | ACC-05 | none | purpose question with four intents | **no** | new intro screen; the intent question leaves the flow | B U |
| Stage 1 basic information (row 56, 68) | ACC-06 | `/onboarding/profile` | name, headline, region, bio, up to 5 domain / skill chips, avatar | **no** | full name, display name, current role, short bio, country, province, e-mail (read only), phone (private), avatar | U D A |
| Stage 2 capability and field | ACC-07 | none | chips inside the profile step | **no** | domains, specialisations (max 5), skills, experience records, LinkedIn and website | U D A |
| Stage 3 ecosystem role; HUB link self-declared, no role or permission (row 58) | ACC-08 | `/me/roles` has the membership request only | one intent; membership request `PENDING_APPROVAL`, no position | **no** | six multi-select roles; HUB unit, position, period stored as a claim "Chờ xác minh"; no `role_assignments`, no leadership row | B U D A |
| Stage 4 review and finish; visibility in the network or private (row 59) | ACC-09 (proposal) | `/onboarding/privacy` | discovery switch + consent checkbox | **no** | review of the three stages, preview card, completion, visibility switch | U |
| Consent | none in the boards | `/onboarding/privacy` | both consents required to activate | **conflict** | [D-L1](open-decisions.md): board removes the step, approved legal text A2.3 requires an active confirmation | B |
| AI suggestion, saved only after confirmation (row 57, 70) | ACC-05, ACC-06 AI | none | no AI service | **no** | no provider: blocks drawn, action inert, nothing generated ([D-A1](open-decisions.md)) | B |
| Completion computed by the server (row 60, 72) | ACC-09 | `/me/profile/completion` | frozen 10 groups | partly | [D-C1](open-decisions.md): groups include fields the new flow no longer asks | B D |
| Next actions (row 61) | ACC-10 | `/onboarding/complete` | one card "Lập hồ sơ đội" | partly | cards only for routes that exist; HUB verification card when a claim exists | U |
| Identity verification through 1Hub / VNeID (row 62) | — | — | none | yes | later phase, not built | — |
| Feedback at any time (row 63) | "Góp ý" pill | — | none in onboarding | **no** | [D-F1](open-decisions.md) | B U |

## Owner profile
| SOT requirement | Frame | Route | Today | Match | Change | Type |
|---|---|---|---|---|---|---|
| Hồ sơ của tôi after onboarding (row 60) | FP1-OWN | `/me` | "Tài khoản của tôi" with three cards | **no** | owner profile page with the sections that have data ([D-P1](open-decisions.md)) | U D |

## Data that the schema cannot hold today
| Field | Needed by | Present |
|---|---|---|
| full name apart from display name | ACC-06 | no |
| country | ACC-06 | no (REGION vocabulary holds provinces) |
| phone, private | ACC-06 | no |
| specialisation list | ACC-07 | no (DOMAIN and SKILL only) |
| experience period and description | ACC-07, L12 | columns exist, API writes title and organisation only |
| ecosystem roles, multi-select | ACC-08 | no (`primary_intent`, single) |
| HUB position claim (title, period) | ACC-08 | no (`community_memberships` has the unit only) |

## Related
- [overview.md](overview.md) · [l2-delta-matrix.md](l2-delta-matrix.md) · [open-decisions.md](open-decisions.md)
