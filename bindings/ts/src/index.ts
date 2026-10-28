import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





/**
 * A fingerprint of a file confirmed (or proposed) as malicious.
 */
export interface Indicator {
  /**
 * Curators who approved it, in order. The proposer is the first approval.
 */
approvals: Array<string>;
  campaign: string;
  evidence: Buffer;
  hash: Buffer;
  kind: string;
  /**
 * Ledger timestamp of the proposal.
 */
proposed_at: u64;
  /**
 * Hash of the public retraction notice, if retracted.
 */
retract_reason: Option<Buffer>;
  /**
 * Curator who retracted it, if retracted.
 */
retracted_by: Option<string>;
  /**
 * `proposed`, `active` or `retracted`.
 */
status: string;
}


/**
 * A stored scan attestation for one commit of one repository.
 */
export interface Attestation {
  /**
 * Ledger timestamp of the write.
 */
at: u64;
  attester: string;
  commit: Buffer;
  repo: Buffer;
  report: Buffer;
  /**
 * Hash of the public retraction notice, if retracted.
 */
retract_reason: Option<Buffer>;
  /**
 * Who retracted it, if retracted: the attester or the admin.
 */
retracted_by: Option<string>;
  rules: Buffer;
  scanner: u32;
  verdict: string;
}


/**
 * Indicator proposed by a curator. The contract fills in status and approvals.
 */
export interface IndicatorInput {
  /**
 * Campaign label, e.g. `polinrider`, `ghostaction`, `unknown`.
 */
campaign: string;
  /**
 * Hash of the public write-up or advisory.
 */
evidence: Buffer;
  /**
 * SHA-256 of the malicious file.
 */
hash: Buffer;
  /**
 * `task`, `font`, `config`, `script` or `package`.
 */
kind: string;
}


/**
 * Scan result submitted by an attester. The contract adds `attester` and `at`.
 */
export interface AttestationInput {
  /**
 * Raw git commit id: 20 bytes (SHA-1) or 32 bytes (SHA-256).
 */
commit: Buffer;
  /**
 * SHA-256 of the normalized repo id, e.g. `github.com/owner/repo`.
 */
repo: Buffer;
  /**
 * SHA-256 of the full JSON report, stored off-chain.
 */
report: Buffer;
  /**
 * Hash of the rule and indicator set used.
 */
rules: Buffer;
  /**
 * Dome engine version that produced the result.
 */
scanner: u32;
  /**
 * `clean`, `review`, `block` or `unreadable`.
 */
verdict: string;
}

/**
 * Errors returned by the registry. Codes are part of the public interface:
 * never renumber an existing variant, only append new ones.
 */
export const Errors = {
  /**
   * Threshold is below [`crate::storage::MIN_THRESHOLD`].
   */
  1: {message:"InvalidThreshold"},
  /**
   * Address already holds the role being granted.
   */
  2: {message:"RoleAlreadyGranted"},
  /**
   * Address does not hold the role being revoked.
   */
  3: {message:"RoleNotGranted"},
  /**
   * Caller is not a registered attester.
   */
  4: {message:"NotAttester"},
  /**
   * Verdict is not one of `clean`, `review`, `block`, `unreadable`.
   */
  5: {message:"InvalidVerdict"},
  /**
   * Commit id is not 20 (SHA-1) or 32 (SHA-256) raw bytes.
   */
  6: {message:"InvalidCommit"},
  /**
   * Scanner version must be non-zero.
   */
  7: {message:"InvalidScanner"},
  /**
   * Pagination limit is zero or above [`crate::storage::MAX_PAGE`].
   */
  8: {message:"InvalidLimit"},
  /**
   * Caller is not a registered curator.
   */
  9: {message:"NotCurator"},
  /**
   * Indicator kind is not one of `task`, `font`, `config`, `script`, `package`.
   */
  10: {message:"InvalidKind"},
  /**
   * An indicator with this hash already exists (retracted ones included).
   */
  11: {message:"IndicatorExists"},
  /**
   * No indicator with this hash.
   */
  12: {message:"IndicatorNotFound"},
  /**
   * Curator has already approved this indicator.
   */
  13: {message:"AlreadyApproved"},
  /**
   * Indicator has been retracted and can no longer change.
   */
  14: {message:"IndicatorRetracted"},
  /**
   * No attestation at this index for this repo.
   */
  15: {message:"AttestationNotFound"},
  /**
   * Attestation has already been retracted.
   */
  16: {message:"AttestationRetracted"},
  /**
   * Only the original attester or the admin may retract an attestation.
   */
  17: {message:"NotAllowedToRetract"}
}











