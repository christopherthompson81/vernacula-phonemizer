/**
 * Commonwealth spelling → the lexicon's spelling.
 *
 * The `en` lexicon is CMUdict-derived, so its headwords are American spellings. CMUdict happens to
 * carry some Commonwealth ones too (`colour`, `honour`, `labour`, `centre`, `defence`, `grey`) but
 * that coverage is accidental and stops well short of the class: `vapour`, `savour`, `vigour`,
 * `valour`, `succour`, `analyse`, `enrolment`, `foetus` and several hundred more are simply OOV,
 * and the OOV G2P then READS the British spelling literally — `vapour` → `vəpʰˈʊɹ` rather than the
 * `vˈeᶦpɚ` that `vapor` gets. The two spellings are the same word; nothing upstream knew that.
 *
 * So: when — and only when — a word is OOV, rewrite it towards the American spelling and retry the
 * lexicon. A rewrite is accepted ONLY if it lands on a real headword, which is what keeps the rules
 * from having to be careful about `our`/`hour`/`flour`/`four` (all lexicon words, never OOV) or
 * about any OOV word whose rewrite is not a word at all. The cost of a miss is nil: the word was
 * going to the OOV G2P either way.
 *
 * ⚠ These are ORTHOGRAPHIC folds, not accent folds. They map a spelling to its lexicon twin and
 * stop there — the reading that comes back is this reader's own (American for `en`; `en-GB` applies
 * its lexical-set delta downstream, unchanged). Pairs that differ in PRONUNCIATION and not just in
 * spelling are therefore NOT rules here: `aluminium` is not `aluminum` (four syllables vs three),
 * `learnt` is not `learned`, `whisky` is not `whiskey`. Those belong in the lexicon, one by one.
 */

/** ae/oe → e, as a curated stem list rather than a digraph rule.
 *
 *  A blanket `ae|oe → e` is wrong far more often than it is right: it turns `aloes` into `ales`,
 *  `noels` into `nels`, `phaedra` into `phedra` and `roeg` into `reg`, because the digraph there
 *  spans a morpheme or syllable boundary instead of being the Greek/Latin one. The words that DO
 *  want the fold are a bounded medical/classical set, so they are spelled out. */
const DIGRAPH_STEMS: ReadonlyArray<readonly [string, string]> = [
    ["anae", "ane"],          // anaemia, anaesthetic
    ["aemia", "emia"],        // leukaemia, septicaemia, toxaemia
    ["aemic", "emic"],
    ["archaeo", "archeo"],
    ["judaeo", "judeo"],
    ["caesar", "cesar"],      // caesarean
    ["rrhoea", "rrhea"],      // diarrhoea, gonorrhoea
    ["rrhoid", "rrhoid"],
    ["paedi", "pedi"],        // paediatric
    ["paedia", "pedia"],      // encyclopaedia
    ["faec", "fec"],
    ["foet", "fet"],          // foetus, foetal, foetid
    ["gynaec", "gynec"],
    ["haem", "hem"],          // haemoglobin, haemorrhage
    ["homoeo", "homeo"],
    ["oedema", "edema"],
    ["oesophag", "esophag"],
    ["oestr", "estr"],        // oestrogen
    ["orthopaed", "orthoped"],
    ["palaeo", "paleo"],
    ["mediaeval", "medieval"],
    ["primaeval", "primeval"],
    ["aeon", "eon"],
    ["aetiolog", "etiolog"],
    ["caesium", "cesium"],
    ["chimaera", "chimera"],
    ["daemon", "demon"],
    ["hyaena", "hyena"],
    ["onomatopoeia", "onomatopeia"],
    ["manoeuvr", "maneuvr"],  // then -re → -er below
    ["amoeb", "ameb"],
    ["coeliac", "celiac"],
    ["oenolog", "enolog"],
    ["praes", "pres"],
];

/** What may follow a British `-our` stem.
 *
 *  The fold is anchored to a boundary rather than applied to any `our` in the word, because a bare
 *  `our → or` matches mid-word and turns `courbet` into `corbet` and `douro` into `doro`. A stem is
 *  followed by a suffix from this list, or by another lexicon word (`colourblind`, `colourfast`,
 *  `watercolour`), or by nothing.
 *
 *  Note that British spelling itself drops the `u` before the Latinate suffixes — `humorous`,
 *  `vaporize`, `honorary`, `laborious` — so those never need the fold; they are spelled the same on
 *  both sides and are lexicon headwords already. `-ation` is the one that goes both ways
 *  (`colouration` and `coloration` are both current), so it is listed. */
