# Precheck — before the final acceptance rerun

Run in order on the presenter machine, network and browser. Any NO stops the rerun.

## Release
| Check | How | Expected |
|---|---|---|
| Exact SHA | local `main`, `git ls-remote origin main`, container label `org.opencontainers.image.revision` | all equal to the approved SHA (deploys use the exact SHA, never HEAD) |
| App health | container `hubnetwork_demo_0710-app-1` | healthy, no restart since deploy |
| Domains | `https://1hubnetwork.io.vn` and `https://1hub.network` | both 200 on `/`, `/products`, `/about`, `/programmes`; same content |
| No change after QA | compare SHA with the one recorded in [RUNBOOK_RESULT](RUNBOOK_RESULT.md) | unchanged, or a new full rerun |

## Dependencies closed
| Dependency | Closed when |
|---|---|
| PO approval of [RUNBOOK_SOT](RUNBOOK_SOT.md) | PD-EVT, PD-TAL, PD-VER signed |
| PROGRAMME-PRESENTATION-DATA-01 | `/programmes` shows only approved records; visible-text scan finds no demo / mẫu / Internal Alpha |
| ABOUT-PARTNERS-PRESENTATION-01 | partner wall shows approved partners, or is hidden; no "Dữ liệu minh hoạ" / "Doanh nghiệp A" |
| APEC-LINK-01 | APEC row opens the authoritative URL in a new tab |
| FINAL-ACCESS-PREP-01 | member account READY in [ACCOUNTS](ACCOUNTS.md); decks open with content on the presenter machine (or public view granted) |

## Presenter setup (original section A, updated)
- Incognito window, signed out, desktop 16:9, notifications and extensions off.
- Second window signed in as the member account, opened only for steps 10M–11.
- Backup tabs open and loaded: APEC URL, iHUB Ventures deck, VNV deck.
- A 2–3 minute screen recording of the walkthrough as fallback.
- Do not click: "Tổ chức chương trình", "Gọi vốn" (disabled), footer legal links (PUBLIC-LEGAL-01), global search submit.

## Related
- [ACCOUNTS](ACCOUNTS.md) · [PRESENTATION_DATA](PRESENTATION_DATA.md) · [FINAL_ACCEPTANCE_REPORT](FINAL_ACCEPTANCE_REPORT.md)
