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
    /// Caller is not a registered curator.
    NotCurator = 9,
    /// Indicator kind is not one of `task`, `font`, `config`, `script`, `package`.
    InvalidKind = 10,
    /// A proposed or active indicator with this hash already exists.
    IndicatorExists = 11,
    /// No indicator with this hash.
    IndicatorNotFound = 12,
    /// Curator has already approved this indicator.
    AlreadyApproved = 13,
    /// Indicator has been retracted and can no longer change.
    IndicatorRetracted = 14,
    /// No attestation at this index for this repo.
    AttestationNotFound = 15,
    /// Attestation has already been retracted.
    AttestationRetracted = 16,
    /// Only the original attester or the admin may retract an attestation.
    NotAllowedToRetract = 17,
    /// Threshold is above the number of curators, so nothing could activate.
    ThresholdAboveCurators = 18,
    /// Removing this curator would leave fewer curators than the threshold.
    CuratorsBelowThreshold = 19,
}
