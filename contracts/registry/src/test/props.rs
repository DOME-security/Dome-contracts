//! Property-based tests for the curator and approval state machine.
//!
//! Random sequences of role changes, threshold changes, proposals, approvals
//! and retractions run against the contract and against a plain Rust model of
//! the rules. After every step the contract must agree with the model, and
//! these invariants must hold:
//!
//! - an indicator becomes `active` only when approvals from distinct current
//!   curators reach the threshold;
//! - `is_known_bad` is true exactly for `active` indicators;
//! - approvals never contain the same curator twice;
//! - the threshold is always at least 2, and once there are at least
//!   `threshold` curators, removals never take the count below it.

use std::collections::BTreeMap;
use std::vec::Vec;

use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Symbol};

use super::indicator_input;
use crate::{DomeRegistry, DomeRegistryClient, Error};

const CURATORS: u8 = 5;
const HASHES: u8 = 3;

#[derive(Clone, Debug)]
enum Op {
    AddCurator(u8),
    RemoveCurator(u8),
    SetThreshold(u32),
    Propose(u8, u8),
    Approve(u8, u8),
    Retract(u8, u8),
}

fn op() -> impl Strategy<Value = Op> {
    let c = 0..CURATORS;
    let h = 0..HASHES;
    prop_oneof![
        3 => c.clone().prop_map(Op::AddCurator),
        1 => c.clone().prop_map(Op::RemoveCurator),
        1 => (0u32..7).prop_map(Op::SetThreshold),
        2 => (c.clone(), h.clone()).prop_map(|(c, h)| Op::Propose(c, h)),
        4 => (c.clone(), h.clone()).prop_map(|(c, h)| Op::Approve(c, h)),
        1 => (c, h).prop_map(|(c, h)| Op::Retract(c, h)),
    ]
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Status {
    Proposed,
    Active,
    Retracted,
}

#[derive(Default)]
struct Model {
    curators: [bool; CURATORS as usize],
    threshold: u32,
    indicators: BTreeMap<u8, (Status, Vec<u8>)>,
}

impl Model {
    fn count(&self) -> u32 {
        self.curators.iter().filter(|c| **c).count() as u32
    }

    fn valid(&self, approvals: &[u8]) -> u32 {
        approvals
            .iter()
            .filter(|c| self.curators[**c as usize])
            .count() as u32
    }

    /// Applies `op` to the model and returns what the contract should return.
    fn apply(&mut self, op: &Op) -> Result<(), Error> {
        match *op {
            Op::AddCurator(c) => {
                if self.curators[c as usize] {
                    return Err(Error::RoleAlreadyGranted);
                }
                self.curators[c as usize] = true;
            }
            Op::RemoveCurator(c) => {
                if !self.curators[c as usize] {
                    return Err(Error::RoleNotGranted);
                }
                let before = self.count();
                if before >= self.threshold && before - 1 < self.threshold {
                    return Err(Error::CuratorsBelowThreshold);
                }
                self.curators[c as usize] = false;
            }
            Op::SetThreshold(t) => {
                if t < 2 {
                    return Err(Error::InvalidThreshold);
                }
                if t > self.count() {
                    return Err(Error::ThresholdAboveCurators);
                }
                self.threshold = t;
            }
            Op::Propose(c, h) => {
                if !self.curators[c as usize] {
                    return Err(Error::NotCurator);
                }
                if matches!(self.indicators.get(&h), Some((s, _)) if *s != Status::Retracted) {
                    return Err(Error::IndicatorExists);
                }
                self.indicators
                    .insert(h, (Status::Proposed, Vec::from([c])));
            }
            Op::Approve(c, h) => {
                if !self.curators[c as usize] {
                    return Err(Error::NotCurator);
                }
                let (status, approvals) = self
                    .indicators
                    .get(&h)
                    .cloned()
                    .ok_or(Error::IndicatorNotFound)?;
                if status == Status::Retracted {
                    return Err(Error::IndicatorRetracted);
                }
                if approvals.contains(&c) {
                    return Err(Error::AlreadyApproved);
                }
                let mut approvals = approvals;
                approvals.push(c);
                let status =
                    if status == Status::Proposed && self.valid(&approvals) >= self.threshold {
                        Status::Active
                    } else {
                        status
                    };
                self.indicators.insert(h, (status, approvals));
            }
            Op::Retract(c, h) => {
                if !self.curators[c as usize] {
                    return Err(Error::NotCurator);
                }
                let entry = self
                    .indicators
                    .get_mut(&h)
                    .ok_or(Error::IndicatorNotFound)?;
                if entry.0 == Status::Retracted {
                    return Err(Error::IndicatorRetracted);
                }
                entry.0 = Status::Retracted;
            }
        }
        Ok(())
    }
}

/// Flattens a `try_` client result into the contract error, if any.
fn outcome<T, C, I: core::fmt::Debug>(
    r: Result<Result<T, C>, Result<Error, I>>,
) -> Result<(), Error> {
    match r {
        Ok(_) => Ok(()),
        Err(Ok(e)) => Err(e),
        Err(Err(e)) => panic!("host error instead of a contract error: {e:?}"),
    }
}

fn run(ops: Vec<Op>) -> Result<(), TestCaseError> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(DomeRegistry, (&admin, 2u32));
    let client = DomeRegistryClient::new(&env, &id);
    let curators: Vec<Address> = (0..CURATORS).map(|_| Address::generate(&env)).collect();
    let hashes: Vec<BytesN<32>> = (0..HASHES).map(|h| indicator_input(&env, h).hash).collect();
    let input = |h: u8| indicator_input(&env, h);
    let status = |s: Status| {
        Symbol::new(
            &env,
            match s {
                Status::Proposed => "proposed",
                Status::Active => "active",
                Status::Retracted => "retracted",
            },
        )
    };

    let mut model = Model {
        threshold: 2,
        ..Default::default()
    };
    let mut operational = false;

    for op in &ops {
        let before = hashes
            .iter()
            .map(|h| client.indicator(h).map(|i| i.status))
            .collect::<Vec<_>>();
        let expected = model.apply(op);
        let got = match *op {
            Op::AddCurator(c) => outcome(client.try_add_curator(&curators[c as usize])),
            Op::RemoveCurator(c) => outcome(client.try_remove_curator(&curators[c as usize])),
            Op::SetThreshold(t) => outcome(client.try_set_threshold(&t)),
            Op::Propose(c, h) => outcome(client.try_propose(&curators[c as usize], &input(h))),
            Op::Approve(c, h) => {
                outcome(client.try_approve(&curators[c as usize], &hashes[h as usize]))
            }
            Op::Retract(c, h) => outcome(client.try_retract(
                &curators[c as usize],
                &hashes[h as usize],
                &BytesN::from_array(&env, &[0x44; 32]),
            )),
        };
        prop_assert_eq!(got, expected, "op {:?}", op);

        // Contract agrees with the model.
        let threshold = client.threshold();
        let count = client.curator_count();
        prop_assert_eq!(threshold, model.threshold);
        prop_assert_eq!(count, model.count());
        for (n, c) in curators.iter().enumerate() {
            prop_assert_eq!(client.is_curator(c), model.curators[n]);
        }

        // Threshold invariants.
        prop_assert!(threshold >= 2);
        operational |= count >= threshold;
        if operational {
            prop_assert!(
                count >= threshold,
                "curators {count} < threshold {threshold}"
            );
        }

        for (n, h) in hashes.iter().enumerate() {
            let stored = client.indicator(h);
            let modelled = model.indicators.get(&(n as u8));
            prop_assert_eq!(stored.is_some(), modelled.is_some());
            let Some(ind) = stored else { continue };
            let (st, approvals) = modelled.unwrap();
            prop_assert_eq!(&ind.status, &status(*st));
            prop_assert_eq!(ind.approvals.len() as usize, approvals.len());
            prop_assert_eq!(client.is_known_bad(h), *st == Status::Active);

            // Approvals are distinct.
            let all: Vec<Address> = ind.approvals.iter().collect();
            for (i, a) in all.iter().enumerate() {
                prop_assert!(!all[i + 1..].contains(a), "duplicate approval");
            }

            // Became active in this step: the contract's own record must show
            // at least `threshold` approvals from current curators.
            let became_active = ind.status == status(Status::Active)
                && before[n].as_ref() != Some(&status(Status::Active));
            if became_active {
                let valid = all.iter().filter(|a| client.is_curator(a)).count() as u32;
                prop_assert!(valid >= threshold, "activated with {valid} < {threshold}");
            }
        }
    }
    Ok(())
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 128, ..ProptestConfig::default() })]

    #[test]
    fn approval_state_machine_matches_model(ops in prop::collection::vec(op(), 1..40)) {
        run(ops)?;
    }
}
