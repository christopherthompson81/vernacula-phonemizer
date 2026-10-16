//! Lao (lo) phonemizer: the leading-vowel reorder, the cancellation mark, the syllable scanner over the ordered
//! vowel-pattern table, tone from class × live/dead × length × mark, and the number compositor.
//! Ported from src/languages/lao/lao.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::normalize_lao;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize};
use crate::core::unicode::fold_native_digits;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/lao";

#[derive(Debug, Clone, Copy, PartialEq, Eq, FromJson)]
#[json(rename_all = "lowercase")]
pub enum Cls {
    High,
    Mid,
    Low,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct LaoNumbers {
    pub units: Vec<String>,
    pub ten: String,
    pub twenty: String,
    pub final_one: String,
    pub magnitudes: Vec<(f64, String)>,
}

/// One vowel PATTERN: absent `pre` means "only when there is no leading vowel".
#[derive(Debug, FromJson)]
pub struct VowelPattern {
    pub pre: Option<String>,
    pub signs: String,
    pub q: String,
    pub long: Option<bool>,
    pub glide: Option<String>,
}

/// `Partial<Record<Cls, string>> & { default?: string }`.
#[derive(Debug, FromJson)]
pub struct ToneRow {
    pub high: Option<String>,
    pub mid: Option<String>,
    pub low: Option<String>,
    pub default: Option<String>,
}

impl ToneRow {
    fn get(&self, c: Cls) -> Option<&String> {
        match c {
            Cls::High => self.high.as_ref(),
            Cls::Mid => self.mid.as_ref(),
            Cls::Low => self.low.as_ref(),
        }
    }
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Tone {
    pub marks: IndexMap<String, ToneRow>,
    pub live: ToneRow,
    pub dead_long: ToneRow,
    pub dead_short: ToneRow,
}

/// `LaoDef` (lao.ts).
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct LaoDef {
    pub onsets: IndexMap<String, (String, Cls)>,
    pub vowel_patterns: Vec<VowelPattern>,
    pub tone: Tone,
    pub leading_vowels: Vec<String>,
    pub h_led_sonorants: Vec<String>,
    pub tone_marks: Vec<String>,
    pub codas: IndexMap<String, String>,
    pub cancellation_mark: String,
    pub numbers: LaoNumbers,
}

pub fn try_def() -> Result<&'static LaoDef, String> {
    static D: OnceLock<LaoDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "lao.jsonc").map_err(|e| e.to_string())
    })
}

/// `MANIFEST`, for code reached only through a checked path (`createLao` loads it first).
pub static MANIFEST: LazyLock<&'static LaoDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `c in CONS` (one code point; a lone surrogate reads as U+FFFD, which is no key).
fn is_cons(c: &JsString) -> bool {
    MANIFEST.onsets.contains_key(&c.to_string_lossy())
}

fn in_list(list: &[String], c: &JsString) -> bool {
    let c = c.to_string_lossy();
    list.contains(&c)
}

fn is_lead(c: &JsString) -> bool {
    in_list(&MANIFEST.leading_vowels, c)
}

fn is_hson(c: &JsString) -> bool {
    in_list(&MANIFEST.h_led_sonorants, c)
}

/// `s[i] ?? ""`.
fn at(s: &[JsString], i: usize) -> JsString {
    s.get(i).cloned().unwrap_or_default()
}

fn eq(c: &JsString, lit: &str) -> bool {
    *c == js(lit)
}

/// `reorder(w)`: a leading vowel moves past its consonant (and a ຼ, or a ຫ-led sonorant).
fn reorder(w: &JsString) -> JsString {
    let s = normalize(w, Form::Nfc).code_point_strings();
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < s.len() {
        if is_lead(&s[i]) && is_cons(&at(&s, i + 1)) {
            let mut j = i + 1;
            let mut cons = s[j].clone();
            j += 1;
            if eq(&at(&s, j), "ຼ") || (eq(&cons, "ຫ") && is_hson(&at(&s, j))) {
                cons.push_str(&s[j]);
                j += 1;
            }
            out.push(cons);
            out.push(s[i].clone());
            i = j - 1;
        } else {
            out.push(s[i].clone());
        }
        i += 1;
    }
    JsString::join(&out, &JsString::new())
}

