# TASK-029: Windows build and test, step by step

Everything goes into the `G:\api-client-master\task029-evidence\` folder. When you finish, tell Claude "done" and it will read the logs and update the task report.

**How to type commands:** paste **one line at a time** into PowerShell and press Enter. Wait for each one to finish before you paste the next. If a command ends with red `ERR!` or `error` text and the next prompt appears, **stop there**. Type `Stop-Transcript`, then tell Claude which step failed.

Never paste passwords or real API keys into PowerShell or the app during this test. Use only the made-up values below.

**Always type `npm.cmd`, never `npm`.** PowerShell blocks plain `npm` on this PC. Also, **never run `npm audit fix`** in this project. It changes the pinned tool versions and breaks packaging. The audit warnings are about build tools, not the app.

---

## Part 1: Install the tools (your normal account, internet ON)

**1. Install Node.js 22.18.0**
- Download and run: https://nodejs.org/download/release/v22.18.0/node-v22.18.0-x64.msi
- Click Next through the installer. On the "Tools for Native Modules" page, **leave the box unchecked**.
- Note: this replaces any other Node.js version on this PC.

**2. Install npm 11.6.2.** Open PowerShell **as administrator**: Start menu, type `PowerShell`, right-click it, choose *Run as administrator*. Then run:

```powershell
npm.cmd install --global npm@11.6.2
```

If you see "running scripts is disabled on this system", type `npm.cmd` instead of `npm`. That applies here and in every later step. Close the administrator window when it finishes.

**3. Check the versions.** Open a **normal** PowerShell window and run these two lines:

```powershell
node --version
npm --version
```

You should see `v22.18.0` and `11.6.2`.

---

## Part 2: Build the installer (normal account, internet ON)

**4.** In a normal PowerShell window, run these lines one at a time. `npm ci` and `npm run package:win` can each take several minutes.

```powershell
Set-Location G:\api-client-master
Start-Transcript -Path .\task029-evidence\1-build-log.txt
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture
node --version
npm.cmd --version
npm.cmd ci
npm.cmd exec --no -- install-electron
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run package:win
Get-FileHash .\dist\windows\offline-api-client-0.1.0-x64-setup.exe -Algorithm SHA256
Stop-Transcript
```

If a step fails:
- **Download or network errors during `npm ci` or `install-electron`:** check your internet connection, then run that line again.
- **Errors that mention `gyp`, `MSBuild` or `Visual Studio`:** install "Build Tools for Visual Studio" with the **Desktop development with C++** workload, and Python 3. Then start step 4 again from the top.

---

## Part 3: Install the app (normal account)

**5.** In File Explorer, open `G:\api-client-master\dist\windows\` and double-click `offline-api-client-0.1.0-x64-setup.exe`.

If Windows says "Windows protected your PC", click **More info**, then **Run anyway**. This is expected because the installer is unsigned. Do **not** turn off antivirus or any other protection.

The installer works quietly and does not open the app.

**6.** In PowerShell, run:

```powershell
Test-Path "$env:LOCALAPPDATA\Programs\offline-api-client\offline-api-client.exe"
```

It should print `True`. If it prints `False`, find the app in the Start menu, right-click it, choose *Open file location*, and send Claude that path.

---

## Part 4: Offline tests (normal account, internet OFF)

> **Rerun after the 2026-10-10 test fix:** you don't need to rebuild or reinstall. First delete the leftover test data from the earlier run by pasting this into PowerShell:
> `Remove-Item -Recurse -Force "$env:APPDATA\offline-api-client"`
> That folder only holds made-up test workspaces. Then do steps 7–8 again. The new log replaces `2-offline-tests-log.txt`.

**7. Disconnect from the internet.** Turn off Wi-Fi or unplug the network cable, and turn off any VPN. Claude can't reach your PC while you're offline. That's expected.

**8. Automated tests.** In PowerShell, run these lines one at a time:

```powershell
Set-Location G:\api-client-master
Start-Transcript -Path .\task029-evidence\2-offline-tests-log.txt
Test-NetConnection 1.1.1.1 -Port 443
$env:API_CLIENT_EXECUTABLE = "$env:LOCALAPPDATA\Programs\offline-api-client\offline-api-client.exe"
npm.cmd exec --no -- playwright test
Stop-Transcript
```

- `Test-NetConnection` should say **TcpTestSucceeded : False**. That proves you're offline.
- Some tests will say "skipped" because they are Linux-only. That's fine.
- If some tests fail, don't fix anything. The log records the failures. Continue to step 9.

**9. Manual checks.** Before you start:
- Create a small file at `Desktop\test-upload.txt` that contains the word `hello`.
- Open a **second** PowerShell window and run:

  ```powershell
  node G:\api-client-master\task029-evidence\echo-server.mjs
  ```

  Leave that window open. It should say it is listening on ports 8787 and 8788.

Open **offline-api-client** from the Start menu. Open `task029-evidence\3-manual-checks.txt` in Notepad, and write PASS or FAIL next to each letter as you go:

- **A.** The app opened while you were offline.
- **B.** Create workspace **Test A**. Create a request: method GET, URL `http://127.0.0.1:8787/hello`. Click Send. You should get status 200 and JSON text in the response.
- **C.** Press Ctrl+S. The request should show as saved.
- **D.** Open Variables.
  - Add a global variable `base_url` = `http://127.0.0.1:1`.
  - Create an environment **Local** and give it `base_url` = `http://127.0.0.1:8787`.
  - Also add a **sensitive** variable `token` = `synthetic-secret-123`.
  - Select the Local environment. Send to `{{base_url}}/env`. It should succeed, because the environment value wins over the global one.
