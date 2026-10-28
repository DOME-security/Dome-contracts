# Publication policy

Saying "this repository is infected" in public, permanently, can hurt the maintainers who were the victims. These rules govern what Dome writes to the registry. The table says whether each rule is enforced by the contract or by process.

| # | Rule | Enforced by |
|---|---|---|
| 1 | **Indicators describe files, not people.** An indicator is the SHA-256 of a file plus a `kind`, a `campaign` label and an evidence hash. It never names an account or a committer. | Contract: the `Indicator` type has no field for a person. `kind` must be one of `task`, `font`, `config`, `script`, `package`. |
| 2 | **`block` attestations about someone else's repository** are published only after its maintainers have been notified privately and given time to respond (default 72 hours), unless the payload is actively spreading. | Process: attesters (the Dome backend) hold `block` results until the notice period ends. |
| 3 | **Every entry can be retracted**, and a retraction is as visible as the original. | Contract: `retract` (indicators) and `retract_attestation` (attestations) keep the entry and record who retracted it and a reason hash. Nothing is deleted. |
| 4 | **Only public repositories.** Private repository names are never written, even hashed, because a hash of a known name is easy to reverse. | Process: the backend only attests repositories it can read anonymously. |
| 5 | A `clean` attestation always means "no known pattern found at this commit with this rule set", never "safe". | Process and UI: `dome-frontend` shows the rule-set hash and scanner version next to every verdict. |

## Verdicts

| Verdict | Meaning |
|---|---|
| `clean` | No known pattern found at this commit with this rule set. |
| `review` | Something suspicious that a person should look at. |
| `block` | A known malicious pattern was found. Subject to rule 2. |
| `unreadable` | The scanner could not finish, e.g. the repository was too large or unavailable. |

## Evidence and reasons

`evidence` (on indicators), `reason` (on retractions) and `report` (on attestations) are SHA-256 hashes of documents published elsewhere: a public advisory, a write-up, or the full JSON scan report. Publish the document first, then write its hash, so anyone can check that the on-chain hash matches.

## Test and demo data

Seed data on testnet uses campaign `demo` and hashes of inert fixtures in `scripts/fixtures/` that only `echo DOME_FIXTURE`. Never write hashes of real samples to testnet for testing, and never commit real malware to any Dome repository.
