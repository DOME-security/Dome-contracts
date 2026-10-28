# @dome-security/registry-bindings

TypeScript client for the Dome Registry contract, generated from the contract spec by `scripts/bindings.sh` in [DOME-security/Dome-contracts](https://github.com/DOME-security/Dome-contracts). **Do not edit by hand.** Regenerate with `make bindings` and commit the result. CI fails if these files are stale.

## Use

```ts
import { Client } from "@dome-security/registry-bindings";

const registry = new Client({
  contractId: "C...", // registry contract id for the network
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
});

// Reads are simulated: no fees, no signature.
const { result: bad } = await registry.is_known_bad({ hash: Buffer.from(sha256Hex, "hex") });
const { result: last } = await registry.latest({ repo: repoIdHash });
if (last && last.retracted_by) {
  // retracted: show the retraction, don't treat the verdict as current
}
```

Writes (`attest`, `propose`, `approve`, `retract`, `retract_attestation`, …) return an `AssembledTransaction` to sign with the role holder's wallet and send.

## Install

Until the package is published to npm, depend on it by path or git URL. Install with `--ignore-scripts`: this package has no install scripts and never needs them. Don't regenerate it in a `postinstall` hook.
