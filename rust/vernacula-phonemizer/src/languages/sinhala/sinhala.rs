//! Sinhala phonemizer: the shared abugida G2P (sinhala.jsonc), then the homorganic anusvara (pre-rewritten to a
//! nasal-coda letter), geminate length, the inherent-vowel schwa alternation, coda ව as [w] and two-level stress.
//! Ported from src/languages/sinhala/sinhala.ts — see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::Arc;

use super::manifest::{SinhalaManifest, try_manifest};
use super::normalize::normalize_sinhala;
use super::numbers::number_to_words;
use crate::core::abugida::{AbugidaG2p, make_abugida_g2p};
use crate::core::clauses::assemble_clauses;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::phonology::load_shared_phonology;
use crate::core::unicode::fold_native_digits;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

fn vowel_g() -> &'static JsRegex {
    js_re!(r"aᶦ|aᶷ|aː|æː|iː|uː|eː|oː|[aæiueoə]", "gu")
}

/// `applySchwa(ipa)`: the first vowel keeps a short `a` unless it ends the word; every later short `a` is ə.
fn apply_schwa(ipa: &JsString) -> JsString {
    let mut out = JsString::new();
    let mut i = 0;
    for (vi, m) in vowel_g().match_all(ipa).iter().enumerate() {
        out.push_str(&ipa.slice(i as isize, Some(m.index() as isize)));
        let v = m.value(ipa);
        if v == js("a") {
            let at_end = m.index() + 1 == ipa.len();
            out.push_str(&js(if vi == 0 && !at_end { "a" } else { "ə" }));
        } else {
            out.push_str(&v);
        }
        i = m.end();
    }
    out.concat(&ipa.slice(i as isize, None))
}

pub struct SinhalaPhonemizer {
    def: &'static SinhalaManifest,
    g2p: AbugidaG2p,
    /// `NASAL_CODA`: each trigger letter → its nasal coda (a later class overwrites an earlier one).
    nasal_coda: HashMap<JsString, JsString>,
}

impl SinhalaPhonemizer {
    /// `anusvara(word)`: each ං rewritten to the homorganic nasal coda of the letter after it.
    fn anusvara(&self, word: &JsString) -> JsString {
        js_re!(r"ං(.?)", "gu").replace_with(word, |m, s| {
            let nxt = m.group(1, s).unwrap_or_default();
            let coda = self
                .nasal_coda
                .get(&nxt)
                .cloned()
                .unwrap_or_else(|| js(&self.def.anusvara.default));
            coda.concat(&nxt)
        })
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        let raw = self.g2p.g2p(&self.anusvara(word));
        let gem = js_re!(r"(t͡ʃ|d͡ʒ|t̪|d̪|ʂ|ʃ|[pbʈɖkɡmnŋɲlshjʋrf])\1", "gu").replace(&raw, &js("$1ː"));
        let mut ipa = apply_schwa(&gem);
        ipa = js_re!(r"ʋ(?![aæeiouəːᶦᶷ])", "gu").replace(&ipa, &js("w"));
        ipa = js_re!(r"ʋː[aə]?$", "u").replace(&ipa, &js("wː"));
        ipa = js_re!(r"ʋ[aə]?$", "u").replace(&ipa, &js("w"));
        let nuclei = vowel_g().match_all(&ipa);
        let mut out = JsString::new();
        let mut i = 0;
        for (vi, m) in nuclei.iter().enumerate() {
            out.push_str(&ipa.slice(i as isize, Some(m.index() as isize)));
            if vi == 0 {
                out.push_str(&js("ˈ"));
            } else if vi >= 2 && vi % 2 == 0 && vi != nuclei.len() - 1 {
                out.push_str(&js("ˌ"));
            }
            out.push_str(&m.value(&ipa));
            i = m.end();
        }
        out.concat(&ipa.slice(i as isize, None))
    }

    /// `normalizeSinhala(input)` alone (the per-module differential calls it).
    pub fn normalize(&self, input: &JsString) -> JsString {
        normalize_sinhala(input)
    }

