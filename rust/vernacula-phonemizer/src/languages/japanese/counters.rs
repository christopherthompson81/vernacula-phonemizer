//! Japanese number + counter (助数詞) fusion: gemination, rendaku/handaku, and the irregular counters.
//! Ported from src/languages/japanese/counters.ts — see that file for the corpus evidence.

use super::first_unit;
use super::numbers::{is_safe_integer, number_to_kana};
use crate::core::js_string::{JsString, js};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Cls {
    K,
    S,
    H,
    Regular,
}

struct Counter {
    reading: &'static str,
    cls: Cls,
    n4: Option<&'static str>,
    n7: Option<&'static str>,
    n9: Option<&'static str>,
    three: Option<&'static str>,
    narrow_three: bool,
    four: Option<&'static str>,
    irr: &'static [(u64, &'static str)],
    table: &'static [(u64, &'static str)],
}

const fn c(reading: &'static str, cls: Cls) -> Counter {
    Counter {
        reading,
        cls,
        n4: None,
        n7: None,
        n9: None,
        three: None,
        narrow_three: false,
        four: None,
        irr: &[],
        table: &[],
    }
}

const DAY: &[(u64, &str)] = &[
    (1, "ついたち"),
    (2, "ふつか"),
    (3, "みっか"),
    (4, "よっか"),
    (5, "いつか"),
    (6, "むいか"),
    (7, "なのか"),
    (8, "ようか"),
    (9, "ここのか"),
    (10, "とおか"),
    (14, "じゅうよっか"),
    (20, "はつか"),
    (24, "にじゅうよっか"),
];

const TSU: &[(u64, &str)] = &[
    (1, "ひとつ"),
    (2, "ふたつ"),
    (3, "みっつ"),
    (4, "よっつ"),
    (5, "いつつ"),
    (6, "むっつ"),
    (7, "ななつ"),
    (8, "やっつ"),
    (9, "ここのつ"),
];

fn counter(ch: &JsString) -> Option<Counter> {
    use Cls::*;
    // Lossy is safe: a lone surrogate becomes U+FFFD, which is no counter either.
    Some(match ch.to_string_lossy().as_str() {
        "つ" => Counter {
            table: TSU,
            ..c("つ", Regular)
        },
        "月" => Counter {
            n4: Some("し"),
            n7: Some("しち"),
            n9: Some("く"),
            ..c("がつ", Regular)
        },
        "時" => Counter {
            n4: Some("よ"),
            n7: Some("しち"),
            n9: Some("く"),
            ..c("じ", Regular)
        },
        "円" => Counter {
            n4: Some("よ"),
            ..c("えん", Regular)
        },
        "年" => Counter {
            n4: Some("よ"),
            ..c("ねん", Regular)
        },
        "人" => Counter {
            n4: Some("よ"),
            n7: Some("しち"),
            irr: &[(1, "ひとり"), (2, "ふたり")],
            ..c("にん", Regular)
        },
        "日" => Counter {
            n7: Some("しち"),
            n9: Some("く"),
            table: DAY,
            ..c("にち", Regular)
        },
        "分" => Counter {
            three: Some("ぷん"),
            four: Some("ぷん"),
            ..c("ふん", H)
        },
        "本" => c("ほん", H),
        "匹" => c("ひき", H),
        "杯" => c("はい", H),
        "泊" => Counter {
            three: Some("ぱく"),
            four: Some("ぱく"),
            ..c("はく", H)
        },
        "個" => c("こ", K),
        "回" => c("かい", K),
        "階" => Counter {
            three: Some("がい"),
            narrow_three: true,
            ..c("かい", K)
        },
        "軒" => Counter {
            three: Some("げん"),
            ..c("けん", K)
        },
        "歳" => c("さい", S),
        "冊" => c("さつ", S),
        "足" => Counter {
            three: Some("ぞく"),
            ..c("そく", S)
        },
        "枚" => c("まい", Regular),
        "番" => c("ばん", Regular),
        "度" => c("ど", Regular),
        "台" => c("だい", Regular),
        "名" => c("めい", Regular),
        "秒" => c("びょう", Regular),
        "羽" => c("わ", Regular),
        "頭" => c("とう", S),
        "着" => c("ちゃく", S),
        "丁" => c("ちょう", S),
        _ => return None,
    })
}

