//! Tajik (tg) phonemizer: a near-phonemic Cyrillic scan (е / э iotated initially and after a vowel, a hiatus [j]
//! before и / ӣ, iotated ё ю я) with Persian final stress, the cardinal compositor with the -у connector, and
//! text() over words, numbers and punctuation. Ported from src/languages/tajik/tajik.ts — see that file for the
//! sources.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{
    is_unreadable_tajik, normalize_tajik, normalize_tajik_initialisms, symbols, tajik_ordinal,
    try_symbols,
};
use crate::core::clauses::assemble_clauses;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `Seg`.
struct Seg {
    ph: String,
    nucleus: bool,
}

/// `toSegments(word)`: the left-to-right scan (no NFC here, as in the TS).
fn to_segments(word: &JsString) -> Vec<Seg> {
    let m = &*MANIFEST;
    let chars: Vec<String> = word
        .to_lower_case()
        .code_point_strings()
        .iter()
        .map(|c| c.to_string_lossy())
        .collect();
    let mut segs: Vec<Seg> = Vec::new();
    let mut prev_was_vowel = false;
    let seg = |ph: &str, nucleus: bool| Seg {
        ph: ph.to_string(),
        nucleus,
    };
    for (i, c) in chars.iter().enumerate() {
        let c = c.as_str();
        if let Some(v) = m.vowels.get(c) {
            // The TS's two arms (е / э initially or after a vowel; the hiatus и / ӣ) push the same glide.
            if ((c == "е" || c == "э") && (i == 0 || prev_was_vowel))
                || ((c == "и" || c == "ӣ") && prev_was_vowel)
            {
                segs.push(seg("j", false));
            }
            segs.push(seg(v, true));
            prev_was_vowel = true;
            continue;
        }
        // `c in GLIDE`: `c` is one code point, which no `Object.prototype` member is.
        if let Some(ph) = m.glides.get(c) {
            if c == "й" {
                segs.push(seg("j", false));
                prev_was_vowel = false;
            } else {
                for p in ph.chars() {
                    let p = p.to_string();
                    let nucleus = js_re!(r"[aɔuiɵe]", "u").test(&js(&p));
                    segs.push(seg(&p, nucleus));
                }
                prev_was_vowel = true;
            }
            continue;
        }
        if let Some(cons) = m.consonants.get(c) {
            if !cons.is_empty() {
                segs.push(seg(cons, false));
            }
            prev_was_vowel = false;
        }
    }
    segs
}

/// `phonemizeWord(word)`: the scan, with the stress mark before the LAST nucleus (not its onset).
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let segs = to_segments(word);
    if segs.is_empty() {
        return JsString::new();
    }
    let Some(stress) = (0..segs.len()).rev().find(|&i| segs[i].nucleus) else {
        return js(&segs.iter().map(|s| s.ph.as_str()).collect::<String>());
    };
    let mut out = String::new();
    for (i, s) in segs.iter().enumerate() {
        if i == stress {
            out.push('ˈ');
        }
        out.push_str(&s.ph);
    }
    js(&out)
}

/// `three(x)`: one group below a thousand as words; nothing for a group it cannot spell.
fn three(x: f64) -> Vec<String> {
    let n = &MANIFEST.numbers;
    let mut p = Vec::new();
    let h = (x / 100.0).floor();
    let rem = x % 100.0;
    if h > 9.0 {
        return p;
    }
    if h > 0.0 {
        p.push(if h == 1.0 {
            n.hundred.clone()
        } else {
            format!("{}{}", n.units[h as usize], n.hundred)
        });
    }
    if (10.0..20.0).contains(&rem) {
        p.push(n.teens[(rem - 10.0) as usize].clone());
    } else {
        let t = (rem / 10.0).floor();
        let u = rem % 10.0;
        if t > 0.0 {
            // `N.tens[String(t * 10)]!`: a missing key would stringify `undefined`, as JS concatenation does.
            let key = crate::core::js_string::js_number_to_string(t * 10.0);
            p.push(
                n.tens
                    .get(&key)
                    .cloned()
                    .unwrap_or_else(|| "undefined".to_string()),
            );
        }
        if u > 0.0 {
            p.push(n.units[u as usize].clone());
        }
    }
    p
}

/// `numberWords(n)`: the Tajik spelling of a non-negative number, space-separated, the -у connector glued on
/// except before a magnitude word.
pub(crate) fn number_words(n: f64) -> JsString {
    let nm = &MANIFEST.numbers;
    if !n.is_finite() || n < 0.0 {
        return JsString::new();
    }
    if n == 0.0 {
        return js(&nm.units[0]);
    }
    let parts = number_parts(n);
    if parts.is_empty() {
        return JsString::new();
    }
    let mag = [&nm.thousand, &nm.million, &nm.milliard, &nm.trillion];
    let mut out = parts[0].clone();
    for p in &parts[1..] {
        if mag.contains(&p) {
            out.push(' ');
        } else {
            out.push_str(&nm.and);
            out.push(' ');
        }
        out.push_str(p);
    }
    js(&out)
}

