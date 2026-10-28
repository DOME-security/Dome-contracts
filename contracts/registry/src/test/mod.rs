//! Unit tests using `soroban-sdk` testutils. Every `require_auth` has a test
//! for the allowed path and for the rejected path.

mod roles;

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{DomeRegistry, DomeRegistryClient};

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
