//! Unit tests using `soroban-sdk` testutils. Every `require_auth` has a test
//! for the allowed path and for the rejected path.

mod attestations;
mod roles;

use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN, Env, Symbol};

use crate::{AttestationInput, DomeRegistry, DomeRegistryClient};

pub struct Setup<'a> {
    pub env: Env,
    pub admin: Address,
    pub client: DomeRegistryClient<'a>,
}

/// Registry with a 2-of-N threshold and no auth mocking: each test decides
/// which signatures exist.
pub fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    let admin = Address::generate(&env);
    let id = env.register(DomeRegistry, (&admin, 2u32));
    let client = DomeRegistryClient::new(&env, &id);
    Setup { env, admin, client }
}

/// Same, with every `require_auth` satisfied.
pub fn setup_mocked<'a>() -> Setup<'a> {
    let s = setup();
    s.env.mock_all_auths();
    s
}

/// A well-formed attestation for repo id `seed` with a SHA-1 commit.
pub fn attestation_input(env: &Env, seed: u8, verdict: &str) -> AttestationInput {
    AttestationInput {
        repo: BytesN::from_array(env, &[seed; 32]),
        commit: Bytes::from_array(env, &[0xc0; 20]),
        verdict: Symbol::new(env, verdict),
        scanner: 1,
        rules: BytesN::from_array(env, &[0x11; 32]),
        report: BytesN::from_array(env, &[0x22; 32]),
    }
}
