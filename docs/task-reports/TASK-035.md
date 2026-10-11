# TASK-035 — Search and large-library navigation

Status: done

Date: 2026-10-11

## Selection and environment

Selected TASK-035, earliest unfinished task with TASK-034 done. Read AGENTS, product/decisions, task/index and referenced API-library, data-model, architecture, IPC, UI flows, transfer, testing, known-limitations and public-release specifications. Initial working tree was clean at `8bfb87c48eccc9e71ddb711ab390a6bb0400c57b`; preserved all preceding behavior/work. Only TASK-035 was executed.

Reference machine: Ubuntu 24.04.3 LTS x64/X11, kernel `7.0.0-38-generic`; Intel Core i7-1165G7 @ 2.80 GHz, 8 logical CPUs, 16,538,357,760 bytes RAM (about 15.4 GiB). Developer Node 22.18.0/npm 11.6.2; existing Electron 44.5.1, SQLite binding better-sqlite3 13.0.3, Zod 4.6.5. CPU frequency/background load and OS caches are not controlled; timing is evidence for this machine/run, not an absolute CI or other-machine guarantee. No package/lockfile/version/migration, production sandbox/TLS, real profile or release changes.

## Changes

- Added fixed frozen `requests.search` IPC with strict input/output schemas, exact main-frame and active-workspace authorization. Query <=200 UTF-16 units; owned optional collection filter; safe nonnegative offset; limit 1–100. Nonzero offsets require a revision. No generic IPC, renderer Node access or networking was added.
- Search reads a coherent metadata-only library snapshot. Match literal trimmed NFC query against name, saved method or ancestor path; Latin-only case folding, no regex/wildcard/transliteration. No URL, body, header, auth, variable or response values are indexed/read as configurations. Sort by code-point path/name/method/ID; keep duplicates. Pages have explicit total/nextOffset and a metadata/query/filter/page-size consistency digest. Missing/foreign collection IDs reject; stale/mismatched continuation rejects rather than mixing revisions.
- Added session-only search/filter/results with bounded 100-result rendering, full paths, duplicate result numbering/ID tooltip, explicit Previous/Next and first-page retry. Query/filter/workspace generations ignore obsolete replies. Metadata refresh restarts pagination. Selection uses existing dirty/active-send guards, reveals the selected ancestors/page and never sends automatically; clearing search preserves expansion.
- Tree navigation renders at most **50 rows** from one coherent metadata snapshot with explicit Previous/Next nodes and total counts. Keyboard focus crosses pages; selected request reveal works even when ancestors were collapsed. No request cap, silent legacy truncation or editor-per-node was introduced.
- Replaced per-node duplicate-name scans with grouped sibling labels; removed the duplicate initial metadata read. Request persistence already loads summaries plus only the selected config; retained that boundary. Kept search controls and tree content from shrinking inside a large scrollable sidebar.
- Added focused main/preload, real desktop query-race/guard and reproducible large-library checks. Updated architecture, IPC, UI and data-model documentation. No transfer v2/history/tabs/body indexing or later task implementation.

## Actual commands and results

