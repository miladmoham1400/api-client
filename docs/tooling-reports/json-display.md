# JSON presentation enhancement

Date: 2026-10-10. User requested readable, differently colored JSON keys/values in payload and response, preferably without installing a package. Repository was clean before this change. This is an authorized post-task UI enhancement, not a new planned task; task files/index and historical release acceptance remain unchanged.

## Changes

- Added a shared, dependency-free lexical tokenizer and React text renderer. Keys, strings, numbers, booleans, null and punctuation have separate light/dark colors.
- JSON body editing keeps the native labeled textarea for input, selection, keyboard handling, resizing and scrolling. A synchronized decorative text layer provides colors and is hidden from assistive technology. Raw body editing retains its existing control.
- JSON response Raw and Pretty views use the same colors with a monospace presentation and padded background. JSON content types, object/array-looking text and successfully selected Pretty views are highlighted; other response text remains literal.
- Preserved exact editable/source/wire and Raw response text, including whitespace, duplicate keys, numeric spelling, Unicode and templates. Incomplete JSON is editable; the coloring layer is not a validator. Existing send validation, explicit Save, Raw default and opt-in Pretty semantics remain unchanged. Existing Pretty parsing/formatting is unchanged.
- Bounded highlighting to 65,536 UTF-16 code units and 4,096 output tokens; larger or denser inputs use unchanged plain text. This does not lower existing request/response limits.
- All tokens are React text nodes: no HTML injection, remote assets, renderer HTTP requests, new dependency or lockfile change. Added system-color fallback CSS for forced-colors mode.
- Updated UI specification, user guide and decision record.

## Actual verification

Environment: Linux x64 desktop; Electron source application using production build output and an isolated temporary app-data directory. No user workspace data used.

| Command/check | Result |
| --- | --- |
| `npm run build` | Passed, including strict TypeScript and main/preload/renderer production bundles. Existing Zod/Rollup annotation warnings remain; comments are removed by Rollup. |
| `npm run lint` | Passed on final source. Initial new test fixture had two unnecessary escapes; corrected and reran successfully. |
| `npm exec --no -- vitest run tests/shared/json-tokens.test.ts tests/shared/response-format.test.ts` | 2 files / 6 tests passed (final run 365 ms). Tests preserve escaped strings, Unicode, duplicate keys, large integer spelling, incomplete source, templates and hostile HTML text; enforce size/token fallback; existing bounded Pretty behavior passes. |
| `npm exec --no -- playwright test tests/json-presentation.spec.ts tests/body-editor.spec.ts tests/response-viewer.spec.ts tests/theme.spec.ts tests/security.spec.ts` | 5 tests passed, 23.9 s. Checked native keyboard editing, independent token colors in both themes, theme draft preservation, exact UTF-8 request text received by a local echo server, exact Raw response restoration, literal HTML safety/no renderer network requests, wrapping/scroll synchronization, resize metrics, oversized-editor fallback, Save/restart body persistence, response states and existing Electron security behavior. |
| Palette contrast calculation from committed CSS colors | Every foreground/token color exceeds 4.5:1 against its JSON surface. Minimum Light 5.58:1; Dark 7.71:1. This is palette evidence, not a complete accessibility audit. |
| Screenshot inspection | Inspected `/tmp/api-client-json-light.png`, `/tmp/api-client-json-dark.png` and `/tmp/api-client-response-pretty.png`; colored keys/values, Unicode and response indentation are visible. Screenshots use synthetic fixtures and are not committed. |
| `git diff --check` | Passed. |
| `python3 scripts/graphify.py update` | Passed: 1,011 nodes, 3,145 edges, 47 communities. Two new test files yielded no symbols; unsupported/sensitive files were skipped. Generated graph remains ignored and is discovery evidence only. |

The desktop suite ran before the final defensive token-count check for a trailing plain segment was tightened. That pure tokenizer change was followed by the final unit tests, lint and production build; no other runtime changes followed the desktop suite.

## Limits

- No Windows execution or new packaged Linux/Windows installer acceptance was performed for this change. Previously built packages do not include these changes; rebuild/reinstall to update them. Run `npm run dev` to view current source.
- No full unit/desktop suite rerun; the focused presentation, body, response, theme and security checks above ran. No screen-reader or OS forced-colors manual test was performed; fallback is implemented but not claimed visually verified.
- Coloring is lexical, not structural validation or a tree editor. Original indentation stays intact while editing; response formatting still requires Pretty. Large/token-dense content deliberately stays plain text.
- Graphify discovery query preceded source inspection; its capped graph/query cannot prove complete call-chain coverage. Source/specifications and actual tests remain authoritative.

## Follow-up: dense/expanded Pretty responses

The user reported a colored request body but monochrome Pretty response. The original shared 64 Ki-character / 4,096-token all-or-nothing fallback caused this for dense JSON and for Pretty output expanded beyond the editor budget. [The response highlighting fix](json-response-colors.md) supersedes that response-specific limitation and records new regression evidence; original checks above remain historical.
