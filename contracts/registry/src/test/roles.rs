use soroban_sdk::{
    symbol_short,
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, MockAuth,
        MockAuthInvoke,
    },
    Address, Bytes, BytesN, Env, Event, IntoVal, Symbol,
};

use super::{setup, setup_mocked};
use crate::{events, DomeRegistry, Error};

#[test]
fn constructor_stores_admin_and_threshold() {
    let s = setup();
    assert_eq!(s.client.admin(), s.admin);
    assert_eq!(s.client.threshold(), 2);
}

#[test]
#[should_panic]
fn constructor_rejects_threshold_below_two() {
    let env = Env::default();
    let admin = Address::generate(&env);
    env.register(DomeRegistry, (&admin, 1u32));
}

#[test]
fn admin_adds_curator_with_auth() {
    let s = setup_mocked();
    let curator = Address::generate(&s.env);
    s.client.add_curator(&curator);

    // events() and auths() describe the most recent invocation only.
    assert_eq!(
        s.env.events().all(),
        [events::RoleGranted {
            role: symbol_short!("curator"),
            account: curator.clone()
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(
        s.env.auths(),
        [(
            s.admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.client.address.clone(),
                    Symbol::new(&s.env, "add_curator"),
                    (curator.clone(),).into_val(&s.env),
                )),
                sub_invocations: [].into(),
            }
        )]
    );
    assert!(s.client.is_curator(&curator));
}

#[test]
fn add_curator_without_admin_auth_fails() {
    let s = setup();
    let curator = Address::generate(&s.env);
    assert!(s.client.try_add_curator(&curator).is_err());
    assert!(!s.client.is_curator(&curator));
}

