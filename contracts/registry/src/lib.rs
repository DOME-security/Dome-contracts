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
pub use types::{Attestation, AttestationInput, Indicator, IndicatorInput};

use storage::DataKey;

const ROLE_CURATOR: Symbol = symbol_short!("curator");
const ROLE_ATTESTER: Symbol = symbol_short!("attester");

const STATUS_PROPOSED: Symbol = symbol_short!("proposed");
const STATUS_ACTIVE: Symbol = symbol_short!("active");
const STATUS_RETRACTED: Symbol = symbol_short!("retracted");

const KINDS: [Symbol; 5] = [
    symbol_short!("task"),
    symbol_short!("font"),
    symbol_short!("config"),
    symbol_short!("script"),
    symbol_short!("package"),
];

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

    /// Admin that has been offered the role and not yet accepted it.
    pub fn pending_admin(env: Env) -> Option<Address> {
        storage::pending_admin(&env)
    }

    /// Step 1 of 2: the admin offers the role to `new_admin`. Nothing changes
    /// until `new_admin` calls `accept_admin`, so the role can't be sent to
    /// an address nobody controls. A second call replaces the offer.
    pub fn transfer_admin(env: Env, new_admin: Address) {
        let admin = storage::admin(&env);
        admin.require_auth();
        storage::set_pending_admin(&env, &new_admin);
        storage::extend_instance(&env);
        events::AdminTransferStarted {
            admin,
            pending: new_admin,
        }
        .publish(&env);
    }

    /// Step 2 of 2: the offered address accepts and becomes admin.
    pub fn accept_admin(env: Env) -> Result<(), Error> {
        let new = storage::pending_admin(&env).ok_or(Error::NoPendingAdmin)?;
        new.require_auth();
        let old = storage::admin(&env);
        storage::set_admin(&env, &new);
        storage::remove_pending_admin(&env);
        storage::extend_instance(&env);
        events::AdminChanged { old, new }.publish(&env);
        Ok(())
    }

    /// Withdraws a pending offer. Admin only.
    pub fn cancel_admin_transfer(env: Env) -> Result<(), Error> {
        let admin = storage::admin(&env);
        admin.require_auth();
        let pending = storage::pending_admin(&env).ok_or(Error::NoPendingAdmin)?;
        storage::remove_pending_admin(&env);
        storage::extend_instance(&env);
        events::AdminTransferCancelled { admin, pending }.publish(&env);
        Ok(())
    }

    /// Sets M in the M-of-N approval rule. M must be at least 2 and at most
    /// the current number of curators.
    pub fn set_threshold(env: Env, threshold: u32) -> Result<(), Error> {
        storage::admin(&env).require_auth();
        storage::set_threshold(&env, threshold)?;
        if threshold > storage::curator_count(&env) {
            return Err(Error::ThresholdAboveCurators);
        }
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

    /// Removes a curator. Once there are at least `threshold` curators, a
    /// removal that would take the count below the threshold is rejected:
    /// add the replacement first, then remove.
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

    pub fn curator_count(env: Env) -> u32 {
        storage::curator_count(&env)
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
            retracted_by: None,
            retract_reason: None,
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

    /// Marks attestation `index` of `repo` as retracted. Allowed for the
    /// attester who wrote it while they still hold the attester role, and for
    /// the admin, e.g. after an attester key was compromised. The entry stays
    /// in the history with `retracted_by` and `retract_reason` set, and
    /// `latest` keeps returning it if it is the newest; readers must check
    /// `retracted_by`.
    pub fn retract_attestation(
        env: Env,
        by: Address,
        repo: BytesN<32>,
        index: u32,
        reason: BytesN<32>,
    ) -> Result<(), Error> {
        by.require_auth();
        let mut att = storage::attestation(&env, &repo, index).ok_or(Error::AttestationNotFound)?;
        let is_admin = by == storage::admin(&env);
        let is_own = by == att.attester && storage::has_role(&env, &DataKey::Attester(by.clone()));
        if !is_admin && !is_own {
            return Err(Error::NotAllowedToRetract);
        }
        if att.retracted_by.is_some() {
            return Err(Error::AttestationRetracted);
        }

        att.retracted_by = Some(by.clone());
        att.retract_reason = Some(reason.clone());
        storage::set_attestation(&env, index, &att);
        storage::extend_instance(&env);
        events::AttestationRetracted {
            repo,
            index,
            by,
            reason,
        }
        .publish(&env);
        Ok(())
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

    // ----------------------------------------------------------- indicators

    /// Proposes a fingerprint of a malicious file. The proposer's approval is
    /// counted, so with a threshold of M it needs M-1 more curators.
    ///
    /// A retracted hash can be proposed again. The new proposal replaces the
    /// stored entry and starts over with no approvals but the proposer's; the
    /// earlier retraction stays in the event log. Without this, one curator
    /// could retract a hash and keep it out of the registry for good.
    pub fn propose(env: Env, curator: Address, i: IndicatorInput) -> Result<(), Error> {
        curator.require_auth();
        storage::require_role(&env, &DataKey::Curator(curator.clone()), Error::NotCurator)?;
        if !KINDS.contains(&i.kind) {
            return Err(Error::InvalidKind);
        }
        if storage::indicator(&env, &i.hash).is_some_and(|old| old.status != STATUS_RETRACTED) {
            return Err(Error::IndicatorExists);
        }

        let mut approvals = Vec::new(&env);
        approvals.push_back(curator.clone());
        let ind = Indicator {
            hash: i.hash,
            kind: i.kind,
            campaign: i.campaign,
            evidence: i.evidence,
            status: STATUS_PROPOSED,
            approvals,
            proposed_at: env.ledger().timestamp(),
            retracted_by: None,
            retract_reason: None,
        };
        storage::set_indicator(&env, &ind);
        storage::extend_instance(&env);
        events::Proposed {
            hash: ind.hash,
            kind: ind.kind,
            campaign: ind.campaign,
            evidence: ind.evidence,
            curator,
        }
        .publish(&env);
        Ok(())
    }

    /// Adds a curator's approval. The indicator becomes `active` once
    /// approvals from current curators reach the threshold; approvals from
    /// curators removed since then no longer count.
    pub fn approve(env: Env, curator: Address, hash: BytesN<32>) -> Result<(), Error> {
        curator.require_auth();
        storage::require_role(&env, &DataKey::Curator(curator.clone()), Error::NotCurator)?;
        let mut ind = storage::indicator(&env, &hash).ok_or(Error::IndicatorNotFound)?;
        if ind.status == STATUS_RETRACTED {
            return Err(Error::IndicatorRetracted);
        }
        if ind.approvals.contains(&curator) {
            return Err(Error::AlreadyApproved);
        }

        ind.approvals.push_back(curator.clone());
        let valid = ind
            .approvals
            .iter()
            .filter(|a| storage::has_role(&env, &DataKey::Curator(a.clone())))
            .count() as u32;
        let activated = ind.status == STATUS_PROPOSED && valid >= storage::threshold(&env);
        if activated {
            ind.status = STATUS_ACTIVE;
        }
        storage::set_indicator(&env, &ind);
        storage::extend_instance(&env);
        events::Approved {
            hash: hash.clone(),
            curator,
            approvals: valid,
            status: ind.status,
        }
        .publish(&env);
        if activated {
            events::Activated {
                hash,
                approvals: valid,
            }
            .publish(&env);
        }
        Ok(())
    }

    /// Retracts an indicator, proposed or active. The entry stays readable
    /// with status `retracted` and the reason hash, so mistakes stay visible.
    pub fn retract(
        env: Env,
        curator: Address,
        hash: BytesN<32>,
        reason: BytesN<32>,
    ) -> Result<(), Error> {
        curator.require_auth();
        storage::require_role(&env, &DataKey::Curator(curator.clone()), Error::NotCurator)?;
        let mut ind = storage::indicator(&env, &hash).ok_or(Error::IndicatorNotFound)?;
        if ind.status == STATUS_RETRACTED {
            return Err(Error::IndicatorRetracted);
        }

        ind.status = STATUS_RETRACTED;
        ind.retracted_by = Some(curator.clone());
        ind.retract_reason = Some(reason.clone());
        storage::set_indicator(&env, &ind);
        storage::extend_instance(&env);
        events::Retracted {
            hash,
            curator,
            reason,
        }
        .publish(&env);
        Ok(())
    }

    /// True only for `active` indicators. Proposed and retracted ones are not
    /// known bad.
    pub fn is_known_bad(env: Env, hash: BytesN<32>) -> bool {
        storage::indicator(&env, &hash).is_some_and(|i| i.status == STATUS_ACTIVE)
    }

    pub fn indicator(env: Env, hash: BytesN<32>) -> Option<Indicator> {
        storage::indicator(&env, &hash)
    }

    // ------------------------------------------------------------------ TTL

    /// Keeps a repo's newest attestation and its history count from being
    /// archived. Anyone may call it and pay the fee; older history entries
    /// are left to expire and can be restored. Returns false for an unknown
    /// repo.
    pub fn extend_repo(env: Env, repo: BytesN<32>) -> bool {
        storage::extend_instance(&env);
        storage::extend_repo(&env, &repo)
    }

    /// Keeps an indicator from being archived. Anyone may call it. Returns
    /// false for an unknown hash.
    pub fn extend_indicator(env: Env, hash: BytesN<32>) -> bool {
        storage::extend_instance(&env);
        storage::extend_indicator(&env, &hash)
    }
}

impl DomeRegistry {
    fn grant(env: &Env, role: Symbol, key: DataKey, account: Address) -> Result<(), Error> {
        storage::admin(env).require_auth();
        storage::grant_role(env, &key)?;
        if role == ROLE_CURATOR {
            storage::set_curator_count(env, storage::curator_count(env) + 1);
        }
        storage::extend_instance(env);
        events::RoleGranted { role, account }.publish(env);
        Ok(())
    }

    fn revoke(env: &Env, role: Symbol, key: DataKey, account: Address) -> Result<(), Error> {
        storage::admin(env).require_auth();
        storage::revoke_role(env, &key)?;
        if role == ROLE_CURATOR {
            let threshold = storage::threshold(env);
            let before = storage::curator_count(env);
            let after = before.saturating_sub(1);
            // While bootstrapping (fewer curators than the threshold) removal
            // is free; after that the set never drops below the threshold.
            if before >= threshold && after < threshold {
                return Err(Error::CuratorsBelowThreshold);
            }
            storage::set_curator_count(env, after);
        }
        storage::extend_instance(env);
        events::RoleRevoked { role, account }.publish(env);
        Ok(())
    }
}
