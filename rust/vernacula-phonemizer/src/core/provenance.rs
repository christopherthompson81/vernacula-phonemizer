//! #1150's provenance: for each code unit of the pipeline string, the span of the caller's INPUT it came
//! from. `rewrite` is the seam a normalizer's replace goes through; it returns exactly what `replace` would
//! and, while a trace is recording, carries the mapping across. Ported from src/core/provenance.ts — see
//! that file for the poisoning rules.
//!
//! State is per thread (one phonemize call, one thread).

use std::cell::RefCell;

use super::foreign::host_depth;
use super::js_regex::{JsMatch, JsRegex, get_substitution};
use super::js_string::JsString;

pub type Span = (usize, usize);

struct State {
    prov: Option<Vec<Span>>,
    tracked: Option<JsString>,
    poison_sink: Option<Box<dyn Fn(&JsString, &JsString)>>,
}

thread_local! {
    static STATE: RefCell<State> = const { RefCell::new(State { prov: None, tracked: None, poison_sink: None }) };
}

fn poison(expected: Option<(&JsString, &JsString)>) {
    STATE.with(|st| {
        let mut st = st.borrow_mut();
        if let (Some(sink), Some((e, g))) = (st.poison_sink.as_ref(), expected) {
            sink(e, g);
        }
        st.prov = None;
        st.tracked = None;
    });
}

pub fn on_poison(f: Option<Box<dyn Fn(&JsString, &JsString)>>) {
    STATE.with(|st| st.borrow_mut().poison_sink = f);
}

pub fn begin_provenance(input: &JsString) {
    if host_depth() > 1 {
        return;
    }
    STATE.with(|st| {
        let mut st = st.borrow_mut();
        st.prov = Some((0..input.len()).map(|i| (i, i + 1)).collect());
        st.tracked = Some(input.clone());
    });
}

pub fn end_provenance() {
    if host_depth() > 1 {
        return;
    }
    STATE.with(|st| {
        let mut st = st.borrow_mut();
        st.prov = None;
        st.tracked = None;
    });
}

pub fn provenance_for(normalized: &JsString) -> Option<Vec<Span>> {
    STATE.with(|st| {
        let st = st.borrow();
        match (&st.prov, &st.tracked) {
            (Some(p), Some(t)) if t == normalized => Some(p.clone()),
            _ => None,
        }
    })
}

pub fn input_span(p: &[Span], from: usize, to: usize) -> Option<Span> {
    let (mut lo, mut hi) = (usize::MAX, 0usize);
    let mut any = false;
    for q in p.iter().take(to).skip(from) {
        any = true;
        lo = lo.min(q.0);
        hi = hi.max(q.1);
    }
    any.then_some((lo, hi))
}

fn span(p: &[Span], at: usize, len: usize) -> Span {
    let prev_end = || if at == 0 { None } else { p.get(at - 1) }.map_or((0, 0), |q| (q.1, q.1));
    if len == 0 {
        return p.get(at).map_or_else(prev_end, |q| (q.0, q.0));
    }
    input_span(p, at, at + len).unwrap_or_else(prev_end)
}

pub fn tracing() -> bool {
    host_depth() <= 1 && STATE.with(|st| st.borrow().prov.is_some())
}

fn snapshot() -> Option<(Vec<Span>, Option<JsString>)> {
    if host_depth() > 1 {
        return None;
    }
    STATE.with(|st| {
        let st = st.borrow();
        st.prov.as_ref().map(|p| (p.clone(), st.tracked.clone()))
    })
}

fn commit(next: Vec<Span>, out: &JsString) {
    STATE.with(|st| {
        let mut st = st.borrow_mut();
        st.prov = Some(next);
        st.tracked = Some(out.clone());
    });
}

/// A piece of a rebuilt pipeline string: its text and the span of `s` it consumed.
pub type Piece = (JsString, usize, usize);

/// A pass that walks `s` and constructs a new string from `pieces`, which must TILE `s`.
pub fn rebuilt(s: &JsString, pieces: &[Piece]) -> JsString {
    let mut out = JsString::new();
    for (text, _, _) in pieces {
        out.push_str(text);
    }
    let Some((p, tracked)) = snapshot() else { return out };
    if tracked.as_ref() != Some(s) {
        poison(Some((&tracked.unwrap_or_default(), s)));
        return out;
    }
    let mut next = Vec::with_capacity(out.len());
    let mut cursor = 0;
    for (text, from, to) in pieces {
        if *from != cursor || to < from {
            poison(Some((s, &out)));
            return out;
        }
        cursor = *to;
        if text.0[..] == s.0[*from..*to] {
            next.extend_from_slice(&p[*from..*from + text.len()]);
            continue;
        }
        let sp = span(&p, *from, to - from);
        next.extend(std::iter::repeat_n(sp, text.len()));
    }
    if cursor != s.len() || next.len() != out.len() {
        poison(Some((s, &out)));
        return out;
    }
    commit(next, &out);
    out
}