- **E.** Send to `{{nope}}/x`. You should see a clear "missing variable" error, and nothing is sent.
- **F.** POST to `{{base_url}}/json` with JSON body `{"a":1}`. The response should show `{"a":1}` in `bodyText`.
- **G.** POST to `{{base_url}}/form` with a URL-encoded body of two rows, `a`=`1` and `a`=`2`. The response should show `a=1&a=2`.
- **H.** POST to `{{base_url}}/upload` with a multipart body. Add one text field, and one file field where you pick `test-upload.txt` in the Windows file dialog. The response should show the file name and `hello`.
- **I.** Send `{{base_url}}/delay?ms=10000` and click **Cancel** while it waits. It should show as cancelled. Then send `/hello` again. It should work.
- **J.** In the Settings tab, set the timeout to 1000 ms. Send `/delay?ms=10000`. You should get a timeout error. Then set the timeout back and check that `/hello` works.
- **K.** Send `/status/401` and `/status/500`. Each should appear as a normal response showing its body text.
- **L.** Send `/html`. The response should show `<script>` as plain text. No popup should appear.
- **M.** Send to `https://127.0.0.1:8788/hello`. You should get a certificate/TLS error, not a response.
- **N.** Create workspace **Test B**. None of Test A's requests or variables should appear in it.
- **O.** Switch back to Test A. Use the workspace menu → Export, and save to `Desktop\testA.json`. Open that file in Notepad. It must **not** contain `synthetic-secret-123`.
- **P.** Use the workspace menu → Import, choose `testA.json`, check the preview, and import it. It should appear as a new workspace with the requests.
- **Q.** Save, close the app with X, and open it again. Everything should still be there: workspaces, requests, environment and theme.

When you're done, save the Notepad file. Stop the server by pressing Ctrl+C in its window. **Reconnect to the internet.**

---

## Part 5: Uninstall/reinstall keeps your data (separate Windows account)

The project's rules require a separate account with only test data. That way, real data is never at risk.

**10. Copy the installer to a shared folder.** In your normal account, run:

```powershell
Copy-Item G:\api-client-master\dist\windows\offline-api-client-0.1.0-x64-setup.exe C:\Users\Public\
```

**11. Create the test account.** Go to Settings → Accounts → Other users → Add account → "I don't have this person's sign-in information" → "Add a user without a Microsoft account". Name it `apitest` and give it any password.

**12. Set up test data.** Sign out, then sign in as **apitest**.
- Run `C:\Users\Public\offline-api-client-0.1.0-x64-setup.exe`. Use More info → Run anyway if Windows asks.
- Open the app from the Start menu. Create workspace **Keep Me**, and a request named **Saved request** with URL `http://127.0.0.1:8787/keep`.
- Press Ctrl+S, switch the theme to **Dark**, then close the app with X.

**13. Record the data files.** Open PowerShell in the apitest account and run:

```powershell
Start-Transcript -Path C:\Users\Public\4-preservation-log.txt
Get-FileHash C:\Users\Public\offline-api-client-0.1.0-x64-setup.exe -Algorithm SHA256
Get-ChildItem "$env:APPDATA\offline-api-client" -Recurse -File | Get-FileHash -Algorithm SHA256
```

**14. Uninstall the app.** Go to Settings → Apps → Installed apps → offline-api-client → ⋯ → Uninstall. If it offers to delete data, **do not tick that option**. Back in PowerShell, run:

```powershell
Test-Path "$env:LOCALAPPDATA\Programs\offline-api-client"
Test-Path "$env:APPDATA\offline-api-client\offline-api-client.sqlite"
Get-ChildItem "$env:APPDATA\offline-api-client" -Recurse -File | Get-FileHash -Algorithm SHA256
```

You should see `False` (the app is gone), then `True` (the data is still there), then the same hashes as in step 13.

**15. Reinstall and check.** Run the same installer again. Open the app. **Keep Me**, **Saved request** and the Dark theme should all still be there.

Close the app. In PowerShell, type a comment line saying what you saw, then stop the transcript. For example:

```powershell
# Reopened after reinstall: Keep Me workspace, Saved request and Dark theme present
Stop-Transcript
```

**16. Copy the log back.** Sign out, then sign back in to your normal account. Run:

```powershell
Copy-Item C:\Users\Public\4-preservation-log.txt G:\api-client-master\task029-evidence\
```

---

## Part 6: Hand back

Make sure Claude's desktop app is open and you're online again. Then tell Claude **"done"**.

Wait until Claude has recorded the results before you delete the `apitest` account. Deleting the account also deletes its test data, which is fine.
