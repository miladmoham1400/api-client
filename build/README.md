# Application icon assets

Created 2026-10-10 at the user's request using the built-in imagegen tool. The two arrows represent request/response; transparent margins surround a navy tile with teal/ivory marks. No runtime network resource is used.

- `icon-source.png`: untouched generated master.
- `icon.png`: 512×512 RGBA window icon, imported with electron-vite `?asset` and copied into the main bundle output.
- `icons/*.png`: 16, 24, 32, 48, 64, 128, 256 and 512 pixel Linux packaging variants. Renderer uses 64px for the 32px header; HTML uses 32px for the favicon.
- `icon.ico`: Windows frames at 16, 24, 32, 48, 64, 128 and 256 pixels.

Only format conversion/resizing was performed with the already available Pillow tooling; alpha was preserved. Pillow is not an application dependency. Keep these source assets tracked: `out/` and `dist/` remain generated output.

## Final generation prompt

Use case: logo-brand. Create one polished desktop application icon for an Offline API Client, suitable for a Linux dock and Windows taskbar. Square icon, no text, no lettering, no watermark, no surrounding mockup. A distinctive chunky sculpted bidirectional request/response connection symbol: two interlocking bent arrows forming an angular link, one luminous teal/cyan, one soft ivory, on a deep midnight navy rounded-square tile. Subtle premium enamel depth, clean bevels and restrained lighting, modern developer-tool identity, confident simple silhouette readable at 24 pixels. Centered front-facing composition, generous consistent margin, tile fills about 86 percent of the square canvas. Actual transparent background outside the tile, crisp clean alpha edges. Keep the mark bold and spare, no tiny circuit patterns, no globe, no cloud, no fine details.

## Integration and evidence

The runtime icon is bundled using the documented [electron-vite asset import](https://electron-vite.org/guide/assets). Packaging selects `linux.icon: build/icons` and `win.icon: build/icon.ico`. Windows main startup sets the AppUserModelID to the existing packaging app ID for taskbar grouping. See the [icon verification report](../docs/tooling-reports/app-icon.md).

`npm run dev` / `npm start` use the new source-built icon. Existing installed binaries/desktop entries keep their old resources until the relevant target-native package is rebuilt and reinstalled. Previous release hashes still identify the previously tested packages; new binaries need new hashes and independent smoke evidence.
