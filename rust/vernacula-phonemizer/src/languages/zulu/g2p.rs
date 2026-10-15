//! The shared Nguni grapheme scan: a longest-match walk over a rule table (Zulu's by default; Xhosa passes its
//! own), so clicks and affricates resolve as single segments.
//! Ported from src/languages/zulu/g2p.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, ZuluManifest};
use crate::core::js_string::{JsString, js};

/// One scanned segment: its IPA and whether it is a vowel nucleus.
#[derive(Clone, Debug)]
pub struct Seg {
    pub ph: JsString,
    pub v: bool,
}

/// A longest-match rule (orth, ipa, isVowelNucleus), in the table's order.
pub type Rule = (JsString, JsString, bool);

/// A manifest's rule table as `Rule`s, in order.
pub fn rules_of(m: &ZuluManifest) -> Vec<Rule> {
    m.rules.iter().map(|(o, i, v)| (js(o), js(i), *v)).collect()
}

/// `RULES`: the Zulu table.
pub static RULES: LazyLock<Vec<Rule>> = LazyLock::new(|| rules_of(&MANIFEST));

/// `toSegments(word, rules)`: scan Nguni orthography into IPA segments. An unknown code unit is skipped.
pub fn to_segments(word: &JsString, rules: &[Rule]) -> Vec<Seg> {
    let w = word.to_lower_case();
    let ntsh = js("ntsh");
    let mut segs = Vec::new();
    let mut i = 0;
    'outer: while i < w.len() {
        if i == 0 && w.starts_with(&ntsh) {
            segs.push(Seg {
                ph: js("n"),
                v: false,
            });
            segs.push(Seg {
                ph: js("t͡ʃʼ"),
                v: false,
            });
            i += 4;
            continue;
        }
        for (orth, ipa, v) in rules {
            if w.0[i..].starts_with(&orth.0) {
                segs.push(Seg {
                    ph: ipa.clone(),
                    v: *v,
                });
                i += orth.len();
                continue 'outer;
            }
        }
        i += 1;
    }
    segs
}