/// `digitWords(digits)`: past 2⁵³ the run is read digit by digit, since the double has rounded the low digits
/// away (#1581).
pub(crate) fn digit_words(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let d = digits.to_string_lossy();
    if !d.is_empty()
        && d.bytes().all(|b| b.is_ascii_digit())
        && !crate::core::js_string::is_safe_integer(n)
    {
        let units = &MANIFEST.numbers.units;
        let spelled: Vec<&str> = d
            .bytes()
            .map(|b| units[(b - b'0') as usize].as_str())
            .collect();
        return js(&spelled.join(" "));
    }
    number_words(n)
}

/// The words of `n` before the connector is applied, largest magnitude first.
fn number_parts(n: f64) -> Vec<String> {
    let nm = &MANIFEST.numbers;
    let mut parts: Vec<String> = Vec::new();
    let scales: [(f64, &str, bool); 4] = [
        (1_000_000_000_000.0, &nm.trillion, false),
        (1_000_000_000.0, &nm.milliard, false),
        (1_000_000.0, &nm.million, false),
        (1000.0, &nm.thousand, true),
    ];
    let mut left = n;
    for (value, word, drop_one) in scales {
        let q = (left / value).floor();
        if q > 0.0 {
            // The top scale's multiplier can exceed 999 from 10¹⁵ (#1581): composed in full.
            if q > 999.0 {
                parts.extend(number_parts(q));
            } else if !(drop_one && q == 1.0) {
                parts.extend(three(q));
            }
            parts.push(word.to_string());
            left %= value;
        }
    }
    if left > 0.0 {
        parts.extend(three(left));
    }
    parts
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])", "gu").unwrap());

/// The Tajik engine (`createTajik`).
pub struct TajikPhonemizer {
    _loaded: (),
}

