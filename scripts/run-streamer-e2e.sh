#!/usr/bin/env bash
# Runs the desktop-app e2e on a headless Linux box: virtual display + a throw-away secret service for safeStorage.
set -euo pipefail
cd "$(dirname "$0")/.."
exec dbus-run-session -- bash -c 'echo "" | gnome-keyring-daemon --unlock --components=secrets >/dev/null; AYA_STREAMER_E2E=1 exec xvfb-run -a npx playwright test tests/e2e/streamer-app.spec.ts "$@"' _ "$@"
