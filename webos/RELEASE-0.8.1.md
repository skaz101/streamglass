# StreamGlass TV 0.8.1 — restore the full featured area

Moving down from Home to Top series and then back up could leave the featured area clipped at its Play button. Remote focus only made that button visible, leaving the title, artwork, and filters above the viewport. Returning to the featured area, filters, or top menu now restores the top of Home, including when reversing an in-progress scroll. Rows still remember their selected cards. Up from the featured controls now reaches All/Movies/Series/Calendar; those filters can be traversed with the remote, with Up returning to navigation and Down to Play.

Featured artwork retains its existing image node beneath a single incoming fade. This avoids fading both pictures through the black background. Transition completion follows the animation rather than a timer that can expire during a stalled frame. Title logos are prepared with the incoming scene, and failed artwork/logo requests retain a usable text fallback. The TV also keeps the next image ready at a very low nonzero opacity after the current transition finishes. The same image element becomes the incoming picture, with at most two artwork elements at any time. This preparation is disabled on Android and for reduced motion/transparency.

TV navigation and filters use the same short transform-based focus response, with immediate readable contrast. The opaque TV header no longer applies a redundant backdrop blur. Main content aligns with the header height. Reduced motion remains supported.

Regression coverage exercises a real TV-style layout at 1280×720 and 1920×1080, returning from series to the full featured area, top-menu/filter entry, interrupted scrolling, hero image identity and handoff, delayed or failed images, and shared Android behavior. Release CI and on-device results are linked from the GitHub release.

Playback behavior and the 0.7.4 media-cleanup protections are unchanged. This update addresses the reported defects; preference over Netflix still depends on normal household use.

## On-TV check

The reproduced series → movies → Play sequence originally left Home at scroll position 319px, with the top of the featured scene offscreen. It now ends at 0px with the full scene, filters and header visible; rapid reversals and remote-only filter/calendar access also passed.

On the same LG 75UA7000PUB / Chromium 120, an eight-title diagnostic cycle sampled the whole manual activation through transition completion plus 80ms. The initial 0.8.1 transition candidate recorded 9 frames over 50ms in 200 samples. Artwork-layer promotion recorded 4/215; the final next-image preparation recorded 2/250. The final run still included 100ms and 66.6ms outliers. These short sequential runs demonstrate a useful improvement, not a controlled Netflix comparison or a guarantee of sustained 60 FPS. Decoding, caching and other device activity affect results. The release includes the raw diagnostic summaries.
