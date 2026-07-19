/**
 * Native Punjabi (pa) text phonemizer — canonical IPA, espeak-independent. Gurmukhi is a Brahmic abugida read
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
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { applyWeightStress } from "../../core/weightStress.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadSharedPhonology, type Phonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadHarakatLexicon, restoreHarakat } from "../../core/harakatLexicon.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { assembleClauses } from "../../core/clauses.ts";
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

export function makeNativePunjabi(
    def: PunjabiDef,
    phon: Phonology = loadSharedPhonology(),
    foreign?: ForeignPhonemizer,
) {
    const g2p = makeAbugidaG2P(def, phon);
    const CLAUSE_MARK = def.clausePunctuation;
    const addakRe = new RegExp(`${ADDAK}([${CONS_CLASS}]਼?)`, "gu");
    const tokenRe = new RegExp(
        `([${GURMUKHI_WORD}${SHAHMUKHI_CLASS}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+)|([।॥.?!,;:۔؟،؛])`,
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
        if (isShah) x = x.replace(/(?<![ɾɽ])n(aː)$/u, "ɳ$1");
        // TONOGENESIS: de-aspirate the breathy markers + assign tone.
        x = tonogenesis(x);
        // Punjabi has NO phonemic /ʔ/ — the loanword letters ع/ء are silent / hiatus carriers, not glottal stops
        // (اعتراض → et̪raːz, not əʔət̪raːz) — and NO aspirated SONORANTS — نھ/لھ/مھ are the sonorant + /h/ (a tone
        // source), not [nʱ/lʱ/mʱ] (the referee writes plain n/l/m). Both are no-ops for Gurmukhi input (its scanner
        // produces neither), so this is unscripted. +13 net vs the Shahmukhi referee.
        x = x.replace(/([nlmɳɭɽ])ʱ/gu, "$1").replace(/ʔ/gu, "");
        return applyWeightStress(x).normalize("NFC");
    }

    const toAscii = (d: string): string =>
        [...d].map((c) => GURMUKHI_DIGITS[c] ?? shahmukhiDigit(c) ?? c).join("");
    function number(digits: string): string {
        const n = Number(toAscii(digits));
        if (!Number.isSafeInteger(n)) return digits;
        return renderNumber(n, def.numbers, word);
    }

    function text(input: string): string {
        return assembleClauses(input, tokenRe, (m, sink) => {
            if (m[1]) sink.emit(word(m[1]));
            else if (m[2]) sink.emit(foreign ? foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]] ?? shahmukhiPause(m[4]);
                if (mk) sink.pause(mk);
            }
        });
    }
    return { word, number, text };
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

// CROSS-SCRIPT layer: a direct Shahmukhi-word → GOLD-IPA lexicon whose vowels come from the VOWELED Gurmukhi
// sister-spelling (kaikki real dual-script pairs; crossscript.tsv). It resolves ALL THREE abjad ambiguities the
// harakat layer cannot fully reach — short vowels, the majhūl و/ی ([oː]~[uː], [iː]~[eː]), AND ن vs retroflex ݨ
// (a consonant, not a harakat) — so it takes PRECEDENCE for a covered word. Gurmukhi input never matches (keys are
// Perso-Arabic). See docs/investigations/pnb_native_bringup_investigation.md.
let CROSS: ReadonlyMap<string, string> | undefined;
export function crossScriptLexicon(): ReadonlyMap<string, string> {
    return (CROSS ??= loadTsvMap(import.meta.url, "crossscript.tsv", undefined, { optional: true }));
}

/** Bare word→IPA (tests / referee eval): cross-script gold → coverage-lexicon restore → the lexicon-free core. */
export function phonemizeWord(w: string): string {
    return (
        crossScriptLexicon().get(w) ??
        phonemizeWordCore(restoreHarakat(w, harakatLexicon()))
    );
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
