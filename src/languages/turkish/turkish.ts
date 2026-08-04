/**
 * Turkish (tr) phonemizer — canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) + final-syllable stress
 * (Turkish default) with a lexicon (stress.tsv, mostly place names / loanwords) for the exceptions. text()
 * tokenizes words / numbers / punctuation. See docs/investigations/tr_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, trLower } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { attachSuffix, normalizeTurkish, ordinalWords } from "./normalize.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Stress exceptions: word → 1-based stressed syllable (default is the final syllable).
let STRESS: Map<string, number> | undefined;
function stressDict(): Map<string, number> {
    if (STRESS === undefined)
        STRESS = loadTsvMap(import.meta.url, "stress.tsv", Number, {
            optional: true,
        });
    return STRESS;
}

const VOWEL_LETTER = /[aeıioöuüâîû]/;
const nVowels = (s: string): number => {
    let n = 0;
    for (const c of s) if (VOWEL_LETTER.test(c)) n++;
    return n;
};

// PRE-ACCENTING (pre-stressing) suffixes: Turkish stress falls on the syllable immediately before the LEFTMOST
// pre-accenting suffix (Kabak & Vogel). The set — progressive -Iyor, -ken, instrumental -(y)lA, negation /
// verbal-noun -mA, conditional -sA, generalizing copula -DIr, predicative person endings -Im/-Iz/-sInIz — plus
// one optional trailing suffix (person / case / plural), anchored to the word end. NB the bare 2sg -sIn is
// deliberately EXCLUDED: it collides with the imperative -sIn (olsun) and possessive+case -sInDA (arasında),
// costing more than it fixes. Derived as general morphology and net-validated against the espeak gold (stress
// accuracy 78.5%→90.9% fixes-minus-breaks); NOT a per-word lexicon. See docs/investigations/tr_native_bringup_investigation.md.
const PRE_ACCENT =
    "(?:(?:r)?ken|(?:y)?l[ae]|m[ae]|s[ae]|[dt][ıiuü]r|(?:y)?(?:[ıiuü]m|[ıiuü]z|s[ıiuü]n[ıiuü]z))";
const TAIL = "(?:l[ae]r|[ıiuü][mnz]|n[ıiuü]z|[ae]|y[ae]|d[ae]n?|n[ıiuü]n|)";
const PRE_ACCENT_RE = new RegExp(PRE_ACCENT + TAIL + "$", "u");
const IYOR_RE = /([ıiuü])yor(?:um|sun|uz|sunuz|lar)?$/u;

/** A pre-accenting suffix's 1-based stressed syllable, or undefined (→ default final stress). */
function morphStress(wl: string): number | undefined {
    const iyor = wl.match(IYOR_RE); // progressive: stress the I of Iyor (geliyor→ɟelˈijoɾ)
    if (iyor && iyor.index !== undefined)
        return nVowels(wl.slice(0, iyor.index + 1));
    const m = wl.match(PRE_ACCENT_RE); // leftmost pre-accenting suffix → stress the syllable before it
    if (m && m.index !== undefined) {
        const syl = nVowels(wl.slice(0, m.index));
        if (syl >= 1) return syl;
    }
    return undefined;
}

/** Phonemize a single Turkish word to canonical IPA (with a stress mark before the stressed vowel). `finalStress`
 *  forces plain final-syllable stress, bypassing the lexicon + pre-accenting rules (used for number words, which
 *  are lexically final-stressed — the -Iz person-ending rule would otherwise mis-stress dokuz→dˈokuz). */
export function phonemizeWord(word: string, finalStress = false): string {
    const segs = toSegments(word);
    const nuclei = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return segs.map((s) => s.ph).join("");
    // Stress: the exception lexicon's 1-based syllable if known, else a pre-stressing suffix rule, else final.
    const wl = trLower(word);
    const syl = finalStress
        ? undefined
        : (stressDict().get(wl) ?? morphStress(wl));
    const stressIdx =
        syl !== undefined && syl >= 1 && syl <= nuclei.length
            ? nuclei[syl - 1]!
            : nuclei[nuclei.length - 1]!;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Turkish letters), an ORDINAL numeral, a number with an optional apostrophe-attached suffix, or
