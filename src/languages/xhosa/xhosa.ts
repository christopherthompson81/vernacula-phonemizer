/**
 * Xhosa (xh, isiXhosa) phonemizer — canonical IPA (authored). The Nguni
 * sibling of Zulu: it REUSES the shared Zulu g2p scan (zulu/g2p.ts toSegments, longest-match over a rule table)
 * with the Xhosa rule table (xhosa.jsonc — adds ⟨rh⟩→[x]) and the Nguni penultimate-stress-with-lengthening
 * logic. Xhosa tone (lexical, unwritten) is DEFERRED — words are left untoned (the referee eval folds tone).
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "../zulu/g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeXhosa, MAGNITUDES } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

const RULES = MANIFEST.rules;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** One Xhosa word → canonical IPA: shared Nguni segments + penultimate stress/length (tone deferred). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word, RULES);
    const vowelIdx = segs.map((s, i) => (s.v ? i : -1)).filter((i) => i >= 0);
    if (vowelIdx.length === 0) return segs.map((s) => s.ph).join("");
    // Nguni penultimate stress: ˈ + ː on the penult vowel (the only vowel if monosyllabic).
    const stressIdx = vowelIdx.length >= 2 ? vowelIdx[vowelIdx.length - 2]! : vowelIdx[0]!;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        out += s.v && i === stressIdx ? `ˈ${s.ph}ː` : s.ph;
    }
    return out;
}

/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_CLASS = "[A-Za-z]";
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
 * symbol normalization — Xhosa: class-10 loan plurals (iipesenti, iidola, iikhilomitha).
 *
 * `US$` IS DECLARED AS ITS OWN KEY, and that is what fixes the drop: the tier's
 * pattern is letter-bounded on the left, so a bare `$` can never match inside `US$30`. `normalize.ts`
 * step 5 additionally prises the sign off the Xhosa CONCORD PREFIX that is glued to it (`leUS$30`,
 * `i$10`) — a compound key cannot do that job, because `i` is a noun prefix and not a currency code.
 *
 * Every currency word is a corpus token: *nakwiidola zaseMelika*, *Iiponti zaseBritane*. `¥` is the one
 * exception — `iiyeni` is COMPOSED from the corpus's own ii- class-10 loan-plural pattern (iidola,
 * iiponti, iipesenti, iikhilomitha) and is attested in no source; declared so the sign is not swallowed,
 * and flagged in the PR. Units and rates that need more than a noun (`km/h`, `mph`, `°C`) are resolved in
 * normalize.ts, because Xhosa's rate denominator is a single attested word (*ngeyure*), not "A per B".
 */
const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — this language's OWN word, harvested from its existing `×` rule, so nothing new is
    // sourced. Declaring it here is what makes ASCII `x` read like `×`: `6x6 cm` read the `x` as a LETTER NAME,
    // and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` defaults to it.
    multiply: { times: "phindaphinda" },
    percent: ["iipesenti"],
    currency: {
        "US$": ["iidola zaseMelika"], "AUD$": ["iidola"],
        "$": ["iidola"], "£": ["iiponti"], "¥": ["iiyeni"],
    },
    units: {
        km: ["iikhilomitha"], m: ["iimitha"], cm: ["iisentimitha"],
        mm: ["iimilimitha"], mi: ["iimayile"], kg: ["iikhilogram"],
    },
    magnitudes: [...MAGNITUDES],
    // `km²` ×1. `izikwere` is the HSRC English/isiXhosa maths dictionary's own plural (*Izikwere
    // ezahlulwe zangamaqhezu*); the noun follows the measure noun, as Italian/Polish do.
    exponentWords: { squared: ["isikwere", "izikwere"], position: "after" },
});

/**
 * Reader for an embedded FOREIGN word, wired to English by the registry.
 *
 * ⚠ WHY THIS LANGUAGE NEEDS ONE AT ALL. The engines that get foreign runs for free are the ones whose
 * tokenizer matches only their own script: the Latin they do not claim becomes a gap and `emitUnclaimed`
 * fills it (core/foreign.ts). Nguni is written in Latin, so it claims embedded English outright and the
 * g2p reads it — and c, q and x are CLICK letters, so the result is confidently wrong rather than merely
 * accented: `hurricane center` read [hurrikǀˈaːnɛ kǀˈɛːntʼɛr], `china` [kǀʰˈiːna].
 * Measured on the OmniVoice FLEURS corpora: 19.2% of xh and 14.8% of zu utterances carry such a word.
 */
