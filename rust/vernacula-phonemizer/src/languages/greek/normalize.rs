//! Modern Greek text normalization: homoglyphs, alphabetic numerals, dotted abbreviations, rates, digit
//! de-grouping, inflected ordinals, the clock, degrees, signs, the shared symbol tier, the decimal comma and
//! Latin initialisms (last). Ported from src/languages/greek/normalize.ts — see that file for the corpus
//! evidence and the ordering.

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    ExponentWords, PositionDecl, SymbolData, SymbolNormalizer, alternation, make_symbol_normalizer,
    sorted_by_length_desc,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

use super::manifest::{GreekManifest, try_manifest};

type Map = HashMap<JsString, JsString>;

fn map(m: &indexmap::IndexMap<String, String>) -> Map {
    m.iter().map(|(k, v)| (js(k), js(v))).collect()
}

/// Everything normalize.ts builds from the manifest at module load, built and validated once.
pub(crate) struct NormalizeData {
    m: &'static GreekManifest,
    homoglyph: Map,
    letter_name: Map,
    word_acronym: Map,
    ord_ending: HashMap<JsString, [JsString; 2]>,
    greek_numeral: HashMap<JsString, f64>,
    dotted: Map,
    dotted_re: JsRegex,
    ordinal_re: JsRegex,
    /// `Object.entries(MIXED_CASE_INITIALISM)`, in key order, each with its pattern.
    mixed_case: Vec<(JsRegex, JsString)>,
    symbols: SymbolNormalizer,
}

pub(crate) fn normalize_data() -> Result<&'static NormalizeData, String> {
    static D: OnceLock<NormalizeData> = OnceLock::new();
    let m = try_manifest()?;
    load_once(&D, || build(m))
}

fn build(m: &'static GreekManifest) -> Result<NormalizeData, String> {
    let re = |pattern: String, flags: &str| {
        JsRegex::new(&pattern, flags).map_err(|e| format!("greek.jsonc: pattern {pattern}: {e}"))
    };
    // `DOTTED_ALT`: longest first, each `.` escaped (and nothing else, as in the TS).
    let dotted_alt = alternation(
        &sorted_by_length_desc(m.abbreviations.keys().map(|k| js(k)))
            .iter()
            .map(|k| js_re!(r"\.", "gu").replace(k, &js(r"\.")))
            .collect::<Vec<_>>(),
    );
    // `ORD_ALT`: longest first, unescaped.
    let ord_alt = alternation(&sorted_by_length_desc(
        m.ordinals.endings.keys().map(|k| js(k)),
    ));
    let mut mixed_case = Vec::new();
    for (k, v) in &m.mixed_case_initialisms {
        mixed_case.push((
            re(
                format!(r"(?<![\p{{Script=Latin}}\d]){k}(?![\p{{Script=Latin}}\d])"),
                "gu",
            )?,
            js(v),
        ));
    }
    Ok(NormalizeData {
        m,
        homoglyph: map(&m.homoglyphs),
        letter_name: map(&m.letter_names),
        word_acronym: map(&m.word_acronyms),
        ord_ending: m
            .ordinals
            .endings
            .iter()
            .map(|(k, [a, b])| (js(k), [js(a), js(b)]))
            .collect(),
        greek_numeral: m
            .alphabetic_numerals
            .iter()
            .map(|(k, v)| (js(k), *v))
            .collect(),
        dotted: map(&m.abbreviations),
        dotted_re: re(
            format!(r"(?<![\p{{L}}\p{{M}}])({dotted_alt})(\s*[,;:!?)\]»·]|\s+\p{{Ll}}|)"),
            "gu",
        )?,
        ordinal_re: re(
            format!(r"(?<![\p{{L}}\p{{M}}\d])(\d{{1,3}})({ord_alt})(?![\p{{L}}\p{{M}}])"),
            "gu",
        )?,
        mixed_case,
        symbols: build_symbols(m)?,
    })
}

/// `SYMBOLS`: the shared tier, with exactly the fields normalize.ts passes.
fn build_symbols(m: &GreekManifest) -> Result<SymbolNormalizer, String> {
    let t = &m.symbol_tier;
    make_symbol_normalizer(&SymbolData {
        percent: Some(t.percent.clone()),
        currency: Some(t.currency.clone()),
        units: Some(t.units.clone()),
        exponent_words: Some(ExponentWords {
            squared: Some(t.exponent_words.squared.clone()),
            cubed: Some(t.exponent_words.cubed.clone()),
            position: t.exponent_words.position.map(PositionDecl::All),
        }),
        magnitudes: Some(t.magnitudes.clone()),
        ampersand: Some(t.ampersand.clone()),
        multiply: Some(t.multiply.clone()),
        ..Default::default()
    })
}

/// `normalizeGreek`. Errs only if the manifest cannot be loaded.
pub fn normalize_greek(input: &JsString) -> Result<JsString, String> {
    Ok(normalize_data()?.normalize(input))
}

