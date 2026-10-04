# Official reference sources

Checked for planning on 2026-10-03. These sources establish framework behavior, not exact toolchain compatibility. TASK-001 must re-check supported versions and record its own pinned baseline.

| Source | Relevant point |
|---|---|
| [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model) | Main/preload/renderer responsibilities |
| [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc) | Explicit contextBridge operations |
| [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) | Isolated, sandboxed UI and IPC sender validation |
| [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) | OS secret support and Linux basic_text limitation |
| [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) | Native module runtime ABI |
| [Chakra installation](https://chakra-ui.com/docs/get-started/installation) | Current provider/dependencies and Node prerequisites |
| [Chakra with Vite](https://chakra-ui.com/docs/get-started/frameworks/vite) | Renderer setup |
| [Node HTTP](https://nodejs.org/api/http.html) | Request streams/rawHeaders; timeout alone does not abort |
| [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html) | Enable foreign keys outside transactions |
| [electron-builder multi-platform](https://www.electron.build/docs/features/multi-platform-build/) | Native dependency and target build constraints |
| [electron-builder](https://www.electron.build/docs/) | Packaging/rebuild configuration |

Product limits (sizes, scope, redirect policy, one editor) are design choices in this pack, not claims mandated by the frameworks.
