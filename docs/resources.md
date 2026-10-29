# Resource budgets

The registry must stay cheap to call and well inside network limits. The budgets below are enforced by [`contracts/registry/src/test/wasm.rs`](../contracts/registry/src/test/wasm.rs) against the real contract Wasm (`make test-wasm`, and CI on every PR). A PR that needs more must raise the budget in both places and explain why.

## Wasm size

| | Bytes |
|---|---|
| Network limit (max contract size) | 65,536 |
| **Budget** | **32,768** |
| v0.2.0 (`stellar contract build`, CLI 28.1.0) | 23,058 |

## Per-call budgets

Measured with `soroban-sdk` 29 testutils on the Wasm, in a registry with two curators and one attester, unless noted. Measurements carry about 1.5× headroom. Mainnet limits at the time of writing are 100,000,000 instructions and 100 read entries per transaction.

| Call | Measured CPU instructions | CPU budget | Measured memory (bytes) | Memory budget | Read entries (budget) |
|---|---|---|---|---|---|
| `attest` | 654,661 | 1,000,000 | 1,260,404 | 1,900,000 | 7 (8) |
| `latest` | 575,274 | 900,000 | 1,247,949 | 1,900,000 | 4 (4) |
| `propose` | 605,877 | 1,000,000 | 1,256,415 | 1,900,000 | 6 (7) |
| `approve` (2nd approval, activates) | 707,536 | 1,100,000 | 1,261,341 | 1,900,000 | 7 (8) |
| `approve` (10th approval) | 992,232 | 1,600,000 | 1,314,834 | 2,000,000 | 15 (16) |
| `is_known_bad` | 530,262 | 800,000 | 1,244,578 | 1,900,000 | 3 (3) |
| `history`, full page of 50 | 3,873,217 | 6,000,000 | 1,466,813 | 2,200,000 | 53 (53) |
| `retract` | 694,814 | 1,100,000 | 1,284,710 | 1,900,000 | 6 (7) |

## What grows

- **`history`** is capped at 50 entries per call (`MAX_PAGE`), which keeps it at about half the read-entry limit. Don't raise the cap without re-measuring.
- **`approve`** checks every earlier approver's role, so its cost grows by about one read entry and ~35k instructions per approval. Approvals are bounded by the number of distinct curators ever added, a small, admin-controlled set.
- Everything else is constant-size.

Testutils numbers leave out some production costs, such as transaction size and XDR round trips. Treat them as a regression guard, not a fee quote; use `stellar contract invoke --send=no` (or RPC `simulateTransaction`) for real fees.
