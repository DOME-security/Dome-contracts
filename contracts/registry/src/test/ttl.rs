use soroban_sdk::{
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, Ledger as _,
    },
    Address, BytesN,
};

use super::{attestation_input, indicator_input, setup_mocked, Setup};
use crate::storage::{DataKey, TTL_EXTEND_TO, TTL_THRESHOLD};

fn ttl(s: &Setup, key: &DataKey) -> u32 {
    s.env.as_contract(&s.client.address, || {
        s.env.storage().persistent().get_ttl(key)
    })
}

fn advance(s: &Setup, ledgers: u32) {
    s.env.ledger().with_mut(|l| l.sequence_number += ledgers);
}

#[test]
fn writes_extend_entries_to_the_policy_ttl() {
    let s = setup_mocked();
    let attester = Address::generate(&s.env);
    let curator = Address::generate(&s.env);
    s.client.add_attester(&attester);
    s.client.add_curator(&curator);

    let a = attestation_input(&s.env, 1, "clean");
    s.client.attest(&attester, &a);
    let i = indicator_input(&s.env, 2);
    s.client.propose(&curator, &i);

    assert_eq!(ttl(&s, &DataKey::Attest(a.repo.clone(), 0)), TTL_EXTEND_TO);
    assert_eq!(
        ttl(&s, &DataKey::AttestCount(a.repo.clone())),
        TTL_EXTEND_TO
    );
    assert_eq!(ttl(&s, &DataKey::Indicator(i.hash.clone())), TTL_EXTEND_TO);
    assert_eq!(ttl(&s, &DataKey::Attester(attester)), TTL_EXTEND_TO);
}

#[test]
fn anyone_can_extend_a_repo_and_an_indicator() {
    let s = setup_mocked();
    let attester = Address::generate(&s.env);
    let curator = Address::generate(&s.env);
    s.client.add_attester(&attester);
    s.client.add_curator(&curator);
    let a = attestation_input(&s.env, 1, "clean");
    s.client.attest(&attester, &a);
    let i = indicator_input(&s.env, 2);
    s.client.propose(&curator, &i);

    // Move past the threshold so the next extension actually bumps.
    advance(&s, TTL_EXTEND_TO - TTL_THRESHOLD + 1);
    let before = ttl(&s, &DataKey::Indicator(i.hash.clone()));
    assert!(before < TTL_THRESHOLD);

    // No signatures needed.
    s.env.set_auths(&[]);
    assert!(s.client.extend_repo(&a.repo));
    assert!(s.client.extend_indicator(&i.hash));
    assert!(s.env.auths().is_empty());

    assert_eq!(ttl(&s, &DataKey::Indicator(i.hash.clone())), TTL_EXTEND_TO);
    assert_eq!(ttl(&s, &DataKey::Attest(a.repo.clone(), 0)), TTL_EXTEND_TO);
    assert_eq!(ttl(&s, &DataKey::AttestCount(a.repo)), TTL_EXTEND_TO);
}

#[test]
fn extending_unknown_entries_returns_false() {
    let s = setup_mocked();
    let unknown = BytesN::from_array(&s.env, &[0xee; 32]);
    assert!(!s.client.extend_repo(&unknown));
    assert!(!s.client.extend_indicator(&unknown));
}

#[test]
fn checking_an_active_indicator_extends_it() {
    let s = setup_mocked();
    let c1 = Address::generate(&s.env);
    let c2 = Address::generate(&s.env);
    s.client.add_curator(&c1);
    s.client.add_curator(&c2);
    let i = indicator_input(&s.env, 2);
    s.client.propose(&c1, &i);
    s.client.approve(&c2, &i.hash);

    advance(&s, TTL_EXTEND_TO - TTL_THRESHOLD + 1);
    assert!(ttl(&s, &DataKey::Indicator(i.hash.clone())) < TTL_THRESHOLD);
    assert!(s.client.is_known_bad(&i.hash));
    assert_eq!(ttl(&s, &DataKey::Indicator(i.hash.clone())), TTL_EXTEND_TO);
}

#[test]
fn latest_extends_the_newest_attestation_only() {
    let s = setup_mocked();
    let attester = Address::generate(&s.env);
    s.client.add_attester(&attester);
    let a = attestation_input(&s.env, 1, "clean");
    s.client.attest(&attester, &a);
    s.client.attest(&attester, &a);

    advance(&s, TTL_EXTEND_TO - TTL_THRESHOLD + 1);
    let old = ttl(&s, &DataKey::Attest(a.repo.clone(), 0));
    s.client.latest(&a.repo);
    assert_eq!(ttl(&s, &DataKey::Attest(a.repo.clone(), 1)), TTL_EXTEND_TO);
    assert_eq!(
        ttl(&s, &DataKey::AttestCount(a.repo.clone())),
        TTL_EXTEND_TO
    );
    // Older history is left to expire.
    assert_eq!(ttl(&s, &DataKey::Attest(a.repo.clone(), 0)), old);
}

#[test]
fn other_reads_do_not_extend() {
    let s = setup_mocked();
    let curator = Address::generate(&s.env);
    let attester = Address::generate(&s.env);
    s.client.add_curator(&curator);
    s.client.add_attester(&attester);
    let i = indicator_input(&s.env, 2);
    s.client.propose(&curator, &i);
    let a = attestation_input(&s.env, 1, "clean");
    s.client.attest(&attester, &a);

    advance(&s, TTL_EXTEND_TO - TTL_THRESHOLD + 1);
    let ind_before = ttl(&s, &DataKey::Indicator(i.hash.clone()));
    let att_before = ttl(&s, &DataKey::Attest(a.repo.clone(), 0));
    // A proposed indicator is not in use yet.
    assert!(!s.client.is_known_bad(&i.hash));
    s.client.indicator(&i.hash);
    s.client.history(&a.repo, &0, &10);
    s.client.attestation_count(&a.repo);
    assert_eq!(ttl(&s, &DataKey::Indicator(i.hash.clone())), ind_before);
    assert_eq!(ttl(&s, &DataKey::Attest(a.repo.clone(), 0)), att_before);
}

#[test]
fn writes_and_extensions_keep_the_instance_alive() {
    let s = setup_mocked();
    advance(&s, TTL_EXTEND_TO - TTL_THRESHOLD + 1);
    s.client
        .extend_indicator(&BytesN::from_array(&s.env, &[0xee; 32]));
    let ttl = s
        .env
        .as_contract(&s.client.address, || s.env.storage().instance().get_ttl());
    assert_eq!(ttl, TTL_EXTEND_TO);
}
