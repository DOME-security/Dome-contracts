import {Address} from '@stellar/stellar-sdk';

    /**
 * A fingerprint of a file confirmed (or proposed) as malicious.
 */
export interface Indicator {
  /**
   * Curators who approved it, in order. The proposer is the first approval.
   */
  approvals: Array<string>;
  campaign: string;
  evidence: Uint8Array;
  hash: Uint8Array;
  kind: string;
  /**
   * Ledger timestamp of the proposal.
   */
  proposed_at: bigint;
  /**
   * Hash of the public retraction notice, if retracted.
   */
  retract_reason: Uint8Array | null;
  /**
   * Curator who retracted it, if retracted.
   */
  retracted_by: string | null;
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
  at: bigint;
  attester: string;
  commit: Uint8Array;
  repo: Uint8Array;
  report: Uint8Array;
  /**
   * Hash of the public retraction notice, if retracted.
   */
  retract_reason: Uint8Array | null;
  /**
   * Who retracted it, if retracted: the attester or the admin.
   */
  retracted_by: string | null;
  rules: Uint8Array;
  scanner: number;
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
  evidence: Uint8Array;
  /**
   * SHA-256 of the malicious file.
   */
  hash: Uint8Array;
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
  commit: Uint8Array;
  /**
   * SHA-256 of the normalized repo id, e.g. `github.com/owner/repo`.
   */
  repo: Uint8Array;
  /**
   * SHA-256 of the full JSON report, stored off-chain.
   */
  report: Uint8Array;
  /**
   * Hash of the rule and indicator set used.
   */
  rules: Uint8Array;
  /**
   * Dome engine version that produced the result.
   */
  scanner: number;
  /**
   * `clean`, `review`, `block` or `unreadable`.
   */
  verdict: string;
}

/**
 * Errors returned by the registry. Codes are part of the public interface:
 * never renumber an existing variant, only append new ones.
 */
export const Error = {
  /**
   * Threshold is below [`crate::storage::MIN_THRESHOLD`].
   */
  1 : { message: "InvalidThreshold" },
  /**
   * Address already holds the role being granted.
   */
  2 : { message: "RoleAlreadyGranted" },
  /**
   * Address does not hold the role being revoked.
   */
  3 : { message: "RoleNotGranted" },
  /**
   * Caller is not a registered attester.
   */
  4 : { message: "NotAttester" },
  /**
   * Verdict is not one of `clean`, `review`, `block`, `unreadable`.
   */
  5 : { message: "InvalidVerdict" },
  /**
   * Commit id is not 20 (SHA-1) or 32 (SHA-256) raw bytes.
   */
  6 : { message: "InvalidCommit" },
  /**
   * Scanner version must be non-zero.
   */
  7 : { message: "InvalidScanner" },
  /**
   * Pagination limit is zero or above [`crate::storage::MAX_PAGE`].
   */
  8 : { message: "InvalidLimit" },
  /**
   * Caller is not a registered curator.
   */
  9 : { message: "NotCurator" },
  /**
   * Indicator kind is not one of `task`, `font`, `config`, `script`, `package`.
   */
  10 : { message: "InvalidKind" },
  /**
   * An indicator with this hash already exists (retracted ones included).
   */
  11 : { message: "IndicatorExists" },
  /**
   * No indicator with this hash.
   */
  12 : { message: "IndicatorNotFound" },
  /**
   * Curator has already approved this indicator.
   */
  13 : { message: "AlreadyApproved" },
  /**
   * Indicator has been retracted and can no longer change.
   */
  14 : { message: "IndicatorRetracted" },
  /**
   * No attestation at this index for this repo.
   */
  15 : { message: "AttestationNotFound" },
  /**
   * Attestation has already been retracted.
   */
  16 : { message: "AttestationRetracted" },
  /**
   * Only the original attester or the admin may retract an attestation.
   */
  17 : { message: "NotAllowedToRetract" }
}

/**
 * A curator approved an indicator. `status` is `active` once the approval
 * threshold is reached.
 */
export interface ApprovedEvent {
  name: "Approved";
  data: {
    hash: Uint8Array;
    curator?: string;
    approvals?: number;
    status?: string;
  };
}

/**
 * A scan attestation was published. `index` is its position in the repo's
 * history, readable with `history`.
 */
export interface AttestedEvent {
  name: "Attested";
  data: {
    repo: Uint8Array;
    verdict: string;
    commit?: Uint8Array;
    attester?: string;
    index?: number;
  };
}

/**
 * A curator proposed a new indicator. The proposal counts as the first
 * approval.
 */
export interface ProposedEvent {
  name: "Proposed";
  data: {
    hash: Uint8Array;
    kind?: string;
    campaign?: string;
    evidence?: Uint8Array;
    curator?: string;
  };
}

/**
 * Event: Upgraded
 */
export interface UpgradedEvent {
  name: "Upgraded";
  data: {
    wasm_hash?: Uint8Array;
  };
}

/**
 * A curator retracted an indicator. `reason` is the hash of the public
 * retraction notice.
 */
export interface RetractedEvent {
  name: "Retracted";
  data: {
    hash: Uint8Array;
    curator?: string;
    reason?: Uint8Array;
  };
}

/**
 * A role was granted or revoked. `role` is `curator` or `attester`.
 */
export interface RoleGrantedEvent {
  name: "RoleGranted";
  data: {
    role: string;
    account: string;
  };
}

/**
 * Event: RoleRevoked
 */
export interface RoleRevokedEvent {
  name: "RoleRevoked";
  data: {
    role: string;
    account: string;
  };
}

/**
 * Event: AdminChanged
 */
export interface AdminChangedEvent {
  name: "AdminChanged";
  data: {
    old?: string;
    new?: string;
  };
}

/**
 * Event: ThresholdChanged
 */
export interface ThresholdChangedEvent {
  name: "ThresholdChanged";
  data: {
    threshold?: number;
  };
}

/**
 * An attestation was retracted by its attester or the admin. `reason` is
 * the hash of the public retraction notice.
 */
export interface AttestationRetractedEvent {
  name: "AttestationRetracted";
  data: {
    repo: Uint8Array;
    index?: number;
    by?: string;
    reason?: Uint8Array;
  };
}
    export type ContractEvent = ApprovedEvent | AttestedEvent | ProposedEvent | UpgradedEvent | RetractedEvent | RoleGrantedEvent | RoleRevokedEvent | AdminChangedEvent | ThresholdChangedEvent | AttestationRetractedEvent;
    