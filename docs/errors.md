# Registry error codes

Contract functions return these codes as `Error(Contract, #n)`. They are part of the public interface, shared with dome-backend and dome-frontend through the generated bindings (`Errors` in `bindings/ts/src/types.ts`). Definitions live in [`contracts/registry/src/errors.rs`](../contracts/registry/src/errors.rs).

**Codes are append-only:** a code is never renumbered, reused or given a new meaning. A new error gets the next free number and a row here in the same PR.

Missing or wrong signatures are not in this table. `require_auth` failures are host errors (`Error(Auth, …)`), not contract errors.

| Code | Name | Returned by | When |
|---|---|---|---|
| 1 | `InvalidThreshold` | `__constructor`, `set_threshold` | Threshold is below 2. |
| 2 | `RoleAlreadyGranted` | `add_curator`, `add_attester` | The address already holds the role. |
| 3 | `RoleNotGranted` | `remove_curator`, `remove_attester` | The address does not hold the role. |
| 4 | `NotAttester` | `attest` | The signer is not a registered attester. |
| 5 | `InvalidVerdict` | `attest` | Verdict is not `clean`, `review`, `block` or `unreadable`. |
| 6 | `InvalidCommit` | `attest` | Commit id is not 20 (SHA-1) or 32 (SHA-256) raw bytes. |
| 7 | `InvalidScanner` | `attest` | Scanner version is 0. |
| 8 | `InvalidLimit` | `history` | `limit` is 0 or above 50. |
| 9 | `NotCurator` | `propose`, `approve`, `retract` | The signer is not a registered curator. |
| 10 | `InvalidKind` | `propose` | Kind is not `task`, `font`, `config`, `script` or `package`. |
| 11 | `IndicatorExists` | `propose` | A `proposed` or `active` indicator with this hash exists. (A `retracted` one can be proposed again.) |
| 12 | `IndicatorNotFound` | `approve`, `retract` | No indicator with this hash. |
| 13 | `AlreadyApproved` | `approve` | This curator already approved (the proposer counts as having approved). |
| 14 | `IndicatorRetracted` | `approve`, `retract` | The indicator is retracted. |
| 15 | `AttestationNotFound` | `retract_attestation` | No attestation at this index for this repo. |
| 16 | `AttestationRetracted` | `retract_attestation` | The attestation is already retracted. |
| 17 | `NotAllowedToRetract` | `retract_attestation` | The signer is neither the admin nor the original attester still holding the attester role. |
| 18 | `ThresholdAboveCurators` | `set_threshold` | Threshold is above the current number of curators, so nothing could activate. |
| 19 | `CuratorsBelowThreshold` | `remove_curator` | Removing this curator would leave fewer curators than the threshold. Add the replacement first. |
| 20 | `NoPendingAdmin` | `accept_admin`, `cancel_admin_transfer` | No admin transfer is pending. |

## Suggested UI messages

| Code | Message |
|---|---|
| 4, 9 | "This account is not a registered attester/curator." |
| 11 | "This hash is already proposed or active." |
| 13 | "You have already approved this indicator." |
| 14, 16 | "This entry was retracted and can't change." |
| 19 | "Add another curator before removing this one." |
