//! The French rule g2p (standard/Parisian, broad IPA): a left-to-right scan with context and longest-match
//! multigraphs, then geminate collapse, hiatus-schwa deletion and the silent final cluster. The OOV fallback
//! behind the lexicon. Ported from src/languages/french/g2p.ts — see that file for the rules' evidence.
//!
//! The word is scanned by UTF-16 code unit (`w[k]`), as the TS indexes it; `None` stands for the TS's `""`.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

struct Tables {
    vowel_letters: Vec<u16>,
    vowel_ph: Vec<u16>,
    vowel_groups: Vec<(JsString, JsString)>,
    nasal_groups: Vec<(JsString, JsString)>,
    final_sounded: Vec<JsString>,
    yod_double: Vec<(JsString, JsString)>,
    yod_final: Vec<(JsString, JsString)>,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let pairs = |v: &Vec<(String, String)>| v.iter().map(|(a, b)| (js(a), js(b))).collect();
    Tables {
        vowel_letters: m.vowel_letters.encode_utf16().collect(),
        vowel_ph: m.vowel_phonemes.encode_utf16().collect(),
        vowel_groups: pairs(&m.vowel_groups),
        nasal_groups: pairs(&m.nasal_groups),
        final_sounded: m.final_sounded.iter().map(|s| js(s)).collect(),
        yod_double: pairs(&m.yod_double),
        yod_final: pairs(&m.yod_final),
    }
});

/// `"…".includes(c)` for a one-unit `c`; `None` (the TS `""`) is included in every string.
fn includes(set: &str, c: Option<u16>) -> bool {
    match c {
        None => true,
        Some(u) => set.encode_utf16().any(|x| x == u),
    }
}

fn is_v(c: Option<u16>) -> bool {
    c.is_some_and(|u| T.vowel_letters.contains(&u))
}

fn is(c: Option<u16>, ch: char) -> bool {
    c == Some(ch as u16)
}

fn at(w: &JsString, k: isize) -> Option<u16> {
    if k < 0 {
        None
    } else {
        w.0.get(k as usize).copied()
    }
}

fn silent_tail(w: &JsString, k: isize) -> bool {
    let c = at(w, k);
    c.is_none() || (is(c, 's') && at(w, k + 1).is_none())
}

fn eu_closed(w: &JsString, a: isize) -> bool {
    let c1 = at(w, a);
    if c1.is_none() || is_v(c1) {
        return false;
    }
    if is(c1, 'x') && at(w, a + 1).is_some() {
        return true;
    }
    let c2 = at(w, a + 1);
    if c2.is_none() {
        return includes("rlfcqkbɡv", c1);
    }
    if c1 == c2 {
        return true;
    }
    if is(c2, 'e') && silent_tail(w, a + 2) {
        return true;
    }
    let c3 = at(w, a + 2);
    if includes("pbcdfgktv", c1)
        && (is(c2, 'l') || is(c2, 'r'))
        && !((is(c1, 't') || is(c1, 'd')) && is(c2, 'l'))
        && is_v(c3)
        && !(is(c3, 'e') && silent_tail(w, a + 3))
    {
        return false;
    }
    !is_v(c2)
}

fn o_closed(w: &JsString, a: isize) -> bool {
    let c1 = at(w, a);
    if c1.is_none() {
        return false;
    }
    if is(c1, 'z') {
        return false;
    }
    if is(c1, 's') && is_v(at(w, a + 1)) {
        return false;
    }
    if at(w, a + 1).is_none() && includes("tsdpx", c1) {
        return false;
    }
    true
}

fn is_cons_ph(ph: &JsString) -> bool {
    !ph.is_empty() && !T.vowel_ph.contains(&ph.0[0])
}

/// `[...ph].some((c) => VOWEL_PH.includes(c))`: every vowel phoneme is one BMP unit, so a unit scan agrees.
fn has_nucleus(ph: &JsString) -> bool {
    ph.0.iter().any(|u| T.vowel_ph.contains(u))
}

fn is_front(ch: Option<u16>) -> bool {
    ch.is_some() && includes("eiéèêyœæ", ch)
}

fn starts_at(w: &JsString, i: usize, g: &JsString) -> bool {
    w.0.len() >= i + g.len() && w.0[i..i + g.len()] == g.0[..]
}

struct Seg {
    ph: JsString,
    s: usize,
}

