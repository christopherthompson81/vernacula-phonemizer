/**
 * Native Punjabi (pa) text phonemizer — canonical IPA. Gurmukhi is a Brahmic abugida read
 * by the generic engine (core/abugida.ts); on top, punjabi.ts adds the features Hindi's assembly does not share:
 *
 *   1. addak ੱ gemination — the following consonant is long (ਪੱਕਾ → pəkːaː).
 *   2. TONOGENESIS (Punjabi's signature): the historical voiced-aspirate letters ਘ ਝ ਢ ਧ ਭ (carried here as the
 *      breathy markers ɡʱ d͡ʒʱ ɖʱ d̪ʱ bʱ) DE-ASPIRATE and shift tone — voiceless + LOW tone word-initially
 *      (ਘੋੜਾ → kòːɽaː), voiced + HIGH tone post-vocalically (ਕੰਘਾ → kə́ŋɡaː).
 *   3. inherent-vowel (schwa) deletion — word-final + medial Ohala, shared with Hindi.
 *
 * The referee-eval strips Chao tone letters, so tones are graded on the synthesis output, not the backbone.
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { applyWeightStress } from "../../core/weightStress.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import { renderNumber, spellDigits, type NumbersDef } from "../../core/numbers.ts";
import { loadSharedPhonology, type Phonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadHarakatLexicon, restoreHarakat } from "../../core/harakatLexicon.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makePunjabiNormalizer } from "./normalize.ts";
import {
    scanShahmukhi,
    SHAHMUKHI_CLASS,
    SHAHMUKHI_WORD,
    shahmukhiDigit,
    shahmukhiPause,
} from "./shahmukhi.ts";

export interface PunjabiDef extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
    /** The shared symbol tier — NOT `symbols`, which is the bare-sign map. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        magnitudes: string[];
        ampersand: string;
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        magnitudes: string[];
        ampersand: string;
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
}
export type ForeignPhonemizer = (latin: string) => string;

const VOWEL = "əaɪiʊueɛoɔ";
const VOWEL_G = new RegExp(`[${VOWEL}]`, "g");
const GURMUKHI_WORD = "਀-੿";
const GURMUKHI_DIGITS: Record<string, string> = {
    "੦": "0", "੧": "1", "੨": "2", "੩": "3", "੪": "4",
    "੫": "5", "੬": "6", "੭": "7", "੮": "8", "੯": "9",
};
const DIGIT_CLASS = "0-9\\u0660-\\u0669\\u06F0-\\u06F9" + Object.keys(GURMUKHI_DIGITS).join("");
const ADDAK = "ੱ";
const CONS_CLASS = "ਕ-ਹਖ਼-ੜ"; // Gurmukhi consonant range (for addak gemination)

// Historical voiced aspirate → [word-initial voiceless, post-vocalic voiced] de-aspirated realization.
const BREATHY: Record<string, [string, string]> = {
    "d͡ʒʱ": ["t͡ʃ", "d͡ʒ"],
    "ɡʱ": ["k", "ɡ"],
    "ɖʱ": ["ʈ", "ɖ"],
    "d̪ʱ": ["t̪", "d̪"],
    "bʱ": ["p", "b"],
};
const BREATHY_KEYS = Object.keys(BREATHY).sort((a, b) => b.length - a.length);
const HIGH = "˥˩", // high-falling tone (post-vocalic source)
    LOW = "˨˩"; // low(-rising) tone (word-initial source)

/** Append a tone letter after the LAST vowel (+ length) already in `s`. */
function toneOnLastVowel(s: string, tone: string): string {
    const m = [...s.matchAll(new RegExp(`[${VOWEL}]ː?̃?`, "gu"))].pop();
    if (!m) return s;
    const end = m.index! + m[0].length;
    return s.slice(0, end) + tone + s.slice(end);
}

