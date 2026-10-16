//! Scottish Gaelic cardinal numbers: the counting series with the particle `a` (h- before a vowel), the attributive
//! series before a magnitude, lenition after `dà` only (no eclipsis), the `agus` connector before a bare numeral.
//! Ported from src/languages/scottishgaelic/numbers.ts — see that file for the sources and the known limitations.

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::js_re;

#[derive(Debug, FromJson)]
pub struct Magnitudes {
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub billion: String,
}

/// `GaelicNumbers`: the `numbers` block of scottishgaelic.jsonc.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct GaelicNumbers {
    pub ones: Vec<String>,
    pub attributive: Vec<String>,
    pub tens: IndexMap<String, String>,
    pub teen_word: String,
    pub connector: String,
    pub magnitudes: Magnitudes,
}

fn lenite(w: &JsString) -> JsString {
    if js_re!("^[bcdfgmpst]", "i").test(w) {
        w.char_at(0).concat(&js("h")).concat(&w.slice(1, None))
    } else {
        w.clone()
    }
}

/// The renderer `makeNumberToWords(N)` returns, over one numeral table.
pub struct NumberToWords {
    n: &'static GaelicNumbers,
}

/// `makeNumberToWords(N)`.
pub fn make_number_to_words(n: &'static GaelicNumbers) -> NumberToWords {
    NumberToWords { n }
}

impl NumberToWords {
    fn counting(&self, u: u64) -> JsString {
        let w = js(&self.n.ones[u as usize]);
        let w = if js_re!("^[aeiouàèìòùáéíóú]", "i").test(&w) {
            js("h-").concat(&w)
        } else {
            w
        };
        js("a ").concat(&w)
    }

    fn under_hundred(&self, n: u64) -> JsString {
        if n <= 10 {
            return self.counting(n);
        }
        if n < 20 {
            let u = n - 10;
            let teen = js(&self.n.teen_word);
            let teen = if u == 2 { lenite(&teen) } else { teen };
            return self.counting(u).concat(&js(" ")).concat(&teen);
        }
        let (t, u) = (n / 10 * 10, n % 10);
        let tens = js(&self.n.tens[&t.to_string()]);
        if u != 0 {
            tens.concat(&js(&format!(" {} ", self.n.connector)))
                .concat(&self.counting(u))
        } else {
            tens
        }
    }

    fn magnitude(&self, count: u64, word: &str) -> JsString {
        let word = js(word);
        if count == 1 {
            return word;
        }
        if count <= 10 {
            let w = if count == 2 { lenite(&word) } else { word };
            return js(&self.n.attributive[count as usize])
                .concat(&js(" "))
                .concat(&w);
        }
        self.compose(count).concat(&js(" ")).concat(&word)
    }

    fn attach(&self, head: JsString, r: u64) -> JsString {
        if r == 0 {
            return head;
        }
        let tail = self.compose(r);
        let conn = if tail.starts_with(&js("a ")) {
            js(&format!("{} ", self.n.connector))
        } else {
            JsString::new()
        };
        head.concat(&js(" ")).concat(&conn).concat(&tail)
    }

    fn compose(&self, n: u64) -> JsString {
        let m = &self.n.magnitudes;
        if n < 100 {
            return self.under_hundred(n);
        }
        if n < 1000 {
            return self.attach(self.magnitude(n / 100, &m.hundred), n % 100);
        }
        if n < 1_000_000 {
            return self.attach(self.magnitude(n / 1000, &m.thousand), n % 1000);
        }
        if n < 1_000_000_000 {
            return self.attach(self.magnitude(n / 1_000_000, &m.million), n % 1_000_000);
        }
        self.attach(
            self.magnitude(n / 1_000_000_000, &m.billion),
            n % 1_000_000_000,
        )
    }

    /// `numberToWords(n, raw?)`. Out of range: the ASCII digits of each CODE POINT of `raw` (else `String(n)`) by
    /// their counting words, everything else dropped.
    pub fn call(&self, n: f64, raw: Option<&JsString>) -> JsString {
        let ones = &self.n.ones;
        if !is_safe_integer(n) || n < 0.0 {
            let digits = raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n)));
            let words: Vec<JsString> = digits
                .code_point_strings()
                .into_iter()
                .filter(|c| c.len() == 1 && (u16::from(b'0')..=u16::from(b'9')).contains(&c.0[0]))
                .map(|d| js(&ones[(d.0[0] - u16::from(b'0')) as usize]))
                .collect();
            return JsString::join(&words, &js(" "));
        }
        if n == 0.0 {
            return js(&ones[0]);
        }
        js_re!(r"\s+", "gu")
            .replace(&self.compose(n as u64), &js(" "))
            .trim()
    }
}
