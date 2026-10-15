//! Javanese (jv) phonemizer: the Latin and Aksara Jawa scanners feeding one phonology (final ⟨k⟩→ʔ, nasal
//! assimilation, closed-syllable laxing, the a→ɔ rule, penult stress), the ⟨e⟩ lexicon, the ngoko numbers, and text().
//! Ported from src/languages/javanese/javanese.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::aksara::{aksara_digit, aksara_pada, scan_aksara, try_aksara};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{normalize_javanese, try_symbols};
use crate::core::clauses::{ClauseSink, assemble_clauses};
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

const VOWEL_LETTERS: &str = "aiueoéèê";

/// `LAX`: closed-syllable laxing, keyed by the source letter.
fn lax(v: &JsString) -> Option<&'static str> {
    match v.to_string_lossy().as_str() {
        "i" => Some("ɪ"),
        "u" => Some("ʊ"),
        "o" => Some("ɔ"),
        _ => None,
    }
}

/// One segment: its phone, and the source vowel letter for a nucleus ("" for a consonant).
#[derive(Debug, Clone)]
pub struct Seg {
    pub ph: JsString,
    pub v: JsString,
}

/// `scan(w)`: a lowercased Latin word into segments, digraphs first.
fn scan(w: &JsString) -> Vec<Seg> {
    let s = w.code_point_strings();
    let mut segs = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let dg = s[i].concat(&s.get(i + 1).cloned().unwrap_or_default());
        if let Some(ph) = MANIFEST
            .digraphs
            .get(&dg.to_string_lossy())
            .filter(|p| !p.is_empty())
        {
            segs.push(Seg {
                ph: js(ph),
                v: JsString::new(),
            });
            i += 2;
            continue;
        }
        let c = &s[i];
        let cs = c.to_string_lossy();
        // `VOWEL_LETTERS.includes(c)`: c is one code point, so a substring test is a membership test.
        if js(VOWEL_LETTERS).includes(c) {
            segs.push(Seg {
                ph: MANIFEST
                    .vowels
                    .get(&cs)
                    .map_or_else(|| c.clone(), |p| js(p)),
                v: c.clone(),
            });
        } else if let Some(ph) = MANIFEST.consonants.get(&cs) {
            segs.push(Seg {
                ph: js(ph),
                v: JsString::new(),
            });
        }
        i += 1;
    }
    segs
}

fn is_vowel_seg(sg: &Seg) -> bool {
    !sg.v.is_empty()
}

/// `consonantsAfter(segs, i)`: the consonant count before the next vowel, and that vowel's index.
fn consonants_after(segs: &[Seg], i: usize) -> (usize, usize) {
    let mut j = i + 1;
    while j < segs.len() && !is_vowel_seg(&segs[j]) {
        j += 1;
    }
    (j - i - 1, j)
}

/// `applyPhonology(segs)`: the shared phonology over either scan, then NFC.
pub fn apply_phonology(mut segs: Vec<Seg>) -> JsString {
    if segs.is_empty() {
        return JsString::new();
    }
    let n = segs.len();
    if segs[n - 1].ph == js("k") {
        segs[n - 1].ph = js("ʔ");
    }
    for i in 0..n - 1 {
        if segs[i].ph == js("n") && (segs[i + 1].ph == js("t͡ʃ") || segs[i + 1].ph == js("d͡ʒ"))
        {
            segs[i].ph = js("ɲ");
        }
    }
    for i in 0..n {
        let Some(l) = lax(&segs[i].v) else { continue };
        let (cons, next) = consonants_after(&segs, i);
        let closed = if next >= n { cons >= 1 } else { cons >= 2 };
        if closed {
            segs[i].ph = js(l);
        }
    }
    let vowel_idx: Vec<usize> = (0..n).filter(|&i| is_vowel_seg(&segs[i])).collect();
    if let Some(&last_v) = vowel_idx.last()
        && segs[last_v].v == js("a")
        && last_v == n - 1
    {
        segs[last_v].ph = js("ɔ");
        if vowel_idx.len() >= 2 {
            let penult = vowel_idx[vowel_idx.len() - 2];
            if segs[penult].v == js("a") && last_v - penult == 2 {
                segs[penult].ph = js("ɔ");
            }
        }
    }
    let stress: Option<usize> = if vowel_idx.len() >= 2 {
        Some(vowel_idx[vowel_idx.len() - 2])
    } else {
        vowel_idx.first().copied()
    };
    let mut out = JsString::new();
    for (i, sg) in segs.iter().enumerate() {
        if Some(i) == stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&sg.ph);
    }
    normalize(&out, Form::Nfc)
}

