# Dome Registry threat model

Status: draft for registry 0.2.0 (`contracts/registry`). It is input for the independent review that must happen before mainnet, not a replacement for it.

## What we protect

| Asset | Why it matters |
|---|---|
| Integrity of `active` indicators | Scanners and wallets block files whose hash is `active`. A poisoned entry blocks legitimate files; a missing one lets malware through. |
| Integrity of attestations | Ecosystem directories and Wave programs read `latest` to decide whether a repo looks safe. |
| Role keys (admin, curators, attesters) | Every write is authorized by one of these. |
| Maintainers' reputation | A public `block` is permanent. See [publication-policy.md](publication-policy.md). |

## Trust assumptions

- Stellar consensus and the Soroban host enforce `require_auth`, including nonces and replay protection.
- The admin is a multisig account, never a single key.
- Curators are independent people with separate keys and devices.
- Off-chain reports and advisories referenced by hash (`report`, `evidence`, `reason`) are published somewhere public and stable.

## Threats and mitigations

### Compromised curator key

*Attack:* the attacker proposes the hash of a popular legitimate file and tries to make it `active` (fail closed), or retracts real indicators (fail open).

*Mitigations in the contract:*
- An indicator becomes `active` only when approvals from **current**, distinct curators reach the threshold, which cannot be below 2. The proposer counts as one approval and can't approve twice, so one key can't activate anything. A property test (`test/props.rs`) checks this over random operation sequences.
- When the admin removes a curator, their approvals stop counting toward any indicator that is still `proposed`.
- A retracted hash can be **proposed again** through the normal M-of-N process, so a rogue retraction can be undone and no hash can be burned for good.
- Every proposal, approval, activation and retraction is an event that names the curator, so the indexer can alert on unusual activity.

*Response:* the admin removes the curator. If that would take the curator set below the threshold (`CuratorsBelowThreshold`), the admin adds a replacement first, then removes. Indicators the attacker retracted are proposed again; ones they pushed through are retracted.

*Residual risk:*
- An indicator that is already `active` stays `active` after an approver is removed. Another curator must `retract` it.
- Any single curator can `retract`, so a compromised key can remove protection until the hash is re-approved, but only visibly. We accept this because failing open is easier to recover from than failing closed against legitimate files. M-of-N retraction of `active` indicators is on the roadmap.
- Re-proposing a retracted hash overwrites the stored retraction (who retracted it and why). The `retract` event keeps it, so the indexer remains the full record.

### Compromised attester key

*Attack:* publish `clean` for an infected repo, or `block` for a healthy one.

*Mitigations:* only addresses the admin added can attest; every attestation records its attester; history is append-only, so later correct attestations don't hide bad ones; the admin can remove the attester at once and `retract_attestation` its false attestations, which stay visible with the admin as `retracted_by`. A removed attester can no longer retract its own entries.

*Residual risk:* `latest` returns the newest attestation even when it is retracted. Readers must check `retracted_by`, and should treat `latest` as one attester's claim and show who signed it.

### Spam attestations

*Attack:* a compromised or buggy attester writes thousands of attestations, to bury a real result in `history` or to grow storage.

*Mitigations:* only admin-approved attesters can write, and each write costs them fees and rent. `latest` is a single lookup, so spam can't hide the newest result, only push it down by publishing newer ones, which are all attributed. `history` pages are capped at 50 entries. The admin removes the attester and retracts the spam.

*Residual risk:* no per-attester rate limit (out of scope for v1). The indexer should alert on bursts.

### Storage griefing

*Attack:* force the contract or its users to pay for large or unbounded storage, or make a call too expensive to run.

*Mitigations:*
- Instance storage holds only four fixed-size values (admin, pending admin, threshold, curator count), so instance load cost stays constant.
- Everything that grows is in separate persistent entries keyed by repo, index or hash, and only role holders can create them. Inputs are fixed-size hashes, except `commit` (20 or 32 bytes) and short symbols.
- The only loops are `history` (at most 50) and the approval count in `approve` (bounded by distinct curators, an admin-controlled set). Both have budgets enforced in tests ([resources.md](resources.md)).
- `extend_repo` / `extend_indicator` need no signature but only extend existing entries, at the caller's expense.

