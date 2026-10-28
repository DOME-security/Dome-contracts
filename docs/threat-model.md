# Dome Registry threat model

Status: draft for the v1 contract (`contracts/registry`). It is input for the independent review that must happen before mainnet, not a replacement for it.

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

*Attack:* the attacker proposes a hash of a popular legitimate file and tries to get it marked `active`.

*Mitigations in the contract:*
- An indicator becomes `active` only when approvals from **current** curators reach the threshold, which cannot be set below 2. One key cannot activate anything alone, and the proposer cannot approve twice.
- When the admin removes a curator, that curator's approvals stop counting toward any indicator that is still `proposed`.
- Every proposal and approval is an event with the curator's address, so the backend indexer can alert on unusual activity.

*Residual risk:*
- An indicator that is already `active` stays `active` after an approver is removed. Another curator must `retract` it.
- Any single curator can `retract`. A compromised key can therefore remove protection, but only visibly: the retraction records who did it, and nothing is deleted. We accept this because failing open is easier to recover from than failing closed against legitimate files. Requiring M-of-N for retracting `active` indicators is on the roadmap.

### Compromised attester key

*Attack:* publish `clean` for an infected repo, or `block` for a healthy one.

*Mitigations:* only addresses the admin added can attest; every attestation records its attester; history is append-only, so later correct attestations don't hide the bad ones; the admin can remove the attester at once and `retract_attestation` its false attestations, which stay visible with the admin as `retracted_by`. A removed attester can no longer retract its own entries.

*Residual risk:* `latest` returns the newest attestation even when it is retracted. Readers must check `retracted_by`, and should treat `latest` as one attester's claim and show who signed it.

### Compromised or careless admin

*Attack:* add hostile curators, lower the threshold to 2, or upgrade the contract to new logic.

*Mitigations:* the admin is a multisig account; `set_admin` needs both the old and the new admin to sign, so the role can't be sent to an address nobody controls; every admin action, including `upgrade`, emits an event.

*Residual risk:* `upgrade` can replace all logic. A timelock or a second contract that limits upgrades is a candidate for the review.

### Initialization front-running

Setup runs in the constructor at deploy time, so there is no window where someone else can call `init` first.

### Spam and storage growth

Only role holders can write, and they pay the fees. `history` returns at most 50 entries per call. An indicator's `approvals` list is bounded by the number of curators because duplicates are rejected.

### Key theft from developer machines

The malware Dome defends against targets developer machines, including `~/.config/stellar/identity/`, where the Stellar CLI keeps plaintext keys by default. Role holders must create identities with `--secure-store` or use a hardware wallet, and must never keep a role key on a machine where they open untrusted repositories. CI holds no keys: it only builds, tests and generates bindings.

### Archival (TTL)

Soroban entries that are not extended get archived. Archived entries are not lost: the network restores them on the next access. Every write extends what it touches to 120 days, and anyone can call `extend_repo` or `extend_indicator`. The backend indexer keeps a full copy of all events, so history can be rebuilt even if an entry stays archived.

### Privacy

The registry stores only hashes, short codes, addresses and timestamps. Repository ids are hashed for fixed length, **not** for secrecy: anyone can hash `github.com/owner/repo` and look it up. That is why private repositories are never written, even hashed.

## Out of scope for v1

- Verifying that an attester actually ran the scan (planned with self-attestation, M6).
- On-chain ownership proofs for repositories.
- Rate limits per role holder.
