//! Marathi (mr) text normalization: vowel-sign repairs, ZW joiners, native digits, visarga colons, era markers,
//! abbreviations, ordinals, clock times, degrees, percent, currency, units, ranges, fractions and signs rewritten
//! into words before tokenizing, every word from `marathi.jsonc`. Pure text to text.
//! Ported from src/languages/marathi/normalize.ts — see that file for the corpus evidence.

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::numbers::{NumbersDef, indic_number_words_js};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;
use crate::languages::hindi::normalize::TextFn;

#[derive(Debug, FromJson, Clone)]
pub struct Percent {
    pub plural: String,
    pub singular: String,
}

#[derive(Debug, FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct Ordinals {
    pub suffix_form: IndexMap<String, usize>,
    pub irregular: IndexMap<String, [String; 4]>,
    pub stem_hundred: String,
    pub stem_nine: [String; 2],
    pub stem_tens: [String; 2],
}

#[derive(Debug, FromJson, Clone)]
pub struct Clock {
    pub past: String,
    pub minutes: String,
    pub oclock: String,
}

#[derive(Debug, FromJson, Clone)]
pub struct EraMarkers {
    pub bc: String,
    pub ad: String,
}

#[derive(Debug, FromJson, Clone)]
pub struct Degree {
    pub word: String,
    pub celsius: String,
    pub fahrenheit: String,
    pub north: String,
    pub south: String,
    pub east: String,
    pub west: String,
}

#[derive(Debug, FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct Fractions {
    pub half: String,
    pub quarter: String,
    pub three_quarters: String,
    pub divided_by: String,
}

#[derive(Debug, FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct SymbolWords {
    pub plus: String,
    pub approximately: String,
    pub plus_minus: String,
    pub less_than: String,
    pub greater_than: String,
    pub divide: String,
    pub equals: String,
    pub minus: String,
}

/// `MarathiWords` without its `numbers` (that field is `HindiDef`'s, which the manifest shares).
#[derive(Debug, FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct MarathiWords {
    pub currency: IndexMap<String, String>,
    pub percent: Percent,
    pub unit_words: IndexMap<String, String>,
    pub magnitude_words: Vec<String>,
    pub ordinals: Ordinals,
    pub visarga_adverbs: Vec<String>,
    pub clock: Clock,
    pub era_markers: EraMarkers,
    pub abbreviations: IndexMap<String, String>,
    pub degree: Degree,
    pub fractions: Fractions,
    pub symbol_words: SymbolWords,
    pub range_word: String,
    pub bare_hundred: String,
}

/// `Object.keys(m).sort((a, b) => b.length - a.length)`: UTF-16 length, a stable sort.
fn by_length<V>(m: &IndexMap<String, V>) -> Vec<String> {
    let mut k: Vec<&String> = m.keys().collect();
    k.sort_by_key(|a| std::cmp::Reverse(js(a).len()));
    k.into_iter().cloned().collect()
}

fn cardinal(n: f64, d: &NumbersDef) -> Vec<String> {
    indic_number_words_js(n, d)
        .into_iter()
        .map(|w| w.unwrap_or_default())
        .collect()
}

fn pattern(p: String) -> Result<JsRegex, String> {
    JsRegex::new(&p, "gu").map_err(|e| format!("marathi pattern {p}: {e}"))
}