// clause punctuation. Turkish uses . as thousands sep and , as decimal.
//
// #562: the two numeral-attached forms are matched HERE rather than rewritten in normalize.ts because their
// spoken words must go through phonemizeWord(w, /*finalStress*/ true) — the word path mis-stresses sekiz /
// dokuz / otuz via the -Iz person-ending rule (see normalize.ts's header). Ordering inside the alternation
// matters: the ordinal branch precedes the number branch, and its lookahead (whitespace + another token) is
// exactly the corpus-derived detector — it declines inside `1.234` and `802.11a`, where no space follows the
// dot, and at end of input, which is the one sentence-final `N.` the corpus contains (`rekoru 7-2.`).
const TOKEN =
    /([a-zçğıiöşüâîû]+)|(\d+)\.(?=[^\S\n]+\S)|(\d+(?:\.\d{3})*(?:,\d+)?)(?:['’]([a-zçğıiöşüâîû]+))?|([.!?…,;:])/giu;

/** A number token (Turkish thousands-dots / decimal-comma) → spoken words. */
function numberTokenToWords(tok: string): string {
    const [intRaw, frac] = tok.split(",");
    let words = numberToWords(Number(intRaw!.replace(/\./g, "")));
    if (frac !== undefined)
        words +=
            ` ${MANIFEST.numbers.decimalConnector} ` +
            [...frac].map((d) => numberToWords(Number(d))).join(" ");
    return words;
}

// #562 symbol normalization — Turkish: the percent word PRECEDES the number (yüzde kırk, written %40); both
// %40 and 40% occur in the wild and both rewrite to prefix order. `m` → metre is claimed here rather than in
// normalize.ts so the shared tier's "only after a number" guard applies (4892 m, 100m); the `m/s` compound is
// consumed earlier, in normalize.ts step 4, before this tier can break the adjacency.
/** The unit table, named so the apostrophe-suffix rule below can derive its alternation from the SAME object
 *  the tier is given — a second hand-written list would drift the moment a unit is added. */
const UNITS = { km: ["kilometre"], cm: ["santimetre"], mm: ["milimetre"], kg: ["kilogram"], m: ["metre"] };

const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
    // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
    // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
    // One word, so `by` defaults to it; this language does not split dimension from product.
    multiply: { times: "çarpı" },
    percent: ["yüzde"],
    percentPrefix: true,
    currency: { "€": ["avro"], "$": ["dolar"], "£": ["sterlin"], "₺": ["lira"], "¥": ["yen"] },
    units: UNITS,
    // THE MEASURE WORD FUSES ONTO THE END, which is the `suffix` position and the reason it exists. This
    // corpus writes `783.562 kilometrekare` ×4 and `120-160 metreküp` ×2 — one word each. Neither of the
    // other three positions produces that: `after` gives *kilometre kare*, `compound` gives *karekilometre*.
    // ⚠ Bare `kare` ×6 is the SHAPE ("küçük kare veya toplardan"), plus one `mil kare` for the imperial
    // gloss — the fused unit form is the attestation, not the bare word.
    exponentWords: { squared: ["kare"], cubed: ["küp"], position: "suffix" },
});