*Residual risk:* `latest` and `is_known_bad` extend TTLs when called on-chain, at the caller's expense. That is by design; see [ttl.md](ttl.md).

### Front-running

- **Initialization:** setup runs in the constructor at deploy time, so there is no window in which someone else can call `init` first.
- **Admin handover:** `transfer_admin` names the new admin, and only that address can `accept_admin`. An observer can't take the role. The admin can `cancel_admin_transfer` at any time before acceptance.
- **Proposals:** a curator who sees another curator's `propose` in the mempool could submit the same hash first with different `kind`, `campaign` or `evidence`. Only curators can do this, it is attributed, and the fix is `retract` plus a new proposal.
- **Approvals:** `approve(curator, hash)` approves whatever is stored under `hash` when it lands. If a hash is retracted and re-proposed with different evidence while an approval is in flight, the approval applies to the new proposal. This takes two curator actions in a short window and is visible in events. Clients should use short signature expirations, and binding approvals to the proposal's content is listed as a follow-up.

### Compromised or careless admin

*Attack:* add hostile curators, lower the threshold to 2, retract honest attestations, or upgrade the contract to new logic.

*Mitigations:* the admin is a multisig account; the admin role changes hands only through `transfer_admin` + `accept_admin`, so it can't be sent to an address nobody controls; every admin action, including `upgrade`, emits an event, and the indexer should alert on all of them. The threshold can't exceed the curator count, so the admin can't silently freeze indicator activation.

### Admin key loss

*Risk:* if the admin can no longer sign, nobody can add or remove roles, change the threshold, retract attestations as admin, or upgrade. Existing data and curator and attester operations keep working.

*Mitigations:* the admin is a multisig account with more signers than its signing threshold (for example 2-of-3 with keys held by different people on hardware wallets), so losing one key loses nothing. Signer rotation happens on the Stellar account itself, without touching the contract. The two-step transfer means a typo'd or uncontrolled address can never become admin.

*Residual risk:* losing enough multisig signers to fall below the account's threshold is unrecoverable for this contract instance. The fallback is a new deployment, with the indexer's event history as the record of what was there.

### Upgrade abuse

*Attack:* the admin (or whoever controls it) replaces the code with logic that, for example, marks arbitrary hashes as known bad or rewrites history.

*Mitigations:* `upgrade` needs the admin multisig; it emits `upgraded` with the new Wasm hash; every intended deployment and upgrade is recorded with its hash in [deployments.md](deployments.md), so anyone can compare `stellar contract fetch` output with a reproducible build of the listed commit. The upgrade test checks that a legitimate upgrade keeps all data and roles.

*Residual risk:* `upgrade` can still replace all logic immediately. An upgrade timelock (or a guardian that can veto during a delay) is on the roadmap for discussion in the independent review.

### Archival (TTL)

Soroban entries that are not extended get archived. Archived entries are not lost: the network restores them on the next access. Every write extends what it touches to 120 days, `latest` and `is_known_bad` extend the entries in use, and anyone can call `extend_repo` or `extend_indicator`. The indexer keeps a full copy of all events, so history can be rebuilt even if an entry stays archived. Details in [ttl.md](ttl.md).

### Key theft from developer machines

The malware Dome defends against targets developer machines, including `~/.config/stellar/identity/`, where the Stellar CLI keeps plaintext keys by default. Role holders must create identities with `--secure-store` or use a hardware wallet, and must never keep a role key on a machine where they open untrusted repositories. CI holds no keys: it only builds, tests and generates bindings.

### Privacy

The registry stores only hashes, short codes, addresses and timestamps. Repository ids are hashed for fixed length, **not** for secrecy: anyone can hash `github.com/owner/repo` and look it up. That is why private repositories are never written, even hashed.

## Out of scope for v1

- Verifying that an attester actually ran the scan (planned with self-attestation, M6).
- On-chain ownership proofs for repositories.
- Rate limits per role holder.
