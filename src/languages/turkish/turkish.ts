/**
 * Turkish (tr) phonemizer — canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) + final-syllable stress
 * (Turkish default) with a lexicon (stress.tsv, mostly place names / loanwords) for the exceptions. text()
 * tokenizes words / numbers / punctuation. See docs/investigations/tr_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, trLower } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
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
// A word (Turkish letters), a number, or clause punctuation. Turkish uses . as thousands sep and , as decimal.
const TOKEN = /([a-zçğıiöşüâîû]+)|(\d+(?:\.\d{3})*(?:,\d+)?)|([.!?…,;:])/giu;

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

class TurkishPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberTokenToWords(m[2]).split(" "))
                    sink.emit(phonemizeWord(wd, true));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Turkish phonemizer (rule g2p + final-syllable stress + an exception lexicon). */
export function createTurkish(): Phonemizer {
    return new TurkishPhonemizer();
}
