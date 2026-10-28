//! Storage keys, TTL policy and role helpers.

use soroban_sdk::{contracttype, Address, Env};

use crate::errors::Error;

/// Smallest allowed M in the M-of-N curator approval rule.
pub const MIN_THRESHOLD: u32 = 2;

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
    Threshold,
    // persistent
    Curator(Address),
    Attester(Address),
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