/// `AKSARA_WORD.test(word)`.
fn is_aksara(word: &JsString) -> bool {
    js_re!(r"[\u{A980}-\u{A9CF}]", "u").test(word)
}

/// `phonemizeWordRules(word)`: the rule engine only, routed by script.
pub fn phonemize_word_rules(word: &JsString) -> JsString {
    apply_phonology(if is_aksara(word) {
        scan_aksara(word)
    } else {
        scan(&word.to_lower_case())
    })
}

fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(
            DIR,
            "javanese-lexicon.tsv",
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
}

/// `phonemizeWord(word)`: the ⟨e⟩ lexicon for Latin input, else the rules.
pub fn phonemize_word(word: &JsString) -> JsString {
    if !is_aksara(word)
        && let Some(hit) = try_lexicon()
            .expect("checked by create_javanese")
            .get(&word.to_lower_case())
    {
        return hit.clone();
    }
    phonemize_word_rules(word)
}

/// `belowHundred(n)`, n in [1, 99].
fn below_hundred(n: f64) -> String {
    let num = &MANIFEST.numbers;
    if n < 10.0 {
        return num.units[n as usize].clone();
    }
    if n < 20.0 {
        return num.teens[n as usize - 10].clone();
    }
    if (21.0..=29.0).contains(&n) {
        return num.likur[n as usize - 20].clone();
    }
    let t = (n / 10.0).floor();
    let u = n % 10.0;
    // `NUM.tens[String(t)]` inside a template: a miss would print "undefined"; every t in 2..=9 is declared.
    let tens = num
        .tens
        .get(&js_number_to_string(t))
        .cloned()
        .unwrap_or_else(|| "undefined".into());
    if u > 0.0 {
        format!("{tens} {}", num.units[u as usize])
    } else {
        tens
    }
}

/// `belowThousand(n)`, n in [1, 999].
fn below_thousand(n: f64) -> String {
    let num = &MANIFEST.numbers;
    let h = (n / 100.0).floor();
    let r = n % 100.0;
    if h == 0.0 {
        return below_hundred(n);
    }
    let hw = if h == 1.0 {
        num.hundred_one.clone()
    } else {
        format!("{} {}", num.mult[h as usize], num.hundred)
    };
    if r > 0.0 {
        format!("{hw} {}", below_hundred(r))
    } else {
        hw
    }
}

/// `magnitude(count, [fused, word])`.
fn magnitude(count: f64, mag: &[String]) -> String {
    if count == 1.0 {
        return mag[0].clone();
    }
    if count <= 9.0 {
        return format!("{} {}", MANIFEST.numbers.mult[count as usize], mag[1]);
    }
    format!("{} {}", below_thousand(count), mag[1])
}

/// `numberToText(n)`: ngoko spelling, digit at a time from 10¹⁵.
pub fn number_to_text(mut n: f64) -> String {
    let num = &MANIFEST.numbers;
    if n == 0.0 {
        return num.units[0].clone();
    }
    if n >= 1e15 {
        return js_number_to_string(n)
            .chars()
            // `NUM.units[Number(d)]`: a non-digit indexes `undefined`, which `join` renders as "".
            .map(|d| {
                d.to_digit(10)
                    .map_or(String::new(), |x| num.units[x as usize].clone())
            })
            .collect::<Vec<_>>()
            .join(" ");
    }
    let mags = &num.magnitudes;
    let mut parts: Vec<String> = Vec::new();
    for (v, m) in [
        (1e12, &mags.trillion),
        (1e9, &mags.billion),
        (1e6, &mags.million),
        (1e3, &mags.thousand),
    ] {
        if n >= v {
            parts.push(magnitude((n / v).floor(), m));
            n %= v;
        }
    }
    if n > 0.0 {
        parts.push(below_thousand(n));
    }
    parts.join(" ")
}