/** Punjabi tonogenesis: rewrite each breathy voiced-aspirate marker to its de-aspirated, TONED realization —
 *  voiceless + low tone in a word-initial onset, voiced + high tone post-vocalically. */
function tonogenesis(ipa: string): string {
    let out = "";
    let i = 0;
    let seenVowel = false;
    while (i < ipa.length) {
        const key = BREATHY_KEYS.find((k) => ipa.startsWith(k, i));
        if (key) {
            const [voiceless, voiced] = BREATHY[key]!;
            if (!seenVowel) {
                out += voiceless;
                i += key.length;
                const vm = new RegExp(`^[${VOWEL}]ː?̃?`, "u").exec(ipa.slice(i));
                if (vm) {
                    out += vm[0] + LOW;
                    i += vm[0].length;
                    seenVowel = true;
                }
            } else {
                out = toneOnLastVowel(out, HIGH);
                out += voiced;
                i += key.length;
            }
            continue;
        }
        const ch = ipa[i]!;
        if (VOWEL.includes(ch)) seenVowel = true;
        out += ch;
        i++;
    }
    return out;
}

/** Variety options. Saraiki (skr) is the NON-tonal Lahnda sibling: it never underwent Punjabi's tonogenesis (it
 *  kept the voiced aspirates AND its aspirated sonorants — لھ→lʰ), and it writes retroflex ɳ explicitly (ݨ), so
 *  the plain-ن→ɳ infinitive heuristic must not fire. One declarative flag toggles all three (ADR-2). */
export interface PunjabiOpts {
    saraiki?: boolean;
    /** The variety's OWN pre-tokenizer pass, replacing the Punjabi one. Saraiki supplies
     *  `normalizeSaraiki`; without it the `saraiki` flag leaves the text unnormalized (which is what it did
     *  before that layer existed — see the comment on `normalize` below). */
    normalize?: (text: string) => string;
}

