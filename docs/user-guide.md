# Offline API Client user guide

This guide describes version **0.1.0**. The verified packages are the Ubuntu 24.04 x64 deb, the Linux AppImage in extraction-and-run mode, and the Windows 11 Pro x64 NSIS installer. See [release acceptance](release-acceptance.md) for exact package hashes, environments and evidence, and [known limitations](known-limitations.md) before installing.

Version **0.1.1** is now available as an unsigned [public pre-release](https://github.com/miladmoham1400/api-client/releases/tag/v0.1.1), with the custom icon, JSON highlighting and resizable panel layouts. The local workflow below still applies. Use `0.1.1` instead of `0.1.0` in the installation filenames below, and compare with the Release's `SHA256SUMS.txt`, not the historical 0.1.0 hashes. Its [separate verification report](tooling-reports/public-release.md) records native builds and focused installed-app tests; full Windows 11 acceptance for these new bytes remains unverified.

## Install and open

Installed users do not need Node.js, npm, Python or a database server. Obtain the package for your OS from the [public Release](https://github.com/miladmoham1400/api-client/releases/tag/v0.1.1) and compare its SHA-256 with its checksum file. The [historical artifact table](release-acceptance.md#artifacts) applies only to 0.1.0. No automatic updates are enabled.

On Ubuntu 24.04, with the desktop dependencies described in [release prerequisites](release.md) already installed, open a terminal in the folder containing the deb:

```bash
sha256sum offline-api-client-0.1.0-amd64.deb
sudo dpkg --install ./offline-api-client-0.1.0-amd64.deb
```

Launch `offline-api-client` from the application launcher, or run `/opt/offline-api-client/offline-api-client` as your regular user. If installation reports missing dependencies, finish installing those OS packages before launching; dependency downloads need internet or a prepared local cache. The tested host already had the required dependencies. Do not run the app as root.

For the AppImage, make it executable and use the verified extraction mode:

```bash
chmod +x offline-api-client-0.1.0-x86_64.AppImage
APPIMAGE_EXTRACT_AND_RUN=1 ./offline-api-client-0.1.0-x86_64.AppImage
```

Default FUSE mount mode has not been tested on the recorded host. Extraction mode retains Electron's sandbox; do not disable the sandbox to work around a launch error.

On Windows 11 x64, compare the downloaded installer hash in PowerShell:

```powershell
Get-FileHash .\offline-api-client-0.1.0-x64-setup.exe -Algorithm SHA256
```

Double-click that installer. It installs for the current user and leaves the app closed. Open `offline-api-client` from Start. The tested executable was `%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe`. The installer is unsigned, so Windows may display reputation warnings; no signing or universal prompt behavior is promised. Keep antivirus and system protections enabled. If policy blocks installation, consult the machine administrator.

## What offline means

Startup, saved workspaces, editing, variables, themes and workspace transfer are local operations. They require no internet, account, API key, cloud service or telemetry. Nothing sends automatically on startup, selection, import or variable edits.

Sending to a remote API still needs a working connection to that API. Localhost and accessible LAN APIs work without internet. Run your API server separately; this app does not create an API server or proxy. Initial developer dependency downloads are separate from installed offline use; see [developer setup](setup.md).

## First local request

1. Open the app and choose **Create Workspace**. Enter a name such as `Clinic API` and confirm **Create workspace**.
2. Choose **Create Request**. Enter a **Request name**, leave **HTTP method** as GET and enter an absolute **Request URL**, for example `http://127.0.0.1:8787/hello` if your local server serves that address.
3. Choose **Save** or press **Ctrl+S**. The editor displays **Saved** and the request appears in the sidebar.
4. Choose **Send**. A running local server returns a response; an unavailable target shows an error. Send does not save changes for you.

Use the top **Workspace** selector to switch projects. Each workspace has its own requests, collections, environments and variables. Names are trimmed and limited to 1–100 characters; duplicate names are allowed.

## Saved requests, drafts and collections

Edits create an **Unsaved changes** draft. Save is explicit; there is no autosave. **Discard edits** restores the saved version. Send uses the current draft, including unsaved changes, without modifying the saved request. Responses are temporary and disappear after restart.

Switching requests/workspaces or closing with a dirty draft asks **Save**, **Discard** or **Cancel**. Save failures keep the draft and prevent navigation. During an active send, navigation asks **Cancel request** or **Stay**. Only one editor and one active send are available.

Select a saved request in the sidebar to reopen it. **Duplicate saved request** creates an independent copy; dirty-draft decisions occur before navigation. **Delete request** requires confirmation and removes its owned credentials. Workspace menu provides rename/delete; deleting a workspace removes all its descendants after confirmation.

Use **Create Collection** for one-level grouping. Each saved request has a collection selector, including **Workspace root**. Collection **Actions** provide rename/delete; deleting a collection moves its requests to root rather than deleting them. Workspace, collection and environment metadata persist when their actions succeed; request editing still requires Save.

## Params, Headers, Body and Auth

**Params** and **Headers** hold ordered key/value rows. Add, remove, reorder or disable rows. Enabled query rows append to the URL's existing query with encoding applied once. Repeated query/form keys are supported; disabled rows are not sent or resolved. Errors identify the affected fields.

Choose one **Body mode**:

| Mode | Behavior |
|---|---|
| None | No body bytes |
| JSON | Validates JSON after variable substitution; sends the original UTF-8 source text |
| Raw | Sends UTF-8 text with the selected **Raw media type** |
| URL-encoded form | Encodes enabled ordered text rows; keeps duplicates |
| Multipart form | Sends enabled ordered text/file rows with an automatically generated boundary |

Changing body mode retains inactive drafts within the current editor session. Only the active mode is saved or sent. GET and HEAD cannot carry bodies. Empty JSON is invalid; it differs from None. JSON/raw text is limited to 5 MiB.

JSON source editing colors keys and different value types in both Light and Dark themes. It keeps your original spacing and text unchanged, including variable templates. JSON responses use the same colors in Raw and Pretty; select Pretty to format a derived response view. Editor coloring falls back to plain text above 64 Ki characters or 4,096 tokens. Responses use a larger coloring budget; if that is exceeded, a notice explains that only the beginning is colored, and the entire remaining text stays visible. These coloring limits do not restrict editing, sending or the raw response.

The app supplies framing headers. Do not add Host, Content-Length, Transfer-Encoding, Connection or Accept-Encoding yourself. Multipart Content-Type is generated automatically. An incompatible Content-Type produces a field error. See [HTTP behavior](request-engine.md) for exact header and content-type rules.

In **Auth**, choose **None**, **Bearer** or **Basic**. Bearer token and Basic username/password accept literals or templates such as `{{token}}`. Auth is per request. If you select Bearer/Basic and also enable an Authorization header, sending fails with `AUTH_CONFLICT`; remove the conflicting row or use Auth=None. A Basic username cannot contain a colon.

## Variables and environments

Choose **Variables** to open **Environments and variables**. Enter an **Environment name**, choose **Create environment**, then select it using the top **Environment** selector or **Managed environment** in the dialog.

Use **Variable scope** to choose **Workspace** or **Selected environment**. Enter **Variable key** and **Variable value**, optionally mark **Sensitive**, and choose **Add variable**. Existing values have Edit/Save/Delete controls; sensitive values also have Reveal/Hide or Re-enter controls.

For example, put `base_url=http://127.0.0.1:1` in Workspace scope and `base_url=http://127.0.0.1:8787` in the selected Local environment. A URL `{{base_url}}/hello` uses port 8787. Selecting **None** uses only workspace variables. There are no global variables. The selected environment overrides the workspace even when its value is an empty string; inactive environments and other workspaces never contribute.

Keys are case-sensitive: letters/underscore first, then letters/digits/underscore, up to 64 characters. `{{key}}` and `{{ key }}` are equivalent. Substitution happens once at Send; nested-looking substituted text is not expanded again. Missing enabled-field variables prevent any connection and show the field/key. Templates remain saved as templates. Variables can appear in URLs, row keys/values, text bodies and auth, but not local file paths, file names, method, timeout or request names. Substitution does not JSON-escape values for you.

## Sensitive values and storage

Marked sensitive variables and literal Auth credentials use protected OS storage when available. The Variables panel reports **Secure storage available** or **Session only: re-enter after restart**. When storage is session-only, the value stays in memory and must be entered again after restart. Imported omitted values also need re-entry. A missing/decryption error does not silently turn into an empty credential; supply it again before sending.

This does not encrypt the entire database or automatically classify ordinary URL, query, body, custom-header or plain-variable text. Use sensitive variables for credentials and review exports before sharing. Reveal/edit and API responses can display sensitive text to you; protection at rest does not protect against a compromised desktop. Secure credentials may be tied to the OS account and are not portable backups.

## Upload files

In **Body → Multipart form**, choose **Add multipart text** or **Add multipart file**, enter the field key and choose **Choose file**. The native file dialog selects a regular local file. A selected row offers **Replace file**; cancelling the dialog preserves the previous selection. Disabled rows do not require a file.

Save retains file name/size metadata, not a reusable path permission. Reopening a saved request after restart or importing it requires **Choose file** again; duplication also requires fresh selection. Selection can remain while saving in the current editor. Missing, unreadable or changed-size files must be selected again. Same-size content changes are not detected as immutable snapshots.

Limits: 20 MiB per file, 50 MiB total selected files and 55 MiB serialized payload. The app streams files; it does not automatically retry failed sends.

## Send, cancel and read responses

Choose **Send**, or **Ctrl+Enter** with focus in the request editor while idle. Settings default to a **30,000 ms** overall timeout and redirects off. Timeout range is **100–300,000 ms** and includes connection, upload, redirects and response reading. Use **Cancel** to abort; wait for the terminal state before sending again.

With **Follow redirects** off, the original 3xx is displayed. With it on, at most five hops are followed. Redirects can change the method/body according to HTTP rules; cross-origin redirects strip credentials, and HTTPS-to-HTTP redirects are rejected. TLS certificate verification is always enforced; self-signed/untrusted certificates can produce `TLS_FAILURE`.

The **Response** panel shows status, duration, decoded body size, final URL, redirects and the environment/request at Send. **Body** offers **Raw** and **Pretty** (bounded JSON formatting); **Headers** shows response headers. **Smaller/Larger** resize the panel. HTML and scripts appear as literal text. Binary or unsupported-charset responses show metadata; binary preview/download is unavailable. Encoded and decoded responses are each limited to 10 MiB.

Use the **Stacked / Side by side** toggle above the editor to place the request and response beneath one another or beside one another. Drag the divider to choose their relative heights or widths; each panel scrolls independently. You can also focus the divider and use arrow keys (Up/Down when stacked, Left/Right when side by side), Shift for a larger step, or Home/End for the size limits. **Smaller/Larger** adjusts the response along the current layout's axis. Each panel retains at least 20% of the split area. Your chosen ratio for each layout stays during the session and resets when the app restarts. Changing layout keeps drafts and the current response/Pretty selection intact.

HTTP 401/500 are normal responses with status and body. DNS/refusal/TLS/timeouts are request errors, without an invented HTTP status. If you edit during an active send, the response still belongs to the captured original settings. Startup and restart never resend a saved request.

## Export and import

From **Workspace menu → Export workspace JSON**, read the exclusions and choose **Choose save location**. The native save dialog writes saved configuration; unsaved request edits stay in the editor and are not included.

Export omits sensitive values, literal/mixed Auth credentials, Authorization/Proxy-Authorization/Cookie header values, local file paths/selections and responses. Credential header rows become empty and disabled. Pure placeholder Auth templates can remain; file metadata can remain. Ordinary text may still contain user-entered secrets: review JSON before sharing. There is no export-secrets option.

Choose the top **Import workspace JSON** button, then **Choose JSON file**. Review the preview and omission counts, then choose **Import as new workspace**. Your current workspace stays selected; select the new ` (imported)` workspace when ready. Import creates fresh identities, starts with environment **None** and no request selected, and never merges, overwrites or sends. Supply missing credentials, select the desired environment and choose files again. Invalid files or cancellation leave existing workspaces intact.

Only this app's format v1 is supported, not Postman/OpenAPI files. Import limit is 10 MiB, 100 collections, 50 environments, 1,000 requests and 100 variables per scope. Ordered row groups are limited to 200 rows. See [format details](import-export.md).

## Theme, data location and removal

The top **Theme** selector provides **Light**, **Dark** and **System**. Preference persists without replacing the draft. Keyboard navigation uses Tab/Shift+Tab; dialogs restore focus. Ctrl+S saves; Ctrl+Enter sends from the idle editor. Escape does not silently discard edits.

| OS | Default application data directory |
|---|---|
| Linux | `~/.config/offline-api-client/`, or `$XDG_CONFIG_HOME/offline-api-client/` when configured |
| Windows | `%APPDATA%\offline-api-client\` |

Saved workspaces live in `offline-api-client.sqlite` in that directory; Chromium also creates local cache/settings files. Close normally before making a private backup of application data. A copied database is not a portable credential export, and copying the folder alone may not restore OS-bound secrets on another account/machine. Use workspace JSON for portable non-secret configuration.

Uninstall preserves application data by default. Ubuntu's verified removal used `sudo dpkg --remove offline-api-client`; Windows uses **Settings → Apps → Installed apps → offline-api-client → Uninstall**. The first Windows removal attempt left the app installed; a second removed it, with all data preserved. If removal does not finish, check the app is closed and follow the uninstaller prompts before retrying; do not delete workspaces as a workaround.

For complete data removal, after closing and uninstalling, explicitly delete only the application data directory above in your file manager. This permanently removes saved workspaces, settings and stored credential records. Keep any desired exports/backups first; ordinary uninstall does not perform this deletion.
