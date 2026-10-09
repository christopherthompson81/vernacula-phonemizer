//! Symbol and unit normalization shared across languages. Ported from src/core/normalizeSymbols.ts — see
//! that file for the evidence.
//!
//! `own()` lookups are `IndexMap::get`, which has no prototype to fall through to.

use indexmap::IndexMap;

use super::js_string::JsString;

/// `foldedIndex`: the lowercase key → value index; the FIRST key to fold onto a slot keeps it, and a slot whose
/// declared keys DISAGREE is left out (µm/µM, µs/µS, mΩ/MΩ): only an undeclared case variant reaches the fold,
/// and it has no case to decide by.
pub fn folded_index<V: Clone + PartialEq>(map: &IndexMap<JsString, V>) -> IndexMap<JsString, V> {
    let mut out: IndexMap<JsString, V> = IndexMap::new();
    let mut ambiguous = Vec::new();
    for (k, v) in map {
        let lk = k.to_lower_case();
        match out.get(&lk) {
            None => {
                out.insert(lk, v.clone());
            }
            Some(have) if have != v => ambiguous.push(lk),
            Some(_) => {}
        }
    }
    for lk in ambiguous {
        out.shift_remove(&lk);
    }
    out
}

/// The declared table with the EXACT written form first. Then the case-folded index, but only for a
/// multi-character symbol unless `fold_single`: one letter's case is the whole difference (m against M).
pub fn resolve_unit_symbol<'a, V>(
    declared: Option<&'a IndexMap<JsString, V>>,
    folded: &'a IndexMap<JsString, V>,
    written: &JsString,
    fold_single: bool,
) -> Option<&'a V> {
    if let Some(v) = declared.and_then(|d| d.get(written)) {
        return Some(v);
    }
    if written.len() > 1 || fold_single {
        folded.get(&written.to_lower_case())
    } else {
        None
    }
}

// ── makeSymbolNormalizer and its helpers ─────────────────────────────────────────────────────────────

use std::sync::{Arc, OnceLock};

use serde::Deserialize;

use super::js_regex::{JsMatch, JsRegex};
use super::js_string::{js, js_number};
use super::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// Word forms for one countable noun; index 0 = singular, further indices per the language's `countForm`.
pub type CountForms = Vec<String>;

/// `countForm(n)`: a JS number in, an index out (a JS number, so a NaN or fractional index is representable).
pub type CountForm = Arc<dyn Fn(f64) -> f64 + Send + Sync>;

/// Insertion order is the TS object's: it builds the character class.
const SUPERSCRIPT: [(&str, &str); 11] = [
    ("⁻", "-"),
    ("⁰", "0"),
    ("¹", "1"),
    ("²", "2"),
    ("³", "3"),
    ("⁴", "4"),
    ("⁵", "5"),
    ("⁶", "6"),
    ("⁷", "7"),
    ("⁸", "8"),
    ("⁹", "9"),
];
const SUPERSCRIPT_RUN: &str = "[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+";

fn bare_exponent_glued() -> &'static JsRegex {
    static RE: OnceLock<JsRegex> = OnceLock::new();
    RE.get_or_init(|| {
        JsRegex::new(
            &format!(
                r"(?:\p{{Nd}}[\p{{Nd}}.,]*|(?<![\p{{L}}\p{{M}}])[\p{{L}}\p{{M}}]{{1,3}})(?:{SUPERSCRIPT_RUN})(?=[\p{{L}}\p{{M}}])"
            ),
            "gu",
        )
        .unwrap()
    })
}

fn bare_exponent() -> &'static JsRegex {
    static RE: OnceLock<JsRegex> = OnceLock::new();
    RE.get_or_init(|| {
        JsRegex::new(
            &format!(r"(\p{{Nd}}[\p{{Nd}}.,]*|(?<![\p{{L}}\p{{M}}])[\p{{L}}\p{{M}}]{{1,3}})\s?({SUPERSCRIPT_RUN})"),
            "gu",
        )
        .unwrap()
    })
}

fn unit_power_before() -> &'static JsRegex {
    js_re!(
        r"\p{Nd}[\p{Nd}.,]*[    ]?[²³](?=[    ]?([\p{L}\p{M}]{1,4})(?![\p{L}\p{M}]))",
        "gu"
    )
}

/// Where a language puts the squared/cubed measure word relative to the unit noun.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExponentPosition {
    Before,
    After,
    Compound,
    Suffix,
}

/// `position`: one value for both powers, or a per-power record.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum PositionDecl {
    All(ExponentPosition),
    Per(PerPower),
}

