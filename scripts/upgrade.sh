#!/usr/bin/env bash
# Uploads freshly built Wasm and switches an existing registry to it.
# Storage and the contract id are kept.
#
#   CONTRACT_ID=C... ADMIN_SOURCE=dome-admin ./scripts/upgrade.sh

# shellcheck source=scripts/common.sh
source "$(dirname "$0")/common.sh"

require_stellar
require_test_network
require_var CONTRACT_ID
require_var ADMIN_SOURCE

(cd "$ROOT" && stellar contract build)
hash="$(stellar contract upload --wasm "$WASM" --source-account "$ADMIN_SOURCE" --network "$NETWORK")"
echo "uploaded wasm $hash"
invoke "$ADMIN_SOURCE" upgrade --wasm_hash "$hash"