/// `cancelSilent(w)`: the cancellation mark deletes the final cluster down to one coda, and itself.
fn cancel_silent(w: &JsString) -> JsString {
    let cancel = js(&MANIFEST.cancellation_mark);
    if !w.includes(&cancel) {
        return w.clone();
    }
    let s = w.code_point_strings();
    let mut drop = vec![false; s.len()];
    for i in 0..s.len() {
        if s[i] != cancel {
            continue;
        }
        drop[i] = true;
        let mut j = i as isize - 1;
        while j >= 0 && drop[j as usize] {
            j -= 1;
        }
        if j < 0 || !is_cons(&s[j as usize]) {
            continue;
        }
        let j = j as usize;
        drop[j] = true;
        let mut k = j as isize - 1;
        while k >= 1 && is_cons(&s[k as usize]) && is_cons(&s[k as usize - 1]) {
            drop[k as usize] = true;
            k -= 1;
        }
    }
    let kept: Vec<JsString> = s
        .into_iter()
        .zip(drop)
        .filter(|(_, d)| !d)
        .map(|(c, _)| c)
        .collect();
    JsString::join(&kept, &JsString::new())
}

struct Resolved {
    q: JsString,
    long: bool,
    glide: JsString,
    used: usize,
}

/// `resolveVowel(pre, after)`: the FIRST pattern whose leading vowel and following signs both match.
fn resolve_vowel(pre: &JsString, after: &[JsString]) -> Option<Resolved> {
    for p in &MANIFEST.vowel_patterns {
        if js(p.pre.as_deref().unwrap_or("")) != *pre {
            continue;
        }
        let signs = js(&p.signs);
        let n = signs.code_points().count();
        if n > 0 && JsString::join(&after[..n.min(after.len())], &JsString::new()) != signs {
            continue;
        }
        return Some(Resolved {
            q: js(&p.q),
            long: p.long.unwrap_or(false),
            glide: js(p.glide.as_deref().unwrap_or("")),
            used: n,
        });
    }
    None
}

/// `tone(cls, live, long, mark)`.
fn tone(cls: Cls, live: bool, long: bool, mark: &JsString) -> JsString {
    let t = &MANIFEST.tone;
    let row = t.marks.get(&mark.to_string_lossy()).unwrap_or(if live {
        &t.live
    } else if long {
        &t.dead_long
    } else {
        &t.dead_short
    });
    js(row
        .get(cls)
        .or(row.default.as_ref())
        .map_or("", |s| s.as_str()))
}

/// `extractTones(chars)`: the mark-free stream and onset index → mark (the first mark on each onset).
fn extract_tones(chars: &[JsString]) -> (Vec<JsString>, IndexMap<usize, JsString>) {
    let mut clean: Vec<JsString> = Vec::new();
    let mut tone_at: IndexMap<usize, JsString> = IndexMap::new();
    let mut last_cons: isize = -1;
    for c in chars {
        if in_list(&MANIFEST.tone_marks, c) {
            if last_cons >= 0 && !tone_at.contains_key(&(last_cons as usize)) {
                tone_at.insert(last_cons as usize, c.clone());
            }
        } else {
            if is_cons(c) {
                last_cons = clean.len() as isize;
            }
            clean.push(c.clone());
        }
    }
    (clean, tone_at)
}

/// One syllable's features (`SylF`).
#[derive(Clone)]
struct SylF {
    onset: JsString,
    cls: Cls,
    quality: JsString,
    long: bool,
    coda_out: JsString,
    mark: JsString,
    live: bool,
    heavy: bool,
}

const VSIGNS: [&str; 13] = ["ະ", "າ", "ິ", "ີ", "ຸ", "ູ", "ຶ", "ື", "ັ", "ົ", "ຳ", "ໍ", "ຽ"];

fn is_vsign(c: &JsString) -> bool {
    let c = c.to_string_lossy();
    VSIGNS.contains(&c.as_str())
}

