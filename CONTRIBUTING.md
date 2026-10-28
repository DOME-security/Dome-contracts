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
make test-wasm   # builds the Wasm with stellar-cli, then runs every test
```

## Rules for PRs

- **Auth tests.** Every `require_auth` needs a test for the allowed path and for the rejected path: no signature, and a signature from the wrong address.
- **Events.** Every write emits an event. Assert the event in the test for that write.
- **Error codes are an interface.** Append new `Error` variants; never renumber existing ones.
- **No secrets.** No real secret keys in code, tests, scripts or CI logs. Don't commit `.env` files or Stellar identity files.
- **No real malware.** Use hashes from public advisories, or inert fixtures like `scripts/fixtures/` that only `echo DOME_FIXTURE`.
- **No install scripts.** No `preinstall`, `install`, `postinstall` or `prepare` in any `package.json`. Install JavaScript dependencies with `--ignore-scripts`.
- **No `.vscode/tasks.json`.** CI rejects it.
- **Actions pinned by SHA.** Any new GitHub Action is pinned to a full commit SHA with the version in a comment. Workflows use `pull_request`, never `pull_request_target`.
- **Conventional Commits.** `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`.

AI help is fine, but you must understand and test what you submit.
