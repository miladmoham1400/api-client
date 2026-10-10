# Application icon — 2026-10-10

User authorized a custom icon and its integration after TASK-030. This is a small presentation/packaging change, not a new product feature or task-status change. The working tree was clean before this work. Existing completed task reports and tested artifact hashes are preserved.

## Changes

Generated a navy/teal/ivory request-response mark with actual transparent margins using built-in imagegen. Saved the original and converted PNG/ICO variants in [build assets](../../build/README.md), which also records the full final prompt. No API-key/CLI fallback was used; no image-generation tooling was added as an application dependency.

BrowserWindow loads the local `build/icon.png?asset`, which the pinned electron-vite copies into `out/main/chunks`. The renderer displays a decorative icon next to the existing heading and bundles a favicon. Linux packaging uses PNG sizes; Windows packaging uses the multi-resolution ICO. Windows runtime uses the existing `local.offline-api-client` AppUserModelID for grouping. No window/data identity was renamed, and no IPC, request, persistence, sandbox or TLS setting changed.

## Actual verification

Environment: Ubuntu 24.04.3 x64/X11, Node 22.18.0, npm 11.6.2. This pass uses source-built Electron 44.5.1, not a newly installed package.

- `npm run lint`: exit 0.
- `npm run build`: exit 0, including strict TypeScript; emitted a 512px main-process PNG and 32px/64px renderer PNGs. Existing Zod/Rollup annotation warnings remain non-fatal.
- `npm run typecheck` after the Windows AppUserModelID addition: exit 0.
- `npm run rebuild:electron`: exit 0, SQLite rebuild complete.
- Both resolved builder configurations validated against installed electron-builder 26.15.3's schema: exit 0. Linux PNG directory and Windows ICO paths resolved.
- Pillow format inspection: square RGBA PNG variants with transparent pixels and seven ICO sizes validated. Conversion used available Pillow 10.2.0.
- Temporary Playwright/native-window inspection: exit 0. Header image visible and fully loaded from a local `file:` URL with natural width 64. Raw X11 `_NET_WM_ICON` property advertises 512×512. Screenshot `/tmp/api-client-icon-preview.png` inspected: icon visible beside the title, clean transparent edges and legible small mark. Test data was synthetic and temporary; normal close used on the successful check.
- Initial diagnostic failed during temporary-folder cleanup before process exit; a retry fixed cleanup. Another diagnostic used xprop's default graphical formatter, which printed an empty representation; reading raw CARDINAL data with `-f _NET_WM_ICON 32c -len 128` confirmed the icon. Neither failed diagnostic is counted as a pass.
- `python3 scripts/graphify.py update`: exit 0, local graph refreshed (1000 nodes/3109 edges/51 communities). Warnings for four symbol-less files; graph is discovery only.
- `git diff --check`: exit 0.

No new Linux installer or Windows installer was built/installed in this pass; Windows taskbar/installer appearance is configured but not independently tested. Desktop launchers may prefer a cached installed desktop-entry icon over a source-run window icon; rebuilding and reinstalling the target package is needed to replace the old installed resource. Previous release-acceptance hashes/results remain a historical baseline and do not certify the new icon build. Native TLS/sandbox and offline asset rules remain intact.
