//! Thai tone computation: consonant class × syllable life × vowel length × tone mark, from the manifest's
//! tone tables (after Wiktionary Module:th-pron). Ported from src/languages/thai/thaiTone.ts — see that file
//! for the corpus evidence.

use super::manifest::{MANIFEST, ToneIpa};
pub use super::manifest::{ThaiConsonantClass, ThaiTone};

/// A tone mark, as its code point (◌่ ◌้ ◌๊ ◌๋, or the respelling-only macron ◌̄).
pub type ThaiToneMark = u32;

fn cp_key(c: u32) -> String {
    char::from_u32(c).map(String::from).unwrap_or_default()
}

/// `THAI_TONE_IPA`.
pub fn thai_tone_ipa() -> &'static ToneIpa {
    &MANIFEST.tone.ipa
}

/// `thaiConsonantClass(consonant)`.
pub fn thai_consonant_class(consonant: u32) -> Option<ThaiConsonantClass> {
    MANIFEST.tone.class.get(&cp_key(consonant)).copied()
}

/// The silent leader of `thaiEffectiveClass`.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum SilentLeader {
    Ho,
    O,
}

/// `thaiEffectiveClass(initial, silentLeader)`.
pub fn thai_effective_class(
    initial: u32,
    silent_leader: Option<SilentLeader>,
) -> Option<ThaiConsonantClass> {
    thai_consonant_class(initial)?;
    match silent_leader {
        Some(SilentLeader::Ho) => Some(ThaiConsonantClass::High),
        Some(SilentLeader::O) => Some(ThaiConsonantClass::Mid),
        None => thai_consonant_class(initial),
    }
}

/// `computeThaiTone(class, life, length, mark)`. ⚠ The tables are indexed without a check, as the TS's `!`:
/// a mark or key the manifest lacks is a data error.
pub fn compute_thai_tone(
    class: ThaiConsonantClass,
    live: bool,
    long: bool,
    mark: Option<ThaiToneMark>,
) -> ThaiTone {
    if let Some(m) = mark {
        return MANIFEST
            .tone
            .from_mark
            .get(&cp_key(m))
            .unwrap_or_else(|| panic!("thai.jsonc tone.fromMark has no U+{m:04X}"))
            .get(class);
    }
    let key = if live {
        "live"
    } else if long {
        "dead-long"
    } else {
        "dead-short"
    };
    MANIFEST
        .tone
        .no_mark
        .get(key)
        .unwrap_or_else(|| panic!("thai.jsonc tone.noMark has no {key}"))
        .get(class)
}