    /// `text(input)`: the normalizer first, then this script's digits folded.
    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = fold_native_digits(&normalize_sinhala(input));
        assemble_clauses(
            &prepared,
            js_re!(r"([඀-෿]+)|(\d+)|([.!?…,;:])", "gu"),
            |m, s, sink| {
                if let Some(w) = m.group(1, s) {
                    sink.emit(&self.phonemize_word(&w));
                } else if let Some(d) = m.group(2, s) {
                    let words = number_to_words(js_number(&d), &self.def.numbers);
                    for wd in js(&words).split(&js(" ")) {
                        sink.emit(&self.phonemize_word(&wd));
                    }
                } else if let Some(p) = m.group(3, s)
                    && let Some(mk) = self.def.clause_punctuation.get(&p.to_string_lossy())
                    && !mk.is_empty()
                {
                    sink.pause(&js(mk));
                }
            },
        )
    }
}

/// `createSinhala()`.
pub fn create_sinhala() -> Result<SinhalaPhonemizer, String> {
    let def = try_manifest()?;
    let mut nasal_coda = HashMap::new();
    for cls in &def.anusvara.classes {
        for c in js(&cls.triggers).code_point_strings() {
            nasal_coda.insert(c, js(&cls.nasal));
        }
    }
    Ok(SinhalaPhonemizer {
        def,
        g2p: make_abugida_g2p(&def.abugida, load_shared_phonology()?),
        nasal_coda,
    })
}

impl Engine for SinhalaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SinhalaPhonemizer::text(self, input))
    }
}

