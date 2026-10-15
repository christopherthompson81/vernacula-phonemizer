//! Bavarian (bar) phonemizer: a greedy longest-match grapheme scan (falling and closing diphthongs, digraphs
//! first), then the code rules — the ich/ach split, silent post-vocalic ⟨h⟩, initial ⟨st sp⟩, geminate collapse,
//! ⟨gn⟩ coalescence, ⟨k⟩ lenition, the velar nasal, r-vocalization, final ⟨-a⟩ reduction; and text() over Latin
//! words (a foreign name nativised), numbers and clause punctuation.
//! Ported from src/languages/bavarian/bavarian.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{SYMBOLS, normalize_bavarian};
use super::numbers::{number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::ipa::IPA_VOWELS;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::normalize_symbols::SymbolNormalizer;
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

/// `ORDER`: the digraph keys stably sorted by UTF-16 length, longest first.
static ORDER: LazyLock<Vec<(JsString, JsString)>> = LazyLock::new(|| {
    let mut keys: Vec<(JsString, JsString)> = MANIFEST
        .digraphs
        .iter()
        .map(|(k, v)| (js(k), js(v)))
        .collect();
    keys.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));
    keys
});

#[derive(Clone, Debug)]
struct Tok {
    ph: JsString,
    r_var: bool,
    ch_var: bool,
}

/// `coreChars(ph)`: the NFD code points, less U+0300–036F and the length mark.
fn core_chars(ph: &JsString) -> Vec<u32> {
    normalize(ph, Form::Nfd)
        .code_points()
        .filter(|&x| !(0x300..=0x36f).contains(&x) && x != 0x2d0)
        .collect()
}

fn in_set(set: &str, x: u32) -> bool {
    char::from_u32(x).is_some_and(|c| set.contains(c))
}

fn starts_with_vowel(ph: &JsString) -> bool {
    core_chars(ph)
        .first()
        .is_some_and(|&x| in_set(IPA_VOWELS, x))
}

fn ends_with_vowel(ph: &JsString) -> bool {
    core_chars(ph)
        .last()
        .is_some_and(|&x| in_set(IPA_VOWELS, x))
}

/// `endsWithFrontVowel(ph)`: `FRONT_VOWEL` is `[..."eiyɛœøɐ"]`.
fn ends_with_front_vowel(ph: &JsString) -> bool {
    core_chars(ph).last().is_some_and(|&x| in_set("eiyɛœøɐ", x))
}

/// `scan(word)`: longest-match digraphs, then single graphemes, over code units.
fn scan(word: &JsString) -> Vec<Tok> {
    let w = normalize(word, Form::Nfc).to_lower_case();
    let u = w.units();
    let mut toks = Vec::new();
    let mut i = 0;
    'outer: while i < u.len() {
        for (key, ph) in ORDER.iter() {
            if u.len() >= i + key.len() && u[i..i + key.len()] == key.units()[..] {
                toks.push(Tok {
                    ph: ph.clone(),
                    r_var: false,
                    ch_var: *key == "ch",
                });
                i += key.len();
                continue 'outer;
            }
        }
        let c = JsString::from_units(&[u[i]]);
        // `G[c] ?? latinPhone(c, { initial: i === 0 })`
        let ph = MANIFEST
            .graphemes
            .get(&c.to_string_lossy())
            .map(|p| js(p))
            .or_else(|| {
                latin_phone(
                    &c,
                    PhoneOpts {
                        initial: i == 0,
                        include_h: false,
                    },
                )
            });
        if let Some(ph) = ph {
            toks.push(Tok {
                ph,
                r_var: c == "r",
                ch_var: false,
            });
        }
        i += 1;
    }
    toks
}

/// `resolveCh(toks)`.
fn resolve_ch(toks: &mut [Tok]) {
    for i in 0..toks.len() {
        if !toks[i].ch_var {
            continue;
        }
        let back =
            i > 0 && ends_with_vowel(&toks[i - 1].ph) && !ends_with_front_vowel(&toks[i - 1].ph);
        toks[i].ph = js(if back { "x" } else { "ç" });
    }
}

