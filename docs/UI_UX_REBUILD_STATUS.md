# UI/UX rebuild — checkpoint ledger

Updated 20 September 2026. Read with CURRENT_STATE.md and UI_UX_REBUILD_GUIDE.md.

## Current handoff

- CP00 is merged via PR #82, merge `606f7dd1e0f9bdc12c83d7edd524759d023df206`.
- CP01 implementation is on `ui-ux/cp01-foundation`, pending PR review/explicit merge authorization. See [completion handoff](../handoffs/ui-ux/CP-01-COMPLETION.md).
- Original CP01 base: `407a0117203fd665fba57cb9d95ea60f857d114d`; resumed from current main `c5000b37445b83b40272bba533028a02259065fb`, retaining every newer generated-feed commit.
- No open PRs found at start. Subsequent main changes must be checked again in each workspace.
- Changes since the earlier #81 checkout were confined to generated events.json and online-events.json; they are preserved.
- Existing stack: static HTML/CSS/JavaScript; Node test runner; persistent mounted child views; shared stores/resolvers.
- No AGENTS.md found in the checkout or checked workspace ancestors.
- CP01 adds only isolated V3 presentation, tests and documentation. Existing QA server gets `.mjs` MIME support; production root/V2/runtime/data/auth/service-worker files are unchanged.
- Full-suite baseline remains the historically recorded 289/300 with 11 known failures; not rerun or independently reclassified in this documentation pass.
- Production calendar-generation acceptance and device acceptance of #78/#81 remain pending verification. Do not call them resolved.

## Programme

| CP | Scope | Status | Next gate |
|---|---|---|---|
| 00 | Baseline, guide, route parity, decisions, handoff | Merged: PR #82 | Complete |
| 01 | Shared design system and isolated preview shell | Implemented; focused/browser verification recorded in completion handoff; unmerged | Review PR; owner-device acceptance pending |
| 02 | Real deck workspace | Not started | Full list and preserved actions |
| 03 | Deck index, search, versions | Not started | Identity/back-state parity |
| 04 | Results, Game Log, Playtest | Not started | Evidence and playtest parity |
| 05 | Meta field/detail | Not started | Scope/loading/drill-down parity |
| 06 | Recommendations and accuracy | Not started | Unchanged domain calculations |
| 07 | Discovery and My Events | Not started | Freshness/durable attendance |
| 08 | Event workspace and Season | Not started | Complete participation lifecycle |
| 09 | Home, utilities, Settings | Not started | All old entry points accounted for |
| 10 | Journey acceptance and cutover | Not started | Owner-approved release/rollback |
| 11 | Collection specification | Future gate | Explicit feature-start confirmation |
| 12 | Collection/Kanto implementation | Future gate | Accepted migration specification |

## Operational rules

CP01 is based on updated main, not a stacked CP00 branch. Do not merge or switch production because the ledger says implemented. No hosted preview or production deployment was created by CP01; the supported local preview is `http://localhost:4173/v3-preview/` after `npm run dev`.

Every checkpoint updates this ledger, its handoff, relevant architecture docs and route parity. Record implemented, tested, merged, deployed and owner/device-accepted separately. Preserve a single active branch per checkpoint. Generated feed commits may advance main during work; never overwrite them.

Exact next action: review the CP01 PR and explicitly authorize any merge. Owner-device acceptance remains pending. After foundation acceptance/merge, the next brief is [CP02](../handoffs/ui-ux/CP-02.md); do not start it in the CP01 chat.
