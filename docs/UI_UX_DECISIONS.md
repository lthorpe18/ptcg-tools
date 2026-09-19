# UI/UX rebuild decisions

19 September 2026. Product direction comes from the user's redesign conversation; technical decisions below define the initial implementation approach and may change only with recorded evidence.

## D01 — Existing repository and stack

Keep lthorpe18/ptcg-tools and plain HTML/CSS/JavaScript. Current package.json has no application framework dependency; the persistent shell already supports retained child state. Do not introduce React/Next or copy ETL to make the interface look different. A later framework proposal needs evidence and separate approval.

## D02 — Preview isolation

Implement the new shell/components under `v3-preview/`, alongside unchanged `v2-preview/`. Keep root entry, production navigation, PWA manifest and V2 service-worker registration unchanged until CP10. No app-wide automatic redirect to V3. Preview deployment is an explicitly labelled preview, not acceptance or cutover.

Use shared domain modules through narrow adapters. Some current modules assume V2 document structure or base paths: inspect those assumptions before reuse. Do not copy entire feature directories or instantiate duplicate sync/store owners. A route registry must distinguish native V3 destinations from explicit legacy transitions.

Preserve mounted-view lifecycle where needed. Do not embed the entire V2 shell inside V3. A full-document legacy transition is acceptable temporarily when documented and reversible; recursive shells and two bottom bars are not.

CP01 specimens are read-only with labelled fixture data; do not bootstrap account synchronization solely to demonstrate controls. Before CP02 live writes, prove adapters reuse existing identity/persistence and do not introduce concurrent sync owners.

## D03 — Navigation

Mature target: Home / Meta / Decks / Compete / Collection. Preview interim: four functional destinations plus app-level Utilities and Settings, with an extension point for Collection. Collection is not a dead/placeholder tab. Legacy production retains its five current destinations until cutover.

Global Game Log belongs in Compete; Decks retains filtered Results. Card Search is shared, accessible globally and contextually through Add Card. Tournament Manager remains a distinct organiser utility. Before a V3 feature is implemented, route explicitly to its real V2 counterpart rather than display a non-working imitation.

## D04 — Visual contract

Use the guide's shared tokens and compact controls. Artwork header is a shallow landscape strip with name overlaid only. No separate title/metadata block. Keep the subject recognisable on phones; use focal points rather than a narrow side slice.

Main task follows immediately: deck list, field, event rows or round input. Secondary information is disclosed progressively. Reduce redundancy and spacing before shrinking essential text. Controls remain comfortably tappable.

## D05 — Shared images, sprites and cover identity

PTCGCardImages owns production art resolution; DeckSprites.html owns sprites and user icon overrides. Cover selection/cropping is presentation metadata, never deck-list mutation. No new asset-provider engine or random cache-busting.

## D06 — Data and future features

Keep Deck IDs, immutable DeckVersion/listHash, canonical Match/Game evidence, participation, format/calendar and account snapshots intact. No invented physical readiness numbers in production. Digital deck workflows work without Collection.

Collection/Kanto work is reserved for CP11–12, not part of the UI foundation. Kanto stays direct-link and separate until a reviewed migration; goal membership must not double physical inventory. Existing feature-roadmap work can proceed separately with explicit coordination.

## D07 — Proof before acceptance

Parsing and test success do not prove mobile layout. CP01 onward requires actual browser inspection at 390px, narrow-phone and desktop sizes; milestone owner-device acceptance remains separately recorded. If browser access is unavailable, leave visual acceptance pending.
