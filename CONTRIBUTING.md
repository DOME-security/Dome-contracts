# Contributing to dome-contracts

## Stellar Wave

This repo takes part in the **Stellar Wave Program on Drips**.

1. Apply for an issue in the [Drips Wave app](https://www.drips.network/wave).
2. **Wait to be assigned** before starting.
3. Open a PR with `Closes #<issue>` in the description.

Points are awarded when the issue is closed as completed during an active Wave: **Trivial 100, Medium 150, High 200**. Maintainers set complexity. KYC in the Drips app is required to apply and withdraw. Read the [Drips Wave Terms and Rules](https://docs.drips.network/wave/terms-and-rules) first.

## Local setup

You need Rust (the toolchain in `rust-toolchain.toml` is installed automatically) and, to build Wasm, [stellar-cli](https://developers.stellar.org/docs/tools/cli/stellar-cli) v25.2 or newer. Regenerating TypeScript bindings (`make bindings`) also needs Node 22.12+; the generator is pinned in `tools/bindgen` and installed with `npm ci --ignore-scripts`.

```bash
make lint        # rustfmt check + clippy with warnings as errors
make test        # unit tests, no stellar-cli needed
make test-wasm   # builds the Wasm with stellar-cli, then also runs upgrade, budget and size tests
make audit       # cargo audit (install cargo-audit first)
```

## Testing requirements

A PR that touches `contracts/` must keep `make lint`, `make test` and `make test-wasm` green, and:

- **Every `require_auth` path has three tests:** the allowed path, which asserts the signer with `env.auths()`; no signature (`env.set_auths(&[])`); and a signature from the wrong address (`env.mock_auths` with another address). A role check also needs a test where a signed non-role-holder gets the role error. See `test/roles.rs` for the pattern.
- **Every rejected input has a test** asserting the exact error code (`Err(Ok(Error::...))`), including edges: zero, the limit, limit + 1, duplicates.
- **Every write asserts its events** with `env.events().all()` against the `#[contractevent]` struct.
- **State-machine changes** (roles, threshold, propose/approve/retract) must extend the model in `test/props.rs` so the property test keeps checking them.
- **Budgets:** if `test/wasm.rs` fails a CPU, memory, read or size budget, either make the change cheaper or raise the budget in both `test/wasm.rs` and `docs/resources.md`, with the reason in the PR.
- **Storage changes** must keep the upgrade test in `test/wasm.rs` passing, or ship a migration and note it in `docs/deployments.md`.

## Rules for PRs

- **Interfaces are shared.** dome-backend and dome-frontend depend on the bindings, events and error codes. Changing the contract interface means regenerating the bindings (`make bindings`) and updating `docs/events.md` / `docs/errors.md` in the same PR.
- **Error codes and events are append-only.** Add new `Error` variants with the next number; never renumber or reuse one. Never change an existing event's name, topics or fields.
- **No secrets.** No real secret keys in code, tests, scripts or CI logs. Don't commit `.env` files or Stellar identity files. Scripts take CLI identity names created with `--secure-store`, never raw keys.
- **Testnet only.** Never deploy to mainnet; the contract is testnet-only until independently reviewed.
- **No real malware.** Use hashes from public advisories, or inert fixtures like `scripts/fixtures/` that only `echo DOME_FIXTURE`.
- **No install scripts.** No `preinstall`, `install`, `postinstall` or `prepare` in any `package.json`. Install JavaScript dependencies with `--ignore-scripts`.
- **No `.vscode/tasks.json`.** CI rejects it.
- **Actions pinned by SHA.** Any new GitHub Action is pinned to a full commit SHA with the version in a comment. Workflows use `pull_request`, never `pull_request_target`.
- **Conventional Commits.** `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`.

AI help is fine, but you must understand and test what you submit.
