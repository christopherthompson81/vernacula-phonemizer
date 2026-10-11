//! Modern Greek (el) phonemizer: the context-sensitive left-to-right scan (velar palatalisation, the voiced-stop
//! and γ-nasal digraphs, αυ/ευ and σ voicing, synizesis, double-consonant simplification), the synizesis
//! lexicon, and `text()`. Ported from src/languages/greek/greek.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};

use super::manifest::{DIR, GreekManifest, try_manifest};
use super::normalize::{NormalizeData, normalize_data};
use super::numbers::number_to_words_with;

type Map = HashMap<JsString, JsString>;

/// Everything greek.ts builds from the manifest at module load.
pub(crate) struct Tables {
    v: Map,
    vd: Map,
    c: Map,
    cd: Map,
    pal: Map,
    tonos: Map,
    stressed: HashSet<JsString>,
    voiceless: HashSet<JsString>,
    syn_pal: Map,
    au_voiced: HashSet<JsString>,
    sigma_voiced: HashSet<JsString>,
}

fn map(m: &indexmap::IndexMap<String, String>) -> Map {
    m.iter().map(|(k, v)| (js(k), js(v))).collect()
}

fn set(v: &[String]) -> HashSet<JsString> {
    v.iter().map(|s| js(s)).collect()
}

pub(crate) fn tables() -> Result<&'static Tables, String> {
    static T: OnceLock<Tables> = OnceLock::new();
    let m = try_manifest()?;
    load_once(&T, || {
        let mut syn_pal = map(&m.synizesis_palatal);
        for k in ["κ", "γ", "χ"] {
            syn_pal.insert(js(k), js(&m.palatal[k]));
        }
        Ok(Tables {
            v: map(&m.vowels),
            vd: map(&m.vowel_digraphs),
            c: map(&m.consonants),
            cd: map(&m.consonant_digraphs),
            pal: map(&m.palatal),
            tonos: map(&m.tonos),
            stressed: m.tonos.keys().map(|k| js(k)).collect(),
            voiceless: set(&m.voiceless),
            syn_pal,
            au_voiced: set(&m.au_voiced),
            sigma_voiced: set(&m.sigma_voiced),
        })
    })
}

/// `greek-synizesis.tsv`'s keys (optional, as in the TS).
fn lexicon() -> Result<&'static HashSet<JsString>, String> {
    static L: OnceLock<HashSet<JsString>> = OnceLock::new();
    load_once(&L, || {
        Ok(load_tsv_strings(
            DIR,
            "greek-synizesis.tsv",
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())?
        .into_keys()
        .collect())
    })
}

/// The tonos-stripped word as UTF-16 units, read the way the TS reads `w`: `w[i]` and `w.slice` by unit.
struct Word<'a> {
    t: &'a Tables,
    w: Vec<u16>,
    /// Per UTF-16 unit, as `w` is indexed. A missing index reads as unstressed (`undefined`).
    stressed: Vec<bool>,
}

impl Word<'_> {
    fn slice(&self, a: usize, b: usize) -> JsString {
        let n = self.w.len();
        JsString::from_units(&self.w[a.min(n)..b.min(n)])
    }

    /// `w[i]`: one unit, or `None` past the end.
    fn at(&self, i: usize) -> Option<JsString> {
        self.w.get(i).map(|&u| JsString::from_units(&[u]))
    }

    fn is_stressed(&self, p: usize) -> bool {
        self.stressed.get(p).copied().unwrap_or(false)
    }

    fn get<'m>(m: &'m Map, k: &Option<JsString>) -> Option<&'m JsString> {
        k.as_ref().and_then(|k| m.get(k))
    }

    /// `matchVowel(w, i)`: digraph first.
    fn match_vowel(&self, i: usize) -> Option<(usize, JsString)> {
        if let Some(s) = self.t.vd.get(&self.slice(i, i + 2)) {
            return Some((2, s.clone()));
        }
        Self::get(&self.t.v, &self.at(i)).map(|s| (1, s.clone()))
    }

    /// `matchV`: a tonos on the first element of a would-be digraph is hiatus.
    fn match_v(&self, p: usize) -> Option<(usize, JsString)> {
        let m = self.match_vowel(p);
        if let Some((2, _)) = &m
            && self.is_stressed(p)
            && let Some(s) = Self::get(&self.t.v, &self.at(p))
        {
            return Some((1, s.clone()));
        }
        m
    }

    fn front(&self, p: usize) -> bool {
        self.match_v(p)
            .is_some_and(|(_, s)| s == js("e") || s == js("i"))
    }

    fn unstressed_i(&self, p: usize) -> Option<(usize, JsString)> {
        let m = self.match_v(p)?;
        if m.1 != js("i") {
            return None;
        }
        if (0..m.0).any(|k| self.is_stressed(p + k)) {
            return None;
        }
        Some(m)
    }
}

