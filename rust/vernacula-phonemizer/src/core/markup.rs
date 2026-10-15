//! Markup stripped before any engine reads the text: LaTeX commands and braces, wikitable syntax, HTML
//! tags (with `<sup>` digits kept as superscripts) and character entities. Ported from src/core/markup.ts.

use super::js_string::{JsString, js};
use super::provenance::{rewrite, rewrite_with};
use crate::js_re;

const NAMED: [(&str, &str); 46] = [
    ("amp", "&"),
    ("lt", "<"),
    ("gt", ">"),
    ("quot", "\""),
    ("apos", "'"),
    ("nbsp", "\u{a0}"),
    ("laquo", "«"),
    ("raquo", "»"),
    ("ldquo", "“"),
    ("rdquo", "”"),
    ("lsquo", "‘"),
    ("rsquo", "’"),
    ("hellip", "…"),
    ("ndash", "–"),
    ("mdash", "—"),
    ("deg", "°"),
    ("times", "×"),
    ("middot", "·"),
    ("euro", "€"),
    ("pound", "£"),
    ("yen", "¥"),
    ("sup1", "¹"),
    ("sup2", "²"),
    ("sup3", "³"),
    ("frac12", "½"),
    ("frac14", "¼"),
    ("frac34", "¾"),
    ("minus", "−"),
    ("plusmn", "±"),
    ("micro", "µ"),
    ("permil", "‰"),
    ("cent", "¢"),
    ("thinsp", "\u{2009}"),
    ("bull", " "),
    ("lrm", "\u{200e}"),
    ("zwnj", "\u{200c}"),
    ("aacute", "á"),
    ("agrave", "à"),
    ("ccedil", "ç"),
    ("eacute", "é"),
    ("egrave", "è"),
    ("ecirc", "ê"),
    ("iacute", "í"),
    ("icirc", "î"),
    ("ocirc", "ô"),
    ("ograve", "ò"),
];

fn sup(c: u32) -> Option<&'static str> {
    Some(match char::from_u32(c)? {
        '0' => "\u{2070}",
        '1' => "\u{00b9}",
        '2' => "\u{00b2}",
        '3' => "\u{00b3}",
        '4' => "\u{2074}",
        '5' => "\u{2075}",
        '6' => "\u{2076}",
        '7' => "\u{2077}",
        '8' => "\u{2078}",
        '9' => "\u{2079}",
        '-' => "\u{207b}",
        '+' => "\u{207a}",
        _ => return None,
    })
}

/// `Number.parseInt(digits, radix)` for an all-digit body; `None` past `u64` stands for "huge" (> 0x10FFFF).
fn parse_int(body: &JsString, radix: u32) -> Option<u64> {
    let s = body.to_string_lossy();
    let digits: String = s.chars().take_while(|c| c.is_digit(radix)).collect();
    if digits.is_empty() {
        return None;
    }
    Some(u64::from_str_radix(&digits, radix).unwrap_or(u64::MAX))
}