/// `[ᄀ-ᇿꥠ-꥿ힰ-퟿]+|[\uD800-\uDBFF][\uDC00-\uDFFF]\p{M}*|[\s\S]\p{M}*`, gu.
fn canonical_block() -> &'static JsRegex {
    crate::js_re!(r"[ᄀ-ᇿꥠ-꥿ힰ-퟿]+|[\uD800-\uDBFF][\uDC00-\uDFFF]\p{M}*|[\s\S]\p{M}*", "gu")
}

#[derive(Clone, Copy)]
pub enum Form {
    Nfc,
    Nfd,
    Nfkc,
    Nfkd,
}

/// `s.normalize(form)`. A lone surrogate passes through unchanged, as in JS.
pub fn normalize(s: &JsString, form: Form) -> JsString {
    use unicode_normalization::UnicodeNormalization;
    let mut out = JsString::new();
    let mut run = String::new();
    let flush = |run: &mut String, out: &mut JsString| {
        if run.is_empty() {
            return;
        }
        let n: String = match form {
            Form::Nfc => run.nfc().collect(),
            Form::Nfd => run.nfd().collect(),
            Form::Nfkc => run.nfkc().collect(),
            Form::Nfkd => run.nfkd().collect(),
        };
        out.push_str(&JsString::from(n.as_str()));
        run.clear();
    };
    for cp in s.code_points() {
        match char::from_u32(cp) {
            Some(c) => run.push(c),
            None => {
                flush(&mut run, &mut out);
                out.0.push(cp as u16);
            }
        }
    }
    flush(&mut run, &mut out);
    out
}

/// `s.normalize(form)` on the pipeline string, carrying the mapping block by block.
pub fn renormalize(s: &JsString, form: Form) -> JsString {
    let whole = normalize(s, form);
    let Some((p, tracked)) = snapshot() else { return whole };
    if whole == *s {
        return whole;
    }
    if tracked.as_ref() != Some(s) {
        poison(Some((&tracked.unwrap_or_default(), s)));
        return whole;
    }
    let blocks: Vec<JsString> = canonical_block().match_all(s).iter().map(|m| m.value(s)).collect();
    let mut next = Vec::new();
    let mut at = 0;
    let mut joined = JsString::new();
    for b in &blocks {
        let sp = span(&p, at, b.len());
        let nb = normalize(b, form);
        next.extend(std::iter::repeat_n(sp, nb.len()));
        joined.push_str(&nb);
        at += b.len();
    }
    if next.len() != whole.len() || at != s.len() || joined != whole {
        poison(Some((s, &whole)));
        return whole;
    }
    commit(next, &whole);
    whole
}

/// `s.replace(re, rep)` on the pipeline string.
pub fn rewrite(s: &JsString, re: &JsRegex, rep: &JsString) -> JsString {
    rewrite_with(s, re, |m, s| get_substitution(m, s, rep, re.names()))
}

/// `s.replace("literal", rep)` on the pipeline string: the FIRST occurrence only, `$` patterns expanded.
pub fn rewrite_lit(s: &JsString, lit: &str, rep: &JsString) -> JsString {
    let re = JsRegex::new(&escape(lit), "").expect("escaped literal compiles");
    rewrite(s, &re, rep)
}

/// `[.*+?^${}()|[\]\\]` → `\$&`.
fn escape(lit: &str) -> String {
    let mut out = String::with_capacity(lit.len());
    for c in lit.chars() {
        if ".*+?^${}()|[]\\".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

/// `s.replace(re, (m, …) => …)` on the pipeline string.
pub fn rewrite_with(s: &JsString, re: &JsRegex, mut f: impl FnMut(&JsMatch, &JsString) -> JsString) -> JsString {
    let Some((p, tracked)) = snapshot() else { return re.replace_with(s, f) };
    if tracked.as_ref() != Some(s) {
        poison(Some((&tracked.unwrap_or_default(), s)));
        return re.replace_with(s, f);
    }
    let all = re.match_all(s);
    let matches: &[JsMatch] = if re.global { &all } else { &all[..all.len().min(1)] };
    let mut out = JsString::new();
    let mut next: Vec<Span> = Vec::with_capacity(s.len());
    let mut cursor = 0;
    for m in matches {
        let at = m.index();
        out.push_units(&s.0[cursor..at]);
        next.extend_from_slice(&p[cursor..at]);
        let piece = f(m, s);
        let len = m.end() - at;
        let unchanged = piece.0[..] == s.0[at..m.end()];
        let sp = span(&p, at, len);
        out.push_str(&piece);
        if unchanged {
            next.extend_from_slice(&p[at..at + piece.len()]);
        } else {
            next.extend(std::iter::repeat_n(sp, piece.len()));
        }
        cursor = m.end();
        if len == 0 && cursor < s.len() {
            out.0.push(s.0[cursor]);
            next.push(p[cursor]);
            cursor += 1;
        }
    }
    out.push_units(&s.0[cursor..]);
    next.extend_from_slice(&p[cursor..]);
    if next.len() != out.len() {
        poison(Some((s, &out)));
        return out;
    }
    commit(next, &out);
    out
}
