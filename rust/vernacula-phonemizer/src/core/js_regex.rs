//! JavaScript regular expressions, with the TypeScript pattern strings kept VERBATIM.
//!
//! `regress` is an ECMAScript engine, so unlike the C# port there is no pattern translator. This wrapper
//! covers the places where regress and V8 still disagree, each measured against `csharp/regex-corpus.jsonl`
//! (docs/investigations/rust-port/rust_port_foundations_investigation.md, Run 1):
//!   · input model: a non-`u` pattern sees UTF-16 code UNITS, a `u` pattern sees code points;
//!   · global iteration: V8 steps a FAILED attempt by one code unit, even under `u`;
//!   · legacy `/i`: no character ≥ U+0080 may fold onto ASCII (spec `Canonicalize`), which regress
//!     does not enforce.

use super::js_string::{JsString, is_high, is_low};
use std::ops::Range;

/// Folds onto ASCII under Unicode case mapping, which legacy `/i` must refuse: ı→I, ſ→S, K (Kelvin)→k.
const ASCII_FOLDERS: [u16; 3] = [0x0131, 0x017F, 0x212A];
/// What a legacy-`/i` pattern sees in place of an `ASCII_FOLDERS` unit: caseless and outside every
/// literal and range in the patterns this is applied to (checked by `legacy_fold_guard`).
const INERT: u16 = 0xE000;

#[derive(Debug)]
pub struct JsRegex {
    re: regress::Regex,
    pub source: String,
    pub flags: String,
    pub global: bool,
    pub sticky: bool,
    unicode: bool,
    legacy_icase: bool,
    /// Whether a match could START inside a surrogate pair (see `may_start_mid_pair`); `false` skips the scan.
    mid_pair: bool,
    names: Vec<(String, usize)>,
}

/// One match: offsets are UTF-16 code units into the subject.
#[derive(Clone, Debug)]
pub struct JsMatch {
    pub range: Range<usize>,
    pub groups: Vec<Option<Range<usize>>>,
}

impl JsMatch {
    pub fn index(&self) -> usize {
        self.range.start
    }

    pub fn end(&self) -> usize {
        self.range.end
    }

    /// `m[0]`.
    pub fn value(&self, s: &JsString) -> JsString {
        JsString::from_units(&s.0[self.range.clone()])
    }

    /// `m[i]`; `None` for an unparticipating group (JS `undefined`). `m[0]` is the whole match.
    pub fn group(&self, i: usize, s: &JsString) -> Option<JsString> {
        if i == 0 {
            return Some(self.value(s));
        }
        self.groups
            .get(i - 1)?
            .as_ref()
            .map(|r| JsString::from_units(&s.0[r.clone()]))
    }
}

#[derive(Debug)]
pub enum JsRegexError {
    Syntax(String),
    /// A legacy-`/i` pattern this wrapper cannot run faithfully: refusing is loud, a mismatch is not.
    Unsupported(String),
}

impl std::fmt::Display for JsRegexError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JsRegexError::Syntax(e) => write!(f, "syntax: {e}"),
            JsRegexError::Unsupported(e) => write!(f, "unsupported: {e}"),
        }
    }
}

impl JsRegex {
    pub fn new(pattern: &str, flags: &str) -> Result<JsRegex, JsRegexError> {
        let mut engine_flags = String::new();
        let (mut global, mut sticky, mut unicode, mut icase) = (false, false, false, false);
        for f in flags.chars() {
            match f {
                'g' => global = true,
                'y' => sticky = true,
                'd' => {}
                'u' | 'v' => {
                    unicode = true;
                    engine_flags.push(f);
                }
                'i' => {
                    icase = true;
                    engine_flags.push(f);
                }
                'm' | 's' => engine_flags.push(f),
                _ => {
                    return Err(JsRegexError::Syntax(format!(
                        "unknown flag '{f}' in /{pattern}/{flags}"
                    )));
                }
            }
        }
        let legacy_icase = icase && !unicode;
        if legacy_icase {
            legacy_fold_guard(pattern)
                .map_err(|e| JsRegexError::Unsupported(format!("/{pattern}/{flags}: {e}")))?;
        }
        let re = regress::Regex::with_flags(pattern, engine_flags.as_str())
            .map_err(|e| JsRegexError::Syntax(format!("/{pattern}/{flags}: {e}")))?;
        let names = named_groups(pattern);
        Ok(JsRegex {
            re,
            source: pattern.to_string(),
            flags: flags.to_string(),
            global,
            sticky,
            unicode,
            legacy_icase,
            mid_pair: unicode && may_start_mid_pair(pattern),
            names,
        })
    }

