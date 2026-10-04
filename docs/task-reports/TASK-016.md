# TASK-016 — Single-hop HTTP transport

Status: done. Date: 2026-10-05. Dependencies TASK-015 and TASK-003 were done; the initial working tree was clean. No later task was executed.

## Changes

- Main-only asynchronous Node HTTP/HTTPS single-hop transport sends captured original UTF-8 bytes, ordered header rows, explicit Host and managed framing/encoding headers. TLS verification is explicitly enabled; no pooled sockets, redirects, retries or cookie state.
- Streaming counters bound both encoded and decoded response bodies to 10 MiB, including decompression bombs. Gzip, deflate and Brotli decompress asynchronously; corrupt supported encodings fail. Raw response headers retain duplicates. Supported UTF-8 text is distinguished from binary, invalid UTF-8, unsupported charset and unsupported encoding. HTTP error status codes remain responses.
- Strict send/completion DTOs, owned-window IPC and a frozen `execution.send/onCompleted` preload group connect the existing materializer. One active slot receives a main-generated UUID; rejected sends reserve nothing. Preload requires an existing completion subscription, returns acceptance, then acknowledges through a private fixed channel on the next turn. Main starts I/O only after that acknowledgement. Renderer never receives raw IPC/events, sockets, buffers or a resolved request snapshot.
- Completion validates outgoing data and clears the slot exactly once before notifying. Exceptions, response errors, size/decode failures and lifecycle aborts release the slot. Renderer reload/crash/close, shutdown and successful owning-workspace deletion abort captured execution; failed deletion preserves it. Late settlement cannot clear a newer execution.
- Local fixture and boundary tests use synthetic data and an explicitly public self-signed TLS test certificate/key. No package or lockfile change; no response persistence or response UI change.

## Environment and actual checks

Ubuntu 24.04.3 LTS, Linux x64; developer Node 22.18.0, npm 11.6.2. Direct Electron executable inspection returned Electron 44.5.1, embedded Node 24.21.0, ABI 149, Chromium 152.0.7977.130.

- `npm run typecheck`: initial failures in preload contextual typing and then two fixture types were corrected; subsequent run passed.
- `npm run lint`: passed.
- `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit`: first transport run 185 tests in 15 files passed (5.01 s); with lifecycle/preload checks, 195 tests in 17 files passed (6.01 s). A subsequent run had 193 passing and 2 failing tests: an existing repository test exceeded its 5 s timeout, and the truncation fixture raced corrupt-gzip detection against socket closure. The fixture was corrected to send a valid partial gzip header; final full rerun passed all 195 tests in 17 files (8.66 s), including the repository test, without changing existing test timeouts. SQLite rebuilt for developer Node. Loopback checks ran outside the restricted sandbox.
- `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke`: Electron rebuild and production build passed; Playwright collection failed because its CommonJS fixture loader rejected `import.meta`. Certificate paths were corrected without changing module/package settings. Final full rerun passed the Electron rebuild, typecheck, production main/preload/renderer build and all 13 desktop tests (43.8 s). Native SQLite was left rebuilt for Electron.
- `env NODE_OPTIONS=--dns-result-order=ipv4first npx playwright test tests/execution.spec.ts`: corrected Electron send smoke passed, 1 test (1.9 s). The final full suite also passed this test (1.4 s).
- `env ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron -e 'console.log(JSON.stringify({platform:process.platform,arch:process.arch,electron:process.versions.electron,node:process.versions.node,modules:process.versions.modules,chrome:process.versions.chrome}))'`: runtime versions above observed; this introspection is separate from sandboxed GUI execution.

## Acceptance evidence

`tests/main/transport.test.ts` covers native JSON UTF-8 wire bytes, duplicate query/header rows, Basic auth, GET/HEAD/OPTIONS without body, non-2xx status, original redirect-off response, duplicate Set-Cookie, decoded sizes/timing, all three decompressors and corrupt input, HEAD/204/304 empty handling, binary/charset/invalid UTF-8 classification, exact limit and over-limit/bomb rejection, reset/truncated/upgrade failures, stream abort, refusal and self-signed TLS rejection. DNS mapping is exercised with synthetic Node error codes, without public DNS dependency.

`tests/main/execution.test.ts` covers active-workspace/request/environment ownership, foreign frames/senders, malformed input, unavailable database, redirect-on rejection, no I/O before acknowledgement, immutable variable snapshot, concurrent-send guard, duplicate/wrong starts, response/error/throw/invalid-DTO slot release, abort/late-settlement races and committed-versus-failed workspace deletion. `tests/preload/execution.test.ts` covers pre-subscription, acceptance-before-start, payload validation, event stripping, idempotent unsubscribe and sanitized invoke failure.

`tests/execution.spec.ts` exercises the real sandboxed bundled production entry and frozen preload API using Electron's embedded Node: saved template and sensitive synthetic variable materialization, original body bytes and Bearer header, unchanged saved templates, immediate completion correlation, non-2xx, compressed/text/binary responses, bomb/corruption and untrusted TLS, unsupported redirect option, busy rejection, owning-workspace deletion, reload slot cleanup and closed socket cleanup. Renderer HTTP resource requests remained absent. Existing security smoke includes the new explicit API allowlist.

## Official API references

Reviewed official Node 22.18 documentation for [HTTP raw request headers, response rawHeaders and request lifecycle](https://nodejs.org/download/release/v22.18.0/docs/api/http.html), [streaming gzip/deflate/Brotli decoding](https://nodejs.org/download/release/v22.18.0/docs/api/zlib.html), and [Buffer UTF-8 validation](https://nodejs.org/download/release/v22.18.0/docs/api/buffer.html). These are runtime APIs, not new package dependencies. The initial `docs/latest-v22.x` URLs were inaccessible through the browsing tool; exact release URLs succeeded.

## Limits and remaining work

TASK-017 redirects, TASK-018 overall timeout/public cancellation and TASK-019 response feedback remain unimplemented. Redirects ON explicitly rejects. The visible Send and Cancel controls and bootstrap requests capability remain unavailable until the feedback task. The API currently has lifecycle aborts but no overall timer; an unresponsive endpoint can retain the slot until lifecycle cleanup. Send/completion are tested via the preload API, without pretending that the response viewer exists.

Untrusted local TLS rejection was tested; a trusted external HTTPS round-trip, public DNS failure, LAN/IPv6 endpoints, Windows and independently installed Linux/Windows packages were not tested. The existing capability smoke observed safeStorage unavailable with backend `basic_text` and session mode; secure OS round-trip fields were null, not passed. The final lint and `git diff --check` passed. Task and index are synchronized as done, with evidence for this task’s acceptance criteria on the available Linux development host. No remaining TASK-016 blocker. Known nonfatal Zod/Rollup annotation and Playwright color-environment warnings occurred.
