# UI/UX capability and route parity

## CP01 exact preview routes — 21 September 2026

Paths below are relative to the repository deployment root (including any
hosting subpath). `shared/routes.mjs` owns the allowlist and URL construction.

| Preview URL | Owner/action | Temporary destination |
|---|---|---|
| `v3-preview/` or `v3-preview/#/specimen` | Native labelled 60-card component specimen | None |
| `v3-preview/#/specimen/states` | Native states, disclosures, dense rows and missing-art specimen | None |
| `v3-preview/#/home` | Explicit Home transition | `v2-preview/` |
| `v3-preview/#/meta` | Explicit Meta transition | `v2-preview/?section=meta` |
| `v3-preview/#/decks` | Explicit Decks transition | `v2-preview/?section=decks` |
| `v3-preview/#/compete` | Explicit Compete transition | `v2-preview/?section=compete` |
| `v3-preview/#/utilities` | App-level Utilities transition | `v2-preview/?section=tools` |
| `v3-preview/#/settings` | App-level Settings transition | `v2-preview/apps/settings/` |
| Any unrecognised hash, including `#/collection` | Native route-not-found and specimen recovery link | Never redirected to an arbitrary URL |

These are temporary full-document exits, not migrated Home/Meta/Decks/Compete
workflows. V2 alone owns its shell and sync while active. All existing V2 URLs
and query parameters remain untouched. Browser Back through V2 history restores
the transition; native specimen context is restored by Back or its explicit
return link. Direct-load/reload, Back/Forward and Home V2 roundtrip are covered
by `tests/browser/ui-ux-cp01.cjs`; exact URL mappings are unit-tested for hosting
subpaths. No V3 entity-ID routes exist until the relevant checkpoint proves them.

Local QA URL: `http://localhost:4173/v3-preview/` after `npm run dev`. The
completion handoff records an immutable hosted review URL for PR inspection;
that proxy URL is not a production deployment or cutover. Owner-device
acceptance is pending. See the CP01 completion handoff for rendered observations.

Historical CP00 inventory, 19 September 2026. Feature migration/acceptance remains pending; the CP01 foundation and temporary routes are recorded above. File paths identify current owners, not invented future URLs. Query/hash contracts must be extracted from the owning router when each capability is migrated; do not guess old-link redirects.

| Current entry / owner | Existing capability/action to preserve | Target owner | CP |
|---|---|---|---|
| v2-preview/index.html; scripts/persistent-shell.js | Persistent sections, section/route URL, history, activation, shell sync | One V3 shell | 01/10 |
| home-content.html | Blended summary, exact deck/event previews, quick actions, WSIP | Home, derived only | 09 |
| apps/meta/index.html; meta-router.js | Online/IRL/Blended, environment/format/window, grouping, field rows | Meta field | 05 |
| Same Meta owner | Exact variant, H2H, observed stats, recent results, lazy loading/retry | Meta detail | 05 |
| Same Meta owner | Expected Fields, What Should I Play, context and recommendation evidence | Meta / contextual Event Prep | 06 |
| Same Meta owner | Prediction archive, accuracy, scoring/history | Meta | 06 |
| apps/_shared/blended-methodology.html | Formula/methodology disclosure | Meta secondary details | 06 |
| apps/decklists/index.html | Saved index, search, create, import, rename/classify, icon preferences, deletion confirmation | Decks | 02/03 |
| Same decklists owner | Working list, quantities, validation, save/export, exact card inspector | Deck workspace | 02 |
| Same owner and shared card catalog | Card Search and contextual Add Card | Shared Search / Deck Add Card | 03 |
| Same decklists owner | Immutable versions/checkpoints, canonical hash, historical exact-list selection | Deck Versions | 03 |
| Same owner; deck-results components | Archetype/Deck/Version personal results, source filters, opponents/recent evidence | Deck Results | 04 |
| Same owner; match-store | PTCGL log import, manual training games, unified Game Log, edit/delete where supported | Compete Game Log / filtered Deck Results | 04 |
| Same decklists owner; Odds tab | Deck-specific probability | Deck contextual utility | 02/09 |
| apps/decklists/playtest*.html | Canonical supported playtest entry, selection, board, card inspect, reset, return | Decks Playtest | 04 |
| apps/events/index.html | Nearby/Majors/Online discovery, filters, event detail, external registration | Compete Find Events | 07 |
| apps/events/tournaments.html | Durable attendance/My Events; saved event survives discovery expiry | Compete My Events | 07 |
| apps/events/prep.html | Event-specific field/list/preparation context | Event workspace Prepare | 08 |
| apps/events/tournament-day.html | Rounds, Matches/Games, planned/played version, complete/drop/correct | Event workspace Play/Review | 08 |
| apps/events/season.html | Season progress, CP/BFL, insufficient-facts handling | Compete Season | 08 |
| apps/tools/index.html | Standalone Odds, Cut/ID, organiser Tournament entry | Utilities and contextual links | 09 |
| apps/swiss/index.html | Standalone Tournament Manager state and actions | Organiser utility, not personal event | 09 |
| apps/settings/index.html | Account & Sync, settings hub, preferences | App-level Settings | 09 |
| apps/settings/deck-icons.html | Deck icon overrides | Settings Preferences | 09 |
| apps/settings/data.html | Backup/export/restore and app-data controls | Settings Data | 09/10 |
| apps/settings/formats.html | Authorised shared Formats & Sets editor, validation/publish | Settings Maintenance | 09 |
| spinoffs/kanto-151/ | Exact printing, Owned/Wanted, search/filters, set groups, export, cloud persistence | Remains separate; later Collection goal | 11/12 |
| Root/PWA/service worker | Install, auth top-level redirect, update, offline/last-good, old deep links | Unchanged until verified cutover | 10 |

## Cross-feature acceptance cases

1. Meta filtered field → exact variant → evidence → Back restores scope/position.
2. Public list → explicit import → exact personal Deck ID; viewing does not create records.
3. Deck → version → personal result → filtered Game Log → correct training edit or event game.
4. Search → exact printing → Add Card → original target deck with quantity preserved.
5. Discovery → attend → saved participation → prepare → play → review → Season.
6. Event → actually used immutable version; planned list never overwrites historical evidence.
7. Home → exact deck/event rather than ambiguous list; utility entry stays discoverable.
8. Settings sign-out/account switch removes prior private state; backup restore retains identities.
9. Old URL reload, invalid object, missing external URL and Back from a legacy transition.
10. Future readiness → inventory/allocations → same digital deck, without implicit reservation.

## Migration ledger discipline

At each checkpoint add exact old/new URLs including parameters, source file/action evidence, tests, preview URL and acceptance state for affected rows. File-level inventory is not proof of route parity. Additional runtime-discovered actions must be added before the old surface is retired. No listed feature is deliberately dropped.
