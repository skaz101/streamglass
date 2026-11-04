# Install or update StreamGlass TV 0.7.3

Use `com.streamglass.tv_0.7.3_all.ipk`. The app ID remains `com.streamglass.tv`.
Close the app and install over the existing version to retain local login and
settings. Uninstalling may erase them. Keep your source archive with the installer.

## Existing paired TV

Use the saved `lg-tv` connection. From the installer folder:

```sh
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-setup-device --list
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-launch --device lg-tv --close com.streamglass.tv
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-install --device lg-tv ./com.streamglass.tv_0.7.3_all.ipk
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-launch --device lg-tv com.streamglass.tv
```

If close reports the app is not running, continue. Investigate other failures
before installing. No app uninstall or firmware update is required.

## Rooted TV

Use Homebrew Channel's SSH server and your saved root connection, normally
`root` on port `22`. Do not install or enable LG's Developer Mode app on a
rooted TV; [webOS Homebrew documents this restriction](https://www.webosbrew.org/pages/sdk-configuration).
There is no Developer Mode session to renew for this connection.

If pairing is needed, enable SSH in Homebrew Channel and configure your public
key and CLI device using that guide. Keep private keys and passphrases local.
Use `TV_IP` as a placeholder for the address on your own network. Existing
working connections do not need to be recreated. StreamGlass uses the same IPK
on rooted and unrooted TVs.

## Unrooted TV

Follow [LG's Developer Mode setup](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app).
Enable Developer Mode and Key Server, then pair the computer using the displayed
passphrase. The usual connection is `prisoner` on port `9922`. Renew the
Developer Mode session before it expires. These instructions apply only to
unrooted TVs.

With the official CLI installed, the pairing commands are:

```sh
ares-setup-device --add lg-tv -i "host=TV_IP" -i "port=9922" -i "username=prisoner"
ares-novacom --device lg-tv --getkey
ares-device --system-info --device lg-tv
```

Replace `TV_IP`. If the device already exists, inspect its settings before
modifying it. The computer and TV must be reachable on the local network; check
VPN routes or guest-network isolation if a connection fails.

## First launch and playback

Sign in with your Stremio email/password account. Install and configure addons
through Stremio first; account addons and library sync into StreamGlass.
Use direct HTTP/HTTPS media supported by the TV. Raw magnets/torrents need an
external service; this app has no torrent engine or transcoder.

Use arrows and OK to browse, Back to leave menus/details/player, and the player
controls to seek or choose available audio/subtitles. Volume is controlled by
the TV. Check search, For you, row animation, playback and resume after updating.
See [0.7.3 release checks](RELEASE-0.7.3.md) and [testing](TESTING.md).

## Diagnostics

```sh
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-inspect --device lg-tv --app com.streamglass.tv --open
```

In the inspector console, run `window.StreamGlassDiagnostics.export()`. Review
the output before sharing, and include the model, webOS version, reproduction
steps and error code. Do not share passwords, account tokens, configured addon
URLs or signed playback links.

[LG CLI reference](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)
