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
rm -f "$OUT"
# Everything except repo and tooling files. Kinwall ignores file types it doesn't serve anyway.
zip -q -r "$OUT" . -x '.*' -x '*/.*' -x 'dev/*' -x 'scripts/*' -x 'node_modules/*' -x 'test/*' -x '*.md' -x 'LICENSE' -x 'kinwall-plugin.zip'
size=$(wc -c < "$OUT" | tr -d ' ')
[ "$size" -le 5242880 ] || { echo "kinwall-plugin.zip is $size bytes; the limit is 5 MB" >&2; exit 1; }
echo "Built kinwall-plugin.zip ($size bytes):"
unzip -Z1 "$OUT" | sed 's/^/  /'