fn is_cons(t: &Tables, ch: &JsString) -> bool {
    t.c.contains_key(ch) && *ch != js("ς")
}

/// `scan(word, forceSyn)`.
fn scan(t: &Tables, word: &JsString, force_syn: bool) -> JsString {
    let raw = word.to_lower_case();
    let units: Vec<JsString> = raw.0.iter().map(|&u| JsString::from_units(&[u])).collect();
    let stressed: Vec<bool> = units.iter().map(|c| t.stressed.contains(c)).collect();
    let mut w = JsString::new();
    for c in &units {
        w.push_str(t.tonos.get(c).unwrap_or(c));
    }
    let wd = Word {
        t,
        w: w.0,
        stressed,
    };
    let n = wd.w.len();
    let mut out = JsString::new();
    let mut i = 0;
    let s = |x: &str| js(x);

    while i < n {
        let ch = wd.at(i).unwrap();
        let two = wd.slice(i, i + 2);
        if two == s("γγ") || two == s("γκ") || two == s("γχ") || two == s("γξ") {
            let nasal = if two == s("γκ") && i == 0 { "" } else { "ŋ" };
            let pal = if wd.front(i + 2) {
                t.pal.get(&two)
            } else {
                None
            };
            out.push_str(&s(nasal));
            out.push_str(pal.unwrap_or(&t.cd[&two]));
            i += 2;
            continue;
        }
        let after_mp_nt = wd.at(i + 2);
        if (two == s("μπ") || two == s("ντ"))
            && (wd.match_vowel(i + 2).is_some()
                || after_mp_nt == Some(s("ρ"))
                || after_mp_nt == Some(s("λ")))
        {
            if i != 0 {
                out.push_str(&t.c[&wd.slice(i, i + 1)]);
            }
            out.push_str(&t.cd[&two]);
            i += 2;
            continue;
        }
        if two == s("τσ") || two == s("τζ") {
            out.push_str(&t.cd[&two]);
            i += 2;
            continue;
        }
        if Some(&ch) == wd.at(i + 1).as_ref() && is_cons(t, &ch) {
            i += 1;
            continue;
        }
        if (two == s("αυ") || two == s("ευ")) && !wd.is_stressed(i) {
            let nx2 = wd.slice(i + 2, i + 4);
            let nx1 = wd.at(i + 2);
            let voiced = i + 2 >= n
                || t.au_voiced.contains(&nx2)
                || nx1
                    .as_ref()
                    .is_some_and(|x| t.au_voiced.contains(x) || wd.match_vowel(i + 2).is_some());
            out.push_str(&s(if two == s("αυ") { "a" } else { "e" }));
            out.push_str(&s(if voiced { "v" } else { "f" }));
            i += 2;
            continue;
        }
        let vm = wd.match_v(i);
        if let Some((2, ph)) = &vm {
            out.push_str(ph);
            i += 2;
            continue;
        }
        if let Some(cph) = t.c.get(&ch) {
            if let Some(iv) = wd.unstressed_i(i + 1)
                && let Some(nv) = wd.match_v(i + 1 + iv.0)
                && ((0..nv.0).any(|k| wd.is_stressed(i + 1 + iv.0 + k)) || force_syn)
            {
                match t.syn_pal.get(&ch) {
                    Some(p) => out.push_str(p),
                    None => {
                        out.push_str(cph);
                        out.push_str(&s(if t.voiceless.contains(&ch) {
                            "ç"
                        } else {
                            "ʝ"
                        }));
                    }
                }
                i += 1 + iv.0;
                continue;
            }
            if (ch == s("κ") || ch == s("γ") || ch == s("χ")) && wd.front(i + 1) {
                out.push_str(&t.pal[&ch]);
                i += 1;
                continue;
            }
            if ch == s("σ") {
                let n1 = wd.at(i + 1);
                let z = t.sigma_voiced.contains(&wd.slice(i + 1, i + 3))
                    || n1.as_ref().is_some_and(|x| t.sigma_voiced.contains(x));
                out.push_str(&s(if z { "z" } else { "s" }));
                i += 1;
                continue;
            }
            out.push_str(cph);
            i += 1;
            continue;
        }
        if let Some((_, ph)) = &vm {
            out.push_str(ph);
            i += 1;
            continue;
        }
        i += 1;
    }
    out
}

