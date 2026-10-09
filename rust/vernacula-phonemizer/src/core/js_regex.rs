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
        self.groups.get(i - 1)?.as_ref().map(|r| JsString::from_units(&s.0[r.clone()]))
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
                _ => return Err(JsRegexError::Syntax(format!("unknown flag '{f}' in /{pattern}/{flags}"))),
            }
        }
        let legacy_icase = icase && !unicode;
        if legacy_icase {
            legacy_fold_guard(pattern).map_err(|e| JsRegexError::Unsupported(format!("/{pattern}/{flags}: {e}")))?;
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
            names,
        })
    }

    /// The subject as the engine should see it (see `ASCII_FOLDERS`).
    fn subject<'a>(&self, s: &'a [u16]) -> std::borrow::Cow<'a, [u16]> {
        if self.legacy_icase && s.iter().any(|u| ASCII_FOLDERS.contains(u)) {
            std::borrow::Cow::Owned(s.iter().map(|&u| if ASCII_FOLDERS.contains(&u) { INERT } else { u }).collect())
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
        if !self.unicode {
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
        JsMatch { range: m.range(), groups: m.captures.clone() }
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
            let Some(m) = self.search(&subject, pos) else { break };
            if self.sticky && m.start() != pos {
                break;
            }
            pos = if m.end() > m.start() { m.end() } else { advance(&subject, m.start(), self.unicode) };
            out.push(Self::to_match(m));
        }
        out
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
    pub fn replace_with(&self, s: &JsString, mut f: impl FnMut(&JsMatch, &JsString) -> JsString) -> JsString {
        let matches = if self.global { self.match_all(s) } else { self.exec(s).into_iter().collect() };
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

    /// ECMAScript GetSubstitution: `$$`, `$&`, `` $` ``, `$'`, `$n`/`$nn`, `$<name>`.
    pub fn substitute(&self, m: &JsMatch, s: &JsString, replacement: &JsString) -> JsString {
        let r = &replacement.0;
        let ncap = m.groups.len();
        let mut out = JsString::new();
        let mut i = 0;
        let dollar = b'$' as u16;
        let digit = |u: u16| (b'0' as u16..=b'9' as u16).contains(&u).then(|| (u - b'0' as u16) as usize);
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
                0x3C if !self.names.is_empty() => {
                    let close = r[i + 2..].iter().position(|&u| u == b'>' as u16);
                    match close {
                        None => {
                            out.0.push(dollar);
                            i += 1;
                        }
                        Some(c) => {
                            let name = String::from_utf16_lossy(&r[i + 2..i + 2 + c]);
                            if let Some(g) = self.group_index(&name).and_then(|g| m.group(g, s)) {
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
}

/// AdvanceStringIndex: one code point under `u`, one code unit otherwise.
fn advance(s: &[u16], i: usize, unicode: bool) -> usize {
    if unicode && i + 1 < s.len() && is_high(s[i]) && is_low(s[i + 1]) { i + 2 } else { i + 1 }
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
                } else if p.get(i + 2) == Some(&'<') && !matches!(p.get(i + 3), Some('=') | Some('!')) {
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
    let watched: Vec<u32> = ASCII_FOLDERS.iter().chain(std::iter::once(&INERT)).map(|&u| u as u32).collect();
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
            if in_class && p.get(i + w) == Some(&'-') && i + w + 1 < p.len() && p[i + w + 1] != ']' {
                if let Some((hi, w2)) = atom(i + w + 1) {
                    if let Some(c) = watched.iter().find(|&&c| lo <= c && c <= hi) {
                        return Err(format!("range U+{lo:04X}-U+{hi:04X} spans U+{c:04X} under legacy /i"));
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
        static RE: ::std::sync::OnceLock<$crate::core::js_regex::JsRegex> = ::std::sync::OnceLock::new();
        RE.get_or_init(|| {
            $crate::core::js_regex::JsRegex::new($pattern, $flags).unwrap_or_else(|e| panic!("js_re!: {e}"))
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
        assert_eq!(re.replace(&s, &js("$2 $1 [$&] $<b> $$ $3")), "world hello [hello world] world $ $3!");
    }

    #[test]
    fn empty_global_matches_advance_by_code_point() {
        let re = JsRegex::new("", "gu").unwrap();
        assert_eq!(re.match_all(&js("a😀")).len(), 3);
        let re = JsRegex::new("", "g").unwrap();
        assert_eq!(re.match_all(&js("a😀")).len(), 4);
    }
}
