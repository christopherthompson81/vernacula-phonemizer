//! A base phone for each Latin letter, for an unknown foreign Latin word a host must still say.
//! Ported from src/core/latinPhones.ts — see that file for why each ambiguous row has the value it has.

use crate::core::js_string::{JsString, js};
use crate::core::provenance::{Form, normalize};
use crate::js_re;

/// Generated from the TS object (key order preserved): never hand-typed.
pub const LATIN_PHONE: [(&str, &str); 48] = [
    ("b", "b"),
    ("c", "k"),
    ("d", "d"),
    ("f", "f"),
    ("g", "\u{261}"),
    ("h", "h"),
    ("j", "j"),
    ("k", "k"),
    ("l", "l"),
    ("m", "m"),
    ("n", "n"),
    ("p", "p"),
    ("q", "k"),
    ("r", "r"),
    ("s", "s"),
    ("t", "t"),
    ("v", "v"),
    ("w", "w"),
    ("x", "ks"),
    ("y", "j"),
    ("z", "z"),
    ("a", "a"),
    ("e", "e"),
    ("i", "i"),
    ("o", "o"),
    ("u", "u"),
    ("\u{e7}", "t\u{361}\u{283}"),
    ("\u{f1}", "\u{272}"),
    ("\u{df}", "s"),
    ("\u{f8}", "\u{f8}"),
    ("\u{e6}", "\u{e6}"),
    ("\u{153}", "\u{153}"),
    ("\u{e5}", "o\u{2d0}"),
    ("\u{f6}", "\u{f8}"),
    ("\u{fc}", "y"),
    ("\u{e4}", "\u{25b}"),
    ("\u{fe}", "\u{3b8}"),
    ("\u{f0}", "\u{f0}"),
    ("\u{142}", "w"),
    ("\u{14b}", "\u{14b}"),
    ("\u{25b}", "\u{25b}"),
    ("\u{254}", "\u{254}"),
    ("\u{161}", "\u{283}"),
    ("\u{17e}", "\u{292}"),
    ("\u{10d}", "t\u{361}\u{283}"),
    ("\u{107}", "t\u{361}\u{255}"),
    ("\u{111}", "d\u{361}\u{292}"),
    ("\u{127}", "\u{127}"),
];
const X_INITIAL: &str = "z";

#[derive(Clone, Copy, Default)]
pub struct PhoneOpts {
    pub initial: bool,
    pub include_h: bool,
}

fn table(c: &JsString) -> Option<&'static str> {
    LATIN_PHONE.iter().find(|(k, _)| c == *k).map(|(_, v)| *v)
}

fn table_phone(c: &JsString, opts: PhoneOpts) -> Option<&'static str> {
    if *c == "h" {
        return if opts.include_h { table(c) } else { None };
    }
    if *c == "x" && opts.initial {
        return Some(X_INITIAL);
    }
    table(c)
}

pub fn latin_phone(ch: &JsString, opts: PhoneOpts) -> Option<JsString> {
    if js_re!(r"\p{M}", "u").test(ch) {
        return None;
    }
    let c = ch.to_lower_case();
    if let Some(d) = table_phone(&c, opts) {
        return Some(js(d));
    }
    let base = js_re!(r"\p{M}+", "gu").replace(&normalize(&c, Form::Nfd), &JsString::new());
    if base == c || base.len() != 1 {
        return None;
    }
    table_phone(&base, opts).map(js)
}
