# HTTP execution specification

## Transport

Main-process Node http/https; HTTP/1.1. Use a pure injectable transport module for tests and Electron handlers only for ownership/lifecycle. No renderer fetch, browser cookie store, cloud proxy or automatic retry. Supported schemes http/https only. Require absolute URL with host; allow localhost, LAN, IPv4 and IPv6. Reject URL embedded username/password; use Auth. Reject fragments rather than quietly send a different URL. TLS certificate verification always ON.

Snapshot all request settings and effective variables before network I/O. GET/HEAD bodies are rejected; other supported methods may use bodies. OPTIONS is an ordinary request. HEAD/204/304 may have empty bodies. Non-2xx responses remain displayable results.

## Headers and authentication

Enabled header rows only. Validate token syntax and prohibit CR/LF in names/values. Preserve order and duplicates where Node's API supports them; do not promise exact header-name casing or duplicate singleton headers. Reject duplicate singleton headers (Authorization, Content-Type, Host) case-insensitively. Host, Content-Length, Transfer-Encoding, Connection and Accept-Encoding are engine-managed and rejected as user rows. Engine supplies Accept-Encoding: gzip, deflate, br; transport handles decompression.

Explicit Authorization is allowed when Auth=None. If Bearer/Basic is selected and an explicit enabled Authorization row exists, return AUTH_CONFLICT. Bearer produces `Bearer <resolved-token>`. Basic produces base64 UTF-8 `username:password`; reject colon in username. Auth configuration is per request, no implicit inheritance.

## Serialization

| Body | Wire rules |
|---|---|
| none | No body bytes, no automatic Content-Type |
| json | Validate post-substitution JSON; send original UTF-8 text without pretty-printing; default application/json |
| raw | UTF-8 text; default selected mediaType or text/plain |
| urlencoded | Enabled text rows through URLSearchParams; preserve duplicate keys/order; default application/x-www-form-urlencoded |
| multipart | Enabled ordered text/file parts; UTF-8 text; library-generated boundary and matching Content-Type |

User JSON Content-Type may be application/json or a `+json` media type; raw may use any valid explicit media type. URL-encoded Content-Type must be application/x-www-form-urlencoded (optional charset). A conflicting type returns CONTENT_TYPE_CONFLICT. Multipart Content-Type must be engine-generated: reject an explicit user row so boundary cannot be mismatched. Set Content-Length only when exact byte length is known; otherwise stream using valid HTTP framing. Never trust a user-supplied length.

No-body requests may carry explicit Content-Type. Blank bodies are distinct from body mode none. JSON blank text is invalid. Query rows append to existing URL query; duplicate keys and empty values are supported.

## Uploads

Native dialog creates workspace-scoped opaque capability; main opens the file at send time. Stat before send; detect missing/unreadable/changed-size files and reject with useful field error. File selection permits regular files only. Content can change without size change; phase 1 does not guarantee an immutable filesystem snapshot. File names and field names must be safely serialized by the multipart library, including Unicode. Do not hand-concatenate multipart delimiters. Validate all files before opening the network connection.

Limit a single file to 20 MiB, all selected files to 50 MiB and serialized request payload to 55 MiB. Stream files with cleanup on completion/cancel/error; do not load 50 MiB into renderer. Disabled file rows need no selection.

## Redirects

Default OFF: display the original 3xx. When ON, follow 301/302/303/307/308 with a valid Location; max 5 followed hops. Resolve relative Location against current URL. 303 becomes GET except HEAD; 301/302 convert POST to GET; 307/308 preserve method/body. When switching to GET, drop body and entity headers. Reopen file streams for a replay. Overall timeout spans all hops.

Never follow HTTPS to HTTP: REDIRECT_DOWNGRADE. Strip Authorization, Proxy-Authorization and Cookie when origin changes (scheme, host or effective port). Once stripped they remain stripped for later hops. No persistent cookie jar or automatic Set-Cookie forwarding. Detect invalid schemes/URLs before the next hop. Exceeding max gives REDIRECT_LIMIT. Show final URL and hop count.

## Time, cancellation and response limits

Use a monotonic clock from acceptance/materialization completion to last decoded response byte; display elapsed milliseconds. Overall timer explicitly aborts DNS/connect/TLS/upload/response and redirects at timeoutMs. A Node timeout event alone is insufficient. Cancel aborts sockets, decoders and file streams, clears timers and emits one CANCELLED terminal result. Completion/cancel/timeout races resolve exactly once. Release active slot in every terminal path, including renderer close/workspace deletion.

At most 10 MiB received encoded response body and 10 MiB decoded body. Stop and return RESPONSE_TOO_LARGE if either limit is exceeded, including decompression bombs. Successful bodySizeBytes is decoded length, not headers/total network bytes. Decode gzip/deflate/br; corrupt supported encoding -> DECOMPRESSION_FAILURE. Unsupported encoding -> binary response metadata, no misleading text.

## Response DTO

`{statusCode,statusMessage,finalUrl,redirectCount,durationMs,bodySizeBytes,headers:[{name,value}],body:{kind:'text',text,charset}|{kind:'binary',sizeBytes,reason}}`.

Preserve response header duplicates from rawHeaders, including Set-Cookie; renderer displays safely. No persistent response storage. UTF-8 JSON/text (including text/*, application/json, +json, application/xml, +xml and application/javascript) can display as text. Other declared charsets not supported in phase 1: mark binary/unsupported charset rather than corrupt text. Missing Content-Type: use UTF-8 text only when bytes pass UTF-8 validation and contain no NUL, otherwise binary. Binary previews/download are deferred; show size/type. JSON pretty view is derived and optional; raw response text remains accessible. Do not pretty-print large/invalid JSON synchronously without bounded work.

## Errors

Map DNS, refusal, TLS, network, cancellation, timeout and size/decode errors to documented codes. Sanitize errors: no tokens, full resolved URL query values, header/body values or filesystem paths in diagnostics. Do not retry requests automatically, especially mutating requests.
