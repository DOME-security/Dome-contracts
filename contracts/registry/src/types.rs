use soroban_sdk::{contracttype, Address, Bytes, BytesN, Symbol, Vec};

/// Scan result submitted by an attester. The contract adds `attester` and `at`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttestationInput {
    /// SHA-256 of the normalized repo id, e.g. `github.com/owner/repo`.
    pub repo: BytesN<32>,
    /// Raw git commit id: 20 bytes (SHA-1) or 32 bytes (SHA-256).
    pub commit: Bytes,
    /// `clean`, `review`, `block` or `unreadable`.
    pub verdict: Symbol,
    /// Dome engine version that produced the result.
    pub scanner: u32,
    /// Hash of the rule and indicator set used.
    pub rules: BytesN<32>,
    /// SHA-256 of the full JSON report, stored off-chain.
    pub report: BytesN<32>,
}

/// A stored scan attestation for one commit of one repository.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attestation {
    pub repo: BytesN<32>,
    pub commit: Bytes,
    pub verdict: Symbol,
    pub scanner: u32,
    pub rules: BytesN<32>,
    pub report: BytesN<32>,
    pub attester: Address,
    /// Ledger timestamp of the write.
    pub at: u64,
    /// Who retracted it, if retracted: the attester or the admin.
    pub retracted_by: Option<Address>,
    /// Hash of the public retraction notice, if retracted.
    pub retract_reason: Option<BytesN<32>>,
}

/// Indicator proposed by a curator. The contract fills in status and approvals.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IndicatorInput {
    /// SHA-256 of the malicious file.
    pub hash: BytesN<32>,
    /// `task`, `font`, `config`, `script` or `package`.
    pub kind: Symbol,
    /// Campaign label, e.g. `polinrider`, `ghostaction`, `unknown`.
    pub campaign: Symbol,
    /// Hash of the public write-up or advisory.
    pub evidence: BytesN<32>,
}

/// A fingerprint of a file confirmed (or proposed) as malicious.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Indicator {
    pub hash: BytesN<32>,
    pub kind: Symbol,
    pub campaign: Symbol,
    pub evidence: BytesN<32>,
    /// `proposed`, `active` or `retracted`.
    pub status: Symbol,
    /// Curators who approved it, in order. The proposer is the first approval.
    pub approvals: Vec<Address>,
    /// Ledger timestamp of the proposal.
    pub proposed_at: u64,
    /// Curator who retracted it, if retracted.
    pub retracted_by: Option<Address>,
    /// Hash of the public retraction notice, if retracted.
    pub retract_reason: Option<BytesN<32>>,
}