impl NormalizeData {
    fn minute_words(&self, m: usize) -> String {
        let c = &self.m.clock;
        if m < 10 {
            return c.minute_units[m].clone();
        }
        if m < 20 {
            return c.minute_teens[m - 10].clone();
        }
        let t = &c.minute_tens[m / 10];
        let u = m % 10;
        if u == 0 {
            t.clone()
        } else {
            format!("{t} {}", c.minute_units[u])
        }
    }

    fn inflect(&self, base: &JsString, written: &JsString) -> JsString {
        let forms = &self.ord_ending[written];
        let oxytone = base.ends_with(&js("ός"));
        base.slice(0, Some(-2))
            .concat(&forms[if oxytone { 1 } else { 0 }])
    }

    fn ordinal_parts(&self, n: f64) -> Option<Vec<JsString>> {
        if !(1.0..=100.0).contains(&n) || n.fract() != 0.0 {
            return None;
        }
        let o = &self.m.ordinals;
        let n = n as usize;
        if n == 100 {
            return Some(vec![js("εκατοστός")]);
        }
        if n <= 12 {
            return Some(vec![js(&o.units[n])]);
        }
        if n < 20 {
            return Some(vec![js("δέκατος"), js(&o.units[n - 10])]);
        }
        let t = n / 10;
        let u = n % 10;
        Some(if u == 0 {
            vec![js(&o.tens[t])]
        } else {
            vec![js(&o.tens[t]), js(&o.units[u])]
        })
    }

    fn ordinal(&self, n: f64, written: &JsString) -> Option<JsString> {
        let parts: Vec<JsString> = self
            .ordinal_parts(n)?
            .iter()
            .map(|p| self.inflect(p, written))
            .collect();
        Some(JsString::join(&parts, &js(" ")))
    }

    fn greek_numeral_value(&self, run: &JsString) -> Option<f64> {
        let mut total = 0.0;
        let mut i = 0;
        while i < run.len() {
            let two = run.slice(i as isize, Some(i as isize + 2));
            if let Some(v) = self.greek_numeral.get(&two) {
                total += v;
                i += 2;
                continue;
            }
            total += self.greek_numeral.get(&run.char_at(i))?;
            i += 1;
        }
        if total == 0.0 { None } else { Some(total) }
    }

    fn spell_latin(&self, run: &JsString) -> JsString {
        if let Some(w) = self.word_acronym.get(run) {
            return w.clone();
        }
        let mut names = Vec::new();
        for ch in run.code_point_strings() {
            match self.letter_name.get(&ch.to_lower_case()) {
                Some(n) => names.push(n.clone()),
                None => return run.clone(),
            }
        }
        JsString::join(&names, &js(" "))
    }

