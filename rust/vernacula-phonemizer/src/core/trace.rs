//! The additive trace of #1150: per-token record of what produced each reading, plus the whole-string
//! rewrites. Ported from src/core/trace.ts — see that file for the span rules.
//!
//! Recording is per thread. Tokens are identified by their index, where the TS keys a `Map` by object.

use std::cell::RefCell;

use super::foreign::host_depth;
use super::js_string::JsString;
use super::provenance::{Span, begin_provenance, end_provenance, input_span, provenance_for};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenSource {
    Lexicon,
    Heteronym,
    Tagger,
    G2p,
    Foreign,
    Passthrough,
}

impl TokenSource {
    pub fn as_str(self) -> &'static str {
        match self {
            TokenSource::Lexicon => "lexicon",
            TokenSource::Heteronym => "heteronym",
            TokenSource::Tagger => "tagger",
            TokenSource::G2p => "g2p",
            TokenSource::Foreign => "foreign",
            TokenSource::Passthrough => "passthrough",
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct TraceToken {
    pub span: Span,
    pub input_span: Option<Span>,
    pub surface: JsString,
    pub nativised: Option<JsString>,
    pub emitted: Vec<JsString>,
    pub source: Option<TokenSource>,
    pub ipa_span: Option<Span>,
}

#[derive(Clone, Debug)]
pub struct TraceRewrite {
    pub stage: String,
    pub before: JsString,
    pub after: JsString,
}

/// What a recording produced.
#[derive(Clone, Debug, Default)]
pub struct Trace {
    pub normalized: JsString,
    pub tokens: Vec<TraceToken>,
    pub rewrites: Vec<TraceRewrite>,
    pub traced: bool,
}

/// A token's IPA span: not yet seen, known, or withheld (`null` in the TS).
#[derive(Clone, Copy)]
enum IpaSpan {
    Known(Span),
    Withheld,
}

struct Recording {
    input: JsString,
    normalized: JsString,
    tokens: Vec<TraceToken>,
    rewrites: Vec<TraceRewrite>,
    current: Option<usize>,
    traced: bool,
    token_depth: usize,
    spans: Vec<Option<IpaSpan>>,
    assembled: Option<JsString>,
}

thread_local! {
    static RECORDING: RefCell<Option<Recording>> = const { RefCell::new(None) };
}

fn with_active(f: impl FnOnce(&mut Recording)) {
    if host_depth() > 1 {
        return;
    }
    RECORDING.with(|r| {
        if let Some(rec) = r.borrow_mut().as_mut() {
            f(rec);
        }
    });
}

pub fn start_trace(input: &JsString) {
    RECORDING.with(|r| {
        *r.borrow_mut() = Some(Recording {
            input: input.clone(),
            normalized: JsString::new(),
            tokens: Vec::new(),
            rewrites: Vec::new(),
            current: None,
            traced: false,
            token_depth: 0,
            spans: Vec::new(),
            assembled: None,
        });
    });
    begin_provenance(input);
}

pub fn stop_trace(ipa: Option<&JsString>) -> Trace {
    let rec = RECORDING.with(|r| r.borrow_mut().take());
    let Some(mut r) = rec else {
        end_provenance();
        return Trace::default();
    };
    if let Some(p) = provenance_for(&r.normalized) {
        for t in r.tokens.iter_mut() {
            if let Some(is) = input_span(&p, t.span.0, t.span.1) {
                t.input_span = Some(is);
            }
        }
    }
    if ipa.is_some() && r.assembled.as_ref() == ipa {
        for (t, sp) in r.tokens.iter_mut().zip(r.spans.iter()) {
            if let Some(IpaSpan::Known(sp)) = sp {
                t.ipa_span = Some(*sp);
            }
        }
    }
    end_provenance();
    Trace { normalized: r.normalized, tokens: r.tokens, rewrites: r.rewrites, traced: r.traced }
}

pub fn note_rewrite(stage: &str, before: &JsString, after: &JsString, positional: bool) {
    if before == after {
        return;
    }
    with_active(|r| {
        r.rewrites.push(TraceRewrite { stage: stage.to_string(), before: before.clone(), after: after.clone() });
        if positional && before.len() == after.len() && r.assembled.as_ref() == Some(before) {
            r.assembled = Some(after.clone());
        }
    });
}

pub fn enter_engine(normalized: &JsString) {
    let mut note = None;
    with_active(|r| {
        if r.traced {
            return;
        }
        r.normalized = normalized.clone();
        r.traced = true;
        note = Some(r.input.clone());
    });
    if let Some(input) = note {
        note_rewrite("normalize", &input, normalized, false);
    }
}

pub fn exit_engine() {}

fn push_token(r: &mut Recording, t: TraceToken, span: Option<IpaSpan>) -> usize {
    r.tokens.push(t);
    r.spans.push(span);
    r.tokens.len() - 1
}

pub fn begin_token(span: Span, surface: &JsString) {
    with_active(|r| {
        if !r.traced {
            return;
        }
        r.token_depth += 1;
        if r.token_depth > 1 {
            return;
        }
        let i = push_token(r, TraceToken { span, surface: surface.clone(), ..Default::default() }, None);
        r.current = Some(i);
    });
}

pub fn end_token() {
    with_active(|r| {
        if r.token_depth > 0 {
            r.token_depth -= 1;
        }
        if r.token_depth == 0 {
            r.current = None;
        }
    });
}

pub fn note_nativised(from: &JsString, to: &JsString) {
    if from == to {
        return;
    }
    with_active(|r| {
        if let Some(i) = r.current {
            r.tokens[i].nativised = Some(to.clone());
        }
    });
}

pub fn note_token(
    span: Span,
    surface: &JsString,
    emitted: &[JsString],
    nativised: Option<&JsString>,
    ipa_span: Option<Span>,
    source: Option<TokenSource>,
) {
    with_active(|r| {
        if !r.traced {
            return;
        }
        let t = TraceToken {
            span,
            surface: surface.clone(),
            emitted: emitted.iter().filter(|x| !x.is_empty()).cloned().collect(),
            nativised: nativised.filter(|n| *n != surface).cloned(),
            source,
            ..Default::default()
        };
        push_token(r, t, ipa_span.map(IpaSpan::Known));
    });
}

/// An emission of the current token; `at` is where it landed in the reading, `None` if it has no place.
pub fn note_emit(ipa: &JsString, at: Option<usize>) {
    if ipa.is_empty() {
        return;
    }
    with_active(|r| {
        let Some(i) = r.current else { return };
        r.tokens[i].emitted.push(ipa.clone());
        r.spans[i] = match (at, r.spans[i]) {
            (None, _) => Some(IpaSpan::Withheld),
            (Some(_), Some(IpaSpan::Withheld)) => Some(IpaSpan::Withheld),
            (Some(at), None) => Some(IpaSpan::Known((at, at + ipa.len()))),
            (Some(at), Some(IpaSpan::Known(cur))) => Some(IpaSpan::Known((cur.0.min(at), cur.1.max(at + ipa.len())))),
        };
    });
}

pub fn note_assembled(s: &JsString) {
    with_active(|r| r.assembled = Some(s.clone()));
}