export function makeNativePunjabi(
    def: PunjabiDef,
    phon: Phonology = loadSharedPhonology(),
    foreign?: ForeignPhonemizer,
    opts: PunjabiOpts = {},
) {
    const g2p = makeAbugidaG2P(def, phon);
    const CLAUSE_MARK = def.clausePunctuation;
    const addakRe = new RegExp(`${ADDAK}([${CONS_CLASS}]਼?)`, "gu");
    const tokenRe = new RegExp(
            // ⚠ ALL OF LATIN, not just ASCII: `[A-Za-z]+` ended the token at a diacritic, so the letter carrying it
    // became an unclaimed gap read as an English LETTER NAME and the rest of the word started over —
    // `São Paulo` read *ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ*, "ES ə O Paulo". This group already means FOREIGN (its match goes
    // to the injected reader), so widening it is the whole fix. Same change as the shared abugida tokenizer.
    `([${GURMUKHI_WORD}${SHAHMUKHI_CLASS}]+)|(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)|([${DIGIT_CLASS}]+)|([।॥.?!,;:۔؟،؛])`,
        "gu",
    );

    function word(w: string): string {
        // Raw canonical IPA, script-routed: Shahmukhi (Perso-Arabic) → the abjad scanner, else the Gurmukhi
        // abugida (with addak ੱ pre-normalized to a geminate ਪੱਕਾ → ਪਕ੍ਕਾ). Both feed the shared post-processing.
        const isShah = SHAHMUKHI_WORD.test(w);
        let x = isShah
            ? scanShahmukhi(w)
            : g2p(w.normalize("NFC").replace(addakRe, "$1੍$1"));
        // geminate → length + aspiration-before-length reorder.
        x = x
            .replace(/(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ɖʱ|ʈʰ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlsʃɾɽŋɳɭjɦʋʈɖqxzɣf])\1(?!͡)/gu, "$1ː")
            .replace(/ː([ʰʱ])/gu, "$1ː");
        // word-final then medial inherent-vowel (schwa) deletion — same as Hindi.
        const syls = (x.match(VOWEL_G) || []).length;
        if (syls >= 2) x = x.replace(/ə$/u, "");
        x = deleteMedialSchwa(x);
        // Homorganic nasal assimilation: a plain /n/ takes the place of a following velar/palatal/retroflex stop
        // (ਪੰਜਾਬੀ ɲd͡ʒ, ŋɡ, ɳɖ). Gurmukhi encodes this via tippi ੰ + the engine's homorganic nasal; Shahmukhi
        // writes a generic ن, so the raw string carries a plain n here — assimilate it (matches wikipron pan_arab).
        x = x
            .replace(/n(?=t͡ʃ|d͡ʒ)/gu, "ɲ")
            .replace(/n(?=ʈʰ|ɖʱ|[ʈɖɽ])/gu, "ɳ")
            .replace(/n(?=kʰ|ɡʱ|[kɡxɣq])/gu, "ŋ");
        // SHAHMUKHI-ONLY: the verbal infinitive/causative ending is RETROFLEX -ਣਾ [ɳaː] (آکھنا→aːkʰɳaː, بنانا→
        // bənaːɳaː) EXCEPT after a rhotic /ɾ ɽ/, where it is DENTAL -ਨਾ [naː] (کرنا→kəɾnaː, مارنا→maːrnaː, پھڑنا→
        // pʰəɽnaː) — a real Punjabi morphophonemic split that GURMUKHI spells orthographically (ਣ vs ਨ). Shahmukhi
        // writes both with the ambiguous plain ن, so retroflex a word-final naː UNLESS a rhotic precedes; Gurmukhi
        // is authoritative (never fire). +24 net vs the Shahmukhi referee (breaks only the 3 nouns نانا/مہینہ/انھا
        // that also end in a non-rhotic ...aːnaː — a small lexical cost).
        // (SKR skips this: Saraiki writes retroflex ɳ explicitly as ݨ, so a plain ن is unambiguously [n].)
        if (isShah && !opts.saraiki) x = x.replace(/(?<![ɾɽ])n(aː)$/u, "ɳ$1");
        // TONOGENESIS: de-aspirate the breathy markers + assign tone. (SKR is NON-tonal — skip it, keeping the
        // voiced aspirates bʰ d̪ʱ ɡʱ … as segments.)
        if (!opts.saraiki) x = tonogenesis(x);
        // Punjabi has NO phonemic /ʔ/ — the loanword letters ع/ء are silent / hiatus carriers, not glottal stops
        // (اعتراض → et̪raːz, not əʔət̪raːz) — and NO aspirated SONORANTS — نھ/لھ/مھ are the sonorant + /h/ (a tone
        // source), not [nʱ/lʱ/mʱ] (the referee writes plain n/l/m). Both are no-ops for Gurmukhi input (its scanner
        // produces neither), so this is unscripted. +13 net vs the Shahmukhi referee. (SKR KEEPS aspirated
        // sonorants — لھ→lʰ is a real Saraiki segment the referee writes — so only the ʔ removal applies.)
        if (!opts.saraiki) x = x.replace(/([nlmɳɭɽ])ʱ/gu, "$1");
        x = x.replace(/ʔ/gu, "");
        return applyWeightStress(x).normalize("NFC");
    }

    /**
     * The SHIPPED word path: the lexicon tiers in front of the rule engine, in the precedence the exported
     * `phonemizeWord` already documents — mined Gurmukhi exceptions → cross-script gold → harakat restore →
     * `word`.
     *
     * ⚠ text() USED TO CALL `word` DIRECTLY, so the shipped engine consulted NONE of the three lexicons and
     * every one of them was dead weight on the only path users reach. Measured when it was found: 153 of the
     * 200 pa golden rows contain at least one word the Gurmukhi exceptions lexicon covers — words mined
     * precisely because the rules get them wrong — and the 11,166-entry cross-script GOLD lexicon was unused
     * outright, so `آئرلینڈ` read *aːˈiːɾliːnəɖ* against its gold *aːɪɾlˈɛ̃ɳɖ*.
     *
     * ⚠ AND IT BROKE THE NEURAL RIDER'S DESIGN, which is how it stayed invisible: the rider diacritizer leaves
     * a lexicon-covered word BARE on purpose, so that "the authoritative sync lexicon layer" vocalizes it
     * (core/riderDiacritizer.ts says exactly that). With no such layer wired, those words got neither the
     * neural vocalization nor the lexicon — the one class the whole precedence exists to serve.
     *
     * `word` itself is deliberately left lexicon-free: `phonemizeWordCore` and the mining tool depend on that,
     * and `phonemizeWordEval` must never see the guru lexicon (it is mined FROM the referee).
     *
     * SARAIKI IS GATED OFF: these are Punjabi lexicons (Gurmukhi keys, pa cross-script pairs), and skr shares
     * only the factory. Same gate as tonogenesis and the ɳ heuristic above.
     */
    function shippedWord(w: string): string {
        if (opts.saraiki) return word(w);
        return (
            guruLexicon().get(w) ??
            crossScriptLexicon().get(w) ??
            word(restoreHarakat(w, harakatLexicon()))
        );
    }

    const toAscii = (d: string): string =>
        [...d].map((c) => GURMUKHI_DIGITS[c] ?? shahmukhiDigit(c) ?? c).join("");
    function number(digits: string): string {
        const n = Number(toAscii(digits));
        // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
        // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
        // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
        // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
        // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
        if (!Number.isSafeInteger(n)) return spellDigits(toAscii(digits), def.numbers, word);
        return renderNumber(n, def.numbers, word);
    }

    // Punjabi-specific rewrites (the shared symbol tier, digit de-grouping, decimals,
    // the clock, ordinal suffixes, Gurmukhi unit abbreviations, the era marker and degrees) BEFORE
    // tokenization. Roman numerals need no ordering care: `pa` is not in the registry's ROMAN_NATIVE set,
    // so the shared roman→digit pass has already run at the registry seam. See normalize.ts for the
    // corpus counts and the step-by-step ordering couplings.
    //
    // GATED OFF FOR SARAIKI. skr builds on this same factory (saraiki.ts) and would inherit the whole pass,
    // but the pass EMITS PUNJABI WORDS — ਪ੍ਰਤੀਸ਼ਤ, ਡਾਲਰ, ਡਿਗਰੀ, ਈਸਾ ਪੂਰਵ. ⚠ THE VARIETY MAY NOW SUPPLY ITS
    // OWN, which is what `opts.normalize` is for: Saraiki passes `normalizeSaraiki` (Shahmukhi words,
    // three digit sets, the Arabic comma), and the identity fallback is the behaviour that shipped while
    // that layer did not exist.
    const normalize = opts.normalize ?? (opts.saraiki ? (s: string) => s : makePunjabiNormalizer(def.numbers));

    function text(input: string): string {
        // Fold this script's own digits to ASCII first: the number token is `\d+`, which JavaScript
        // defines as ASCII-only, so a numeral written in native digits matched NO token and was
        // dropped entirely — the engine returned an empty string for it (core/unicode.ts). It runs
        // BEFORE `normalize`, whose patterns are all written against ASCII digits.
        return assembleClauses(normalize(foldNativeDigits(input)), tokenRe, (m, sink) => {
            if (m[1]) sink.emit(shippedWord(m[1]));
            else if (m[2]) sink.emit(foreign ? foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]] ?? shahmukhiPause(m[4]);
                if (mk) sink.pause(mk);
            }
        });
    }
    return { word, shippedWord, number, text };
}

