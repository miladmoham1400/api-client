# TASK-018 — Overall timeout and cancellation

Status: done. Date: 2026-10-05. TASK-017 was done and the working tree was clean at inspection. Only TASK-018 was executed.

## Changes

- ExecutionService now owns one monotonic deadline, calculated immediately after materialization/acceptance, and one explicitly cleared timer. The deadline does not restart for redirects or incoming data. Timer expiry aborts the shared controller and reports TIMEOUT; owned cancellation reports CANCELLED. Both use the existing native transport teardown of requests, response streams and decoders.
- First terminal outcome wins; late transport settlement and repeated cancellation cannot emit a second completion or clear a newer execution. Success, errors, cancellation, timeout and lifecycle teardown clear the timer before releasing the active slot. Completion after an already elapsed deadline cannot bypass timeout by winning a delayed timer callback.
- A deadline/cancel before preload acknowledgement aborts immediately, clears its timer and retains a single bounded pending terminal result in the reserved execution. Acknowledgement delivers it and releases the slot without starting I/O. This preserves acceptance-before-completion. Renderer teardown releases even this pending slot; the normal preload API always acknowledges accepted sends.
- Added strict cancel input/result contracts, an explicit frozen preload cancel method and owned-main-frame IPC. A valid wrong/stale ID is an idempotent no-op; it cannot cancel the matching active execution. Foreign sender/frame and malformed IDs are rejected. No generic IPC or renderer Node access was introduced.
- Added one renderer execution subscription with idempotent cleanup, stale ID/generation checks and cancellation on scope/unmount cleanup. Send snapshots the current draft, reads the selected owned environment and submits saved or unsaved drafts without saving. Rapid duplicate attempts and Ctrl+Enter while busy cannot start another request. Send disables while preparing/running; Cancel becomes available after acceptance. Draft editing remains available.
- Basic busy/completed/error feedback is truthful, cancellation is neutral, and errors are safely rendered as text. Navigation/collection mutations and request duplication/deletion are disabled during execution; active-send navigation confirmation dialogs remain for TASK-023. Startup capability/about/empty-response copy now accurately describes available execution and unavailable response preview.
- Response viewer, HTTP response metadata/body presentation and pretty view remain for TASK-019. No response persistence, retry, infinite timeout, upload/file feature or phase-2 feature was added. No package or lockfile changes.

## Actual checks and environment

Ubuntu 24.04.3 LTS, Linux x64; developer Node 22.18.0, npm 11.6.2. The real Electron smoke observed Electron 44.5.1 with embedded Node 24.21.0, ABI 149 and Chromium 152.0.7977.130.

- `npm run typecheck`: initial failures in the new hook's ref narrowing and the pending socket fixture's value/readonly types were corrected. Final run passed.
- `npm run lint`: final run passed.
- `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit`: first run had **230 passed and 4 failed**, in 19 files (2.18 s). Three assertions sampled asynchronous request-close events too early; the connect setup also needed an explicitly pending socket instead of an option ignored by agent:false. The response-first race assertion needed to await promise adoption before issuing cancel. Tests were corrected to assert actual request/socket destruction, inject a typed pending socket through a private test agent, and flush the queued promise race. Next run passed all 234 tests (2.18 s). Final run, after ensuring gzip cancellation waited for response/decoder setup, passed **234 tests in 19 files** (2.13 s). Native SQLite rebuilt for developer Node; loopback/native checks ran outside the restricted sandbox.
- `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke`: Electron native SQLite rebuild, typecheck and production main/preload/renderer build passed; **15 desktop tests passed** (43.4 s). The new UI cancel/timeout test passed (1.9 s). Runs use chromiumSandbox:true and bundled local production resources. Native SQLite was left rebuilt for Electron.
- `git diff --check`: passed, including final report/status updates.

## Acceptance evidence

`tests/main/execution.test.ts` verifies deadline expiry from acceptance before acknowledgement, no I/O after expiry, exactly one TIMEOUT completion, owned/validated cancel, wrong/stale ID no-op, duplicate cancel, first-winner response/cancel/timeout races, timer count returning to zero and successful next acceptance. Existing busy, lifecycle, workspace deletion and late-settlement checks remain passing.

`tests/main/deadline.test.ts` verifies actual native requests under the application deadline:

- No response headers, active streaming response and gzip streaming all time out despite traffic. Fixture sockets close; another send succeeds.
- Two individually short redirect responses exceed the single total deadline, producing TIMEOUT without resetting at a hop.
- Cancellation after gzip response headers/decoder setup closes the request and compressed stream. The captured signal has no remaining abort listeners and completion occurs once.
- Injected pending DNS lookup through the real Node request API is destroyed at expiry; late lookup completion cannot create another terminal result. This uses no public DNS service.
- A typed injected connecting socket and a real paused loopback TCP receiver exercise pending connect and blocked 5 MiB raw upload. Deadline expiry destroys the request/socket. Upload has not emitted finish when the timeout fires. Connect remains deliberately pending and never contacts the receiver.

DNS/connect cases are deterministic injection around real Node ClientRequest, not claims of testing external DNS resolvers or blackholed internet routes. File streams are not present yet; their upload capability/serialization tasks remain unfinished. The existing transport's default verified TLS and redirect-policy regressions still pass; a stalled TLS handshake was not separately exercised in this task.

`tests/preload/execution.test.ts` verifies cancel UUID/result validation, sanitized invocation failures and no subscription requirement for cancellation; existing acceptance ordering, event stripping and listener removal checks remain passing. Security smoke now verifies the explicit send/cancel/onCompleted API allowlist and frozen groups.

`tests/cancel-timeout.spec.ts` uses the real sandboxed Electron UI and loopback fixture: creates an unsaved draft; verifies no automatic traffic; Send disables and Cancel enables; editing the URL and Ctrl+Enter during execution create no second send; Cancel produces one neutral terminal; a 100 ms timeout is shown; the next Ctrl+Enter send succeeds. It records exactly CANCELLED, TIMEOUT and one HTTP response, and verifies saved request rows remain empty. Renderer HTTP resource requests remain absent. Existing request persistence smoke now checks that a draft with a nonempty URL enables explicit Send; blank/no-draft cases remain disabled.

## References, limitations and blockers

Reviewed official Node 22.18 documentation for [AbortController and signal listener lifecycle](https://nodejs.org/download/release/v22.18.0/docs/api/globals.html#class-abortcontroller) and [ClientRequest destruction](https://nodejs.org/download/release/v22.18.0/docs/api/http.html#requestdestroyerror). No guessed dependency versions or new libraries were needed.

JavaScript deadlines cannot interrupt synchronous work while the event loop is blocked; expiry is checked again at start and terminal handling. Timing checks use bounded local fixtures and deterministic fake-clock races, without claiming hard real-time guarantees.

TASK-019 response viewer and TASK-023 navigation/close confirmation flows remain unfinished. Windows and independently installed Linux/Windows packages were not tested and are not marked passed. The existing safeStorage smoke observed unavailable/basic_text/session mode; secure OS round-trip fields were null, not passed. Existing nonfatal Zod/Rollup annotation and Playwright color warnings appeared. No remaining TASK-018 blocker. Task file and index are synchronized as done using the available Linux development evidence.
