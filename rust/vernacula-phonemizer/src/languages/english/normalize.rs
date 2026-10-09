//! PLACEHOLDER on this branch only: `normalize.ts` is being ported on `rust-en-normalize`, which replaces
//! this file wholesale at merge. Until then the English engine is exercised through its pre-normalized
//! path.

use crate::core::js_string::JsString;

pub fn normalize_english(_input: &JsString) -> JsString {
    unimplemented!("normalize.ts port lands from rust-en-normalize")
}

pub fn normalize_english_initialisms(_text: &JsString, _is_recorded: &dyn Fn(&JsString) -> bool) -> JsString {
    unimplemented!("normalize.ts port lands from rust-en-normalize")
}