| Check | Actual result |
|---|---|
| Initial `git status --short` | Exit 0, clean |
| `npm run test:unit -- --maxWorkers=1` with loopback permission | Exit 0: **348 passed, 36 files, 62.38 s**; script rebuilt native SQLite for developer Node first |
| Early typecheck/build | Exit 2: new test used a runtime-auth default where repository input requires stored auth. Explicit None stored-auth helper corrected the fixture, including its final call site. Vitest transpilation had passed runtime tests; this was not a product/schema bypass. Lint separately passed; lint chained after the failed build did not run. |
| `npx vitest run tests/preload/folders.test.ts tests/main/library-search.test.ts --maxWorkers=1` | Exit 0: 3 tests / 2 files, 4.17 s |
| Final focused main/preload/model run after schema/result validation changes | Exit 0: 5 tests / 3 files, 4.13 s; command: `npm run rebuild:node && npx vitest run tests/main/library-search.test.ts tests/preload/folders.test.ts tests/shared/library-tree.test.ts --maxWorkers=1` |
| `npm run rebuild:electron` | Exit 0 after unit checks; native rebuilds were sequential |
| Production `npm run build && npm run lint` after corrections, including final optimized source | Exit 0: strict source/test typecheck, main/preload/renderer bundles and lint passed. Existing Zod/Rollup annotation warnings remain; no dependency change to silence them. |
| First two-spec offline desktop run | Exit 1: stale-query/workspace test passed; scale test failed its new keyboard assertion (26.8 s overall). It incorrectly expected numeric API 0999 to be the last DFS row; actual last row is the parent folder's API 0990. Corrected the test expectation. No complete performance acceptance claimed for that failed run. |
| Nine-file regression command below | Exit 0: **12 passed, 1.7 min**, no skips. Included scale/search race, collection/tree, three navigation, 20-request, security, panel and JSON regressions. With 100 tree rows: cold 1,641.888 ms, selection p95 180.609 ms, search p95 101.635 ms. |
| Subsequent seven-file desktop command below | Exit 1: **8 passed / 1 failed, 54.2 s**. Functional scale/pagination/mutation/geometry checks passed, but cold readiness was **2,177.323 ms**, exceeding 2,000 ms; warm p95 selection 165.311 ms/search 100.310 ms. Search race and new active/dirty result guard tests passed. Kept task unfinished and optimized duplicate startup metadata reads and live tree rows; did not relax thresholds or discard this failure. |
| Final optimized desktop run | Exit 0: **8 passed, 52.1 s, no skips**. Six-file command below uses one initial library read and 50 live tree rows. Cold **873.771 ms**, selection p95 **164.713 ms**, search p95 **100.474 ms**; all specified targets passed without changing thresholds. |
| `python3 scripts/graphify.py query "How do request selection snapshots and library sidebar reloads load configurations and metadata?"` | Exit 0. Graph output is budget-truncated (a later query showed 53/363 nodes); inspected source directly. |
| Final `python3 scripts/graphify.py update` | Exit 0: 1,163 nodes / 3,761 edges / 48 communities after the final startup optimization. Code-only, 118 non-code files skipped; callback-only `library-search.spec.ts`/`security.spec.ts` yielded no symbols and were requeued. Generated graph is ignored and is not verification evidence. |
| Final `git diff --check` and task/index status inspection | Exit 0; TASK-035 file/report/index are done together; TASK-036 remains todo. |

Passing regression command:

```sh
bash scripts/test-offline.sh tests/library-scale.spec.ts tests/library-search.spec.ts tests/library-tree.spec.ts tests/collections.spec.ts tests/navigation.spec.ts tests/multi-request.spec.ts tests/security.spec.ts tests/panel-layout.spec.ts tests/json-presentation.spec.ts
```

Cold-target failure command (after geometry/result-numbering/guard additions):

```sh
bash scripts/test-offline.sh tests/library-scale.spec.ts tests/library-search.spec.ts tests/library-tree.spec.ts tests/collections.spec.ts tests/security.spec.ts tests/panel-layout.spec.ts tests/json-presentation.spec.ts
```

Final optimized command:

```sh
bash scripts/test-offline.sh tests/library-scale.spec.ts tests/library-search.spec.ts tests/library-tree.spec.ts tests/collections.spec.ts tests/security.spec.ts tests/theme.spec.ts
```

All desktop runs use the source-built production Electron application with synthetic temporary profiles and local fixtures. The runner enables only loopback in a private network namespace (no external IPv4/IPv6 routes), retaining non-root Chromium sandboxing. No installed Linux package or Windows application was tested.

## Reproducible scale fixture and methodology

`tests/library-scale.spec.ts` seeds only its isolated temporary database in one transaction: 100 deterministically named collections, 1,000 folders (100 ten-level chains), and 1,000 independently identified POST JSON requests with `{index}` payloads. A second workspace contains one different request. Full expansion is seeded to exercise the most populated browsing view. Production depth/count checks remain unchanged; fixture depth is **10**, not a claimed UI measurement at depth 16.

Close the seed app, then measure a fresh Electron process from immediately before `launchDesktop` to an enabled Search requests control, visible first tree row and two animation frames. This includes app launch/window readiness and viewport setup; OS filesystem caches are warm from fixture preparation. No sleep substitutes for readiness. At 1280×720, do one query/selection warm-up, then measure 20 distinct single-match queries `API <i*47 padded to four digits>` and their 20 distinct selections. Start before the real input fill/result click; finish after matching result readiness or correct enabled editor and two animation frames. Playwright interaction/IPC overhead is included. p95 is nearest rank (19th of 20 sorted samples). Broad 1,000-result search and all-page traversal are functional checks, not the timed single-match-query workload.

