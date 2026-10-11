//! Standard Malay (ms/zsm): the Indonesian engine behind a Malay normalization pre-pass.
//! Ported from src/languages/malay/malay.ts — see that file for the corpus evidence.

use super::normalize::normalize_malay;
use crate::core::foreign::ForeignPhonemizer;
use crate::core::js_string::JsString;
use crate::languages::indonesian::indonesian::{IndonesianPhonemizer, create_indonesian};
use crate::registry::{Engine, PhonemizeError};

/// The Malay engine (`createMalay`): the Indonesian engine, with the foreign reader threaded through.
pub struct MalayPhonemizer {
    inner: IndonesianPhonemizer,
}

impl MalayPhonemizer {
    /// `normalizeMalay(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_malay(text)
    }

    /// The Indonesian engine this one wraps.
    pub fn inner(&self) -> &IndonesianPhonemizer {
        &self.inner
    }

    /// Malay conventions first, then the Indonesian engine's own `text()`.
    pub fn text(&self, input: &JsString) -> JsString {
        self.inner.text(&normalize_malay(input))
    }
}

impl Engine for MalayPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(MalayPhonemizer::text(self, input))
    }
}

/// `createMalay(foreign)`.
pub fn create_malay(foreign: Option<ForeignPhonemizer>) -> Result<MalayPhonemizer, String> {
    Ok(MalayPhonemizer {
        inner: create_indonesian(foreign)?,
    })
}
