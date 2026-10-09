//! Clause assembly: joins token readings with single spaces, holds a pause mark until something follows
//! it, and routes the text no token claimed to the foreign readers. Ported from src/core/clauses.ts.

use super::foreign::{get_default_foreign, read_foreign_run};
use super::js_regex::JsMatch;
use super::js_regex::JsRegex;
use super::js_string::{JsString, js};
use super::trace::{begin_token, end_token, enter_engine, exit_engine, note_assembled, note_emit};
use crate::js_re;

#[derive(Default)]
pub struct ClauseSink {
    out: JsString,
    pending: Option<JsString>,
}

impl ClauseSink {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn emit(&mut self, ipa: &JsString) {
        if ipa.is_empty() {
            return;
        }
        let at;
        if self.out.is_empty() {
            at = 0;
            self.out = ipa.clone();
        } else if let Some(p) = self.pending.take() {
            at = self.out.len() + p.len() + 2;
            self.out.push_str(&js(" "));
            self.out.push_str(&p);
            self.out.push_str(&js(" "));
            self.out.push_str(ipa);
        } else {
            at = self.out.len() + 1;
            self.out.push_str(&js(" "));
            self.out.push_str(ipa);
        }
        note_emit(ipa, Some(at));
    }

    pub fn pause(&mut self, mark: &JsString) {
        if !self.out.is_empty() {
            self.pending = Some(mark.clone());
        }
    }

    pub fn finish(mut self) -> JsString {
        if let Some(p) = self.pending.take() {
            if !self.out.is_empty() {
                self.out.push_str(&js(" "));
                self.out.push_str(&p);
            }
        }
        note_assembled(&self.out);
        self.out
    }
}

pub fn foreign_run() -> &'static JsRegex {
    js_re!(r"[\p{L}\p{M}][\p{L}\p{M}'’-]*[⁰¹²³⁴-⁹]*", "gu")
}

/// Route each letter run in `gap` (which starts at `base` in the engine's input) to a foreign reader.
pub fn emit_unclaimed(gap: &JsString, sink: &mut ClauseSink, base: usize) {
    for m in foreign_run().match_all(gap) {
        let run = m.value(gap);
        begin_token((base + m.index(), base + m.index() + run.len()), &run);
        if let Some(routed) = read_foreign_run(&run) {
            if !routed.is_empty() {
                sink.emit(&routed);
            }
            end_token();
            continue;
        }
        if !js_re!(r"\p{Script=Latin}", "u").test(&run) {
            end_token();
            continue;
        }
        if let Some(foreign) = get_default_foreign() {
            sink.emit(&foreign(&run));
        }
        end_token();
    }
}

/// Walk `input` by `token` (a `g` regex), handing each match to `handle` and the gaps between to
/// `emit_unclaimed`.
pub fn assemble_clauses(
    input: &JsString,
    token: &JsRegex,
    mut handle: impl FnMut(&JsMatch, &JsString, &mut ClauseSink),
) -> JsString {
    let mut sink = ClauseSink::new();
    enter_engine(input);
    let mut cursor = 0;
    for m in token.match_all(input) {
        let at = m.index();
        if at > cursor {
            emit_unclaimed(
                &JsString::from_units(&input.0[cursor..at]),
                &mut sink,
                cursor,
            );
        }
        begin_token((at, m.end()), &m.value(input));
        handle(&m, input, &mut sink);
        end_token();
        cursor = m.end();
    }
    if cursor < input.len() {
        emit_unclaimed(&JsString::from_units(&input.0[cursor..]), &mut sink, cursor);
    }
    let out = sink.finish();
    exit_engine();
    out
}