/// `emitNumber(n, sink, digits)`: each ngoko word separately through the rules; digit at a time above 2⁵³.
fn emit_number(n: f64, sink: &mut ClauseSink, digits: Option<&JsString>) {
    if !is_safe_integer(n) {
        let ds = digits
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n)));
        for d in ds.code_point_strings() {
            let Some(&u) = d.units().first().filter(|_| d.len() == 1) else {
                continue;
            };
            if !(b'0' as u16..=b'9' as u16).contains(&u) {
                continue;
            }
            for wd in number_to_text(f64::from(u - b'0' as u16)).split(' ') {
                sink.emit(&phonemize_word_rules(&js(wd)));
            }
        }
        return;
    }
    for wd in number_to_text(n).split(' ') {
        sink.emit(&phonemize_word_rules(&js(wd)));
    }
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|([\u{{A980}}-\u{{A9C0}}]+)|([\u{{A9D0}}-\u{{A9D9}}]+)|(\d+)|([\u{{A9C1}}-\u{{A9CE}}\u{{A9DE}}\u{{A9DF}}])|([.?!,;:])",
            host_word_run(&["Latin"], "", "").unwrap()
        ),
        "gu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-zA-ZéèêÉÈÊ]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: a foreign letter folded onto the Latin base the g2p reads.
pub static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

pub struct JavanesePhonemizer;