    /// The subject as the engine should see it (see `ASCII_FOLDERS`).
    fn subject<'a>(&self, s: &'a [u16]) -> std::borrow::Cow<'a, [u16]> {
        if self.legacy_icase && s.iter().any(|u| ASCII_FOLDERS.contains(u)) {
            std::borrow::Cow::Owned(
                s.iter()
                    .map(|&u| if ASCII_FOLDERS.contains(&u) { INERT } else { u })
                    .collect(),
            )
        } else {
            std::borrow::Cow::Borrowed(s)
        }
    }

    /// The engine's leftmost match starting at or after `from`, in this pattern's input model.
    fn raw_from(&self, s: &[u16], from: usize) -> Option<regress::Match> {
        if self.unicode {
            self.re.find_from_utf16(s, from).next()
        } else {
            self.re.find_from_ucs2(s, from).next()
        }
    }

    /// V8's scan: like `raw_from`, but under `u` the positions INSIDE a surrogate pair are tried too,
    /// because a failed attempt advances one code unit.
    fn search(&self, s: &[u16], from: usize) -> Option<regress::Match> {
        let candidate = self.raw_from(s, from);
        if !self.mid_pair {
            return candidate;
        }
        let limit = candidate.as_ref().map_or(s.len(), |m| m.start());
        for q in from.max(1)..limit {
            if is_low(s[q]) && is_high(s[q - 1]) {
                if let Some(m) = self.raw_from(s, q) {
                    if m.start() == q {
                        return Some(m);
                    }
                }
            }
        }
        candidate
    }

    fn to_match(m: regress::Match) -> JsMatch {
        JsMatch {
            range: m.range(),
            groups: m.captures.clone(),
        }
    }

    /// `re.exec(s)` from index 0 (or `lastIndex` = `from`), ignoring `g`. Sticky patterns must match at `from`.
    pub fn exec_at(&self, s: &JsString, from: usize) -> Option<JsMatch> {
        if from > s.len() {
            return None;
        }
        let subject = self.subject(&s.0);
        let m = self.search(&subject, from)?;
        if self.sticky && m.start() != from {
            return None;
        }
        Some(Self::to_match(m))
    }

    /// The first match (`s.match(re)` for a non-`g` pattern, `re.exec(s)` with `lastIndex` 0).
    pub fn exec(&self, s: &JsString) -> Option<JsMatch> {
        self.exec_at(s, 0)
    }

    /// `re.test(s)` for a pattern with no `g`/`y` state.
    pub fn test(&self, s: &JsString) -> bool {
        self.exec(s).is_some()
    }

    /// Every match, as `s.matchAll(re)` iterates them: after an empty match the next attempt starts one
    /// code point later under `u`, one code unit otherwise.
    pub fn match_all(&self, s: &JsString) -> Vec<JsMatch> {
        let subject = self.subject(&s.0);
        let mut out = Vec::new();
        let mut pos = 0;
        while pos <= subject.len() {
            let Some(m) = self.search(&subject, pos) else {
                break;
            };
            if self.sticky && m.start() != pos {
                break;
            }
            pos = if m.end() > m.start() {
                m.end()
            } else {
                advance(&subject, m.start(), self.unicode)
            };
            out.push(Self::to_match(m));
        }
        out
    }

    pub fn names(&self) -> &[(String, usize)] {
        &self.names
    }

    /// Whether the mid-pair scan runs for this pattern (for the soundness check in tools/regex-diff).
    pub fn scans_mid_pair(&self) -> bool {
        self.mid_pair
    }

    /// The same pattern with the mid-pair scan forced on: the reference `may_start_mid_pair` is checked
    /// against.
    pub fn with_full_scan(mut self) -> JsRegex {
        self.mid_pair = self.unicode;
        self
    }

    /// The group number for `(?<name>…)`.
    pub fn group_index(&self, name: &str) -> Option<usize> {
        self.names.iter().find(|(n, _)| n == name).map(|(_, i)| *i)
    }

    /// `s.replace(re, replacement)`: every match when `g`, otherwise the first; `$` patterns as in JS.
    pub fn replace(&self, s: &JsString, replacement: &JsString) -> JsString {
        self.replace_with(s, |m, subject| self.substitute(m, subject, replacement))
    }

    /// `s.replace(re, (m, …groups) => …)`.
    pub fn replace_with(
        &self,
        s: &JsString,
        mut f: impl FnMut(&JsMatch, &JsString) -> JsString,
    ) -> JsString {
        let matches = if self.global {
            self.match_all(s)
        } else {
            self.exec(s).into_iter().collect()
        };
        if matches.is_empty() {
            return s.clone();
        }
        let mut out = JsString::new();
        let mut copied = 0;
        for m in &matches {
            out.push_units(&s.0[copied..m.index()]);
            out.push_str(&f(m, s));
            copied = m.end();
        }
        out.push_units(&s.0[copied..]);
        out
    }

    /// ECMAScript GetSubstitution for this pattern's groups.
    pub fn substitute(&self, m: &JsMatch, s: &JsString, replacement: &JsString) -> JsString {
        get_substitution(m, s, replacement, &self.names)
    }
}