/// `scanFeatures(word)`: a reordered word → per-syllable feature records.
fn scan_features(word: &JsString) -> Vec<SylF> {
    let (s, tone_at) = extract_tones(&word.code_point_strings());
    let mut out: Vec<SylF> = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let mut lead_high = false;
        let onset_idx = i;
        let c = s[i].clone();
        if eq(&c, "ໆ") {
            if let Some(last) = out.last().cloned() {
                out.push(last);
            }
            i += 1;
            continue;
        }
        if !is_cons(&c) {
            i += 1;
            continue;
        }
        let mut onset_cs = vec![c.clone()];
        i += 1;
        if eq(&c, "ຫ") && (eq(&at(&s, i), "ຼ") || is_hson(&at(&s, i))) {
            lead_high = true;
            onset_cs = vec![if eq(&s[i], "ຼ") {
                js("ລ")
            } else {
                s[i].clone()
            }];
            i += 1;
        }
        let mut cluster = JsString::new();
        if eq(&at(&s, i), "ຼ") {
            cluster = js("l");
            i += 1;
        }
        let mut pre = JsString::new();
        if is_lead(&at(&s, i)) {
            pre = s[i].clone();
            i += 1;
        }
        let rest = &s[i.min(s.len())..];
        let (mut quality, mut long, mut glide, mut used) = (js("a"), false, JsString::new(), 0);
        if let Some(rv) = resolve_vowel(&pre, rest) {
            quality = rv.q;
            long = rv.long;
            glide = rv.glide;
            used = rv.used;
        }
        i += used;
        let mark = tone_at
            .get(&onset_idx)
            .or_else(|| tone_at.get(&(onset_idx + 1)))
            .cloned()
            .unwrap_or_default();
        let mut coda = JsString::new();
        let nx = at(&s, i);
        if glide.is_empty() && MANIFEST.codas.contains_key(&nx.to_string_lossy()) {
            let (after, after2) = (at(&s, i + 1), at(&s, i + 2));
            let o_is_own_vowel = (eq(&after, "ອ") || eq(&after, "ວ"))
                && !(is_vsign(&after2) || is_lead(&after2) || eq(&after2, "ອ") || eq(&after2, "ວ"));
            let follows_vowel =
                is_vsign(&after) || is_lead(&after) || eq(&after, "ຼ") || o_is_own_vowel;
            if !(is_cons(&nx) && follows_vowel) {
                coda = js(MANIFEST
                    .codas
                    .get(&nx.to_string_lossy())
                    .map_or("", |s| s.as_str()));
                i += 1;
            }
        }
        if coda.is_empty()
            && glide.is_empty()
            && eq(&at(&s, i), "ຽ")
            && (used > 0 || !pre.is_empty())
        {
            coda = js("j");
            i += 1;
        }
        let onset_ipa: Vec<JsString> = onset_cs
            .iter()
            .map(|g| {
                js(MANIFEST
                    .onsets
                    .get(&g.to_string_lossy())
                    .map_or("", |o| o.0.as_str()))
            })
            .collect();
        let onset = JsString::join(&onset_ipa, &JsString::new()).concat(&cluster);
        let cls = if lead_high {
            Cls::High
        } else {
            MANIFEST
                .onsets
                .get(&onset_cs[0].to_string_lossy())
                .map_or(Cls::Mid, |o| o.1)
        };
        let coda_out = if coda.is_empty() { glide } else { coda };
        let heavy = long || quality.includes(&js("ː"));
        let live = if coda_out.is_empty() {
            heavy
        } else {
            js_re!(r"[ŋnmjw]").test(&coda_out)
        };
        out.push(SylF {
            onset,
            cls,
            quality,
            long,
            coda_out,
            mark,
            live,
            heavy,
        });
    }
    out
}

/// `scan(word)`: the syllables rendered, joined by `.`.
fn scan(word: &JsString) -> JsString {
    let parts: Vec<JsString> = scan_features(word)
        .iter()
        .map(|s| {
            s.onset
                .concat(&s.quality)
                .concat(&js(if s.long { "ː" } else { "" }))
                .concat(&tone(s.cls, s.live, s.heavy, &s.mark))
                .concat(&s.coda_out)
        })
        .collect();
    JsString::join(&parts, &js("."))
}

/// `numberToLaoWords(n, raw)`: Lao-script words, read back through the g2p.
pub fn number_to_lao_words(n: f64, raw: Option<&JsString>) -> Vec<String> {
    let num = &MANIFEST.numbers;
    let units = &num.units;
    if !is_safe_integer(n) || n < 0.0 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_number_to_string(n.abs())),
        };
        return digits
            .code_point_strings()
            .iter()
            .filter_map(|c| match c.units() {
                [u] if (b'0' as u16..=b'9' as u16).contains(u) => {
                    Some(units[(*u - b'0' as u16) as usize].clone())
                }
                _ => None,
            })
            .collect();
    }
    if n == 0.0 {
        return vec![units[0].clone()];
    }
    let mut out: Vec<String> = Vec::new();
    let mut r = n;
    for (v, w) in &num.magnitudes {
        if r >= *v {
            let q = (r / v).floor();
            out.extend(number_to_lao_words(q, None));
            out.push(w.clone());
            r %= v;
        }
    }
    if r >= 10.0 {
        let t = (r / 10.0).floor();
        if t == 2.0 {
            out.push(num.twenty.clone());
        } else if t == 1.0 {
            out.push(num.ten.clone());
        } else {
            out.push(units[t as usize].clone());
            out.push(num.ten.clone());
        }
        r %= 10.0;
    }
    if r == 1.0 && n >= 11.0 {
        out.push(num.final_one.clone());
    } else if r > 0.0 {
        out.push(units[r as usize].clone());
    }
    out
}

