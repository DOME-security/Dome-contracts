//! Storage keys, TTL policy and role helpers.

use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::errors::Error;
use crate::types::{Attestation, Indicator};

/// Smallest allowed M in the M-of-N curator approval rule.
pub const MIN_THRESHOLD: u32 = 2;
/// Largest page returned by `history`.
pub const MAX_PAGE: u32 = 50;

// TTL policy: every write extends the entries it touches, and anyone can pay
// to keep an entry alive with `extend_repo` / `extend_indicator`. Reads never
// extend, so checking the registry costs nothing beyond simulation. Archived
// entries are restored automatically by the network when next accessed.

/// ~5 second ledgers.
const DAY_IN_LEDGERS: u32 = 17_280;
/// Entries are extended once their remaining TTL drops below this...
pub const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
/// ...back up to this.
pub const TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // instance
    Admin,
    /// Address offered the admin role by `transfer_admin`, until it accepts.
    PendingAdmin,
    Threshold,
    /// Number of addresses holding the curator role.
    CuratorCount,
    // persistent
    Curator(Address),
    Attester(Address),
    /// Number of attestations recorded for a repo.
    AttestCount(BytesN<32>),
    /// Attestation `n` (0-based) for a repo.
    Attest(BytesN<32>, u32),
    Indicator(BytesN<32>),
}

pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn extend(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn admin(env: &Env) -> Address {
    // Set by the constructor, so always present.
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn pending_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::PendingAdmin)
}

pub fn set_pending_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::PendingAdmin, admin);
}

pub fn remove_pending_admin(env: &Env) {
    env.storage().instance().remove(&DataKey::PendingAdmin);
}

pub fn threshold(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::Threshold).unwrap()
}

pub fn set_threshold(env: &Env, threshold: u32) -> Result<(), Error> {
    if threshold < MIN_THRESHOLD {
        return Err(Error::InvalidThreshold);
    }
    env.storage()
        .instance()
        .set(&DataKey::Threshold, &threshold);
    Ok(())
}

pub fn curator_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::CuratorCount)
        .unwrap_or(0)
}

pub fn set_curator_count(env: &Env, n: u32) {
    env.storage().instance().set(&DataKey::CuratorCount, &n);
}

pub fn has_role(env: &Env, key: &DataKey) -> bool {
    env.storage().persistent().has(key)
}

pub fn grant_role(env: &Env, key: &DataKey) -> Result<(), Error> {
    if has_role(env, key) {
        return Err(Error::RoleAlreadyGranted);
    }
    env.storage().persistent().set(key, &true);
    extend(env, key);
    Ok(())
}

pub fn revoke_role(env: &Env, key: &DataKey) -> Result<(), Error> {
    if !has_role(env, key) {
        return Err(Error::RoleNotGranted);
    }
    env.storage().persistent().remove(key);
    Ok(())
}

/// Checks the role and keeps an active role holder's entry alive.
pub fn require_role(env: &Env, key: &DataKey, err: Error) -> Result<(), Error> {
    if !has_role(env, key) {
        return Err(err);
    }
    extend(env, key);
    Ok(())
}

pub fn attest_count(env: &Env, repo: &BytesN<32>) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::AttestCount(repo.clone()))
        .unwrap_or(0)
}

/// Appends an attestation to the repo's history and returns its index.
pub fn push_attestation(env: &Env, a: &Attestation) -> u32 {
    let n = attest_count(env, &a.repo);
    let count_key = DataKey::AttestCount(a.repo.clone());
    let entry_key = DataKey::Attest(a.repo.clone(), n);
    env.storage().persistent().set(&entry_key, a);
    env.storage().persistent().set(&count_key, &(n + 1));
    extend(env, &entry_key);
    extend(env, &count_key);
    n
}

pub fn attestation(env: &Env, repo: &BytesN<32>, n: u32) -> Option<Attestation> {
    env.storage()
        .persistent()
        .get(&DataKey::Attest(repo.clone(), n))
}

/// Overwrites attestation `n` in place, e.g. to mark it retracted.
pub fn set_attestation(env: &Env, n: u32, a: &Attestation) {
    let key = DataKey::Attest(a.repo.clone(), n);
    env.storage().persistent().set(&key, a);
    extend(env, &key);
}

pub fn indicator(env: &Env, hash: &BytesN<32>) -> Option<Indicator> {
    env.storage()
        .persistent()
        .get(&DataKey::Indicator(hash.clone()))
}

pub fn set_indicator(env: &Env, i: &Indicator) {
    let key = DataKey::Indicator(i.hash.clone());
    env.storage().persistent().set(&key, i);
    extend(env, &key);
}

/// Extends the count and the newest attestation for a repo. Returns false if
/// the repo has no attestations.
pub fn extend_repo(env: &Env, repo: &BytesN<32>) -> bool {
    let n = attest_count(env, repo);
    if n == 0 {
        return false;
    }
    extend(env, &DataKey::AttestCount(repo.clone()));
    extend(env, &DataKey::Attest(repo.clone(), n - 1));
    true
}

/// Returns false if there is no such indicator.
pub fn extend_indicator(env: &Env, hash: &BytesN<32>) -> bool {
    let key = DataKey::Indicator(hash.clone());
    if !env.storage().persistent().has(&key) {
        return false;
    }
    extend(env, &key);
    true
}