export type ForeignPhonemizer = (latin: string) => string;

/**
 * Nguni onsets — singles, digraphs and trigraphs. Used only by `isNguniPossible` below.
 */
const NGUNI_ONSET: ReadonlySet<string> = new Set([
    ..."bcdfghjklmnpqrstvwxyz".split(""),
    "bh", "ch", "dl", "dy", "fy", "gc", "gq", "gx", "hl", "kh", "kw", "gw", "hw", "mb", "mf", "mp",
    "mv", "nc", "nd", "ng", "nj", "nk", "nq", "nt", "nx", "ny", "nz", "ph", "qh", "sh", "th", "ts",
    "tsh", "tj", "ty", "xh", "zw", "sw", "shw", "bw", "ngc", "ngq", "ngx", "ntsh", "nkw", "ngw",
    "mbw", "ndw", "njw", "nyw", "hh", "dw", "tw", "kl", "pl", "qw", "cw", "xw",
]);

/** Could this be a Nguni word at all? Vowel-final, and every consonant run a legal onset. */
function isNguniPossible(word: string): boolean {
    if (!/[aeiou]$/u.test(word)) return false;
    return word.split(/[aeiou]+/u).filter(Boolean).every((run) => NGUNI_ONSET.has(run));
}

/**
 * Is this token foreign? THREE signals, all required, and each one is load-bearing:
 *
 *   1. it contains c, q or x — the click letters, i.e. the letters whose misreading is the actual defect;
 *   2. it is a known ENGLISH word — the CMUdict lookup, supplied by the registry;
 *   3. it could NOT be a Nguni word — not vowel-final, or carrying a cluster Nguni does not license.
 *
 * Signal 2 alone is badly unsafe: the most frequent English-dictionary hits in these corpora are ordinary
 * Nguni words — `uma` ×105, `ngo` ×95, `ama` ×67, `kahle`, `yonke` — and routing those would be far worse
 * than the clicks. Signal 1 alone fails the other way, c/q/x being native click letters.
 *
 * ⚠ SIGNAL 3 WAS ADDED IN REVIEW, and it is not optional. Signals 1+2 alone routed six real Nguni words to
 * English — `cha` ("no"), `cela`, `caba`, `cima`, `coca` and, worst, **`xhosa`** — because CMUdict carries
 * all of them as names or brands. `cha` occurs in the zu corpus, so this was live corruption, not a
 * hypothetical. Requiring the token to be phonotactically impossible in Nguni removes every one.
 *
 * ⚠ IT COSTS COVERAGE, DELIBERATELY. A vowel-final CV English name is shaped exactly like a Nguni word —
 * `china` and `cima` are indistinguishable orthographically — so 46 tokens / 65 occurrences (china, chile,
 * canada, mexico, congo, cuba) stay native and keep a wrong click. That is the trade this repo already
 * makes elsewhere: a wrong high-traffic word is worse than a missing one, and `xhosa` read as English is
 * about as wrong as this language gets. 435 tokens / 604 occurrences still route.
 */
export function isForeignNguniWord(word: string, isEnglishWord: (w: string) => boolean): boolean {
    return /[cqx]/u.test(word) && !isNguniPossible(word) && isEnglishWord(word);
}

class XhosaPhonemizer implements Phonemizer {
    constructor(
        private foreign?: ForeignPhonemizer,
        private isEnglishWord?: (w: string) => boolean,
    ) {}

    text(input: string): string {
        // normalize.ts runs BEFORE the shared tier, and leaves every operand as DIGITS precisely so the
        // tier can still see number–unit adjacency (the one exception is the clock, which must produce
        // words for the `na-` connective and therefore claims its own marker and timezone).
        return assembleClauses(SYMBOLS(normalizeXhosa(input)), TOKEN, (m, sink) => {
            if (m[1]) {
                // Foreign FIRST: a click letter in an English word is not a click.
                if (this.foreign !== undefined && this.isEnglishWord !== undefined &&
                    isForeignNguniWord(m[1].toLowerCase(), this.isEnglishWord))
                    sink.emit(this.foreign(m[1]));
                else sink.emit(phonemizeWord(nat(m[1])));
            }
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Xhosa phonemizer (shared Nguni g2p + penultimate stress; tone deferred). */
export function createXhosa(foreign?: ForeignPhonemizer, isEnglishWord?: (w: string) => boolean): Phonemizer {
    return new XhosaPhonemizer(foreign, isEnglishWord);
}
