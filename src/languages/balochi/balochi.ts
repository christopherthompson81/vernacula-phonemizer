/**
 * Native Balochi / بلوچی (bal) text phonemizer — canonical IPA. Northwestern Iranian; SOUTHERN
 * Balochi. Authored from Jahani & Korn (2009) + Korn (2005a). CROSS-SCRIPT: Balochi is written in both the Balochi
 * ARABIC alphabet (default) and a ROMAN orthography, so this handles either — a token's script is detected and
 * routed. The Arabic script is a DEFECTIVE abjad (short /a i u/ unwritten AND ⟨و⟩/⟨ی⟩ conflate uː/oː, iː/eː), so
 * its rule g2p recovers only a consonant + long-vowel skeleton; the Roman orthography is phonemic (writes every
 * vowel). A CROSS-SCRIPT LEXICON (balochi-lexicon.tsv: arabic↔roman↔full-IPA, from Korn/J&K/ASJP) bridges them —
 * a word looked up by EITHER spelling returns the full-voweled IPA the abjad loses; OOV falls back to the per-script
 * g2p. SIGNATURE: retroflex ٹ→ʈ ڈ→ɖ ڑ→ɽ (Indic contact) vs dental ت→t̪ د→d̪; ق→k; unaspirated. Cardinals use
 * the Iranian-core / lakh-crore-magnitude compositor in numbers.ts (Jahani & Korn Table 11.19).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { renderNumber } from "../../core/numbers.ts";
import { balochiNumberWords, encliticWord, type BalNumbersDef } from "./numbers.ts";

interface BalochiDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    numbers: BalNumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<BalochiDef>(import.meta.url, "balochi.jsonc");
const CONS = DEF.consonants;
const VOW = DEF.vowels;
const CLAUSE_MARK = DEF.clausePunctuation;
const VOWEL_LETTERS = new Set([..."اآوىیے"]);

// Cross-script lexicon (arabic <TAB> roman <TAB> ipa). Loaded once; keyed by BOTH spellings → full-voweled IPA.
let LEX_AR: Map<string, string> | undefined;
let LEX_RO: Map<string, string> | undefined;
function lexicon(): { ar: Map<string, string>; ro: Map<string, string> } {
    if (LEX_AR === undefined) {
        // loadTsvMap gives arabic → "roman\tipa"; split into the two views.
        const raw = loadTsvMap(import.meta.url, "balochi-lexicon.tsv");
        LEX_AR = new Map();
        LEX_RO = new Map();
        for (const [ar, rest] of raw) {
            const tab = rest.indexOf("\t");
            if (tab < 0) continue;
            const roman = rest.slice(0, tab), ipa = rest.slice(tab + 1);
            LEX_AR.set(ar, ipa);
            LEX_RO.set(roman.normalize("NFC"), ipa);
        }
    }
    return { ar: LEX_AR!, ro: LEX_RO! };
}

// ── Arabic-script g2p (defective abjad → consonant + long-vowel skeleton) ─────────────────────────────────────
/** One Balochi word in the Arabic script → skeleton IPA (short vowels unwritten; و→uː, ی→iː defaulted). */
export function phonemizeArabic(word: string): string {
    const w = [...word.replace(/[‌ـ]/gu, "")];
    const toks: string[] = [];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!, prev = w[i - 1] ?? "", nxt = w[i + 1] ?? "";
        if (CONS[c] !== undefined) { toks.push(CONS[c]!); continue; }
        if (VOW[c] !== undefined) { toks.push(VOW[c]!); continue; }
        if (c === "ع" || c === "ئ" || c === "ء") continue;
        if (c === "ں") { toks.push("̃"); continue; }
        const glide = i === 0 || VOWEL_LETTERS.has(prev) || VOWEL_LETTERS.has(nxt);
        if (c === "و") toks.push(glide ? "w" : "uː");
        else if (c === "ی" || c === "ى") toks.push(glide ? "j" : "iː");
    }
    return toks.join("");
}