// COVERAGE layer: mined Shahmukhi (Perso-Arabic) skeletons are vocalized before g2p; Gurmukhi input has no
// harakat keys in the lexicon so it passes through unchanged (see core/harakatLexicon.ts). Loaded LAZILY
// (registry.ts imports every rider eagerly; the TSV is only read on first Punjabi use).
let LEXICON: ReadonlyMap<string, string> | undefined;
export function harakatLexicon(): ReadonlyMap<string, string> {
    return (LEXICON ??= loadHarakatLexicon(import.meta.url));
}

/** Lexicon-FREE core: bare word→IPA. Used by the mining tool, which must NOT consult the content lexicon (mining
 *  candidates would collide with content homographs). The number path already uses this via the `word` closure. */
export function phonemizeWordCore(w: string): string {
    return (PA ??= makeNativePunjabi(
        loadManifest<PunjabiDef>(import.meta.url, "punjabi.jsonc"),
    )).word(w);
}

/** The Punjabi manifest — reused by the Saraiki (skr) module, which shares the Shahmukhi front-end and Lahnda
 *  phonology (Gurmukhi g2p unused; numbers deferred to a skr manifest). */
export function loadPunjabiManifest(): PunjabiDef {
    return loadManifest<PunjabiDef>(import.meta.url, "punjabi.jsonc");
}

