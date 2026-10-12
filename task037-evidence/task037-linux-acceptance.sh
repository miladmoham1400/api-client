#!/usr/bin/env bash
# TASK-037 Linux acceptance for the fixed source (guarded-dialog + Ctrl+S fixes).
# Run as your regular user (NOT with sudo) in a terminal on the Ubuntu machine:
#   bash task037-linux-acceptance.sh /path/to/api-client /path/to/task037-fix.patch
# sudo asks for your password itself, in this terminal, when it installs/removes the package.
# Never type the password anywhere else. Only synthetic temporary profiles are used; your real
# ~/.config/offline-api-client is never opened by these tests.
set -uo pipefail

if [[ $# -ne 2 ]]; then echo "Usage: bash $0 /path/to/api-client /path/to/task037-fix.patch"; exit 2; fi
if [[ "$(id -u)" == 0 ]]; then echo "Run as your regular user, not root/sudo."; exit 2; fi
REPO="$(cd "$1" && pwd)" || exit 2
PATCH="$(realpath "$2")" || exit 2
cd "$REPO" || exit 2
[[ -f tests/library-upgrade.spec.ts && -f scripts/test-offline.sh ]] || { echo "This checkout does not contain the TASK-037 tests (tests/library-upgrade.spec.ts). Update it to commit cfed400 first."; exit 2; }

STAMP="$(date +%Y%m%d-%H%M%S)"
EVID="$REPO/task037-evidence-linux"; mkdir -p "$EVID"
LOG="$EVID/linux-acceptance-$STAMP.log"
exec > >(tee -a "$LOG") 2>&1
OUT="dist/task037-linux-fix"
FAILED=()
step() { echo; echo ">>> $* [$(date -Is)]"; "$@"; local rc=$?; echo "[exit $rc] [$(date -Is)]"; [[ $rc -eq 0 ]] || FAILED+=("$*"); return $rc; }

echo "==== TASK-037 Linux acceptance $STAMP in $REPO ===="
step uname -a
step lsb_release -ds
step git rev-parse HEAD
step git status --porcelain
step node --version
step npm --version
echo "CPU: $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2) / $(nproc) logical / $(awk '/MemTotal/ {print $2*1024}' /proc/meminfo) bytes RAM"

# 1. Apply the fix (skips if already applied).
if git apply --check "$PATCH" 2>/dev/null; then step git apply "$PATCH"
elif git apply -R --check "$PATCH" 2>/dev/null; then echo "Patch already applied."
else echo "Patch does not apply cleanly; stopping."; exit 1; fi
step git diff --stat

# 2. Source checks.
step npm ci
step npm exec --no -- install-electron
step npm run typecheck
step npm run lint
step npm run test:unit -- --maxWorkers=1
if [[ -f scripts/graphify.py ]]; then step python3 scripts/graphify.py update; fi

# 3. Native packages into a separate output folder (existing dist/ artifacts are untouched).
rm -rf "$OUT"
step npm run build
step npm exec --no -- electron-builder --config electron-builder.json --config.directories.output="$OUT" --linux AppImage deb --x64 --publish never
DEB="$REPO/$OUT/offline-api-client-0.1.1-amd64.deb"; APPIMAGE="$REPO/$OUT/offline-api-client-0.1.1-x86_64.AppImage"
( cd "$OUT" && sha256sum offline-api-client-0.1.1-amd64.deb offline-api-client-0.1.1-x86_64.AppImage | tee SHA256SUMS.txt )
stat -c '%n %s bytes' "$DEB" "$APPIMAGE"
step dpkg-deb -f "$DEB" Package Version Architecture

# 4. Extracted deb payload: full loopback-only suite, then 5x repeats of the guard/Ctrl+S specs.
step dpkg-deb --extract "$DEB" "$OUT/deb-extracted"
PAYLOAD="$REPO/$OUT/deb-extracted/opt/offline-api-client/offline-api-client"
API_CLIENT_EXECUTABLE="$PAYLOAD" API_CLIENT_PERFORMANCE_REPORT="$EVID/deb-payload-performance.json" step bash scripts/test-offline.sh --reporter=list
API_CLIENT_EXECUTABLE="$PAYLOAD" step bash scripts/test-offline.sh tests/library-tree.spec.ts tests/navigation.spec.ts tests/requests.spec.ts --reporter=list --repeat-each=5

# 5. AppImage (extraction-and-run) focused suite.
APPIMAGE_EXTRACT_AND_RUN=1 API_CLIENT_EXECUTABLE="$APPIMAGE" step bash scripts/test-offline.sh tests/library-upgrade.spec.ts tests/library-tree.spec.ts tests/navigation.spec.ts tests/requests.spec.ts tests/import.spec.ts tests/offline.spec.ts tests/database.spec.ts tests/security.spec.ts --reporter=list
if [[ -e /dev/fuse ]]; then
  echo "Optional: default AppImage (FUSE) launch smoke"
  API_CLIENT_EXECUTABLE="$APPIMAGE" step bash scripts/test-offline.sh tests/database.spec.ts --reporter=list
else echo "No /dev/fuse: default AppImage FUSE launch not tested."; fi

# 6. Actual install over the existing package (sudo asks for your password here).
echo "Installed before: $(dpkg-query -W -f='${Package} ${Version} ${Status}' offline-api-client 2>&1)"
step sudo apt-get install -y "$DEB"
echo "Installed after: $(dpkg-query -W -f='${Package} ${Version} ${Status}' offline-api-client 2>&1)"
echo "Installed binary vs payload: $(sha256sum /opt/offline-api-client/offline-api-client | cut -c1-64) / $(sha256sum "$PAYLOAD" | cut -c1-64)"
API_CLIENT_EXECUTABLE=/opt/offline-api-client/offline-api-client API_CLIENT_PERFORMANCE_REPORT="$EVID/installed-performance.json" step bash scripts/test-offline.sh --reporter=list

# 7. Actual removal/reinstall preservation with a synthetic temporary profile (includes nested library).
PDIR="$(mktemp -d /tmp/api-client-task028-preservation-XXXXXXXXXX)"
export API_CLIENT_PRESERVATION_DIR="$PDIR"
API_CLIENT_EXECUTABLE=/opt/offline-api-client/offline-api-client API_CLIENT_PRESERVATION_PHASE=seed step bash scripts/test-offline.sh --config playwright.linux-preservation.config.ts
DB="$PDIR/offline-api-client/offline-api-client.sqlite"
echo "Seeded DB: $(sha256sum "$DB" 2>&1)"
step sudo apt-get remove -y offline-api-client
echo "After removal: package=$(dpkg-query -W -f='${Status}' offline-api-client 2>&1); binary exists=$([[ -e /opt/offline-api-client/offline-api-client ]] && echo yes || echo no)"
echo "DB after removal: $(sha256sum "$DB" 2>&1)"
step sudo apt-get install -y "$DEB"
echo "After reinstall: $(dpkg-query -W -f='${Package} ${Version} ${Status}' offline-api-client 2>&1)"
API_CLIENT_EXECUTABLE=/opt/offline-api-client/offline-api-client API_CLIENT_PRESERVATION_PHASE=verify step bash scripts/test-offline.sh --config playwright.linux-preservation.config.ts
unset API_CLIENT_PRESERVATION_DIR
rm -rf "$PDIR"

cp "$OUT/SHA256SUMS.txt" "$EVID/SHA256SUMS-$STAMP.txt"
echo
if [[ ${#FAILED[@]} -eq 0 ]]; then echo "==== FINISHED OK ===="; else echo "==== FINISHED WITH FAILURES ===="; printf ' - %s\n' "${FAILED[@]}"; fi
echo "Send these files back to Claude: $EVID/linux-acceptance-$STAMP.log, $EVID/SHA256SUMS-$STAMP.txt, $EVID/*performance.json"
