#!/bin/sh
# Builds the Windows installer of the desktop streaming app on Linux/macOS (no Windows machine, no wine needed) and
# publishes it for the website's download page:
#   STREAMER_SERVER_URL=https://aya.ornek.com ./scripts/build-streamer.sh
# Needs: node/npm and makensis (apt install nsis). Output: storage/downloads/ (+ streamer.json with version and SHA-256).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${STREAMER_DIR:-$ROOT/storage/downloads}"
SERVER="${STREAMER_SERVER_URL:?set STREAMER_SERVER_URL, e.g. https://aya.ornek.com (https is required except for localhost)}"
MIN_VERSION="${STREAMER_MIN_VERSION:-}"
command -v makensis >/dev/null 2>&1 || { echo "makensis not found (apt install nsis)"; exit 1; }

cd "$ROOT/streamer"
[ -d node_modules ] || npm install --no-audit --no-fund
printf '{ "serverUrl": "%s" }\n' "$SERVER" > app-config.json
VERSION="$(node -p "require('./package.json').version")"
rm -rf dist
npx electron-builder --win dir --x64
FILE="AYA-Yayin-Studyosu-Kurulum-$VERSION.exe"
makensis -V2 -DVERSION="$VERSION" -DOUTFILE="dist/$FILE" installer.nsi

mkdir -p "$OUT"
cp "dist/$FILE" "$OUT/$FILE"
SHA="$(sha256sum "$OUT/$FILE" | cut -d' ' -f1)"
node -e '
const fs=require("fs");
const [out,file,version,sha,min]=process.argv.slice(1);
fs.writeFileSync(out+"/streamer.json", JSON.stringify({version,file,sha256:sha,builtAt:new Date().toISOString(),...(min?{minVersion:min}:{})},null,2));
' "$OUT" "$FILE" "$VERSION" "$SHA" "$MIN_VERSION"
echo "published $OUT/$FILE ($VERSION)"
echo "sha256 $SHA"