pub fn strip_markup(text: &JsString) -> JsString {
    if !["<", "&", "|", "!", "\\", "{", "}"]
        .iter()
        .any(|c| text.includes(&js(c)))
    {
        return text.clone();
    }
    let mut s = if js_re!(r"\\[a-zA-Z]+", "u").test(text) {
        let t = rewrite(text, js_re!(r"\\[a-zA-Z]+\s?", "gu"), &js(" "));
        rewrite(&t, js_re!("[{}]", "gu"), &js(" "))
    } else {
        text.clone()
    };
    s = rewrite(
        &s,
        js_re!(
            r#"^[ \t]*\{\|[^\n]*|\|\}|^[ \t]*\|(?:[a-zA-Z-]+=(?:"[^"\n]*"|'[^'\n]*'|[^|\s]+)[ \t]*)*\|?|\|\|"#,
            "gmu"
        ),
        &js(" "),
    );
    s = rewrite_with(&s, js_re!(r"<sup>([+-]?\d+)<\/sup>", "giu"), |m, s| {
        let d = m.group(1, s).unwrap();
        let mut out = JsString::new();
        for cp in d.code_points() {
            out.push_str(&js(
                sup(cp).unwrap_or(&char::from_u32(cp).unwrap().to_string())
            ));
        }
        out
    });
    // A known element name and `name=value` attributes only: prose in angle brackets is not a tag.
    s = rewrite(
        &s,
        js_re!(
            r#"<\/?(?:a|abbr|b|bdi|bdo|big|blockquote|body|br|caption|center|chem|cite|code|col|colgroup|dd|del|dfn|div|dl|dt|em|font|gallery|h[1-6]|head|hr|html|i|img|includeonly|ins|kbd|li|mark|math|noinclude|nowiki|ol|onlyinclude|p|poem|pre|q|rb|ref|references|rp|rt|ruby|s|samp|score|section|small|source|span|strike|strong|sub|sup|syntaxhighlight|table|tbody|td|templatestyles|tfoot|th|thead|time|timeline|title|tr|tt|u|ul|var|wbr)(?:\s+[a-zA-Z_:][a-zA-Z0-9_:.-]*\s*=\s*(?:"[^"<>]*"|'[^'<>]*'|[^\s"'<>=]+))*\s*\/?>"#,
            "giu"
        ),
        &JsString::new(),
    );
    // Prose in angle brackets reads as parentheses; most engines read a lone `<` or `>` as a comparison.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{N}])<(?=[^\s<>])([^<>]*\p{L}[^<>]*)(?<=[^\s<>])>(?![\p{L}\p{N}])",
            "gu"
        ),
        |m, s| {
            let mut out = js("(");
            out.push_str(&m.group(1, s).unwrap());
            out.push_str(&js(")"));
            out
        },
    );
    rewrite_with(
        &s,
        js_re!(r"&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);", "gu"),
        |m, s| {
            let whole = m.value(s);
            let body = m.group(1, s).unwrap();
            if body.starts_with(&js("#")) {
                let hex = body.char_at(1) == "x" || body.char_at(1) == "X";
                let cp = if hex {
                    parse_int(&body.slice(2, None), 16)
                } else {
                    parse_int(&body.slice(1, None), 10)
                };
                return match cp.filter(|&cp| cp > 0 && cp <= 0x10ffff) {
                    Some(cp) => match char::from_u32(cp as u32) {
                        Some(c) => js(&c.to_string()),
                        None => JsString(vec![cp as u16]),
                    },
                    None => whole,
                };
            }
            let lower = body.to_lower_case();
            NAMED
                .iter()
                .find(|(k, _)| lower == *k)
                .map_or(whole, |(_, v)| js(v))
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ported from test/markup-angle-prose.test.ts. All inputs are synthetic.
    #[test]
    fn angle_bracketed_prose_is_read_and_real_tags_are_stripped() {
        for (input, want) in [
            (
                "Before <a longer note here> after.",
                "Before (a longer note here) after.",
            ),
            (
                "<Question for the team: was the widget tested?>",
                "(Question for the team: was the widget tested?)",
            ),
            ("<I think so>", "(I think so)"),
            ("3 < 5 and 7 > 2", "3 < 5 and 7 > 2"),
            ("x<y and z>w", "x<y and z>w"),
            ("a lone < here", "a lone < here"),
            ("Year <i>2024</i> end", "Year 2024 end"),
            ("<B>bold</B>", "bold"),
            ("<a href=\"https://x.example/y\">link</a>", "link"),
            ("<br/>x<br />y<br>", "xy"),
            ("<ref name=\"n1\"/>z", "z"),
            ("<span class='q' style=\"c:r\">s</span>", "s"),
            ("<p class=lead>t</p>", "t"),
            ("2.802×10<sup>10</sup>", "2.802×10¹⁰"),
            ("km<sup>2</sup>", "km²"),
            ("4<sup>th</sup>", "4th"),
        ] {
            assert_eq!(strip_markup(&js(input)), js(want), "{input}");
        }
    }
}
