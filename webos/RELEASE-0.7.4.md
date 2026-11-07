# StreamGlass TV 0.7.4 — playback lifecycle hardening

TV-only maintenance release. Android remains at 0.7.3.

Switching away from StreamGlass now closes the player and immediately removes its media source. Returning to the title lets you resume instead of retaining a paused decoder in the background. Pending stream setup is cancelled even if the app hides and returns before the network request completes.

Fatal playback errors unload media and cancel subtitle requests while preserving the error message and playback position. Autoplay permission errors still allow manual Play. Cleanup runs before application callbacks, duplicate close events are ignored, and returning to the title does not wait for cloud synchronization.

A full TV restart restored YouTube and Netflix after a reported loss of picture and sound. The original system-wide cause was not established. These changes address observed app lifecycle gaps; they are not proof of the original cause or a guarantee against firmware/hardware faults.

## Validation

- 49 Node unit tests passed.
- Android browser regression suite and TV remote-host suite passed with no runtime errors.
- On an LG 75UA7000PUB (webOS 10.3.2 / firmware 33.31.80), the installed app played a local H.264/AAC fixture. Switching to YouTube removed the video source and player; the TV media-service report showed no StreamGlass pipeline and showed YouTube holding the audio/video decoder resources. This verifies resource handoff, not the original cause of the system-wide failure.
- Real H.264/AAC player browser tests cover source release on hidden/pagehide, fatal errors, saved-position preservation, stale subtitle work, duplicate events, hidden startup, recoverable autoplay denial, and callback failure.
- Packaged app integration with the actual Stremio WASM core covers delayed startup cancellation, title return while cloud sync is blocked, and saved-position resume.

The installer, corresponding source archive, and SHA256SUMS accompany this release. Account data and media fixtures are excluded from release artifacts.
