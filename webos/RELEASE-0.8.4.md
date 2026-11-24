# StreamGlass TV 0.8.4 — Search from the remote

TV Search now has its own six-column letter and number keyboard. It stays on the left while results scroll on the right, so searching no longer depends on the LG system keyboard opening. Space, Delete, Clear and Results are always available. Letter presses update results without moving focus; Results enters the first usable batch. Left from the first result or Back returns to the remembered key, and another Back leaves Search. Recent searches and returning from title details preserve their navigation context.

Physical keyboards support typing, selection, deletion and pasted text. The query display is not an editable native field, which avoids an overlapping system keyboard. Mobile keeps its native search input.

Home retains unchanged catalog objects when new responses arrive. In the isolated 100-card test, an unchanged refresh now performs zero extra card calculations, and changing one title recalculates one card. Seasonal collections are reconciled by identity when their date windows change, so an expired row disappears and a failed new collection cannot inherit another category's titles.

TV rail cards request smaller backgrounds from the verified Metahub CDN path, with automatic fallback to the original image. Other addon URLs, signed URLs, mobile artwork and featured images are preserved. One live sample was 90,693 bytes at 780×439, compared with 211,956 bytes at 1280×720. This sample is not a universal bandwidth saving. Decoded-image handoff rejects stale completions while keeping the same focused card and image element.

## Verification

The 63 unit tests, custom keyboard checks at 720p/1080p, artwork fallback and stale-decode checks, Home refresh and lifecycle checks, TV navigation and hero-transition checks passed. The full packaged browser/WASM/video suite and shared Android browser suite passed with no runtime errors. Progressive Search tests distinguish the card's focus animation from its row position and cover late results, short result pages, cancellation and returning from details.

Installed over 0.8.3 on the LG TV on 2026-11-23. All 1,379 installed files match the local build manifest. The separate playback startup repair is unchanged. The official CLI's upload failed before installation; the same IPK was transferred through a single SSH channel, SHA-256 verified, and installed through LG's normal `appInstallService` update operation.

Browser tests use isolated services and generated H.264/AAC media. They do not establish sustained frame rate or hardware-decoder behavior on an LG TV.

Install over the existing `com.streamglass.tv` app to retain settings and sign-in. Keep the corresponding source archive with the IPK. This release is for LG TV; the published Android installer remains 0.8.2. The app installer does not modify the separate CleanYourTV startup repair or install a remote-button remapper.