/// The per-power `position` record. ⚠ `deny_unknown_fields`: both fields are optional, so under `untagged`
/// a misspelt key would otherwise load as an empty record and silently fall back to the default position.
/// (serde takes the attribute on a struct, not on an enum variant, hence the named struct.)
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PerPower {
    pub squared: Option<ExponentPosition>,
    pub cubed: Option<ExponentPosition>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ExponentWords {
    pub squared: Option<CountForms>,
    pub cubed: Option<CountForms>,
    pub position: Option<PositionDecl>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct BareExponent {
    pub squared: Option<String>,
    pub cubed: Option<String>,
    pub power: Option<String>,
    pub negative: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Multiply {
    pub times: String,
    pub by: Option<String>,
}

/// `unitPer`: one word for every denominator, or a record keyed by the denominator.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum UnitPer {
    All(String),
    ByDenominator(IndexMap<String, String>),
}

/// `SymbolData` (normalizeSymbols.ts), every field optional as there. ⚠ The maps carry the TS OBJECT's key
/// order: insertion order, except that integer-like keys come first, ascending. A caller building one from a
/// manifest with such a key must order it that way.
#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolData {
    pub percent: Option<CountForms>,
    pub currency: Option<IndexMap<String, CountForms>>,
    pub units: Option<IndexMap<String, CountForms>>,
    pub magnitudes: Option<Vec<String>>,
    pub magnitude_precedes: Option<bool>,
    pub magnitude_count: Option<f64>,
    pub magnitude_connective: Option<String>,
    #[serde(skip)]
    pub count_form: Option<CountForm>,
    pub percent_prefix: Option<bool>,
    pub currency_prefix: Option<bool>,
    pub unit_prefix: Option<bool>,
    pub unit_per: Option<UnitPer>,
    pub rate_denominators: Option<IndexMap<String, String>>,
    pub exponent_words: Option<ExponentWords>,
    pub bare_exponent: Option<BareExponent>,
    pub multiply: Option<Multiply>,
    pub ampersand: Option<String>,
    pub unspaced_script: Option<bool>,
}

/// The tier's default `countForm`: n === 1 → 0, else 1.
pub fn default_count_form(n: f64) -> f64 {
    if n == 1.0 { 0.0 } else { 1.0 }
}

/// `slavicCountForm`: 1→0, 2–4→1, else 2, on the final digits; 11–14 → 2. NaN falls through to 2, as in JS.
pub fn slavic_count_form(n: f64) -> f64 {
    let mod100 = n.abs() % 100.0;
    let mod10 = mod100 % 10.0;
    if (11.0..=14.0).contains(&mod100) {
        return 2.0;
    }
    if mod10 == 1.0 {
        return 0.0;
    }
    if (2.0..=4.0).contains(&mod10) {
        return 1.0;
    }
    2.0
}

const MANY: f64 = 5.0;

fn cat(parts: &[&JsString]) -> JsString {
    let mut out = JsString::new();
    for p in parts {
        out.push_str(p);
    }
    out
}

/// `forms[Math.max(0, Math.min(countForm(n), forms.length - 1))]`. ⚠ A NaN or fractional index reads
/// `undefined` in the TS, which the template then writes as a word; reproduced.
fn pick(forms: &[JsString], n: f64, cf: &CountForm) -> JsString {
    let c = cf(n);
    let hi = forms.len() as f64 - 1.0;
    // Math.min / Math.max propagate NaN; f64::min/max do not.
    let i = if c.is_nan() {
        f64::NAN
    } else {
        c.min(hi).max(0.0)
    };
    if i.is_finite() && i.fract() == 0.0 && (i as usize) < forms.len() {
        forms[i as usize].clone()
    } else {
        js("undefined")
    }
}

fn with_magnitude(
    forms: &[JsString],
    mag: Option<&JsString>,
    n: f64,
    cf: &CountForm,
    magnitude_count: f64,
) -> JsString {
    pick(
        forms,
        if mag.is_some_and(|m| !m.is_empty()) {
            magnitude_count
        } else {
            n
        },
        cf,
    )
}

fn assert_forms(field: &str, forms: &CountForms) -> Result<(), String> {
    if forms.is_empty() || forms.iter().any(|w| w.is_empty()) {
        return Err(format!(
            "SymbolData.{field}: declared, but not a non-empty list of non-empty words (got {forms:?}). Omit the field \
             entirely if this language has no word to say; do not declare an empty one."
        ));
    }
    Ok(())
}

/// `numValue`: the leading integer of a grouped/decimal numeral; a real fraction adds 0.5 (never "one").
fn num_value(num: &JsString) -> f64 {
    let cleaned = js_re!(r"[    ]", "gu").replace(num, &JsString::new());
    let Some(m) = js_re!(r"^(\d+(?:[.,]\d{3})*)(?:[.,](\d+))?$").exec(&cleaned) else {
        return f64::NAN;
    };
    let int =
        js_number(&js_re!("[.,]", "g").replace(&m.group(1, &cleaned).unwrap(), &JsString::new()));
    match m.group(2, &cleaned) {
        Some(f) if f.len() != 3 => int + 0.5,
        _ => int,
    }
}

/// `NUM`. ⚠ The separators are the CHARACTERS (the TS string literal decodes ` `), not regex escapes.
const NUM: &str = "\\d+(?:[ \u{a0}\u{202f}\u{2009}]\\d{3}(?!\\d)|[.,]\\d+)*";

/// `isBareUnitKey`: more than one character, ASCII letters only, and no vowel.
pub fn is_bare_unit_key(key: &JsString) -> bool {
    key.len() > 1 && js_re!("^[A-Za-z]+$", "u").test(key) && !js_re!("[aeiouy]", "iu").test(key)
}

/// `[.*+?^${}()|[\]\\]` → `\$&` (escapeKey's class adds `$`, which this one already holds).
pub fn esc(t: &JsString) -> JsString {
    js_re!(r"[.*+?^${}()|[\]\\]", "gu").replace(t, &js("\\$&"))
}

/// `.sort((a, b) => b.length - a.length)`: stable, as Array.prototype.sort; lengths in code units.
pub fn sorted_by_length_desc(keys: impl IntoIterator<Item = JsString>) -> Vec<JsString> {
    let mut v: Vec<JsString> = keys.into_iter().collect();
    v.sort_by(|a, b| b.len().cmp(&a.len()));
    v
}

pub fn alternation(keys: &[JsString]) -> String {
    JsString::join(keys, &js("|")).to_string_lossy()
}

/// `makeBareUnitNormalizer`: a standalone vowel-less unit symbol → its word, as a text→text pass.
pub fn make_bare_unit_normalizer(
    readings: Vec<(JsString, JsString)>,
) -> impl Fn(&JsString) -> JsString + Send + Sync + use<> {
    let mut map: IndexMap<JsString, JsString> = IndexMap::new();
    for (k, v) in readings {
        if is_bare_unit_key(&k) {
            map.insert(k, v);
        }
    }
    let re = (!map.is_empty()).then(|| {
        let keys = sorted_by_length_desc(map.keys().cloned());
        JsRegex::new(
            &format!(
                "(?<![\\p{{L}}\\p{{M}}\\p{{Nd}}'’ʼ/-])(?<!\\p{{Nd}}\\s)({})(?![\\p{{L}}\\p{{M}}\\p{{Nd}}'’ʼ/²³-])(?!\\.\\p{{L}})(?!\\s?[23](?![\\d\\p{{L}}]))",
                alternation(&keys)
            ),
            "gu",
        )
        .unwrap()
    });
    move |text: &JsString| match &re {
        None => text.clone(),
        Some(re) => rewrite_with(text, re, |m, s| map[&m.group(1, s).unwrap()].clone()),
    }
}

/// `spacedDigits`: the digit reading of a bare power, or `None` where no honest one exists.
fn spaced_digits(
    base: &JsString,
    digits: &JsString,
    all: &JsString,
    end: usize,
) -> Option<JsString> {
    if !js_re!(r"^\p{Nd}", "u").test(base) {
        return None;
    }
    if digits.starts_with(&js("-")) {
        return None;
    }
    let tail = if js_re!(r"^[\p{L}\p{M}]", "u").test(&all.slice(end as isize, None)) {
        js(" ")
    } else {
        JsString::new()
    };
    Some(cat(&[base, &js(" "), digits, &tail]))
}

fn superscript_digits(sup: &JsString) -> JsString {
    let mut out = JsString::new();
    for cp in sup.code_points() {
        let c = char::from_u32(cp).map(String::from).unwrap_or_default();
        let (_, d) = SUPERSCRIPT
            .iter()
            .find(|(k, _)| *k == c)
            .expect("SUPERSCRIPT_RUN matched it");
        out.push_str(&js(d));
    }
    out
}

/// The three declines both bare-exponent arms share (`LONE_MARK`, `ONLY_ONES` after `PRIME_CHAIN`, and a
/// spaced `NUCLIDE_FOLLOWS`). `true` leaves the match as written.
fn declines_bare_exponent(m: &JsMatch, all: &JsString) -> bool {
    let whole = m.value(all);
    let sup = m.group(2, all).unwrap();
    let at = m.index();
    if js_re!("^[⁰¹]$", "u").test(&sup) {
        return true;
    }
    if js_re!("^¹+$", "u").test(&sup)
        && js_re!(r"\p{Nd}+⁰\p{Nd}+¹$", "u")
            .test(&all.slice(at.saturating_sub(24) as isize, Some(at as isize)))
    {
        return true;
    }
    js_re!(r"\s", "u").test(&whole)
        && js_re!(r"^[\p{L}\p{M}]", "u").test(&all.slice(m.end() as isize, None))
}

/// `spacedBareExponent`: a bare digit-base power → its digits, spaced off.
pub fn spaced_bare_exponent(s: &JsString) -> JsString {
    rewrite_with(s, bare_exponent(), |m, all| {
        let whole = m.value(all);
        if declines_bare_exponent(m, all) {
            return whole;
        }
        let base = m.group(1, all).unwrap();
        let digits = superscript_digits(&m.group(2, all).unwrap());
        spaced_digits(&base, &digits, all, m.end()).unwrap_or(whole)
    })
}

fn forms_js(f: &CountForms) -> Vec<JsString> {
    f.iter().map(|w| js(w)).collect()
}

fn map_js<V, W>(m: &IndexMap<String, V>, f: impl Fn(&V) -> W) -> IndexMap<JsString, W> {
    m.iter().map(|(k, v)| (js(k), f(v))).collect()
}

type ExponentForms = (
    Option<Vec<JsString>>,
    Option<Vec<JsString>>,
    Option<PositionDecl>,
);

/// A built symbol normalizer, `makeSymbolNormalizer(d)`; `apply` is the returned closure.
pub struct SymbolNormalizer {
    ampersand: Option<JsString>,
    percent: Option<Vec<JsString>>,
    currency: Option<IndexMap<JsString, Vec<JsString>>>,
    units: Option<IndexMap<JsString, Vec<JsString>>>,
    units_folded: IndexMap<JsString, Vec<JsString>>,
    rate_denominators: Option<IndexMap<JsString, JsString>>,
    denom_folded: IndexMap<JsString, JsString>,
    unit_per: Option<UnitPer>,
    exponent_words: Option<ExponentForms>,
    bare_exponent: Option<BareExponent>,
    multiply: Option<(JsString, JsString)>,
    connective: Option<JsString>,
    magnitude_count: Option<f64>,
    percent_prefix: bool,
    currency_prefix: bool,
    unit_prefix: bool,
    cf: CountForm,
    cur_before: Option<JsRegex>,
    cur_after: Option<JsRegex>,
    mag_first_after: Option<JsRegex>,
    mag_first_before: Option<JsRegex>,
    unit_re: Option<JsRegex>,
    pct_re: Option<JsRegex>,
    pct_pre_re: Option<JsRegex>,
    pct_after: Option<JsRegex>,
    pct_before: Option<JsRegex>,
    /// `saidAfter(forms)` per currency key, compiled once.
    cur_said: IndexMap<JsString, JsRegex>,
    bare_unit: Box<dyn Fn(&JsString) -> JsString + Send + Sync>,
}

/// `saidAfter`: the text already says the noun (optionally after the magnitude connective).
fn said_after(forms: &[JsString], connective: Option<&JsString>) -> JsRegex {
    let conn = match connective {
        None => String::new(),
        Some(c) => format!(
            "(?:{}[ \u{a0}\u{202f}\u{2009}]+)?",
            esc(c).to_string_lossy()
        ),
    };
    let alt = alternation(&forms.iter().map(esc).collect::<Vec<_>>());
    JsRegex::new(&format!("^[ \u{a0}\u{202f}\u{2009}]*{conn}(?:{alt})"), "iu").unwrap()
}

/// `saidBefore`: the text already says the noun before the number.
fn said_before(forms: &[JsString]) -> JsRegex {
    let alt = alternation(&forms.iter().map(esc).collect::<Vec<_>>());
    JsRegex::new(&format!("(?:{alt})[ \u{a0}\u{202f}\u{2009}]*$"), "iu").unwrap()
}

fn position_for(decl: Option<&PositionDecl>, power: &str) -> ExponentPosition {
    match decl {
        Some(PositionDecl::All(p)) => Some(*p),
        Some(PositionDecl::Per(PerPower { squared, cubed })) => {
            if power == "cubed" {
                *cubed
            } else {
                *squared
            }
        }
        None => None,
    }
    .unwrap_or(ExponentPosition::After)
}

fn place(pos: ExponentPosition, word: &JsString, noun: &JsString) -> JsString {
    match pos {
        ExponentPosition::Compound => cat(&[word, noun]),
        ExponentPosition::Suffix => cat(&[noun, word]),
        ExponentPosition::Before => cat(&[word, &js(" "), noun]),
        ExponentPosition::After => cat(&[noun, &js(" "), word]),
    }
}

/// `makeSymbolNormalizer(d)`. Errs where the TS throws at construction: a declared but empty form list.
pub fn make_symbol_normalizer(d: &SymbolData) -> Result<SymbolNormalizer, String> {
    if let Some(p) = &d.percent {
        assert_forms("percent", p)?;
    }
    for (k, forms) in d.currency.iter().flatten() {
        assert_forms(&format!("currency[{k}]"), forms)?;
    }
    for (k, forms) in d.units.iter().flatten() {
        assert_forms(&format!("units[{k}]"), forms)?;
    }
    if let Some(ew) = &d.exponent_words {
        if let Some(f) = &ew.squared {
            assert_forms("exponentWords.squared", f)?;
        }
        if let Some(f) = &ew.cubed {
            assert_forms("exponentWords.cubed", f)?;
        }
    }
    let cf: CountForm = d
        .count_form
        .clone()
        .unwrap_or_else(|| Arc::new(default_count_form));
    let units = d.units.as_ref().map(|u| map_js(u, forms_js));
    let rate_denominators = d.rate_denominators.as_ref().map(|r| map_js(r, |v| js(v)));
    let units_folded = units.as_ref().map(folded_index).unwrap_or_default();
    let denom_folded = rate_denominators
        .as_ref()
        .map(folded_index)
        .unwrap_or_default();
    let unspaced = d.unspaced_script == Some(true);
    let opt_sep = if unspaced {
        "[\\s\u{200b}\u{200c}]?"
    } else {
        "\\s?"
    };
    let mag_list: Vec<JsString> = d.magnitudes.iter().flatten().map(|m| js(m)).collect();
    let mag_prefix_hazard = mag_list
        .iter()
        .any(|a| mag_list.iter().any(|b| b != a && b.starts_with(a)));
    let mag_end = if mag_prefix_hazard {
        "(?![\\p{L}\\p{M}])"
    } else {
        ""
    };
    let mag_sorted = alternation(&sorted_by_length_desc(mag_list.iter().cloned()));
    let mag_alt = if !mag_list.is_empty() {
        format!("(\\s*(?:{mag_sorted}){mag_end})?")
    } else {
        "()?".to_string()
    };
    let connective = d.magnitude_connective.as_ref().map(|c| js(c));
    let mag_alt_u = match (&connective, mag_list.is_empty()) {
        (Some(c), false) => format!(
            "(\\s*(?:{mag_sorted}){mag_end}(?:\\s+{})?)?",
            js_re!(r"[.*+?^${}()|[\]\\]", "gu")
                .replace(c, &js("\\$&"))
                .to_string_lossy()
        ),
        _ => mag_alt.clone(),
    };
    let cur_key = |k: &JsString| -> String {
        match js_re!(r"^(\p{L}{2,})(\P{L}+)$", "u").exec(k) {
            Some(seam) => format!(
                "{}{opt_sep}{}",
                esc(&seam.group(1, k).unwrap()).to_string_lossy(),
                esc(&seam.group(2, k).unwrap()).to_string_lossy()
            ),
            None => esc(k).to_string_lossy(),
        }
    };
    let currency = d.currency.as_ref().map(|c| map_js(c, forms_js));
    let cur_keys: String = currency
        .as_ref()
        .map(|c| {
            sorted_by_length_desc(c.keys().cloned())
                .iter()
                .map(cur_key)
                .collect::<Vec<_>>()
                .join("|")
        })
        .unwrap_or_default();
    let word_cont = if unspaced { "\\p{sc=Latn}" } else { "\\p{L}" };
    let mark_cont = if unspaced { "" } else { "\\p{M}" };
    let cur = format!("(?<![{word_cont}{mark_cont}])(?:{cur_keys})(?![{word_cont}{mark_cont}])");
    let has_cur = currency.is_some();
    let re = |p: String, f: &str| JsRegex::new(&p, f).map_err(|e| e.to_string());
    let cur_before = if has_cur {
        Some(re(format!("({cur}){opt_sep}({NUM}){mag_alt}"), "gu")?)
    } else {
        None
    };
    let cur_after = if has_cur {
        Some(re(format!("({NUM}){mag_alt}{opt_sep}({cur})"), "gu")?)
    } else {
        None
    };
    let mag_word = if !mag_list.is_empty() {
        format!("(?<![{word_cont}{mark_cont}])(?:{mag_sorted}){mag_end}")
    } else {
        String::new()
    };
    let mag_first = has_cur && d.magnitude_precedes == Some(true) && !mag_word.is_empty();
    let mag_first_after = if mag_first {
        Some(re(
            format!("({mag_word})\\s+({NUM}){opt_sep}({cur})"),
            "gu",
        )?)
    } else {
        None
    };
    let mag_first_before = if mag_first {
        Some(re(
            format!("({mag_word}){opt_sep}({cur}){opt_sep}({NUM})"),
            "gu",
        )?)
    } else {
        None
    };
    let unit_alt = units
        .as_ref()
        .map(|u| alternation(&sorted_by_length_desc(u.keys().cloned())))
        .unwrap_or_default();
    let denom_keys = alternation(&sorted_by_length_desc(
        units
            .iter()
            .flat_map(|u| u.keys().cloned())
            .chain(rate_denominators.iter().flat_map(|r| r.keys().cloned())),
    ));
    let not_version = "(?<![\\d.,])(?!(?:802[.,]11)[a-zA-Z](?![a-zA-Z\\d]))";
    let unit_re = if units.is_some() {
        Some(re(
            format!(
                "{not_version}({NUM}){mag_alt_u}\\s?({unit_alt})(?:\\s?(\u{b2}|\u{b3}|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}]))?\\s?/\\s?({denom_keys})(\u{b2}|\u{b3}|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}]))?|\\s?(\u{b2}|\u{b3}|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}])))?(?:\\s?/\\s?[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{{1,3}}(?:²|³|[23])?(?![\\p{{L}}\\p{{M}}\\p{{Nd}}]))?(?![{word_cont}\\p{{M}}'\u{2019}\u{2bc}\u{b2}\u{b3}])"
            ),
            "giu",
        )?)
    } else {
        None
    };
    let bare_readings: Vec<(JsString, JsString)> = if unspaced {
        Vec::new()
    } else {
        units
            .iter()
            .flatten()
            .map(|(k, forms)| (k.clone(), pick(forms, 1.0, &cf)))
            .collect()
    };
    let bare_unit = Box::new(make_bare_unit_normalizer(bare_readings));
    let pct = "[%\u{66a}\u{ff05}]";
    let percent = d.percent.as_ref().map(forms_js);
    let pct_re = if percent.is_some() {
        Some(re(format!("({NUM}){opt_sep}{pct}"), "gu")?)
    } else {
        None
    };
    let pct_pre_re = if percent.is_some() {
        Some(re(format!("(?<!\\d){pct}\\s?({NUM})"), "gu")?)
    } else {
        None
    };
    let pct_after = percent.as_ref().map(|p| said_after(p, connective.as_ref()));
    let pct_before = percent.as_ref().map(|p| said_before(p));
    let cur_said = currency
        .iter()
        .flatten()
        .map(|(k, forms)| (k.clone(), said_after(forms, connective.as_ref())))
        .collect();
    Ok(SymbolNormalizer {
        ampersand: d.ampersand.as_ref().map(|a| js(a)),
        percent,
        currency,
        units,
        units_folded,
        rate_denominators,
        denom_folded,
        unit_per: d.unit_per.clone(),
        exponent_words: d.exponent_words.as_ref().map(|e| {
            (
                e.squared.as_ref().map(forms_js),
                e.cubed.as_ref().map(forms_js),
                e.position.clone(),
            )
        }),
        bare_exponent: d.bare_exponent.clone(),
        multiply: d
            .multiply
            .as_ref()
            .map(|m| (js(&m.times), js(m.by.as_ref().unwrap_or(&m.times)))),
        connective,
        magnitude_count: d.magnitude_count,
        percent_prefix: d.percent_prefix == Some(true),
        currency_prefix: d.currency_prefix == Some(true),
        unit_prefix: d.unit_prefix == Some(true),
        cf,
        cur_before,
        cur_after,
        mag_first_after,
        mag_first_before,
        unit_re,
        pct_re,
        pct_pre_re,
        pct_after,
        pct_before,
        cur_said,
        bare_unit,
    })
}

impl SymbolNormalizer {
    /// The tier, applied to the pipeline string.
    pub fn apply(&self, text: &JsString) -> JsString {
        let d = self;
        let sp = js(" ");
        let empty = JsString::new();
        let mut text = text.clone();
        if let Some(a) = &d.ampersand {
            let t = rewrite(&text, js_re!("&amp;", "giu"), &js("&"));
            text = rewrite(&t, js_re!(r"[ \t]*[&＆][ \t]*", "gu"), &cat(&[&sp, a, &sp]));
        }
        let mut s = text;
        let is_unit_key = |k: &JsString| -> bool {
            let lk = k.to_lower_case();
            d.units.as_ref().is_some_and(|u| u.contains_key(k))
                || d.units_folded.contains_key(&lk)
                || d.rate_denominators
                    .as_ref()
                    .is_some_and(|r| r.contains_key(k))
                || d.denom_folded.contains_key(&lk)
        };
        s = rewrite_with(&s, unit_power_before(), |m, all| {
            let whole = m.value(all);
            if is_unit_key(&m.group(1, all).unwrap()) {
                js_re!(r"[    ]?[²³]", "u").replace(&whole, &JsString::new())
            } else {
                whole
            }
        });

        let join = |mag: Option<&JsString>| -> JsString {
            match (&d.connective, mag) {
                (Some(c), Some(m)) if !m.is_empty() => cat(&[c, &sp]),
                _ => JsString::new(),
            }
        };
        let money = |num: &JsString,
                     mag: Option<&JsString>,
                     sym: &JsString,
                     rest: &JsString,
                     mag_first: bool| {
            let cur = d.currency.as_ref().unwrap();
            // ⚠ `d.currency![sym] ?? d.currency![stripped]!` throws in the TS on a double miss. Unreachable: the
            // pattern is the table's own keys, at most with a separator inserted at the seam.
            let key = if cur.contains_key(sym) {
                sym.clone()
            } else {
                js_re!(r"[\s​‌]+", "gu").replace(sym, &JsString::new())
            };
            let forms = &cur[&key];
            let already = &d.cur_said[&key];
            let body = if mag_first {
                cat(&[&mag.unwrap_or(&empty).trim(), &sp, num])
            } else {
                cat(&[num, mag.unwrap_or(&empty)])
            };
            if already.test(rest) {
                return body;
            }
            let w = with_magnitude(
                forms,
                mag,
                num_value(num),
                &d.cf,
                d.magnitude_count.unwrap_or(MANY),
            );
            let tail = if js_re!(r"^[\p{L}\p{M}]", "u").test(rest) {
                sp.clone()
            } else {
                JsString::new()
            };
            if d.currency_prefix {
                js_re!(r"\s+", "gu").replace(
                    &cat(&[&w, mag.unwrap_or(&empty), &sp, &join(mag), num, &tail]),
                    &sp,
                )
            } else {
                cat(&[&body, &sp, &join(mag), &w, &tail])
            }
        };
        let rest_of = |m: &JsMatch, full: &JsString| full.slice(m.end() as isize, None);
        let g = |m: &JsMatch, i: usize, full: &JsString| m.group(i, full).unwrap();
        if let Some(re) = &d.mag_first_after {
            s = rewrite_with(&s, re, |m, full| {
                let mag = cat(&[&sp, &g(m, 1, full)]);
                money(
                    &g(m, 2, full),
                    Some(&mag),
                    &g(m, 3, full),
                    &rest_of(m, full),
                    true,
                )
            });
        }
        if let Some(re) = &d.mag_first_before {
            s = rewrite_with(&s, re, |m, full| {
                let mag = cat(&[&sp, &g(m, 1, full)]);
                money(
                    &g(m, 3, full),
                    Some(&mag),
                    &g(m, 2, full),
                    &rest_of(m, full),
                    true,
                )
            });
        }
        if let Some(re) = &d.cur_before {
            s = rewrite_with(&s, re, |m, full| {
                money(
                    &g(m, 2, full),
                    m.group(3, full).as_ref(),
                    &g(m, 1, full),
                    &rest_of(m, full),
                    false,
                )
            });
        }
        if let Some(re) = &d.cur_after {
            s = rewrite_with(&s, re, |m, full| {
                money(
                    &g(m, 1, full),
                    m.group(2, full).as_ref(),
                    &g(m, 3, full),
                    &rest_of(m, full),
                    false,
                )
            });
        }
        if let (Some(forms), Some(pct_re), Some(pct_pre_re), Some(after_re), Some(before_re)) = (
            &d.percent,
            &d.pct_re,
            &d.pct_pre_re,
            &d.pct_after,
            &d.pct_before,
        ) {
            let pct = |m: &JsMatch, full: &JsString| -> JsString {
                let num = g(m, 1, full);
                let before = full.slice(0, Some(m.index() as isize));
                let after = full.slice(m.end() as isize, None);
                let w = pick(forms, num_value(&num), &d.cf);
                if d.percent_prefix {
                    if before_re.test(&before) {
                        num
                    } else {
                        cat(&[&w, &sp, &num])
                    }
                } else if after_re.test(&after) {
                    num
                } else {
                    cat(&[&num, &sp, &w])
                }
            };
            s = rewrite_with(&s, pct_pre_re, pct);
            s = rewrite_with(&s, pct_re, pct);
        }
        if let Some((times, by)) = &d.multiply {
            s = rewrite_with(
                &s,
                js_re!(r"(\p{Nd})\s*(×|x)\s*(?=\p{Nd})", "gu"),
                |m, full| {
                    let whole = m.value(full);
                    let spaced = js_re!(r"\s", "u").test(&whole);
                    let tail = full.slice(m.end() as isize, None);
                    let has_unit = js_re!(r"^\p{Nd}[\d.,]*\s?\p{L}", "u").test(&tail);
                    let word = if has_unit || (g(m, 2, full) == "x" && !spaced) {
                        by
                    } else {
                        times
                    };
                    cat(&[&g(m, 1, full), &sp, word, &sp])
                },
            );
        }

        if let Some(unit_re) = &d.unit_re {
            s = rewrite_with(&s, unit_re, |m, full| self.unit_reading(m, full));
        }

        s = (d.bare_unit)(&s);

        if let Some(be) = &d.bare_exponent {
            s = rewrite_with(&s, bare_exponent_glued(), |m, full| {
                cat(&[&m.value(full), &sp])
            });
            s = rewrite_with(&s, bare_exponent(), |m, all| {
                let whole = m.value(all);
                if declines_bare_exponent(m, all) {
                    return whole;
                }
                let base = g(m, 1, all);
                let digits = superscript_digits(&g(m, 2, all));
                let fallback =
                    || spaced_digits(&base, &digits, all, m.end()).unwrap_or_else(|| whole.clone());
                let neg = digits.starts_with(&js("-"));
                let mag = if neg {
                    digits.slice(1, None)
                } else {
                    digits.clone()
                };
                let tpl = if neg {
                    &be.power
                } else if mag == "2" {
                    &be.squared
                } else if mag == "3" {
                    &be.cubed
                } else {
                    &be.power
                };
                let Some(tpl) = tpl else { return fallback() };
                let exponent = match (neg, &be.negative) {
                    (true, None) => return fallback(),
                    (true, Some(n)) => cat(&[&js(n), &sp, &mag]),
                    (false, _) => mag,
                };
                let t = js_re!(r"\{n\}", "gu").replace(&js(tpl), &base);
                js_re!(r"\{e\}", "gu").replace(&t, &exponent)
            });
        } else {
            s = spaced_bare_exponent(&s);
        }
        s
    }

    /// The `unitRe` callback.
    fn unit_reading(&self, m: &JsMatch, full: &JsString) -> JsString {
        let d = self;
        let sp = js(" ");
        let whole = m.value(full);
        let num = m.group(1, full).unwrap();
        let mag = m.group(2, full);
        let u = m.group(3, full).unwrap();
        let (num_exp, denom, denom_exp, exp) = (
            m.group(4, full),
            m.group(5, full),
            m.group(6, full),
            m.group(7, full),
        );
        let has_mag = mag.as_ref().is_some_and(|g| !g.is_empty());
        let q = if has_mag {
            cat(&[&num, mag.as_ref().unwrap()])
        } else {
            num.clone()
        };
        let n = if has_mag {
            d.magnitude_count.unwrap_or(MANY)
        } else {
            num_value(&num)
        };
        let Some(forms) = resolve_unit_symbol(d.units.as_ref(), &d.units_folded, &u, false) else {
            return whole;
        };
        let head = pick(forms, n, &d.cf);
        let (squared, cubed, decl) = match &d.exponent_words {
            Some((s, c, p)) => (s.as_ref(), c.as_ref(), p.as_ref()),
            None => (None, None, None),
        };
        let is_cubed = |sup: &JsString| *sup == "\u{b3}" || *sup == "3";
        let power_mark = |power: &str| js(if power == "cubed" { "\u{b3}" } else { "\u{b2}" });
        if let Some(denom) = denom {
            let dl = denom.to_lower_case();
            let d_word: Option<JsString> =
                resolve_unit_symbol(d.units.as_ref(), &d.units_folded, &denom, true)
                    .map(|f| f[0].clone())
                    .or_else(|| {
                        resolve_unit_symbol(
                            d.rate_denominators.as_ref(),
                            &d.denom_folded,
                            &denom,
                            true,
                        )
                        .cloned()
                    });
            let per: Option<JsString> = match &d.unit_per {
                Some(UnitPer::All(w)) => Some(js(w)),
                Some(UnitPer::ByDenominator(r)) => {
                    let key = |k: &JsString| r.get(&k.to_string_lossy()).map(|v| js(v));
                    key(&denom).or_else(|| key(&dl))
                }
                None => None,
            };
            let with_power = |noun: &JsString, sup: &JsString| -> JsString {
                let power = if is_cubed(sup) { "cubed" } else { "squared" };
                match if power == "cubed" { cubed } else { squared } {
                    None => cat(&[noun, &power_mark(power)]),
                    Some(e_forms) => place(position_for(decl, power), &e_forms[0], noun),
                }
            };
            let (Some(per), Some(d_word)) = (per, d_word) else {
                let Some(slash) = whole.index_of(&js("/"), 0) else {
                    return whole;
                };
                let cut = js_re!(r"\s$", "u")
                    .replace(&whole.slice(0, Some(slash as isize)), &JsString::new())
                    .len();
                let head_only = match &num_exp {
                    None => head.clone(),
                    Some(e) => with_power(&head, e),
                };
                let said = if d.unit_prefix {
                    cat(&[&head_only, &sp, &q])
                } else {
                    cat(&[&q, &sp, &head_only])
                };
                let tail = whole.slice(cut as isize, None);
                let stranded = js_re!(
                    r"^\s?\/\s?[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{1,3}(?:²|³|[23])?$",
                    "u"
                );
                return if stranded.test(&tail) {
                    said
                } else {
                    cat(&[&said, &tail])
                };
            };
            let d_phrase = match &denom_exp {
                Some(e) => with_power(&d_word, e),
                None => d_word,
            };
            let head_phrase = match &num_exp {
                None => head.clone(),
                Some(e) => with_power(&head, e),
            };
            return if d.unit_prefix {
                cat(&[&head_phrase, &sp, &q, &sp, &per, &sp, &d_phrase])
            } else {
                cat(&[&q, &sp, &head_phrase, &sp, &per, &sp, &d_phrase])
            };
        }
        if let Some(exp) = exp {
            let power = if is_cubed(&exp) { "cubed" } else { "squared" };
            let Some(e_forms) = (if power == "cubed" { cubed } else { squared }) else {
                let back = power_mark(power);
                return if d.unit_prefix {
                    cat(&[&head, &back, &sp, &q])
                } else {
                    cat(&[&q, &sp, &head, &back])
                };
            };
            let word = pick(e_forms, n, &d.cf);
            let phrase = place(position_for(decl, power), &word, &head);
            return if d.unit_prefix {
                cat(&[&phrase, &sp, &q])
            } else {
                cat(&[&q, &sp, &phrase])
            };
        }
        if d.unit_prefix {
            cat(&[&head, &sp, &q])
        } else {
            cat(&[&q, &sp, &head])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tier(json: &str) -> SymbolNormalizer {
        make_symbol_normalizer(&serde_json::from_str::<SymbolData>(json).unwrap()).unwrap()
    }

    #[test]
    fn currency_percent_units_and_powers() {
        let t = tier(
            r#"{"percent":["por ciento"],"currency":{"$":["dólar","dólares"]},"units":{"km":["kilómetro","kilómetros"]},
               "exponentWords":{"squared":["cuadrado","cuadrados"]},"magnitudes":["millones"],"magnitudeConnective":"de"}"#,
        );
        let ap = |s: &str| t.apply(&js(s)).to_string_lossy();
        assert_eq!(ap("$5 millones"), "5 millones de dólares");
        assert_eq!(
            ap("40% y 1 km y 5 km²"),
            "40 por ciento y 1 kilómetro y 5 kilómetros cuadrados"
        );
        // No bareExponent declared: the floor spaces a digit-base power out, and declines a lone ⁰ mark.
        assert_eq!(ap("10⁶ y 79⁰"), "10 6 y 79⁰");
    }

    #[test]
    fn declared_empty_forms_are_refused() {
        let d: SymbolData = serde_json::from_str(r#"{"percent":[]}"#).unwrap();
        assert!(make_symbol_normalizer(&d).is_err());
    }

    #[test]
    fn a_nan_or_fractional_count_form_index_reads_undefined_as_the_ts_does() {
        let nan: CountForm = Arc::new(|_| f64::NAN);
        assert_eq!(pick(&[js("a"), js("b")], 1.0, &nan), "undefined");
        let frac: CountForm = Arc::new(|_| 0.5);
        assert_eq!(pick(&[js("a"), js("b")], 1.0, &frac), "undefined");
    }
}
