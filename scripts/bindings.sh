#!/usr/bin/env bash
# Generates the TypeScript client for the registry into bindings/ts and names
# it @dome-security/registry-bindings.
#
#   ./scripts/bindings.sh          regenerate bindings/ts
#   ./scripts/bindings.sh --check  fail if bindings/ts is stale
#
# Bindings are generated from the built Wasm, so no network or contract id
# is needed. Run `stellar contract build` first.

# shellcheck source=scripts/common.sh
source "$(dirname "$0")/common.sh"

require_stellar
[[ -f "$WASM" ]] || die "$WASM not found; run 'stellar contract build' first"

OUT="$ROOT/bindings/ts"
PACKAGE="@dome-security/registry-bindings"

generate() {
  local dir="$1"
  stellar contract bindings typescript --wasm "$WASM" --output-dir "$dir" --overwrite >/dev/null
  # Set the package name and drop any npm lifecycle scripts: consumers must
  # be able to install with --ignore-scripts and lose nothing.
  node -e '
    const fs = require("fs");
    const file = process.argv[1] + "/package.json";
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.name = process.argv[2];
    pkg.license = "Apache-2.0";
    for (const s of ["preinstall", "install", "postinstall", "prepare", "prepublish"]) {
      if (pkg.scripts) delete pkg.scripts[s];
    }
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  ' "$dir" "$PACKAGE"
  # The generated README suggests regenerating in a postinstall hook, which
  # Dome forbids. Replace it with ours.
  cp "$ROOT/scripts/bindings-readme.md" "$dir/README.md"
}

if [[ "${1:-}" == "--check" ]]; then
  [[ -d "$OUT" ]] || die "bindings/ts has not been generated yet; run ./scripts/bindings.sh"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  generate "$tmp"
  if ! diff -r --exclude node_modules --exclude dist "$OUT" "$tmp"; then
    die "bindings/ts is stale; run ./scripts/bindings.sh and commit the result"
  fi
  echo "bindings/ts is up to date"
else
  generate "$OUT"
  echo "generated $PACKAGE in bindings/ts"
fi
