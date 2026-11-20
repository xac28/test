#!/usr/bin/env bash
# Starts a local LiveKit server (the video part of AYA) on Linux/macOS for development and for the browser tests.
#   scripts/livekit-linux.sh          → uses ./bin/livekit-server, /opt/livekit/livekit-server or `livekit-server` from PATH;
#                                       builds it with Go (1.22+) when none exists
# Keys are the development pair from .env (LIVEKIT_API_KEY / LIVEKIT_API_SECRET, default devkey / secret); the server listens on :7880.
# In production use docker compose (see docker-compose.yml) with your own keys and a public wss:// address.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${LIVEKIT_VERSION:-v1.13.9}"
BIN=""
for c in ./bin/livekit-server /opt/livekit/livekit-server "$(command -v livekit-server || true)"; do
  [ -n "$c" ] && [ -x "$c" ] && BIN="$c" && break
done
if [ -z "$BIN" ]; then
  command -v go >/dev/null || { echo "No livekit-server binary and no Go toolchain. Install one of them (https://docs.livekit.io/home/self-hosting/local/)." >&2; exit 1; }
  echo "Building livekit-server $VERSION with Go (a few minutes the first time)…"
  mkdir -p bin
  DIR="$(go mod download -json "github.com/livekit/livekit-server@$VERSION" | sed -n 's/.*"Dir": "\(.*\)",/\1/p')"
  TMP="$(mktemp -d)"; cp -r "$DIR/." "$TMP"; chmod -R u+w "$TMP"
  (cd "$TMP" && go build -o "$OLDPWD/bin/livekit-server" ./cmd/server)
  rm -rf "$TMP"
  BIN=./bin/livekit-server
fi
KEY="${LIVEKIT_API_KEY:-devkey}"; SECRET="${LIVEKIT_API_SECRET:-secret}"
echo "Starting $($BIN --version) on :7880 (key $KEY)"
exec "$BIN" --bind 0.0.0.0 --keys "$KEY: $SECRET"
