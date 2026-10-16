//! Vietnamese (vi) phonemizer: normalize.ts, then the shared symbol tier, then a tokenizer over syllables, digit
//! runs and clause punctuation; a token that is no Vietnamese syllable goes to the foreign reader.
//! Ported from src/languages/vietnamese/vietnamese.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use super::g2p::{phonemize_syllable, try_rhymes};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::normalize_vietnamese;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::foreign::ForeignPhonemizer;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    ExponentWords, PositionDecl, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`.
pub fn phonemize_word(word: &JsString) -> JsString {
    phonemize_syllable(word)
}

/// `SYMBOLS`: the shared tier over the five `symbolTier` fields vietnamese.ts passes.
fn symbol_tier() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let t = &try_manifest()?.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            percent: Some(t.percent.clone()),
            currency: Some(t.currency.clone()),
            units: Some(t.units.clone()),
            exponent_words: Some(ExponentWords {
                squared: Some(t.exponent_words.squared.clone()),
                cubed: Some(t.exponent_words.cubed.clone()),
                position: t.exponent_words.position.map(PositionDecl::All),
            }),
            multiply: Some(t.multiply.clone()),
            ..Default::default()
        })
    })
}

pub struct VietnamesePhonemizer {
    foreign: Option<ForeignPhonemizer>,
    symbols: &'static SymbolNormalizer,
}

impl VietnamesePhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_vietnamese(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn number_words(&self, n: f64) -> JsString {
        number_to_words(n)
    }

    /// `text(input)`.
    pub fn text(&self, input: &JsString) -> JsString {
        let s = self.symbols.apply(&normalize_vietnamese(input));
        assemble_clauses(
            &s,
            js_re!(r"([a-zà-ỹăâđêôơưÀ-Ỹ̀-̣]+)|(\d+)|([.!?…,;:])", "giu"),
            |m, s, sink| {
                if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                    let ipa = phonemize_syllable(&w);
                    if !ipa.is_empty() {
                        sink.emit(&ipa);
                    } else if let Some(f) = &self.foreign {
                        sink.emit(&f(&w));
                    }
                } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                    for wd in number_to_words(js_number(&d)).split(&js(" ")) {
                        sink.emit(&phonemize_syllable(&wd));
                    }
                } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                    && let Some(mk) = MANIFEST
                        .clause_punctuation
                        .get(&p.to_string_lossy())
                        .filter(|mk| !mk.is_empty())
                {
                    sink.pause(&js(mk));
                }
            },
        )
    }
}

impl Engine for VietnamesePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(VietnamesePhonemizer::text(self, input))
    }
}