/**
 * THE APOSTROPHE SUFFIX DEFEATED THE UNIT TIER ENTIRELY, and #586's audit only saw the smallest part of it.
 * Turkish attaches case/possessive suffixes to an abbreviation with an apostrophe, and the tier's trailing
 * guard — which exists so a key cannot bite into a word — rejects the letter that follows. Measured over
 * tr_tr, fourteen instances, and every one of them was misread:
 *
 *     19.500 km²'lik  →  *kilometre lik*     the ² DROPPED, area lost           (×2, the audit's `exponent DROP`)
 *     360 km'lik      →  *km lik*            THE UNIT SURVIVED AS RAW LETTERS   (×2, +1600 km'lik ×2, 70 km'ye)
 *     35 mm'dir       →  *mm dir*            same                               (×3)
 *     6 cm'ye, 4892 m'lik, 6,387 km'dir      same
 *     5 km2'lik       →  *kilometre ikilik*  the ASCII 2 read as the NUMBER two — confidently wrong
 *
 * ⚠ AND A RAW UNIT IS NOT MUTE IN THIS LANGUAGE, IT IS MISPRONOUNCED. `6 cm'ye` read [aɫtˈɯ d͡ʒm jˈe]: the
 * letters `cm` went through the g2p as an ordinary word, and Turkish `c` is [d͡ʒ]. So the alternative to
 * reading the unit was not silence but a confident wrong word — the same argument the Zulu click rules rest
 * on, and the reason this is worth fixing at fourteen instances.
 *
 * ⚠ ONLY THE EXPONENT CASE WAS VISIBLE TO THE GATE. A raw `km` in the IPA is not a digit and not a symbol, so
 * the LEAK check cannot see it and the differential DROP check cannot either — the reading changes when the
 * letters are deleted, so nothing "vanished". Twelve of the fourteen were invisible, which is the #584 blind
 * spot in a new shape: a defect is only found by the gate that was built to look for it.
 *
 * PROTECT AND RESTORE, rather than a local unit table. The suffix is moved out of the way behind a sentinel so
 * the tier sees an ordinary boundary, then glued back onto whatever word the tier produced. That way the unit
 * words stay owned by the tier — `kilometrekare` + `lik` → *kilometrekarelik*, `kilometre` + `lik` →
 * *kilometrelik* — and nothing here needs to know them. Plain concatenation is correct for the same reason
 * `attachSuffix` gives in normalize.ts: Turkish orthography already writes the suffix in the harmonised form
 * the spoken word demands.
 *
 * ⚠ KEYED ON THE DECLARED UNITS, NOT ON `\\p{L}+`, and that is load-bearing. The same shape sits on words this
 * must not touch, all of them in this corpus: `7 Ekim'de`, `20 Mart'ta` (month names after a day number),
 * `12.00 GMT'de`, `802.11n'nin`, `2. Elizabeth'in`, `29, Cincinnati'nin`. A letter-run rule would read every
 * one of them as a measurement. The requirement that an apostrophe follow the unit IMMEDIATELY is what keeps
 * `5 Mart'ta` safe even though `m` is a unit key: after `m` comes `a`, not `'`.
 */
const UNIT_ALT = Object.keys(UNITS).sort((a, b) => b.length - a.length).join("|");
const SUFFIX_MARK = "\u0001"; // never occurs in input; the glue step below removes it again
const SUFFIXED_UNIT = new RegExp(`(\\d[\\d.,]*\\s?(?:${UNIT_ALT})(?:\\s?[²³23])?)['’](\\p{L}+)`, "gu");
const MARKED_SUFFIX = new RegExp(`(\\S+)\\s${SUFFIX_MARK}(\\p{L}+)`, "gu");

/** Read a unit carrying an apostrophe suffix: park the suffix, let the tier speak the unit, glue it back. */
function readSuffixedUnits(text: string): string {
    const parked = text.replace(SUFFIXED_UNIT, `$1 ${SUFFIX_MARK}$2`);
    // The final strip is belt and braces: the glue step only fires when the tier left a word before the mark,
    // so an input where the tier declined to speak the unit would otherwise carry a CONTROL CHARACTER into the
    // IPA. No probed input does that — 5,5 km'lik, 0,5 m'lik, 12 kg'dan, %80'ini, 1.600 km'lik and the
    // malformed 5 km' were all checked clean — but a stray U+0001 in the phoneme string is a bad enough
    // failure mode to spend one line on rather than argue about.
    return SYMBOLS(parked).replace(MARKED_SUFFIX, "$1$2").split(SUFFIX_MARK).join("");
}

class TurkishPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's `/`-unit step needs the number and
        // the unit still adjacent, which the symbol tier would break (83 km/s → 83 kilometre/s).
        return assembleClauses(readSuffixedUnits(normalizeTurkish(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2] !== undefined) {
                const ord = ordinalWords(Number(m[2]));
                if (ord !== undefined)
                    for (const wd of ord.split(" ")) sink.emit(phonemizeWord(wd, true));
                else {
                    // Not expressible as an ordinal — fall back to the previous reading (cardinal + pause).
                    for (const wd of numberTokenToWords(m[2]).split(" "))
                        sink.emit(phonemizeWord(wd, true));
                    const mk = CLAUSE_MARK["."];
                    if (mk) sink.pause(mk);
                }
            } else if (m[3]) {
                const words = numberTokenToWords(m[3]).split(" ");
                for (const wd of m[4] ? attachSuffix(words, m[4]) : words)
                    sink.emit(phonemizeWord(wd, true));
            } else if (m[5]) {
                const mk = CLAUSE_MARK[m[5]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Turkish phonemizer (rule g2p + final-syllable stress + an exception lexicon). */
export function createTurkish(): Phonemizer {
    return new TurkishPhonemizer();
}
