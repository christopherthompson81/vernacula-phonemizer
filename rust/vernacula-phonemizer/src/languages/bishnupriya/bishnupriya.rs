//! Native Bishnupriya Manipuri phonemizer: the Bengali maker driven by `bishnupriya.jsonc` (Bengali phoneme values,
//! no height harmony), with nothing of its own.
//! Ported from src/languages/bishnupriya/bishnupriya.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use crate::core::js_string::JsString;
use crate::core::phonology::load_shared_phonology;
use crate::languages::bengali::bengali::{ForeignPhonemizer, NativeBengali, make_native_bengali};
use crate::languages::bengali::manifest::{BengaliDef, load_bengali_def};
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// `createBishnupriya(foreign)`.
pub fn create_bishnupriya(foreign: Option<ForeignPhonemizer>) -> Result<Bishnupriya, String> {
    static DEF: OnceLock<BengaliDef> = OnceLock::new();
    Ok(Bishnupriya(make_native_bengali(
        load_bengali_def(&DEF, "bishnupriya")?,
        load_shared_phonology()?,
        foreign,
    )?))
}

/// The maker's phonemizer, as `createBishnupriya` returns it.
pub struct Bishnupriya(pub NativeBengali);

impl Engine for Bishnupriya {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        self.0.text(input, None)
    }
}

/// The registry's `bpy` arm: `createBishnupriya(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_bishnupriya(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    // Every call test/bishnupriya.test.ts makes into the engine, with the value the TS returned, extracted
    // MECHANICALLY (the suite run under a recording vitest shim that also checked every matcher: all green), so each
    // of the suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["সাত"], Some("ʃat̪")),
    ("phonemizeWord", &["সমুদ্র"], Some("ʃɔmud̪ɾo")),
    ("phonemizeWord", &["বিশ"], Some("biʃ")),
    ("phonemizeWord", &["চার"], Some("t͡ʃaɾ")),
    ("phonemizeWord", &["হাজার"], Some("ɦad͡ʒaɾ")),
    ("phonemizeWord", &["আট"], Some("aʈ")),
    ("phonemizeWord", &["তিন"], Some("t̪in")),
    ("phonemizeWord", &["দশ"], Some("d̪ɔʃ")),
    ("phonemizeWord", &["খরগোশ"], Some("kʰɔɾɡoʃ")),
    ("phonemizeWord", &["পাহাড়"], Some("paɦaɽ")),
    ("phonemizeWord", &["নৌকা"], Some("nouka")),
    ("getPhonemizer(\"bpy\").text", &["আট"], Some("aʈ")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_bishnupriya(None).unwrap();
        let mut n = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.0.word(&js(args[0]), None).to_string_lossy(),
                "getPhonemizer(\"bpy\").text" => crate::registry::phonemize_in("bpy", &js(args[0]))
                    .unwrap()
                    .to_string_lossy(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            n += 1;
        }
        assert_eq!(n, 12);
    }
}
