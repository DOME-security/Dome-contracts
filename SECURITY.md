# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through **Report a vulnerability** on the Security tab of this repository. Please don't open a public issue or PR for a security problem.

Include the affected function or script, the steps to reproduce on a local network or testnet, and the impact you expect.

## Scope

- The Dome Registry contract in `contracts/registry`.
- The deploy, upgrade, seed and bindings scripts in `scripts/`.
- The CI workflows in `.github/workflows`.
- The generated TypeScript bindings in `bindings/ts` and their generator in `tools/bindgen`.

Only the latest `main` is supported. There is no mainnet deployment.

## Status

The contract is **testnet only until independently reviewed**. The scripts refuse to run against mainnet. See [docs/threat-model.md](docs/threat-model.md) for known risks and accepted residual risks; reports about a listed residual risk are still welcome if you can show a worse impact than described.

## Handling samples

Never attach live malware to a report. Send hashes, advisory links or inert reproductions instead.