/// The module functions, exposed through the engine: holding one proves the manifest and the tier loaded.
/// (The per-module differentials call them.)
impl TajikPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_tajik(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_tajik_initialisms(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        symbols(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_tajik(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn number_words(&self, n: f64) -> JsString {
        number_words(n)
    }

    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        tajik_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = normalize_tajik_initialisms(&normalize_tajik(input));
        assemble_clauses(&prepared, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                for w in digit_words(&n).split(&js(" ")) {
                    sink.emit(&phonemize_word(&w));
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

impl Engine for TajikPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(TajikPhonemizer::text(self, input))
    }
}

/// `createTajik()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its data.
pub fn create_tajik() -> Result<TajikPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(TajikPhonemizer { _loaded: () })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/tajik.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["забон"], Some("zabˈɔn")),
        ("phonemizeWord", &["модар"], Some("mɔdˈar")),
        ("phonemizeWord", &["рӯз"], Some("rˈɵz")),
        ("phonemizeWord", &["нӯҳ"], Some("nˈɵh")),
        ("phonemizeWord", &["ғарб"], Some("ʁˈarb")),
        ("phonemizeWord", &["қалам"], Some("qalˈam")),
        ("phonemizeWord", &["ҷавон"], Some("d͡ʒavˈɔn")),
        ("phonemizeWord", &["шаҳр"], Some("ʃˈahr")),
        ("phonemizeWord", &["хона"], Some("χɔnˈa")),
        ("phonemizeWord", &["эронӣ"], Some("jerɔnˈi")),
        ("phonemizeWord", &["Саид"], Some("sajˈid")),
        (
            "getPhonemizer(\"tg\").text",
            &["Забони тоҷикӣ эронӣ аст."],
            Some("zabɔnˈi tɔd͡ʒikˈi jerɔnˈi ˈast ."),
        ),
        ("getPhonemizer(\"tg\").text", &["21"], Some("bistˈu jˈak")),
        (
            "getPhonemizer(\"tg\").text",
            &["345"],
            Some("sesadˈu t͡ʃilˈu pˈand͡ʒ"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["1100"],
            Some("hazɔrˈu sˈad"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["1000000000"],
            Some("jˈak milliˈard"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["2500000000"],
            Some("dˈu milliardˈu pand͡ʒsˈad milliˈɔn"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["1000000000000"],
            Some("jˈak trilliˈɔn"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["999999"],
            Some("nɵhsadˈu navadˈu nˈɵh hazɔrˈu nɵhsadˈu navadˈu nˈɵh"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["Осиёи Мар\u{ad}ка\u{ad}зӣ"],
            Some("ɔsijɔjˈi markazˈi"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["Осиёи Марказӣ"],
            Some("ɔsijɔjˈi markazˈi"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["Ҷум\u{ad}ҳурии Узбекистон"],
            Some("d͡ʒumhurijˈi uzbekistˈɔn"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["70 000 нафар"],
            Some("haftˈɔd hazˈɔr nafˈar"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["2,2 млн тонна"],
            Some("dˈu dˈu milliˈɔn tɔnnˈa"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["1.01.2017"],
            Some("jˈak janvarˈi sɔlˈi dˈu hazɔrˈu habdˈah"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["с.1924"],
            Some("sɔlˈi hazɔrˈu nɵhsadˈu bistˈu t͡ʃˈɔr"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["10.02.22"],
            Some("dˈah . dˈu . bistˈu dˈu"),
        ),
        ("getPhonemizer(\"tg\").text", &["1-ум"], Some("jakˈum")),
        ("getPhonemizer(\"tg\").text", &["2-юм"], Some("dujˈum")),
        ("getPhonemizer(\"tg\").text", &["30-ум"], Some("sijˈum")),
        (
            "getPhonemizer(\"tg\").text",
            &["129-умро"],
            Some("sadˈu bistˈu nɵhumrˈɔ"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["1992—1997"],
            Some("hazɔrˈu nɵhsadˈu navadˈu dˈu tˈɔ hazɔrˈu nɵhsadˈu navadˈu hˈaft"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["135 620 км²"],
            Some("sadˈu siˈu pˈand͡ʒ hazɔrˈu ʃaʃsadˈu bˈist kilɔmetrˈi murabbˈaʔ"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["845 км³"],
            Some("haʃtsadˈu t͡ʃilˈu pˈand͡ʒ kilɔmetrˈi mukaˈab"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["Варзоб-1"],
            Some("varzˈɔb jˈak"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["деҳоти 1-Май"],
            Some("dehɔtˈi jˈak mˈaj"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["26,5 %"],
            Some("bistˈu ʃˈaʃ pˈand͡ʒ darsˈad"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["60,1%-и"],
            Some("ʃˈast jˈak darsadˈi"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["$57,84 млрд"],
            Some("pand͡ʒɔhˈu hˈaft haʃtɔdˈu t͡ʃˈɔr milliˈard dɔllˈar"),
        ),
        ("getPhonemizer(\"tg\").text", &["СММ"], Some("sˈe mˈe mˈe")),
        ("getPhonemizer(\"tg\").text", &["ТВ"], Some("tˈe vˈe")),
        ("getPhonemizer(\"tg\").text", &["ИМА"], Some("imˈa")),
        ("getPhonemizer(\"tg\").text", &["КАРБОН"], Some("karbˈɔn")),
        ("numberWords", &["21"], Some("бисту як")),
        ("numberWords", &["345"], Some("сесаду чилу панҷ")),
        ("numberWords", &["2000"], Some("ду ҳазор")),
        ("numberWords", &["1001"], Some("ҳазору як")),
        (
            "getPhonemizer(\"tg\").text",
            &["Тоҷикистон — кишварест"],
            Some("tɔd͡ʒikistˈɔn , kiʃvarˈest"),
        ),
        (
            "getPhonemizer(\"tg\").text",
            &["750—930 метр"],
            Some("haftsadˈu pand͡ʒˈɔh tˈɔ nɵhsadˈu sˈi mˈetr"),
        ),
        ("MANIFEST.numbers.and", &[], Some("у")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_tajik().unwrap();
        // The last row is the suite's one expectation on a manifest VALUE (`MANIFEST.numbers.and`), extracted from
        // the test's source text rather than recorded as a call.
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "numberWords" => Some(e.number_words(js_number(&a(0)))),
                "MANIFEST.numbers.and" => Some(js(&MANIFEST.numbers.and)),
                "getPhonemizer(\"tg\").text" => {
                    Some(crate::registry::phonemize_in("tg", &a(0)).unwrap())
                }
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let a = |i: usize| js(args[i]);
            let got: Option<String> = call(f, &a).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}

/// #1581, as test/turkic2-defects-1581.test.ts: relational, so no IPA is typed.
#[cfg(all(test, feature = "tg"))]
mod defects_1581_tests {
    use super::*;
    use crate::core::js_string::js;

    fn say(s: &str) -> String {
        crate::phonemize(s, "tg").unwrap()
    }

    #[test]
    fn numbers_from_10_15_keep_their_leading_digits() {
        assert_eq!(number_words(1e15), js("ҳазор триллион"));
        assert_eq!(say("1000000000000000"), say("ҳазор триллион"));
        assert_ne!(say("1000000000000000"), say("1000000000000"));
        let run = "9007199254740993";
        assert_eq!(digit_words(&js(run)).split(&js(" ")).len(), run.len());
        let spaced: Vec<String> = run.chars().map(String::from).collect();
        assert_eq!(say(run), say(&spaced.join(" ")));
    }
}