/// `phonemizeWord`: the SHIPPED path (synizesis lexicon → rule engine). Errs only if the data cannot be loaded.
pub fn phonemize_word(word: &JsString) -> Result<JsString, String> {
    Ok(word_ipa(tables()?, lexicon()?, word))
}

/// `phonemizeWordRules`: the rule engine only (no lexicon).
pub fn phonemize_word_rules(word: &JsString) -> Result<JsString, String> {
    Ok(scan(tables()?, word, false))
}

/// `phonemizeWordForced`: synizesis forced at every site.
pub fn phonemize_word_forced(word: &JsString) -> Result<JsString, String> {
    Ok(scan(tables()?, word, true))
}

fn word_ipa(t: &Tables, lex: &HashSet<JsString>, word: &JsString) -> JsString {
    scan(t, word, lex.contains(&word.to_lower_case()))
}

pub struct GreekPhonemizer {
    m: &'static GreekManifest,
    tables: &'static Tables,
    lexicon: &'static HashSet<JsString>,
    norm: &'static NormalizeData,
    token: JsRegex,
    clause_mark: Map,
}

impl GreekPhonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.norm.normalize(input);
        assemble_clauses(&normalized, &self.token, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&word_ipa(self.tables, self.lexicon, &w));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                let words = number_to_words_with(&self.m.numbers, js_number(&d), Some(&d));
                for wd in words.split(&js(" ")) {
                    sink.emit(&word_ipa(self.tables, self.lexicon, &wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = self.clause_mark.get(&p).filter(|mk| !mk.is_empty())
            {
                sink.pause(mk);
            }
        })
    }
}

/// Build the Modern Greek phonemizer. Every table and pattern built from the data is built and validated
/// HERE, so a bad manifest is an error now and `text()` cannot panic later.
pub fn create_greek() -> Result<GreekPhonemizer, String> {
    let m = try_manifest()?;
    Ok(GreekPhonemizer {
        m,
        tables: tables()?,
        lexicon: lexicon()?,
        norm: normalize_data()?,
        token: JsRegex::new(r"([Ͱ-Ͽἀ-῿]+)|(\d+)|([.!;?…,:·])", "gu").map_err(|e| e.to_string())?,
        clause_mark: map(&m.clause_punctuation),
    })
}

impl crate::registry::Engine for GreekPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, crate::registry::PhonemizeError> {
        Ok(GreekPhonemizer::text(self, input))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Expectations are the TS engine's outputs (.probe/el/check.mts), not hand-derived IPA.
    #[test]
    fn a_tonos_marks_hiatus_and_an_unstressed_i_before_a_stressed_vowel_synizes() {
        assert_eq!(phonemize_word(&js("τσάι")).unwrap(), js("t͡sai"));
        assert_eq!(phonemize_word(&js("ρολόι")).unwrap(), js("ɾoloi"));
        assert_eq!(phonemize_word(&js("κοιλιά")).unwrap(), js("ciʎa"));
        assert_eq!(phonemize_word(&js("ΣΟΦΟΣ")).unwrap(), js("sofos"));
    }

    #[test]
    fn the_ano_teleia_is_a_pause_in_either_codepoint() {
        let say = |s: &str| crate::phonemize(s, "el").unwrap();
        assert_eq!(say("Ήρθε\u{0387} έφυγε."), "iɾθe , efiʝe .");
        assert_eq!(say("Ήρθε\u{00b7} έφυγε."), "iɾθe , efiʝe .");
    }

    // #1510 — ported from test/greek.test.ts's "greek port findings (#1510)" block.
    fn words(n: f64) -> String {
        crate::languages::greek::numbers::number_to_words(n, None)
            .unwrap()
            .to_string_lossy()
    }

