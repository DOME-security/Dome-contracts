#!/usr/bin/env bash
# Uploads freshly built Wasm and switches an existing registry to it.
# Storage and the contract id are kept. Run the upgrade test first
# (make test-wasm) and check docs/deployments.md for storage changes that
# need a fresh deployment instead.
#
#   CONTRACT_ID=C... ADMIN_SOURCE=dome-admin ./scripts/upgrade.sh

# shellcheck source=scripts/common.sh
source "$(dirname "$0")/common.sh"

require_stellar
require_test_network
require_var CONTRACT_ID
require_var ADMIN_SOURCE

require_safe_identity "$ADMIN_SOURCE"

(cd "$ROOT" && stellar contract build)
hash="$(stellar contract upload --wasm "$WASM" --source-account "$ADMIN_SOURCE" --network "$NETWORK")"
echo "uploaded wasm $hash"
invoke "$ADMIN_SOURCE" upgrade --wasm_hash "$hash"
{
  echo
  echo "Record this upgrade in docs/deployments.md:"
  echo "| $(date -u +%Y-%m-%d) | $NETWORK | \`$CONTRACT_ID\` | \`$hash\` | \`$(git -C "$ROOT" rev-parse --short HEAD)\` | upgrade |"
} >&2
