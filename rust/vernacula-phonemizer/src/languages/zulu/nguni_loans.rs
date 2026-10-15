//! The Nguni loanword lexicon (the words whose click-letter reading cannot be derived, only listed, each with its
//! verdict) and `deClick`, shared by Zulu and Xhosa.
//! Ported from src/languages/zulu/nguniLoans.ts — see that file for the corpus evidence.

use crate::core::js_string::{JsString, js};
use crate::js_re;

/// How a listed loan is read.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LoanReading {
    Declick,
    Foreign,
}

const NGUNI_LOANS: [(&str, LoanReading); 13] = [
    ("canada", LoanReading::Declick),
    ("congo", LoanReading::Declick),
    ("mexico", LoanReading::Declick),
    ("covid", LoanReading::Declick),
    ("china", LoanReading::Foreign),
    ("chile", LoanReading::Foreign),
    ("carolina", LoanReading::Foreign),
    ("cuerden", LoanReading::Foreign),
    ("cadwalder", LoanReading::Foreign),
    ("corniglia", LoanReading::Foreign),
    ("choudhary", LoanReading::Foreign),
    ("capuzzo", LoanReading::Foreign),
    ("chhatrapati", LoanReading::Foreign),
];

/// `NGUNI_LOANS.get(word)`.
pub fn nguni_loan(word: &JsString) -> Option<LoanReading> {
    NGUNI_LOANS
        .iter()
        .find(|(k, _)| *word == *k)
        .map(|(_, r)| *r)
}

/// `deClick(word)`: ⟨x⟩ → ⟨ks⟩ first, then ⟨c q⟩ → ⟨k⟩.
pub fn de_click(word: &JsString) -> JsString {
    let ks = js_re!("x", "gu").replace(word, &js("ks"));
    js_re!("[cq]", "gu").replace(&ks, &js("k"))
}
