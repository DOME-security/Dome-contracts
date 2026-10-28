#!/usr/bin/env bash
# Deploys a new Dome Registry and prints its contract id.
#
#   SOURCE=dome-dev ADMIN=G... THRESHOLD=2 ./scripts/deploy.sh
#
# SOURCE  CLI identity that pays for the deploy
# ADMIN   admin address; use a multisig account outside local testing
# THRESHOLD curator approvals needed to activate an indicator (min 2)

# shellcheck source=scripts/common.sh
source "$(dirname "$0")/common.sh"

require_stellar
require_test_network
require_var SOURCE
require_var ADMIN
THRESHOLD="${THRESHOLD:-2}"

ensure_wasm
# SOURCE comes from the environment and is checked by require_var above.
# shellcheck disable=SC2153
stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$SOURCE" \
  --network "$NETWORK" \
  -- \
  --admin "$ADMIN" \
  --threshold "$THRESHOLD"
