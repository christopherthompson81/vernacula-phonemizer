//! Albanian cardinal numbers: fused round hundreds, the obligatory `e` connector between groups, `një mijë` with its
//! "one" kept, and the plural `milionë`/`miliardë` above one.
//! Ported from src/languages/albanian/numbers.ts — see that file for the sources.

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::js_re;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Magnitudes {
    pub thousand: String,
    pub million: String,
    pub million_plural: String,
    pub billion: String,
    pub billion_plural: String,
}

/// `AlbanianNumbers`: the `numbers` block of albanian.jsonc.
#[derive(Debug, Deserialize)]
pub struct AlbanianNumbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: IndexMap<String, String>,
    pub hundreds: Vec<String>,
    pub magnitudes: Magnitudes,
    pub connector: String,
}

/// The renderer `makeNumberToWords(N)` returns, over one numeral table.
pub struct NumberToWords {
    n: &'static AlbanianNumbers,
}

/// `makeNumberToWords(N)`.
pub fn make_number_to_words(n: &'static AlbanianNumbers) -> NumberToWords {
    NumberToWords { n }
}

impl NumberToWords {
    fn e(&self) -> String {
        format!(" {} ", self.n.connector)
    }

    fn with_rest(&self, head: String, r: u64) -> String {
        if r != 0 {
            format!("{head}{}{}", self.e(), self.compose(r))
        } else {
            head
        }
    }

    fn under_hundred(&self, n: u64) -> String {
        if n < 10 {
            return self.n.units[n as usize].clone();
        }
        if n < 20 {
            return self.n.teens[n as usize - 10].clone();
        }
        let (t, u) = (n / 10 * 10, n % 10);
        let tens = &self.n.tens[&t.to_string()];
        if u != 0 {
            format!("{tens}{}{}", self.e(), self.n.units[u as usize])
        } else {
            tens.clone()
        }
    }

    fn magnitude(&self, count: u64, singular: &str, plural: &str) -> String {
        format!(
            "{} {}",
            self.compose(count),
            if count == 1 { singular } else { plural }
        )
    }

    fn compose(&self, n: u64) -> String {
        let m = &self.n.magnitudes;
        if n < 100 {
            return self.under_hundred(n);
        }
        if n < 1000 {
            return self.with_rest(self.n.hundreds[(n / 100) as usize].clone(), n % 100);
        }
        if n < 1_000_000 {
            return self.with_rest(self.magnitude(n / 1000, &m.thousand, &m.thousand), n % 1000);
        }
        if n < 1_000_000_000 {
            return self.with_rest(
                self.magnitude(n / 1_000_000, &m.million, &m.million_plural),
                n % 1_000_000,
            );
        }
        self.with_rest(
            self.magnitude(n / 1_000_000_000, &m.billion, &m.billion_plural),
            n % 1_000_000_000,
        )
    }

    /// `numberToWords(n, raw?)`. Out of range: the ASCII digits of each CODE POINT of `raw` (else `String(n)`) by
    /// their unit words, everything else dropped.
    pub fn call(&self, n: f64, raw: Option<&JsString>) -> JsString {
        let units = &self.n.units;
        if !is_safe_integer(n) || n < 0.0 {
            let digits = raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n)));
            let words: Vec<JsString> = digits
                .code_point_strings()
                .into_iter()
                .filter(|c| c.len() == 1 && (u16::from(b'0')..=u16::from(b'9')).contains(&c.0[0]))
                .map(|d| js(&units[(d.0[0] - u16::from(b'0')) as usize]))
                .collect();
            return JsString::join(&words, &js(" "));
        }
        if n == 0.0 {
            return js(&units[0]);
        }
        js_re!(r"\s+", "gu")
            .replace(&js(&self.compose(n as u64)), &js(" "))
            .trim()
    }
}