/// `toIpa(word)`: a French word → broad IPA, no stress.
pub(crate) fn to_ipa_loaded(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    let n = w.len();
    let mut seg: Vec<Seg> = Vec::new();
    let push = |seg: &mut Vec<Seg>, ph: &str, s: usize| seg.push(Seg { ph: js(ph), s });
    let mut i = 0usize;
    let ii = |i: usize| i as isize;

    'scan: while i < n {
        let c = at(&w, ii(i));
        let nx = at(&w, ii(i) + 1);
        let nx2 = at(&w, ii(i) + 2);
        let at_end = |i: usize, len: usize| i + len >= n;

        for (g, ipa) in &T.yod_double {
            if starts_at(&w, i, g) {
                seg.push(Seg {
                    ph: ipa.clone(),
                    s: i,
                });
                i += g.len();
                continue 'scan;
            }
        }
        for (g, ipa) in &T.yod_final {
            if starts_at(&w, i, g) && i + g.len() >= n {
                seg.push(Seg {
                    ph: ipa.clone(),
                    s: i,
                });
                i += g.len();
                continue 'scan;
            }
        }

        for (g, ipa) in &T.nasal_groups {
            if starts_at(&w, i, g) {
                let after = at(&w, ii(i + g.len()));
                let doubled = (g.ends_with(&js("n")) && is(after, 'n'))
                    || (g.ends_with(&js("m")) && is(after, 'm'));
                if !is_v(after) && !doubled {
                    seg.push(Seg {
                        ph: ipa.clone(),
                        s: i,
                    });
                    i += g.len();
                    continue 'scan;
                }
            }
        }

        if starts_at(&w, i, &js("ai")) {
            push(&mut seg, "ɛ", i);
            i += 2;
            continue;
        }
        if starts_at(&w, i, &js("ou")) && is_v(nx2) {
            push(&mut seg, "w", i);
            i += 2;
            continue;
        }
        if is(c, 't') && is(nx, 'i') && is_v(nx2) && !is(at(&w, ii(i) - 1), 's') {
            push(&mut seg, "s", i);
            i += 1;
            continue;
        }

        if starts_at(&w, i, &js("eu")) || starts_at(&w, i, &js("œu")) || starts_at(&w, i, &js("eû"))
        {
            let g = 2; // "œu", "eû" and "eu" are each two units
            let ph = if eu_closed(&w, ii(i + g)) { "œ" } else { "ø" };
            push(&mut seg, ph, i);
            i += g;
            continue;
        }

        if starts_at(&w, i, &js("au")) || starts_at(&w, i, &js("eau")) {
            let g = if starts_at(&w, i, &js("eau")) { 3 } else { 2 };
            if is(at(&w, ii(i + g)), 'r') {
                push(&mut seg, "ɔ", i);
                i += g;
                continue;
            }
        }

        for (g, ipa) in &T.vowel_groups {
            if starts_at(&w, i, g) {
                seg.push(Seg {
                    ph: ipa.clone(),
                    s: i,
                });
                i += g.len();
                continue 'scan;
            }
        }

        if is(c, 'c') && (is(nx, '\'') || is(nx, '’')) {
            push(&mut seg, "s", i);
            i += 1;
            continue;
        }
        if is(c, 'c') && is(nx, 'h') {
            push(&mut seg, "ʃ", i);
            i += 2;
            continue;
        }
        if is(c, 'p') && is(nx, 'h') {
            push(&mut seg, "f", i);
            i += 2;
            continue;
        }
        if is(c, 't') && is(nx, 'h') {
            push(&mut seg, "t", i);
            i += 2;
            continue;
        }
        if is(c, 'g') && is(nx, 'n') {
            push(&mut seg, "ɲ", i);
            i += 2;
            continue;
        }
        if is(c, 'q') && is(nx, 'u') {
            push(&mut seg, "k", i);
            i += 2;
            continue;
        }
        if is(c, 'g') && is(nx, 'u') && is_front(nx2) {
            push(&mut seg, "ɡ", i);
            i += 2;
            continue;
        }
        // `"ll".includes(nx)` and `"mtv".includes(at(i - 1))` are both true for the TS's `""`.
        if is(c, 'i')
            && includes("ll", nx)
            && is(at(&w, ii(i) + 2), 'l')
            && !includes("mtv", at(&w, ii(i) - 1))
        {
            push(&mut seg, "ij", i);
            i += 3;
            continue;
        }

        let cu = c.unwrap();
        match char::from_u32(cu as u32) {
            Some('a') | Some('à') => {
                push(&mut seg, "a", i);
                i += 1;
            }
            Some('e') => {
                if at_end(i, 1) || (is(nx, 's') && at_end(i, 2)) {
                    if !seg.iter().any(|s| has_nucleus(&s.ph)) {
                        push(&mut seg, "ə", i);
                    }
                    i += 1;
                } else if is(nx, 'r') && at_end(i, 2) && seg.iter().any(|s| has_nucleus(&s.ph)) {
                    push(&mut seg, "e", i);
                    i += 2;
                } else if is(nx, 'z') && at_end(i, 2) {
                    push(&mut seg, "e", i);
                    i += 2;
                } else if is(nx, 't') && at_end(i, 2) {
                    push(&mut seg, "ɛ", i);
                    i += 2;
                } else {
                    let ph = if eu_closed(&w, ii(i) + 1) { "ɛ" } else { "ə" };
                    push(&mut seg, ph, i);
                    i += 1;
                }
            }
            Some('i') | Some('y') => {
                let glide = is_v(nx) && !(is(nx, 'e') && at_end(i, 2));
                let k = seg.len();
                let cluster_before = k >= 2 && {
                    let (p1, p2) = (&seg[k - 1].ph, &seg[k - 2].ph);
                    is_cons_ph(p1) && is_cons_ph(p2) && (*p1 == "ʁ" || *p1 == "l")
                };
                if glide && cluster_before {
                    push(&mut seg, "i", i);
                    push(&mut seg, "j", i);
                } else {
                    push(&mut seg, if glide { "j" } else { "i" }, i);
                }
                i += 1;
            }
            Some('o') => {
                let ph = if o_closed(&w, ii(i) + 1) { "ɔ" } else { "o" };
                push(&mut seg, ph, i);
                i += 1;
            }
            Some('u') => {
                push(&mut seg, if is_v(nx) { "ɥ" } else { "y" }, i);
                i += 1;
            }
            Some('h') => i += 1,
            Some(ch) if simple(ch, nx, at(&w, ii(i) - 1)).is_some() => {
                push(&mut seg, simple(ch, nx, at(&w, ii(i) - 1)).unwrap(), i);
                i += 1;
            }
            _ => {
                let ph = latin_phone(
                    &JsString(vec![cu]),
                    PhoneOpts {
                        initial: i == 0,
                        ..Default::default()
                    },
                );
                if let Some(ph) = ph {
                    seg.push(Seg { ph, s: i });
                }
                i += 1;
            }
        }
    }

    // Post-pass 1: geminate consonants collapse.
    let mut dedup: Vec<Seg> = Vec::new();
    for s in seg {
        if let Some(prev) = dedup.last() {
            if prev.ph == s.ph && is_cons_ph(&s.ph) && s.ph.len() == 1 {
                continue;
            }
        }
        dedup.push(s);
    }

    // Post-pass 2: hiatus-schwa deletion.
    let ends_vowel = |s: &Seg| js_re!("[aeiouyɛɔøœəɑ]̃?$").test(&s.ph);
    let mut collapsed = hiatus(dedup, &ends_vowel);

    // Post-pass 3: the silent final consonant cluster.
    if !is(at(&w, n as isize - 1), 'e') {
        let mut cut = n;
        let mut k = n as isize - 1;
        while k >= 0 {
            let ch = at(&w, k);
            if is_v(ch) {
                break;
            }
            if T.final_sounded.iter().any(|f| f.0[..] == [ch.unwrap()]) {
                break;
            }
            cut = k as usize;
            k -= 1;
        }
        while collapsed.last().is_some_and(|x| x.s >= cut) {
            collapsed.pop();
        }
    }

    let mut out = JsString::new();
    for x in &collapsed {
        out.push_str(&x.ph);
    }
    out
}

