# V3 preview — CP01 foundation

Read-only UI specimens, not a replacement production application. Start with
`npm run dev`, then open `http://localhost:4173/v3-preview/` in that machine's
browser. The repository QA server now serves `.mjs` as JavaScript. There is no
build, framework, manifest, service-worker registration, auth bootstrap or store.

## Ownership

| File | Responsibility |
|---|---|
| `index.html`, `app.js` | One app shell, specimen composition and presentation-only history snapshots |
| `shared/tokens.css` | Colour, type, spacing, density, corners, focus, motion, safe areas and layers |
| `shared/components.css` | Shared responsive presentation primitives |
| `shared/components.mjs` | Artwork/page patterns, toolbar, dense/card rows, disclosures, states/retry and native modal dialog/inspector |
| `shared/artwork.mjs` | Narrow DOM adapter to `window.PTCGCardImages.resolve()` |
| `shared/routes.mjs` | Exact native/legacy route allowlist, V2 destination construction and UI-state validation |
| `fixtures.mjs` | Historical 60-card sample, isolated from all personal/domain persistence |

The visual hierarchy is Artwork Stage → floating Section Rail → overlapping
Task Surface. Dark atmospheric chrome frames a warm paper working surface;
editorial display type, restrained cyan/mint accents, fine rules, authentic card
art and canonical sprites provide identity. It is deliberately not a generic
grid of rounded cards. Inspectors and filters become bottom sheets on phones.

`app.js` composes the filter dialog from the shared dialog/toolbar pattern.
Semantic HTML owns disclosures, buttons, links and modal focus containment;
the dialog helper restores the triggering control on close. Primary controls
have 44px minimum touch dimensions. A ResizeObserver reserves actual bottom-nav
height including enlarged text and safe-area padding.

## Artwork and sprites

The two production scripts are loaded unchanged from `../v2-preview/apps/_shared/`.
Only the canonical resolver supplies candidate image URLs. The adapter tries its
ordered candidates and keeps a stable, dimension-reserved fallback on exhaustion.
Generation guards stop an old resolution from replacing a newer cover. It never
calls the resolver's removal-oriented thumbnail handler, which would remove the
reserved layout. It never removes images inside the canonical sprite fallback.

`artworkHeader({name, card, focal:{x,y}, level})` accepts an exact printing and
per-printing percentage focal point. Cover printing and crop are presentation
inputs, separate from the deck's cards/identity; CP01 persists neither. Headers
start at 210px at 390px, 196px at 360px and 270px on desktop, with the task
surface overlapping by 28px. Enlarged text may increase height instead of
clipping the title. The title is the only text inside the artwork.
`DeckSprites.html()` receives the original name, preserving exact override keys.

## Routes and return context

Native routes are `#/specimen` (also the empty hash) and `#/specimen/states`.
The four primary links and two app-level links lead to explicit transition
surfaces with real, top-level V2 links. No iframe or nested global nav is added.
The route registry is the future extension point: replace legacy destinations
with native owners as checkpoints migrate them. Do not add Collection until it
has a real accepted implementation.

`history.state` contains only display mode, group filter, disclosure IDs, scroll
and native preview return contexts. Reload, Back/Forward, and the return link
restore these states. A direct legacy transition without prior specimen context
returns to the default specimen. Browser Back must traverse any additional V2
history entries before reaching the V3 transition; V2 has not been modified to
add a V3 return button. Unknown routes show an explicit recovery link.

## Verification

Run `node --test tests/ui-ux-cp01.test.mjs` for focused unit contracts.
`tests/browser/ui-ux-cp01.cjs` starts/stops the supported QA server itself and
requires an externally available Playwright and Chromium installation:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
CP01_OUTPUT=/tmp/cp01-browser \
node tests/browser/ui-ux-cp01.cjs
```

Leave the first two variables unset when normal Playwright package resolution
and its bundled browser work. Do not run another QA server on port 4173 at the
same time. The harness uses a fresh browser profile and never signs in.

In the managed QA environment only, `CP01_IMAGE_PROXY=1` forwards each exact
image request through curl using the configured proxy/CA. It does not substitute
images or change application URLs; it exists only because local Chromium cannot
use that environment's external transport directly. It is not an app provider,
cache or deployment component. Without this switch the browser loads images
normally. The harness requires actual header and initial card artwork to load.

Screenshots and observations are written to `CP01_OUTPUT`; inspect the images,
not just the assertions. Owner iPhone/Safari/installed-app acceptance is separate.

`tests/browser/cp01-responsive.html` is a read-only manual QA harness that loads
the real preview at exact 390px and 360px iframe viewports plus a 390px/200%-text
case. It reports viewport width, overflow, artwork state/height, surface overlap
and shell count; it is test infrastructure, not an application route.

## CP02 adapter boundary

Replace fixtures only in a new native real-deck workspace. First inspect the
canonical deck/storage/version actions and existing sync ownership. This preview
does not provide an accepted live-write or sync adapter. Do not instantiate a
second account controller or copy the deck engine into these presentation files.
See `handoffs/ui-ux/CP-02.md` for the bounded next brief.