/// ECMAScript GetSubstitution: `$$`, `$&`, `` $` ``, `$'`, `$n`/`$nn`, `$<name>`. `names` empty means
/// the pattern has no named groups, and `$<` is then literal.
pub fn get_substitution(
    m: &JsMatch,
    s: &JsString,
    replacement: &JsString,
    names: &[(String, usize)],
) -> JsString {
    let r = &replacement.0;
    let ncap = m.groups.len();
    let mut out = JsString::new();
    let mut i = 0;
    let dollar = b'$' as u16;
    let digit = |u: u16| {
        (b'0' as u16..=b'9' as u16)
            .contains(&u)
            .then(|| (u - b'0' as u16) as usize)
    };
    while i < r.len() {
        if r[i] != dollar || i + 1 >= r.len() {
            out.0.push(r[i]);
            i += 1;
            continue;
        }
        let next = r[i + 1];
        match next {
            0x24 => {
                out.0.push(dollar);
                i += 2;
            }
            0x26 => {
                out.push_units(&s.0[m.range.clone()]);
                i += 2;
            }
            0x60 => {
                out.push_units(&s.0[..m.index()]);
                i += 2;
            }
            0x27 => {
                out.push_units(&s.0[m.end()..]);
                i += 2;
            }
            0x3C if !names.is_empty() => {
                let close = r[i + 2..].iter().position(|&u| u == b'>' as u16);
                match close {
                    None => {
                        out.0.push(dollar);
                        i += 1;
                    }
                    Some(c) => {
                        let name = String::from_utf16_lossy(&r[i + 2..i + 2 + c]);
                        if let Some(g) = names
                            .iter()
                            .find(|(n, _)| *n == name)
                            .map(|(_, i)| *i)
                            .and_then(|g| m.group(g, s))
                        {
                            out.push_str(&g);
                        }
                        i += 2 + c + 1;
                    }
                }
            }
            _ => match digit(next) {
                Some(d1) => {
                    let two = r.get(i + 2).copied().and_then(digit).map(|d2| d1 * 10 + d2);
                    if let Some(nn) = two.filter(|&nn| nn >= 1 && nn <= ncap) {
                        if let Some(g) = m.group(nn, s) {
                            out.push_str(&g);
                        }
                        i += 3;
                    } else if d1 >= 1 && d1 <= ncap {
                        if let Some(g) = m.group(d1, s) {
                            out.push_str(&g);
                        }
                        i += 2;
                    } else {
                        out.0.push(dollar);
                        i += 1;
                    }
                }
                None => {
                    out.0.push(dollar);
                    i += 1;
                }
            },
        }
    }
    out
}

/// Could a `u` pattern match starting at a LONE LOW SURROGATE, i.e. inside a surrogate pair? Only then does
/// V8's code-unit step after a failed attempt find anything `regress` would not, so only then is the costly
/// mid-pair scan in `search` run. Without this, a `u` pattern over n astral characters cost O(n²): 0.34 s for
/// one failed test over 8,000 emoji, and a `phonemize` call over 4,000 took 48 s.
///
/// ⚠ CONSERVATIVE: `false` must mean "cannot", and anything unrecognised is "may". A match there must be
/// zero-width, or begin by consuming that surrogate. So the leading assertions are skipped, and the answer is
/// whether the first consuming atom can match a lone low surrogate (`.`, a negated class, `\S`, a range over
/// U+DC00–U+DFFF, a group or backreference that may) or can be skipped (a `*`/`?`/`{0,}` atom).
fn may_start_mid_pair(pattern: &str) -> bool {
    let p: Vec<char> = pattern.chars().collect();
    let mut i = 0;
    alternation_may(&p, &mut i)
}