/// `vocalizeR(toks)`.
fn vocalize_r(toks: &mut [Tok]) {
    let Some(last) = toks.len().checked_sub(1) else {
        return;
    };
    let first_vowel = toks.iter().position(|t| starts_with_vowel(&t.ph));
    for i in 0..=last {
        if !toks[i].r_var {
            continue;
        }
        let next_vowel = i < last && starts_with_vowel(&toks[i + 1].ph);
        if next_vowel {
            continue;
        }
        let prev_is_e = i > 0 && toks[i - 1].ph == "e";
        // `i - 1 !== firstVowelIdx`, where a missing vowel is `-1`.
        if prev_is_e && (i == last || Some(i - 1) != first_vowel) {
            toks[i - 1].ph = js("ɐ");
            toks[i].ph = JsString::new();
        } else {
            toks[i].ph = js("ɐ̯");
        }
    }
}

/// `coalesceGN(toks)`.
fn coalesce_gn(toks: &mut [Tok]) {
    let n = toks.len();
    if n >= 2 && toks[n - 1].ph == "n" && toks[n - 2].ph == "ɡ̥" {
        toks[n - 2].ph = JsString::new();
        toks[n - 1].ph = js("ŋ");
    }
}

/// `initialSCluster(toks)`.
fn initial_s_cluster(toks: &mut [Tok]) {
    if toks.len() >= 2 && toks[0].ph == "s" && (toks[1].ph == "d̥" || toks[1].ph == "b̥") {
        toks[0].ph = js("ʃ");
    }
}

/// `silentH(toks)`.
fn silent_h(toks: &mut [Tok]) {
    for i in 1..toks.len() {
        if toks[i].ph == "h" && ends_with_vowel(&toks[i - 1].ph) {
            toks[i].ph = JsString::new();
        }
    }
}

/// `lenitK(toks)`.
fn lenit_k(toks: &mut [Tok]) {
    for i in 0..toks.len() {
        if toks[i].ph != "k" {
            continue;
        }
        let initial_before_liquid =
            i == 0 && i + 1 < toks.len() && (toks[i + 1].ph == "l" || toks[i + 1].ph == "r");
        if i > 0 || initial_before_liquid {
            toks[i].ph = js("ɡ̥");
        }
    }
}

/// `reduceFinalA(toks)`.
fn reduce_final_a(toks: &mut [Tok]) {
    let n = toks.len();
    if n >= 2 && toks[n - 1].ph == "ɑ" && !ends_with_vowel(&toks[n - 2].ph) {
        toks[n - 1].ph = js("ɐ");
    }
}

/// `velarNasal(toks)`.
fn velar_nasal(toks: &mut [Tok]) {
    for i in 0..toks.len().saturating_sub(1) {
        if toks[i].ph == "n" && (toks[i + 1].ph == "k" || toks[i + 1].ph == "ɡ̥") {
            toks[i].ph = js("ŋ");
        }
    }
}

/// `degeminate(toks)`.
fn degeminate(toks: &mut Vec<Tok>) {
    let mut i = toks.len().saturating_sub(1);
    while i > 0 {
        let p = &toks[i].ph;
        if !p.is_empty() && *p == toks[i - 1].ph && !starts_with_vowel(p) {
            toks.remove(i);
        }
        i -= 1;
    }
}

/// `phonemizeWord(word)`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let mut toks = scan(word);
    resolve_ch(&mut toks);
    silent_h(&mut toks);
    initial_s_cluster(&mut toks);
    degeminate(&mut toks);
    coalesce_gn(&mut toks);
    lenit_k(&mut toks);
    velar_nasal(&mut toks);
    vocalize_r(&mut toks);
    reduce_final_a(&mut toks);
    let mut out = JsString::new();
    for t in &toks {
        out.push_str(&t.ph);
    }
    out
}

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// `nat`: Bavarian's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zåäöüéèáàâßA-ZÅÄÖÜÉÈÁÀÂ'-]", "u")));

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "'-", "").unwrap();
    JsRegex::new(&format!(r"({run})|(\d+)|([.!?…,;:])"), "gu").unwrap()
});

/// The Bavarian engine (`createBavarian`).
pub struct BavarianPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `BavarianPhonemizer` proves the manifest and the
/// symbol tier loaded. (The per-module differentials call them.)
impl BavarianPhonemizer {
    /// `normalizeBavarian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_bavarian(self.symbols, text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&self.normalize(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for BavarianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(BavarianPhonemizer::text(self, input))
    }
}