/// Per-syllable tone-determining features (`wordFeatures`), serialized `cls/live/long/mark`.
pub fn word_features(word: &JsString) -> Vec<(Cls, bool, bool, JsString)> {
    scan_features(&reorder(word))
        .into_iter()
        .map(|s| (s.cls, s.live, s.heavy, s.mark))
        .collect()
}

/// `phonemizeWord(word)`.
pub fn phonemize_word(word: &JsString) -> JsString {
    scan(&cancel_silent(&reorder(word)))
}

pub struct LaoPhonemizer;

impl LaoPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_lao(text)
    }

    /// The shared symbol tier normalize.ts runs at its step 6.
    pub fn symbols(&self, text: &JsString) -> JsString {
        super::normalize::try_symbols()
            .expect("checked by create_lao")
            .apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let s = fold_native_digits(&normalize_lao(input));
        assemble_clauses(
            &s,
            js_re!(r"([຀-໿]+)|(\d+)|([.!?…,;:])", "gu"),
            |m, s, sink| {
                if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                    sink.emit(&phonemize_word(&w));
                } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                    for wd in number_to_lao_words(js_number(&d), Some(&d)) {
                        sink.emit(&phonemize_word(&js(&wd)));
                    }
                } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty()) {
                    // Hardcoded marks, as in the TS: `, ; :` produce no pause.
                    if eq(&p, "?") {
                        sink.pause(&js("?"));
                    } else if eq(&p, "!") {
                        sink.pause(&js("!"));
                    } else if js(".…").includes(&p) {
                        sink.pause(&js("."));
                    }
                }
            },
        )
    }
}

impl Engine for LaoPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(LaoPhonemizer::text(self, input))
    }
}

