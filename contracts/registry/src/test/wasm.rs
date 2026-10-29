//! Tests against the real contract Wasm: upgrade, resource budgets and code
//! size. Only `stellar contract build` can produce the Wasm, so these run when
//! `DOME_REGISTRY_WASM` points at the built file (`make test-wasm` and CI set
//! it) and are skipped otherwise. Budgets are documented in
//! docs/resources.md; raise them there and here together, with a reason.

use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events as _},
    Address, Bytes, BytesN, Env, Event,
};

use super::{attestation_input, indicator_input};
use crate::{DomeRegistry, DomeRegistryClient};

/// Network limit is 64 KiB; we keep well under it.
const MAX_WASM_BYTES: usize = 32 * 1024;

/// Per-call budgets for the main entry points, measured on the Wasm with
/// headroom of about 1.5x. Network limits are far higher (100M instructions
/// and 100 read entries per transaction on mainnet at the time of writing).
struct Budget {
    name: &'static str,
    cpu: i64,
    mem: i64,
    reads: u32,
}

#[rustfmt::skip]
const BUDGETS: &[Budget] = &[
    Budget { name: "attest",       cpu: 1_000_000, mem: 1_900_000, reads: 8 },
    Budget { name: "latest",       cpu:   900_000, mem: 1_900_000, reads: 4 },
    Budget { name: "propose",      cpu: 1_000_000, mem: 1_900_000, reads: 7 },
    Budget { name: "approve",      cpu: 1_100_000, mem: 1_900_000, reads: 8 },
    Budget { name: "approve_10",   cpu: 1_600_000, mem: 2_000_000, reads: 16 },
    Budget { name: "is_known_bad", cpu:   800_000, mem: 1_900_000, reads: 3 },
    Budget { name: "history_50",   cpu: 6_000_000, mem: 2_200_000, reads: 53 },
    Budget { name: "retract",      cpu: 1_100_000, mem: 1_900_000, reads: 7 },
];

fn wasm() -> Option<std::vec::Vec<u8>> {
    let Ok(path) = std::env::var("DOME_REGISTRY_WASM") else {
        std::println!("skipped: DOME_REGISTRY_WASM not set");
        return None;
    };
    Some(std::fs::read(path).expect("read DOME_REGISTRY_WASM"))
}

#[test]
fn wasm_size_is_within_budget() {
    let Some(wasm) = wasm() else { return };
    std::println!("wasm size: {} bytes", wasm.len());
    assert!(
        wasm.len() <= MAX_WASM_BYTES,
        "Wasm is {} bytes, budget is {MAX_WASM_BYTES}",
        wasm.len()
    );
}

/// Deploys the native contract as v1, writes roles, an attestation and an
/// active indicator, upgrades to the built Wasm, then checks that state
/// survived and that the upgraded code still accepts writes.
#[test]
fn upgrade_keeps_data_and_roles() {
    let Some(wasm) = wasm() else { return };
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(DomeRegistry, (&admin, 2u32));
    let client = DomeRegistryClient::new(&env, &id);

    let (c1, c2, attester) = (
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    );
    client.add_curator(&c1);
    client.add_curator(&c2);
    client.add_attester(&attester);
    let a = attestation_input(&env, 1, "block");
    client.attest(&attester, &a);
    let i = indicator_input(&env, 2);
    client.propose(&c1, &i);
    client.approve(&c2, &i.hash);
    let pending = Address::generate(&env);
    client.transfer_admin(&pending);

    let hash = env
        .deployer()
        .upload_contract_wasm(Bytes::from_slice(&env, &wasm));
    client.upgrade(&hash);
    assert_eq!(env.auths()[0].0, admin);
    assert_eq!(
        env.events().all(),
        [crate::events::Upgraded {
            wasm_hash: hash.clone()
        }
        .to_xdr(&env, &id)]
    );

    // Config and roles.
    assert_eq!(client.admin(), admin);
    assert_eq!(client.pending_admin(), Some(pending));
    assert_eq!(client.threshold(), 2);
    assert_eq!(client.curator_count(), 2);
    assert!(client.is_curator(&c1) && client.is_curator(&c2));
    assert!(client.is_attester(&attester));
    // Records.
    assert_eq!(client.attestation_count(&a.repo), 1);
    assert_eq!(
        client.latest(&a.repo).unwrap().verdict,
        symbol_short!("block")
    );
    assert!(client.is_known_bad(&i.hash));
    assert_eq!(client.indicator(&i.hash).unwrap().approvals.len(), 2);
    // The new code works on the old state.
    assert_eq!(client.attest(&attester, &a), 1);
}

/// Registers the Wasm with two curators and one attester.
fn wasm_registry<'a>(env: &Env, wasm: &[u8]) -> (DomeRegistryClient<'a>, [Address; 3]) {
    let admin = Address::generate(env);
    let id = env.register(wasm, (&admin, 2u32));
    let client = DomeRegistryClient::new(env, &id);
    let roles = [
        Address::generate(env),
        Address::generate(env),
        Address::generate(env),
    ];
    client.add_curator(&roles[0]);
    client.add_curator(&roles[1]);
    client.add_attester(&roles[2]);
    (client, roles)
}

fn check(env: &Env, name: &str) {
    let r = env.cost_estimate().resources();
    std::println!(
        "{name}: cpu={} mem={} read_entries={} write_entries={} write_bytes={}",
        r.instructions,
        r.mem_bytes,
        r.disk_read_entries + r.memory_read_entries,
        r.write_entries,
        r.write_bytes
    );
    let b = BUDGETS
        .iter()
        .find(|b| b.name == name)
        .unwrap_or_else(|| panic!("no budget for {name}"));
    let reads = r.disk_read_entries + r.memory_read_entries;
    assert!(
        r.instructions <= b.cpu,
        "{name}: cpu {} > budget {}",
        r.instructions,
        b.cpu
    );
    assert!(
        r.mem_bytes <= b.mem,
        "{name}: mem {} > budget {}",
        r.mem_bytes,
        b.mem
    );
    assert!(
        reads <= b.reads,
        "{name}: {reads} read entries > budget {}",
        b.reads
    );
}

#[test]
fn main_calls_stay_within_resource_budgets() {
    let Some(wasm) = wasm() else { return };
    let env = Env::default();
    env.mock_all_auths();
    let (client, [c1, c2, attester]) = wasm_registry(&env, &wasm);
    let a = attestation_input(&env, 1, "clean");
    let i = indicator_input(&env, 2);

    client.attest(&attester, &a);
    check(&env, "attest");
    client.latest(&a.repo);
    check(&env, "latest");
    client.propose(&c1, &i);
    check(&env, "propose");
    client.approve(&c2, &i.hash);
    check(&env, "approve");
    client.is_known_bad(&i.hash);
    check(&env, "is_known_bad");

    // Worst-case page: a full history page of 50.
    for _ in 1..50 {
        client.attest(&attester, &a);
    }
    assert_eq!(client.history(&a.repo, &0, &50).len(), 50);
    check(&env, "history_50");

    let reason = BytesN::from_array(&env, &[0x44; 32]);
    client.retract(&c1, &i.hash, &reason);
    check(&env, "retract");

    // Approval cost grows with the approvals list: measure the 10th.
    let j = indicator_input(&env, 3);
    client.propose(&c1, &j);
    client.approve(&c2, &j.hash);
    for n in 3..=10 {
        let c = Address::generate(&env);
        client.add_curator(&c);
        client.approve(&c, &j.hash);
        if n == 10 {
            check(&env, "approve_10");
        }
    }
}
