//! A JavaScript string: a sequence of UTF-16 code units, lone surrogates allowed.
//!
//! ⚠ THE ENGINE'S STRINGS ARE NOT `String`. Every index, length and slice in the TypeScript counts UTF-16
//! code units, and some paths build strings holding an unpaired surrogate, which a `String` cannot hold.
//! Porting onto UTF-8 would turn every `.length` comparison over IPA into a silent divergence. So the
//! engine's strings are `JsString`, and `String` exists only at the public API boundary.

use std::fmt;

#[derive(Clone, Default, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct JsString(pub Vec<u16>);

impl JsString {
    pub fn new() -> Self {
        JsString(Vec::new())
    }

    pub fn from_units(units: &[u16]) -> Self {
        JsString(units.to_vec())
    }

    pub fn units(&self) -> &[u16] {
        &self.0
    }

    /// `s.length`: code units, not characters.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// `s.charCodeAt(i)`; `None` where JS returns NaN.
    pub fn char_code_at(&self, i: usize) -> Option<u16> {
        self.0.get(i).copied()
    }

    /// `s.codePointAt(i)`: a pair starting at `i` decodes, and a lone half is returned as itself.
    pub fn code_point_at(&self, i: usize) -> Option<u32> {
        let hi = *self.0.get(i)?;
        if is_high(hi) {
            if let Some(&lo) = self.0.get(i + 1) {
                if is_low(lo) {
                    return Some(0x10000 + (((hi as u32) - 0xD800) << 10) + ((lo as u32) - 0xDC00));
                }
            }
        }
        Some(hi as u32)
    }

    /// `s[i]` / `s.charAt(i)`: one code unit, as a string (empty when out of range, as `charAt`).
    pub fn char_at(&self, i: usize) -> JsString {
        match self.0.get(i) {
            Some(&u) => JsString(vec![u]),
            None => JsString::new(),
        }
    }

    /// `s.slice(start, end)` with JS's negative-index and clamping rules.
    pub fn slice(&self, start: isize, end: Option<isize>) -> JsString {
        let len = self.0.len() as isize;
        let clamp = |i: isize| if i < 0 { (len + i).max(0) } else { i.min(len) } as usize;
        let from = clamp(start);
        let to = end.map_or(self.0.len(), clamp);
        if from >= to { JsString::new() } else { JsString(self.0[from..to].to_vec()) }
    }

    /// `s.substring(start, end)`: negatives clamp to 0 and the bounds swap if reversed.
    pub fn substring(&self, start: usize, end: Option<usize>) -> JsString {
        let len = self.0.len();
        let (mut a, mut b) = (start.min(len), end.map_or(len, |e| e.min(len)));
        if a > b {
            std::mem::swap(&mut a, &mut b);
        }
        JsString(self.0[a..b].to_vec())
    }

    /// `s.indexOf(needle, from)`.
    pub fn index_of(&self, needle: &JsString, from: usize) -> Option<usize> {
        let (h, n) = (&self.0, &needle.0);
        let from = from.min(h.len());
        if n.is_empty() {
            return Some(from);
        }
        if n.len() > h.len() {
            return None;
        }
        (from..=h.len() - n.len()).find(|&i| h[i..i + n.len()] == n[..])
    }

    /// `s.lastIndexOf(needle)`.
    pub fn last_index_of(&self, needle: &JsString) -> Option<usize> {
        let (h, n) = (&self.0, &needle.0);
        if n.len() > h.len() {
            return None;
        }
        (0..=h.len() - n.len()).rev().find(|&i| h[i..i + n.len()] == n[..])
    }

    /// `s.includes(needle)`: true for the empty needle, as in JS.
    pub fn includes(&self, needle: &JsString) -> bool {
        self.index_of(needle, 0).is_some()
    }

    pub fn starts_with(&self, prefix: &JsString) -> bool {
        self.0.starts_with(&prefix.0)
    }

    pub fn ends_with(&self, suffix: &JsString) -> bool {
        self.0.ends_with(&suffix.0)
    }

    pub fn push_str(&mut self, other: &JsString) {
        self.0.extend_from_slice(&other.0);
    }

    pub fn push_units(&mut self, units: &[u16]) {
        self.0.extend_from_slice(units);
    }

    pub fn concat(&self, other: &JsString) -> JsString {
        let mut v = Vec::with_capacity(self.0.len() + other.0.len());
        v.extend_from_slice(&self.0);
        v.extend_from_slice(&other.0);
        JsString(v)
    }

    /// `s.split(sep)` for a string separator; the empty separator splits into code units.
    pub fn split(&self, sep: &JsString) -> Vec<JsString> {
        if sep.is_empty() {
            return self.0.iter().map(|&u| JsString(vec![u])).collect();
        }
        let mut out = Vec::new();
        let mut start = 0;
        while let Some(i) = self.index_of(sep, start) {
            out.push(JsString(self.0[start..i].to_vec()));
            start = i + sep.len();
        }
        out.push(JsString(self.0[start..].to_vec()));
        out
    }

    /// `parts.join(sep)`.
    pub fn join(parts: &[JsString], sep: &JsString) -> JsString {
        let mut out = JsString::new();
        for (i, p) in parts.iter().enumerate() {
            if i > 0 {
                out.push_str(sep);
            }
            out.push_str(p);
        }
        out
    }