/// An alternation up to `)` or the end; `i` is left on the `)`.
fn alternation_may(p: &[char], i: &mut usize) -> bool {
    let mut may = false;
    loop {
        may |= sequence_may(p, i);
        if *i < p.len() && p[*i] == '|' {
            *i += 1;
            continue;
        }
        return may;
    }
}

/// One branch: `true` if it may match zero-width or begin with a lone low surrogate. Consumes the branch.
fn sequence_may(p: &[char], i: &mut usize) -> bool {
    let mut decided: Option<bool> = None;
    while *i < p.len() && p[*i] != '|' && p[*i] != ')' {
        let (atom, zero_width) = atom_may(p, i);
        let min_zero = quantifier_min_zero(p, i);
        if decided.is_some() {
            continue;
        }
        if zero_width {
            continue; // an assertion consumes nothing: the next atom decides
        }
        if atom {
            decided = Some(true);
        } else if !min_zero {
            decided = Some(false);
        }
    }
    decided.unwrap_or(true) // every atom skippable or zero-width: a zero-width match is possible
}

/// Parse one atom at `i`: (may match a lone low surrogate, is a zero-width assertion).
fn atom_may(p: &[char], i: &mut usize) -> (bool, bool) {
    let c = p[*i];
    *i += 1;
    match c {
        '^' | '$' => (false, true),
        '.' => (true, false),
        '[' => (class_may(p, i), false),
        '(' => {
            let mut lookaround = false;
            if p.get(*i) == Some(&'?') {
                match (p.get(*i + 1), p.get(*i + 2)) {
                    (Some(':'), _) => *i += 2,
                    (Some('='), _) | (Some('!'), _) => {
                        *i += 2;
                        lookaround = true;
                    }
                    (Some('<'), Some('=')) | (Some('<'), Some('!')) => {
                        *i += 3;
                        lookaround = true;
                    }
                    (Some('<'), _) => {
                        while *i < p.len() && p[*i] != '>' {
                            *i += 1;
                        }
                        *i += 1;
                    }
                    _ => {}
                }
            }
            let inner = alternation_may(p, i);
            *i += 1; // ')'
            if lookaround {
                (false, true)
            } else {
                (inner, false)
            }
        }
        '\\' => escape_may(p, i, false),
        _ => (false, false), // a literal: never a lone surrogate (an astral one starts at a pair start)
    }
}

/// After a `\`: (may match a lone low surrogate, is zero-width).
fn escape_may(p: &[char], i: &mut usize, in_class: bool) -> (bool, bool) {
    let Some(&c) = p.get(*i) else {
        return (true, false);
    };
    *i += 1;
    match c {
        'b' | 'B' if !in_class => (false, true),
        'd' | 'w' | 's' => (false, false),
        'D' | 'W' | 'S' => (true, false),
        'p' | 'P' => {
            let mut body = String::new();
            if p.get(*i) == Some(&'{') {
                *i += 1;
                while *i < p.len() && p[*i] != '}' {
                    body.push(p[*i]);
                    *i += 1;
                }
                *i += 1;
            }
            // \P{..} or a property that holds surrogates may; the letter/mark/number/script classes cannot.
            let surrogate_free = !body.contains("Cs")
                && !body.contains("Surrogate")
                && body != "C"
                && body != "Other"
                && body != "Any"
                && !body.contains("Unknown")
                && !body.contains("Zzzz");
            (c == 'P' || !surrogate_free, false)
        }
        'u' => {
            if p.get(*i) == Some(&'{') {
                let mut hex = String::new();
                *i += 1;
                while *i < p.len() && p[*i] != '}' {
                    hex.push(p[*i]);
                    *i += 1;
                }
                *i += 1;
                let v = u32::from_str_radix(&hex, 16).unwrap_or(0xDC00);
                return ((0xDC00..=0xDFFF).contains(&v), false);
            }
            let hex: String = p.iter().skip(*i).take(4).collect();
            *i += hex.len();
            let v = u32::from_str_radix(&hex, 16).unwrap_or(0xDC00);
            // A high surrogate escape followed by a low one is one pair in `u` mode: it starts at a pair start.
            ((0xDC00..=0xDFFF).contains(&v), false)
        }
        'k' | '1'..='9' => (true, false), // a backreference may be empty or anything
        _ => (false, false), // \t, \n, \x41, \., \/ … : one fixed non-surrogate character
    }
}

