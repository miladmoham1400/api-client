# Sensitive data handling

## Boundary and limitation

Sensitive designation applies to variable values and literal credential fields in the Auth editor. It does not automatically classify strings in URL/query/raw body/custom headers. Those ordinary saved fields may contain plaintext secrets. Show one concise explanation near sensitive controls; recommend variables for credentials. Never claim that the entire database/export is encrypted or scrubbed of all possible secrets.

## Storage

Use Electron safeStorage in main after ready. Check encryption availability and, on Linux, storage backend. `basic_text` is not secure storage. If secure storage is unavailable, sensitive values stay in memory for the session only; persist a session-mode missing-value record and display `Session only: re-enter after restart`. Do not block ordinary offline work or require login. No plaintext fallback without a future explicit product decision.

A secure secret stores ciphertext BLOB and workspace ownership in SQLite. Decrypt only for explicit local edit/reveal or request materialization. Never export ciphertext as portable credentials: it may be bound to OS/user. Failure to decrypt produces SECRET_UNAVAILABLE; no silent deletion. Request auth literal token/password and Basic username use secret records; placeholders themselves may be non-secret configuration. Secret deletion is transactional with its owner. Request duplication copies secret content into an independently owned new record (session or secure according to capability).

Marked sensitive variables have masked list DTOs. A user may intentionally reveal them. The owned renderer can see values while editing, so this is protection at rest, not a defense against a compromised desktop or malicious UI. Response echo can also contain credentials; responses are session-only and should never be logged or exported automatically.

## Diagnostics

Log only execution ID, method, hostname without userinfo/query, result code/status and duration. Do not log draft objects, resolved URL, bodies, cookies, auth values, variable values, ciphertext or raw exception objects. Sanitized messages exclude file paths and secret values. Test fixtures use synthetic values only.

## Export

Always omit sensitive variable values, auth credentials, file paths/capabilities and response data. Omit enabled or disabled Authorization/Proxy-Authorization/Cookie header values (retain row with empty value and disabled state). Export dialog warns that ordinary URL/query/body/header/plain-variable text can contain user-entered secrets and should be reviewed before sharing. No export-secrets toggle in phase 1.

## Acceptance

Synthetic sensitive value absent as UTF-8 plaintext from database and diagnostics on secure backend; session-only backend does not persist it at all. Reopening secure storage restores it when available; session-only value needs re-entry. Ordinary plaintext fields are not included in this guarantee. Both storage capability paths require tests.