/// `createLao()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_lao() -> Result<LaoPhonemizer, String> {
    try_def()?;
    super::normalize::try_symbols()?;
    Ok(LaoPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/lao.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["ລາວ"], Some("laː˧˥w")),
        ("phonemizeWord", &["ຄົນ"], Some("kʰo˧˥n")),
        ("phonemizeWord", &["ນ້ຳ"], Some("na˥˨m")),
        ("phonemizeWord", &["ຂ້າວ"], Some("kʰaː˧˩w")),
        ("phonemizeWord", &["ເມືອງ"], Some("mɯːə˧˥ŋ")),
        ("phonemizeWord", &["ສະບາຍດີ"], Some("sa˧˥.baː˩j.diː˩")),
        ("phonemizeWord", &["ຫນັງສື"], Some("na˩ŋ.sɯː˩")),
        ("phonemizeWord", &["ໂຮງຮຽນ"], Some("hoː˧˥ŋ.hiːə˧˥n")),
        ("phonemizeWord", &["ຄວາຍ"], Some("kʰuːə˧˥j")),
        ("phonemizeWord", &["ສອງ"], Some("sɔː˩ŋ")),
        ("phonemizeWord", &["ໄກ່"], Some("ka˧j")),
        ("phonemizeWord", &["ເດັກ"], Some("de˧˥k̚")),
        ("phonemize", &["0", "lo"], Some("suː˩n")),
        ("phonemize", &["7", "lo"], Some("t͡ɕe˧˥t̚")),
        ("phonemize", &["11", "lo"], Some("si˧˥p̚ ʔe˧˥t̚")),
        ("phonemize", &["20", "lo"], Some("saː˧˥w")),
        ("phonemize", &["21", "lo"], Some("saː˧˥w ʔe˧˥t̚")),
        ("phonemize", &["42", "lo"], Some("siː˧ si˧˥p̚ sɔː˩ŋ")),
        ("phonemize", &["100", "lo"], Some("nɯ˧ŋ hɔː˥˨j")),
        ("phonemize", &["101", "lo"], Some("nɯ˧ŋ hɔː˥˨j ʔe˧˥t̚")),
        ("phonemize", &["1000", "lo"], Some("nɯ˧ŋ pʰa˧˥n")),
        (
            "phonemize",
            &["12345", "lo"],
            Some("nɯ˧ŋ mɯː˧n sɔː˩ŋ pʰa˧˥n saː˩m hɔː˥˨j siː˧ si˧˥p̚ haː˧˩"),
        ),
        ("phonemize", &["1000000", "lo"], Some("nɯ˧ŋ laː˥˨n")),
        ("normalizeLao", &["ຊະ\u{ad}ນິດ"], Some("ຊະນິດ")),
        ("normalizeLao", &["ຝູງ\u{200b}ສັດປ່າ"], Some("ຝູງ\u{200b}ສັດປ່າ")),
        (
            "normalizeLao",
            &["ໃນປີ ຄ.ສ. 1990"],
            Some("ໃນປີ ຄຣິດສັກກະລາດ 1990"),
        ),
        ("normalizeLao", &["ພ.ສ. 2500"], Some("ພຸດທະສັກກະລາດ 2500")),
        ("normalizeLao", &["ຫຼາຍ.ສະນັ້ນ"], Some("ຫຼາຍ.ສະນັ້ນ")),
        ("normalizeLao", &["512,115"], Some("512115")),
        ("normalizeLao", &["52.201 ກິໂລແມ້ດ"], Some("52201 ກິໂລແມ້ດ")),
        ("normalizeLao", &["0.75"], Some("0 ຈຸດ 7 5")),
        ("normalizeLao", &["2,1"], Some("2 ຈຸດ 1")),
        (
            "phonemize",
            &["49,600", "lo"],
            Some("siː˧ mɯː˧n ka˥˨w pʰa˧˥n ho˧˥k̚ hɔː˥˨j"),
        ),
        (
            "phonemize",
            &["49600", "lo"],
            Some("siː˧ mɯː˧n ka˥˨w pʰa˧˥n ho˧˥k̚ hɔː˥˨j"),
        ),
        ("normalizeLao", &["21%"], Some("ຮ້ອຍລະ 21")),
        ("normalizeLao", &["$ 35 ລ້ານ"], Some("35 ລ້ານ ໂດລາ")),
        ("normalizeLao", &["700,000 m²"], Some("700000 ຕາລາງແມັດ")),
        ("normalizeLao", &["2.6 ລ້ານ m³"], Some("2 ຈຸດ 6 ລ້ານ ແມັດກ້ອນ")),
        ("normalizeLao", &["A & B"], Some("A ແລະ B")),
        ("normalizeLao", &["20 °C"], Some("20 ອົງສາ")),
        ("normalizeLao", &["0 - 2 c°"], Some("0 - 2 ອົງສາ")),
        (
            "normalizeLao",
            &["51 ອົງສາ 50 ລິບດາ"],
            Some("51 ອົງສາ 50 ລິບດາ"),
        ),
        (
            "normalizeLao",
            &["ໄປທາງຕາເວັນຕົກ -180 ອົງສາ"],
            Some("ໄປທາງຕາເວັນຕົກ ລົບ 180 ອົງສາ"),
        ),
        (
            "normalizeLao",
            &["(−1, −2, −3)"],
            Some("(ລົບ 1, ລົບ 2, ລົບ 3)"),
        ),
        ("normalizeLao", &["ໃນປີ 1642 -1647"], Some("ໃນປີ 1642 -1647")),
        ("normalizeLao", &["30 - 33 c°"], Some("30 - 33 ອົງສາ")),
        ("normalizeLao", &["p^e_{-1}"], Some("p^e_{-1}")),
        (
            "normalizeLao",
            &["ຈະໄດ້ເປີເຊັນ 10% ພ້ອມ"],
            Some("ຈະໄດ້ເປີເຊັນ 10 ພ້ອມ"),
        ),
        ("normalizeLao", &["ຮ້ອຍລະ% 30"], Some("ຮ້ອຍລະ 30")),
        (
            "normalizeLao",
            &["ຈາກ 10% ຫາ 20%"],
            Some("ຈາກ ຮ້ອຍລະ 10 ຫາ ຮ້ອຍລະ 20"),
        ),
        ("normalizeLao", &["%72"], Some("ຮ້ອຍລະ 72")),
        ("normalizeLao", &["ຄ.ສ.1990"], Some("ຄຣິດສັກກະລາດ 1990")),
        ("normalizeLao", &["ຄ. ສ. 1990"], Some("ຄຣິດສັກກະລາດ 1990")),
        ("normalizeLao", &["19 ມີນາ 2008"], Some("19 ມີນາ 2008")),
        ("normalizeLao", &["5 ມິຖຸນາ"], Some("5 ມິຖຸນາ")),
        ("phonemizeWord", &["ເຊັຽ"], Some("siːə˧˥")),
        ("phonemizeWord", &["ເກົ້າ"], Some("ka˥˨w")),
        ("phonemizeWord", &["ເບຼຊິນ"], Some("bleː˩.si˧˥n")),
        ("phonemizeWord", &["ເກຼັກ"], Some("kle˧˥k̚")),
        ("phonemizeWord", &["ໄຮໂດຼເຈນ"], Some("ha˧˥j.dloː˩.t͡ɕeː˩n")),
        ("phonemizeWord", &["ແກຼນວິນ"], Some("klɛː˩n.ʋi˧˥n")),
        ("phonemizeWord", &["ອະບຼາຮາມ"], Some("ʔa˧˥.blaː˩.haː˧˥m")),
        ("phonemizeWord", &["ໂທບຼຸກ"], Some("tʰoː˧˥.blu˧˥k̚")),
        ("phonemizeWord", &["ກິໂລກຼາມ"], Some("ki˧˥.loː˧˥.klaː˩m")),
        ("phonemizeWord", &["ຫຼາຍ"], Some("laː˩j")),
        ("phonemizeWord", &["ເຫຼັກ"], Some("le˧˥k̚")),
        ("phonemizeWord", &["ເວລາ"], Some("ʋeː˧˥.laː˧˥")),
        ("phonemizeWord", &["ໄຟລ໌"], Some("fa˧˥j")),
        ("phonemizeWord", &["ເວັບໄຊຕ໌"], Some("ʋe˧p̚.sa˧˥j")),
        ("phonemizeWord", &["ອິນທະວົງສ໌"], Some("ʔi˩n.tʰa˧.ʋo˧˥ŋ")),
        ("phonemizeWord", &["ອາທິຕຍ໌"], Some("ʔaː˩.tʰi˧t̚")),
        ("phonemizeWord", &["ວຽງຈັນທນ໌"], Some("ʋiːə˧˥ŋ.t͡ɕa˩n")),
        ("phonemizeWord", &["ສັຕວ໌"], Some("sa˧˥t̚")),
        ("phonemizeWord", &["ຣົຖ"], Some("lo˧t̚")),
        ("phonemizeWord", &["ຕາ"], Some("taː˩")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(phonemize_word(&a(0))),
                "normalizeLao" => Some(normalize_lao(&a(0))),
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
    /// `tools/provenance-poison.mts lo` reports 0 sites as well).
    #[test]
    fn lao_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/lo.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/lo.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "lo").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }

    /// test/lao.test.ts's two invariants on the vowel pattern table (its order is the algorithm): no pattern is
    /// shadowed by an earlier one it starts with in its own group, and every leading-vowel group ends in a
    /// catch-all.
    #[test]
    fn the_vowel_pattern_table_invariants_hold() {
        let p = &try_def().unwrap().vowel_patterns;
        let pre = |v: &VowelPattern| v.pre.clone().unwrap_or_default();
        let mut shadowed = Vec::new();
        for i in 0..p.len() {
            for j in 0..i {
                if pre(&p[j]) == pre(&p[i]) && p[i].signs.starts_with(&p[j].signs) {
                    shadowed.push(format!(
                        "{}+{} behind {}+{}",
                        pre(&p[i]),
                        p[i].signs,
                        pre(&p[j]),
                        p[j].signs
                    ));
                }
            }
        }
        assert!(shadowed.is_empty(), "{shadowed:?}");
        for lead in &try_def().unwrap().leading_vowels {
            let group: Vec<&VowelPattern> =
                p.iter().filter(|v| v.pre.as_ref() == Some(lead)).collect();
            assert!(!group.is_empty(), "no patterns for {lead}");
            assert_eq!(group.last().unwrap().signs, "", "{lead} has no catch-all");
        }
    }
}

/// #1589, as test/sea-defects-1589.test.ts: relational, so no IPA is typed. Synthetic probes.
#[cfg(all(test, feature = "lo"))]
mod defects_1589_tests {
    #[test]
    fn reads_as_its_spelled_form() {
        for (input, spelled) in [("1,234.5", "1234.5"), ("1.234,5", "1234,5")] {
            assert_eq!(
                crate::phonemize(input, "lo").unwrap(),
                crate::phonemize(spelled, "lo").unwrap(),
                "{input}"
            );
        }
    }
}
