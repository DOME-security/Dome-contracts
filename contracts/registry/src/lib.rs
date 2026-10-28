//! Dome Registry: public, tamper-evident security signals on Stellar.
//!
//! The registry stores two kinds of records:
//! - **attestations**: the result of a Dome scan of one commit of a public repo;
//! - **indicators**: SHA-256 fingerprints of files confirmed as malicious, which
//!   become `active` only after M-of-N curator approvals.
//!
//! Nothing is ever deleted. A retraction is a new state that stays visible.
#![no_std]

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
extern crate std;
#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, BytesN, ContractExecutable, Env, Symbol, Vec,
};

pub use errors::Error;
pub use types::{Attestation, AttestationInput};

use storage::DataKey;

const ROLE_CURATOR: Symbol = symbol_short!("curator");
const ROLE_ATTESTER: Symbol = symbol_short!("attester");

/// Allowed attestation verdicts. `unreadable` is longer than a short symbol,
/// so it is built at runtime.
fn is_verdict(env: &Env, v: &Symbol) -> bool {
    *v == symbol_short!("clean")
        || *v == symbol_short!("review")
        || *v == symbol_short!("block")
        || *v == Symbol::new(env, "unreadable")
}

#[contract]
pub struct DomeRegistry;

#[contractimpl]
impl DomeRegistry {
    // ---------------------------------------------------------------- setup

    /// Runs once at deploy time. `admin` should be a multisig account.
    /// Running setup in the constructor (instead of a separate `init` call)
    /// means nobody can front-run initialization.
    pub fn __constructor(env: Env, admin: Address, threshold: u32) -> Result<(), Error> {
        storage::set_admin(&env, &admin);
        storage::set_threshold(&env, threshold)?;
        storage::extend_instance(&env);
        Ok(())
    }

    pub fn admin(env: Env) -> Address {
        storage::admin(&env)
    }

    pub fn threshold(env: Env) -> u32 {
        storage::threshold(&env)
    }

    /// Hands the admin role to `new_admin`. Both must sign so the role can't
    /// be sent to an address nobody controls.
    pub fn set_admin(env: Env, new_admin: Address) {
        let old = storage::admin(&env);
        old.require_auth();
        new_admin.require_auth();
        storage::set_admin(&env, &new_admin);
        storage::extend_instance(&env);
        events::AdminChanged {
            old,
            new: new_admin,
        }
        .publish(&env);
    }

    pub fn set_threshold(env: Env, threshold: u32) -> Result<(), Error> {
        storage::admin(&env).require_auth();
        storage::set_threshold(&env, threshold)?;
        storage::extend_instance(&env);
        events::ThresholdChanged { threshold }.publish(&env);
        Ok(())
    }

    pub fn add_curator(env: Env, curator: Address) -> Result<(), Error> {
        Self::grant(
            &env,
            ROLE_CURATOR,
            DataKey::Curator(curator.clone()),
            curator,
        )
    }

    pub fn remove_curator(env: Env, curator: Address) -> Result<(), Error> {
        Self::revoke(
            &env,
            ROLE_CURATOR,
            DataKey::Curator(curator.clone()),
            curator,
        )
    }

    pub fn add_attester(env: Env, attester: Address) -> Result<(), Error> {
        Self::grant(
            &env,
            ROLE_ATTESTER,
            DataKey::Attester(attester.clone()),
            attester,
        )
    }

    pub fn remove_attester(env: Env, attester: Address) -> Result<(), Error> {
        Self::revoke(
            &env,
            ROLE_ATTESTER,
            DataKey::Attester(attester.clone()),
            attester,
        )
    }

    pub fn is_curator(env: Env, account: Address) -> bool {
        storage::has_role(&env, &DataKey::Curator(account))
    }

    pub fn is_attester(env: Env, account: Address) -> bool {
        storage::has_role(&env, &DataKey::Attester(account))
    }

    /// Replaces the contract code. Storage and the contract id are kept.
    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        storage::admin(&env).require_auth();
        env.deployer()
            .update_current_contract(ContractExecutable::Wasm(wasm_hash.clone()));
        events::Upgraded { wasm_hash }.publish(&env);
    }

    // --------------------------------------------------------- attestations

    /// Publishes the result of a scan of one commit. Earlier attestations for
    /// the same repo are kept; `latest` returns the newest.
    pub fn attest(env: Env, attester: Address, a: AttestationInput) -> Result<u32, Error> {
        attester.require_auth();
        storage::require_role(
            &env,
            &DataKey::Attester(attester.clone()),
            Error::NotAttester,
        )?;
        if !is_verdict(&env, &a.verdict) {
            return Err(Error::InvalidVerdict);
        }
        if !matches!(a.commit.len(), 20 | 32) {
            return Err(Error::InvalidCommit);
        }
        if a.scanner == 0 {
            return Err(Error::InvalidScanner);
        }

        let att = Attestation {
            repo: a.repo,
            commit: a.commit,
            verdict: a.verdict,
            scanner: a.scanner,
            rules: a.rules,
            report: a.report,
            attester,
            at: env.ledger().timestamp(),
        };
        let index = storage::push_attestation(&env, &att);
        storage::extend_instance(&env);
        events::Attested {
            repo: att.repo,
            verdict: att.verdict,
            commit: att.commit,
            attester: att.attester,
            index,
        }
        .publish(&env);
        Ok(index)
    }

    pub fn latest(env: Env, repo: BytesN<32>) -> Option<Attestation> {
        match storage::attest_count(&env, &repo) {
            0 => None,
            n => storage::attestation(&env, &repo, n - 1),
        }
    }

    pub fn attestation_count(env: Env, repo: BytesN<32>) -> u32 {
        storage::attest_count(&env, &repo)
    }

    /// Attestations for `repo`, oldest first, starting at index `start`.
    /// `limit` must be between 1 and 50.
    pub fn history(
        env: Env,
        repo: BytesN<32>,
        start: u32,
        limit: u32,
    ) -> Result<Vec<Attestation>, Error> {
        if limit == 0 || limit > storage::MAX_PAGE {
            return Err(Error::InvalidLimit);
        }
        let end = storage::attest_count(&env, &repo).min(start.saturating_add(limit));
        let mut out = Vec::new(&env);
        for n in start..end {
            if let Some(a) = storage::attestation(&env, &repo, n) {
                out.push_back(a);
            }
        }
        Ok(out)
    }
}

impl DomeRegistry {
    fn grant(env: &Env, role: Symbol, key: DataKey, account: Address) -> Result<(), Error> {
        storage::admin(env).require_auth();
        storage::grant_role(env, &key)?;
        storage::extend_instance(env);
        events::RoleGranted { role, account }.publish(env);
        Ok(())
    }

    fn revoke(env: &Env, role: Symbol, key: DataKey, account: Address) -> Result<(), Error> {
        storage::admin(env).require_auth();
        storage::revoke_role(env, &key)?;
        storage::extend_instance(env);
        events::RoleRevoked { role, account }.publish(env);
        Ok(())
    }
}