/// `createBavarian()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_bavarian() -> Result<BavarianPhonemizer, String> {
    try_manifest()?;
    try_numbers()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(BavarianPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/bavarian.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["Boarisch"], Some("b̥oɐ̯riʃ")),
        ("phonemizeWord", &["Biaschtl"], Some("b̥iɐ̯ʃd̥l")),
        ("phonemizeWord", &["Aug"], Some("ɑɔ̯ɡ̥")),
        ("phonemizeWord", &["Foi"], Some("foe")),
        ("phonemizeWord", &["Taag"], Some("d̥aːɡ̥")),
        ("phonemizeWord", &["Klass"], Some("ɡ̥lɑs")),
        ("phonemizeWord", &["Bånk"], Some("b̥ɔŋɡ̥")),
        ("phonemizeWord", &["Bana"], Some("b̥ɑnɐ")),
        ("phonemizeWord", &["Wåssa"], Some("ʋɔsɐ")),
        ("phonemizeWord", &["Regn"], Some("reŋ")),
        ("phonemizeWord", &["Fruah"], Some("fruɐ̯")),
        ("phonemizeWord", &["Fühn"], Some("fyn")),
        ("phonemizeWord", &["Dånkschee"], Some("d̥ɔŋɡ̥ʃeː")),
        (
            "createBavarian().text",
            &["I bin a Boar."],
            Some("i b̥in ɑ b̥oɐ̯ɐ̯ ."),
        ),
        ("numberToWords", &["0"], Some("null")),
        ("numberToWords", &["21"], Some("oanazwånzg")),
        ("numberToWords", &["22"], Some("zwoarazwånzg")),
        ("numberToWords", &["45"], Some("fimfafiazg")),
        ("numberToWords", &["99"], Some("neinaneinzg")),
        ("numberToWords", &["100"], Some("hundad")),
        ("numberToWords", &["555"], Some("fimf hundad fimfafuchzg")),
        ("numberToWords", &["1000"], Some("dausnd")),
        (
            "numberToWords",
            &["12345"],
            Some("zwöif dausnd drei hundad fimfafiazg"),
        ),
        ("numberToWords", &["1000000"], Some("oa Million")),
        ("numberToWords", &["1000000000"], Some("oa Milliarde")),
        ("createBavarian().text", &["21"], Some("oɐ̯nɑt͡sʋɔnt͡sɡ̥")),
        (
            "createBavarian().text",
            &["555"],
            Some("fimf hund̥ɑd̥ fimfɑfuxt͡sɡ̥"),
        ),
        ("normalizeBavarian", &["67&nbsp;km"], Some("67 Kilometa")),
        (
            "createBavarian().text",
            &["67&nbsp;km"],
            Some("simɑseçt͡sɡ̥ kilomed̥ɐ"),
        ),
        (
            "normalizeBavarian",
            &["-13&nbsp;°C"],
            Some("minus 13 Grad Celsius"),
        ),
        (
            "normalizeBavarian",
            &["30.528 km²"],
            Some("30528 QuadratKilometa"),
        ),
        (
            "createBavarian().text",
            &["30.528 km²"],
            Some("d̥rɑɛ̯sɡ̥ d̥ɑɔ̯snd̥ fimf hund̥ɑd̥ ɔxd̥ɑt͡sʋɔnt͡sɡ̥ kvɑd̥rɑd̥ɡ̥ilomed̥ɐ"),
        ),
        (
            "normalizeBavarian",
            &["4.324.782 km²"],
            Some("4324782 QuadratKilometa"),
        ),
        ("normalizeBavarian", &["8140.43P"], Some("8140.43P")),
        ("normalizeBavarian", &["549 000 €"], Some("549000 Eiro")),
        (
            "normalizeBavarian",
            &["Beziak 5 - 8"],
            Some("Beziak 5 bis 8"),
        ),
        (
            "normalizeBavarian",
            &["vo 1961 -1990"],
            Some("vo 1961 bis 1990"),
        ),
        ("normalizeBavarian", &["1863–1952"], Some("1863 bis 1952")),
        (
            "normalizeBavarian",
            &["ÖNORM B 8115-2"],
            Some("ÖNORM B 8115-2"),
        ),
        (
            "normalizeBavarian",
            &["ISBN 3-86520-078-8"],
            Some("ISBN 3-86520-078-8"),
        ),
        (
            "normalizeBavarian",
            &["ISBN 978-3-484-23134-4"],
            Some("ISBN 978-3-484-23134-4"),
        ),
        (
            "normalizeBavarian",
            &["(10.–23.) is aa"],
            Some("(10.–23.) is aa"),
        ),
        (
            "normalizeBavarian",
            &["am 10. Novemba 1989"],
            Some("am zehntn Novemba 1989"),
        ),
        (
            "normalizeBavarian",
            &["im 20. Joahundat"],
            Some("im zwanzigstn Joahundat"),
        ),
        (
            "normalizeBavarian",
            &["da 2. Buachstob"],
            Some("da zwoate Buachstob"),
        ),
        (
            "normalizeBavarian",
            &["Minga, 2005. ISBN 3-86520-078-8"],
            Some("Minga, 2005. ISBN 3-86520-078-8"),
        ),
        (
            "normalizeBavarian",
            &["im Joar 1904. Und daun"],
            Some("im Joar 1904. Und daun"),
        ),
        (
            "createBavarian().text",
            &["im Joar 1904. Und daun"],
            Some("im joɐ̯ɐ̯ d̥ɑɔ̯snd̥ nɑɛ̯n hund̥ɑd̥ fiɐ̯ɐ̯ . und̥ d̥ɑɔ̯n"),
        ),
        (
            "normalizeBavarian",
            &["De 4. Auflage"],
            Some("De 4. Auflage"),
        ),
        ("normalizeBavarian", &["da 7. Beziak"], Some("da 7. Beziak")),
        (
            "normalizeBavarian",
            &["vo da 1. Person"],
            Some("vo da easchtn Person"),
        ),
        (
            "normalizeBavarian",
            &["in da 2. Person"],
            Some("in da zwoatn Person"),
        ),
        (
            "normalizeBavarian",
            &["um de 3. Person"],
            Some("um de dritte Person"),
        ),
        (
            "normalizeBavarian",
            &["aa de 2. Person"],
            Some("aa de zwoate Person"),
        ),
        (
            "normalizeBavarian",
            &["z. B. in da Regionalliga"],
            Some("zum Beispui in da Regionalliga"),
        ),
        (
            "normalizeBavarian",
            &["bzw. bairisch"],
            Some("beziehungsweise bairisch"),
        ),
        (
            "normalizeBavarian",
            &["za. 208.000 Eihw."],
            Some("zirka 208000 Eihwohna."),
        ),
        (
            "normalizeBavarian",
            &["21,905 Mrd. €"],
            Some("21,905 Milliardn Eiro"),
        ),
        ("normalizeBavarian", &["12:15"], Some("zwöif Uhr fuchzea")),
        (
            "normalizeBavarian",
            &["5:00-9:00 Uhr"],
            Some("fimf bis nein Uhr"),
        ),
        (
            "createBavarian().text",
            &["5:00-9:00 Uhr"],
            Some("fimf b̥is nɑɛ̯n uɐ̯"),
        ),
        (
            "normalizeBavarian",
            &["Seitnvoöitnis 39:15:36"],
            Some("Seitnvoöitnis 39:15:36"),
        ),
        (
            "normalizeBavarian",
            &["gkiazt: 13:5:12"],
            Some("gkiazt: 13:5:12"),
        ),
        ("normalizeBavarian", &["8,2 °C"], Some("8,2 Grad Celsius")),
        ("normalizeBavarian", &["℃ folds"], Some("°C folds")),
        ("normalizeBavarian", &["360°"], Some("360 Grad")),
        (
            "createBavarian().text",
            &["90°-Winkl"],
            Some("nɑɛ̯nt͡sɡ̥ ɡ̥rɑd̥ ʋiŋɡ̥l"),
        ),
        (
            "normalizeBavarian",
            &["bei -13 °C und +15 °C"],
            Some("bei minus 13 Grad Celsius und plus 15 Grad Celsius"),
        ),
        (
            "normalizeBavarian",
            &["woa −45,9 Grad Celsius"],
            Some("woa minus 45,9 Grad Celsius"),
        ),
        (
            "normalizeBavarian",
            &["−1 bis −2 °C"],
            Some("minus 1 bis minus 2 Grad Celsius"),
        ),
        (
            "normalizeBavarian",
            &["mit -0,5 beziehungsweise -1,4 °C"],
            Some("mit minus 0,5 beziehungsweise minus 1,4 Grad Celsius"),
        ),
        (
            "normalizeBavarian",
            &["mit 18 beziahungsweis 17 °C"],
            Some("mit 18 beziahungsweis 17 Grad Celsius"),
        ),
        (
            "normalizeBavarian",
            &["de Joar vo 1961 -1990"],
            Some("de Joar vo 1961 bis 1990"),
        ),
        (
            "normalizeBavarian",
            &["bisherign Beziak 5 - 8"],
            Some("bisherign Beziak 5 bis 8"),
        ),
        (
            "normalizeBavarian",
            &["håt 2/3 vo da Produktion"],
            Some("håt zwoa Driddl vo da Produktion"),
        ),
        ("normalizeBavarian", &["håt 1/3"], Some("håt a Driddl")),
        (
            "normalizeBavarian",
            &["1/2 und 1/4"],
            Some("a hoib und a Viadl"),
        ),
        (
            "normalizeBavarian",
            &["im Winta 469/470"],
            Some("im Winta 469/470"),
        ),
        (
            "normalizeBavarian",
            &["Santana 300/350"],
            Some("Santana 300/350"),
        ),
        (
            "normalizeBavarian",
            &["3/7 vo da Fläch"],
            Some("3/7 vo da Fläch"),
        ),
        (
            "normalizeBavarian",
            &["59% vo da Beväikarung"],
            Some("59 Prozent vo da Beväikarung"),
        ),
        (
            "normalizeBavarian",
            &["2,1 % im Sektor"],
            Some("2,1 Prozent im Sektor"),
        ),
        ("normalizeBavarian", &["11.709 €"], Some("11709 Eiro")),
        ("normalizeBavarian", &["$ 45.000"], Some("45000 Dollar")),
        ("normalizeBavarian", &["£ 795"], Some("795 Pfund")),
        (
            "normalizeBavarian",
            &["US$105&nbsp;Milliona"],
            Some("105 Milliona Dollar"),
        ),
        ("normalizeBavarian", &["3757 km"], Some("3757 Kilometa")),
        ("normalizeBavarian", &["374 m"], Some("374 Meta")),
        ("normalizeBavarian", &["40.000 m³"], Some("40000 KubikMeta")),
        (
            "createBavarian().text",
            &["40.000 m³"],
            Some("fiɐ̯t͡sɡ̥ d̥ɑɔ̯snd̥ kub̥iɡ̥med̥ɐ"),
        ),
        (
            "normalizeBavarian",
            &["2.800 cm³"],
            Some("2800 KubikZantimeta"),
        ),
        (
            "normalizeBavarian",
            &["10,5 Millionan"],
            Some("10,5 Millionan"),
        ),
        ("normalizeBavarian", &["da- (< der-)"], Some("da- (< der-)")),
        (
            "normalizeBavarian",
            &["Lautwandlregl ei > oa"],
            Some("Lautwandlregl ei > oa"),
        ),
        (
            "normalizeBavarian",
            &["bei dem = beim"],
            Some("bei dem = beim"),
        ),
        (
            "normalizeBavarian",
            &["Königshausen & Neumann"],
            Some("Königshausen & Neumann"),
        ),
        (
            "phonemize",
            &["9007199254740993", "bar"],
            Some("nɑɛ̯n nul nul sim oɐ̯ns nɑɛ̯n nɑɛ̯n t͡sʋoɐ̯ fimf fiɐ̯ɐ̯ sim fiɐ̯ɐ̯ nul nɑɛ̯n nɑɛ̯n d̥rɑɛ̯"),
        ),
        (
            "phonemize",
            &["1000000000000000000000", "bar"],
            Some(
                "oɐ̯ns nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul",
            ),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_bavarian().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString, n: usize| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeBavarian" => Some(e.normalize(&a(0))),
                "numberToWords" => {
                    Some(e.number_to_words(js_number(&a(0)), (n > 1).then(|| a(1)).as_ref()))
                }
                "createBavarian().text" => Some(e.text(&a(0))),
                "phonemize" => Some(js(&crate::phonemize(
                    &a(0).to_string_lossy(),
                    &a(1).to_string_lossy(),
                )
                .unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let a = |i: usize| js(args[i]);
            let got: Option<String> = call(f, &a, args.len()).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
