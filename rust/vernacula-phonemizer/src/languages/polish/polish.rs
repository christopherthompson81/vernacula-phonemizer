//! Polish (pl) phonemizer: the rule g2p with fixed PENULTIMATE stress, and text() over Latin words (a foreign
//! name nativised), numbers with their decimal comma, and clause punctuation.
//! Ported from src/languages/polish/polish.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock};

use super::g2p::{Seg, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{
    is_unreadable_polish, normalize_polish, normalize_polish_initialisms, pl_count_form,
};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`: one Polish word → IPA, primary stress before the penultimate nucleus (or the only
/// one), NFC.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let segs = to_segments(word);
    let nuc: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    let stress_at = if nuc.len() >= 2 {
        Some(nuc[nuc.len() - 2])
    } else {
        nuc.first().copied()
    };
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if Some(i) == stress_at {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    normalize(&out, Form::Nfc)
}

/// `NATIVE_CLASS`: the language's own inventory.
const NATIVE_CLASS: &str = "[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"({})|(\d+(?:,\d+)?)|([.?!,;:])", *LATIN_RUN),
        "gu",
    )
    .unwrap()
});

/// The Polish engine (`createPolish`).
pub struct PolishPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `PolishPhonemizer` proves the manifest loaded,
/// so none of these can reach a load panic. (The per-module differentials call them.)
impl PolishPhonemizer {
    /// `normalizePolish(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_polish(text)
    }

    /// `normalizePolishInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_polish_initialisms(text)
    }

    /// The shared symbol tier, as Polish builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadablePolish(word)` (normalize.ts).
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_polish(word)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `toSegments(word)` (g2p.ts).
    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `ordinal(n)` (romanOrdinals.ts).
    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        super::roman_ordinals::ordinal(n)
    }

    /// `plCountForm(n)` (normalize.ts).
    pub fn count_form(&self, n: f64) -> f64 {
        pl_count_form(n)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self
            .symbols
            .apply(&normalize_polish_initialisms(&normalize_polish(input)));
        let m = &*MANIFEST;
        assemble_clauses(&normalized, &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                // `m[2].split(",")`: the token holds at most one comma.
                let parts = num.split(&js(","));
                let int_part = &parts[0];
                for wd in number_to_words(js_number(int_part), Some(int_part)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js(&m.decimal_word)));
                    for d in frac.code_point_strings() {
                        for wd in number_to_words(js_number(&d), None).split(&js(" ")) {
                            sink.emit(&phonemize_word(&wd));
                        }
                    }
                }
            } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = m
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for PolishPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(PolishPhonemizer::text(self, input))
    }
}

/// `createPolish()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_polish() -> Result<PolishPhonemizer, String> {
    let m = try_manifest()?;
    let st = &m.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        units: Some(st.units.clone()),
        count_form: Some(Arc::new(pl_count_form)),
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        exponent_words: Some(st.exponent_words.clone()),
        magnitudes: Some(st.magnitudes.clone()),
        ampersand: Some(st.ampersand.clone()),
        multiply: Some(st.multiply.clone()),
        ..Default::default()
    })?;
    Ok(PolishPhonemizer { symbols })
}

/// Expectations derived from the TS engine (`.probe/pl/testvals.mts`), never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clock_decade_era_and_fraction_rewrites() {
        let e = create_polish().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        assert_eq!(
            n("Spotkanie o godz. 12:00 w sali."),
            "Spotkanie o godzinie dwunastej w sali."
        );
        assert_eq!(
            n("W latach 20. ubiegłego wieku."),
            "W latach dwudziestych ubiegłego wieku."
        );
        assert_eq!(
            n("W 300 r. p.n.e. powstało miasto."),
            "W 300 roku przed naszą erą powstało miasto."
        );
        // A sentence period no longer declines `1/2` (#1522).
        assert_eq!(n("To 1/5 i 1/2."), "To jedna piąta i jedna druga.");
    }

    /// #1522, mirrored from test/polish-1522.test.ts (values derived from the fixed TS).
    #[test]
    fn issue_1522_clock_decade_nasal_and_fraction() {
        let e = create_polish().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        let w = |s: &str| e.phonemize_word(&js(s)).to_string_lossy();
        // 1. the clock's left boundary
        assert_eq!(n("Wynik 123:45 i 21:01:05."), "Wynik 123:45 i 21:01:05.");
        assert_eq!(
            n("Spotkanie o 12:30 i 7:05."),
            "Spotkanie o dwunastej 30 i siódma 05."
        );
        // 2. a capitalised decade head
        assert_eq!(
            n("Lata 90. były dobre."),
            "Lata dziewięćdziesiąte były dobre."
        );
        assert_eq!(
            n("W Latach 20. było cicho."),
            "W Latach dwudziestych było cicho."
        );
        assert_eq!(n("Lata 90. Potem"), "Lata 90. Potem");
        // 3. ą/ę before a labial fricative
        assert_eq!(w("trąf"), "trˈɔw̃f");
        assert_eq!(w("jąwszy"), "jˈɔw̃fʂɨ");
        assert_eq!(w("kąpać"), "kˈɔmpat͡ɕ");
        assert_eq!(w("wąs"), "vˈɔns");
        assert_eq!(w("wąchać"), "vˈɔŋxat͡ɕ");
        // 5. a fraction before a clause stop; decimals and chains still decline
        assert_eq!(
            n("Pół to 1/2, a ćwierć 1/4."),
            "Pół to jedna druga, a ćwierć jedna czwarta."
        );
        assert_eq!(n("3/1/2 i 1/2,5 oraz 1,5/2"), "3/1/2 i 1/2,5 oraz 1,5/2");
    }

    #[test]
    fn agreement_century_ordinal_and_decimal_end_to_end() {
        let p = |s: &str| crate::phonemize(s, "pl").unwrap();
        assert_eq!(
            p("Mamy 21 000 drzew."),
            "mˈamɨ dvad͡ʑˈɛɕt͡ɕa jˈɛdɛn tɨɕˈɛnt͡sɨ dʐˈɛf ."
        );
        assert_eq!(p("To był XIX wiek."), "tˈɔ bˈɨw d͡ʑɛvjɛntnˈastɨ vjˈɛk .");
        assert_eq!(
            p("Wzrost o 2,4%."),
            "vzrˈɔst ˈɔ dvˈa pʂɛt͡ɕˈinɛk t͡ʂtˈɛrɨ prɔt͡sˈɛnta ."
        );
        assert_eq!(p("Pies i ludzie."), "pjˈɛs ˈi lˈud͡ʑɛ .");
    }
}