#[test]
fn add_curator_signed_by_non_admin_fails() {
    let s = setup();
    let intruder = Address::generate(&s.env);
    let curator = Address::generate(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &intruder,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "add_curator",
            args: (curator.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_add_curator(&curator).is_err());
}

#[test]
fn role_cannot_be_granted_twice_or_revoked_when_absent() {
    let s = setup_mocked();
    let a = Address::generate(&s.env);
    s.client.add_attester(&a);
    assert_eq!(
        s.client.try_add_attester(&a),
        Err(Ok(Error::RoleAlreadyGranted))
    );
    s.client.remove_attester(&a);
    assert!(!s.client.is_attester(&a));
    assert_eq!(
        s.client.try_remove_attester(&a),
        Err(Ok(Error::RoleNotGranted))
    );
}

#[test]
fn admin_removes_curator_and_event_is_emitted() {
    let s = setup_mocked();
    let c = Address::generate(&s.env);
    s.client.add_curator(&c);
    s.client.remove_curator(&c);
    assert_eq!(
        s.env.events().all(),
        [events::RoleRevoked {
            role: symbol_short!("curator"),
            account: c.clone()
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert!(!s.client.is_curator(&c));
}

#[test]
fn remove_attester_without_admin_auth_fails() {
    let s = setup_mocked();
    let a = Address::generate(&s.env);
    s.client.add_attester(&a);
    s.env.set_auths(&[]);
    assert!(s.client.try_remove_attester(&a).is_err());
    assert!(s.client.is_attester(&a));
}

#[test]
fn roles_are_independent() {
    let s = setup_mocked();
    let a = Address::generate(&s.env);
    s.client.add_attester(&a);
    assert!(s.client.is_attester(&a));
    assert!(!s.client.is_curator(&a));
}

/// Admin with `n` curators added.
fn with_curators<'a>(n: usize) -> (super::Setup<'a>, std::vec::Vec<Address>) {
    let s = setup_mocked();
    let c: std::vec::Vec<Address> = (0..n).map(|_| Address::generate(&s.env)).collect();
    for x in &c {
        s.client.add_curator(x);
    }
    (s, c)
}

#[test]
fn set_threshold_requires_admin_and_minimum() {
    let (s, _) = with_curators(3);
    s.env.set_auths(&[]);
    assert!(s.client.try_set_threshold(&3).is_err());

    s.env.mock_all_auths();
    s.client.set_threshold(&3);
    assert_eq!(
        s.env.events().all(),
        [events::ThresholdChanged { threshold: 3 }.to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, s.admin);
    assert_eq!(s.client.threshold(), 3);
    assert_eq!(
        s.client.try_set_threshold(&1),
        Err(Ok(Error::InvalidThreshold))
    );
    assert_eq!(
        s.client.try_set_threshold(&0),
        Err(Ok(Error::InvalidThreshold))
    );
}

#[test]
fn set_threshold_signed_by_non_admin_fails() {
    let (s, _) = with_curators(3);
    let intruder = Address::generate(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &intruder,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "set_threshold",
            args: (3u32,).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_set_threshold(&3).is_err());
    assert_eq!(s.client.threshold(), 2);
}

#[test]
fn threshold_cannot_exceed_curator_count() {
    let (s, _) = with_curators(2);
    assert_eq!(s.client.curator_count(), 2);
    assert_eq!(
        s.client.try_set_threshold(&3),
        Err(Ok(Error::ThresholdAboveCurators))
    );
    s.client.set_threshold(&2);
    assert_eq!(s.client.threshold(), 2);
}

#[test]
fn curator_count_follows_grants_and_revocations() {
    let (s, c) = with_curators(3);
    assert_eq!(s.client.curator_count(), 3);
    s.client.remove_curator(&c[0]);
    assert_eq!(s.client.curator_count(), 2);
    // Attesters don't count.
    s.client.add_attester(&Address::generate(&s.env));
    assert_eq!(s.client.curator_count(), 2);
    // A failed grant or revoke leaves the count alone.
    assert!(s.client.try_add_curator(&c[1]).is_err());
    assert!(s.client.try_remove_curator(&c[0]).is_err());
    assert_eq!(s.client.curator_count(), 2);
}

#[test]
fn removal_cannot_take_curators_below_threshold() {
    let (s, c) = with_curators(3);
    s.client.set_threshold(&3);
    assert_eq!(
        s.client.try_remove_curator(&c[0]),
        Err(Ok(Error::CuratorsBelowThreshold))
    );
    assert!(s.client.is_curator(&c[0]));

    // Rotation: add the replacement first, then remove.
    s.client.add_curator(&Address::generate(&s.env));
    s.client.remove_curator(&c[0]);
    assert_eq!(s.client.curator_count(), 3);
}

#[test]
fn removal_is_free_while_bootstrapping() {
    // One curator, threshold 2: the registry can't activate anything yet, so
    // a mistaken grant can be undone.
    let (s, c) = with_curators(1);
    s.client.remove_curator(&c[0]);
    assert_eq!(s.client.curator_count(), 0);
}

#[test]
fn set_admin_requires_both_old_and_new_admin() {
    let s = setup();
    let new_admin = Address::generate(&s.env);

    // Only the old admin signs: rejected.
    s.env.mock_auths(&[MockAuth {
        address: &s.admin,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "set_admin",
            args: (new_admin.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_set_admin(&new_admin).is_err());
    assert_eq!(s.client.admin(), s.admin);

    s.env.mock_all_auths();
    s.client.set_admin(&new_admin);
    let signers: std::vec::Vec<Address> = s.env.auths().into_iter().map(|(a, _)| a).collect();
    assert_eq!(signers, [s.admin.clone(), new_admin.clone()]);
    assert_eq!(s.client.admin(), new_admin);
}

#[test]
fn upgrade_without_admin_auth_fails() {
    let s = setup();
    let hash = BytesN::from_array(&s.env, &[7; 32]);
    assert!(s.client.try_upgrade(&hash).is_err());
}

/// Allowed path for `upgrade`. Needs the contract Wasm, which only
/// `stellar contract build` can produce, so it runs when `DOME_REGISTRY_WASM`
/// points at the built file (CI sets it) and is skipped otherwise.
#[test]
fn upgrade_with_admin_auth_replaces_code() {
    let Ok(path) = std::env::var("DOME_REGISTRY_WASM") else {
        std::println!("skipped: DOME_REGISTRY_WASM not set");
        return;
    };
    let wasm = std::fs::read(path).expect("read DOME_REGISTRY_WASM");
    let s = setup_mocked();
    let hash = s
        .env
        .deployer()
        .upload_contract_wasm(Bytes::from_slice(&s.env, &wasm));
    s.client.upgrade(&hash);
    assert_eq!(s.env.auths()[0].0, s.admin);
    // State survives the upgrade.
    assert_eq!(s.client.admin(), s.admin);
}
