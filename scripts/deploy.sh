#!/usr/bin/env bash
# Deploys a new Dome Registry and prints its contract id.
#
#   SOURCE=dome-dev ADMIN=G... THRESHOLD=2 ./scripts/deploy.sh
#
# SOURCE  CLI identity that pays for the deploy
# ADMIN   admin address; use a multisig account outside local testing
# THRESHOLD curator approvals needed to activate an indicator (min 2)
#
# Setup happens in the constructor, in the same transaction as the deploy,
# so initialization can't be front-run. Roles are added afterwards with
# scripts/init.sh.

# shellcheck source=scripts/common.sh
source "$(dirname "$0")/common.sh"

require_stellar
require_test_network
require_var SOURCE
require_var ADMIN
# SOURCE comes from the environment and is checked by require_var above.
# shellcheck disable=SC2153
source_id="$SOURCE"
THRESHOLD="${THRESHOLD:-2}"

require_safe_identity "$source_id"

ensure_wasm
id="$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$source_id" \
  --network "$NETWORK" \
  -- \
  --admin "$ADMIN" \
  --threshold "$THRESHOLD")"

# The contract id goes to stdout so callers can capture it; the record for
# docs/deployments.md goes to stderr.
echo "$id"
{
  echo
  echo "Record this deployment in docs/deployments.md:"
  echo "| $(date -u +%Y-%m-%d) | $NETWORK | \`$id\` | \`$(wasm_hash)\` | \`$(git -C "$ROOT" rev-parse --short HEAD)\` | deploy, admin \`$ADMIN\`, threshold $THRESHOLD |"
  echo "Next: add curators and attesters with ./scripts/init.sh"
} >&2
