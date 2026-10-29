#!/usr/bin/env bash
# Grants roles on a freshly deployed registry and optionally raises the
# approval threshold. Safe to re-run: existing roles are skipped.
#
#   CONTRACT_ID=C... ADMIN_SOURCE=dome-admin \
#   CURATORS="G...,G...,G..." ATTESTERS="G..." THRESHOLD=2 \
#   ./scripts/init.sh
#
# ADMIN_SOURCE  CLI identity of the admin (a multisig account signs outside
#               the CLI; then use this script's output as a checklist instead)
# CURATORS      comma-separated curator addresses (optional)
# ATTESTERS     comma-separated attester addresses (optional)
# THRESHOLD     set after curators are added; must be 2..number of curators
#
# Role holders' keys never touch this machine: only their public addresses
# are passed in.

# shellcheck source=scripts/common.sh
source "$(dirname "$0")/common.sh"

require_stellar
require_test_network
require_var CONTRACT_ID
require_var ADMIN_SOURCE
require_safe_identity "$ADMIN_SOURCE"

grant() {
  local role="$1" list="$2" addr
  IFS=',' read -ra addrs <<<"$list"
  for addr in "${addrs[@]}"; do
    addr="${addr//[[:space:]]/}"
    [[ -n "$addr" ]] || continue
    [[ "$addr" =~ ^[GC][A-Z2-7]{55}$ ]] || die "not a Stellar address: $addr"
    if [[ "$(invoke "$ADMIN_SOURCE" "is_$role" --account "$addr")" == "true" ]]; then
      echo "skip $role $addr: already granted"
    else
      invoke "$ADMIN_SOURCE" "add_$role" "--$role" "$addr"
      echo "granted $role to $addr"
    fi
  done
}

grant curator "${CURATORS:-}"
grant attester "${ATTESTERS:-}"

if [[ -n "${THRESHOLD:-}" ]]; then
  if [[ "$(invoke "$ADMIN_SOURCE" threshold)" == "$THRESHOLD" ]]; then
    echo "threshold already $THRESHOLD"
  else
    invoke "$ADMIN_SOURCE" set_threshold --threshold "$THRESHOLD"
    echo "threshold set to $THRESHOLD"
  fi
fi

echo "curators: $(invoke "$ADMIN_SOURCE" curator_count), threshold: $(invoke "$ADMIN_SOURCE" threshold)"
