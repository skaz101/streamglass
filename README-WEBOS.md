# StreamGlass TV 0.4.0

This source archive contains an unofficial LG webOS 25 port based on DX.BI.
Start with [webos/RELEASE-0.4.0.md](webos/RELEASE-0.4.0.md) to install the IPK and collect
TV logs. See [webos/TESTING.md](webos/TESTING.md) for completed checks and
everything still requiring the real TV.

Rebuild instructions: [webos/README.md](webos/README.md).
Changes: [webos/MODIFICATIONS.md](webos/MODIFICATIONS.md).
Licenses: [LICENSE](LICENSE), [NOTICE.md](NOTICE.md), and
[webos/THIRD_PARTY.md](webos/THIRD_PARTY.md).

The original DX.BI files remain at the repository root. The webOS runtime
reuses the original theme with a new TV shell and MIT Stremio core. It does
not run the desktop app, Android app or monolithic DX.BI plugin.

Target: LG 75UA7000PUB, webOS 25, version 10.3.2-34.
Package: `com.streamglass.tv_0.4.0_all.ipk`.
This is a test build. No physical LG TV or real Stremio/TorBox account was
available during development.

Android phones/tablets: see [android/README.md](android/README.md). The combined source builds both platforms.
