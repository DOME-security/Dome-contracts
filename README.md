# dome-contracts

**Public, tamper-evident security signals for open source, on Stellar.**

dome-contracts holds the Dome Registry, a Soroban smart contract that records two things anyone can check without an API key or a trusted server: **scan attestations** (what the last Dome scan said about a commit of a public repository) and **indicators** (SHA-256 fingerprints of files confirmed as malicious). Wallets, ecosystem directories, Wave programs and individual developers can all ask the same question and get the same answer: *has this file been seen in an attack, and what did the last scan of this repo say?*

Part of the Dome Security org, alongside [dome-backend](https://github.com/DOME-security/Dome-backend) and [dome-frontend](https://github.com/DOME-security/Dome-frontend). Dome protects open-source projects from auto-run malware and is built for the Stellar Wave Program on Drips.

---

## What it does

- **Scan attestations:** attesters publish signed results of a scan of one commit (`clean`, `review`, `block` or `unreadable`), together with the scanner version, a hash of the rule set used, and a hash of the full off-chain report. History is append-only: `latest` returns the newest result and `history` pages through all of them.
- **Malicious-file indicators:** curators propose SHA-256 fingerprints of malicious files (`task`, `font`, `config`, `script` or `package`). An indicator turns `active` only after **M-of-N curator approvals** (M ≥ 2), so one compromised curator key cannot poison the list. `is_known_bad(hash)` is the one-call check for other contracts and apps.
- **Visible retractions:** any curator can retract an indicator, and an attestation can be retracted by its attester or the admin. The entry stays readable with who retracted it and a hash of the public reason, so mistakes stay visible instead of disappearing.
- **Events for every write:** `attest`, `retract_attest`, `propose`, `approve`, `retract`, `role_granted`, `role_revoked`, `admin_changed`, `threshold_changed` and `upgraded`, so the backend indexer can follow the registry without polling storage.
- **TTL management:** writes extend the entries they touch to 120 days, and anyone can pay to keep a repo's newest attestation or an indicator alive with `extend_repo` / `extend_indicator`.
- **Optional by design:** the Dome CLI and GitHub Action work fully offline. The registry adds shared, verifiable history on top, at the cost of network fees and a funded account for writers.
- **No personal data:** only hashes, short codes, addresses and timestamps. See [`docs/publication-policy.md`](docs/publication-policy.md).

## Status

Pre-alpha, **testnet only** until the contract has been independently reviewed. The contract core, indicator flow and attestation retraction are implemented and covered by 49 unit tests, including the allowed and rejected path of every `require_auth`. The deploy scripts refuse any network other than testnet, futurenet or local. The generated TypeScript bindings are committed, and the registry is live on testnet. See [Roadmap](#roadmap).

| Network | Contract id | Admin | Threshold |
|---|---|---|---|
| Testnet | [`CCHLCPUBLL4ROEFP5PR3JY4LUB32TLNB2KDF3DQLG3R53IK5OUW7TZUY`](https://stellar.expert/explorer/testnet/contract/CCHLCPUBLL4ROEFP5PR3JY4LUB32TLNB2KDF3DQLG3R53IK5OUW7TZUY) | `GAKJ…US5X` (single throwaway testnet key; mainnet will use a multisig) | 2 |

The testnet registry is seeded by `scripts/seed-testnet.sh` with two curators, one attester, two `active` demo indicators (hashes of the inert files in `scripts/fixtures/`, campaign `demo`) and one `clean` attestation for the demo repo id `github.com/dome-security/demo-repo`. Testnet is periodically reset by the network, so the id may change; this table is the source of truth.

## Architecture

```
contracts/
└── registry/         Dome Registry contract (Rust, soroban-sdk 29)
    └── src/
        ├── lib.rs        Contract entry points: roles, attestations, indicators, TTL
        ├── types.rs      Attestation, Indicator and their input types
        ├── storage.rs    Storage keys, TTL policy, role helpers
        ├── events.rs     #[contractevent] definitions
        ├── errors.rs     Error codes (stable, append-only)
        └── test/         soroban-sdk testutils suites: roles, attestations, indicators, ttl

bindings/
└── ts/               Generated TypeScript client (@dome-security/registry-bindings), checked for staleness in CI

scripts/              Testnet deploy, upgrade, seed (inert demo data) and bindings generation

tools/
└── bindgen/          Pinned bindings generator (@stellar/stellar-sdk `stellar-js generate`, lockfile, installed with --ignore-scripts)
└── fixtures/         Inert look-alike files used for demo indicators (`echo DOME_FIXTURE`)

docs/                 Threat model and publication policy

.github/workflows/    CI: hygiene checks, lint, tests, Wasm build, bindings check
```

`contracts/` is a Cargo workspace, so future contracts (for example a self-attestation contract with verified repository ownership) can be added without a new repo.

| Layer | Tool | Members |
|---|---|---|
| Contracts | Cargo workspace | `contracts/registry` |
| Wasm build | [Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli) `stellar contract build` | `contracts/registry` → `target/wasm32v1-none/release/dome_registry.wasm` |
| TypeScript bindings | `stellar-js generate` from `@stellar/stellar-sdk`, pinned in `tools/bindgen`, via `scripts/bindings.sh` | `bindings/ts` → `@dome-security/registry-bindings` (committed; npm publish planned) |

## Tech stack

- **Smart contract**: Rust, `soroban-sdk` 29, target `wasm32v1-none`, deployed on Stellar
- **Tooling**: Stellar CLI v25.2+ (v28.1.0 in CI) for Wasm builds, `@stellar/stellar-sdk` 17.2.1 `stellar-js generate` for bindings (Node 22.12+), `make`, Bash scripts checked with shellcheck
- **Tests**: `soroban-sdk` testutils (mocked and explicit auth, event and TTL assertions)
- **CI**: GitHub Actions, every action pinned by commit SHA, read-only token
- **Clients**: TypeScript bindings generated from the contract spec, for `dome-backend` and `dome-frontend`

## Getting started

> Contributions come through the Stellar Wave Program on Drips. Apply for an issue in the [Drips Wave app](https://www.drips.network/wave) and wait to be assigned. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the process and PR rules.

Requirements: Rust (the toolchain and `wasm32v1-none` target come from `rust-toolchain.toml`), and the [Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli) v25.2+ for Wasm builds, and Node 22.12+ for bindings. `soroban-sdk` 29 can only build Wasm through `stellar contract build`; plain `cargo test` needs no CLI.

```bash
git clone https://github.com/DOME-security/Dome-contracts.git
cd Dome-contracts

# unit tests, no Stellar CLI needed
cargo test

# build the contract Wasm
stellar contract build
```

Run the full lint/test suite:

```bash
make lint        # rustfmt check + clippy, warnings are errors
make test        # unit tests
make test-wasm   # build Wasm, then run every test including the upgrade test
make bindings    # generate TypeScript bindings into bindings/ts
```

Deploy to testnet with keys kept in the OS keychain, not a plaintext file:

```bash
stellar keys generate dome-dev --network testnet --fund --secure-store
SOURCE=dome-dev ADMIN=$(stellar keys address dome-dev) THRESHOLD=2 ./scripts/deploy.sh

# seed inert demo data: two curators, one attester (all CLI identities)
CONTRACT_ID=C... ADMIN_SOURCE=dome-dev \
CURATOR1=dome-curator-1 CURATOR2=dome-curator-2 ATTESTER=dome-attester \
./scripts/seed-testnet.sh

# upgrade an existing deployment in place
CONTRACT_ID=C... ADMIN_SOURCE=dome-dev ./scripts/upgrade.sh
```

**Protect your keys.** Without `--secure-store`, Stellar CLI identities are saved in plaintext under `~/.config/stellar/identity/`, which is exactly what developer-targeting malware reads. Use `--secure-store` or a hardware wallet, never commit identity files, and never keep a role key on a machine where you open untrusted repositories.

## Contract design

The contract design (storage model, roles and interface) is documented below, with the reasoning in [`docs/threat-model.md`](docs/threat-model.md) and [`docs/publication-policy.md`](docs/publication-policy.md). One record of truth, as little data as possible, and every write attributable.

**Attestation**: the result of a scan of one commit.

| Field | Type | Notes |
|---|---|---|
| `repo` | `BytesN<32>` | SHA-256 of the normalized repo id, e.g. `github.com/owner/repo` (fixed length, not secret) |
| `commit` | `Bytes` | Raw git commit id: 20 bytes (SHA-1) or 32 bytes (SHA-256) |
| `verdict` | `Symbol` | `clean`, `review`, `block`, `unreadable` |
| `scanner` | `u32` | Dome engine version that produced it (non-zero) |
| `rules` | `BytesN<32>` | Hash of the rule and indicator set used |
| `report` | `BytesN<32>` | SHA-256 of the full JSON report (stored off-chain) |
| `attester` | `Address` | Who signed it |
| `at` | `u64` | Ledger timestamp |
| `retracted_by` | `Option<Address>` | Attester or admin who retracted it |
| `retract_reason` | `Option<BytesN<32>>` | Hash of the public retraction notice |

**Indicator**: a fingerprint of a file confirmed as malicious.

| Field | Type | Notes |
|---|---|---|
| `hash` | `BytesN<32>` | SHA-256 of the file |
| `kind` | `Symbol` | `task`, `font`, `config`, `script` or `package` |
| `campaign` | `Symbol` | e.g. `polinrider`, `ghostaction`, `unknown` (`demo` for seed data) |
| `evidence` | `BytesN<32>` | Hash of the public write-up or advisory |
| `status` | `Symbol` | `proposed`, `active`, `retracted` |
| `approvals` | `Vec<Address>` | Curators who approved it; the proposer is the first |
| `proposed_at` | `u64` | Ledger timestamp of the proposal |
| `retracted_by` | `Option<Address>` | Curator who retracted it |
| `retract_reason` | `Option<BytesN<32>>` | Hash of the public retraction notice |

**Roles**

| Role | Can | Set by |
|---|---|---|
| **Admin** | Add and remove curators and attesters, set the approval threshold, hand over the admin role (both sides sign), retract any attestation, upgrade the contract | Constructor; a multisig Stellar account, never a single key |
| **Curator** | Propose, approve and retract indicators | Admin |
| **Attester** | Publish scan attestations and retract its own | Admin (v1); repo self-attestation planned (v2) |
| **Anyone** | Read everything, pay to extend TTLs | — |

**Interface** (`contracts/registry/src/lib.rs`):

```rust
// setup: runs once at deploy time, so initialization can't be front-run
fn __constructor(env: Env, admin: Address, threshold: u32) -> Result<(), Error>;
fn admin(env: Env) -> Address;
fn threshold(env: Env) -> u32;
fn set_admin(env: Env, new_admin: Address);                         // old and new admin sign
fn set_threshold(env: Env, threshold: u32) -> Result<(), Error>;    // admin, min 2
fn add_curator(env: Env, curator: Address) -> Result<(), Error>;    // admin
fn remove_curator(env: Env, curator: Address) -> Result<(), Error>;
fn add_attester(env: Env, attester: Address) -> Result<(), Error>;
fn remove_attester(env: Env, attester: Address) -> Result<(), Error>;
fn is_curator(env: Env, account: Address) -> bool;
fn is_attester(env: Env, account: Address) -> bool;
fn upgrade(env: Env, wasm_hash: BytesN<32>);                        // admin

// attestations
fn attest(env: Env, attester: Address, a: AttestationInput) -> Result<u32, Error>; // returns index
fn latest(env: Env, repo: BytesN<32>) -> Option<Attestation>;
fn attestation_count(env: Env, repo: BytesN<32>) -> u32;
fn history(env: Env, repo: BytesN<32>, start: u32, limit: u32) -> Result<Vec<Attestation>, Error>; // limit 1..=50
fn retract_attestation(env: Env, by: Address, repo: BytesN<32>, index: u32, reason: BytesN<32>) -> Result<(), Error>; // its attester or admin

// indicators
fn propose(env: Env, curator: Address, i: IndicatorInput) -> Result<(), Error>;
fn approve(env: Env, curator: Address, hash: BytesN<32>) -> Result<(), Error>;
fn retract(env: Env, curator: Address, hash: BytesN<32>, reason: BytesN<32>) -> Result<(), Error>;
fn is_known_bad(env: Env, hash: BytesN<32>) -> bool;
fn indicator(env: Env, hash: BytesN<32>) -> Option<Indicator>;

// TTL: anyone may call
fn extend_repo(env: Env, repo: BytesN<32>) -> bool;
fn extend_indicator(env: Env, hash: BytesN<32>) -> bool;
```

Error codes are listed in [`contracts/registry/src/errors.rs`](contracts/registry/src/errors.rs) and never renumbered. Approvals only count while the approving address is still a curator, so removing a compromised curator stops their approvals counting toward pending indicators.

**Publication policy** in short: indicators describe files, not people; `block` attestations about someone else's repo wait for private notice (default 72 hours) unless the payload is actively spreading; every entry can be retracted visibly; only public repositories; `clean` means "no known pattern found at this commit with this rule set", never "safe". Full text, with what the contract enforces and what is process, in [`docs/publication-policy.md`](docs/publication-policy.md).

## Related repositories

```
dome-frontend ──reads──────────────┐
      │ curators sign with Freighter│
      ▼                             ▼
          dome-contracts (this repo): Dome Registry on Stellar
      ▲                             ▲
      │ publishes attestations      │ indexer follows events
dome-backend ──────────────────────┘
```

**[dome-backend](https://github.com/DOME-security/Dome-backend)**

- *Sends to this repo's contract:* `attest` calls after release scans, signed by an attester key the admin registered, and `retract_attestation` for its own mistaken results. The backend holds `block` results for someone else's repository until the notice period in the publication policy has passed.
- *Receives from it:* active indicators via `is_known_bad` / `indicator`, which it pulls into the scanner (`dome intel update`), and every contract event, which its indexer stores for fast reads and as a full history if entries are archived.
- *Calls `extend_repo` / `extend_indicator`* for entries that are still in use.

**[dome-frontend](https://github.com/DOME-security/Dome-frontend)**

- *Receives:* `latest`, `history`, `attestation_count`, `indicator` and `is_known_bad` for its explorer pages, read through Stellar RPC simulation (no fees) or from the backend's index.
- *Sends:* `propose`, `approve` and `retract` transactions from the curator console, signed by curators in a Stellar wallet such as Freighter. Admin actions are signed by the admin multisig, not through the frontend.

**Shared interfaces**

| Interface | Owned here | Used by |
|---|---|---|
| `@dome-security/registry-bindings`: TypeScript client generated from the contract spec by `scripts/bindings.sh`, committed in `bindings/ts` (npm publish planned; use a path or git dependency until then) | Yes | backend, frontend |
| Contract id per network (see [Status](#status)) | Yes, output of `scripts/deploy.sh` | backend, frontend config |
| Event topics and data (`events.rs`) | Yes | backend indexer |
| Error codes (`errors.rs`, append-only) | Yes | backend, frontend error messages |
| Verdict, kind and status symbols | Yes | backend scanner output, frontend labels |
| Repo id hashing: SHA-256 of `github.com/owner/repo` | Convention shared with dome-backend | backend (writes), frontend (looks up) |

## Roadmap

Milestones from the original specification, compared with the code in this repo:

- [x] **M1 Contract core:** roles, attestations, `latest`, `history`, events, unit tests (constructor instead of a separate `init`, so setup can't be front-run)
- [x] **M2 Indicators:** propose/approve/retract with M-of-N threshold, `is_known_bad`
- [x] Attestation retraction by the attester or the admin, so every entry can be retracted visibly
- [x] TTL extension strategy for active entries (`extend_repo`, `extend_indicator`) and docs
- [x] `docs/threat-model.md` and `docs/publication-policy.md`
- [x] CI: hygiene checks, lint, tests, Wasm build with Stellar CLI, upgrade test against real Wasm
- [x] Testnet deploy, upgrade and seed scripts with inert demo indicators
- [x] **M3 Bindings + testnet:** generated `bindings/ts` committed and checked for staleness in CI; registry deployed and seeded on testnet
- [ ] Publish `@dome-security/registry-bindings` to npm (new; use a path or git dependency until then)
- [x] Move `scripts/bindings.sh` off the deprecated `stellar contract bindings typescript` to the pinned JavaScript Stellar SDK generator
- [x] Exercise `scripts/upgrade.sh` against the testnet deployment: upgraded in place to the soroban-sdk 29 build with storage intact
- [ ] M-of-N approval for retracting `active` indicators (new, from the threat model)
- [ ] Upgrade timelock or upgrade limits, to discuss in review (new)
- [ ] **M4 Integration:** backend indexer and attestation publishing, frontend explorer and curator console (work happens in dome-backend and dome-frontend)
- [ ] **M5 Review:** independent security review, then mainnet. **Mainnet deployment is gated on this review**
- [ ] **M6 Self-attestation:** repo owners attest their own releases with verified repository ownership

## Security

The registry decides which files the ecosystem treats as malicious, so its keys and logic are high-value targets. The contract stays on testnet until it has been independently reviewed, and the scripts refuse to run against mainnet. Known risks and mitigations are in [`docs/threat-model.md`](docs/threat-model.md). Found a vulnerability? Please don't open a public issue. Report it privately through **Report a vulnerability** on this repo, as described in [`SECURITY.md`](SECURITY.md).

## License

[Apache-2.0](LICENSE).

## Acknowledgments

- Stellar smart contracts (Soroban) documentation: https://developers.stellar.org/docs/build/smart-contracts/overview
- Stellar CLI reference and key storage: https://developers.stellar.org/docs/tools/cli/agent-cli/reference/architecture
- OpenSourceMalware, PolinRider (blockchain dead-drop C2 and published indicators): https://github.com/OpenSourceMalware/PolinRider
- Stellar Light repo-security holds, a per-project version of this idea: https://github.com/Stellar-Light/stellarlight/pull/1833
- Drips Wave docs: https://docs.drips.network/wave
