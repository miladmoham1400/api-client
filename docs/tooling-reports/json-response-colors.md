# Dense Pretty response color fix — 2026-10-10

User reported that Body had syntax colors while Pretty response remained monochrome. Preserved all existing uncommitted JSON presentation and development-icon changes; no planned task statuses or historical installer evidence changed.

## Cause and fix

The previous response renderer reused the editor's all-or-nothing 65,536-character / 4,096-token limits. Many-key responses exceeded the token limit; Pretty whitespace expansion could also exceed the character limit even when the raw input was within the existing Pretty input limit. Either condition replaced every colored span with one plain span. The provided screenshot is consistent with this fallback; no user endpoint/data was accessed to diagnose it.

Responses now have their own bounded tokenizer profile: scan up to 1,048,576 UTF-16 code units and render at most 32,768 tokens. If a safety budget is reached, keep the colored prefix and a single unchanged remainder token instead of discarding all colors. A visible notice explains partial coloring outside the response preformatted text; it cannot contaminate Raw text content. Editor limits, request source/wire bytes, default Raw mode, existing opt-in Pretty parsing/formatting limits and transport response limits remain unchanged. React text nodes still escape untrusted HTML. No dependencies installed.

Updated UI specification and user guide to distinguish response and editor budgets, and linked this follow-up from the original JSON display report.

## Actual checks

Linux x64, source-built Electron, temporary isolated app data and localhost synthetic fixture only.

- `npm run build`: exit 0, strict TypeScript and production bundles passed; existing non-fatal Zod/Rollup annotation warnings remain.
- `npm run lint`: exit 0 on implementation and regression assertions.
- `npm exec --no -- vitest run tests/shared/json-tokens.test.ts tests/shared/response-format.test.ts`: 2 files / 8 tests passed, 417 ms. New checks reproduce the editor fallback while retaining full response coloring, bound response token/character work, retain a colored prefix on budget exhaustion and reconstruct every original character. Initial fixture used 1,000 rows and expanded to only 62,892 characters, so its greater-than-65,536 assertion correctly failed. Increased synthetic fixture to 1,100 rows and reran; no failed result counted as passed.
- Regression fixture: 42,891 raw characters; 69,292 Pretty characters; 1,100 records with 3,300 keys. Both representations exceed the old token budget, and Pretty exceeds the old character budget. New response profile fully colors both without the partial-color notice.
- `npm exec --no -- playwright test tests/response-viewer.spec.ts tests/json-presentation.spec.ts`: 2 tests passed, 14.6 s. Dense response has all 3,300 colored keys, different computed colors for keys/string values in Light/Dark, exact Raw/Pretty text and exact Raw restoration. Existing invalid/oversized Pretty behavior, binary/error states, snapshot association, HTML safety, no renderer requests, editing/wire preservation and editor fallback checks passed.
- Repeated `npm exec --no -- playwright test tests/response-viewer.spec.ts` after moving the synthetic screenshot viewport to the colored rows: 1 test passed, 11.0 s. Inspected `/tmp/api-client-response-dense-dark.png` and `/tmp/api-client-response-dense-light.png`: visible blue keys, green strings, orange numbers and distinct booleans. Earlier screenshot position clipped the rows and supplied no visual color evidence; only the corrected screenshots support this claim.
- `git diff --check`: exit 0.
- `python3 scripts/graphify.py update`: successful optional local refresh; initial refresh reported 1,018 nodes / 3,162 edges / 44 communities and two symbol-less test files. Graph query was truncated; source and regression tests supplied authoritative evidence. Graph output is not test evidence.

## Limits

No Windows execution, new installer build/acceptance, full suite rerun or benchmark was performed. This verifies the Linux source build with a synthetic dense response, not the user's endpoint. Extremely large/dense responses deliberately have a colored prefix and plain remainder with a notice; every response character stays present. The existing Pretty input/output formatting bounds are unchanged. Restart an existing source run with `npm run dev` to load the change; old installers require rebuilding separately.