/// A character class from after its `[` through its `]`.
fn class_may(p: &[char], i: &mut usize) -> bool {
    let negated = p.get(*i) == Some(&'^');
    if negated {
        *i += 1;
    }
    let mut may = false;
    let mut prev: Option<u32> = None;
    while *i < p.len() && p[*i] != ']' {
        let c = p[*i];
        if c == '-' && prev.is_some() && p.get(*i + 1).is_some_and(|&n| n != ']') {
            *i += 1;
            let hi = class_char(p, i, &mut may);
            if let (Some(lo), Some(hi)) = (prev, hi) {
                if lo <= 0xDFFF && hi >= 0xDC00 {
                    may = true;
                }
            }
            prev = None;
            continue;
        }
        prev = class_char(p, i, &mut may);
    }
    *i += 1; // ']'
    negated || may
}

/// One class member: its code point, or `None` for a class escape (whose answer goes into `may`).
fn class_char(p: &[char], i: &mut usize, may: &mut bool) -> Option<u32> {
    let c = p[*i];
    *i += 1;
    if c != '\\' {
        return Some(c as u32);
    }
    match p.get(*i) {
        Some('u') if p.get(*i + 1) != Some(&'{') => {
            let hex: String = p.iter().skip(*i + 1).take(4).collect();
            *i += 1 + hex.len();
            u32::from_str_radix(&hex, 16).ok()
        }
        Some('u') => {
            *i += 2;
            let mut hex = String::new();
            while *i < p.len() && p[*i] != '}' {
                hex.push(p[*i]);
                *i += 1;
            }
            *i += 1;
            u32::from_str_radix(&hex, 16).ok()
        }
        Some('x') => {
            let hex: String = p.iter().skip(*i + 1).take(2).collect();
            *i += 1 + hex.len();
            u32::from_str_radix(&hex, 16).ok()
        }
        Some(_) => {
            let (m, _) = escape_may(p, i, true);
            *may |= m;
            None
        }
        None => None,
    }
}

/// Consume a quantifier after an atom; `true` if it allows zero repetitions.
fn quantifier_min_zero(p: &[char], i: &mut usize) -> bool {
    let zero = match p.get(*i) {
        Some('*') | Some('?') => {
            *i += 1;
            true
        }
        Some('+') => {
            *i += 1;
            false
        }
        Some('{') => {
            let start = *i;
            let mut j = *i + 1;
            let mut digits = String::new();
            while j < p.len() && p[j].is_ascii_digit() {
                digits.push(p[j]);
                j += 1;
            }
            let rest_ok = matches!(p.get(j), Some('}') | Some(','));
            if digits.is_empty() || !rest_ok {
                return false; // a literal `{`, consumed as its own atom next time round
            }
            while j < p.len() && p[j] != '}' {
                j += 1;
            }
            *i = j + 1;
            let _ = start;
            digits.parse::<u64>().map_or(true, |n| n == 0)
        }
        _ => return false,
    };
    if p.get(*i) == Some(&'?') {
        *i += 1; // lazy
    }
    zero
}

/// AdvanceStringIndex: one code point under `u`, one code unit otherwise.
fn advance(s: &[u16], i: usize, unicode: bool) -> usize {
    if unicode && i + 1 < s.len() && is_high(s[i]) && is_low(s[i + 1]) {
        i + 2
    } else {
        i + 1
    }
}

/// `(?<name>` groups, numbered by their opening parenthesis among the capturing ones.
fn named_groups(pattern: &str) -> Vec<(String, usize)> {
    let p: Vec<char> = pattern.chars().collect();
    let (mut out, mut n, mut i, mut in_class) = (Vec::new(), 0, 0, false);
    while i < p.len() {
        match p[i] {
            '\\' => i += 1,
            '[' => in_class = true,
            ']' => in_class = false,
            '(' if !in_class => {
                if p.get(i + 1) != Some(&'?') {
                    n += 1;
                } else if p.get(i + 2) == Some(&'<')
                    && !matches!(p.get(i + 3), Some('=') | Some('!'))
                {
                    n += 1;
                    let name: String = p[i + 3..].iter().take_while(|&&c| c != '>').collect();
                    out.push((name, n));
                }
            }
            _ => {}
        }
        i += 1;
    }
    out
}

