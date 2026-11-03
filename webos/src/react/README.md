# Shared React interface

Android and webOS bundle this same React 19 UI with esbuild. `app.jsx` owns the
home carousel and release calendar. `screens.jsx` contains the other route
components. Existing `shell.js` controllers retain Stremio model dispatch,
search cancellation, stream selection and native host integration. They populate
explicit result regions through `StreamGlassUI.region`; `unmount` disposes all
nested React roots before changing screens. Playback remains Media3 on Android
and the existing webOS player on TV.

Run UI commands from `webos/`. `components.json` configures the `@/` alias and
`@react-bits` registry. React Bits JS-CSS variants work directly; Tailwind utility
classes in installed source are compiled during the build. For example:

```sh
npx shadcn@latest add @react-bits/FadeContent-JS-CSS
npm run build
```

The setup was installed manually from cached npm packages because the local
registry connection was unavailable. It does not claim a successful CLI init.
Registry components can add dependencies; review their requirements before use.
Keep TV remote focus, touch targets and reduced motion when adapting effects.

The release calendar checks up to the latest 500 library entries, at most four
titles concurrently and two metadata addons per title. A 45-second deadline
keeps slow addons from blocking the calendar indefinitely; partial results remain
visible and can be refreshed. It never treats a release
year as a precise date. Date-only values retain the provider's day; timestamps
use the device time zone. Missing dates and the library cap are disclosed in UI.


## Curated discovery and motion

`curated.mjs` defines an ordered Home independent of installed catalogs. Featured
and Top feeds come from Cinemeta; Netflix/HBO Max feeds come from Streaming
Catalogs. Anime and seasonal rows are explicit IMDb selections resolved through
Cinemeta. Service rows are provider listings, not claims of originals or regional
availability. Sources never silently substitute for failed provider rows.

Fetches use four workers, twelve-second per-request timeouts, a forty-second
overall deadline and a fifteen-minute bounded memory cache. Pull refresh bypasses
that cache, and route cleanup aborts outstanding requests. The device-local
`streamglass-home-v1` preference opts into installed addon catalogs. Metadata can
fall back to Cinemeta for IMDb titles; playback still uses installed stream addons.

`Hero.jsx` keeps its eight-second clock and drag progress in refs/CSS transforms.
It pauses for focus, hover, hidden documents, scrolling and reduced motion.
Artwork is decoded before a crossfade; horizontal gestures suppress accidental
link activation while vertical gestures remain available for scrolling.
`PullRefresh.jsx` locks downward gestures only at the top of the phone viewport;
visible TV refresh controls and keyboard-accessible phone controls remain.

Run `node tests/curated-browser.cjs` and `node tests/hero-browser.cjs` from `webos/`
for trusted Chromium touch tests, preference switching, cache behavior and motion.
