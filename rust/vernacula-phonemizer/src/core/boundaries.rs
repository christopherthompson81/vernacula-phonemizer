//! The letter-boundary assertions, as pattern fragments for splicing into a runtime-built regex.
//! Ported from src/core/boundaries.ts — see that file for why these are not `\b`.

/// Nothing letter-like immediately to the LEFT.
pub const NOT_LETTER_BEFORE: &str = r"(?<![\p{L}\p{M}])";

/// Nothing letter-like immediately to the RIGHT.
pub const NOT_LETTER_AFTER: &str = r"(?![\p{L}\p{M}])";
