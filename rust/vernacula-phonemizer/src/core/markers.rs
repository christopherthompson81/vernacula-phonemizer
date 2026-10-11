//! Sentinel markers: the characters a pass inserts to hold a place, named once and always written as escapes.
//! Ported from src/core/markers.ts — see that file for why a raw spelling is a review hazard.

/// A private-use sentinel, swapped back right after the pass that needs it.
pub const PUA_SENTINEL: &str = "\u{E000}";

/// A second private-use sentinel, for a pass that needs two distinct marks.
pub const PUA_SENTINEL_2: &str = "\u{E001}";

/// The NUL sentinel.
pub const NUL_SENTINEL: &str = "\u{0000}";