/// `makeMarathiNormalizer(def)`.
pub fn make_marathi_normalizer(numbers: &NumbersDef, def: &MarathiWords) -> Result<TextFn, String> {
    let numbers = numbers.clone();
    let def = def.clone();
    let suffix_alt = by_length(&def.ordinals.suffix_form).join("|");
    let unit_alt = by_length(&def.unit_words)
        .iter()
        .map(|k| {
            js_re!(r"[.*+?^${}()|[\]\\/]", "g")
                .replace(&js(k), &js("\\$&"))
                .to_string_lossy()
        })
        .collect::<Vec<_>>()
        .join("|");
    let magnitude_alt = def.magnitude_words.join("|");
    let tah_adverb_alt = def.visarga_adverbs.join("|");
    let tah_re = pattern(format!(
        r"(?<![\p{{L}}\p{{M}}])({tah_adverb_alt}):(?![\p{{L}}\p{{M}}])"
    ))?;
    let ordinal_re = pattern(format!(
        r"(?<![\d.,])(\d+)\s?({suffix_alt})(?![\p{{L}}\p{{M}}])"
    ))?;
    let currency_re = pattern(format!(
        r"([$€¥£₹])\s?(\d+(?:[.,]\d+)*)(\s*(?:{magnitude_alt})(?![\p{{L}}\p{{M}}]))?"
    ))?;
    let unit_re = pattern(format!(r"(\d)\s?({unit_alt})(?![\p{{L}}\p{{M}}])"))?;

    Ok(Box::new(move |input: &JsString| {
        let d = &numbers;
        let o = &def.ordinals;
        let cardinal_text = |n: f64| cardinal(n, d).join(" ");
        let ordinal_stem = |w: &str| -> String {
            if d.magnitudes.hundred.as_deref() == Some(w) {
                return o.stem_hundred.clone();
            }
            if w == o.stem_nine[0] {
                return o.stem_nine[1].clone();
            }
            let tens = js(&o.stem_tens[0]);
            let wj = js(w);
            if wj.ends_with(&tens) {
                // `w.slice(0, -len)`: with an empty stem that is `slice(0, -0)`, the empty string.
                return wj
                    .slice(0, Some(-(tens.len() as isize)))
                    .concat(&js(&o.stem_tens[1]))
                    .to_string_lossy();
            }
            if d.units.iter().any(|u| u == w) || d.teens.iter().flatten().any(|t| t == w) {
                return w.to_string();
            }
            if js_re!(r"[क-हक़-य़]$", "u").test(&wj) {
                format!("{w}ा")
            } else {
                w.to_string()
            }
        };
        let ordinal = |n: f64, form: usize, suffix: &str| -> Option<String> {
            if let Some(irr) = o.irregular.get(&js_number_to_string(n)) {
                return irr.get(form).cloned();
            }
            let mut words = cardinal(n, d);
            if words.is_empty() || words.iter().any(|w| w.is_empty()) {
                return None;
            }
            let last = words.len() - 1;
            words[last] = format!("{}{suffix}", ordinal_stem(&words[last]));
            Some(words.join(" "))
        };
        let clock = |h: f64, min: f64| -> String {
            let c = &def.clock;
            if min == 0.0 {
                cardinal_text(h)
            } else {
                format!(
                    "{} {} {} {}",
                    cardinal_text(h),
                    c.past,
                    cardinal_text(min),
                    c.minutes
                )
            }
        };
        let (era, deg, frac, sign) = (
            &def.era_markers,
            &def.degree,
            &def.fractions,
            &def.symbol_words,
        );

        let mut s = input.clone();
        s = rewrite(
            &rewrite(&s, js_re!("अ[\u{200C}\u{200D}]?ॅ", "gu"), &js("ऍ")),
            js_re!("अ[\u{200C}\u{200D}]?ॉ", "gu"),
            &js("ऑ"),
        );
        s = rewrite(&s, js_re!("[\u{200C}\u{200D}]", "gu"), &JsString::new());

        s = rewrite_with(&s, js_re!("[०-९]", "gu"), |m, full| {
            let c = m.value(full).char_code_at(0).unwrap_or_default();
            js(&(c - 0x0966).to_string())
        });

        s = rewrite(&s, js_re!(r"(\d)ः(\d)", "gu"), &js("$1:$2"));
        s = rewrite(&s, js_re!("(?<=[ऀ-ॣॲ-ॿ]):(?=[ऀ-ॣॲ-ॿ])", "gu"), &js("ः"));
        s = rewrite(&s, &tah_re, &js("$1ः"));

        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])[इई]\.?\s?स\.?\s?प[ूु]\.?", "gu"),
            &js(&era.bc),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])[इई]\.?\s?प[ूु]\.?", "gu"),
            &js(&era.bc),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])[इई]\.?\s?स\.", "gu"),
            &js(&era.ad),
        );

        // `${def.abbreviations["डॉ"]}$1`: a missing key would template as "undefined".
        let dr = def
            .abbreviations
            .get("डॉ")
            .map_or("undefined", String::as_str);
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])डॉ\.?(\s+)(?=[\p{L}])", "gu"),
            &js(&format!("{dr}$1")),
        );

        s = rewrite_with(&s, &ordinal_re, |m, full| {
            let digits = m.group(1, full).unwrap_or_default();
            let suffix = m.group(2, full).unwrap_or_default().to_string_lossy();
            let Some(&form) = o.suffix_form.get(&suffix) else {
                return m.value(full);
            };
            ordinal(js_number(&digits), form, &suffix).map_or_else(|| m.value(full), |w| js(&w))
        });

        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d.,:])(\d+)(\s*)(?=व[ाीे])", "gu"),
            |m, full| {
                let n = js_number(&m.group(1, full).unwrap_or_default());
                if !is_safe_integer(n) {
                    return m.value(full);
                }
                let words = cardinal(n, d);
                if words.is_empty() || words.iter().any(|w| w.is_empty()) {
                    return m.value(full);
                }
                let sp = m.group(2, full).unwrap_or_default();
                let sp = if sp.is_empty() { js(" ") } else { sp };
                js(&words.join(" ")).concat(&sp)
            },
        );

        s = rewrite(
            &s,
            js_re!(r"(?<![\d.,:])(\d{1,2}):(\d{2}\.\d{1,2})(?![\d:])", "gu"),
            &js("$1 $2"),
        );
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.])(\s*वाजता(?![\p{L}\p{M}]))?",
                "gu"
            ),
            |m, full| {
                let h = js_number(&m.group(1, full).unwrap_or_default());
                let min = js_number(&m.group(2, full).unwrap_or_default());
                let body = clock(h, min);
                if min != 0.0 {
                    return js(&body);
                }
                let rest = full.slice(m.end() as isize, None);
                if m.group(3, full).is_some() || !js_re!(r"^\s*वाज", "u").test(&rest) {
                    js(&format!("{body} {}", def.clock.oclock))
                } else {
                    js(&body)
                }
            },
        );
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d.,:])(?=\s*(?:GMT|UTC|यूटीसी|जीएमटी))",
                "gu"
            ),
            |m, full| {
                js(&clock(
                    js_number(&m.group(1, full).unwrap_or_default()),
                    js_number(&m.group(2, full).unwrap_or_default()),
                ))
            },
        );

        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?(?:C|से\.?)(?![\p{L}\p{M}])", "giu"),
            &js(&format!("$1 {} {}", deg.word, deg.celsius)),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "giu"),
            &js(&format!("$1 {} {}", deg.word, deg.fahrenheit)),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?N(?![\p{L}\p{M}])", "gu"),
            &js(&format!("$1 {} {}", deg.word, deg.north)),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?S(?![\p{L}\p{M}])", "gu"),
            &js(&format!("$1 {} {}", deg.word, deg.south)),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?E(?![\p{L}\p{M}])", "gu"),
            &js(&format!("$1 {} {}", deg.word, deg.east)),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?W(?![\p{L}\p{M}])", "gu"),
            &js(&format!("$1 {} {}", deg.word, deg.west)),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°", "gu"),
            &js(&format!("$1 {}", deg.word)),
        );

        s = rewrite_with(
            &s,
            js_re!(r"(\d+(?:[.,]\d+)*)\s?[%٪％]", "gu"),
            |m, full| {
                let n = m.group(1, full).unwrap_or_default();
                let one = js_number(&js_re!(",", "g").replace(&n, &JsString::new())) == 1.0;
                let p = &def.percent;
                n.concat(&js(&format!(
                    " {}",
                    if one { &p.singular } else { &p.plural }
                )))
            },
        );

        // `${n}${mag ?? ""} ${CURRENCY[sign]!}`: a sign the manifest lacks templates as "undefined".
        s = rewrite_with(&s, &currency_re, |m, full| {
            let sign = m.group(1, full).unwrap_or_default().to_string_lossy();
            let noun = def.currency.get(&sign).map_or("undefined", String::as_str);
            m.group(2, full)
                .unwrap_or_default()
                .concat(&m.group(3, full).unwrap_or_default())
                .concat(&js(&format!(" {noun}")))
        });

        s = rewrite_with(&s, &unit_re, |m, full| {
            let u = m.group(2, full).unwrap_or_default().to_string_lossy();
            let word = def.unit_words.get(&u).map_or("undefined", String::as_str);
            m.group(1, full)
                .unwrap_or_default()
                .concat(&js(&format!(" {word}")))
        });

        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d.,])(\d+(?:\.\d+)?)\s?[-–—]\s?(\d+(?:\.\d+)?)(?![\d.,])",
                "gu"
            ),
            |m, full| {
                let a = m.group(1, full).unwrap_or_default();
                let b = m.group(2, full).unwrap_or_default();
                if js_number(&b) > js_number(&a) {
                    a.concat(&js(&format!(" {} ", def.range_word))).concat(&b)
                } else {
                    m.value(full)
                }
            },
        );

        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d/]|\d\.|\d,(?=\d{3}\/))(\d{1,3})\/(\d{1,3})(?![\d/]|\.\d|,(?:\d{3}(?!\d)|\d{2},\d))",
                "gu"
            ),
            |m, full| {
                let num = js_number(&m.group(1, full).unwrap_or_default());
                let den = js_number(&m.group(2, full).unwrap_or_default());
                if num == 1.0 && den == 2.0 {
                    return js(&frac.half);
                }
                if num == 1.0 && den == 4.0 {
                    return js(&frac.quarter);
                }
                if num == 3.0 && den == 4.0 {
                    return js(&frac.three_quarters);
                }
                let (nw, dw) = (cardinal_text(num), cardinal_text(den));
                if nw.is_empty() || dw.is_empty() {
                    m.value(full)
                } else {
                    js(&format!("{nw} {} {dw}", frac.divided_by))
                }
            },
        );

        s = rewrite(
            &s,
            js_re!(r"(?<![\d,.\-–—])100(?![\d,.\-–—])(?!\s*[A-Za-z])", "gu"),
            &js(&def.bare_hundred),
        );

        s = rewrite(
            &s,
            js_re!(r"\+\s?(?=\d)", "gu"),
            &js(&format!(" {} ", sign.plus)),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\p{Nd}])−\s?(?=\d)", "gu"),
            &js(&format!(" {} ", sign.minus)),
        );
        s = rewrite(
            &s,
            js_re!(r"~\s?(?=\d)", "gu"),
            &js(&format!(" {} ", sign.approximately)),
        );

        s = rewrite(
            &s,
            js_re!("±", "gu"),
            &js(&format!(" {} ", sign.plus_minus)),
        );
        s = postposed_sign(&s, "<", &js(&sign.less_than));
        s = postposed_sign(&s, ">", &js(&sign.greater_than));
        s = postposed_sign(&s, "÷", &js(&sign.divide));
        s = rewrite(
            &s,
            js_re!(r"\s?=\s?", "gu"),
            &js(&format!(" {} ", sign.equals)),
        );
        s = rewrite(&s, js_re!(r" {2,}", "gu"), &js(" "));
        Ok(s)
    }))
}
