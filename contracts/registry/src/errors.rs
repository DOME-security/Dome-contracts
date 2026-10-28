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
    /// Caller is not a registered attester.
    NotAttester = 4,
    /// Verdict is not one of `clean`, `review`, `block`, `unreadable`.
    InvalidVerdict = 5,
    /// Commit id is not 20 (SHA-1) or 32 (SHA-256) raw bytes.
    InvalidCommit = 6,
    /// Scanner version must be non-zero.
    InvalidScanner = 7,
    /// Pagination limit is zero or above [`crate::storage::MAX_PAGE`].
    InvalidLimit = 8,
}
