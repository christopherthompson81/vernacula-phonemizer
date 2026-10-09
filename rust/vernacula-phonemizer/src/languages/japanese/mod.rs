pub mod counters;
pub mod japanese;
pub mod kana;
pub mod kanji;
pub mod manifest;
pub mod normalize;
pub mod numbers;
pub mod pitch;

use crate::core::js_string::JsString;

/// `String.fromCodePoint(cp)`.
pub(crate) fn from_code_point(cp: u32) -> JsString {
    match char::from_u32(cp) {
        Some(c) => {
            let mut buf = [0u16; 2];
            JsString::from_units(c.encode_utf16(&mut buf))
        }
        None => JsString(vec![cp as u16]),
    }
}

/// `s[0]` as a string (the first CODE UNIT), or `None` for "".
pub(crate) fn first_unit(s: &JsString) -> Option<JsString> {
    s.0.first().map(|&u| JsString(vec![u]))
}