    #[test]
    fn teens_are_lexical_words() {
        assert_eq!(words(10.0), "δέκα");
        assert_eq!(words(11.0), "έντεκα");
        assert_eq!(words(12.0), "δώδεκα");
        assert_eq!(words(13.0), "δεκατρία");
        assert_eq!(words(19.0), "δεκαεννέα");
        assert_eq!(words(2016.0), "δύο χιλιάδες δεκαέξι");
        assert_eq!(words(11000.0), "έντεκα χιλιάδες");
        assert_eq!(words(13000.0), "δεκατρείς χιλιάδες");
        assert_eq!(words(14000.0), "δεκατέσσερις χιλιάδες");
        assert_eq!(words(13_000_000.0), "δεκατρία εκατομμύρια");
        let say = |s: &str| crate::phonemize(s, "el").unwrap();
        assert_eq!(say("Ήρθαν 11 άτομα."), "iɾθan endeka atoma .");
    }

    #[test]
    fn hundred_takes_nu_before_a_remainder() {
        assert_eq!(words(100.0), "εκατό");
        assert_eq!(words(101.0), "εκατόν ένα");
        assert_eq!(words(111.0), "εκατόν έντεκα");
        assert_eq!(words(199.0), "εκατόν ενενήντα εννέα");
        assert_eq!(words(101_000.0), "εκατόν μία χιλιάδες");
        assert_eq!(words(100_000.0), "εκατό χιλιάδες");
        assert_eq!(words(201.0), "διακόσια ένα");
    }

    #[test]
    fn the_greek_question_mark_is_the_question_pause() {
        let say = |s: &str| crate::phonemize(s, "el").unwrap();
        assert_eq!(say("Τι κάνεις\u{037e} Καλά."), say("Τι κάνεις; Καλά."));
        assert_eq!(say("Τι κάνεις\u{037e} Καλά."), "ti kanis ? kala .");
    }

    #[test]
    fn decomposed_input_reads_as_the_composed_word() {
        use unicode_normalization::UnicodeNormalization;
        let say = |s: &str| crate::phonemize(s, "el").unwrap();
        for w in ["τσάι", "κοιλιά", "ρολόι", "Ήρθε\u{0387} έφυγε."] {
            assert_eq!(say(&w.nfd().collect::<String>()), say(w));
        }
        assert_eq!(say(&"τσάι".nfd().collect::<String>()), "t͡sai");
    }

    #[test]
    fn polytonic_letters_fold_to_monotonic() {
        let say = |s: &str| crate::phonemize(s, "el").unwrap();
        assert_eq!(say("\u{1f00}ρχή"), say("αρχή"));
        let polytonic = "\u{1f29} \u{1f00}ρχή τ\u{03bf}\u{1fe6} λόγου.";
        assert_eq!(say(polytonic), say("Η αρχή του λόγου."));
        assert_eq!(
            say("\u{1fe5}ήτωρ \u{1fa0}δή \u{1f08}θ\u{1fc6}ναι"),
            say("ρήτωρ ωδή Αθήναι")
        );
        assert_eq!(say(polytonic), "i aɾçi tu loɣu .");
        let norm = crate::languages::greek::normalize::normalize_greek(&js("καφέ à")).unwrap();
        assert_eq!(norm, js("καφέ à"));
    }

    #[test]
    fn digraph_readings_come_from_the_tables_unchanged() {
        let got: Vec<JsString> = [
            "άγγελος",
            "έλεγχος",
            "ελέγχει",
            "φθόγγος",
            "γκέι",
            "Σφίγξ",
            "μπίρα",
            "άντε",
            "τσέπη",
            "τζάκι",
            "κέικ",
        ]
        .iter()
        .map(|w| phonemize_word_rules(&js(w)).unwrap())
        .collect();
        let want: Vec<JsString> = [
            "aŋɟelos",
            "eleŋxos",
            "eleŋçi",
            "fθoŋɡos",
            "ɟei",
            "sfiŋks",
            "biɾa",
            "ande",
            "t͡sepi",
            "d͡zaci",
            "ceik",
        ]
        .iter()
        .map(|w| js(w))
        .collect();
        assert_eq!(got, want);
    }

    #[test]
    fn an_astral_character_does_not_desync_the_stress_marks() {
        assert_eq!(
            phonemize_word(&js("\u{1F600}τσάι")).unwrap(),
            phonemize_word(&js("τσάι")).unwrap()
        );
        assert_eq!(phonemize_word(&js("\u{1F600}ρολόι")).unwrap(), js("ɾoloi"));
    }
}