/// `createVietnamese(foreign)`. Loads the manifest, the rhyme table and the symbol tier up front, so a data
/// error surfaces here rather than mid-utterance.
pub fn create_vietnamese(
    foreign: Option<ForeignPhonemizer>,
) -> Result<VietnamesePhonemizer, String> {
    try_manifest()?;
    try_rhymes()?;
    Ok(VietnamesePhonemizer {
        foreign,
        symbols: symbol_tier()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/vietnamese.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["ma"], Some("mˈaː˧")),
        ("phonemizeWord", &["mà"], Some("mˈaː˨˩")),
        ("phonemizeWord", &["má"], Some("mˈaː˧˥")),
        ("phonemizeWord", &["mả"], Some("mˈaː˧˩˧")),
        ("phonemizeWord", &["mã"], Some("mˈaː˧ˀ˥")),
        ("phonemizeWord", &["mạ"], Some("mˈaː˨˩ˀ")),
        ("phonemizeWord", &["xin"], Some("sˈi˧n")),
        ("phonemizeWord", &["chào"], Some("t͡ɕˈaː˨˩w")),
        ("phonemizeWord", &["Việt"], Some("vˈiɛ˨˩ˀt̪")),
        ("phonemizeWord", &["một"], Some("mˈo˨˩ˀt̪")),
        ("phonemizeWord", &["người"], Some("ŋˈɨə˨˩j")),
        ("phonemizeWord", &["nước"], Some("nˈɨə˧˥k")),
        ("phonemizeWord", &["đi"], Some("ɗˈi˧")),
        ("phonemizeWord", &["biết"], Some("bˈiɛ˧˥t̪")),
        ("phonemizeWord", &["quả"], Some("kwˈaː˧˩˧")),
        ("phonemizeWord", &["giết"], Some("zˈiɛ˧˥t̪")),
        ("phonemizeWord", &["anh"], Some("ʔˈe˧ɲ")),
        ("phonemizeWord", &["đây"], Some("ɗˈə˧j")),
        ("phonemizeWord", &["thấy"], Some("tʰˈə˧˥j")),
        ("phonemizeWord", &["giây"], Some("zˈə˧j")),
        ("phonemizeWord", &["lầy"], Some("lˈə˨˩j")),
        ("phonemizeWord", &["ay"], Some("ʔˈa˧j")),
        ("phonemize", &["5", "vi"], Some("nˈa˧m")),
        ("phonemize", &["25", "vi"], Some("hˈaː˧j mˈɨə˧j lˈa˧m")),
        ("phonemize", &["21", "vi"], Some("hˈaː˧j mˈɨə˧j mˈo˧˥t̪")),
        (
            "phonemize",
            &["tại paris và sofia", "vi"],
            Some("t̪ˈaː˨˩ˀj pʰˈɛɹɪs vˈaː˨˩ soᶷfˈiːʲə"),
        ),
        (
            "phonemize",
            &["có 25 người", "vi"],
            Some("kˈɔ˧˥ hˈaː˧j mˈɨə˧j lˈa˧m ŋˈɨə˨˩j"),
        ),
        (
            "normalizeVietnamese",
            &["40.000 người"],
            Some("40000 người"),
        ),
        (
            "normalizeVietnamese",
            &["5.000.000 độc giả"],
            Some("5000000 độc giả"),
        ),
        (
            "phonemize",
            &["40.000 người", "vi"],
            Some("bˈo˧˥n mˈɨə˧j ŋˈi˨˩n ŋˈɨə˨˩j"),
        ),
        (
            "normalizeVietnamese",
            &["khoảng ¥130.000, với"],
            Some("khoảng ¥130000, với"),
        ),
        (
            "normalizeVietnamese",
            &["khoảng ¥7,000."],
            Some("khoảng ¥7000."),
        ),
        (
            "normalizeVietnamese",
            &["Chuẩn 802.11n"],
            Some("Chuẩn 802 chấm 11n"),
        ),
        (
            "normalizeVietnamese",
            &["14,7 tỷ USD"],
            Some("14 phẩy 7 tỷ u ét sì dê"),
        ),
        (
            "normalizeVietnamese",
            &["6,34 inch"],
            Some("6 phẩy 34 inch"),
        ),
        (
            "normalizeVietnamese",
            &["1.234,5 mét"],
            Some("1234 phẩy 5 mét"),
        ),
        (
            "normalizeVietnamese",
            &["tần số 2.4 Ghz"],
            Some("tần số 2 chấm 4 Ghz"),
        ),
        (
            "phonemize",
            &["2,3 tỷ đô", "vi"],
            Some("hˈaː˧j fˈə˧˩˧j bˈaː˧ t̪ˈi˧˩˧ ɗˈo˧"),
        ),
        (
            "normalizeVietnamese",
            &["khoảng 9:30 sáng"],
            Some("khoảng 9 giờ 30 sáng"),
        ),
        (
            "normalizeVietnamese",
            &["lúc 8:30 giờ tối"],
            Some("lúc 8 giờ 30 tối"),
        ),
        (
            "normalizeVietnamese",
            &["khoảng 12:00 giờ GMT"],
            Some("khoảng 12 giờ giê em mờ tê"),
        ),
        (
            "normalizeVietnamese",
            &["vào lúc 07:19 giờ sáng"],
            Some("vào lúc 7 giờ 19 sáng"),
        ),
        (
            "normalizeVietnamese",
            &["Vào lúc 11:20, cảnh sát"],
            Some("Vào lúc 11 giờ 20, cảnh sát"),
        ),
        (
            "normalizeVietnamese",
            &["khoảng 10:00 – 11:00 đêm"],
            Some("khoảng 10 giờ đến 11 giờ đêm"),
        ),
        (
            "normalizeVietnamese",
            &["tỷ số là 3:2"],
            Some("tỷ số là 3:2"),
        ),
        (
            "normalizeVietnamese",
            &["bằng hạng 2:2"],
            Some("bằng hạng 2:2"),
        ),
        (
            "normalizeVietnamese",
            &["thời gian 4:41,30, chậm hơn"],
            Some("thời gian 4 phút 41 giây 30, chậm hơn"),
        ),
        (
            "normalizeVietnamese",
            &["Hungary 1:09,02 phút."],
            Some("Hungary 1 phút 9 giây 2."),
        ),
        (
            "normalizeVietnamese",
            &["(100-200 dặm)"],
            Some("(100 đến 200 dặm)"),
        ),
        (
            "normalizeVietnamese",
            &["năm 1995-1996"],
            Some("năm 1995 đến 1996"),
        ),
        (
            "normalizeVietnamese",
            &["dày 2 – 3 km"],
            Some("dày 2 đến 3 km"),
        ),
        (
            "normalizeVietnamese",
            &["thắng 5-3 trước"],
            Some("thắng 5-3 trước"),
        ),
        ("normalizeVietnamese", &["tỷ số 6-6."], Some("tỷ số 6-6.")),
        (
            "normalizeVietnamese",
            &["21 - 20, chấm dứt"],
            Some("21 - 20, chấm dứt"),
        ),
        (
            "normalizeVietnamese",
            &["chiếm 783.562 km<sup>2</sup> ("],
            Some("chiếm 783562 km² ("),
        ),
        (
            "phonemize",
            &["diện tích 3.850 km²,", "vi"],
            Some(
                "zˈiɛ˨˩ˀn t̪ˈi˧˥k bˈaː˧ ŋˈi˨˩n t̪ˈaː˧˥m t͡ɕˈa˧m nˈa˧m mˈɨə˧j kˈi˧ lˈo˧ mˈɛ˧˥t̪ vˈuə˧ŋ ,",
            ),
        ),
        (
            "phonemize",
            &["(3136mm2 so với", "vi"],
            Some(
                "bˈaː˧ ŋˈi˨˩n mˈo˨˩ˀt̪ t͡ɕˈa˧m bˈaː˧ mˈɨə˧j sˈa˧˥w mˈi˧ lˈi˧ mˈɛ˧˥t̪ vˈuə˧ŋ sˈɔ˧ vˈəː˧˥j",
            ),
        ),
        (
            "normalizeVietnamese",
            &["khoảng 83 km/h và"],
            Some("khoảng 83 km/giờ và"),
        ),
        (
            "normalizeVietnamese",
            &["tối đa 40 mph (64 kph)"],
            Some("tối đa 40 dặm/giờ (64 km/giờ)"),
        ),
        (
            "normalizeVietnamese",
            &["thường trên +30°C."],
            Some("thường trên cộng 30 độ xê."),
        ),
        (
            "normalizeVietnamese",
            &["phía đông 35° Tây."],
            Some("phía đông 35 độ Tây."),
        ),
        (
            "phonemize",
            &["cao 4892 m", "vi"],
            Some("kˈaː˧w bˈo˧˥n ŋˈi˨˩n t̪ˈaː˧˥m t͡ɕˈa˧m t͡ɕˈi˧˥n mˈɨə˧j hˈaː˧j mˈɛ˧˥t̪"),
        ),
        (
            "phonemize",
            &["22 km", "vi"],
            Some("hˈaː˧j mˈɨə˧j hˈaː˧j kˈi˧ lˈo˧ mˈɛ˧˥t̪"),
        ),
        (
            "normalizeVietnamese",
            &["từ 1/4 sang 1/2 dặm"],
            Some("từ 1 phần 4 sang 1 phần 2 dặm"),
        ),
        (
            "normalizeVietnamese",
            &["cỡ 36 x 24 mm"],
            Some("cỡ 36 nhân 24 mm"),
        ),
        (
            "normalizeVietnamese",
            &["dạng 6x6 cm"],
            Some("dạng 6 nhân 6 cm"),
        ),
        ("normalizeVietnamese", &["và/hoặc"], Some("và/hoặc")),
        (
            "normalizeVietnamese",
            &["năm 356 TCN vì"],
            Some("năm 356 trước Công nguyên vì"),
        ),
        (
            "normalizeVietnamese",
            &["năm 1100 SCN."],
            Some("năm 1100 sau Công nguyên."),
        ),
        (
            "normalizeVietnamese",
            &["Tháng CNTT Đài Bắc"],
            Some("Tháng công nghệ thông tin Đài Bắc"),
        ),
        (
            "normalizeVietnamese",
            &["của FBI khi"],
            Some("của ép bê i khi"),
        ),
        (
            "normalizeVietnamese",
            &["giờ GMT, hôm nay"],
            Some("giờ giê em mờ tê, hôm nay"),
        ),
        (
            "phonemize",
            &["của FBI khi", "vi"],
            Some("kˈuə˧˩˧ ʔˈɛ˧˥p bˈe˧ ʔˈi˧ xˈi˧"),
        ),
        (
            "normalizeVietnamese",
            &["chuyến bay CG4684 của"],
            Some("chuyến bay CG4684 của"),
        ),
        (
            "normalizeVietnamese",
            &["HAI MƯƠI NGƯỜI"],
            Some("HAI MƯƠI NGƯỜI"),
        ),
        (
            "phonemize",
            &["thế kỷ XIX", "vi"],
            Some("tʰˈe˧˥ kˈi˧˩˧ mˈɨə˨˩j t͡ɕˈi˧˥n"),
        ),
        ("normalizeVietnamese", &["40.000"], Some("40000")),
        ("normalizeVietnamese", &["14,7"], Some("14 phẩy 7")),
        ("normalizeVietnamese", &["9:30"], Some("9 giờ 30")),
        (
            "normalizeVietnamese",
            &["4:41,30"],
            Some("4 phút 41 giây 30"),
        ),
        ("normalizeVietnamese", &["2.4"], Some("2 chấm 4")),
        ("normalizeVietnamese", &["100-200"], Some("100 đến 200")),
        ("normalizeVietnamese", &["1/4"], Some("1 phần 4")),
        ("normalizeVietnamese", &["36 x 24"], Some("36 nhân 24")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(phonemize_word(&a(0))),
                "normalizeVietnamese" => Some(normalize_vietnamese(&a(0))),
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
    /// `tools/provenance-poison.mts vi` reports 0 sites as well).
    #[test]
    fn vietnamese_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/vi.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/vi.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "vi").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}

/// #1589, as test/sea-defects-1589.test.ts: relational, so no IPA is typed. Synthetic probes.
#[cfg(all(test, feature = "vi"))]
mod defects_1589_tests {
    #[test]
    fn reads_as_its_spelled_form() {
        for (input, spelled) in [
            ("1000000000000", "một nghìn tỷ"),
            ("2500000000000", "hai nghìn năm trăm tỷ"),
            ("1000000005", "một tỷ không trăm linh năm"),
        ] {
            assert_eq!(
                crate::phonemize(input, "vi").unwrap(),
                crate::phonemize(spelled, "vi").unwrap(),
                "{input}"
            );
        }
    }
}
