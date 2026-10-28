#!/usr/bin/env bash
# Generates the TypeScript client for the registry into bindings/ts and names
# it @dome-security/registry-bindings.
#
#   ./scripts/bindings.sh          regenerate bindings/ts
#   ./scripts/bindings.sh --check  fail if bindings/ts is stale
#
# Bindings are generated from the built Wasm, so no network or contract id
# is needed. Run `stellar contract build` first.
#
# The generator is the `stellar-js generate` CLI from @stellar/stellar-sdk,
# pinned in tools/bindgen with a lockfile. It replaces the deprecated
# `stellar contract bindings typescript`. Needs Node 22.12+.

# shellcheck source=scripts/common.sh
source "$(dirname "$0")/common.sh"

[[ -f "$WASM" ]] || die "$WASM not found; run 'stellar contract build' first"
command -v node >/dev/null || die "node not found; Node 22.12+ is needed to generate bindings"

OUT="$ROOT/bindings/ts"
PACKAGE="@dome-security/registry-bindings"
BINDGEN="$ROOT/tools/bindgen"
GENERATOR="$BINDGEN/node_modules/.bin/stellar-js"

# Install the pinned generator from the lockfile. --ignore-scripts: no
# dependency gets to run code at install time.
if [[ ! -x "$GENERATOR" ]]; then
  (cd "$BINDGEN" && npm ci --ignore-scripts --no-audit --no-fund)
fi

generate() {
  local dir="$1"
  "$GENERATOR" generate --wasm "$WASM" --output-dir "$dir" --contract-name dome-registry --overwrite >/dev/null
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
  # Ship our own README, and drop the generated .gitignore: the root
  # .gitignore already covers bindings/ts/node_modules and dist.
  cp "$ROOT/scripts/bindings-readme.md" "$dir/README.md"
  rm -f "$dir/.gitignore"
}

if [[ "${1:-}" == "--check" ]]; then
  [[ -d "$OUT" ]] || die "bindings/ts has not been generated yet; run ./scripts/bindings.sh"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  generate "$tmp/ts"
  if ! diff -r --exclude node_modules --exclude dist "$OUT" "$tmp/ts"; then
    die "bindings/ts is stale; run ./scripts/bindings.sh and commit the result"
  fi
  echo "bindings/ts is up to date"
else
  # Start clean so files the generator no longer writes don't linger.
  rm -rf "$OUT"
  generate "$OUT"
  echo "generated $PACKAGE in bindings/ts"
fi
