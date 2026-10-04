# Verified toolchain baseline

Verified 2026-10-04 for TASK-001. Exact direct versions are pinned in package.json; package-lock.json fixes transitive resolution. No prereleases are selected.

## Development and embedded runtimes

Developer Node **22.18.0** (supported Maintenance LTS major), npm **11.6.2**, Linux x64, Ubuntu **24.04.3 LTS**. `.nvmrc` records the exact tested Node. Electron **44.5.1** embeds Node **24.21.0** and Chromium **152.0.7977.130**, confirmed by the Linux smoke test and the [official stable release table](https://releases.electronjs.org/?channel=stable). Installed users do not need developer Node/npm.

## Exact installed packages

| Package | Version |
|---|---|
| `@chakra-ui/react` | 3.37.0 |
| `@emotion/react` | 11.14.0 |
| `react` | 19.3.0 |
| `react-dom` | 19.3.0 |
| `@eslint/js` | 10.0.1 |
| `@playwright/test` | 1.63.0 |
| `@types/node` | 22.20.5 |
| `@types/react` | 19.3.0 |
| `@types/react-dom` | 19.3.0 |
| `@vitejs/plugin-react` | 5.2.0 |
| `electron` | 44.5.1 |
| `electron-vite` | 5.0.0 |
| `eslint` | 10.12.0 |
| `typescript` | 6.0.3 |
| `typescript-eslint` | 8.71.0 |
| `vite` | 7.3.6 |

Reserved later-task baselines: **better-sqlite3 13.0.3** (Node >=22) and **electron-builder 26.15.3** (Node >=14). Their official npm metadata was checked, but they are deliberately not installed or exercised in this skeleton. Re-check when introduced; native SQLite must be rebuilt against Electron's ABI independently on each target OS. No database or installer is implemented here.

## Compatibility evidence and official sources

- [Node release support](https://nodejs.org/en/about/previous-releases): Node 22 remains LTS; the existing development runtime satisfies this baseline.
- [electron-vite guide](https://electron-vite.org/guide/) and [published metadata](https://registry.npmjs.org/electron-vite/5.0.0): Node ^20.19 or >=22.12; Vite peer ^5/^6/^7. Vite 7.3.6 selected rather than unsupported Vite 8.
- [Vite requirements](https://vite.dev/guide/) and [Vite 7 metadata](https://registry.npmjs.org/vite/7.3.6): Node ^20.19 or >=22.12.
- [Chakra installation](https://chakra-ui.com/docs/get-started/installation) and [v3 metadata](https://registry.npmjs.org/@chakra-ui/react/3.37.0): Node 20 minimum; React/React DOM >=18 and Emotion >=11. Local `ChakraProvider value={defaultSystem}` uses v3 APIs with no theme snippet download or external assets.
- [React releases](https://react.dev/versions) and [React DOM metadata](https://registry.npmjs.org/react-dom/19.3.0): React DOM requires matching React ^19.3.0.
- [typescript-eslint metadata](https://registry.npmjs.org/typescript-eslint/8.71.0): TypeScript >=4.8.4 <6.1; ESLint 8/9/10. Stable TypeScript 6.0.3 selected rather than incompatible 7.0.2.
- [ESLint support](https://eslint.org/version-support), [ESLint 10 metadata](https://registry.npmjs.org/eslint/10.12.0): Node ^20.19/^22.13/>=24. ESLint 9 was rejected after its installation deprecation indicated support had ended.
- [Playwright Electron support](https://playwright.dev/docs/api/class-electron): uses the installed Electron binary, not a renderer HTTP server.
- Exact versions/engines/peers obtained with `npm view <package> version engines peerDependencies --json`; [official npm registry](https://registry.npmjs.org/) package metadata is the version authority. No floating latest remains in scripts.
- Later native/packaging references: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules), [electron-builder multi-platform](https://www.electron.build/docs/features/multi-platform-build/).

## Installation and checks (Linux and Windows)

Install official Node 22.18.0 x64 from [Node downloads](https://nodejs.org/download/release/v22.18.0/) and Git. Install npm 11.6.2 using `npm install --global npm@11.6.2` if needed. From the repository, on either OS:

```text
npm ci
npm exec --no -- install-electron
npm run typecheck
npm run lint
npm test
npm run dev
npm run build
npm start
```

Electron 44 downloads its binary on demand; explicitly install it before testing or disconnecting the development machine. Initial npm/runtime downloads require internet or prepared caches. The built UI uses local files. `npm test` runs the pure schema suite added in TASK-002. `npm run test:smoke` builds and runs the Electron smoke check on a graphical desktop; no separate browser download is needed. Scripts use cross-platform CLI commands. Packaging scripts are deferred to TASK-028/029 because TASK-001 excludes installers.

Ubuntu 24.04 requires a graphical session, working Chromium sandbox and Electron desktop libraries (including libgtk-3-0t64, libnss3, libasound2t64, libgbm1 and libxss1). For later native rebuilds install Python 3 and build-essential. Windows baseline is Windows 11 x64; later native rebuild fallback requires Python and Visual Studio C++ Build Tools with the Windows SDK. Neither Windows nor packaged-app execution is verified by this task. Do not use `--no-sandbox` as a production workaround.

This environment's uncached npm requests stalled until `NODE_OPTIONS=--dns-result-order=ipv4first` was set for the installation command. This is a host workaround, not an application dependency or saved npm-script setting.

If launching from an environment with `ELECTRON_RUN_AS_NODE` set, unset it before `npm run dev` / `npm start`; the smoke harness removes this host-only variable automatically and explicitly enables Chromium sandboxing. Final TASK-001 Linux smoke passed; see [actual results](task-reports/TASK-001.md).

## TASK-002 validation/test additions (2026-10-04)

Exact additions: **Zod 4.6.5** (runtime dependency) and **Vitest 5.0.3** (dev dependency), both pinned in package.json and package-lock.json. Versions verified via official npm metadata. [Zod API](https://zod.dev/api) provides strict objects and discriminated unions. [Vitest 5.0.3 metadata](https://registry.npmjs.org/vitest/5.0.3) accepts Node ^22.12/^24/>=26, Vite ^6.4/^7/^8 and @types/node ^22/>=24, matching this baseline. [Zod metadata](https://registry.npmjs.org/zod/4.6.5) lists no incompatible runtime peer or engine requirement.

`npm test` / `npm run test:unit` executes offline Node schema tests. `npm run test:smoke` retains the original Electron regression check; Playwright matches only `.spec.ts`, while Vitest matches `tests/shared/**/*.test.ts`. No browser DOM or additional renderer test libraries are needed for this task.

## TASK-004 native database additions (2026-10-04)

Installed exact **better-sqlite3 13.0.3**, **@electron/rebuild 4.2.0** and **@types/better-sqlite3 9.6.0**. Verified official npm versions/engines before installation: driver Node >=22, rebuild Node >=22.12, compatible with developer Node 22.18 and embedded Node 24.21. [Electron native-module guidance](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) requires a binding for Electron's ABI rather than the developer Node ABI.

`npm ci` installs the Node native dependency. `npm test` / `npm run test:unit` runs `npm run rebuild:node` first. `npm run rebuild:electron` prepares the installed Electron target; `npm run dev`, `npm start` and `npm run test:smoke` invoke that preparation before launching Electron. These scripts run sequentially because both targets use the same node_modules binding. Do not run Node rebuild/unit tests concurrently with Electron rebuild/smoke/dev. Native preparation may require network for uncached binaries/headers; it is development tooling, not installed-app startup code.

Linux x64 native execution was actually verified against Electron 44.5.1 / Node 24.21.0 / module ABI 149: migration, write/reopen and corrupt-database recovery. Windows native rebuilding and both packaged-app targets remain unverified. Later packaging must prepare a separate OS/architecture binding and unpack the native binary appropriately; no installer was added here.