impl JavanesePhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_javanese(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols()
            .expect("checked by create_javanese")
            .apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let input = normalize_javanese(input);
        assemble_clauses(&input, &TOKEN, |m, s, sink| {
            let latin = m.group(1, s);
            let aksara = m.group(2, s);
            if latin.as_ref().is_some_and(|w| !w.is_empty())
                || aksara.as_ref().is_some_and(|w| !w.is_empty())
            {
                let w = match latin {
                    Some(l) => NAT(&l),
                    None => aksara.unwrap(),
                };
                sink.emit(&phonemize_word(&w));
            } else if let Some(d) = m.group(3, s).filter(|d| !d.is_empty()) {
                let parts: Vec<JsString> =
                    d.code_point_strings().iter().map(aksara_digit).collect();
                let ascii = JsString::join(&parts, &JsString::new());
                emit_number(js_number(&ascii), sink, Some(&ascii));
            } else if let Some(d) = m.group(4, s).filter(|d| !d.is_empty()) {
                emit_number(js_number(&d), sink, Some(&d));
            } else if let Some(p) = m.group(5, s).filter(|p| !p.is_empty()) {
                if let Some(mk) = aksara_pada(&p).filter(|mk| !mk.is_empty()) {
                    sink.pause(&mk);
                }
            } else if let Some(p) = m.group(6, s).filter(|p| !p.is_empty())
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

impl Engine for JavanesePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(JavanesePhonemizer::text(self, input))
    }
}

/// `createJavanese()`. Loads both manifests, the ⟨e⟩ lexicon and the symbol tier up front.
pub fn create_javanese() -> Result<JavanesePhonemizer, String> {
    try_manifest()?;
    try_aksara()?;
    try_lexicon()?;
    try_symbols()?;
    Ok(JavanesePhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/javanese.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["apa"], Some("ˈɔpɔ")),
        ("phonemizeWord", &["mata"], Some("mˈɔt̪ɔ")),
        ("phonemizeWord", &["Jawa"], Some("d͡ʒˈɔwɔ")),
        ("phonemizeWord", &["basa"], Some("bˈɔsɔ")),
        ("phonemizeWord", &["lima"], Some("lˈimɔ")),
        ("phonemizeWord", &["sanga"], Some("sˈɔŋɔ")),
        ("phonemizeWord", &["mangan"], Some("mˈaŋan")),
        ("phonemizeWord", &["dalan"], Some("d̪ˈalan")),
        ("phonemizeWord", &["kutha"], Some("kˈuʈɔ")),
        ("phonemizeWord", &["dhawuh"], Some("ɖˈawʊh")),
        ("phonemizeWord", &["pitik"], Some("pˈit̪ɪʔ")),
        ("phonemizeWord", &["cilik"], Some("t͡ʃˈilɪʔ")),
        ("phonemizeWord", &["wong"], Some("wˈɔŋ")),
        ("phonemizeWord", &["dhuwur"], Some("ɖˈuwʊr")),
        ("phonemizeWord", &["sega"], Some("sˈəɡɔ")),
        ("phonemizeWord", &["élok"], Some("ˈelɔʔ")),
        ("phonemizeWord", &["kringèt"], Some("krˈiŋɛt̪")),
        ("phonemizeWord", &["kanca"], Some("kˈaɲt͡ʃɔ")),
        ("phonemizeWord", &["banci"], Some("bˈaɲt͡ʃi")),
        ("phonemizeWord", &["pangeran"], Some("paŋˈeran")),
        ("phonemizeWordRules", &["pangeran"], Some("paŋˈəran")),
        ("phonemizeWord", &["bebek"], Some("bˈebeʔ")),
        ("phonemize", &["50", "jv"], Some("sˈəkət̪")),
        ("phonemize", &["20", "jv"], Some("rˈɔŋ pˈulʊh")),
        ("phonemize", &["25", "jv"], Some("səlˈawe")),
        ("phonemize", &["60", "jv"], Some("səwˈid̪aʔ")),
        ("phonemize", &["100", "jv"], Some("sˈat̪ʊs")),
        (
            "phonemize",
            &["1234", "jv"],
            Some("sˈəwu rˈɔŋ ˈat̪ʊs t̪ˈəlʊŋ pˈulʊh pˈapat̪"),
        ),
        (
            "phonemize",
            &["Aku mangan sega.", "jv"],
            Some("ˈaku mˈaŋan sˈəɡɔ ."),
        ),
        ("phonemizeWord", &["ꦗꦮ"], Some("d͡ʒˈɔwɔ")),
        ("phonemizeWord", &["ꦱꦺꦭ"], Some("sˈelɔ")),
        ("phonemizeWord", &["ꦥꦸꦭꦺꦴ"], Some("pˈulo")),
        ("phonemizeWord", &["ꦮꦺꦴꦁ"], Some("wˈɔŋ")),
        ("phonemizeWord", &["ꦱꦽꦔꦺꦔꦺ"], Some("srəŋˈeŋe")),
        ("phonemizeWord", &["ꦏꦸꦛ"], Some("kˈuʈɔ")),
        ("phonemizeWord", &["ꦒꦗꦃ"], Some("ɡˈad͡ʒah")),
        ("phonemizeWord", &["ꦲꦧꦁ"], Some("ˈabaŋ")),
        ("phonemizeWord", &["ꦥꦶꦠꦶꦏ꧀"], Some("pˈit̪ɪʔ")),
        ("phonemize", &["꧑꧒꧓", "jv"], Some("sˈat̪ʊs t̪əlulˈikʊr")),
        ("normalizeJavanese", &["1.500"], Some("1500")),
        ("normalizeJavanese", &["200.000"], Some("200000")),
        ("normalizeJavanese", &["32,548"], Some("32548")),
        ("normalizeJavanese", &["1.485,36"], Some("1485 koma 3 6")),
        ("normalizeJavanese", &["1,4"], Some("1 koma 4")),
        ("normalizeJavanese", &["43,34"], Some("43 koma 3 4")),
        ("normalizeJavanese", &["16.46"], Some("16 koma 4 6")),
        ("normalizeJavanese", &["nomer 1.2.3"], Some("nomer 1.2.3")),
        ("normalizeJavanese", &["Ana 3.5."], Some("Ana 3 koma 5.")),
        ("normalizeJavanese", &["jam 09.00"], Some("jam 9")),
        (
            "normalizeJavanese",
            &["saka 00.00-03.00 ésuk"],
            Some("saka 0 nganti 3 ésuk"),
        ),
        ("normalizeJavanese", &["jam 08.45"], Some("jam 08.45")),
        (
            "normalizeJavanese",
            &["jam 00:02:32 WIB"],
            Some("jam 00:02:32 WIB"),
        ),
        ("normalizeJavanese", &["QS 3:83"], Some("ki ès 3:83")),
        (
            "normalizeJavanese",
            &["Ana QS 3:83"],
            Some("Ana ki ès 3:83"),
        ),
        (
            "normalizeJavanese",
            &["taun 750 nganti 925"],
            Some("taun 750 nganti 925"),
        ),
        ("normalizeJavanese", &["10-15"], Some("10 nganti 15")),
        (
            "normalizeJavanese",
            &["73–94 persèn"],
            Some("73 nganti 94 persèn"),
        ),
        (
            "phonemize",
            &["72%-83%", "jv"],
            Some("pˈit̪ʊŋ pˈulʊh lˈoro pˈərsɛn ŋˈant̪i wˈolʊŋ pˈulʊh t̪ˈəlu pˈərsɛn"),
        ),
        ("phonemizeWord", &["nganti"], Some("ŋˈant̪i")),
        (
            "normalizeJavanese",
            &["110°30'-110°45'"],
            Some("110 drajat 30' nganti 110 drajat 45'"),
        ),
        (
            "normalizeJavanese",
            &["157-167 doi:10.1016/0301-0104"],
            Some("157-167 doi:10.1016/0301-0104"),
        ),
        (
            "normalizeJavanese",
            &["10-15(-17) cm"],
            Some("10 nganti 15(-17) sèntimèter"),
        ),
        (
            "normalizeJavanese",
            &["abad 15-16."],
            Some("abad 15 nganti 16."),
        ),
        ("normalizeJavanese", &["15-17."], Some("15 nganti 17.")),
        (
            "normalizeJavanese",
            &["ing 2004-2005."],
            Some("ing 2004 nganti 2005."),
        ),
        (
            "normalizeJavanese",
            &["3-4,5(-12,5) cm"],
            Some("3 nganti 4 koma 5(-12 koma 5) sèntimèter"),
        ),
        (
            "phonemize",
            &["132.000 km²", "jv"],
            Some("sˈat̪ʊs t̪ˈəlʊŋ pˈulʊh lˈoro ˈəwu kilomˈɛt̪ər pərsˈəɡi"),
        ),
        ("phonemizeWord", &["persegi"], Some("pərsˈəɡi")),
        (
            "phonemize",
            &["1 m³/s", "jv"],
            Some("sˈid͡ʒi mˈɛt̪ər kˈubɪʔ pˈər d̪ˈət̪ɪʔ"),
        ),
        ("phonemizeWord", &["kubik"], Some("kˈubɪʔ")),
        (
            "phonemize",
            &["5 km/jam", "jv"],
            Some("lˈimɔ kilomˈɛt̪ər pˈər d͡ʒˈam"),
        ),
        ("phonemizeWord", &["per"], Some("pˈər")),
        (
            "phonemize",
            &["3,95 g/cm³", "jv"],
            Some("t̪ˈəlu kˈomɔ sˈɔŋɔ lˈimɔ ɡrˈam pˈər sɛnt̪imˈɛt̪ər kˈubɪʔ"),
        ),
        ("phonemizeWord", &["gram"], Some("ɡrˈam")),
        (
            "phonemize",
            &["475 jiwa/km²", "jv"],
            Some("pˈat̪aŋ ˈat̪ʊs pˈit̪ʊŋ pˈulʊh lˈimɔ d͡ʒˈiwɔ pˈər kilomˈɛt̪ər pərsˈəɡi"),
        ),
        ("phonemize", &["18 mm", "jv"], Some("wolˈulas milimˈɛt̪ər")),
        ("phonemizeWord", &["milimèter"], Some("milimˈɛt̪ər")),
        (
            "phonemize",
            &["2000 mm/taun", "jv"],
            Some("rˈɔŋ ˈəwu milimˈɛt̪ər pˈər t̪ˈaʊn"),
        ),
        ("phonemize", &["10 l", "jv"], Some("səpˈulʊh lˈit̪ər")),
        ("phonemizeWord", &["liter"], Some("lˈit̪ər")),
        ("phonemize", &["10 L", "jv"], Some("səpˈulʊh lˈit̪ər")),
        (
            "phonemize",
            &["198.000 Ha", "jv"],
            Some("sˈat̪ʊs sˈaŋaŋ pˈulʊh wˈolu ˈəwu hˈɛkt̪ar"),
        ),
        ("phonemizeWord", &["hèktar"], Some("hˈɛkt̪ar")),
        ("phonemize", &["10 ha", "jv"], Some("səpˈulʊh hˈɛkt̪ar")),
        ("phonemize", &["14 mg", "jv"], Some("pat̪bˈəlas milˈɪɡram")),
        ("phonemizeWord", &["miligram"], Some("milˈɪɡram")),
        (
            "phonemize",
            &["1,1 mg besi", "jv"],
            Some("sˈid͡ʒi kˈomɔ sˈid͡ʒi milˈɪɡram bˈəsi"),
        ),
        (
            "phonemize",
            &["Magnesium (Mg)", "jv"],
            Some("maɡnəsˈiʊm mɡ"),
        ),
        ("normalizeJavanese", &["20°C"], Some("20 drajat celsius")),
        ("normalizeJavanese", &["6°LU"], Some("6 drajat èl u")),
        (
            "phonemize",
            &["AS$143 milyar", "jv"],
            Some("sˈat̪ʊs pˈat̪aŋ pˈulʊh t̪ˈəlu mˈɪljar d̪ˈolar ˈɔ ˈɛs"),
        ),
        ("phonemizeWord", &["dolar"], Some("d̪ˈolar")),
        (
            "phonemize",
            &["US$100 milyar", "jv"],
            Some("sˈat̪ʊs mˈɪljar d̪ˈolar ˈɔ ˈɛs"),
        ),
        (
            "phonemize",
            &["Rp. 5.000", "jv"],
            Some("lˈimaŋ ˈəwu rupˈiah"),
        ),
        ("phonemizeWord", &["rupiah"], Some("rupˈiah")),
        (
            "normalizeJavanese",
            &["± 1.485,36"],
            Some("kurang luwih 1485 koma 3 6"),
        ),
        (
            "normalizeJavanese",
            &["+/- 327.866"],
            Some("kurang luwih 327866"),
        ),
        ("phonemize", &["A&B", "jv"], Some("ˈɔ lˈan b")),
        ("phonemizeWord", &["lan"], Some("lˈan")),
        ("normalizeJavanese", &["1/2"], Some("setengah")),
        ("normalizeJavanese", &["1/3"], Some("sapratelon")),
        ("normalizeJavanese", &["1/4"], Some("saprapat")),
        (
            "normalizeJavanese",
            &["taun 1985/1986"],
            Some("taun 1985/1986"),
        ),
        (
            "phonemize",
            &["½ kilogram", "jv"],
            Some("sət̪ˈəŋah kilˈɔɡram"),
        ),
        ("phonemizeWord", &["setengah"], Some("sət̪ˈəŋah")),
        ("phonemizeWord", &["kilogram"], Some("kilˈɔɡram")),
        ("phonemize", &["PBB", "jv"], Some("pˈe bˈe bˈe")),
        ("phonemizeWord", &["pé"], Some("pˈe")),
        ("phonemizeWord", &["bé"], Some("bˈe")),
        ("phonemize", &["PDB", "jv"], Some("pˈe d̪ˈe bˈe")),
        ("phonemizeWord", &["dé"], Some("d̪ˈe")),
        ("phonemize", &["UGM", "jv"], Some("ˈu ɡˈe ˈɛm")),
        ("phonemizeWord", &["u"], Some("ˈu")),
        ("phonemizeWord", &["gé"], Some("ɡˈe")),
        ("phonemizeWord", &["èm"], Some("ˈɛm")),
        ("phonemize", &["UNESCO", "jv"], Some("unˈəst͡ʃo")),
        ("phonemizeWord", &["UNESCO"], Some("unˈəst͡ʃo")),
        ("phonemize", &["WIB", "jv"], Some("wˈɪb")),
        ("phonemizeWord", &["WIB"], Some("wˈɪb")),
        ("phonemizeWord", &["a"], Some("ˈɔ")),
        ("phonemizeWord", &["ka"], Some("kˈɔ")),
        ("phonemizeWord", &["té"], Some("t̪ˈe")),
        ("phonemize", &["AS", "jv"], Some("ˈɔ ˈɛs")),
        ("phonemizeWord", &["ès"], Some("ˈɛs")),
        (
            "phonemize",
            &["R. T. Sumantri", "jv"],
            Some("ˈɛr t̪ˈe sumˈant̪ri"),
        ),
        ("phonemizeWord", &["èr"], Some("ˈɛr")),
        (
            "phonemize",
            &["Perang Donya II", "jv"],
            Some("pˈəraŋ d̪ˈoɲɔ lˈoro"),
        ),
        ("phonemizeWord", &["loro"], Some("lˈoro")),
        ("phonemize", &["Louis XIV", "jv"], Some("loˈuɪs pat̪bˈəlas")),
        ("phonemizeWord", &["patbelas"], Some("pat̪bˈəlas")),
        (
            "phonemize",
            &["taun 2009", "jv"],
            Some("t̪ˈaʊn rˈɔŋ ˈəwu sˈɔŋɔ"),
        ),
        ("phonemizeWord", &["taun"], Some("t̪ˈaʊn")),
        ("phonemize", &["2009", "jv"], Some("rˈɔŋ ˈəwu sˈɔŋɔ")),
        ("normalizeJavanese", &["taun 2009"], Some("taun 2009")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(phonemize_word(&a(0))),
                "phonemizeWordRules" => Some(phonemize_word_rules(&a(0))),
                "normalizeJavanese" => Some(normalize_javanese(&a(0))),
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
            let got: Option<String> = call(f, &a).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts jv` reports 0 sites as well).
    #[test]
    fn javanese_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/jv.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/jv.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "jv").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
