# Deployments

Every deployment and upgrade of the Dome Registry is recorded here. This is the source of truth for contract ids; dome-backend and dome-frontend take their configuration from this file. `scripts/deploy.sh` and `scripts/upgrade.sh` print a ready-made row; add it in the same PR as any related change.

**Testnet only.** The registry has not been independently reviewed and must not be deployed to mainnet; the scripts refuse to. Testnet is reset by the network from time to time, which wipes every contract; after a reset, deploy again and add a row.

To check a row, compare the Wasm hash with the code that is live:

```bash
stellar contract fetch --id <CONTRACT_ID> --network testnet -o live.wasm && sha256sum live.wasm
```

## Current

| Network | Contract id | Wasm hash | Version | Admin | Threshold |
|---|---|---|---|---|---|
| Testnet | [`CCHLCPUBLL4ROEFP5PR3JY4LUB32TLNB2KDF3DQLG3R53IK5OUW7TZUY`](https://stellar.expert/explorer/testnet/contract/CCHLCPUBLL4ROEFP5PR3JY4LUB32TLNB2KDF3DQLG3R53IK5OUW7TZUY) | `999b3af531c80f1aceeb0899af9d282105df2a166aeabf72159c23742a6dcc07` | 0.1.0 | `GAKJIOABQXN7VUHMDGE5VCEIKPAS2QDC2PPSCC5WC2DHFIFLHAM6US5X` (single throwaway testnet key) | 2 |

Verified on 2026-10-29 with `stellar contract fetch`: the live Wasm hash matches a `stellar contract build` (CLI 28.1.0) of commit `66d3fdc`.

## History

| Date (UTC) | Network | Contract id | Wasm hash | Commit | Action |
|---|---|---|---|---|---|
| 2026-10-28 | testnet | `CCHLCPUBLL4ROEFP5PR3JY4LUB32TLNB2KDF3DQLG3R53IK5OUW7TZUY` | not recorded | `f2dee33` | deploy, admin `GAKJ…US5X`, threshold 2, seeded with demo data |
| 2026-10-28 | testnet | `CCHLCPUBLL4ROEFP5PR3JY4LUB32TLNB2KDF3DQLG3R53IK5OUW7TZUY` | `999b3af531c80f1aceeb0899af9d282105df2a166aeabf72159c23742a6dcc07` | `8968f4e` | upgrade to the soroban-sdk 29 build (contract source as of `45b9fb9`) |

## Upgrading to 0.2.0

0.2.0 is **not** an in-place upgrade for the 0.1.0 deployment above:

- It adds `CuratorCount` to instance storage. On an upgraded 0.1.0 instance the count would start at 0 while two curators exist, so `set_threshold` would reject every value and `remove_curator` would mis-count.
- It replaces `set_admin` with `transfer_admin` + `accept_admin`.

So 0.2.0 goes out as a **new deployment**: `deploy.sh`, then `init.sh`, then `seed-testnet.sh`. After that, update the *Current* table, add a history row, and point dome-backend and dome-frontend at the new id. The 0.1.0 contract holds only demo data and can be left to expire.

From 0.2.0 on, `make test-wasm` runs an upgrade test (`test/wasm.rs`) that checks roles, config and records survive an upgrade. A future change to storage types must either keep that test passing unchanged or ship a migration.
