//! The generic Brahmic-abugida grapheme-to-phoneme interpreter: consonant + inherent vowel, matras, virama,
//! independent vowels, nukta composition and the combining signs, all driven by a language's JSONC definition.
//! Ported from src/core/abugida.ts — see that file for the corpus evidence.

use std::collections::HashMap;

use indexmap::IndexMap;
use serde::Deserialize;

use super::js_string::{JsString, js};
use super::phonology::Phonology;
use super::provenance::{Form, normalize};
use crate::js_re;

#[derive(Debug, Deserialize, Clone)]
pub struct Ipa {
    pub ipa: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SignChar {
    pub char: String,
    pub effect: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AbugidaSigns {
    pub virama: SignChar,
    pub anusvara: SignChar,
    pub chandrabindu: SignChar,
    pub visarga: SignChar,
    pub nukta: SignChar,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AbugidaDef {
    pub language: String,
    pub inherent_vowel: String,
    pub consonants: IndexMap<String, Ipa>,
    pub independent_vowels: IndexMap<String, Ipa>,
    pub vowel_signs: IndexMap<String, Ipa>,
    pub signs: AbugidaSigns,
    pub nasal_vowels_are_short: Option<bool>,
}

/// `makeAbugidaG2P(def, phon)`'s closure state. `g2p` leaves inherent vowels intact; the caller deletes schwa.
pub struct AbugidaG2p {
    c: HashMap<JsString, JsString>,
    iv: HashMap<JsString, JsString>,
    vs: HashMap<JsString, JsString>,
    /// Longest key first, a STABLE sort (ties keep the file's order), as the TS `sort` is.
    place_keys: Vec<(JsString, JsString)>,
    homorganic: HashMap<JsString, JsString>,
    vir: JsString,
    an: JsString,
    ch: JsString,
    vis: JsString,
    nk: JsString,
    inh: JsString,
    nasal_short: bool,
    ch_homorganic: bool,
}

fn table(m: &IndexMap<String, Ipa>) -> HashMap<JsString, JsString> {
    m.iter().map(|(k, v)| (js(k), js(&v.ipa))).collect()
}

pub fn make_abugida_g2p(def: &AbugidaDef, phon: &Phonology) -> AbugidaG2p {
    let mut place_keys: Vec<(JsString, JsString)> = phon
        .place_of_articulation
        .iter()
        .map(|(k, v)| (js(k), js(v)))
        .collect();
    place_keys.sort_by(|a, b| b.0.len().cmp(&a.0.len()));
    AbugidaG2p {
        c: table(&def.consonants),
        iv: table(&def.independent_vowels),
        vs: table(&def.vowel_signs),
        place_keys,
        homorganic: phon
            .homorganic_nasal
            .iter()
            .map(|(k, v)| (js(k), js(v)))
            .collect(),
        vir: js(&def.signs.virama.char),
        an: js(&def.signs.anusvara.char),
        ch: js(&def.signs.chandrabindu.char),
        vis: js(&def.signs.visarga.char),
        nk: js(&def.signs.nukta.char),
        inh: js(&def.inherent_vowel),
        nasal_short: def.nasal_vowels_are_short.unwrap_or(true),
        ch_homorganic: def.signs.chandrabindu.effect.as_deref() == Some("nasalizeVowelHomorganic"),
    }
}

impl AbugidaG2p {
    fn place(&self, ipa: &JsString) -> JsString {
        for (k, v) in &self.place_keys {
            if ipa.starts_with(k) {
                return v.clone();
            }
        }
        JsString::new()
    }

    fn nasalize(&self, out: &mut JsString) {
        if self.nasal_short {
            *out = js_re!("ː$").replace(out, &JsString::new());
        }
        if !js_re!("̃").test(&out.slice(-2, None)) {
            out.push_str(&js("̃"));
        }
    }

    fn signs(&self, s: &[JsString], i: &mut usize, out: &mut JsString) {
        while *i < s.len() && (s[*i] == self.an || s[*i] == self.ch || s[*i] == self.vis) {
            if s[*i] == self.vis {
                out.push_str(&js("h"));
            } else {
                self.nasalize(out);
                if s[*i] == self.an || (s[*i] == self.ch && self.ch_homorganic) {
                    let nc = s.get(*i + 1).and_then(|nx| {
                        self.c
                            .get(nx)
                            .cloned()
                            .or_else(|| self.c.get(&nx.concat(&self.nk)).cloned())
                    });
                    if let Some(nc) = nc.filter(|n| !n.is_empty()) {
                        if let Some(hn) = self.homorganic.get(&self.place(&nc)) {
                            out.push_str(hn);
                        }
                    }
                }
            }
            *i += 1;
        }
    }

    /// `g2p(word)`.
    pub fn g2p(&self, word: &JsString) -> JsString {
        let s = normalize(word, Form::Nfc).code_point_strings();
        let mut out = JsString::new();
        let mut i = 0;
        while i < s.len() {
            let mut ch = s[i].clone();
            if i + 1 < s.len() && s[i + 1] == self.nk && self.c.contains_key(&ch.concat(&self.nk)) {
                ch = ch.concat(&self.nk);
                i += 1;
            }
            if let Some(ipa) = self.c.get(&ch) {
                out.push_str(ipa);
                i += 1;
                if s.get(i) == Some(&self.vir) {
                    i += 1;
                } else if let Some(v) = s.get(i).and_then(|x| self.vs.get(x)) {
                    out.push_str(v);
                    i += 1;
                    self.signs(&s, &mut i, &mut out);
                } else {
                    out.push_str(&self.inh);
                    self.signs(&s, &mut i, &mut out);
                }
            } else if let Some(ipa) = self.iv.get(&ch) {
                out.push_str(ipa);
                i += 1;
                self.signs(&s, &mut i, &mut out);
            } else {
                i += 1;
            }
        }
        out
    }
}
