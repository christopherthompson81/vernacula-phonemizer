//! Indian English (en-IN, General Indian English) as a per-word rewrite of the General American reading:
//! retroflexion, TH-stopping, the v/w merger, FACE/GOAT monophthongs, de-aspiration, clear /l/, a rhotic tap.
//! Ported from src/languages/english-in/english-in.ts — see that file for the phonology.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::js_re;
use crate::languages::english::english::EnglishPhonemizer;

/// U+0361, the affricate tie: `t͡ʃ` / `d͡ʒ` are not retroflexed.
const TIE: &str = "\u{0361}";

static RETRO_T: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("t[\u{02B0}\u{032C}\u{0330}]?(?!{TIE})"), "gu").unwrap()
});
static RETRO_D: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("d[\u{032C}\u{0330}]?(?!{TIE})"), "gu").unwrap());

/// `toIndian(genAm)`: GenAm IPA → General Indian English, context-free. The order is the TS's: retroflexion
/// before TH-stopping, so the dental stops it creates are not swept up.
pub fn to_indian(gen_am: &JsString) -> JsString {
    let r = |re: &JsRegex, s: &JsString, to: &str| re.replace(s, &js(to));
    let s = r(&RETRO_T, gen_am, "ʈ");
    let s = r(&RETRO_D, &s, "ɖ");
    let s = r(js_re!("θ", "gu"), &s, "t̪ʰ");
    let s = r(js_re!("ð", "gu"), &s, "d̪");
    let s = r(js_re!("eᶦ", "gu"), &s, "eː");
    let s = r(js_re!("oᶷ", "gu"), &s, "oː");
    let s = r(js_re!("aᶦ", "gu"), &s, "aɪ");
    let s = r(js_re!("aᶷ", "gu"), &s, "aʊ");
    let s = r(js_re!("ᶦ", "gu"), &s, "ɪ");
    let s = r(js_re!("ᶷ", "gu"), &s, "ʊ");
    let s = r(js_re!("[vw]", "gu"), &s, "ʋ");
    let s = r(js_re!("pʰ", "gu"), &s, "p");
    let s = r(js_re!("kʰ", "gu"), &s, "k");
    let s = r(js_re!("ɫ", "gu"), &s, "l");
    let s = r(js_re!("ɝ", "gu"), &s, "əɾ");
    let s = r(js_re!("ɚ", "gu"), &s, "əɾ");
    let s = r(js_re!("ɹ", "gu"), &s, "ɾ");
    let s = r(js_re!("ᵻ", "gu"), &s, "ɪ");
    let s = r(js_re!("ᵿ", "gu"), &s, "ʊ");
    r(js_re!("ʲ", "gu"), &s, "")
}

/// `indianWordTransform`: the per-word delta, for the sync `text` and the async entry alike (the word is unused).
pub fn indian_word_transform(ipa: &JsString, _word: &JsString) -> JsString {
    to_indian(ipa)
}

/// `phonemizeWord(word)` (= `phonemizeWordRules`): the GenAm engine's whole `text(word)`, then the delta.
pub fn phonemize_word(en: &EnglishPhonemizer, word: &JsString) -> JsString {
    to_indian(&en.text(word))
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/english-in.test.ts's `phonemizeWord` pins, extracted from that file mechanically (each is a reading
    // the TS suite asserts), so the two engines are held to one list.
    const WORD_PINS: &[(&str, &str)] = &[
        ("tin", "ʈˈɪn"),
        ("din", "ɖˈɪn"),
        ("dog", "ɖˈɔːɡ"),
        ("water", "ʋˈɔːʈəɾ"),
        ("think", "t̪ʰˈɪŋk"),
        ("this", "d̪ˈɪs"),
        ("three", "t̪ʰɾˈiː"),
        ("wet", "ʋˈɛʈ"),
        ("vet", "ʋˈɛʈ"),
        ("very", "ʋˈɛɾi"),
        ("face", "fˈeːs"),
        ("goat", "ɡˈoːʈ"),
        ("train", "ʈɾˈeːn"),
        ("they", "d̪ˈeː"),
        ("cat", "kˈæʈ"),
        ("full", "fˈʊl"),
        ("little", "lˈɪʈl̩"),
        ("car", "kˈɑːɾ"),
        ("letter", "lˈɛʈəɾ"),
        ("word", "ʋˈəɾɖ"),
        ("start", "sʈˈɑːɾʈ"),
        ("church", "t͡ʃˈəɾt͡ʃ"),
        ("judge", "d͡ʒˈʌd͡ʒ"),
        ("price", "pɾˈaɪs"),
        ("time", "ʈˈaɪm"),
        ("student", "sʈˈuːɖn̩ʈ"),
        ("university", "jˌuːnəʋˈəɾsɪʈi"),
    ];

    #[test]
    fn ts_word_pins() {
        let en = crate::registry::english().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(phonemize_word(&en, &js(w)).to_string_lossy(), *want, "{w}");
        }
        // "tin" ≠ "thin": retroflex against dental, by place.
        assert_ne!(
            phonemize_word(&en, &js("tin")),
            phonemize_word(&en, &js("thin"))
        );
    }
}