/// Post-pass 2 over the deduplicated list: drop a word-internal ə that follows a vowel and precedes a
/// consonant. Neighbours are read from the INPUT list (`dedup[p ± 1]`), not from what has been kept.
fn hiatus(dedup: Vec<Seg>, ends_vowel: &dyn Fn(&Seg) -> bool) -> Vec<Seg> {
    let len = dedup.len();
    let keep: Vec<bool> = (0..len)
        .map(|p| {
            if dedup[p].ph == "ə" && p > 0 && p < len - 1 {
                let (before1, after) = (&dedup[p - 1], &dedup[p + 1]);
                if ends_vowel(before1) && is_cons_ph(&after.ph) {
                    return false;
                }
            }
            true
        })
        .collect();
    dedup
        .into_iter()
        .zip(keep)
        .filter_map(|(s, k)| k.then_some(s))
        .collect()
}

/// The single-letter consonant cases of the switch.
fn simple(ch: char, nx: Option<u16>, prev: Option<u16>) -> Option<&'static str> {
    Some(match ch {
        'b' => "b",
        'c' => {
            if is_front(nx) {
                "s"
            } else {
                "k"
            }
        }
        'ç' => "s",
        'd' => "d",
        'f' => "f",
        'g' => {
            if is_front(nx) {
                "ʒ"
            } else {
                "ɡ"
            }
        }
        'j' => "ʒ",
        'k' => "k",
        'l' => "l",
        'm' => "m",
        'n' => "n",
        'p' => "p",
        'r' => "ʁ",
        's' => {
            if is_v(prev) && is_v(nx) {
                "z"
            } else {
                "s"
            }
        }
        't' => "t",
        'v' | 'w' => "v",
        'x' => "ks",
        'z' => "z",
        'œ' => "œ",
        _ => return None,
    })
}

/// `toIpa(word)`, or why the manifest is unavailable.
pub fn to_ipa(word: &JsString) -> Result<JsString, String> {
    super::manifest::try_manifest()?;
    Ok(to_ipa_loaded(word))
}
