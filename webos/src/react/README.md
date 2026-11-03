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