/// The registry's `si` arm: `createSinhala()`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    Ok(Arc::new(create_sinhala().map_err(PhonemizeError::Data)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/sinhala.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["ගම"], Some("ɡˈamə")),
    ("phonemizeWord", &["මම"], Some("mˈamə")),
    ("phonemizeWord", &["ක"], Some("kˈə")),
    ("phonemizeWord", &["නම්"], Some("nˈam")),
    ("phonemizeWord", &["පාසල"], Some("pˈaːsələ")),
    ("phonemizeWord", &["අම්මා"], Some("ˈamːaː")),
    ("phonemizeWord", &["තාත්තා"], Some("t̪ˈaːt̪ːaː")),
    ("phonemizeWord", &["අඬනවා"], Some("ˈaᶯɖənˌəʋaː")),
    ("phonemizeWord", &["සිංහල"], Some("sˈiŋhələ")),
    ("phonemizeWord", &["සංචාරක"], Some("sˈaɲt͡ʃaːrˌəkə")),
    ("phonemizeWord", &["සංවිධාන"], Some("sˈamʋid̪ʰˌaːnə")),
    ("phonemizeWord", &["බව"], Some("bˈaw")),
    ("phonemizeWord", &["නිව්ටන්"], Some("nˈiwʈən")),
    ("phonemizeWord", &["කෘති"], Some("krˈut̪i")),
    ("phonemizeWord", &["අතර"], Some("ˈat̪ərə")),
    ("phonemizeWord", &["ඡායාරූප"], Some("t͡ʃhˈaːjaːrˌuːpə")),
    ("phonemize", &["5", "si"], Some("pˈahə")),
    ("phonemize", &["10", "si"], Some("d̪ˈahəjə")),
    ("phonemize", &["21", "si"], Some("ʋˈisiˌekə")),
    ("phonemize", &["100", "si"], Some("sˈijəjə")),
    ("phonemize", &["ක්\u{200d}රි", "si"], Some("krˈi")),
    ("phonemize", &["ශ්\u{200d}රී ලංකා", "si"], Some("srˈiː lˈaŋkaː")),
    ("phonemize", &["ප්\u{200d}රතිශතය", "si"], Some("prˈat̪isˌət̪əjə")),
    ("phonemize", &["ක්\u{200d}රි.ව. 1660", "si"], Some("krˈist̪u ʋˈarsə d̪ˈahəsə hˈajə sˈijəjə hˈæʈə")),
    ("phonemize", &["12.5", "si"], Some("d̪ˈoləhə d̪ˈasəmə pˈahə")),
    ("phonemize", &["2,400", "si"], Some("d̪ˈekə d̪ˈahəsə hˈat̪ərə sˈijəjə")),
    ("phonemize", &["0.25", "si"], Some("bˈind̪uw d̪ˈasəmə d̪ˈekə pˈahə")),
    ("phonemize", &["2007.04.25", "si"], Some("d̪ˈekə d̪ˈahəsə hˈat̪ə . hˈat̪ərə . ʋˈisipˌəhə")),
    ("phonemize", &["70%", "si"], Some("sˈijəjˌəʈə hˈæt̪ːæːw")),
    ("phonemize", &["$5", "si"], Some("ɖˈolər pˈahə")),
    ("phonemize", &["15 cm", "si"], Some("sˈenʈimˌiːʈər pˈahəlow")),
    ("phonemize", &["US$7 බිලියන", "si"], Some("ˈæmerˌikaːnu ɖˈolər bˈilijˌənə hˈat̪ə")),
    ("phonemize", &["20°C", "si"], Some("sˈelsijəs ˈaŋsəkə ʋˈisːə")),
    ("phonemize", &["75 ° F", "si"], Some("fˈærənhˌəjiʈ ˈaŋsəkə hˈæt̪ːæːpˌəhə")),
    ("phonemize", &["133 ⁰C", "si"], Some("sˈelsijəs ˈaŋsəkə sˈijəjə t̪ˈist̪unə")),
    ("phonemize", &["32°N", "si"], Some("ˈaŋsəkə t̪ˈisd̪ekə ˈut̪uru")),
    ("phonemize", &["(−5)", "si"], Some("rˈunə pˈahə")),
    ("phonemize", &["වයස 0 -5", "si"], Some("ʋˈajəsə bˈind̪uw pˈahə")),
    ("phonemize", &["උපත -1918", "si"], Some("ˈupət̪ə d̪ˈahəsə nˈaʋəjə sˈijəjə d̪ˈahəˌəʈə")),
    ("phonemize", &["120 km/h", "si"], Some("pˈæjəʈə kˈiloːmˌiːʈər sˈijəjə ʋˈisːə")),
    ("phonemize", &["35-40 km/h", "si"], Some("pˈæjəʈə kˈiloːmˌiːʈər t̪ˈispəhə hˈat̪əlˌihə")),
    ("phonemize", &["ක්\u{200d}රි.පූ. 29", "si"], Some("krˈist̪u pˈuːrw ʋˈisinˌəʋəjə")),
    ("phonemize", &["වර්ග කි.මී 65", "si"], Some("ʋˈarɡə kˈiloːmˌiːʈər hˈæʈəpˌəhə")),
    ("phonemize", &["ජේ.ආර්.ජයවර්ධන", "si"], Some("d͡ʒˈeː ˈaːr d͡ʒˈajəʋˌərd̪ʰənə")),
    ("phonemize", &["සිදු වේ.තව ද", "si"], Some("sˈid̪u ʋˈeː . t̪ˈaw d̪ˈə")),
    ("phonemizeWord", &["පංසු"], Some("pˈaŋsu")),
    ("phonemizeWord", &["අංශක"], Some("ˈaŋsəkə")),
    ("phonemizeWord", &["අක්ෂාංශ"], Some("ˈaksaːŋsə")),
    ("phonemize", &["ස්කන්ධයෙන් .9% ක්", "si"], Some("skˈand̪ʰəjen sˈijəjˌəʈə bˈind̪uw d̪ˈasəmə nˈaʋəjə k")),
    ("phonemize", &["ඇත.2011 සහ", "si"], Some("ˈæt̪ə . d̪ˈekə d̪ˈahəsə ˈekolˌəhə sˈahə")),
    ("phonemize", &["අවු.18 අඩු", "si"], Some("ˈaʋu . d̪ˈahəˌəʈə ˈaɖu")),
    ("phonemize", &["90 K", "si"], Some("kˈelʋin ˈanuːw")),
    ("phonemize", &["5K", "si"], Some("pˈahə kʰˈeᶦ")),
    ("phonemize", &["1990 K.M.", "si"], Some("d̪ˈahəsə nˈaʋəjə sˈijəjə ˈanuːw kʰˈeᶦ . ˈɛm .")),
    ("phonemize", &["ක්\u{200d}රි.ව.1940", "si"], Some("krˈist̪u ʋˈarsə d̪ˈahəsə nˈaʋəjə sˈijəjə hˈat̪əlˌihə")),
    ("phonemize", &["ක්\u{200d}රි.ව. 1940", "si"], Some("krˈist̪u ʋˈarsə d̪ˈahəsə nˈaʋəjə sˈijəjə hˈat̪əlˌihə")),
    ("phonemize", &["ලංකාවේ නගරයකි.මීගමුව", "si"], Some("lˈaŋkaːʋeː nˈaɡərˌəjəki . mˈiːɡəmuw")),
    ("phonemize", &["මෙය හැකි.මීටර් 400", "si"], Some("mˈejə hˈæki . mˈiːʈər hˈat̪ərə sˈijəjə")),
    ("phonemize", &["තරු. 500 ක්", "si"], Some("t̪ˈaru . pˈahə sˈijəjə k")),
    ("phonemize", &["ශක්\u{200d}රි.වචන", "si"], Some("sˈakri . ʋˈat͡ʃənə")),
    ("normalizeSinhala", &["ක්\u{200d}රි.පූ. 29"], Some("ක්රිස්තු පූර්ව 29")),
    ("normalizeSinhala", &["2.8 සෙ.මී. ඝන වානේ"], Some("2 දශම 8 සෙන්ටිමීටර් ඝන වානේ")),
    ("normalizeSinhala", &["පැයට කි.මී. 250 ක්"], Some("පැයට කිලෝමීටර් 250 ක්")),
    ("normalizeSinhala", &["ඇ.ඩො. මිලියන 7.4"], Some("ඇමෙරිකානු ඩොලර් මිලියන 7 දශම 4")),
    ("normalizeSinhala", &["රු. 500"], Some("රුපියල් 500")),
    ("phonemizeWord", &["ඖෂධය"], Some("ˈaᶷsəd̪ʰˌəjə")),
    ("phonemizeWord", &["පුරුෂ"], Some("pˈurusə")),
    ("phonemizeWord", &["විෂ්ණු"], Some("ʋˈisnu")),
    ("phonemizeWord", &["ශ්\u{200d}රී"], Some("srˈiː")),
    ("phonemizeWord", &["මිශ්\u{200d}ර"], Some("mˈisrə")),
    ("phonemizeWord", &["පස්ස"], Some("pˈasːə")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_sinhala().unwrap();
        let mut n = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "normalizeSinhala" => normalize_sinhala(&js(args[0])).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            n += 1;
        }
        assert_eq!(n, 71);
    }

    /// A Kannada, Telugu, Tamil, Malayalam or Sinhala run inside another host reaches its engine through the script
    /// reader. Readings are the TS engine's, printed by running it, not typed.
    #[test]
    fn group_scripts_inside_other_hosts_are_read_by_their_engines() {
        #[rustfmt::skip]
        let rows: &[(&str, &str, &str)] = &[
        ("I said ಕನ್ನಡ ಭಾಷೆ to them", "en", "aᶦ sˈɛd kˈanːaɖa bʱˈaːʂe tʰuː ðˈɛm"),
        ("I said తెలుగు భాష to them", "en", "aᶦ sˈɛd t̪ˈeluɡu bʱˈaːʂa tʰuː ðˈɛm"),
        ("I said தமிழ் மொழி to them", "en", "aᶦ sˈɛd t̪ˈɐmɪɻ mˈoɻɪ tʰuː ðˈɛm"),
        ("I said മലയാളം ഭാഷ to them", "en", "aᶦ sˈɛd mˈalajaːɭam bʱˈaːʂa tʰuː ðˈɛm"),
        ("I said සිංහල භාෂාව to them", "en", "aᶦ sˈɛd sˈiŋhələ bʰˈaːsaːw tʰuː ðˈɛm"),
        ("मैं தமிழ் कहता हूँ", "hi", "mˈɛː̃ t̪ˈɐmɪɻ kˈəɦt̪aː ɦˈuː̃"),
        ("मैं ಕನ್ನಡ कहता हूँ", "hi", "mˈɛː̃ kˈanːaɖa kˈəɦt̪aː ɦˈuː̃"),
        ("मैं සිංහල कहता हूँ", "hi", "mˈɛː̃ sˈiŋhələ kˈəɦt̪aː ɦˈuː̃"),
        ];
        for (text, lang, want) in rows {
            assert_eq!(crate::phonemize(text, lang).unwrap(), *want, "{text}");
        }
        let pending = crate::registry::port_pending();
        assert!(
            ["kn", "te", "ta", "ml", "si"]
                .iter()
                .all(|l| !pending.iter().any(|p| p == l)),
            "{pending:?}"
        );
    }
}