The test traverses all tree pages (all 2,100 node IDs) and all ten search pages (all 1,000 request IDs, no duplicates), checks collection filtering, mutation restarts at page zero, minimum 1000×700 geometry, sidebar scrolling and search field height, keyboard Home/End across pages, clearing/reveal from collapsed ancestors, normal expansion preservation and workspace isolation. Explicit first/middle/last sends must produce exactly `/api/0`, `/api/500`, `/api/999` with corresponding POST JSON bytes; no other request is sent during browsing/search/mutation/restart.

Final observed samples (milliseconds, rounded only for display; raw values emitted to `/tmp/task035-performance.json` and `/tmp/task035-optimized-desktop.log`):

| Sample / request index | Selection (ms) | Search (ms) |
|---|---:|---:|
| 1 / 0047 | 163.273 | 100.474 |
| 2 / 0094 | 161.997 | 100.611 |
| 3 / 0141 | 163.966 | 99.544 |
| 4 / 0188 | 163.704 | 100.218 |
| 5 / 0235 | 164.713 | 82.584 |
| 6 / 0282 | 148.185 | 99.431 |
| 7 / 0329 | 146.274 | 99.291 |
| 8 / 0376 | 155.906 | 83.779 |
| 9 / 0423 | 148.893 | 90.825 |
| 10 / 0470 | 147.119 | 82.904 |
| 11 / 0517 | 147.634 | 82.937 |
| 12 / 0564 | 164.785 | 83.114 |
| 13 / 0611 | 146.887 | 99.361 |
| 14 / 0658 | 131.210 | 82.313 |
| 15 / 0705 | 146.590 | 83.825 |
| 16 / 0752 | 147.079 | 100.408 |
| 17 / 0799 | 149.300 | 82.258 |
| 18 / 0846 | 129.528 | 99.414 |
| 19 / 0893 | 147.903 | 82.785 |
| 20 / 0940 | 147.818 | 83.237 |

Cold usable tree: **873.771 ms**. Nearest-rank p95: selection **164.713 ms**, search **100.474 ms**. Maximum mounted tree rows: **50** across 42 pages of the 2,100 visible nodes; search results: **100** across ten pages. Each of the 20 timed queries produced exactly one row. The UI continues to render one editor only. Screenshot review at 1280×720 and 1000×700 confirmed readable hierarchy/breadcrumbs, visible keyboard focus, scrollable sidebar and a usable search field (>=32 px tall) without document horizontal overflow. Performance targets remained cold <=2,000 ms and warm p95 <=500 ms for each workload. Earlier cold failure and pre-optimization samples are summarized above, not treated as passes.

## Acceptance evidence and limitations

- Main tests prove literal/NFC/Latin-folded matching, names/methods/paths/filter/duplicates, complete deterministic 100/100/5 pages, malformed/stale/query-switched pagination and foreign workspace/sender/collection rejection. A throwing `getRequest` spy proves search never loads full configs; URL/body/header markers do not match. Strict replies reject invalid continuation, and preload validates both directions before invocation/consumption.
- Desktop race test holds an old reply, completes a newer query, then releases the old reply; repeats across a workspace switch. New query/workspace rows remain intact. Desktop search guards verify active Stay, explicit cancellation, dirty Save and preserved saved name, with only the explicitly initiated hold request on the wire. Scale test supplies dirty Cancel/Discard and selected ancestor reveal; existing navigation regressions also pass.
- No new arbitrary request cap or migration was added. Main scans and processes metadata for the whole owned library; only returned search pages and mounted tree/results are bounded. This verifies the specified baseline, not unlimited throughput, zero memory growth or latency for arbitrarily large legacy databases. Existing larger databases are preserved without truncation.
- No TASK-035 blockers remain; final optimized performance criteria passed on the documented machine. No Windows, fresh packaged-app, screen-reader audit, installed-platform or release acceptance is claimed. TASK-036 transfer v2 and TASK-037 packaged/platform verification remain unfinished; folder-containing v1 export remains blocked. Published 0.1.1 downloads were not rebuilt or changed. Optional Graphify results never count as tests.