// CROSS-SCRIPT layer: a direct Shahmukhi-word → GOLD-IPA lexicon whose vowels come from the VOWELED Gurmukhi
// sister-spelling (kaikki real dual-script pairs; crossscript.tsv). It resolves ALL THREE abjad ambiguities the
// harakat layer cannot fully reach — short vowels, the majhūl و/ی ([oː]~[uː], [iː]~[eː]), AND ن vs retroflex ݨ
// (a consonant, not a harakat) — so it takes PRECEDENCE for a covered word. Gurmukhi input never matches (keys are
// Perso-Arabic).
let CROSS: ReadonlyMap<string, string> | undefined;
export function crossScriptLexicon(): ReadonlyMap<string, string> {
    return (CROSS ??= loadTsvMap(import.meta.url, "crossscript.tsv", undefined, { optional: true }));
}

/**
 * Bare word→IPA for the REFEREE EVAL: cross-script gold → coverage-lexicon restore → the lexicon-free core.
 *
 * ⚠ THIS FUNCTION MUST NEVER CONSULT `guruLexicon` — that lexicon is MINED FROM the pan_guru referee, so an
 * eval that read it would score the answer key (the af/en-GB/km house pattern: the eval scores a
 * lexicon-free-ish path, the shipped path adds the mined tier on top). The cross-script layer stays: its
 * readings come from OUR OWN g2p over the voweled Gurmukhi sister-spelling, not from any referee's labels.
 */
export function phonemizeWordEval(w: string): string {
    return (
        crossScriptLexicon().get(w) ??
        phonemizeWordCore(restoreHarakat(w, harakatLexicon()))
    );
}

// GURMUKHI EXCEPTIONS LEXICON — wikipron pan_guru readings for the words the rules get wrong; mostly the
// medial-schwa class proven lexical three ways (audio adjudication, two failed rule derivations, the 52:40
// population split — investigation Runs 1-4). Mined by tools/gen/build-pa-guru-lexicon.mts; CC-BY-SA (§3).
let GURU: ReadonlyMap<string, string> | undefined;
export function guruLexicon(): ReadonlyMap<string, string> {
    return (GURU ??= loadTsvMap(import.meta.url, "gurmukhi-lexicon.tsv", undefined, { optional: true }));
}

/** Bare word→IPA, SHIPPED: the mined Gurmukhi exceptions lexicon first (keys are Gurmukhi script, so
 *  Shahmukhi input never matches), then the eval path. */
export function phonemizeWord(w: string): string {
    return guruLexicon().get(w) ?? phonemizeWordEval(w);
}
let PA: ReturnType<typeof makeNativePunjabi> | undefined;

/** Build the Punjabi phonemizer. `foreign` handles embedded Latin. */
export function createPunjabi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativePunjabi(
        loadManifest<PunjabiDef>(import.meta.url, "punjabi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}
