# Storage and TTL

Soroban charges rent for every ledger entry. An entry whose time-to-live (TTL) runs out is **archived**, not deleted: it can be restored, and since protocol 23 the RPC adds the restore to a transaction automatically when the transaction touches an archived entry. This file describes where the registry keeps its data and how long entries live. The policy is implemented in [`contracts/registry/src/storage.rs`](../contracts/registry/src/storage.rs) and tested in [`test/ttl.rs`](../contracts/registry/src/test/ttl.rs).

## Storage layout

All keys are variants of the typed `DataKey` enum.

| Key | Storage | Value | Written by |
|---|---|---|---|
| `Admin` | instance | `Address` | constructor, `accept_admin` |
| `PendingAdmin` | instance | `Address` | `transfer_admin` (removed by `accept_admin` / `cancel_admin_transfer`) |
| `Threshold` | instance | `u32` | constructor, `set_threshold` |
| `CuratorCount` | instance | `u32` | `add_curator`, `remove_curator` |
| `Curator(Address)` | persistent | `true` | `add_curator` (removed by `remove_curator`) |
| `Attester(Address)` | persistent | `true` | `add_attester` (removed by `remove_attester`) |
| `AttestCount(repo)` | persistent | `u32` | `attest` |
| `Attest(repo, n)` | persistent | `Attestation` | `attest`, `retract_attestation` |
| `Indicator(hash)` | persistent | `Indicator` | `propose`, `approve`, `retract` |

Instance storage holds only small, fixed-size configuration, because the whole instance is loaded on every call. Everything that grows with use is persistent: one entry per role holder, per attestation and per indicator. Nothing is stored in temporary storage, because nothing in the registry may silently disappear.

## Policy

All values assume ~5-second ledgers (17,280 ledgers per day).

| Constant | Value | Meaning |
|---|---|---|
| `TTL_THRESHOLD` | 30 days (518,400 ledgers) | An extension only does anything once the remaining TTL has dropped below this, so frequent calls don't each pay for a bump. |
| `TTL_EXTEND_TO` | 120 days (2,073,600 ledgers) | Extensions set the TTL back to this. |

### What extends what

| Trigger | Extends |
|---|---|
| Every write (`attest`, `propose`, `approve`, `retract`, `retract_attestation`, role and admin changes, `set_threshold`, `upgrade`) | The instance and contract code, plus every persistent entry the write touches |
| Using a role (`attest`, `propose`, `approve`, `retract`) | The caller's role entry |
| `latest(repo)` | The instance, `AttestCount(repo)` and the newest `Attest(repo, n-1)` |
| `is_known_bad(hash)` when the indicator is **active** | The instance and `Indicator(hash)` |
| `extend_repo(repo)`: anyone, no signature | The instance, `AttestCount(repo)` and the newest attestation |
| `extend_indicator(hash)`: anyone, no signature | The instance and `Indicator(hash)` |

Never extended by reads: `history`, `indicator`, `attestation_count`, `is_known_bad` for proposed or retracted indicators, and older history entries.

**Why reads extend at all.** `latest` and `is_known_bad` are the calls that show an entry is in use. Apps call them through RPC simulation, which commits nothing, so for them the read stays free. Contracts that call them on-chain (for example a wallet guard checking `is_known_bad`) pay a small rent bump, and in return the entries they depend on stay live without anyone running a keeper.

**Why old history may expire.** Old attestations are rarely read. They are archived rather than deleted, and the indexer keeps every event, so nothing is lost.

## Archived entries

- **Reading or writing an archived entry:** simulate the transaction as usual. The RPC detects the archived entry and adds a restore to the transaction; the caller pays the restore fee. No contract function is needed.
- **Restoring on purpose:** `stellar contract restore --id <CONTRACT_ID> --key-xdr <KEY_XDR> --durability persistent --network testnet` restores a specific entry, for example an old attestation someone wants to cite.
- **Role entries:** a curator or attester inactive for 120+ days has an archived role entry. Their next call restores it automatically. `is_curator` and `is_attester` still report the role correctly, because simulation restores the entry.
- **Instance:** every write and every relevant read extends it, so it only expires if the registry is unused for 120 days. Anyone can call `extend_indicator` with any hash to keep it alive.

## Operational guidance

- dome-backend should call `extend_repo` for repositories it still tracks and `extend_indicator` for active indicators, for example monthly. Calls during the first 90 days after an extension are cheap no-ops.
- Changing the constants changes behaviour for every entry. Update this file, `test/ttl.rs` and the events/indexer notes together.
