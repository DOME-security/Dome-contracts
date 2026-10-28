# Shared helpers for the deploy scripts. Source it, don't run it.
#
# Every script talks to the network through the Stellar CLI and signs with a
# named CLI identity. Create identities with --secure-store so the secret key
# lives in the OS keychain, not in ~/.config/stellar/identity/.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM="$ROOT/target/wasm32v1-none/release/dome_registry.wasm"
NETWORK="${NETWORK:-testnet}"

die() {
  echo "error: $*" >&2
  exit 1
}

require_stellar() {
  command -v stellar >/dev/null || die "stellar CLI not found: https://developers.stellar.org/docs/tools/cli/stellar-cli"
}

# The registry stays off mainnet until it has been independently reviewed.
require_test_network() {
  case "$NETWORK" in
    testnet | futurenet | local) ;;
    *) die "NETWORK=$NETWORK is not allowed; the registry is testnet-only until reviewed" ;;
  esac
}

require_var() {
  [[ -n "${!1:-}" ]] || die "$1 is not set"
}

ensure_wasm() {
  if [[ ! -f "$WASM" ]]; then
    (cd "$ROOT" && stellar contract build)
  fi
}

# invoke <source-identity> <fn> [args...]
invoke() {
  local source="$1"
  shift
  stellar contract invoke --id "$CONTRACT_ID" --source-account "$source" --network "$NETWORK" -- "$@"
}
