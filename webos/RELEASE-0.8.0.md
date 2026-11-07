# StreamGlass TV 0.8.0 — easier, smoother browsing

This update prioritizes browsing on an LG TV. Home now shows a compact featured scene and a complete row of landscape artwork. The top menu concentrates on Home, For you, and My List; Search, Settings, Calendar, and addon management remain reachable. Text and focus treatments are sized for viewing from a sofa.

Remote navigation follows rails directly, remembers the last card in each row, and handles rapid direction reversals. Back from a title restores the existing Home screen and selected card rather than rebuilding every poster. This cache is bounded to one Home for two minutes and is invalidated by account/library changes and playback updates.

Artwork and featured-title copy change together after decoding. The countdown runs on the compositor, pauses while browsing shelves or hiding the app, and respects reduced motion. Catalog arrivals no longer re-render every previously loaded card. A slow collection does not block the first usable featured titles, and a failed refresh keeps existing titles visible.

The legacy DX.BI stylesheet is no longer applied over the new TV interface. Its original licensed source remains in the package and corresponding source. The TV uses its own small presentation layer and bundled fonts. Playback cleanup from 0.7.4 is retained unchanged.

## Evidence and limits

On the connected LG 75UA7000PUB, webOS 10.3.2 / Chromium 120, the same short 26-arrow sequence was run with 202 cards. This is a diagnostic comparison against StreamGlass 0.7.4, not a controlled Netflix benchmark or a guarantee of sustained 60 FPS. Network artwork, different rail boundaries, and other TV activity can affect results.

| Measurement | 0.7.4 | Final candidate |
| --- | ---: | ---: |
| Key-handler median | 7.5 ms | 10.5 ms |
| Key-handler 95th percentile | 38 ms | 14.2 ms |
| Key to next animation frame, 95th percentile | 70.7 ms | 55.7 ms |
| Animation-frame interval median | 33.3 ms | 16.7 ms |
| Animation-frame interval 95th percentile | 133.4 ms | 50.0 ms |
| Frames over 50 ms / sampled frames | 27 / 147 | 9 / 172 |
| DOM rectangle reads during sequence | 4,663 | 67 |

An isolated 800-poster fixture reduced one hero-navigation path from 1,616 geometry reads to 7. Progressive rendering of 100 cards required 100 card calculations instead of 410. The hero clock used zero recurring JavaScript animation-frame callbacks in its fixture.

Regression coverage includes direction reversal, row/grid boundaries, focus restoration, cached Home identity, search cancellation, captions, real H.264/AAC playback and saved-position resume with the actual Stremio WASM core, hidden/pagehide media release, reduced motion, refresh failure/recovery, and Android shared-screen behavior. Release CI results are linked from the GitHub release.

Play opens the available stream choices; addon availability and stream quality still depend on the configured services. Android physical-phone feel and the household's preference over Netflix still require user testing.
