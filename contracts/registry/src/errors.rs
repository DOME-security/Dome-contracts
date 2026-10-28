use soroban_sdk::contracterror;

/// Errors returned by the registry. Codes are part of the public interface:
/// never renumber an existing variant, only append new ones.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Threshold is below [`crate::storage::MIN_THRESHOLD`].
    InvalidThreshold = 1,
    /// Address already holds the role being granted.
    RoleAlreadyGranted = 2,
    /// Address does not hold the role being revoked.
    RoleNotGranted = 3,
}
