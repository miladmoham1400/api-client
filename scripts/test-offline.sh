#!/usr/bin/env bash
# Test-only Linux network isolation; never changes the host network or disables Chromium sandboxing.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Linux ]]; then
  echo 'Offline namespace runner requires Linux; other platforms are not verified.' >&2
  exit 1
fi
if [[ "$(id -u)" == 0 ]]; then
  echo 'Run as a regular user so Electron retains its sandbox.' >&2
  exit 1
fi
for command in unshare ip node; do command -v "$command" >/dev/null; done
export API_CLIENT_OFFLINE_TEST=1
export NODE_OPTIONS="${NODE_OPTIONS:-} --dns-result-order=ipv4first"
# Outer namespace has setup capabilities; inner maps the invoking user back to a non-root UID.
# There are no veth devices or routes, so all descendant IPv4/IPv6 traffic is loopback-only.
exec unshare --user --map-root-user --net bash -c '
  set -euo pipefail
  ip link set lo up
  ip -brief address
  ip route
  ip -6 route
  exec unshare --user --map-user="$1" --map-group="$2" node node_modules/@playwright/test/cli.js test "${@:3}"
' offline-tests "$(id -u)" "$(id -g)" "$@"