const OUR_SUFFIX =
    /^(s|'s|d|ed|eds|ing|ings|er|ers|ies|y|ly|al|ally|ation|ations|less|ful|fully|ness|ite|ites|itism|able|ably|ist|ists|ism|hood|hoods)$/;

/** Words that END in `-our` without it being the Commonwealth digraph — the `u` is part of the
 *  vowel, not a British spelling of `-or`. Most are lexicon headwords and so never reach this
 *  module, but their INFLECTIONS are not: `floury` is OOV, and `flory` is a real headword, so
 *  without this the fold reads it as `flory` instead of flour+y. Same shape for `scouring`. */
const NOT_OUR = new Set([
    "our", "hour", "four", "your", "sour", "pour", "tour", "dour", "flour", "scour",
    "amour", "velour", "detour", "contour", "devour", "paramour",
]);

/** Suffixes after which British doubles a final `l` that American leaves single. */
const LL_SUFFIX = /ll(ed|ing|er|ers|or|ors|ery|ist|ists|ous|ously)$/;

/** …and the two after which British leaves it SINGLE and American doubles it. */
const L_SUFFIX = /l(ment|ments|ful|fully)$/;

/**
 * One rewrite step. `known` is the lexicon membership test, which some rules need for their own
 * guard (not merely for accepting the result).
 */
function step(word: string, known: (w: string) => boolean): string[] {
    const out: string[] = [];
    const push = (w: string) => {
        if (w !== word) out.push(w);
    };

    // -our → -or: colour, vapour, neighbourhood, watercolour.
    for (let at = word.indexOf("our"); at > 1; at = word.indexOf("our", at + 1)) {
        const rest = word.slice(at + 3);
        if (rest !== "" && !OUR_SUFFIX.test(rest) && !(rest.length > 2 && known(rest)))
            continue;
        if (NOT_OUR.has(word.slice(0, at + 3))) continue;
        push(word.slice(0, at) + "or" + rest);
    }

    // -re → -er, after a consonant: centre, fibre, theatre, litre, calibre, maneuvre.
    push(word.replace(/([bcdfgkmnpstvz])re$/, "$1er"));

    // -ce → -se: defence, licence, offence, pretence.
    push(word.replace(/ce$/, "se"));

    // -ise/-isation → -ize/-ization, -yse → -yze.
    push(word.replace(/is(e|ed|es|ing|ation|ations|able|er|ers)$/, "iz$1"));
    push(word.replace(/ys(e|ed|es|ing|is)$/, "yz$1"));

    // travelled → traveled, marvellous → marvelous, counsellor → counselor.
    //
    // ⚠ GUARD: only when the `ll` stem is not itself a word. Without it the rule eats the ordinary
    // English doubled consonant and changes the vowel with it — `dolling`→`doling`, `palled`→`paled`,
    // `pilled`→`piled`, `tilled`→`tiled` all land on real headwords that are the WRONG word.
    const ll = LL_SUFFIX.exec(word);
    if (ll !== null) {
        const stem = word.slice(0, ll.index) + "l";
        // ⚠ GUARD: the American stem must be a real word of more than three letters. Without the
        // first test the rule fires on anything; without the SECOND it eats the ordinary English
        // doubled consonant of a monosyllable and changes the vowel with it — `palled`→`paled`,
        // `pilled`→`piled`, `tilled`→`tiled`, `dolling`→`doling` all land on real headwords that
        // are the wrong word. British doubling only happens after an unstressed syllable, so the
        // stem it applies to is never a three-letter monosyllable. The obvious guard — reject when
        // the `ll` stem is itself a lexicon word — does NOT work: CMUdict carries the surnames
        // `marshall`, `jewell`, `powell`, and that silently killed the whole legitimate class.
        // `known(stem)` also has to see through a productive prefix: CMUdict has `unlabeled` and
        // `unrivaled` but not the bare stems `unlabel`/`unrival`.
        const base = stem.replace(/^(un|re|dis|mis|over|under|non)/, "");
        if (stem.length > 3 && (known(stem) || (base !== stem && known(base))))
            push(stem + ll[1]);
    }

    // enrolment → enrollment, skilful → skillful.
    push(word.replace(L_SUFFIX, "ll$1"));

    for (const [gb, us] of DIGRAPH_STEMS)
        if (word.includes(gb)) push(word.split(gb).join(us));

    push(word.replace(/ogue$/, "og"));      // catalogue, dialogue
    push(word.replace(/mme$/, "m"));        // programme, gramme
    push(word.split("sulph").join("sulf")); // sulphur, sulphide
    push(word.replace(/xion$/, "ction"));   // inflexion, connexion

    return out;
}

/**
 * The first American spelling of `word` that `known` accepts, or undefined.
 *
 * Rules compose — `manoeuvre` needs the digraph stem AND `-re`→`-er`; `organisations` needs only
 * one — so this walks up to `DEPTH` rewrites breadth-first and returns the nearest hit. `word` must
 * already be lowercased and diacritic-folded (`resolveWord` does both before any lookup).
 */
export function americanSpelling(
    word: string,
    known: (w: string) => boolean,
): string | undefined {
    const DEPTH = 3;
    let frontier = [word];
    const seen = new Set([word]);
    for (let depth = 0; depth < DEPTH && frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const w of frontier)
            for (const cand of step(w, known)) {
                if (seen.has(cand)) continue;
                seen.add(cand);
                if (known(cand)) return cand;
                next.push(cand);
            }
        frontier = next;
    }
    return undefined;
}
