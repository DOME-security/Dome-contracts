import {AttestationInput, Attestation, IndicatorInput, Indicator, ContractEvent} from './types.js';
import {Result, Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address, xdr} from '@stellar/stellar-sdk';

export interface Client {
  admin(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  /**
   * Publishes the result of a scan of one commit. Earlier attestations for
   * the same repo are kept; `latest` returns the newest.
   */
  attest(args: { attester: string | Address; a: AttestationInput }, options?: MethodOptions): Promise<AssembledTransaction<Result<number, Error>>>;
  /**
   * Newest attestation for `repo`, retracted or not. A repo that is
   * being looked up is in use, so this also extends the TTL of its count
   * and newest attestation (a no-op in simulation, which commits nothing).
   */
  latest(args: { repo: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<Attestation | null>>;
  /**
   * Adds a curator's approval. The indicator becomes `active` once
   * approvals from current curators reach the threshold; approvals from
   * curators removed since then no longer count.
   */
  approve(args: { curator: string | Address; hash: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * Attestations for `repo`, oldest first, starting at index `start`.
   * `limit` must be between 1 and 50.
   */
  history(args: { repo: Uint8Array; start: number; limit: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<Array<Attestation>, Error>>>;
  /**
   * Proposes a fingerprint of a malicious file. The proposer's approval is
   * counted, so with a threshold of M it needs M-1 more curators.
   *
   * A retracted hash can be proposed again. The new proposal replaces the
   * stored entry and starts over with no approvals but the proposer's; the
   * earlier retraction stays in the event log. Without this, one curator
   * could retract a hash and keep it out of the registry for good.
   */
  propose(args: { curator: string | Address; i: IndicatorInput }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * Retracts an indicator, proposed or active. The entry stays readable
   * with status `retracted` and the reason hash, so mistakes stay visible.
   */
  retract(args: { curator: string | Address; hash: Uint8Array; reason: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * Replaces the contract code. Storage and the contract id are kept.
   */
  upgrade(args: { wasm_hash: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  indicator(args: { hash: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<Indicator | null>>;
  threshold(options?: MethodOptions): Promise<AssembledTransaction<number>>;
  is_curator(args: { account: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  add_curator(args: { curator: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * Keeps a repo's newest attestation and its history count from being
   * archived. Anyone may call it and pay the fee; older history entries
   * are left to expire and can be restored. Returns false for an unknown
   * repo.
   */
  extend_repo(args: { repo: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  is_attester(args: { account: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  /**
   * Step 2 of 2: the offered address accepts and becomes admin.
   */
  accept_admin(options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  add_attester(args: { attester: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * True only for `active` indicators. Proposed and retracted ones are not
   * known bad. An active indicator that is being checked is in use, so
   * this also extends its TTL.
   */
  is_known_bad(args: { hash: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  curator_count(options?: MethodOptions): Promise<AssembledTransaction<number>>;
  /**
   * Admin that has been offered the role and not yet accepted it.
   */
  pending_admin(options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  /**
   * Sets M in the M-of-N approval rule. M must be at least 2 and at most
   * the current number of curators.
   */
  set_threshold(args: { threshold: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * Removes a curator. Once there are at least `threshold` curators, a
   * removal that would take the count below the threshold is rejected:
   * add the replacement first, then remove.
   */
  remove_curator(args: { curator: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * Step 1 of 2: the admin offers the role to `new_admin`. Nothing changes
   * until `new_admin` calls `accept_admin`, so the role can't be sent to
   * an address nobody controls. A second call replaces the offer.
   */
  transfer_admin(args: { new_admin: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  remove_attester(args: { attester: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * Keeps an indicator from being archived. Anyone may call it. Returns
   * false for an unknown hash.
   */
  extend_indicator(args: { hash: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  attestation_count(args: { repo: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<number>>;
  /**
   * Marks attestation `index` of `repo` as retracted. Allowed for the
   * attester who wrote it while they still hold the attester role, and for
   * the admin, e.g. after an attester key was compromised. The entry stays
   * in the history with `retracted_by` and `retract_reason` set, and
   * `latest` keeps returning it if it is the newest; readers must check
   * `retracted_by`.
   */
  retract_attestation(args: { by: string | Address; repo: Uint8Array; index: number; reason: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * Withdraws a pending offer. Admin only.
   */
  cancel_admin_transfer(options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=", "AAAAAAAAAHtQdWJsaXNoZXMgdGhlIHJlc3VsdCBvZiBhIHNjYW4gb2Ygb25lIGNvbW1pdC4gRWFybGllciBhdHRlc3RhdGlvbnMgZm9yCnRoZSBzYW1lIHJlcG8gYXJlIGtlcHQ7IGBsYXRlc3RgIHJldHVybnMgdGhlIG5ld2VzdC4AAAAABmF0dGVzdAAAAAAAAgAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAAFhAAAAAAAH0AAAABBBdHRlc3RhdGlvbklucHV0AAAAAQAAA+kAAAAEAAAAAw==", "AAAAAAAAAMtOZXdlc3QgYXR0ZXN0YXRpb24gZm9yIGByZXBvYCwgcmV0cmFjdGVkIG9yIG5vdC4gQSByZXBvIHRoYXQgaXMKYmVpbmcgbG9va2VkIHVwIGlzIGluIHVzZSwgc28gdGhpcyBhbHNvIGV4dGVuZHMgdGhlIFRUTCBvZiBpdHMgY291bnQKYW5kIG5ld2VzdCBhdHRlc3RhdGlvbiAoYSBuby1vcCBpbiBzaW11bGF0aW9uLCB3aGljaCBjb21taXRzIG5vdGhpbmcpLgAAAAAGbGF0ZXN0AAAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAD6AAAB9AAAAALQXR0ZXN0YXRpb24A", "AAAAAAAAAK9BZGRzIGEgY3VyYXRvcidzIGFwcHJvdmFsLiBUaGUgaW5kaWNhdG9yIGJlY29tZXMgYGFjdGl2ZWAgb25jZQphcHByb3ZhbHMgZnJvbSBjdXJyZW50IGN1cmF0b3JzIHJlYWNoIHRoZSB0aHJlc2hvbGQ7IGFwcHJvdmFscyBmcm9tCmN1cmF0b3JzIHJlbW92ZWQgc2luY2UgdGhlbiBubyBsb25nZXIgY291bnQuAAAAAAdhcHByb3ZlAAAAAAIAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAGNBdHRlc3RhdGlvbnMgZm9yIGByZXBvYCwgb2xkZXN0IGZpcnN0LCBzdGFydGluZyBhdCBpbmRleCBgc3RhcnRgLgpgbGltaXRgIG11c3QgYmUgYmV0d2VlbiAxIGFuZCA1MC4AAAAAB2hpc3RvcnkAAAAAAwAAAAAAAAAEcmVwbwAAA+4AAAAgAAAAAAAAAAVzdGFydAAAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPpAAAD6gAAB9AAAAALQXR0ZXN0YXRpb24AAAAAAw==", "AAAAAAAAAZZQcm9wb3NlcyBhIGZpbmdlcnByaW50IG9mIGEgbWFsaWNpb3VzIGZpbGUuIFRoZSBwcm9wb3NlcidzIGFwcHJvdmFsIGlzCmNvdW50ZWQsIHNvIHdpdGggYSB0aHJlc2hvbGQgb2YgTSBpdCBuZWVkcyBNLTEgbW9yZSBjdXJhdG9ycy4KCkEgcmV0cmFjdGVkIGhhc2ggY2FuIGJlIHByb3Bvc2VkIGFnYWluLiBUaGUgbmV3IHByb3Bvc2FsIHJlcGxhY2VzIHRoZQpzdG9yZWQgZW50cnkgYW5kIHN0YXJ0cyBvdmVyIHdpdGggbm8gYXBwcm92YWxzIGJ1dCB0aGUgcHJvcG9zZXInczsgdGhlCmVhcmxpZXIgcmV0cmFjdGlvbiBzdGF5cyBpbiB0aGUgZXZlbnQgbG9nLiBXaXRob3V0IHRoaXMsIG9uZSBjdXJhdG9yCmNvdWxkIHJldHJhY3QgYSBoYXNoIGFuZCBrZWVwIGl0IG91dCBvZiB0aGUgcmVnaXN0cnkgZm9yIGdvb2QuAAAAAAAHcHJvcG9zZQAAAAACAAAAAAAAAAdjdXJhdG9yAAAAABMAAAAAAAAAAWkAAAAAAAfQAAAADkluZGljYXRvcklucHV0AAAAAAABAAAD6QAAAAIAAAAD", "AAAAAAAAAIpSZXRyYWN0cyBhbiBpbmRpY2F0b3IsIHByb3Bvc2VkIG9yIGFjdGl2ZS4gVGhlIGVudHJ5IHN0YXlzIHJlYWRhYmxlCndpdGggc3RhdHVzIGByZXRyYWN0ZWRgIGFuZCB0aGUgcmVhc29uIGhhc2gsIHNvIG1pc3Rha2VzIHN0YXkgdmlzaWJsZS4AAAAAAAdyZXRyYWN0AAAAAAMAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAAAAAAZyZWFzb24AAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAEFSZXBsYWNlcyB0aGUgY29udHJhY3QgY29kZS4gU3RvcmFnZSBhbmQgdGhlIGNvbnRyYWN0IGlkIGFyZSBrZXB0LgAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==", "AAAAAAAAAAAAAAAJaW5kaWNhdG9yAAAAAAAAAQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAA+gAAAfQAAAACUluZGljYXRvcgAAAA==", "AAAAAAAAAAAAAAAJdGhyZXNob2xkAAAAAAAAAAAAAAEAAAAE", "AAAAAAAAAAAAAAAKaXNfY3VyYXRvcgAAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAE=", "AAAAAAAAAAAAAAALYWRkX2N1cmF0b3IAAAAAAQAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAANFLZWVwcyBhIHJlcG8ncyBuZXdlc3QgYXR0ZXN0YXRpb24gYW5kIGl0cyBoaXN0b3J5IGNvdW50IGZyb20gYmVpbmcKYXJjaGl2ZWQuIEFueW9uZSBtYXkgY2FsbCBpdCBhbmQgcGF5IHRoZSBmZWU7IG9sZGVyIGhpc3RvcnkgZW50cmllcwphcmUgbGVmdCB0byBleHBpcmUgYW5kIGNhbiBiZSByZXN0b3JlZC4gUmV0dXJucyBmYWxzZSBmb3IgYW4gdW5rbm93bgpyZXBvLgAAAAAAAAtleHRlbmRfcmVwbwAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAAAQ==", "AAAAAAAAAAAAAAALaXNfYXR0ZXN0ZXIAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAE=", "AAAAAAAAADtTdGVwIDIgb2YgMjogdGhlIG9mZmVyZWQgYWRkcmVzcyBhY2NlcHRzIGFuZCBiZWNvbWVzIGFkbWluLgAAAAAMYWNjZXB0X2FkbWluAAAAAAAAAAEAAAPpAAAAAgAAAAM=", "AAAAAAAAAAAAAAAMYWRkX2F0dGVzdGVyAAAAAQAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAKRUcnVlIG9ubHkgZm9yIGBhY3RpdmVgIGluZGljYXRvcnMuIFByb3Bvc2VkIGFuZCByZXRyYWN0ZWQgb25lcyBhcmUgbm90Cmtub3duIGJhZC4gQW4gYWN0aXZlIGluZGljYXRvciB0aGF0IGlzIGJlaW5nIGNoZWNrZWQgaXMgaW4gdXNlLCBzbwp0aGlzIGFsc28gZXh0ZW5kcyBpdHMgVFRMLgAAAAxpc19rbm93bl9iYWQAAAABAAAAAAAAAARoYXNoAAAD7gAAACAAAAABAAAAAQ==", "AAAAAAAAAK9SdW5zIG9uY2UgYXQgZGVwbG95IHRpbWUuIGBhZG1pbmAgc2hvdWxkIGJlIGEgbXVsdGlzaWcgYWNjb3VudC4KUnVubmluZyBzZXR1cCBpbiB0aGUgY29uc3RydWN0b3IgKGluc3RlYWQgb2YgYSBzZXBhcmF0ZSBgaW5pdGAgY2FsbCkKbWVhbnMgbm9ib2R5IGNhbiBmcm9udC1ydW4gaW5pdGlhbGl6YXRpb24uAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAl0aHJlc2hvbGQAAAAAAAAEAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAAAAAAANY3VyYXRvcl9jb3VudAAAAAAAAAAAAAABAAAABA==", "AAAAAAAAAD1BZG1pbiB0aGF0IGhhcyBiZWVuIG9mZmVyZWQgdGhlIHJvbGUgYW5kIG5vdCB5ZXQgYWNjZXB0ZWQgaXQuAAAAAAAADXBlbmRpbmdfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT", "AAAAAAAAAGRTZXRzIE0gaW4gdGhlIE0tb2YtTiBhcHByb3ZhbCBydWxlLiBNIG11c3QgYmUgYXQgbGVhc3QgMiBhbmQgYXQgbW9zdAp0aGUgY3VycmVudCBudW1iZXIgb2YgY3VyYXRvcnMuAAAADXNldF90aHJlc2hvbGQAAAAAAAABAAAAAAAAAAl0aHJlc2hvbGQAAAAAAAAEAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAK1SZW1vdmVzIGEgY3VyYXRvci4gT25jZSB0aGVyZSBhcmUgYXQgbGVhc3QgYHRocmVzaG9sZGAgY3VyYXRvcnMsIGEKcmVtb3ZhbCB0aGF0IHdvdWxkIHRha2UgdGhlIGNvdW50IGJlbG93IHRoZSB0aHJlc2hvbGQgaXMgcmVqZWN0ZWQ6CmFkZCB0aGUgcmVwbGFjZW1lbnQgZmlyc3QsIHRoZW4gcmVtb3ZlLgAAAAAAAA5yZW1vdmVfY3VyYXRvcgAAAAAAAQAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAMlTdGVwIDEgb2YgMjogdGhlIGFkbWluIG9mZmVycyB0aGUgcm9sZSB0byBgbmV3X2FkbWluYC4gTm90aGluZyBjaGFuZ2VzCnVudGlsIGBuZXdfYWRtaW5gIGNhbGxzIGBhY2NlcHRfYWRtaW5gLCBzbyB0aGUgcm9sZSBjYW4ndCBiZSBzZW50IHRvCmFuIGFkZHJlc3Mgbm9ib2R5IGNvbnRyb2xzLiBBIHNlY29uZCBjYWxsIHJlcGxhY2VzIHRoZSBvZmZlci4AAAAAAAAOdHJhbnNmZXJfYWRtaW4AAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAA", "AAAAAAAAAAAAAAAPcmVtb3ZlX2F0dGVzdGVyAAAAAAEAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAEAAAPpAAAAAgAAAAM=", "AAAAAAAAAF5LZWVwcyBhbiBpbmRpY2F0b3IgZnJvbSBiZWluZyBhcmNoaXZlZC4gQW55b25lIG1heSBjYWxsIGl0LiBSZXR1cm5zCmZhbHNlIGZvciBhbiB1bmtub3duIGhhc2guAAAAAAAQZXh0ZW5kX2luZGljYXRvcgAAAAEAAAAAAAAABGhhc2gAAAPuAAAAIAAAAAEAAAAB", "AAAAAAAAAAAAAAARYXR0ZXN0YXRpb25fY291bnQAAAAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAABA==", "AAAAAAAAAWRNYXJrcyBhdHRlc3RhdGlvbiBgaW5kZXhgIG9mIGByZXBvYCBhcyByZXRyYWN0ZWQuIEFsbG93ZWQgZm9yIHRoZQphdHRlc3RlciB3aG8gd3JvdGUgaXQgd2hpbGUgdGhleSBzdGlsbCBob2xkIHRoZSBhdHRlc3RlciByb2xlLCBhbmQgZm9yCnRoZSBhZG1pbiwgZS5nLiBhZnRlciBhbiBhdHRlc3RlciBrZXkgd2FzIGNvbXByb21pc2VkLiBUaGUgZW50cnkgc3RheXMKaW4gdGhlIGhpc3Rvcnkgd2l0aCBgcmV0cmFjdGVkX2J5YCBhbmQgYHJldHJhY3RfcmVhc29uYCBzZXQsIGFuZApgbGF0ZXN0YCBrZWVwcyByZXR1cm5pbmcgaXQgaWYgaXQgaXMgdGhlIG5ld2VzdDsgcmVhZGVycyBtdXN0IGNoZWNrCmByZXRyYWN0ZWRfYnlgLgAAABNyZXRyYWN0X2F0dGVzdGF0aW9uAAAAAAQAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAARyZXBvAAAD7gAAACAAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAEAAAPpAAAAAgAAAAM=", "AAAAAAAAACZXaXRoZHJhd3MgYSBwZW5kaW5nIG9mZmVyLiBBZG1pbiBvbmx5LgAAAAAAFWNhbmNlbF9hZG1pbl90cmFuc2ZlcgAAAAAAAAAAAAABAAAD6QAAAAIAAAAD", "AAAAAQAAAD1BIGZpbmdlcnByaW50IG9mIGEgZmlsZSBjb25maXJtZWQgKG9yIHByb3Bvc2VkKSBhcyBtYWxpY2lvdXMuAAAAAAAAAAAAAAlJbmRpY2F0b3IAAAAAAAAJAAAAR0N1cmF0b3JzIHdobyBhcHByb3ZlZCBpdCwgaW4gb3JkZXIuIFRoZSBwcm9wb3NlciBpcyB0aGUgZmlyc3QgYXBwcm92YWwuAAAAAAlhcHByb3ZhbHMAAAAAAAPqAAAAEwAAAAAAAAAIY2FtcGFpZ24AAAARAAAAAAAAAAhldmlkZW5jZQAAA+4AAAAgAAAAAAAAAARoYXNoAAAD7gAAACAAAAAAAAAABGtpbmQAAAARAAAAIUxlZGdlciB0aW1lc3RhbXAgb2YgdGhlIHByb3Bvc2FsLgAAAAAAAAtwcm9wb3NlZF9hdAAAAAAGAAAAM0hhc2ggb2YgdGhlIHB1YmxpYyByZXRyYWN0aW9uIG5vdGljZSwgaWYgcmV0cmFjdGVkLgAAAAAOcmV0cmFjdF9yZWFzb24AAAAAA+gAAAPuAAAAIAAAACdDdXJhdG9yIHdobyByZXRyYWN0ZWQgaXQsIGlmIHJldHJhY3RlZC4AAAAADHJldHJhY3RlZF9ieQAAA+gAAAATAAAAJGBwcm9wb3NlZGAsIGBhY3RpdmVgIG9yIGByZXRyYWN0ZWRgLgAAAAZzdGF0dXMAAAAAABE=", "AAAAAQAAADtBIHN0b3JlZCBzY2FuIGF0dGVzdGF0aW9uIGZvciBvbmUgY29tbWl0IG9mIG9uZSByZXBvc2l0b3J5LgAAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAoAAAAeTGVkZ2VyIHRpbWVzdGFtcCBvZiB0aGUgd3JpdGUuAAAAAAACYXQAAAAAAAYAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAGY29tbWl0AAAAAAAOAAAAAAAAAARyZXBvAAAD7gAAACAAAAAAAAAABnJlcG9ydAAAAAAD7gAAACAAAAAzSGFzaCBvZiB0aGUgcHVibGljIHJldHJhY3Rpb24gbm90aWNlLCBpZiByZXRyYWN0ZWQuAAAAAA5yZXRyYWN0X3JlYXNvbgAAAAAD6AAAA+4AAAAgAAAAOldobyByZXRyYWN0ZWQgaXQsIGlmIHJldHJhY3RlZDogdGhlIGF0dGVzdGVyIG9yIHRoZSBhZG1pbi4AAAAAAAxyZXRyYWN0ZWRfYnkAAAPoAAAAEwAAAAAAAAAFcnVsZXMAAAAAAAPuAAAAIAAAAAAAAAAHc2Nhbm5lcgAAAAAEAAAAAAAAAAd2ZXJkaWN0AAAAABE=", "AAAAAQAAAExJbmRpY2F0b3IgcHJvcG9zZWQgYnkgYSBjdXJhdG9yLiBUaGUgY29udHJhY3QgZmlsbHMgaW4gc3RhdHVzIGFuZCBhcHByb3ZhbHMuAAAAAAAAAA5JbmRpY2F0b3JJbnB1dAAAAAAABAAAADxDYW1wYWlnbiBsYWJlbCwgZS5nLiBgcG9saW5yaWRlcmAsIGBnaG9zdGFjdGlvbmAsIGB1bmtub3duYC4AAAAIY2FtcGFpZ24AAAARAAAAKEhhc2ggb2YgdGhlIHB1YmxpYyB3cml0ZS11cCBvciBhZHZpc29yeS4AAAAIZXZpZGVuY2UAAAPuAAAAIAAAAB5TSEEtMjU2IG9mIHRoZSBtYWxpY2lvdXMgZmlsZS4AAAAAAARoYXNoAAAD7gAAACAAAAAwYHRhc2tgLCBgZm9udGAsIGBjb25maWdgLCBgc2NyaXB0YCBvciBgcGFja2FnZWAuAAAABGtpbmQAAAAR", "AAAAAQAAAExTY2FuIHJlc3VsdCBzdWJtaXR0ZWQgYnkgYW4gYXR0ZXN0ZXIuIFRoZSBjb250cmFjdCBhZGRzIGBhdHRlc3RlcmAgYW5kIGBhdGAuAAAAAAAAABBBdHRlc3RhdGlvbklucHV0AAAABgAAADpSYXcgZ2l0IGNvbW1pdCBpZDogMjAgYnl0ZXMgKFNIQS0xKSBvciAzMiBieXRlcyAoU0hBLTI1NikuAAAAAAAGY29tbWl0AAAAAAAOAAAAQFNIQS0yNTYgb2YgdGhlIG5vcm1hbGl6ZWQgcmVwbyBpZCwgZS5nLiBgZ2l0aHViLmNvbS9vd25lci9yZXBvYC4AAAAEcmVwbwAAA+4AAAAgAAAAMlNIQS0yNTYgb2YgdGhlIGZ1bGwgSlNPTiByZXBvcnQsIHN0b3JlZCBvZmYtY2hhaW4uAAAAAAAGcmVwb3J0AAAAAAPuAAAAIAAAAChIYXNoIG9mIHRoZSBydWxlIGFuZCBpbmRpY2F0b3Igc2V0IHVzZWQuAAAABXJ1bGVzAAAAAAAD7gAAACAAAAAtRG9tZSBlbmdpbmUgdmVyc2lvbiB0aGF0IHByb2R1Y2VkIHRoZSByZXN1bHQuAAAAAAAAB3NjYW5uZXIAAAAABAAAACtgY2xlYW5gLCBgcmV2aWV3YCwgYGJsb2NrYCBvciBgdW5yZWFkYWJsZWAuAAAAAAd2ZXJkaWN0AAAAABE=", "AAAABAAAAIJFcnJvcnMgcmV0dXJuZWQgYnkgdGhlIHJlZ2lzdHJ5LiBDb2RlcyBhcmUgcGFydCBvZiB0aGUgcHVibGljIGludGVyZmFjZToKbmV2ZXIgcmVudW1iZXIgYW4gZXhpc3RpbmcgdmFyaWFudCwgb25seSBhcHBlbmQgbmV3IG9uZXMuAAAAAAAAAAAABUVycm9yAAAAAAAAFAAAADVUaHJlc2hvbGQgaXMgYmVsb3cgW2BjcmF0ZTo6c3RvcmFnZTo6TUlOX1RIUkVTSE9MRGBdLgAAAAAAABBJbnZhbGlkVGhyZXNob2xkAAAAAQAAAC1BZGRyZXNzIGFscmVhZHkgaG9sZHMgdGhlIHJvbGUgYmVpbmcgZ3JhbnRlZC4AAAAAAAASUm9sZUFscmVhZHlHcmFudGVkAAAAAAACAAAALUFkZHJlc3MgZG9lcyBub3QgaG9sZCB0aGUgcm9sZSBiZWluZyByZXZva2VkLgAAAAAAAA5Sb2xlTm90R3JhbnRlZAAAAAAAAwAAACRDYWxsZXIgaXMgbm90IGEgcmVnaXN0ZXJlZCBhdHRlc3Rlci4AAAALTm90QXR0ZXN0ZXIAAAAABAAAAD9WZXJkaWN0IGlzIG5vdCBvbmUgb2YgYGNsZWFuYCwgYHJldmlld2AsIGBibG9ja2AsIGB1bnJlYWRhYmxlYC4AAAAADkludmFsaWRWZXJkaWN0AAAAAAAFAAAANkNvbW1pdCBpZCBpcyBub3QgMjAgKFNIQS0xKSBvciAzMiAoU0hBLTI1NikgcmF3IGJ5dGVzLgAAAAAADUludmFsaWRDb21taXQAAAAAAAAGAAAAIVNjYW5uZXIgdmVyc2lvbiBtdXN0IGJlIG5vbi16ZXJvLgAAAAAAAA5JbnZhbGlkU2Nhbm5lcgAAAAAABwAAAD9QYWdpbmF0aW9uIGxpbWl0IGlzIHplcm8gb3IgYWJvdmUgW2BjcmF0ZTo6c3RvcmFnZTo6TUFYX1BBR0VgXS4AAAAADEludmFsaWRMaW1pdAAAAAgAAAAjQ2FsbGVyIGlzIG5vdCBhIHJlZ2lzdGVyZWQgY3VyYXRvci4AAAAACk5vdEN1cmF0b3IAAAAAAAkAAABLSW5kaWNhdG9yIGtpbmQgaXMgbm90IG9uZSBvZiBgdGFza2AsIGBmb250YCwgYGNvbmZpZ2AsIGBzY3JpcHRgLCBgcGFja2FnZWAuAAAAAAtJbnZhbGlkS2luZAAAAAAKAAAAPUEgcHJvcG9zZWQgb3IgYWN0aXZlIGluZGljYXRvciB3aXRoIHRoaXMgaGFzaCBhbHJlYWR5IGV4aXN0cy4AAAAAAAAPSW5kaWNhdG9yRXhpc3RzAAAAAAsAAAAcTm8gaW5kaWNhdG9yIHdpdGggdGhpcyBoYXNoLgAAABFJbmRpY2F0b3JOb3RGb3VuZAAAAAAAAAwAAAAsQ3VyYXRvciBoYXMgYWxyZWFkeSBhcHByb3ZlZCB0aGlzIGluZGljYXRvci4AAAAPQWxyZWFkeUFwcHJvdmVkAAAAAA0AAAA2SW5kaWNhdG9yIGhhcyBiZWVuIHJldHJhY3RlZCBhbmQgY2FuIG5vIGxvbmdlciBjaGFuZ2UuAAAAAAASSW5kaWNhdG9yUmV0cmFjdGVkAAAAAAAOAAAAK05vIGF0dGVzdGF0aW9uIGF0IHRoaXMgaW5kZXggZm9yIHRoaXMgcmVwby4AAAAAE0F0dGVzdGF0aW9uTm90Rm91bmQAAAAADwAAACdBdHRlc3RhdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJldHJhY3RlZC4AAAAAFEF0dGVzdGF0aW9uUmV0cmFjdGVkAAAAEAAAAENPbmx5IHRoZSBvcmlnaW5hbCBhdHRlc3RlciBvciB0aGUgYWRtaW4gbWF5IHJldHJhY3QgYW4gYXR0ZXN0YXRpb24uAAAAABNOb3RBbGxvd2VkVG9SZXRyYWN0AAAAABEAAABFVGhyZXNob2xkIGlzIGFib3ZlIHRoZSBudW1iZXIgb2YgY3VyYXRvcnMsIHNvIG5vdGhpbmcgY291bGQgYWN0aXZhdGUuAAAAAAAAFlRocmVzaG9sZEFib3ZlQ3VyYXRvcnMAAAAAABIAAABEUmVtb3ZpbmcgdGhpcyBjdXJhdG9yIHdvdWxkIGxlYXZlIGZld2VyIGN1cmF0b3JzIHRoYW4gdGhlIHRocmVzaG9sZC4AAAAWQ3VyYXRvcnNCZWxvd1RocmVzaG9sZAAAAAAAEwAAAB1ObyBhZG1pbiB0cmFuc2ZlciBpcyBwZW5kaW5nLgAAAAAAAA5Ob1BlbmRpbmdBZG1pbgAAAAAAFA==", "AAAABQAAAF1BIGN1cmF0b3IgYXBwcm92ZWQgYW4gaW5kaWNhdG9yLiBgc3RhdHVzYCBpcyBgYWN0aXZlYCBvbmNlIHRoZSBhcHByb3ZhbAp0aHJlc2hvbGQgaXMgcmVhY2hlZC4AAAAAAAAAAAAACEFwcHJvdmVkAAAAAQAAAAdhcHByb3ZlAAAAAAQAAAAAAAAABGhhc2gAAAPuAAAAIAAAAAEAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAAAAAACWFwcHJvdmFscwAAAAAAAAQAAAAAAAAAAAAAAAZzdGF0dXMAAAAAABEAAAAAAAAAAg==", "AAAABQAAAGlBIHNjYW4gYXR0ZXN0YXRpb24gd2FzIHB1Ymxpc2hlZC4gYGluZGV4YCBpcyBpdHMgcG9zaXRpb24gaW4gdGhlIHJlcG8ncwpoaXN0b3J5LCByZWFkYWJsZSB3aXRoIGBoaXN0b3J5YC4AAAAAAAAAAAAACEF0dGVzdGVkAAAAAQAAAAZhdHRlc3QAAAAAAAUAAAAAAAAABHJlcG8AAAPuAAAAIAAAAAEAAAAAAAAAB3ZlcmRpY3QAAAAAEQAAAAEAAAAAAAAABmNvbW1pdAAAAAAADgAAAAAAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAC", "AAAABQAAAE5BIGN1cmF0b3IgcHJvcG9zZWQgYSBuZXcgaW5kaWNhdG9yLiBUaGUgcHJvcG9zYWwgY291bnRzIGFzIHRoZSBmaXJzdAphcHByb3ZhbC4AAAAAAAAAAAAIUHJvcG9zZWQAAAABAAAAB3Byb3Bvc2UAAAAABQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAAAAAAEa2luZAAAABEAAAAAAAAAAAAAAAhjYW1wYWlnbgAAABEAAAAAAAAAAAAAAAhldmlkZW5jZQAAA+4AAAAgAAAAAAAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAAAAAAI=", "AAAABQAAAAAAAAAAAAAACFVwZ3JhZGVkAAAAAQAAAAh1cGdyYWRlZAAAAAEAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAAAAAAI=", "AAAABQAAAM5BbiBpbmRpY2F0b3IgcmVhY2hlZCB0aGUgYXBwcm92YWwgdGhyZXNob2xkIGFuZCBpcyBub3cgYGFjdGl2ZWAsIGkuZS4KYGlzX2tub3duX2JhZGAgcmV0dXJucyB0cnVlLiBFbWl0dGVkIHJpZ2h0IGFmdGVyIHRoZSBgYXBwcm92ZWAgZXZlbnQgdGhhdApjYXVzZWQgaXQuIGBhcHByb3ZhbHNgIGNvdW50cyBhcHByb3ZhbHMgZnJvbSBjdXJyZW50IGN1cmF0b3JzLgAAAAAAAAAAAAlBY3RpdmF0ZWQAAAAAAAABAAAACGFjdGl2YXRlAAAAAgAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAAAAAAJYXBwcm92YWxzAAAAAAAABAAAAAAAAAAC", "AAAABQAAAFdBIGN1cmF0b3IgcmV0cmFjdGVkIGFuIGluZGljYXRvci4gYHJlYXNvbmAgaXMgdGhlIGhhc2ggb2YgdGhlIHB1YmxpYwpyZXRyYWN0aW9uIG5vdGljZS4AAAAAAAAAAAlSZXRyYWN0ZWQAAAAAAAABAAAAB3JldHJhY3QAAAAAAwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAAAAAAC", "AAAABQAAAEFBIHJvbGUgd2FzIGdyYW50ZWQgb3IgcmV2b2tlZC4gYHJvbGVgIGlzIGBjdXJhdG9yYCBvciBgYXR0ZXN0ZXJgLgAAAAAAAAAAAAALUm9sZUdyYW50ZWQAAAAAAQAAAAxyb2xlX2dyYW50ZWQAAAACAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAAAAAAB2FjY291bnQAAAAAEwAAAAEAAAAC", "AAAABQAAAAAAAAAAAAAAC1JvbGVSZXZva2VkAAAAAAEAAAAMcm9sZV9yZXZva2VkAAAAAgAAAAAAAAAEcm9sZQAAABEAAAABAAAAAAAAAAdhY2NvdW50AAAAABMAAAABAAAAAg==", "AAAABQAAADdgbmV3YCBhY2NlcHRlZCB0aGUgYWRtaW4gcm9sZSBmcm9tIGBvbGRgIChzdGVwIDIgb2YgMikuAAAAAAAAAAAMQWRtaW5DaGFuZ2VkAAAAAQAAAA1hZG1pbl9jaGFuZ2VkAAAAAAAAAgAAAAAAAAADb2xkAAAAABMAAAAAAAAAAAAAAANuZXcAAAAAEwAAAAAAAAAC", "AAAABQAAAAAAAAAAAAAAEFRocmVzaG9sZENoYW5nZWQAAAABAAAAEXRocmVzaG9sZF9jaGFuZ2VkAAAAAAAAAQAAAAAAAAAJdGhyZXNob2xkAAAAAAAABAAAAAAAAAAC", "AAAABQAAADZUaGUgYWRtaW4gb2ZmZXJlZCBpdHMgcm9sZSB0byBgcGVuZGluZ2AgKHN0ZXAgMSBvZiAyKS4AAAAAAAAAAAAUQWRtaW5UcmFuc2ZlclN0YXJ0ZWQAAAABAAAADmFkbWluX3Byb3Bvc2VkAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAAAAAAAdwZW5kaW5nAAAAABMAAAAAAAAAAg==", "AAAABQAAAHBBbiBhdHRlc3RhdGlvbiB3YXMgcmV0cmFjdGVkIGJ5IGl0cyBhdHRlc3RlciBvciB0aGUgYWRtaW4uIGByZWFzb25gIGlzCnRoZSBoYXNoIG9mIHRoZSBwdWJsaWMgcmV0cmFjdGlvbiBub3RpY2UuAAAAAAAAABRBdHRlc3RhdGlvblJldHJhY3RlZAAAAAEAAAAOcmV0cmFjdF9hdHRlc3QAAAAAAAQAAAAAAAAABHJlcG8AAAPuAAAAIAAAAAEAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAAAAAAC", "AAAABQAAACpUaGUgYWRtaW4gd2l0aGRyZXcgaXRzIG9mZmVyIHRvIGBwZW5kaW5nYC4AAAAAAAAAAAAWQWRtaW5UcmFuc2ZlckNhbmNlbGxlZAAAAAAAAQAAAA9hZG1pbl9jYW5jZWxsZWQAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAAAAAAHcGVuZGluZwAAAAATAAAAAAAAAAI="]),
      options
    );
  }

   static deploy<T = Client>(args: { admin: string | Address; threshold: number }, options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(args, options);
  }
  public readonly fromJson = {
    admin : this.txFromJson<string>,  attest : this.txFromJson<Result<number, Error>>,  latest : this.txFromJson<Attestation | null>,  approve : this.txFromJson<Result<null, Error>>,  history : this.txFromJson<Result<Array<Attestation>, Error>>,  propose : this.txFromJson<Result<null, Error>>,  retract : this.txFromJson<Result<null, Error>>,  upgrade : this.txFromJson<void>,  indicator : this.txFromJson<Indicator | null>,  threshold : this.txFromJson<number>,  is_curator : this.txFromJson<boolean>,  add_curator : this.txFromJson<Result<null, Error>>,  extend_repo : this.txFromJson<boolean>,  is_attester : this.txFromJson<boolean>,  accept_admin : this.txFromJson<Result<null, Error>>,  add_attester : this.txFromJson<Result<null, Error>>,  is_known_bad : this.txFromJson<boolean>,  curator_count : this.txFromJson<number>,  pending_admin : this.txFromJson<string | null>,  set_threshold : this.txFromJson<Result<null, Error>>,  remove_curator : this.txFromJson<Result<null, Error>>,  transfer_admin : this.txFromJson<void>,  remove_attester : this.txFromJson<Result<null, Error>>,  extend_indicator : this.txFromJson<boolean>,  attestation_count : this.txFromJson<number>,  retract_attestation : this.txFromJson<Result<null, Error>>,  cancel_admin_transfer : this.txFromJson<Result<null, Error>>
  };

  /** @deprecated Use fromJson instead. */
  public readonly fromJSON = this.fromJson;

  /**
   * Parse a raw contract event (topics + data) into a typed {@link ContractEvent}.
   */
  parseEvent(topics: xdr.ScVal[] | string[], data: xdr.ScVal | string): ContractEvent | undefined {
    return this.spec.parseEvent(topics, data) as ContractEvent | undefined;
  }
  /**
   * Build a topics filter row for the "Approved" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  approvedEventFilter(topicValues?: { hash?: Uint8Array }): string[] {
    return this.spec.eventTopicFilter("Approved", topicValues);
  }
  /**
   * Build a topics filter row for the "Attested" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  attestedEventFilter(topicValues?: { repo?: Uint8Array; verdict?: string }): string[] {
    return this.spec.eventTopicFilter("Attested", topicValues);
  }
  /**
   * Build a topics filter row for the "Proposed" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  proposedEventFilter(topicValues?: { hash?: Uint8Array }): string[] {
    return this.spec.eventTopicFilter("Proposed", topicValues);
  }
  /**
   * Build a topics filter row for the "Upgraded" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  upgradedEventFilter(): string[] {
    return this.spec.eventTopicFilter("Upgraded");
  }
  /**
   * Build a topics filter row for the "Activated" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  activatedEventFilter(topicValues?: { hash?: Uint8Array }): string[] {
    return this.spec.eventTopicFilter("Activated", topicValues);
  }
  /**
   * Build a topics filter row for the "Retracted" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  retractedEventFilter(topicValues?: { hash?: Uint8Array }): string[] {
    return this.spec.eventTopicFilter("Retracted", topicValues);
  }
  /**
   * Build a topics filter row for the "RoleGranted" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  roleGrantedEventFilter(topicValues?: { role?: string; account?: string | Address }): string[] {
    return this.spec.eventTopicFilter("RoleGranted", topicValues);
  }
  /**
   * Build a topics filter row for the "RoleRevoked" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  roleRevokedEventFilter(topicValues?: { role?: string; account?: string | Address }): string[] {
    return this.spec.eventTopicFilter("RoleRevoked", topicValues);
  }
  /**
   * Build a topics filter row for the "AdminChanged" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  adminChangedEventFilter(): string[] {
    return this.spec.eventTopicFilter("AdminChanged");
  }
  /**
   * Build a topics filter row for the "ThresholdChanged" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  thresholdChangedEventFilter(): string[] {
    return this.spec.eventTopicFilter("ThresholdChanged");
  }
  /**
   * Build a topics filter row for the "AdminTransferStarted" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  adminTransferStartedEventFilter(): string[] {
    return this.spec.eventTopicFilter("AdminTransferStarted");
  }
  /**
   * Build a topics filter row for the "AttestationRetracted" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  attestationRetractedEventFilter(topicValues?: { repo?: Uint8Array }): string[] {
    return this.spec.eventTopicFilter("AttestationRetracted", topicValues);
  }
  /**
   * Build a topics filter row for the "AdminTransferCancelled" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  adminTransferCancelledEventFilter(): string[] {
    return this.spec.eventTopicFilter("AdminTransferCancelled");
  }
}