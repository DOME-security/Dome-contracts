use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events as _, Ledger as _, MockAuth, MockAuthInvoke},
    Address, Bytes, BytesN, Event, IntoVal, Symbol,
};

use super::{attestation_input, setup_mocked, Setup};
use crate::{events, Error};

fn with_attester<'a>() -> (Setup<'a>, Address) {
    let s = setup_mocked();
    let a = Address::generate(&s.env);
    s.client.add_attester(&a);
    (s, a)
}

#[test]
fn attester_publishes_and_latest_returns_it() {
    let (s, attester) = with_attester();
    s.env.ledger().set_timestamp(1_790_000_000);
    let input = attestation_input(&s.env, 1, "clean");

    let index = s.client.attest(&attester, &input);
    assert_eq!(index, 0);
    assert_eq!(
        s.env.events().all(),
        [events::Attested {
            repo: input.repo.clone(),
            verdict: symbol_short!("clean"),
            commit: input.commit.clone(),
            attester: attester.clone(),
            index: 0,
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, attester);

    let got = s.client.latest(&input.repo).unwrap();
    assert_eq!(got.verdict, input.verdict);
    assert_eq!(got.attester, attester);
    assert_eq!(got.at, 1_790_000_000);
    assert_eq!(got.report, input.report);
}

#[test]
fn attest_without_attester_signature_fails() {
    let (s, attester) = with_attester();
    let input = attestation_input(&s.env, 1, "clean");
    s.env.set_auths(&[]);
    assert!(s.client.try_attest(&attester, &input).is_err());
    assert_eq!(s.client.latest(&input.repo), None);
}

#[test]
fn attest_signed_by_someone_else_fails() {
    let (s, attester) = with_attester();
    let other = Address::generate(&s.env);
    let input = attestation_input(&s.env, 1, "clean");
    s.env.mock_auths(&[MockAuth {
        address: &other,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "attest",
            args: (attester.clone(), input.clone()).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_attest(&attester, &input).is_err());
}

#[test]
fn non_attester_is_rejected_even_when_signed() {
    let s = setup_mocked();
    let stranger = Address::generate(&s.env);
    let input = attestation_input(&s.env, 1, "block");
    assert_eq!(
        s.client.try_attest(&stranger, &input),
        Err(Ok(Error::NotAttester))
    );
}

#[test]
fn removed_attester_can_no_longer_attest() {
    let (s, attester) = with_attester();
    s.client.remove_attester(&attester);
    let input = attestation_input(&s.env, 1, "clean");
    assert_eq!(
        s.client.try_attest(&attester, &input),
        Err(Ok(Error::NotAttester))
    );
}

#[test]
fn all_four_verdicts_are_accepted() {
    let (s, attester) = with_attester();
    for (i, v) in ["clean", "review", "block", "unreadable"]
        .iter()
        .enumerate()
    {
        let input = attestation_input(&s.env, i as u8, v);
        s.client.attest(&attester, &input);
        assert_eq!(
            s.client.latest(&input.repo).unwrap().verdict,
            Symbol::new(&s.env, v)
        );
    }
}

#[test]
fn invalid_input_is_rejected() {
    let (s, attester) = with_attester();

    let bad_verdict = attestation_input(&s.env, 1, "safe");
    assert_eq!(
        s.client.try_attest(&attester, &bad_verdict),
        Err(Ok(Error::InvalidVerdict))
    );

    let mut bad_commit = attestation_input(&s.env, 1, "clean");
    bad_commit.commit = Bytes::from_array(&s.env, &[1; 7]);
    assert_eq!(
        s.client.try_attest(&attester, &bad_commit),
        Err(Ok(Error::InvalidCommit))
    );

    let mut bad_scanner = attestation_input(&s.env, 1, "clean");
    bad_scanner.scanner = 0;
    assert_eq!(
        s.client.try_attest(&attester, &bad_scanner),
        Err(Ok(Error::InvalidScanner))
    );
}

#[test]
fn sha256_commit_ids_are_accepted() {
    let (s, attester) = with_attester();
    let mut input = attestation_input(&s.env, 1, "review");
    input.commit = Bytes::from_array(&s.env, &[0xab; 32]);
    s.client.attest(&attester, &input);
    assert_eq!(s.client.latest(&input.repo).unwrap().commit.len(), 32);
}

#[test]
fn history_keeps_every_attestation_in_order() {
    let (s, attester) = with_attester();
    let repo = BytesN::from_array(&s.env, &[9; 32]);
    for (i, v) in ["clean", "block", "review"].iter().enumerate() {
        let input = attestation_input(&s.env, 9, v);
        assert_eq!(s.client.attest(&attester, &input), i as u32);
    }
    assert_eq!(s.client.attestation_count(&repo), 3);
    assert_eq!(
        s.client.latest(&repo).unwrap().verdict,
        symbol_short!("review")
    );

    let all = s.client.history(&repo, &0, &50);
    assert_eq!(all.len(), 3);
    assert_eq!(all.get(0).unwrap().verdict, symbol_short!("clean"));
    assert_eq!(all.get(1).unwrap().verdict, symbol_short!("block"));

    let page = s.client.history(&repo, &1, &1);
    assert_eq!(page.len(), 1);
    assert_eq!(page.get(0).unwrap().verdict, symbol_short!("block"));

    assert_eq!(s.client.history(&repo, &3, &10).len(), 0);
    assert_eq!(s.client.history(&repo, &u32::MAX, &10).len(), 0);
}

#[test]
fn history_rejects_bad_limits() {
    let s = setup_mocked();
    let repo = BytesN::from_array(&s.env, &[1; 32]);
    assert_eq!(
        s.client.try_history(&repo, &0, &0),
        Err(Ok(Error::InvalidLimit))
    );
    assert_eq!(
        s.client.try_history(&repo, &0, &51),
        Err(Ok(Error::InvalidLimit))
    );
}

#[test]
fn unknown_repo_has_no_attestations() {
    let s = setup_mocked();
    let repo = BytesN::from_array(&s.env, &[42; 32]);
    assert_eq!(s.client.latest(&repo), None);
    assert_eq!(s.client.attestation_count(&repo), 0);
    assert_eq!(s.client.history(&repo, &0, &10).len(), 0);
}
