//! British → American spelling candidates, searched breadth-first against the lexicon.
//! Ported from src/languages/english/spellingVariants.ts — see that file for the coverage evidence.

use std::collections::HashSet;

use crate::core::js_string::{JsString, js};
use crate::js_re;

const DIGRAPH_STEMS: [(&str, &str); 34] = [
    ("anae", "ane"),
    ("aemia", "emia"),
    ("aemic", "emic"),
    ("archaeo", "archeo"),
    ("judaeo", "judeo"),
    ("caesar", "cesar"),
    ("rrhoea", "rrhea"),
    ("rrhoid", "rrhoid"),
    ("paedi", "pedi"),
    ("paedia", "pedia"),
    ("faec", "fec"),
    ("foet", "fet"),
    ("gynaec", "gynec"),
    ("haem", "hem"),
    ("homoeo", "homeo"),
    ("oedema", "edema"),
    ("oesophag", "esophag"),
    ("oestr", "estr"),
    ("orthopaed", "orthoped"),
    ("palaeo", "paleo"),
    ("mediaeval", "medieval"),
    ("primaeval", "primeval"),
    ("aeon", "eon"),
    ("aetiolog", "etiolog"),
    ("caesium", "cesium"),
    ("chimaera", "chimera"),
    ("daemon", "demon"),
    ("hyaena", "hyena"),
    ("onomatopoeia", "onomatopeia"),
    ("manoeuvr", "maneuvr"),
    ("amoeb", "ameb"),
    ("coeliac", "celiac"),
    ("oenolog", "enolog"),
    ("praes", "pres"),
];

const NOT_OUR: [&str; 16] = [
    "our", "hour", "four", "your", "sour", "pour", "tour", "dour", "flour", "scour", "amour",
    "velour", "detour", "contour", "devour", "paramour",
];

/// `s.split(a).join(b)`: every occurrence.
fn replace_all(s: &JsString, a: &str, b: &str) -> JsString {
    JsString::join(&s.split(&js(a)), &js(b))
}

fn step(word: &JsString, known: &dyn Fn(&JsString) -> bool) -> Vec<JsString> {
    let mut out = Vec::new();
    let mut push = |w: JsString| {
        if w != *word {
            out.push(w);
        }
    };
    let our = js("our");
    // ⚠ The loop ENDS at the first "our" at index 0 or 1, even if another follows (`at > 1` is the condition).
    let mut at = word.index_of(&our, 0);
    while let Some(a) = at.filter(|&a| a > 1) {
        let rest = word.slice((a + 3) as isize, None);
        let skip = !rest.is_empty()
            && !js_re!("^(s|'s|d|ed|eds|ing|ings|er|ers|ies|y|ly|al|ally|ation|ations|less|ful|fully|ness|ite|ites|itism|able|ably|ist|ists|ism|hood|hoods)$").test(&rest)
            && !(rest.len() > 2 && known(&rest));
        if !skip
            && !NOT_OUR
                .iter()
                .any(|w| word.slice(0, Some((a + 3) as isize)) == *w)
        {
            push(
                word.slice(0, Some(a as isize))
                    .concat(&js("or"))
                    .concat(&rest),
            );
        }
        at = word.index_of(&our, a + 1);
    }
    push(js_re!("([bcdfgkmnpstvz])re$").replace(word, &js("$1er")));
    push(js_re!("ce$").replace(word, &js("se")));
    push(js_re!("is(e|ed|es|ing|ation|ations|able|er|ers)$").replace(word, &js("iz$1")));
    push(js_re!("ys(e|ed|es|ing|is)$").replace(word, &js("yz$1")));
    if let Some(ll) = js_re!("ll(ed|ing|er|ers|or|ors|ery|ist|ists|ous|ously)$").exec(word) {
        let stem = word.slice(0, Some(ll.index() as isize)).concat(&js("l"));
        let base = js_re!("^(un|re|dis|mis|over|under|non)").replace(&stem, &JsString::new());
        if stem.len() > 3 && (known(&stem) || (base != stem && known(&base))) {
            push(stem.concat(&ll.group(1, word).unwrap()));
        }
    }
    push(js_re!("l(ment|ments|ful|fully)$").replace(word, &js("ll$1")));
    for (gb, us) in DIGRAPH_STEMS {
        if word.includes(&js(gb)) {
            push(replace_all(word, gb, us));
        }
    }
    push(js_re!("ogue$").replace(word, &js("og")));
    push(js_re!("mme$").replace(word, &js("m")));
    push(replace_all(word, "sulph", "sulf"));
    push(js_re!("xion$").replace(word, &js("ction")));
    out
}

/// The first American respelling within three edits that `known` accepts.
pub fn american_spelling(word: &JsString, known: &dyn Fn(&JsString) -> bool) -> Option<JsString> {
    const DEPTH: usize = 3;
    let mut frontier = vec![word.clone()];
    let mut seen: HashSet<JsString> = HashSet::from([word.clone()]);
    let mut depth = 0;
    while depth < DEPTH && !frontier.is_empty() {
        let mut next = Vec::new();
        for w in &frontier {
            for cand in step(w, known) {
                if !seen.insert(cand.clone()) {
                    continue;
                }
                if known(&cand) {
                    return Some(cand);
                }
                next.push(cand);
            }
        }
        frontier = next;
        depth += 1;
    }
    None
}
