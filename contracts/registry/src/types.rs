use soroban_sdk::{contracttype, Address, Bytes, BytesN, Symbol};

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
}
