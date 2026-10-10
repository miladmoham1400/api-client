# Linux development dock icon fix — 2026-10-10

User reported that the Ubuntu dock still showed Electron after the custom icon change. Preserved existing uncommitted JSON presentation changes. No planned task status or historical release acceptance was changed.

## Diagnosis and change

The source-built window already has the 512px custom `_NET_WM_ICON`, but originally advertised `WM_CLASS=offline-api-client`. The system has `/usr/share/applications/offline-api-client.desktop` with the same StartupWMClass and `Icon=offline-api-client`; its installed 256px icon dates from the old October 5 package. Thus the development window was associated with the old installed application icon instead of the new window asset. This is a desktop association issue, not a missing renderer asset.

Linux unpackaged execution now calls `app.setDesktopName('offline-api-client-dev.desktop')` before ready. Packaged identity and Windows behavior stay unchanged; app name/userData are not renamed. The per-user development entry advertises matching StartupWMClass, a direct absolute path to the new PNG, and launches `npm run dev` in the checkout using the current Node/npm paths. Desktop Exec uses desktop-spec escaping, not shell interpolation. The script refuses unrelated existing entries and invalid relative data-directory paths.

`predev` and `prestart` register/refresh this development-only entry before the existing SQLite rebuild; other OSes skip registration. Installed startup never performs this write. An explicit `npm run desktop:install-dev` is also available. Registration needs no sudo, downloads, global package install or system-file changes. The user approved the sandbox escalation to register `/home/milad/.local/share/applications/offline-api-client-dev.desktop` and registration completed. Close an existing instance and restart to apply the new window identity; moving the checkout requires refreshing the entry. The old installed package remains unchanged.

Official API and desktop identity references consulted: [Electron app.setDesktopName](https://github.com/electron/electron/blob/main/docs/api/app.md), [electron-builder Linux window association](https://www.electron.build/v26/docs/linux/), [Desktop Entry specification](https://specifications.freedesktop.org/desktop-entry-spec/latest/exec-variables.html). Installed Electron type declarations and builder implementation were checked as well.

## Actual evidence

- `npm run build`: exit 0, including strict TypeScript and all three production bundles. Existing Zod/Rollup annotation warnings remain non-fatal.
- `npm run lint`: final exit 0. Initial new script lacked an explicit URL import; corrected and reran.
- `XDG_DATA_HOME=/tmp/api-client-dev-desktop-check npm run desktop:install-dev`: exit 0, generated entry in temporary data directory.
- `desktop-file-validate` on both temporary and actual registered entries: exit 0, no diagnostics.
- `npm run desktop:install-dev` with approved escalation: exit 0, actual per-user entry registered.
- Fresh GJS/Gio.DesktopAppInfo lookup found `offline-api-client-dev.desktop`, name `Offline API Client (Development)`, icon `/home/milad/Projects/Personal/api-client/build/icon.png`, StartupWMClass `offline-api-client-dev`.
- Temporary isolated source-built Electron/Playwright + xprop inspection: exit 0 after correcting diagnostic option order. WM_CLASS first value is `offline-api-client-dev`, native title is `Offline API Client`, `_NET_WM_ICON` starts `512, 512`. The diagnostic's 32-byte output limit truncated the second WM_CLASS string; first identity is complete. An initial xprop command put format options after property names and failed; that diagnostic is not counted as a pass. Temporary app data was removed after forced fixture exit; no persistence/normal-close evidence is claimed.
- `python3 scripts/graphify.py update`: exit 0, 1,013 nodes / 3,151 edges / 53 communities. New installer script yielded no symbols; graph is optional discovery evidence, not a test. Query was capped/truncated, so source inspection supplied the relevant details.
- `git diff --check`: exit 0.

## Limits

This checks Linux X11 window identity, desktop lookup and icon metadata. No direct GNOME dock-pixel screenshot, Wayland test, new installer acceptance or Windows execution was performed in this follow-up. An existing process keeps its old identity until restarted. Previously built installers still contain their old resources and need their own rebuild/reinstall for icon changes. JSON feature checks remain recorded in their separate report; no unrelated behavior was changed here.
