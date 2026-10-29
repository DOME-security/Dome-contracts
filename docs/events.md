# Registry events

Every function that changes state emits at least one event, so dome-backend's indexer (and anyone else) can follow the registry with `getEvents` instead of polling storage. This file is the shared contract with the indexer. Definitions live in [`contracts/registry/src/events.rs`](../contracts/registry/src/events.rs), and every event is asserted in the unit tests.

## Encoding

- **Topics:** the first topic is the event name as a `Symbol` (column *Name*), followed by the fields marked as topics, in the order listed.
- **Data:** a map from field name (`Symbol`) to value, holding the remaining fields.
- Events are only ever **added**. A name, topic order or field is never changed or reused. If a payload must change, a new event name is introduced and the old one is documented as retired here.
- The generated bindings decode these events: `registry.parseEvent(topics, data)`, plus a filter builder per event, for example `registry.activatedEventFilter({ hash })`.

## Roles and configuration

| Name | Emitted by | Topics after name | Data | Meaning |
|---|---|---|---|---|
| `role_granted` | `add_curator`, `add_attester` | `role: Symbol` (`curator` or `attester`), `account: Address` | (empty map) | `account` now holds `role`. |
| `role_revoked` | `remove_curator`, `remove_attester` | `role: Symbol`, `account: Address` | (empty map) | `account` no longer holds `role`. A removed curator's approvals stop counting toward indicators that are still `proposed`. |
| `threshold_changed` | `set_threshold` | — | `threshold: u32` | New M in M-of-N. |
| `admin_proposed` | `transfer_admin` | — | `admin: Address`, `pending: Address` | Step 1 of 2: `admin` offered the role to `pending`. Nothing has changed yet. |
| `admin_cancelled` | `cancel_admin_transfer` | — | `admin: Address`, `pending: Address` | The offer to `pending` was withdrawn. |
| `admin_changed` | `accept_admin` | — | `old: Address`, `new: Address` | Step 2 of 2: `new` is now the admin. |
| `upgraded` | `upgrade` | — | `wasm_hash: BytesN<32>` | The contract code was replaced. Storage and contract id are unchanged. Compare the hash with [deployments.md](deployments.md). |

## Attestations

| Name | Emitted by | Topics after name | Data | Meaning |
|---|---|---|---|---|
| `attest` | `attest` | `repo: BytesN<32>`, `verdict: Symbol` | `commit: Bytes`, `attester: Address`, `index: u32` | New attestation at position `index` of the repo's history. Read it with `history(repo, index, 1)`. |
| `retract_attest` | `retract_attestation` | `repo: BytesN<32>` | `index: u32`, `by: Address`, `reason: BytesN<32>` | Attestation `index` was retracted by its attester or the admin. `reason` is the SHA-256 of the public notice. The entry stays readable. |

## Indicators

| Name | Emitted by | Topics after name | Data | Meaning |
|---|---|---|---|---|
| `propose` | `propose` | `hash: BytesN<32>` | `kind: Symbol`, `campaign: Symbol`, `evidence: BytesN<32>`, `curator: Address` | New proposal; the proposer's approval counts as the first. Also emitted when a **retracted** hash is proposed again, which resets its approvals. |
| `approve` | `approve` | `hash: BytesN<32>` | `curator: Address`, `approvals: u32`, `status: Symbol` | A curator approved. `approvals` counts approvals from current curators; `status` is the status after this approval. |
| `activate` | `approve` | `hash: BytesN<32>` | `approvals: u32` | The indicator just reached the threshold and is now `active` (`is_known_bad` is true). Emitted right after the `approve` event that caused it, at most once per proposal. |
| `retract` | `retract` | `hash: BytesN<32>` | `curator: Address`, `reason: BytesN<32>` | The indicator (proposed or active) is now `retracted`. `reason` is the SHA-256 of the public notice. |

## Not events

`extend_repo`, `extend_indicator` and the TTL extensions done by `latest` and `is_known_bad` change only entry lifetimes, not registry state, and emit nothing. Reads emit nothing.

## Indexer notes

- The indexer should store every event with its ledger and transaction hash. It is the full history if storage entries are archived, and the only record of a retraction that a later re-proposal overwrote.
- To track whether a hash is known bad, apply `activate` → active and `retract` → not active, and reset on `propose`.
- `admin_changed`, `role_*`, `threshold_changed` and `upgraded` are rare and security-relevant: alert on them.
