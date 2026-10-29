use soroban_sdk::{
    symbol_short,
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, MockAuth,
        MockAuthInvoke,
    },
    Address, BytesN, Env, Event, IntoVal, Symbol,
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
fn admin_adds_attester_with_auth() {
    let s = setup_mocked();
    let attester = Address::generate(&s.env);
    s.client.add_attester(&attester);
    assert_eq!(
        s.env.events().all(),
        [events::RoleGranted {
            role: symbol_short!("attester"),
            account: attester.clone()
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, s.admin);
    assert!(s.client.is_attester(&attester));
}

#[test]
fn add_attester_without_or_with_wrong_auth_fails() {
    let s = setup();
    let attester = Address::generate(&s.env);
    assert!(s.client.try_add_attester(&attester).is_err());

    s.env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "add_attester",
            args: (attester.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_add_attester(&attester).is_err());
    assert!(!s.client.is_attester(&attester));
}

#[test]
fn admin_removes_attester_and_event_is_emitted() {
    let s = setup_mocked();
    let a = Address::generate(&s.env);
    s.client.add_attester(&a);
    s.client.remove_attester(&a);
    assert_eq!(
        s.env.events().all(),
        [events::RoleRevoked {
            role: symbol_short!("attester"),
            account: a.clone()
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, s.admin);
}

#[test]
fn remove_curator_without_or_with_wrong_auth_fails() {
    let s = setup_mocked();
    let c = Address::generate(&s.env);
    s.client.add_curator(&c);

    s.env.set_auths(&[]);
    assert!(s.client.try_remove_curator(&c).is_err());

    s.env.mock_auths(&[MockAuth {
        address: &c,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "remove_curator",
            args: (c.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_remove_curator(&c).is_err());
    assert!(s.client.is_curator(&c));
    assert_eq!(s.client.curator_count(), 1);
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
fn admin_transfer_takes_two_steps() {
    let s = setup_mocked();
    let new_admin = Address::generate(&s.env);
    assert_eq!(s.client.pending_admin(), None);

    s.client.transfer_admin(&new_admin);
    assert_eq!(
        s.env.events().all(),
        [events::AdminTransferStarted {
            admin: s.admin.clone(),
            pending: new_admin.clone(),
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, s.admin);
    // Nothing changes until the new admin accepts.
    assert_eq!(s.client.admin(), s.admin);
    assert_eq!(s.client.pending_admin(), Some(new_admin.clone()));

    s.client.accept_admin();
    assert_eq!(
        s.env.events().all(),
        [events::AdminChanged {
            old: s.admin.clone(),
            new: new_admin.clone(),
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(
        s.env.auths(),
        [(
            new_admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.client.address.clone(),
                    Symbol::new(&s.env, "accept_admin"),
                    ().into_val(&s.env),
                )),
                sub_invocations: [].into(),
            }
        )]
    );
    assert_eq!(s.client.admin(), new_admin);
    assert_eq!(s.client.pending_admin(), None);
}

#[test]
fn old_admin_loses_power_after_transfer() {
    let s = setup();
    let new_admin = Address::generate(&s.env);
    s.env.mock_all_auths();
    s.client.transfer_admin(&new_admin);
    s.client.accept_admin();

    let curator = Address::generate(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &s.admin,
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
fn transfer_admin_signed_by_non_admin_fails() {
    let s = setup();
    let intruder = Address::generate(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &intruder,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "transfer_admin",
            args: (intruder.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_transfer_admin(&intruder).is_err());
    assert_eq!(s.client.pending_admin(), None);
}

#[test]
fn only_the_pending_admin_can_accept() {
    let s = setup();
    let new_admin = Address::generate(&s.env);
    s.env.mock_all_auths();
    s.client.transfer_admin(&new_admin);

    // No signature.
    s.env.set_auths(&[]);
    assert!(s.client.try_accept_admin().is_err());

    // Signed by the current admin instead of the pending one.
    s.env.mock_auths(&[MockAuth {
        address: &s.admin,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "accept_admin",
            args: ().into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_accept_admin().is_err());
    assert_eq!(s.client.admin(), s.admin);
    assert_eq!(s.client.pending_admin(), Some(new_admin));
}

#[test]
fn accept_or_cancel_without_pending_transfer_fails() {
    let s = setup_mocked();
    assert_eq!(s.client.try_accept_admin(), Err(Ok(Error::NoPendingAdmin)));
    assert_eq!(
        s.client.try_cancel_admin_transfer(),
        Err(Ok(Error::NoPendingAdmin))
    );
}

#[test]
fn admin_can_cancel_and_replace_an_offer() {
    let s = setup_mocked();
    let first = Address::generate(&s.env);
    let second = Address::generate(&s.env);
    s.client.transfer_admin(&first);
    s.client.transfer_admin(&second);
    assert_eq!(s.client.pending_admin(), Some(second.clone()));

    s.client.cancel_admin_transfer();
    assert_eq!(
        s.env.events().all(),
        [events::AdminTransferCancelled {
            admin: s.admin.clone(),
            pending: second.clone(),
        }
        .to_xdr(&s.env, &s.client.address)]
    );
    assert_eq!(s.env.auths()[0].0, s.admin);
    assert_eq!(s.client.pending_admin(), None);
    assert_eq!(s.client.try_accept_admin(), Err(Ok(Error::NoPendingAdmin)));
}

#[test]
fn cancel_admin_transfer_without_admin_auth_fails() {
    let s = setup_mocked();
    let new_admin = Address::generate(&s.env);
    s.client.transfer_admin(&new_admin);
    s.env.mock_auths(&[MockAuth {
        address: &new_admin,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "cancel_admin_transfer",
            args: ().into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_cancel_admin_transfer().is_err());
    assert_eq!(s.client.pending_admin(), Some(new_admin));
}

#[test]
fn upgrade_without_admin_auth_fails() {
    let s = setup();
    let hash = BytesN::from_array(&s.env, &[7; 32]);
    assert!(s.client.try_upgrade(&hash).is_err());

    let intruder = Address::generate(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &intruder,
        invoke: &MockAuthInvoke {
            contract: &s.client.address,
            fn_name: "upgrade",
            args: (hash.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_upgrade(&hash).is_err());
}
