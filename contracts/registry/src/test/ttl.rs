use soroban_sdk::{
    testutils::{storage::Persistent as _, Address as _, Ledger as _},
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
fn reads_do_not_extend() {
    let s = setup_mocked();
    let curator = Address::generate(&s.env);
    s.client.add_curator(&curator);
    let i = indicator_input(&s.env, 2);
    s.client.propose(&curator, &i);

    advance(&s, TTL_EXTEND_TO - TTL_THRESHOLD + 1);
    let before = ttl(&s, &DataKey::Indicator(i.hash.clone()));
    s.client.is_known_bad(&i.hash);
    s.client.indicator(&i.hash);
    assert_eq!(ttl(&s, &DataKey::Indicator(i.hash.clone())), before);
}
