/**
 * Slovak (sk) phonemizer — canonical IPA. Rule g2p (g2p.ts) + fixed FIRST-syllable stress with
 * secondary stress on even non-final nuclei (like Czech). Syllabic r̩/l̩ (and long ĺ/ŕ) count as nuclei.
 * text() tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { normalizeSlovak } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

/** One Slovak word → canonical IPA with first-syllable primary stress + even-non-final secondary stress. */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nucIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
    const last = nucIdx.length - 1;
    let out = "";
    let vi = -1;
    for (let i = 0; i < segs.length; i++) {
        if (segs[i]!.nucleus) {
            vi++;
            out += vi === 0 ? "ˈ" : vi >= 2 && vi % 2 === 0 && vi !== last ? "ˌ" : "";
        }
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_CLASS = "[A-Za-zÁáÄäČčĎďÉéÍíĹĺĽľŇňÓóÔôŔŕŠšŤťÚúÝýŽž]";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
 */
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * #562 Slovak count-form selector: 1 → 0 (sg), exactly 2/3/4 → 1 (nominative plural), everything else → 2
 * (genitive plural).
 *
 * NOT the shared `slavicCountForm`, and NOT Czech's final-digit selector either — this is the one place
 * Slovak parts company with both, and it is keyed on the WHOLE numeral rather than its last digits.
 * Standard Slovak puts the counted noun in the GENITIVE PLURAL after any compound numeral, whatever it
 * ends in: *dvadsaťdva kilometrov*, *šesťdesiatštyri kilometrov*, *dvadsaťjeden hodín* — where the
 * final-digit rule would give *dvadsaťdva kilometre* (Czech) or *dvadsaťjeden hodina* (Russian).
 *
 * SOURCED FROM THIS ENGINE'S OWN DATA, not from a sibling language: numbers.ts already selects the
 * magnitude form with exactly `count === 1 ? sg : count >= 2 && count <= 4 ? paucal : plural`, and
 * slovak.jsonc documents it as "1 tisíc/milión, 2–4 tisíce/milióny, 5+ tisíc/miliónov". `numberToWords`
 * has been composing *dvadsaťdva tisíc* (genitive plural) on that rule since bringup; the tier now agrees.
 *
 * Declared HERE, beside the tier that consumes it, so the two cannot drift apart — and so the module
 * graph has no initialisation cycle (normalize.ts imports this file, never the reverse at init time).
 */
export const skCountForm = (n: number): number => (n === 1 ? 0 : n === 2 || n === 3 || n === 4 ? 1 : 2);

/**
 * SYMBOL NORMALIZATION — Slovak. Kept in the ENGINE file (not normalize.ts) so the review tool's
 * sourcing check can read the declaration.
 */
export const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "krát" },
    percent: ["percento", "percentá", "percent"],
    currency: {
        "$": ["dolár", "doláre", "dolárov"],
        "€": ["euro", "eurá", "eur"],
        "£": ["libra", "libry", "libier"],
        "¥": ["jen", "jeny", "jenov"],
    },
    units: {
        km: ["kilometer", "kilometre", "kilometrov"],
        m: ["meter", "metre", "metrov"],
        cm: ["centimeter", "centimetre", "centimetrov"],
        mm: ["milimeter", "milimetre", "milimetrov"],
        kg: ["kilogram", "kilogramy", "kilogramov"],
        ghz: ["gigahertz", "gigahertze", "gigahertzov"],
        mhz: ["megahertz", "megahertze", "megahertzov"],
    },
    unitPer: { h: "na", s: "za" }, // 70 km/h → kilometrov NA hodinu; 10 m/s → metrov ZA sekundu
    rateDenominators: { h: "hodinu", s: "sekundu" },
    exponentWords: {
        squared: ["štvorcový", "štvorcové", "štvorcových"],
        cubed: ["kubický", "kubické", "kubických"],
        position: "before",
    },
    countForm: skCountForm,
});

class SlovakPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its ordinal, clock, era and range steps need the digits still
        // adjacent to their marks. It calls the shared symbol tier itself, at the one point where the
        // number is still beside its unit but the decimal comma has not yet become a word.
        return assembleClauses(normalizeSlovak(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤9 digits fits a safe integer (<1e9, the top composed magnitude) → compose; longer → read the raw
                // string digit-by-digit so the float conversion can't lose precision or go exponential.
                const words = m[2].length <= 9 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Slovak phonemizer (rule g2p + first-syllable stress + cardinal numbers). */
export function createSlovak(): Phonemizer {
    return new SlovakPhonemizer();
}
