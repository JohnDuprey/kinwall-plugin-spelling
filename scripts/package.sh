#!/bin/sh
# Builds kinwall-plugin.zip: what Kinwall installs. kinwall-plugin.json must be at the top level.
# Usage: scripts/package.sh [folder]   (default: this repo; pass your build output, e.g. dist, if you bundle)
set -eu
DIR="${1:-.}"
OUT="$(pwd)/kinwall-plugin.zip"
cd "$DIR"
[ -f kinwall-plugin.json ] || { echo "No kinwall-plugin.json in $DIR" >&2; exit 1; }
entry=$(sed -n 's/.*"entry"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' kinwall-plugin.json)
[ -f "${entry:-index.html}" ] || { echo "The entry page ${entry:-index.html} is missing" >&2; exit 1; }
# Kinwall refuses a manifest over its limits; catch the common one here rather than at install.
if command -v node >/dev/null; then
  node -e 'const m=require("./kinwall-plugin.json"); const n=(m.description||"").trim().length; if (n>300) { console.error("description is "+n+" characters; the limit is 300"); process.exit(1) }' || exit 1
fi
rm -f "$OUT"
# Everything except repo and tooling files. Kinwall ignores file types it doesn't serve anyway.
zip -q -r "$OUT" . -x '.*' -x '*/.*' -x 'dev/*' -x 'scripts/*' -x 'node_modules/*' -x 'test/*' -x '*.md' -x 'LICENSE' -x 'kinwall-plugin.zip'
size=$(wc -c < "$OUT" | tr -d ' ')
[ "$size" -le 5242880 ] || { echo "kinwall-plugin.zip is $size bytes; the limit is 5 MB" >&2; exit 1; }
echo "Built kinwall-plugin.zip ($size bytes):"
unzip -Z1 "$OUT" | sed 's/^/  /'
