//! The IPA vowel inventory shared by stress and syllable logic.
//! Ported from src/core/ipa.ts.

pub const IPA_VOWELS: &str = "əaeiouɪʊɛɔɐæyøɘɤʌɯɵœɜɞʉɨɶɑɒʏ";

/// Membership in `IPA_VOWELS`: the TS `Set` of its characters (all BMP, one code unit each).
pub fn is_ipa_vowel(u: u16) -> bool {
    IPA_VOWELS.encode_utf16().any(|v| v == u)
}