// ── Roman-script g2p (phonemic orthography → full IPA) ────────────────────────────────────────────────────────
const R_VOWEL = new Set([..."aeiou"]);
const R_LONG: Record<string, string> = { a: "aː", e: "eː", i: "iː", o: "oː", u: "uː" };
const R_SHORT: Record<string, string> = { a: "a", e: "eː", i: "i", o: "oː", u: "u" }; // e,o have no short counterpart
const R_CONS: Record<string, string> = {
    b: "b", p: "p", t: "t̪", d: "d̪", k: "k", g: "ɡ", q: "k", f: "f", v: "v", s: "s", z: "z",
    š: "ʃ", ž: "ʒ", c: "t͡ʃ", j: "d͡ʒ", x: "x", ġ: "ɣ", h: "h", m: "m", n: "n", r: "r", l: "l", w: "w", y: "j",
};
const RETRO: Record<string, string> = { "t̪": "ʈ", "d̪": "ɖ", r: "ɽ", n: "ɳ", s: "ʂ", l: "ɭ" };
const POSTALV: Record<string, string> = { c: "t͡ʃ", s: "ʃ", z: "ʒ", j: "d͡ʒ" };
const MACRON = "̄", HACEK = "̌", DOTBELOW = "̣";

/** One Balochi word in the Roman orthography → full IPA. Combining/precomposed macron→long vowel, háček→postalveolar,
 *  dot-below→retroflex (NFD unifies precomposed ā/š/ṭ and the combining forms). */
export function phonemizeRoman(word: string): string {
    const a = [...word.toLowerCase().normalize("NFD")];
    const out: string[] = [];
    for (let i = 0; i < a.length; i++) {
        const ch = a[i]!;
        if (ch === MACRON || ch === HACEK || ch === DOTBELOW) continue;
        const nxt = a[i + 1] ?? "";
        const mac = nxt === MACRON, hac = nxt === HACEK, dot = nxt === DOTBELOW;
        if (R_VOWEL.has(ch)) {
            out.push(mac ? R_LONG[ch]! : R_SHORT[ch]!);
        } else if (R_CONS[ch] !== undefined) {
            let c = hac ? POSTALV[ch] ?? R_CONS[ch]! : R_CONS[ch]!;
            if (dot) c = RETRO[c] ?? RETRO[ch] ?? c;
            out.push(c);
        }
    }
    return out.join("");
}

// ── Unified: script detection + lexicon-first ────────────────────────────────────────────────────────────────
const HAS_LATIN = /[a-zāēīōūšžčǰṭḍṛġ]/iu;

/** One Balochi word → canonical IPA. Script auto-detected; the cross-script lexicon (full vowels) is tried first,
 *  then the per-script g2p (Roman = full vowels; Arabic = consonant + long-vowel skeleton). */
export function phonemizeWord(word: string): string {
    const { ar, ro } = lexicon();
    if (HAS_LATIN.test(word)) {
        const key = word.toLowerCase().normalize("NFC");
        return ro.get(key) ?? phonemizeRoman(word);
    }
    return ar.get(word) ?? phonemizeArabic(word);
}

/** A run of ASCII digits → the spoken Balochi cardinal in canonical IPA (out-of-range integers pass through). */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, encliticWord(phonemizeWord, DEF.numbers), balochiNumberWords);
}

// A word (Arabic Balochi letters OR Roman incl. diacritics) / number / punctuation token.
const TOKEN = new RegExp(`([ؠ-ۿ‌]+|${LATIN_RUN})|(\\d+)|([،؛؟.!?…,:])`, "giu");
/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it is no longer also
 * deciding where the script boundary falls.
 *
 * ⚠ ONE ADDITION BEYOND THE VERBATIM LIFT: the combining caron U+030C. `ǰ` is precomposed in LOWER case only (U+01F0), so a capital J-caron is always base + combining caron — so a
 * CAPITALISED native word failed the inventory test and the fold stripped its diacritic. Harmless while the
 * class was only deciding tokenization (the letter fell out of the token and fragmented, which is the defect this
 * issue is about); it becomes a silent DELETION the moment the class also drives the fold. Found by checking every
 * class against the upper case of its own letters, not by a corpus.
 */
const NATIVE_CLASS = "[a-zāēīōūšžčǰṭḍṛġ\\u030C]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

export type ForeignPhonemizer = (latin: string) => string;

class BalochiPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Balochi (Southern) phonemizer — cross-script (Arabic + Roman), lexicon-composed; numbers.ts cardinals. */
export function createBalochi(foreign?: ForeignPhonemizer): Phonemizer {
    return new BalochiPhonemizer(foreign);
}
