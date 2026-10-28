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