/// A legacy-`/i` pattern may run with `ASCII_FOLDERS` remapped to `INERT` only if nothing in it can tell
/// them apart: no literal, `\u` escape or class range touches any of the four code points.
fn legacy_fold_guard(pattern: &str) -> Result<(), String> {
    let watched: Vec<u32> = ASCII_FOLDERS
        .iter()
        .chain(std::iter::once(&INERT))
        .map(|&u| u as u32)
        .collect();
    let p: Vec<char> = pattern.chars().collect();
    // Decode one atom at i: (code point, width), or None for an escape that names a class.
    let atom = |i: usize| -> Option<(u32, usize)> {
        if p[i] != '\\' {
            return Some((p[i] as u32, 1));
        }
        match p.get(i + 1)? {
            'u' => {
                let hex: String = p.get(i + 2..i + 6)?.iter().collect();
                u32::from_str_radix(&hex, 16).ok().map(|v| (v, 6))
            }
            'x' => {
                let hex: String = p.get(i + 2..i + 4)?.iter().collect();
                u32::from_str_radix(&hex, 16).ok().map(|v| (v, 4))
            }
            c if c.is_ascii_alphanumeric() => None,
            &c => Some((c as u32, 2)),
        }
    };
    let width = |i: usize| -> usize {
        if p[i] != '\\' {
            1
        } else {
            atom(i).map_or(2, |(_, w)| w)
        }
    };
    let (mut i, mut in_class) = (0, false);
    while i < p.len() {
        if !in_class && p[i] == '[' {
            in_class = true;
            i += 1;
            continue;
        }
        if in_class && p[i] == ']' {
            in_class = false;
            i += 1;
            continue;
        }
        let w = width(i);
        let here = atom(i);
        if let Some((lo, _)) = here {
            if watched.contains(&lo) {
                return Err(format!("literal U+{lo:04X} under legacy /i"));
            }
            if in_class && p.get(i + w) == Some(&'-') && i + w + 1 < p.len() && p[i + w + 1] != ']'
            {
                if let Some((hi, w2)) = atom(i + w + 1) {
                    if let Some(c) = watched.iter().find(|&&c| lo <= c && c <= hi) {
                        return Err(format!(
                            "range U+{lo:04X}-U+{hi:04X} spans U+{c:04X} under legacy /i"
                        ));
                    }
                    i += w + 1 + w2;
                    continue;
                }
            }
        }
        i += w;
    }
    Ok(())
}

/// A pattern compiled once per call site: `js_re!("\\d+", "gu")` yields a `&'static JsRegex`.
/// ⚠ The pattern string is the TypeScript source's, VERBATIM (as a Rust literal of the same characters).
#[macro_export]
macro_rules! js_re {
    ($pattern:expr, $flags:expr) => {{
        static RE: ::std::sync::OnceLock<$crate::core::js_regex::JsRegex> =
            ::std::sync::OnceLock::new();
        RE.get_or_init(|| {
            $crate::core::js_regex::JsRegex::new($pattern, $flags)
                .unwrap_or_else(|e| panic!("js_re!: {e}"))
        })
    }};
    ($pattern:expr) => {
        $crate::js_re!($pattern, "")
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    #[test]
    fn digit_class_is_ascii() {
        let re = JsRegex::new(r"\d+", "gu").unwrap();
        let s = js("12 ৩৫ 7");
        let got: Vec<_> = re.match_all(&s).iter().map(|m| m.value(&s)).collect();
        assert_eq!(got, vec![js("12"), js("7")]);
    }

    #[test]
    fn legacy_icase_refuses_ascii_folds() {
        let re = JsRegex::new("^[bcdfgmpst]", "i").unwrap();
        assert!(!re.test(&js("ſt")));
        assert!(re.test(&js("St")));
        assert!(JsRegex::new("[ſ]", "i").is_err());
        assert!(JsRegex::new(r"[Ā-ſ]", "i").is_err());
        assert!(JsRegex::new("[à-ÿ]", "i").is_ok());
    }

    #[test]
    fn substitution_patterns() {
        let re = JsRegex::new(r"(\w+)\s(?<b>\w+)", "").unwrap();
        let s = js("hello world!");
        assert_eq!(
            re.replace(&s, &js("$2 $1 [$&] $<b> $$ $3")),
            "world hello [hello world] world $ $3!"
        );
    }

    #[test]
    fn empty_global_matches_advance_by_code_point() {
        let re = JsRegex::new("", "gu").unwrap();
        assert_eq!(re.match_all(&js("a😀")).len(), 3);
        let re = JsRegex::new("", "g").unwrap();
        assert_eq!(re.match_all(&js("a😀")).len(), 4);
    }
}
