#!/usr/bin/env bash
# Seeds a testnet registry with inert demo data so the frontend and backend
# have something to read:
#   - two curators, which then propose and approve one indicator per file in
#     scripts/fixtures/ (harmless look-alikes that only `echo DOME_FIXTURE`);
#   - one attester, which publishes a `clean` attestation for a demo repo id.
#
#   CONTRACT_ID=C... ADMIN_SOURCE=dome-admin \
#   CURATOR1=dome-curator-1 CURATOR2=dome-curator-2 ATTESTER=dome-attester \
#   ./scripts/seed-testnet.sh
#
# All four values name CLI identities. Indicators use campaign `demo` so they
# can't be mistaken for real ones.

# shellcheck source=scripts/common.sh
source "$(dirname "$0")/common.sh"

require_stellar
require_test_network
for v in CONTRACT_ID ADMIN_SOURCE CURATOR1 CURATOR2 ATTESTER; do require_var "$v"; done

sha() { sha256sum "$1" | cut -d' ' -f1; }
sha_str() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }
addr() { stellar keys address "$1"; }

c1="$(addr "$CURATOR1")"
c2="$(addr "$CURATOR2")"
att="$(addr "$ATTESTER")"

for c in "$c1" "$c2"; do
  [[ "$(invoke "$ADMIN_SOURCE" is_curator --account "$c")" == "true" ]] ||
    invoke "$ADMIN_SOURCE" add_curator --curator "$c"
done
[[ "$(invoke "$ADMIN_SOURCE" is_attester --account "$att")" == "true" ]] ||
  invoke "$ADMIN_SOURCE" add_attester --attester "$att"

evidence="$(sha_str "dome-demo-indicator: inert fixture, not malware")"
declare -A kinds=([demo-tasks.json]=task [demo-settings.json]=config)

for file in "${!kinds[@]}"; do
  hash="$(sha "$ROOT/scripts/fixtures/$file")"
  if [[ "$(invoke "$CURATOR1" indicator --hash "$hash")" != "null" ]]; then
    echo "skip $file: indicator $hash exists"
    continue
  fi
  invoke "$CURATOR1" propose --curator "$c1" \
    --i "{\"hash\":\"$hash\",\"kind\":\"${kinds[$file]}\",\"campaign\":\"demo\",\"evidence\":\"$evidence\"}"
  invoke "$CURATOR2" approve --curator "$c2" --hash "$hash"
  echo "seeded $file -> $hash"
done

repo="$(sha_str "github.com/dome-security/demo-repo")"
commit="$(sha_str "dome-demo-commit" | cut -c1-40)"
invoke "$ATTESTER" attest --attester "$att" \
  --a "{\"repo\":\"$repo\",\"commit\":\"$commit\",\"verdict\":\"clean\",\"scanner\":1,\"rules\":\"$evidence\",\"report\":\"$evidence\"}"
echo "seeded clean attestation for demo repo $repo"
