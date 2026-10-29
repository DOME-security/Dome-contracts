//! Events emitted on every write, so the backend indexer and other tools can
//! follow the registry without polling storage. Each event's first topic is
//! its snake_case name unless set explicitly.

use soroban_sdk::{contractevent, Address, Bytes, BytesN, Symbol};

/// A role was granted or revoked. `role` is `curator` or `attester`.
#[contractevent(topics = ["role_granted"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleGranted {
    #[topic]
    pub role: Symbol,
    #[topic]
    pub account: Address,
}

#[contractevent(topics = ["role_revoked"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleRevoked {
    #[topic]
    pub role: Symbol,
    #[topic]
    pub account: Address,
}

/// The admin offered its role to `pending` (step 1 of 2).
#[contractevent(topics = ["admin_proposed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminTransferStarted {
    pub admin: Address,
    pub pending: Address,
}

/// The admin withdrew its offer to `pending`.
#[contractevent(topics = ["admin_cancelled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminTransferCancelled {
    pub admin: Address,
    pub pending: Address,
}

/// `new` accepted the admin role from `old` (step 2 of 2).
#[contractevent(topics = ["admin_changed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminChanged {
    pub old: Address,
    pub new: Address,
}

#[contractevent(topics = ["threshold_changed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ThresholdChanged {
    pub threshold: u32,
}

#[contractevent(topics = ["upgraded"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Upgraded {
    pub wasm_hash: BytesN<32>,
}

/// A scan attestation was published. `index` is its position in the repo's
/// history, readable with `history`.
#[contractevent(topics = ["attest"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attested {
    #[topic]
    pub repo: BytesN<32>,
    #[topic]
    pub verdict: Symbol,
    pub commit: Bytes,
    pub attester: Address,
    pub index: u32,
}

/// An attestation was retracted by its attester or the admin. `reason` is
/// the hash of the public retraction notice.
#[contractevent(topics = ["retract_attest"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttestationRetracted {
    #[topic]
    pub repo: BytesN<32>,
    pub index: u32,
    pub by: Address,
    pub reason: BytesN<32>,
}

/// A curator proposed a new indicator. The proposal counts as the first
/// approval.
#[contractevent(topics = ["propose"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposed {
    #[topic]
    pub hash: BytesN<32>,
    pub kind: Symbol,
    pub campaign: Symbol,
    pub evidence: BytesN<32>,
    pub curator: Address,
}

/// A curator approved an indicator. `status` is `active` once the approval
/// threshold is reached.
#[contractevent(topics = ["approve"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Approved {
    #[topic]
    pub hash: BytesN<32>,
    pub curator: Address,
    pub approvals: u32,
    pub status: Symbol,
}

/// A curator retracted an indicator. `reason` is the hash of the public
/// retraction notice.
#[contractevent(topics = ["retract"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Retracted {
    #[topic]
    pub hash: BytesN<32>,
    pub curator: Address,
    pub reason: BytesN<32>,
}
