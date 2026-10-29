# shellcheck shell=bash
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

# require_safe_identity <name>: the value must name a CLI identity whose
# secret is not stored in plaintext. Raw secret keys and seed phrases are
# refused outright, since they would end up in shell history and process
# lists. Nothing from the identity file is ever printed.
# Set ALLOW_PLAINTEXT_IDENTITY=1 to accept a plaintext identity on a
# throwaway local network.
require_safe_identity() {
  local name="$1"
  if [[ "$name" =~ ^S[A-Z2-7]{55}$ || "$name" == *" "* ]]; then
    die "pass a CLI identity name, not a secret key or seed phrase"
  fi
  local dir
  for dir in "${XDG_CONFIG_HOME:-$HOME/.config}/stellar/identity" "$ROOT/.stellar/identity"; do
    local file="$dir/$name.toml"
    if [[ -f "$file" ]] && grep -qE '^[[:space:]]*(secret_key|seed_phrase)[[:space:]]*=' "$file"; then
      [[ "${ALLOW_PLAINTEXT_IDENTITY:-}" == "1" ]] && return 0
      die "identity '$name' keeps its secret in plaintext ($file); recreate it with 'stellar keys generate $name --secure-store' or set ALLOW_PLAINTEXT_IDENTITY=1 for a throwaway local key"
    fi
  done
}

# wasm_hash: SHA-256 of the built Wasm, which is also its on-chain hash.
wasm_hash() {
  sha256sum "$WASM" | cut -d' ' -f1
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
