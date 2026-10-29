use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke},
    Address, BytesN, Event, IntoVal, Symbol,
};

use super::{indicator_input, setup_mocked, Setup};
use crate::{events, Error};

/// Registry with threshold 2 and three curators.
fn with_curators<'a>() -> (Setup<'a>, [Address; 3]) {
    let s = setup_mocked();
    let c = [
        Address::generate(&s.env),
        Address::generate(&s.env),
        Address::generate(&s.env),
    ];
    for x in &c {
        s.client.add_curator(x);
    }
    (s, c)
}

#[test]
fn proposal_is_not_known_bad_until_threshold() {
    let (s, [c1, c2, _]) = with_curators();
    let i = indicator_input(&s.env, 1);

    s.client.propose(&c1, &i);
    assert_eq!(
        s.env.events().all(),
        [events::Proposed {
            hash: i.hash.clone(),
            kind: i.kind.clone(),
            campaign: i.campaign.clone(),
            evidence: i.evidence.clone(),
            curator: c1.clone(),
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, c1);
    assert!(!s.client.is_known_bad(&i.hash));
    assert_eq!(
        s.client.indicator(&i.hash).unwrap().status,
        symbol_short!("proposed")
    );

    s.client.approve(&c2, &i.hash);
    assert_eq!(
        s.env.events().all(),
        [events::Approved {
            hash: i.hash.clone(),
            curator: c2.clone(),
            approvals: 2,
            status: symbol_short!("active"),
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, c2);
    assert!(s.client.is_known_bad(&i.hash));

    let stored = s.client.indicator(&i.hash).unwrap();
    assert_eq!(stored.status, symbol_short!("active"));
    assert_eq!(stored.approvals.len(), 2);
}

#[test]
fn higher_threshold_needs_more_approvals() {
    let (s, [c1, c2, c3]) = with_curators();
    s.client.set_threshold(&3);
    let i = indicator_input(&s.env, 1);
    s.client.propose(&c1, &i);
    s.client.approve(&c2, &i.hash);
    assert!(!s.client.is_known_bad(&i.hash));
    s.client.approve(&c3, &i.hash);
    assert!(s.client.is_known_bad(&i.hash));
}

#[test]
fn single_curator_cannot_activate_alone() {
    let (s, [c1, _, _]) = with_curators();
    let i = indicator_input(&s.env, 1);
    s.client.propose(&c1, &i);
    assert_eq!(
        s.client.try_approve(&c1, &i.hash),
        Err(Ok(Error::AlreadyApproved))
    );
    assert!(!s.client.is_known_bad(&i.hash));
}

#[test]
fn approvals_from_removed_curators_do_not_count() {
    let (s, [c1, c2, c3]) = with_curators();
    let c4 = Address::generate(&s.env);
    s.client.add_curator(&c4);
    s.client.set_threshold(&3);
    let i = indicator_input(&s.env, 1);
    s.client.propose(&c1, &i);
    s.client.approve(&c2, &i.hash);
    s.client.remove_curator(&c1);
    s.client.approve(&c3, &i.hash);
    // c2 and c3 are valid, c1 is not: 2 of 3 needed.
    assert!(!s.client.is_known_bad(&i.hash));
    s.client.approve(&c4, &i.hash);
    assert!(s.client.is_known_bad(&i.hash));
}

#[test]
fn propose_without_curator_signature_fails() {
    let (s, [c1, _, _]) = with_curators();
    let i = indicator_input(&s.env, 1);
    s.env.set_auths(&[]);
    assert!(s.client.try_propose(&c1, &i).is_err());
    assert_eq!(s.client.indicator(&i.hash), None);
}

#[test]
fn approve_signed_by_someone_else_fails() {
    let (s, [c1, c2, _]) = with_curators();
    let i = indicator_input(&s.env, 1);
    s.client.propose(&c1, &i);
    let intruder = Address::generate(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &intruder,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "approve",
            args: (c2.clone(), i.hash.clone()).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_approve(&c2, &i.hash).is_err());
    s.env.mock_all_auths();
    assert!(!s.client.is_known_bad(&i.hash));
}

#[test]
fn retract_without_curator_signature_fails() {
    let (s, [c1, c2, _]) = with_curators();
    let i = indicator_input(&s.env, 1);
    s.client.propose(&c1, &i);
    s.client.approve(&c2, &i.hash);
    s.env.set_auths(&[]);
    let reason = BytesN::from_array(&s.env, &[0x44; 32]);
    assert!(s.client.try_retract(&c1, &i.hash, &reason).is_err());
    assert!(s.client.is_known_bad(&i.hash));
}

#[test]
fn non_curators_are_rejected_even_when_signed() {
    let (s, [c1, _, _]) = with_curators();
    let stranger = Address::generate(&s.env);
    let i = indicator_input(&s.env, 1);
    let reason = BytesN::from_array(&s.env, &[0x44; 32]);

    assert_eq!(
        s.client.try_propose(&stranger, &i),
        Err(Ok(Error::NotCurator))
    );
    s.client.propose(&c1, &i);
    assert_eq!(
        s.client.try_approve(&stranger, &i.hash),
        Err(Ok(Error::NotCurator))
    );
    assert_eq!(
        s.client.try_retract(&stranger, &i.hash, &reason),
        Err(Ok(Error::NotCurator))
    );
}

#[test]
fn retraction_is_visible_and_final() {
    let (s, [c1, c2, c3]) = with_curators();
    let i = indicator_input(&s.env, 1);
    let reason = BytesN::from_array(&s.env, &[0x44; 32]);
    s.client.propose(&c1, &i);
    s.client.approve(&c2, &i.hash);

    s.client.retract(&c3, &i.hash, &reason);
    assert_eq!(
        s.env.events().all(),
        [events::Retracted {
            hash: i.hash.clone(),
            curator: c3.clone(),
            reason: reason.clone(),
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, c3);
    assert!(!s.client.is_known_bad(&i.hash));

    let stored = s.client.indicator(&i.hash).unwrap();
    assert_eq!(stored.status, symbol_short!("retracted"));
    assert_eq!(stored.retracted_by, Some(c3.clone()));
    assert_eq!(stored.retract_reason, Some(reason.clone()));
    assert_eq!(stored.approvals.len(), 2);

    // A retracted indicator can't be approved or retracted again.
    assert_eq!(
        s.client.try_approve(&c3, &i.hash),
        Err(Ok(Error::IndicatorRetracted))
    );
    assert_eq!(
        s.client.try_retract(&c3, &i.hash, &reason),
        Err(Ok(Error::IndicatorRetracted))
    );
}

#[test]
fn retracted_hash_can_be_proposed_again_and_needs_full_approval() {
    let (s, [c1, c2, c3]) = with_curators();
    let i = indicator_input(&s.env, 1);
    let reason = BytesN::from_array(&s.env, &[0x44; 32]);
    s.client.propose(&c1, &i);
    s.client.approve(&c2, &i.hash);
    // A rogue curator retracts a good indicator...
    s.client.retract(&c3, &i.hash, &reason);
    assert!(!s.client.is_known_bad(&i.hash));

    // ...and it can be restored through the normal M-of-N process.
    let mut again = i.clone();
    again.evidence = BytesN::from_array(&s.env, &[0x34; 32]);
    s.client.propose(&c2, &again);
    assert_eq!(
        s.env.events().all(),
        [events::Proposed {
            hash: again.hash.clone(),
            kind: again.kind.clone(),
            campaign: again.campaign.clone(),
            evidence: again.evidence.clone(),
            curator: c2.clone(),
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    let stored = s.client.indicator(&i.hash).unwrap();
    assert_eq!(stored.status, symbol_short!("proposed"));
    assert_eq!(stored.approvals.len(), 1);
    assert_eq!(stored.evidence, again.evidence);
    assert_eq!(stored.retracted_by, None);
    assert_eq!(stored.retract_reason, None);
    assert!(!s.client.is_known_bad(&i.hash));

    s.client.approve(&c1, &i.hash);
    assert!(s.client.is_known_bad(&i.hash));
}

#[test]
fn proposals_can_be_retracted_before_activation() {
    let (s, [c1, _, _]) = with_curators();
    let i = indicator_input(&s.env, 1);
    s.client.propose(&c1, &i);
    s.client
        .retract(&c1, &i.hash, &BytesN::from_array(&s.env, &[0; 32]));
    assert_eq!(
        s.client.indicator(&i.hash).unwrap().status,
        symbol_short!("retracted")
    );
}

#[test]
fn duplicate_and_unknown_indicators_are_rejected() {
    let (s, [c1, c2, _]) = with_curators();
    let i = indicator_input(&s.env, 1);
    s.client.propose(&c1, &i);
    assert_eq!(
        s.client.try_propose(&c2, &i),
        Err(Ok(Error::IndicatorExists))
    );

    let unknown = BytesN::from_array(&s.env, &[0xee; 32]);
    assert_eq!(
        s.client.try_approve(&c2, &unknown),
        Err(Ok(Error::IndicatorNotFound))
    );
    assert_eq!(
        s.client.try_retract(&c2, &unknown, &unknown),
        Err(Ok(Error::IndicatorNotFound))
    );
    assert!(!s.client.is_known_bad(&unknown));
    assert_eq!(s.client.indicator(&unknown), None);
}

#[test]
fn kinds_are_validated() {
    let (s, [c1, _, _]) = with_curators();
    for (n, kind) in ["task", "font", "config", "script", "package"]
        .iter()
        .enumerate()
    {
        let mut i = indicator_input(&s.env, n as u8);
        i.kind = Symbol::new(&s.env, kind);
        s.client.propose(&c1, &i);
    }
    let mut bad = indicator_input(&s.env, 99);
    bad.kind = symbol_short!("person");
    assert_eq!(s.client.try_propose(&c1, &bad), Err(Ok(Error::InvalidKind)));
}

#[test]
fn approving_an_active_indicator_records_support() {
    let (s, [c1, c2, c3]) = with_curators();
    let i = indicator_input(&s.env, 1);
    s.client.propose(&c1, &i);
    s.client.approve(&c2, &i.hash);
    s.client.approve(&c3, &i.hash);
    let stored = s.client.indicator(&i.hash).unwrap();
    assert_eq!(stored.status, symbol_short!("active"));
    assert_eq!(stored.approvals.len(), 3);
}