export interface Client {
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Publishes the result of a scan of one commit. Earlier attestations for
   * the same repo are kept; `latest` returns the newest.
   */
  attest: ({attester, a}: {attester: string, a: AttestationInput}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a latest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  latest: ({repo}: {repo: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Attestation>>>

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Adds a curator's approval. The indicator becomes `active` once
   * approvals from current curators reach the threshold; approvals from
   * curators removed since then no longer count.
   */
  approve: ({curator, hash}: {curator: string, hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a history transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Attestations for `repo`, oldest first, starting at index `start`.
   * `limit` must be between 1 and 50.
   */
  history: ({repo, start, limit}: {repo: Buffer, start: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<Attestation>>>>

  /**
   * Construct and simulate a propose transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Proposes a fingerprint of a malicious file. The proposer's approval is
   * counted, so with a threshold of M it needs M-1 more curators.
   */
  propose: ({curator, i}: {curator: string, i: IndicatorInput}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a retract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retracts an indicator, proposed or active. The entry stays readable
   * with status `retracted` and the reason hash, so mistakes stay visible.
   */
  retract: ({curator, hash, reason}: {curator: string, hash: Buffer, reason: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Replaces the contract code. Storage and the contract id are kept.
   */
  upgrade: ({wasm_hash}: {wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a indicator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  indicator: ({hash}: {hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Indicator>>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Hands the admin role to `new_admin`. Both must sign so the role can't
   * be sent to an address nobody controls.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  threshold: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a is_curator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_curator: ({account}: {account: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a add_curator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_curator: ({curator}: {curator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a extend_repo transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Keeps a repo's newest attestation and its history count from being
   * archived. Anyone may call it and pay the fee; older history entries
   * are left to expire and can be restored. Returns false for an unknown
   * repo.
   */
  extend_repo: ({repo}: {repo: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a is_attester transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_attester: ({account}: {account: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a add_attester transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_attester: ({attester}: {attester: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_known_bad transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * True only for `active` indicators. Proposed and retracted ones are not
   * known bad.
   */
  is_known_bad: ({hash}: {hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_threshold: ({threshold}: {threshold: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a remove_curator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  remove_curator: ({curator}: {curator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a remove_attester transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  remove_attester: ({attester}: {attester: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a extend_indicator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Keeps an indicator from being archived. Anyone may call it. Returns
   * false for an unknown hash.
   */
  extend_indicator: ({hash}: {hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a attestation_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  attestation_count: ({repo}: {repo: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a retract_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Marks attestation `index` of `repo` as retracted. Allowed for the
   * attester who wrote it while they still hold the attester role, and for
   * the admin, e.g. after an attester key was compromised. The entry stays
   * in the history with `retracted_by` and `retract_reason` set, and
   * `latest` keeps returning it if it is the newest; readers must check
   * `retracted_by`.
   */
  retract_attestation: ({by, repo, index, reason}: {by: string, repo: Buffer, index: u32, reason: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, threshold}: {admin: string, threshold: u32},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, threshold}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAHtQdWJsaXNoZXMgdGhlIHJlc3VsdCBvZiBhIHNjYW4gb2Ygb25lIGNvbW1pdC4gRWFybGllciBhdHRlc3RhdGlvbnMgZm9yCnRoZSBzYW1lIHJlcG8gYXJlIGtlcHQ7IGBsYXRlc3RgIHJldHVybnMgdGhlIG5ld2VzdC4AAAAABmF0dGVzdAAAAAAAAgAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAAFhAAAAAAAH0AAAABBBdHRlc3RhdGlvbklucHV0AAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAAAAAAAAGbGF0ZXN0AAAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAD6AAAB9AAAAALQXR0ZXN0YXRpb24A",
        "AAAAAAAAAK9BZGRzIGEgY3VyYXRvcidzIGFwcHJvdmFsLiBUaGUgaW5kaWNhdG9yIGJlY29tZXMgYGFjdGl2ZWAgb25jZQphcHByb3ZhbHMgZnJvbSBjdXJyZW50IGN1cmF0b3JzIHJlYWNoIHRoZSB0aHJlc2hvbGQ7IGFwcHJvdmFscyBmcm9tCmN1cmF0b3JzIHJlbW92ZWQgc2luY2UgdGhlbiBubyBsb25nZXIgY291bnQuAAAAAAdhcHByb3ZlAAAAAAIAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAGNBdHRlc3RhdGlvbnMgZm9yIGByZXBvYCwgb2xkZXN0IGZpcnN0LCBzdGFydGluZyBhdCBpbmRleCBgc3RhcnRgLgpgbGltaXRgIG11c3QgYmUgYmV0d2VlbiAxIGFuZCA1MC4AAAAAB2hpc3RvcnkAAAAAAwAAAAAAAAAEcmVwbwAAA+4AAAAgAAAAAAAAAAVzdGFydAAAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPpAAAD6gAAB9AAAAALQXR0ZXN0YXRpb24AAAAAAw==",
        "AAAAAAAAAIRQcm9wb3NlcyBhIGZpbmdlcnByaW50IG9mIGEgbWFsaWNpb3VzIGZpbGUuIFRoZSBwcm9wb3NlcidzIGFwcHJvdmFsIGlzCmNvdW50ZWQsIHNvIHdpdGggYSB0aHJlc2hvbGQgb2YgTSBpdCBuZWVkcyBNLTEgbW9yZSBjdXJhdG9ycy4AAAAHcHJvcG9zZQAAAAACAAAAAAAAAAdjdXJhdG9yAAAAABMAAAAAAAAAAWkAAAAAAAfQAAAADkluZGljYXRvcklucHV0AAAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAIpSZXRyYWN0cyBhbiBpbmRpY2F0b3IsIHByb3Bvc2VkIG9yIGFjdGl2ZS4gVGhlIGVudHJ5IHN0YXlzIHJlYWRhYmxlCndpdGggc3RhdHVzIGByZXRyYWN0ZWRgIGFuZCB0aGUgcmVhc29uIGhhc2gsIHNvIG1pc3Rha2VzIHN0YXkgdmlzaWJsZS4AAAAAAAdyZXRyYWN0AAAAAAMAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAAAAAAZyZWFzb24AAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAEFSZXBsYWNlcyB0aGUgY29udHJhY3QgY29kZS4gU3RvcmFnZSBhbmQgdGhlIGNvbnRyYWN0IGlkIGFyZSBrZXB0LgAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==",
        "AAAAAAAAAAAAAAAJaW5kaWNhdG9yAAAAAAAAAQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAA+gAAAfQAAAACUluZGljYXRvcgAAAA==",
        "AAAAAAAAAGxIYW5kcyB0aGUgYWRtaW4gcm9sZSB0byBgbmV3X2FkbWluYC4gQm90aCBtdXN0IHNpZ24gc28gdGhlIHJvbGUgY2FuJ3QKYmUgc2VudCB0byBhbiBhZGRyZXNzIG5vYm9keSBjb250cm9scy4AAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAJdGhyZXNob2xkAAAAAAAAAAAAAAEAAAAE",
        "AAAAAAAAAAAAAAAKaXNfY3VyYXRvcgAAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAALYWRkX2N1cmF0b3IAAAAAAQAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAANFLZWVwcyBhIHJlcG8ncyBuZXdlc3QgYXR0ZXN0YXRpb24gYW5kIGl0cyBoaXN0b3J5IGNvdW50IGZyb20gYmVpbmcKYXJjaGl2ZWQuIEFueW9uZSBtYXkgY2FsbCBpdCBhbmQgcGF5IHRoZSBmZWU7IG9sZGVyIGhpc3RvcnkgZW50cmllcwphcmUgbGVmdCB0byBleHBpcmUgYW5kIGNhbiBiZSByZXN0b3JlZC4gUmV0dXJucyBmYWxzZSBmb3IgYW4gdW5rbm93bgpyZXBvLgAAAAAAAAtleHRlbmRfcmVwbwAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAALaXNfYXR0ZXN0ZXIAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAMYWRkX2F0dGVzdGVyAAAAAQAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAFFUcnVlIG9ubHkgZm9yIGBhY3RpdmVgIGluZGljYXRvcnMuIFByb3Bvc2VkIGFuZCByZXRyYWN0ZWQgb25lcyBhcmUgbm90Cmtub3duIGJhZC4AAAAAAAAMaXNfa25vd25fYmFkAAAAAQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAE=",
        "AAAAAAAAAK9SdW5zIG9uY2UgYXQgZGVwbG95IHRpbWUuIGBhZG1pbmAgc2hvdWxkIGJlIGEgbXVsdGlzaWcgYWNjb3VudC4KUnVubmluZyBzZXR1cCBpbiB0aGUgY29uc3RydWN0b3IgKGluc3RlYWQgb2YgYSBzZXBhcmF0ZSBgaW5pdGAgY2FsbCkKbWVhbnMgbm9ib2R5IGNhbiBmcm9udC1ydW4gaW5pdGlhbGl6YXRpb24uAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAl0aHJlc2hvbGQAAAAAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAANc2V0X3RocmVzaG9sZAAAAAAAAAEAAAAAAAAACXRocmVzaG9sZAAAAAAAAAQAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAOcmVtb3ZlX2N1cmF0b3IAAAAAAAEAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAPcmVtb3ZlX2F0dGVzdGVyAAAAAAEAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAF5LZWVwcyBhbiBpbmRpY2F0b3IgZnJvbSBiZWluZyBhcmNoaXZlZC4gQW55b25lIG1heSBjYWxsIGl0LiBSZXR1cm5zCmZhbHNlIGZvciBhbiB1bmtub3duIGhhc2guAAAAAAAQZXh0ZW5kX2luZGljYXRvcgAAAAEAAAAAAAAABGhhc2gAAAPuAAAAIAAAAAEAAAAB",
        "AAAAAAAAAAAAAAARYXR0ZXN0YXRpb25fY291bnQAAAAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAABA==",
        "AAAAAAAAAWRNYXJrcyBhdHRlc3RhdGlvbiBgaW5kZXhgIG9mIGByZXBvYCBhcyByZXRyYWN0ZWQuIEFsbG93ZWQgZm9yIHRoZQphdHRlc3RlciB3aG8gd3JvdGUgaXQgd2hpbGUgdGhleSBzdGlsbCBob2xkIHRoZSBhdHRlc3RlciByb2xlLCBhbmQgZm9yCnRoZSBhZG1pbiwgZS5nLiBhZnRlciBhbiBhdHRlc3RlciBrZXkgd2FzIGNvbXByb21pc2VkLiBUaGUgZW50cnkgc3RheXMKaW4gdGhlIGhpc3Rvcnkgd2l0aCBgcmV0cmFjdGVkX2J5YCBhbmQgYHJldHJhY3RfcmVhc29uYCBzZXQsIGFuZApgbGF0ZXN0YCBrZWVwcyByZXR1cm5pbmcgaXQgaWYgaXQgaXMgdGhlIG5ld2VzdDsgcmVhZGVycyBtdXN0IGNoZWNrCmByZXRyYWN0ZWRfYnlgLgAAABNyZXRyYWN0X2F0dGVzdGF0aW9uAAAAAAQAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAARyZXBvAAAD7gAAACAAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAQAAAD1BIGZpbmdlcnByaW50IG9mIGEgZmlsZSBjb25maXJtZWQgKG9yIHByb3Bvc2VkKSBhcyBtYWxpY2lvdXMuAAAAAAAAAAAAAAlJbmRpY2F0b3IAAAAAAAAJAAAAR0N1cmF0b3JzIHdobyBhcHByb3ZlZCBpdCwgaW4gb3JkZXIuIFRoZSBwcm9wb3NlciBpcyB0aGUgZmlyc3QgYXBwcm92YWwuAAAAAAlhcHByb3ZhbHMAAAAAAAPqAAAAEwAAAAAAAAAIY2FtcGFpZ24AAAARAAAAAAAAAAhldmlkZW5jZQAAA+4AAAAgAAAAAAAAAARoYXNoAAAD7gAAACAAAAAAAAAABGtpbmQAAAARAAAAIUxlZGdlciB0aW1lc3RhbXAgb2YgdGhlIHByb3Bvc2FsLgAAAAAAAAtwcm9wb3NlZF9hdAAAAAAGAAAAM0hhc2ggb2YgdGhlIHB1YmxpYyByZXRyYWN0aW9uIG5vdGljZSwgaWYgcmV0cmFjdGVkLgAAAAAOcmV0cmFjdF9yZWFzb24AAAAAA+gAAAPuAAAAIAAAACdDdXJhdG9yIHdobyByZXRyYWN0ZWQgaXQsIGlmIHJldHJhY3RlZC4AAAAADHJldHJhY3RlZF9ieQAAA+gAAAATAAAAJGBwcm9wb3NlZGAsIGBhY3RpdmVgIG9yIGByZXRyYWN0ZWRgLgAAAAZzdGF0dXMAAAAAABE=",
        "AAAAAQAAADtBIHN0b3JlZCBzY2FuIGF0dGVzdGF0aW9uIGZvciBvbmUgY29tbWl0IG9mIG9uZSByZXBvc2l0b3J5LgAAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAoAAAAeTGVkZ2VyIHRpbWVzdGFtcCBvZiB0aGUgd3JpdGUuAAAAAAACYXQAAAAAAAYAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAGY29tbWl0AAAAAAAOAAAAAAAAAARyZXBvAAAD7gAAACAAAAAAAAAABnJlcG9ydAAAAAAD7gAAACAAAAAzSGFzaCBvZiB0aGUgcHVibGljIHJldHJhY3Rpb24gbm90aWNlLCBpZiByZXRyYWN0ZWQuAAAAAA5yZXRyYWN0X3JlYXNvbgAAAAAD6AAAA+4AAAAgAAAAOldobyByZXRyYWN0ZWQgaXQsIGlmIHJldHJhY3RlZDogdGhlIGF0dGVzdGVyIG9yIHRoZSBhZG1pbi4AAAAAAAxyZXRyYWN0ZWRfYnkAAAPoAAAAEwAAAAAAAAAFcnVsZXMAAAAAAAPuAAAAIAAAAAAAAAAHc2Nhbm5lcgAAAAAEAAAAAAAAAAd2ZXJkaWN0AAAAABE=",
        "AAAAAQAAAExJbmRpY2F0b3IgcHJvcG9zZWQgYnkgYSBjdXJhdG9yLiBUaGUgY29udHJhY3QgZmlsbHMgaW4gc3RhdHVzIGFuZCBhcHByb3ZhbHMuAAAAAAAAAA5JbmRpY2F0b3JJbnB1dAAAAAAABAAAADxDYW1wYWlnbiBsYWJlbCwgZS5nLiBgcG9saW5yaWRlcmAsIGBnaG9zdGFjdGlvbmAsIGB1bmtub3duYC4AAAAIY2FtcGFpZ24AAAARAAAAKEhhc2ggb2YgdGhlIHB1YmxpYyB3cml0ZS11cCBvciBhZHZpc29yeS4AAAAIZXZpZGVuY2UAAAPuAAAAIAAAAB5TSEEtMjU2IG9mIHRoZSBtYWxpY2lvdXMgZmlsZS4AAAAAAARoYXNoAAAD7gAAACAAAAAwYHRhc2tgLCBgZm9udGAsIGBjb25maWdgLCBgc2NyaXB0YCBvciBgcGFja2FnZWAuAAAABGtpbmQAAAAR",
        "AAAAAQAAAExTY2FuIHJlc3VsdCBzdWJtaXR0ZWQgYnkgYW4gYXR0ZXN0ZXIuIFRoZSBjb250cmFjdCBhZGRzIGBhdHRlc3RlcmAgYW5kIGBhdGAuAAAAAAAAABBBdHRlc3RhdGlvbklucHV0AAAABgAAADpSYXcgZ2l0IGNvbW1pdCBpZDogMjAgYnl0ZXMgKFNIQS0xKSBvciAzMiBieXRlcyAoU0hBLTI1NikuAAAAAAAGY29tbWl0AAAAAAAOAAAAQFNIQS0yNTYgb2YgdGhlIG5vcm1hbGl6ZWQgcmVwbyBpZCwgZS5nLiBgZ2l0aHViLmNvbS9vd25lci9yZXBvYC4AAAAEcmVwbwAAA+4AAAAgAAAAMlNIQS0yNTYgb2YgdGhlIGZ1bGwgSlNPTiByZXBvcnQsIHN0b3JlZCBvZmYtY2hhaW4uAAAAAAAGcmVwb3J0AAAAAAPuAAAAIAAAAChIYXNoIG9mIHRoZSBydWxlIGFuZCBpbmRpY2F0b3Igc2V0IHVzZWQuAAAABXJ1bGVzAAAAAAAD7gAAACAAAAAtRG9tZSBlbmdpbmUgdmVyc2lvbiB0aGF0IHByb2R1Y2VkIHRoZSByZXN1bHQuAAAAAAAAB3NjYW5uZXIAAAAABAAAACtgY2xlYW5gLCBgcmV2aWV3YCwgYGJsb2NrYCBvciBgdW5yZWFkYWJsZWAuAAAAAAd2ZXJkaWN0AAAAABE=",
        "AAAABAAAAIJFcnJvcnMgcmV0dXJuZWQgYnkgdGhlIHJlZ2lzdHJ5LiBDb2RlcyBhcmUgcGFydCBvZiB0aGUgcHVibGljIGludGVyZmFjZToKbmV2ZXIgcmVudW1iZXIgYW4gZXhpc3RpbmcgdmFyaWFudCwgb25seSBhcHBlbmQgbmV3IG9uZXMuAAAAAAAAAAAABUVycm9yAAAAAAAAEQAAADVUaHJlc2hvbGQgaXMgYmVsb3cgW2BjcmF0ZTo6c3RvcmFnZTo6TUlOX1RIUkVTSE9MRGBdLgAAAAAAABBJbnZhbGlkVGhyZXNob2xkAAAAAQAAAC1BZGRyZXNzIGFscmVhZHkgaG9sZHMgdGhlIHJvbGUgYmVpbmcgZ3JhbnRlZC4AAAAAAAASUm9sZUFscmVhZHlHcmFudGVkAAAAAAACAAAALUFkZHJlc3MgZG9lcyBub3QgaG9sZCB0aGUgcm9sZSBiZWluZyByZXZva2VkLgAAAAAAAA5Sb2xlTm90R3JhbnRlZAAAAAAAAwAAACRDYWxsZXIgaXMgbm90IGEgcmVnaXN0ZXJlZCBhdHRlc3Rlci4AAAALTm90QXR0ZXN0ZXIAAAAABAAAAD9WZXJkaWN0IGlzIG5vdCBvbmUgb2YgYGNsZWFuYCwgYHJldmlld2AsIGBibG9ja2AsIGB1bnJlYWRhYmxlYC4AAAAADkludmFsaWRWZXJkaWN0AAAAAAAFAAAANkNvbW1pdCBpZCBpcyBub3QgMjAgKFNIQS0xKSBvciAzMiAoU0hBLTI1NikgcmF3IGJ5dGVzLgAAAAAADUludmFsaWRDb21taXQAAAAAAAAGAAAAIVNjYW5uZXIgdmVyc2lvbiBtdXN0IGJlIG5vbi16ZXJvLgAAAAAAAA5JbnZhbGlkU2Nhbm5lcgAAAAAABwAAAD9QYWdpbmF0aW9uIGxpbWl0IGlzIHplcm8gb3IgYWJvdmUgW2BjcmF0ZTo6c3RvcmFnZTo6TUFYX1BBR0VgXS4AAAAADEludmFsaWRMaW1pdAAAAAgAAAAjQ2FsbGVyIGlzIG5vdCBhIHJlZ2lzdGVyZWQgY3VyYXRvci4AAAAACk5vdEN1cmF0b3IAAAAAAAkAAABLSW5kaWNhdG9yIGtpbmQgaXMgbm90IG9uZSBvZiBgdGFza2AsIGBmb250YCwgYGNvbmZpZ2AsIGBzY3JpcHRgLCBgcGFja2FnZWAuAAAAAAtJbnZhbGlkS2luZAAAAAAKAAAARUFuIGluZGljYXRvciB3aXRoIHRoaXMgaGFzaCBhbHJlYWR5IGV4aXN0cyAocmV0cmFjdGVkIG9uZXMgaW5jbHVkZWQpLgAAAAAAAA9JbmRpY2F0b3JFeGlzdHMAAAAACwAAABxObyBpbmRpY2F0b3Igd2l0aCB0aGlzIGhhc2guAAAAEUluZGljYXRvck5vdEZvdW5kAAAAAAAADAAAACxDdXJhdG9yIGhhcyBhbHJlYWR5IGFwcHJvdmVkIHRoaXMgaW5kaWNhdG9yLgAAAA9BbHJlYWR5QXBwcm92ZWQAAAAADQAAADZJbmRpY2F0b3IgaGFzIGJlZW4gcmV0cmFjdGVkIGFuZCBjYW4gbm8gbG9uZ2VyIGNoYW5nZS4AAAAAABJJbmRpY2F0b3JSZXRyYWN0ZWQAAAAAAA4AAAArTm8gYXR0ZXN0YXRpb24gYXQgdGhpcyBpbmRleCBmb3IgdGhpcyByZXBvLgAAAAATQXR0ZXN0YXRpb25Ob3RGb3VuZAAAAAAPAAAAJ0F0dGVzdGF0aW9uIGhhcyBhbHJlYWR5IGJlZW4gcmV0cmFjdGVkLgAAAAAUQXR0ZXN0YXRpb25SZXRyYWN0ZWQAAAAQAAAAQ09ubHkgdGhlIG9yaWdpbmFsIGF0dGVzdGVyIG9yIHRoZSBhZG1pbiBtYXkgcmV0cmFjdCBhbiBhdHRlc3RhdGlvbi4AAAAAE05vdEFsbG93ZWRUb1JldHJhY3QAAAAAEQ==",
        "AAAABQAAAF1BIGN1cmF0b3IgYXBwcm92ZWQgYW4gaW5kaWNhdG9yLiBgc3RhdHVzYCBpcyBgYWN0aXZlYCBvbmNlIHRoZSBhcHByb3ZhbAp0aHJlc2hvbGQgaXMgcmVhY2hlZC4AAAAAAAAAAAAACEFwcHJvdmVkAAAAAQAAAAdhcHByb3ZlAAAAAAQAAAAAAAAABGhhc2gAAAPuAAAAIAAAAAEAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAAAAAACWFwcHJvdmFscwAAAAAAAAQAAAAAAAAAAAAAAAZzdGF0dXMAAAAAABEAAAAAAAAAAg==",
        "AAAABQAAAGlBIHNjYW4gYXR0ZXN0YXRpb24gd2FzIHB1Ymxpc2hlZC4gYGluZGV4YCBpcyBpdHMgcG9zaXRpb24gaW4gdGhlIHJlcG8ncwpoaXN0b3J5LCByZWFkYWJsZSB3aXRoIGBoaXN0b3J5YC4AAAAAAAAAAAAACEF0dGVzdGVkAAAAAQAAAAZhdHRlc3QAAAAAAAUAAAAAAAAABHJlcG8AAAPuAAAAIAAAAAEAAAAAAAAAB3ZlcmRpY3QAAAAAEQAAAAEAAAAAAAAABmNvbW1pdAAAAAAADgAAAAAAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAC",
        "AAAABQAAAE5BIGN1cmF0b3IgcHJvcG9zZWQgYSBuZXcgaW5kaWNhdG9yLiBUaGUgcHJvcG9zYWwgY291bnRzIGFzIHRoZSBmaXJzdAphcHByb3ZhbC4AAAAAAAAAAAAIUHJvcG9zZWQAAAABAAAAB3Byb3Bvc2UAAAAABQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAAAAAAEa2luZAAAABEAAAAAAAAAAAAAAAhjYW1wYWlnbgAAABEAAAAAAAAAAAAAAAhldmlkZW5jZQAAA+4AAAAgAAAAAAAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAACFVwZ3JhZGVkAAAAAQAAAAh1cGdyYWRlZAAAAAEAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAAAAAAI=",
        "AAAABQAAAFdBIGN1cmF0b3IgcmV0cmFjdGVkIGFuIGluZGljYXRvci4gYHJlYXNvbmAgaXMgdGhlIGhhc2ggb2YgdGhlIHB1YmxpYwpyZXRyYWN0aW9uIG5vdGljZS4AAAAAAAAAAAlSZXRyYWN0ZWQAAAAAAAABAAAAB3JldHJhY3QAAAAAAwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAAAAAAC",
        "AAAABQAAAEFBIHJvbGUgd2FzIGdyYW50ZWQgb3IgcmV2b2tlZC4gYHJvbGVgIGlzIGBjdXJhdG9yYCBvciBgYXR0ZXN0ZXJgLgAAAAAAAAAAAAALUm9sZUdyYW50ZWQAAAAAAQAAAAxyb2xlX2dyYW50ZWQAAAACAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAAAAAAB2FjY291bnQAAAAAEwAAAAEAAAAC",
        "AAAABQAAAAAAAAAAAAAAC1JvbGVSZXZva2VkAAAAAAEAAAAMcm9sZV9yZXZva2VkAAAAAgAAAAAAAAAEcm9sZQAAABEAAAABAAAAAAAAAAdhY2NvdW50AAAAABMAAAABAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADEFkbWluQ2hhbmdlZAAAAAEAAAANYWRtaW5fY2hhbmdlZAAAAAAAAAIAAAAAAAAAA29sZAAAAAATAAAAAAAAAAAAAAADbmV3AAAAABMAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAEFRocmVzaG9sZENoYW5nZWQAAAABAAAAEXRocmVzaG9sZF9jaGFuZ2VkAAAAAAAAAQAAAAAAAAAJdGhyZXNob2xkAAAAAAAABAAAAAAAAAAC",
        "AAAABQAAAHBBbiBhdHRlc3RhdGlvbiB3YXMgcmV0cmFjdGVkIGJ5IGl0cyBhdHRlc3RlciBvciB0aGUgYWRtaW4uIGByZWFzb25gIGlzCnRoZSBoYXNoIG9mIHRoZSBwdWJsaWMgcmV0cmFjdGlvbiBub3RpY2UuAAAAAAAAABRBdHRlc3RhdGlvblJldHJhY3RlZAAAAAEAAAAOcmV0cmFjdF9hdHRlc3QAAAAAAAQAAAAAAAAABHJlcG8AAAPuAAAAIAAAAAEAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAAAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<string>,
        attest: this.txFromJSON<Result<u32>>,
        latest: this.txFromJSON<Option<Attestation>>,
        approve: this.txFromJSON<Result<void>>,
        history: this.txFromJSON<Result<Array<Attestation>>>,
        propose: this.txFromJSON<Result<void>>,
        retract: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<null>,
        indicator: this.txFromJSON<Option<Indicator>>,
        set_admin: this.txFromJSON<null>,
        threshold: this.txFromJSON<u32>,
        is_curator: this.txFromJSON<boolean>,
        add_curator: this.txFromJSON<Result<void>>,
        extend_repo: this.txFromJSON<boolean>,
        is_attester: this.txFromJSON<boolean>,
        add_attester: this.txFromJSON<Result<void>>,
        is_known_bad: this.txFromJSON<boolean>,
        set_threshold: this.txFromJSON<Result<void>>,
        remove_curator: this.txFromJSON<Result<void>>,
        remove_attester: this.txFromJSON<Result<void>>,
        extend_indicator: this.txFromJSON<boolean>,
        attestation_count: this.txFromJSON<u32>,
        retract_attestation: this.txFromJSON<Result<void>>
  }
}