    pub(crate) fn normalize(&self, input: &JsString) -> JsString {
        let mut s = input.clone();

        // 0) ANO TELEIA.
        s = rewrite(&s, js_re!(r"·", "gu"), &js("\u{00b7}"));

        // 1) LATIN↔GREEK HOMOGLYPHS.
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<=\p{Script=Greek})[A-Za-z]+|[A-Za-z]+(?=\p{Script=Greek})",
                "gu"
            ),
            |m, s| {
                let mut out = JsString::new();
                for c in m.value(s).code_point_strings() {
                    out.push_str(self.homoglyph.get(&c).unwrap_or(&c));
                }
                out
            },
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\d'’-])o(?![\p{L}\p{M}\d'’-])", "gu"),
            &js("ο"),
        );
        s = rewrite_with(
            &s,
            js_re!(r"(^|[.!;·…»]\s+)([HO])(?=\s+\p{Script=Greek})", "gu"),
            |m, s| {
                let lead = m.group(1, s).unwrap_or_default();
                let ch = m.group(2, s).unwrap_or_default();
                lead.concat(&self.homoglyph[&ch])
            },
        );

        // 2) GREEK ALPHABETIC NUMERALS (the sign is U+0384, U+0374 or U+02B9).
        s = rewrite_with(
            &s,
            js_re!(
                "(?<![\\p{L}\\p{M}])([Α-ΩϚ]{1,4})[\u{0384}\u{0374}\u{02B9}](?![\\p{L}\\p{M}])",
                "gu"
            ),
            |m, s| {
                let whole = m.value(s);
                let run = m.group(1, s).unwrap_or_default();
                match self.greek_numeral_value(&run) {
                    None => whole,
                    Some(v) => self.ordinal(v, &js("ο")).unwrap_or(whole),
                }
            },
        );

        // 3) DOTTED ABBREVIATIONS (case-sensitive), the final dot kept only before a non-lowercase word.
        s = rewrite_with(&s, &self.dotted_re, |m, s| {
            let ab = m.group(1, s).unwrap_or_default();
            let after = m.group(2, s).unwrap_or_default();
            self.dotted[&ab].concat(&if after.is_empty() { js(".") } else { after })
        });

        // 4) βλ.
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])βλ\.(?=\s+\p{Ll})", "gu"),
            &js("βλέπε"),
        );

        // 5) RATES, kept local (an agreeing article, not an invariant "per").
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?(?:km|χλμ)\s?\/\s?(?:h|ώρα)(?![\p{L}\p{M}])", "giu"),
            &js("$1 χιλιόμετρα την ώρα"),
        );
        s = rewrite(
            &s,
            js_re!(
                r"(\d)\s?(?:mi|μίλια)\s?\/\s?(?:h|ώρα)(?![\p{L}\p{M}])",
                "giu"
            ),
            &js("$1 μίλια την ώρα"),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?mph(?![\p{L}\p{M}])", "giu"),
            &js("$1 μίλια την ώρα"),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?m\s?\/\s?s(?![\p{L}\p{M}])", "gu"),
            &js("$1 μέτρα το δευτερόλεπτο"),
        );

        // 6) χλμ.
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])χλμ\.(?=\s+\p{Ll})", "gu"),
            &js("χιλιόμετρα"),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])χλμ(?![\p{L}\p{M}.])", "gu"),
            &js("χιλιόμετρα"),
        );

        // 7) DIGIT DE-GROUPING, twice (for `5.000.000`).
        for _ in 0..2 {
            s = rewrite(
                &s,
                js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
                &JsString::new(),
            );
        }

        // 8) ORDINAL NOTATION: the written ending is the case, and every part of a compound inflects.
        s = rewrite_with(&s, &self.ordinal_re, |m, s| {
            let whole = m.value(s);
            let digits = m.group(1, s).unwrap_or_default();
            let written = m.group(2, s).unwrap_or_default();
            self.ordinal(js_number(&digits), &written).unwrap_or(whole)
        });

        // 9) CLOCK: feminine hours, neuter minutes; a sports time is guarded off.
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?![.,]\d)",
                "gu"
            ),
            |m, s| {
                let hv = js_number(&m.group(1, s).unwrap_or_default()) as usize;
                let mv = js_number(&m.group(2, s).unwrap_or_default()) as usize;
                let hour = &self.m.clock.hours_feminine[hv];
                js(&if mv == 0 {
                    hour.clone()
                } else {
                    format!("{hour} και {}", self.minute_words(mv))
                })
            },
        );

        // 10) DEGREES.
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
            &js("$1 βαθμοί Κελσίου"),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
            &js("$1 βαθμοί Φαρενάιτ"),
        );
        s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 βαθμοί"));

        // 11) SIGNS and VULGAR FRACTIONS.
        s = rewrite(&s, js_re!(r"±", "gu"), &js(" συν μείον "));
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\d])\+\s?(?=\d)", "gu"),
            &js("συν "),
        );
        s = rewrite(&s, js_re!(r"(\d)\s?½", "gu"), &js("$1 και μισή"));
        s = rewrite(&s, js_re!(r"(\d)\s?¼", "gu"), &js("$1 και ένα τέταρτο"));
        s = rewrite(&s, js_re!(r"(\d)\s?¾", "gu"), &js("$1 και τρία τέταρτα"));

        // 11b) RELATIONAL AND DIVISION SIGNS.
        s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" ίσον "));
        s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" μικρότερο από "));
        s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" μεγαλύτερο από "));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" διά "));

        // 11c) THE PARENTHETICAL DASH → a pause (whitespace is the discriminator).
        s = rewrite(
            &s,
            js_re!(r"(?<=\S)(?:\s+[–—]\s*|[–—]\s+)", "gu"),
            &js(", "),
        );

        // 11d) THE MINUS → μείον, not after a letter/digit and not as a range.
        s = rewrite(
            &s,
            js_re!(
                r"(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−](?=\p{Nd})",
                "gu"
            ),
            &js("μείον "),
        );

        // 12) SHARED SYMBOL TIER: after the rate and degree rules, before the decimal comma.
        s = self.symbols.apply(&s);

        // 13) DECIMAL COMMA.
        s = rewrite(&s, js_re!(r"(\d),(?=\d)", "gu"), &js("$1 κόμμα "));

        // 14) LATIN INITIALISMS → Greek letter names, last of all.
        for (re, v) in &self.mixed_case {
            s = rewrite(&s, re, v);
        }
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\p{Script=Latin}\d'’])[A-Z]{2,}(?![\p{Script=Latin}\d'’])",
                "gu"
            ),
            |m, s| self.spell_latin(&m.value(s)),
        );
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\p{Script=Latin}\d'’&])[A-Za-z](?![\p{Script=Latin}\d'’&])",
                "gu"
            ),
            |m, s| self.spell_latin(&m.value(s)),
        );

        s
    }
}
