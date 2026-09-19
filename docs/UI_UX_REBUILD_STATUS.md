# UI/UX rebuild — checkpoint ledger

Updated 19 September 2026. Read with CURRENT_STATE.md and UI_UX_REBUILD_GUIDE.md.

## Current handoff

- CP00 documentation prepared on `docs/ui-ux-rebuild-cp00`; merge is not yet authorized or completed.
- Verified remote main at start: `8e9d8e2a81121924f3ecc6420dcc833c3d2a52d0`.
- No open PRs found at start. Subsequent main changes must be checked again in each workspace.
- Changes since the earlier #81 checkout were confined to generated events.json and online-events.json; they are preserved.
- Existing stack: static HTML/CSS/JavaScript; Node test runner; persistent mounted child views; shared stores/resolvers.
- No AGENTS.md found in the checkout or checked workspace ancestors.
- No application, backend, schema, generated data, auth or service-worker changes in CP00.
- Full-suite baseline remains the historically recorded 289/300 with 11 known failures; not rerun or independently reclassified in this documentation pass.
- Production calendar-generation acceptance and device acceptance of #78/#81 remain pending verification. Do not call them resolved.

## Programme

| CP | Scope | Status | Next gate |
|---|---|---|---|
| 00 | Baseline, guide, route parity, decisions, handoff | Documentation prepared for review | Review/merge docs PR |
| 01 | Shared design system and isolated preview shell | Ready to start from CP00 branch or merged main | Browser-verified shell; no production cutover |
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

CP01 may be based on this documentation branch before merge; target that branch with a stacked PR and disclose the dependency. If merged, start from updated main. Never merge CP00 or switch production merely because this ledger says ready.

Every checkpoint updates this ledger, its handoff, relevant architecture docs and route parity. Record implemented, tested, merged, deployed and owner/device-accepted separately. Preserve a single active branch per checkpoint. Generated feed commits may advance main during work; never overwrite them.

Exact next brief: [CP01](../handoffs/ui-ux/CP-01.md).
