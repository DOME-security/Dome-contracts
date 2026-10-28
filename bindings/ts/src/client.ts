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
  /**
   * Hands the admin role to `new_admin`. Both must sign so the role can't
   * be sent to an address nobody controls.
   */
  set_admin(args: { new_admin: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
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
  add_attester(args: { attester: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  /**
   * True only for `active` indicators. Proposed and retracted ones are not
   * known bad.
   */
  is_known_bad(args: { hash: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  set_threshold(args: { threshold: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
  remove_curator(args: { curator: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Error>>>;
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
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=", "AAAAAAAAAHtQdWJsaXNoZXMgdGhlIHJlc3VsdCBvZiBhIHNjYW4gb2Ygb25lIGNvbW1pdC4gRWFybGllciBhdHRlc3RhdGlvbnMgZm9yCnRoZSBzYW1lIHJlcG8gYXJlIGtlcHQ7IGBsYXRlc3RgIHJldHVybnMgdGhlIG5ld2VzdC4AAAAABmF0dGVzdAAAAAAAAgAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAAFhAAAAAAAH0AAAABBBdHRlc3RhdGlvbklucHV0AAAAAQAAA+kAAAAEAAAAAw==", "AAAAAAAAAAAAAAAGbGF0ZXN0AAAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAD6AAAB9AAAAALQXR0ZXN0YXRpb24A", "AAAAAAAAAK9BZGRzIGEgY3VyYXRvcidzIGFwcHJvdmFsLiBUaGUgaW5kaWNhdG9yIGJlY29tZXMgYGFjdGl2ZWAgb25jZQphcHByb3ZhbHMgZnJvbSBjdXJyZW50IGN1cmF0b3JzIHJlYWNoIHRoZSB0aHJlc2hvbGQ7IGFwcHJvdmFscyBmcm9tCmN1cmF0b3JzIHJlbW92ZWQgc2luY2UgdGhlbiBubyBsb25nZXIgY291bnQuAAAAAAdhcHByb3ZlAAAAAAIAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAGNBdHRlc3RhdGlvbnMgZm9yIGByZXBvYCwgb2xkZXN0IGZpcnN0LCBzdGFydGluZyBhdCBpbmRleCBgc3RhcnRgLgpgbGltaXRgIG11c3QgYmUgYmV0d2VlbiAxIGFuZCA1MC4AAAAAB2hpc3RvcnkAAAAAAwAAAAAAAAAEcmVwbwAAA+4AAAAgAAAAAAAAAAVzdGFydAAAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPpAAAD6gAAB9AAAAALQXR0ZXN0YXRpb24AAAAAAw==", "AAAAAAAAAIRQcm9wb3NlcyBhIGZpbmdlcnByaW50IG9mIGEgbWFsaWNpb3VzIGZpbGUuIFRoZSBwcm9wb3NlcidzIGFwcHJvdmFsIGlzCmNvdW50ZWQsIHNvIHdpdGggYSB0aHJlc2hvbGQgb2YgTSBpdCBuZWVkcyBNLTEgbW9yZSBjdXJhdG9ycy4AAAAHcHJvcG9zZQAAAAACAAAAAAAAAAdjdXJhdG9yAAAAABMAAAAAAAAAAWkAAAAAAAfQAAAADkluZGljYXRvcklucHV0AAAAAAABAAAD6QAAAAIAAAAD", "AAAAAAAAAIpSZXRyYWN0cyBhbiBpbmRpY2F0b3IsIHByb3Bvc2VkIG9yIGFjdGl2ZS4gVGhlIGVudHJ5IHN0YXlzIHJlYWRhYmxlCndpdGggc3RhdHVzIGByZXRyYWN0ZWRgIGFuZCB0aGUgcmVhc29uIGhhc2gsIHNvIG1pc3Rha2VzIHN0YXkgdmlzaWJsZS4AAAAAAAdyZXRyYWN0AAAAAAMAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAAAAAAZyZWFzb24AAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAEFSZXBsYWNlcyB0aGUgY29udHJhY3QgY29kZS4gU3RvcmFnZSBhbmQgdGhlIGNvbnRyYWN0IGlkIGFyZSBrZXB0LgAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==", "AAAAAAAAAAAAAAAJaW5kaWNhdG9yAAAAAAAAAQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAA+gAAAfQAAAACUluZGljYXRvcgAAAA==", "AAAAAAAAAGxIYW5kcyB0aGUgYWRtaW4gcm9sZSB0byBgbmV3X2FkbWluYC4gQm90aCBtdXN0IHNpZ24gc28gdGhlIHJvbGUgY2FuJ3QKYmUgc2VudCB0byBhbiBhZGRyZXNzIG5vYm9keSBjb250cm9scy4AAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=", "AAAAAAAAAAAAAAAJdGhyZXNob2xkAAAAAAAAAAAAAAEAAAAE", "AAAAAAAAAAAAAAAKaXNfY3VyYXRvcgAAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAE=", "AAAAAAAAAAAAAAALYWRkX2N1cmF0b3IAAAAAAQAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAANFLZWVwcyBhIHJlcG8ncyBuZXdlc3QgYXR0ZXN0YXRpb24gYW5kIGl0cyBoaXN0b3J5IGNvdW50IGZyb20gYmVpbmcKYXJjaGl2ZWQuIEFueW9uZSBtYXkgY2FsbCBpdCBhbmQgcGF5IHRoZSBmZWU7IG9sZGVyIGhpc3RvcnkgZW50cmllcwphcmUgbGVmdCB0byBleHBpcmUgYW5kIGNhbiBiZSByZXN0b3JlZC4gUmV0dXJucyBmYWxzZSBmb3IgYW4gdW5rbm93bgpyZXBvLgAAAAAAAAtleHRlbmRfcmVwbwAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAAAQ==", "AAAAAAAAAAAAAAALaXNfYXR0ZXN0ZXIAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAE=", "AAAAAAAAAAAAAAAMYWRkX2F0dGVzdGVyAAAAAQAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAFFUcnVlIG9ubHkgZm9yIGBhY3RpdmVgIGluZGljYXRvcnMuIFByb3Bvc2VkIGFuZCByZXRyYWN0ZWQgb25lcyBhcmUgbm90Cmtub3duIGJhZC4AAAAAAAAMaXNfa25vd25fYmFkAAAAAQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAE=", "AAAAAAAAAK9SdW5zIG9uY2UgYXQgZGVwbG95IHRpbWUuIGBhZG1pbmAgc2hvdWxkIGJlIGEgbXVsdGlzaWcgYWNjb3VudC4KUnVubmluZyBzZXR1cCBpbiB0aGUgY29uc3RydWN0b3IgKGluc3RlYWQgb2YgYSBzZXBhcmF0ZSBgaW5pdGAgY2FsbCkKbWVhbnMgbm9ib2R5IGNhbiBmcm9udC1ydW4gaW5pdGlhbGl6YXRpb24uAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAl0aHJlc2hvbGQAAAAAAAAEAAAAAQAAA+kAAAACAAAAAw==", "AAAAAAAAAAAAAAANc2V0X3RocmVzaG9sZAAAAAAAAAEAAAAAAAAACXRocmVzaG9sZAAAAAAAAAQAAAABAAAD6QAAAAIAAAAD", "AAAAAAAAAAAAAAAOcmVtb3ZlX2N1cmF0b3IAAAAAAAEAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAEAAAPpAAAAAgAAAAM=", "AAAAAAAAAAAAAAAPcmVtb3ZlX2F0dGVzdGVyAAAAAAEAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAEAAAPpAAAAAgAAAAM=", "AAAAAAAAAF5LZWVwcyBhbiBpbmRpY2F0b3IgZnJvbSBiZWluZyBhcmNoaXZlZC4gQW55b25lIG1heSBjYWxsIGl0LiBSZXR1cm5zCmZhbHNlIGZvciBhbiB1bmtub3duIGhhc2guAAAAAAAQZXh0ZW5kX2luZGljYXRvcgAAAAEAAAAAAAAABGhhc2gAAAPuAAAAIAAAAAEAAAAB", "AAAAAAAAAAAAAAARYXR0ZXN0YXRpb25fY291bnQAAAAAAAABAAAAAAAAAARyZXBvAAAD7gAAACAAAAABAAAABA==", "AAAAAAAAAWRNYXJrcyBhdHRlc3RhdGlvbiBgaW5kZXhgIG9mIGByZXBvYCBhcyByZXRyYWN0ZWQuIEFsbG93ZWQgZm9yIHRoZQphdHRlc3RlciB3aG8gd3JvdGUgaXQgd2hpbGUgdGhleSBzdGlsbCBob2xkIHRoZSBhdHRlc3RlciByb2xlLCBhbmQgZm9yCnRoZSBhZG1pbiwgZS5nLiBhZnRlciBhbiBhdHRlc3RlciBrZXkgd2FzIGNvbXByb21pc2VkLiBUaGUgZW50cnkgc3RheXMKaW4gdGhlIGhpc3Rvcnkgd2l0aCBgcmV0cmFjdGVkX2J5YCBhbmQgYHJldHJhY3RfcmVhc29uYCBzZXQsIGFuZApgbGF0ZXN0YCBrZWVwcyByZXR1cm5pbmcgaXQgaWYgaXQgaXMgdGhlIG5ld2VzdDsgcmVhZGVycyBtdXN0IGNoZWNrCmByZXRyYWN0ZWRfYnlgLgAAABNyZXRyYWN0X2F0dGVzdGF0aW9uAAAAAAQAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAARyZXBvAAAD7gAAACAAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAEAAAPpAAAAAgAAAAM=", "AAAAAQAAAD1BIGZpbmdlcnByaW50IG9mIGEgZmlsZSBjb25maXJtZWQgKG9yIHByb3Bvc2VkKSBhcyBtYWxpY2lvdXMuAAAAAAAAAAAAAAlJbmRpY2F0b3IAAAAAAAAJAAAAR0N1cmF0b3JzIHdobyBhcHByb3ZlZCBpdCwgaW4gb3JkZXIuIFRoZSBwcm9wb3NlciBpcyB0aGUgZmlyc3QgYXBwcm92YWwuAAAAAAlhcHByb3ZhbHMAAAAAAAPqAAAAEwAAAAAAAAAIY2FtcGFpZ24AAAARAAAAAAAAAAhldmlkZW5jZQAAA+4AAAAgAAAAAAAAAARoYXNoAAAD7gAAACAAAAAAAAAABGtpbmQAAAARAAAAIUxlZGdlciB0aW1lc3RhbXAgb2YgdGhlIHByb3Bvc2FsLgAAAAAAAAtwcm9wb3NlZF9hdAAAAAAGAAAAM0hhc2ggb2YgdGhlIHB1YmxpYyByZXRyYWN0aW9uIG5vdGljZSwgaWYgcmV0cmFjdGVkLgAAAAAOcmV0cmFjdF9yZWFzb24AAAAAA+gAAAPuAAAAIAAAACdDdXJhdG9yIHdobyByZXRyYWN0ZWQgaXQsIGlmIHJldHJhY3RlZC4AAAAADHJldHJhY3RlZF9ieQAAA+gAAAATAAAAJGBwcm9wb3NlZGAsIGBhY3RpdmVgIG9yIGByZXRyYWN0ZWRgLgAAAAZzdGF0dXMAAAAAABE=", "AAAAAQAAADtBIHN0b3JlZCBzY2FuIGF0dGVzdGF0aW9uIGZvciBvbmUgY29tbWl0IG9mIG9uZSByZXBvc2l0b3J5LgAAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAoAAAAeTGVkZ2VyIHRpbWVzdGFtcCBvZiB0aGUgd3JpdGUuAAAAAAACYXQAAAAAAAYAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAGY29tbWl0AAAAAAAOAAAAAAAAAARyZXBvAAAD7gAAACAAAAAAAAAABnJlcG9ydAAAAAAD7gAAACAAAAAzSGFzaCBvZiB0aGUgcHVibGljIHJldHJhY3Rpb24gbm90aWNlLCBpZiByZXRyYWN0ZWQuAAAAAA5yZXRyYWN0X3JlYXNvbgAAAAAD6AAAA+4AAAAgAAAAOldobyByZXRyYWN0ZWQgaXQsIGlmIHJldHJhY3RlZDogdGhlIGF0dGVzdGVyIG9yIHRoZSBhZG1pbi4AAAAAAAxyZXRyYWN0ZWRfYnkAAAPoAAAAEwAAAAAAAAAFcnVsZXMAAAAAAAPuAAAAIAAAAAAAAAAHc2Nhbm5lcgAAAAAEAAAAAAAAAAd2ZXJkaWN0AAAAABE=", "AAAAAQAAAExJbmRpY2F0b3IgcHJvcG9zZWQgYnkgYSBjdXJhdG9yLiBUaGUgY29udHJhY3QgZmlsbHMgaW4gc3RhdHVzIGFuZCBhcHByb3ZhbHMuAAAAAAAAAA5JbmRpY2F0b3JJbnB1dAAAAAAABAAAADxDYW1wYWlnbiBsYWJlbCwgZS5nLiBgcG9saW5yaWRlcmAsIGBnaG9zdGFjdGlvbmAsIGB1bmtub3duYC4AAAAIY2FtcGFpZ24AAAARAAAAKEhhc2ggb2YgdGhlIHB1YmxpYyB3cml0ZS11cCBvciBhZHZpc29yeS4AAAAIZXZpZGVuY2UAAAPuAAAAIAAAAB5TSEEtMjU2IG9mIHRoZSBtYWxpY2lvdXMgZmlsZS4AAAAAAARoYXNoAAAD7gAAACAAAAAwYHRhc2tgLCBgZm9udGAsIGBjb25maWdgLCBgc2NyaXB0YCBvciBgcGFja2FnZWAuAAAABGtpbmQAAAAR", "AAAAAQAAAExTY2FuIHJlc3VsdCBzdWJtaXR0ZWQgYnkgYW4gYXR0ZXN0ZXIuIFRoZSBjb250cmFjdCBhZGRzIGBhdHRlc3RlcmAgYW5kIGBhdGAuAAAAAAAAABBBdHRlc3RhdGlvbklucHV0AAAABgAAADpSYXcgZ2l0IGNvbW1pdCBpZDogMjAgYnl0ZXMgKFNIQS0xKSBvciAzMiBieXRlcyAoU0hBLTI1NikuAAAAAAAGY29tbWl0AAAAAAAOAAAAQFNIQS0yNTYgb2YgdGhlIG5vcm1hbGl6ZWQgcmVwbyBpZCwgZS5nLiBgZ2l0aHViLmNvbS9vd25lci9yZXBvYC4AAAAEcmVwbwAAA+4AAAAgAAAAMlNIQS0yNTYgb2YgdGhlIGZ1bGwgSlNPTiByZXBvcnQsIHN0b3JlZCBvZmYtY2hhaW4uAAAAAAAGcmVwb3J0AAAAAAPuAAAAIAAAAChIYXNoIG9mIHRoZSBydWxlIGFuZCBpbmRpY2F0b3Igc2V0IHVzZWQuAAAABXJ1bGVzAAAAAAAD7gAAACAAAAAtRG9tZSBlbmdpbmUgdmVyc2lvbiB0aGF0IHByb2R1Y2VkIHRoZSByZXN1bHQuAAAAAAAAB3NjYW5uZXIAAAAABAAAACtgY2xlYW5gLCBgcmV2aWV3YCwgYGJsb2NrYCBvciBgdW5yZWFkYWJsZWAuAAAAAAd2ZXJkaWN0AAAAABE=", "AAAABAAAAIJFcnJvcnMgcmV0dXJuZWQgYnkgdGhlIHJlZ2lzdHJ5LiBDb2RlcyBhcmUgcGFydCBvZiB0aGUgcHVibGljIGludGVyZmFjZToKbmV2ZXIgcmVudW1iZXIgYW4gZXhpc3RpbmcgdmFyaWFudCwgb25seSBhcHBlbmQgbmV3IG9uZXMuAAAAAAAAAAAABUVycm9yAAAAAAAAEQAAADVUaHJlc2hvbGQgaXMgYmVsb3cgW2BjcmF0ZTo6c3RvcmFnZTo6TUlOX1RIUkVTSE9MRGBdLgAAAAAAABBJbnZhbGlkVGhyZXNob2xkAAAAAQAAAC1BZGRyZXNzIGFscmVhZHkgaG9sZHMgdGhlIHJvbGUgYmVpbmcgZ3JhbnRlZC4AAAAAAAASUm9sZUFscmVhZHlHcmFudGVkAAAAAAACAAAALUFkZHJlc3MgZG9lcyBub3QgaG9sZCB0aGUgcm9sZSBiZWluZyByZXZva2VkLgAAAAAAAA5Sb2xlTm90R3JhbnRlZAAAAAAAAwAAACRDYWxsZXIgaXMgbm90IGEgcmVnaXN0ZXJlZCBhdHRlc3Rlci4AAAALTm90QXR0ZXN0ZXIAAAAABAAAAD9WZXJkaWN0IGlzIG5vdCBvbmUgb2YgYGNsZWFuYCwgYHJldmlld2AsIGBibG9ja2AsIGB1bnJlYWRhYmxlYC4AAAAADkludmFsaWRWZXJkaWN0AAAAAAAFAAAANkNvbW1pdCBpZCBpcyBub3QgMjAgKFNIQS0xKSBvciAzMiAoU0hBLTI1NikgcmF3IGJ5dGVzLgAAAAAADUludmFsaWRDb21taXQAAAAAAAAGAAAAIVNjYW5uZXIgdmVyc2lvbiBtdXN0IGJlIG5vbi16ZXJvLgAAAAAAAA5JbnZhbGlkU2Nhbm5lcgAAAAAABwAAAD9QYWdpbmF0aW9uIGxpbWl0IGlzIHplcm8gb3IgYWJvdmUgW2BjcmF0ZTo6c3RvcmFnZTo6TUFYX1BBR0VgXS4AAAAADEludmFsaWRMaW1pdAAAAAgAAAAjQ2FsbGVyIGlzIG5vdCBhIHJlZ2lzdGVyZWQgY3VyYXRvci4AAAAACk5vdEN1cmF0b3IAAAAAAAkAAABLSW5kaWNhdG9yIGtpbmQgaXMgbm90IG9uZSBvZiBgdGFza2AsIGBmb250YCwgYGNvbmZpZ2AsIGBzY3JpcHRgLCBgcGFja2FnZWAuAAAAAAtJbnZhbGlkS2luZAAAAAAKAAAARUFuIGluZGljYXRvciB3aXRoIHRoaXMgaGFzaCBhbHJlYWR5IGV4aXN0cyAocmV0cmFjdGVkIG9uZXMgaW5jbHVkZWQpLgAAAAAAAA9JbmRpY2F0b3JFeGlzdHMAAAAACwAAABxObyBpbmRpY2F0b3Igd2l0aCB0aGlzIGhhc2guAAAAEUluZGljYXRvck5vdEZvdW5kAAAAAAAADAAAACxDdXJhdG9yIGhhcyBhbHJlYWR5IGFwcHJvdmVkIHRoaXMgaW5kaWNhdG9yLgAAAA9BbHJlYWR5QXBwcm92ZWQAAAAADQAAADZJbmRpY2F0b3IgaGFzIGJlZW4gcmV0cmFjdGVkIGFuZCBjYW4gbm8gbG9uZ2VyIGNoYW5nZS4AAAAAABJJbmRpY2F0b3JSZXRyYWN0ZWQAAAAAAA4AAAArTm8gYXR0ZXN0YXRpb24gYXQgdGhpcyBpbmRleCBmb3IgdGhpcyByZXBvLgAAAAATQXR0ZXN0YXRpb25Ob3RGb3VuZAAAAAAPAAAAJ0F0dGVzdGF0aW9uIGhhcyBhbHJlYWR5IGJlZW4gcmV0cmFjdGVkLgAAAAAUQXR0ZXN0YXRpb25SZXRyYWN0ZWQAAAAQAAAAQ09ubHkgdGhlIG9yaWdpbmFsIGF0dGVzdGVyIG9yIHRoZSBhZG1pbiBtYXkgcmV0cmFjdCBhbiBhdHRlc3RhdGlvbi4AAAAAE05vdEFsbG93ZWRUb1JldHJhY3QAAAAAEQ==", "AAAABQAAAF1BIGN1cmF0b3IgYXBwcm92ZWQgYW4gaW5kaWNhdG9yLiBgc3RhdHVzYCBpcyBgYWN0aXZlYCBvbmNlIHRoZSBhcHByb3ZhbAp0aHJlc2hvbGQgaXMgcmVhY2hlZC4AAAAAAAAAAAAACEFwcHJvdmVkAAAAAQAAAAdhcHByb3ZlAAAAAAQAAAAAAAAABGhhc2gAAAPuAAAAIAAAAAEAAAAAAAAAB2N1cmF0b3IAAAAAEwAAAAAAAAAAAAAACWFwcHJvdmFscwAAAAAAAAQAAAAAAAAAAAAAAAZzdGF0dXMAAAAAABEAAAAAAAAAAg==", "AAAABQAAAGlBIHNjYW4gYXR0ZXN0YXRpb24gd2FzIHB1Ymxpc2hlZC4gYGluZGV4YCBpcyBpdHMgcG9zaXRpb24gaW4gdGhlIHJlcG8ncwpoaXN0b3J5LCByZWFkYWJsZSB3aXRoIGBoaXN0b3J5YC4AAAAAAAAAAAAACEF0dGVzdGVkAAAAAQAAAAZhdHRlc3QAAAAAAAUAAAAAAAAABHJlcG8AAAPuAAAAIAAAAAEAAAAAAAAAB3ZlcmRpY3QAAAAAEQAAAAEAAAAAAAAABmNvbW1pdAAAAAAADgAAAAAAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAC", "AAAABQAAAE5BIGN1cmF0b3IgcHJvcG9zZWQgYSBuZXcgaW5kaWNhdG9yLiBUaGUgcHJvcG9zYWwgY291bnRzIGFzIHRoZSBmaXJzdAphcHByb3ZhbC4AAAAAAAAAAAAIUHJvcG9zZWQAAAABAAAAB3Byb3Bvc2UAAAAABQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAAAAAAEa2luZAAAABEAAAAAAAAAAAAAAAhjYW1wYWlnbgAAABEAAAAAAAAAAAAAAAhldmlkZW5jZQAAA+4AAAAgAAAAAAAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAAAAAAI=", "AAAABQAAAAAAAAAAAAAACFVwZ3JhZGVkAAAAAQAAAAh1cGdyYWRlZAAAAAEAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAAAAAAI=", "AAAABQAAAFdBIGN1cmF0b3IgcmV0cmFjdGVkIGFuIGluZGljYXRvci4gYHJlYXNvbmAgaXMgdGhlIGhhc2ggb2YgdGhlIHB1YmxpYwpyZXRyYWN0aW9uIG5vdGljZS4AAAAAAAAAAAlSZXRyYWN0ZWQAAAAAAAABAAAAB3JldHJhY3QAAAAAAwAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAAAAAAC", "AAAABQAAAEFBIHJvbGUgd2FzIGdyYW50ZWQgb3IgcmV2b2tlZC4gYHJvbGVgIGlzIGBjdXJhdG9yYCBvciBgYXR0ZXN0ZXJgLgAAAAAAAAAAAAALUm9sZUdyYW50ZWQAAAAAAQAAAAxyb2xlX2dyYW50ZWQAAAACAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAAAAAAB2FjY291bnQAAAAAEwAAAAEAAAAC", "AAAABQAAAAAAAAAAAAAAC1JvbGVSZXZva2VkAAAAAAEAAAAMcm9sZV9yZXZva2VkAAAAAgAAAAAAAAAEcm9sZQAAABEAAAABAAAAAAAAAAdhY2NvdW50AAAAABMAAAABAAAAAg==", "AAAABQAAAAAAAAAAAAAADEFkbWluQ2hhbmdlZAAAAAEAAAANYWRtaW5fY2hhbmdlZAAAAAAAAAIAAAAAAAAAA29sZAAAAAATAAAAAAAAAAAAAAADbmV3AAAAABMAAAAAAAAAAg==", "AAAABQAAAAAAAAAAAAAAEFRocmVzaG9sZENoYW5nZWQAAAABAAAAEXRocmVzaG9sZF9jaGFuZ2VkAAAAAAAAAQAAAAAAAAAJdGhyZXNob2xkAAAAAAAABAAAAAAAAAAC", "AAAABQAAAHBBbiBhdHRlc3RhdGlvbiB3YXMgcmV0cmFjdGVkIGJ5IGl0cyBhdHRlc3RlciBvciB0aGUgYWRtaW4uIGByZWFzb25gIGlzCnRoZSBoYXNoIG9mIHRoZSBwdWJsaWMgcmV0cmFjdGlvbiBub3RpY2UuAAAAAAAAABRBdHRlc3RhdGlvblJldHJhY3RlZAAAAAEAAAAOcmV0cmFjdF9hdHRlc3QAAAAAAAQAAAAAAAAABHJlcG8AAAPuAAAAIAAAAAEAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAAAAAAGcmVhc29uAAAAAAPuAAAAIAAAAAAAAAAC"]),
      options
    );
  }

   static deploy<T = Client>(args: { admin: string | Address; threshold: number }, options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(args, options);
  }
  public readonly fromJson = {
    admin : this.txFromJson<string>,  attest : this.txFromJson<Result<number, Error>>,  latest : this.txFromJson<Attestation | null>,  approve : this.txFromJson<Result<null, Error>>,  history : this.txFromJson<Result<Array<Attestation>, Error>>,  propose : this.txFromJson<Result<null, Error>>,  retract : this.txFromJson<Result<null, Error>>,  upgrade : this.txFromJson<void>,  indicator : this.txFromJson<Indicator | null>,  set_admin : this.txFromJson<void>,  threshold : this.txFromJson<number>,  is_curator : this.txFromJson<boolean>,  add_curator : this.txFromJson<Result<null, Error>>,  extend_repo : this.txFromJson<boolean>,  is_attester : this.txFromJson<boolean>,  add_attester : this.txFromJson<Result<null, Error>>,  is_known_bad : this.txFromJson<boolean>,  set_threshold : this.txFromJson<Result<null, Error>>,  remove_curator : this.txFromJson<Result<null, Error>>,  remove_attester : this.txFromJson<Result<null, Error>>,  extend_indicator : this.txFromJson<boolean>,  attestation_count : this.txFromJson<number>,  retract_attestation : this.txFromJson<Result<null, Error>>
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
   * Build a topics filter row for the "AttestationRetracted" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  attestationRetractedEventFilter(topicValues?: { repo?: Uint8Array }): string[] {
    return this.spec.eventTopicFilter("AttestationRetracted", topicValues);
  }
}