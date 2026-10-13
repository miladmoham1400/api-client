# HTTP method colors — 2026-10-12

User authorized distinct GET/POST/PUT/etc. colors before the next version. Initial working tree clean. This is a small source presentation enhancement after TASK-037, not a new task or release.

Shared renderer helper `theme/http-method.ts` maps every supported method to a distinct Chakra v3 semantic palette: GET green, POST yellow, PUT blue, PATCH orange, DELETE red, HEAD purple, OPTIONS cyan. Unsupported/empty display values fall back to gray. Tree/search badges and the editor's current method field use the same mapping; method text remains visible. Native option styling uses bundled palette CSS tokens, with native popup rendering dependent on OS/browser. Existing event handlers, saved-vs-draft method semantics, IPC, HTTP behavior and storage are unchanged. No dependency, version or package/publication change.

Verification on Ubuntu x64/X11, developer Node 22.18.0/npm 11.6.2:

- `npm run typecheck`, `npm run lint`, `npm run rebuild:electron`, `npm run build`: all exit 0. Existing Zod comment annotation warnings remain.
- Ad-hoc real Electron/Playwright check (`node /tmp/api-client-method-colors-check.cjs`), exit 0, synthetic temporary profile: all seven methods had distinct computed colors in both light/dark themes; tree, search and selected editor field matched; all measured text/background contrast >=4.5:1. Minimum light 6.187:1; dark 9.348:1. Seven saved configurations remained unchanged after method-select/search/theme interactions. No Send was invoked. This was a source-app visual check, not installed-package/offline acceptance.
- Inspected synthetic screenshots at 1280×720 in both themes. Native selector text and badges are readable; no remote asset/style or custom select interaction added. Complete measured samples: [http-method-colors.json](http-method-colors.json). Temporary check script/screenshots live in /tmp and are not durable committed artifacts; no permanent tests that mirror markup were added.
- `git diff --check` and optional local Graphify update passed (final graph totals in local log). Graph output is not test evidence.

Windows/native-popup manual verification and fresh installers have not been run for these changes. Previously accepted TASK-037 packages and public v0.1.1 downloads do not contain the new colors; their task statuses/hashes remain historical evidence. New version packages must be built and verified separately. Existing tasks remain done; no subsequent task started.