    /// `s.trim()` over the ECMAScript WhiteSpace + LineTerminator set.
    pub fn trim(&self) -> JsString {
        let v = &self.0;
        let start = v.iter().position(|&u| !is_js_space(u)).unwrap_or(v.len());
        let end = v.iter().rposition(|&u| !is_js_space(u)).map_or(start, |e| e + 1);
        JsString(v[start..end].to_vec())
    }

    /// Code points, as `for (const ch of s)` yields them (a lone half is its own item).
    pub fn code_points(&self) -> CodePoints<'_> {
        CodePoints { units: &self.0, pos: 0 }
    }

    /// `s.toLowerCase()`: full Unicode mapping, context-sensitive final sigma included. A lone surrogate
    /// passes through unchanged.
    pub fn to_lower_case(&self) -> JsString {
        self.map_case(|s| s.to_lowercase())
    }

    /// `s.toUpperCase()`.
    pub fn to_upper_case(&self) -> JsString {
        self.map_case(|s| s.to_uppercase())
    }

    fn map_case(&self, f: impl Fn(&str) -> String) -> JsString {
        // Map each well-formed run as one `str`, so context (final sigma) sees its neighbours.
        let mut out = JsString::new();
        let mut run: Vec<u16> = Vec::new();
        let mut cps = self.code_points();
        while let Some(cp) = cps.next() {
            if (0xD800..=0xDFFF).contains(&cp) {
                if !run.is_empty() {
                    out.push_str(&JsString::from(f(&String::from_utf16(&run).unwrap()).as_str()));
                    run.clear();
                }
                out.0.push(cp as u16);
            } else {
                let mut buf = [0u16; 2];
                run.extend_from_slice(char::from_u32(cp).unwrap().encode_utf16(&mut buf));
            }
        }
        if !run.is_empty() {
            out.push_str(&JsString::from(f(&String::from_utf16(&run).unwrap()).as_str()));
        }
        out
    }

    /// Lossy conversion for the API boundary: a lone surrogate becomes U+FFFD.
    pub fn to_string_lossy(&self) -> String {
        String::from_utf16_lossy(&self.0)
    }
}

pub struct CodePoints<'a> {
    units: &'a [u16],
    pos: usize,
}

impl Iterator for CodePoints<'_> {
    type Item = u32;
    fn next(&mut self) -> Option<u32> {
        let hi = *self.units.get(self.pos)?;
        if is_high(hi) {
            if let Some(&lo) = self.units.get(self.pos + 1) {
                if is_low(lo) {
                    self.pos += 2;
                    return Some(0x10000 + (((hi as u32) - 0xD800) << 10) + ((lo as u32) - 0xDC00));
                }
            }
        }
        self.pos += 1;
        Some(hi as u32)
    }
}

pub fn is_high(u: u16) -> bool {
    (0xD800..=0xDBFF).contains(&u)
}

pub fn is_low(u: u16) -> bool {
    (0xDC00..=0xDFFF).contains(&u)
}

/// ECMAScript WhiteSpace + LineTerminator: what `\s` and `trim()` mean. U+FEFF is in, U+0085 is out.
pub fn is_js_space(u: u16) -> bool {
    matches!(u, 0x09..=0x0D | 0x20 | 0xA0 | 0x1680 | 0x2000..=0x200A | 0x2028 | 0x2029 | 0x202F | 0x205F | 0x3000 | 0xFEFF)
}

impl From<&str> for JsString {
    fn from(s: &str) -> Self {
        JsString(s.encode_utf16().collect())
    }
}

impl From<String> for JsString {
    fn from(s: String) -> Self {
        JsString::from(s.as_str())
    }
}

impl From<&[u16]> for JsString {
    fn from(u: &[u16]) -> Self {
        JsString(u.to_vec())
    }
}

impl PartialEq<str> for JsString {
    fn eq(&self, other: &str) -> bool {
        self.0.iter().copied().eq(other.encode_utf16())
    }
}

impl PartialEq<&str> for JsString {
    fn eq(&self, other: &&str) -> bool {
        self == *other
    }
}

impl fmt::Display for JsString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_string_lossy())
    }
}

impl fmt::Debug for JsString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.to_string_lossy())
    }
}

/// `js("…")`: a `JsString` from a literal.
pub fn js(s: &str) -> JsString {
    JsString::from(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn length_counts_code_units() {
        assert_eq!(js("ɹˈɛd").len(), 4);
        assert_eq!(js("😀").len(), 2);
    }

    #[test]
    fn slice_follows_js_rules() {
        let s = js("abcdef");
        assert_eq!(s.slice(-2, None), "ef");
        assert_eq!(s.slice(1, Some(-1)), "bcde");
        assert_eq!(s.slice(4, Some(2)), "");
        assert_eq!(s.substring(4, Some(2)), "cd");
    }

    #[test]
    fn lowercase_is_full_and_contextual() {
        // U+0130 is length-changing (#1116); a word-final sigma takes its final form.
        assert_eq!(js("İ").to_lower_case(), "i\u{307}");
        assert_eq!(js("ΟΔΟΣ").to_lower_case(), "οδος");
    }

    #[test]
    fn lone_surrogate_survives() {
        let s = JsString(vec![0xD83D, 0x61]);
        assert_eq!(s.to_upper_case().0, vec![0xD83D, 0x41]);
        assert_eq!(s.code_points().collect::<Vec<_>>(), vec![0xD83D, 0x61]);
    }

    #[test]
    fn split_and_trim() {
        assert_eq!(js("a\tb\t").split(&js("\t")), vec![js("a"), js("b"), js("")]);
        assert_eq!(js("\u{FEFF} x \u{85}").trim(), "x \u{85}");
    }
}
