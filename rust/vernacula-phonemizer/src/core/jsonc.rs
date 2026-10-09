//! JSONC: JSON plus `//` and `/* */` comments and trailing commas, stripped before a strict parse.
//! Ported from src/core/jsonc.ts.
//!
//! ⚠ An object parses insertion-ordered (`serde_json` `preserve_order`), but JS orders INTEGER-LIKE keys
//! first, ascending. A port that iterates a manifest object keyed by digits has to reproduce that.

pub fn strip_jsonc(src: &str) -> String {
    let s: Vec<char> = src.chars().collect();
    let n = s.len();
    let at = |i: usize| s.get(i).copied();
    let mut out = String::with_capacity(src.len());
    let mut i = 0;
    // Skip a `//` or `/* */` comment starting at j; the index after it, or None if none starts there.
    let skip_comment = |j: usize| -> Option<usize> {
        if at(j) == Some('/') && at(j + 1) == Some('/') {
            let mut k = j + 2;
            while k < n && s[k] != '\n' {
                k += 1;
            }
            Some(k)
        } else if at(j) == Some('/') && at(j + 1) == Some('*') {
            let mut k = j + 2;
            while k < n && !(s[k] == '*' && at(k + 1) == Some('/')) {
                k += 1;
            }
            Some(k + 2)
        } else {
            None
        }
    };
    while i < n {
        let c = s[i];
        if c == '"' {
            out.push(c);
            i += 1;
            while i < n {
                let d = s[i];
                out.push(d);
                if d == '\\' {
                    if let Some(e) = at(i + 1) {
                        out.push(e);
                    }
                    i += 2;
                    continue;
                }
                i += 1;
                if d == '"' {
                    break;
                }
            }
            continue;
        }
        if let Some(k) = skip_comment(i) {
            i = k;
            continue;
        }
        if c == ',' {
            let mut j = i + 1;
            loop {
                while j < n && " \t\r\n".contains(s[j]) {
                    j += 1;
                }
                match skip_comment(j) {
                    Some(k) => j = k,
                    None => break,
                }
            }
            if matches!(at(j), Some('}') | Some(']')) {
                i += 1;
                continue;
            }
        }
        out.push(c);
        i += 1;
    }
    out
}

pub fn parse_jsonc<T: serde::de::DeserializeOwned>(src: &str) -> Result<T, serde_json::Error> {
    serde_json::from_str(&strip_jsonc(src))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_comments_and_trailing_commas() {
        let v: serde_json::Value =
            parse_jsonc("{ \"a\": \"//not\", // c\n \"b\": [1, 2, /* x */ ], }").unwrap();
        assert_eq!(v, serde_json::json!({"a": "//not", "b": [1, 2]}));
    }
}