const H_TO_P: [(&str, &str); 5] = [
    ("は", "ぱ"),
    ("ひ", "ぴ"),
    ("ふ", "ぷ"),
    ("へ", "ぺ"),
    ("ほ", "ぽ"),
];
const H_TO_B: [(&str, &str); 5] = [
    ("は", "ば"),
    ("ひ", "び"),
    ("ふ", "ぶ"),
    ("へ", "べ"),
    ("ほ", "ぼ"),
];

/// `(MAP[r[0]] ?? r[0]) + r.slice(1)`, `r[0]` being one code unit.
fn shift_first(r: &str, map: &[(&str, &str); 5]) -> JsString {
    let r = js(r);
    let head = first_unit(&r).unwrap_or_default();
    let mapped = map
        .iter()
        .find(|(k, _)| head == *k)
        .map_or(head.clone(), |(_, v)| js(v));
    mapped.concat(&r.slice(1, None))
}

fn num_with_override(n: u64, c: &Counter) -> JsString {
    let base = number_to_kana(n as f64, None);
    let ones = n % 10;
    let ov = match ones {
        4 => c.n4,
        7 => c.n7,
        9 => c.n9,
        _ => None,
    };
    let Some(ov) = ov else { return base };
    let def = js(match ones {
        4 => "よん",
        7 => "なな",
        _ => "きゅう",
    });
    if base.ends_with(&def) {
        base.slice(0, Some(-(def.len() as isize))).concat(&js(ov))
    } else {
        base
    }
}

fn lookup(t: &[(u64, &'static str)], n: u64) -> Option<&'static str> {
    t.iter().find(|(k, _)| *k == n).map(|(_, v)| *v)
}

/// n + counter → fused kana reading, or `None` if the kanji is not a known counter.
pub fn read_counter(n: f64, counter_ch: &JsString) -> Option<JsString> {
    let c = counter(counter_ch)?;
    if !is_safe_integer(n) || n < 0.0 {
        return None;
    }
    let n = n as u64;
    if let Some(r) = lookup(c.table, n) {
        return Some(js(r));
    }
    if let Some(r) = lookup(c.irr, n) {
        return Some(js(r));
    }
    let num = num_with_override(n, &c);
    let reading = js(c.reading);
    if c.cls == Cls::Regular {
        return Some(num.concat(&reading));
    }
    let geminate = |end: &str, rep: &str| -> Option<JsString> {
        let end = js(end);
        num.ends_with(&end)
            .then(|| num.slice(0, Some(-(end.len() as isize))).concat(&js(rep)))
    };
    let mut gem: Option<JsString> = None;
    for (end, rep) in [("いち", "いっ"), ("はち", "はっ"), ("じゅう", "じゅっ")] {
        gem = gem.or_else(|| geminate(end, rep));
    }
    if c.cls != Cls::S {
        for (end, rep) in [
            ("ろく", "ろっ"),
            ("ひゃく", "ひゃっ"),
            ("びゃく", "びゃっ"),
            ("ぴゃく", "ぴゃっ"),
        ] {
            gem = gem.or_else(|| geminate(end, rep));
        }
    }
    if let Some(g) = gem {
        let tail = if c.cls == Cls::H {
            shift_first(c.reading, &H_TO_P)
        } else {
            reading
        };
        return Some(g.concat(&tail));
    }
    if num.ends_with(&js("ん")) {
        if n % 10 == 4 {
            return Some(num.concat(&js(c.four.unwrap_or(c.reading))));
        }
        if c.cls == Cls::H {
            let tail = match c.three {
                Some(t) => js(t),
                None => shift_first(c.reading, &H_TO_B),
            };
            return Some(num.concat(&tail));
        }
        if let Some(t) = c.three {
            if !c.narrow_three || n % 10 == 3 {
                return Some(num.concat(&js(t)));
            }
        }
    }
    Some(num.concat(&reading))
}
