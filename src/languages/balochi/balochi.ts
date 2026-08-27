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
import { renderNumber, spellDigits } from "../../core/numbers.ts";
import { balochiNumberWords, encliticWord, type BalNumbersDef } from "./numbers.ts";
import { makeBalochiNormalizer } from "./normalize.ts";

interface BalochiDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    vowelLetters: readonly string[];
    harakat: Record<string, string>;
    sukun: string;
    shadda: string;
    roman: {
        vowelLetters: readonly string[];
        long: Record<string, string>;
        short: Record<string, string>;
        consonants: Record<string, string>;
        retroflex: Record<string, string>;
        postalveolar: Record<string, string>;
    };
    numbers: BalNumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<BalochiDef>(import.meta.url, "balochi.jsonc");
const CONS = DEF.consonants;
const VOW = DEF.vowels;
const CLAUSE_MARK = DEF.clausePunctuation;
const VOWEL_LETTERS = new Set(DEF.vowelLetters);

// Cross-script lexicon (arabic <TAB> roman <TAB> ipa). Loaded once; keyed by BOTH spellings → full-voweled IPA.
let LEX_AR: Map<string, string> | undefined;
let LEX_RO: Map<string, string> | undefined;
/** ⚠ EXPORTED FOR `test/lexicon-reachability.test.ts` — see swedish.ts. */
export function lexicon(): { ar: Map<string, string>; ro: Map<string, string> } {
    if (LEX_AR === undefined) {
        // loadTsvMap gives arabic → "roman\tipa"; split into the two views.
        // ⚠ #1068: alias each key to its nativised spelling — `text()` folds before it looks up. 4 keys, all
        // the same shape: the alef-madda ⟨آ⟩ folds to bare ⟨ا⟩ (آپ→اپ, آس→اس, آتک→اتک), so the headword the
        // dictionary actually writes could never be matched.
        const raw = loadTsvMap(import.meta.url, "balochi-lexicon.tsv", undefined, { fold: (k) => nat(k) });
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
const HARAKAT = DEF.harakat;

/**
 * ⚠ SHADDA BEFORE ITS VOWEL MARK. The canonical Unicode order is the other way round — a vowel mark has
 * combining class 30 and the shadda 33 — so ⟨لُّ⟩ arrives as ⟨ل⟩+ḍamma+shadda and a scan that reads the marks
 * left to right meets the vowel first. Rewriting the pair puts the shadda back on its consonant.
 */
const SHADDA_AFTER_VOWEL = /([َُِ])ّ/gu;

/**
 * One Balochi word in the Arabic script → skeleton IPA (و→uː, ی→iː defaulted).
 *
 * ⚠ THE SHORT VOWELS ARE READ WHEN THEY ARE WRITTEN. This engine's manifest calls Balochi's abjad defective
 * because /a i u/ have no letter, and that is true — but they do have MARKS, and the mined corpus uses them
 * 449 times, so `silentCharsIn` reported all four as producing nothing (بُته → *bt̪h*, گُش → *ɡʃ*). Where the
 * text supplies the vowel the ceiling does not apply, and the skeleton is now only the fallback.
 *
 * ⚠ AND A HARAKA ON THE WORD-INITIAL ALIF REPLACES IT rather than adding to it: in Perso-Arabic writing that
 * alif is a SEAT with no sound of its own, so ⟨اَنت⟩ is /ant̪/ and not /aːant̪/ — reading both gave *aːnt̪*,
 * the long vowel of the seat with the real vowel dropped. Likewise ⟨ـُو⟩ and ⟨ـِی⟩ are the ordinary
 * Perso-Arabic mater-lectionis spellings of the LONG /uː iː/, so the mark pins the glide rather than
 * preceding it (⟨اُوتاوا⟩ Ottawa → uːt̪aːwaː, not *uwt̪aːwaː*).
 */
export function phonemizeArabic(word: string): string {
    const w = [...word.replace(/[‌ـ]/gu, "").replace(SHADDA_AFTER_VOWEL, "ّ$1")];  // ZWNJ, tatweel
    const toks: string[] = [];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!, prev = w[i - 1] ?? "", nxt = w[i + 1] ?? "";
        const hk = HARAKAT[c];
        if (hk !== undefined) {
            // ⟨ـُو⟩ → uː and ⟨ـِی⟩ → iː: the mark disambiguates the mater, which is then consumed.
            if (hk === "u" && nxt === "و") { toks.push("uː"); i++; }
            else if (hk === "i" && (nxt === "ی" || nxt === "ى")) { toks.push("iː"); i++; }
            else toks.push(hk);
            continue;
        }
        // The shadda geminates the consonant it now precedes. Guarded against a doubled length mark, which is
        // what a corpus typo (a shadda on a long vowel, ⟨بیّهءن⟩) would otherwise produce.
        if (c === DEF.shadda) {
            const last = toks[toks.length - 1];
            if (last !== undefined && !last.endsWith("ː")) toks[toks.length - 1] = `${last}ː`;
            continue;
        }
        if (c === DEF.sukun) continue; // explicit "no vowel here"
        if (CONS[c] !== undefined) { toks.push(CONS[c]!); continue; }
        if (VOW[c] !== undefined) {
            // A word-initial alif carrying a haraka is that vowel's SEAT and has no sound of its own.
            if (i === 0 && (c === "ا" || c === "آ") && HARAKAT[nxt] !== undefined) continue;
            toks.push(VOW[c]!);
            continue;
        }
        if (c === "ع" || c === "ئ" || c === "ء") continue;
        if (c === "ں") { toks.push("̃"); continue; }
        const glide = i === 0 || VOWEL_LETTERS.has(prev) || VOWEL_LETTERS.has(nxt);
        if (c === "و") toks.push(glide ? "w" : "uː");
        else if (c === "ی" || c === "ى") toks.push(glide ? "j" : "iː");
    }
    return toks.join("");
}

// ── Roman-script g2p (phonemic orthography → full IPA) ────────────────────────────────────────────────────────
// The Roman half's tables (balochi.jsonc `roman`). The diacritic LOGIC — which mark reaches for which
// table, and that a macron may be combining or precomposed — is the scan below.
const R_VOWEL = new Set(DEF.roman.vowelLetters);
const R_LONG = DEF.roman.long;
const R_SHORT = DEF.roman.short;
const R_CONS = DEF.roman.consonants;
const RETRO = DEF.roman.retroflex;
const POSTALV = DEF.roman.postalveolar;
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
        // ⚠ THE NATIVISER BELONGS TO THE ROMAN HALF ONLY, AND APPLYING IT TO THE ARABIC HALF DELETED EVERY
        // COMBINING MARK IN THE LANGUAGE. `NATIVE_CLASS` is a LATIN inventory, so an Arabic word never matches
        // it; the fallback then folds each cluster with `foldLatinToBase`, which decomposes and strips marks —
        // silently removing all 449 harakat in the mined corpus before the g2p could see one. It is why
        // `silentCharsIn` reported ⟨ِ⟩ ⟨َ⟩ ⟨ُ⟩ ⟨ّ⟩ even after balochi.jsonc gained values for them, and it
        // cannot be fixed in the manifest: nothing survives to be read. Scoped to the branch it was written
        // for (`Klöcker` → klœkəɾ still folds; the Arabic arm is now untouched).
        word = nat(word);
        const key = word.toLowerCase().normalize("NFC");
        return ro.get(key) ?? phonemizeRoman(word);
    }
    return ar.get(word) ?? phonemizeArabic(word);
}

/** A run of ASCII digits → the spoken Balochi cardinal in canonical IPA (out-of-range integers pass through). */
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    // The enclitic wrapper is kept for the fallback too: it only fires on the connective marker the
    // COMPOSER appends between groups, so a lone digit never picks one up.
    if (!Number.isSafeInteger(n))
        return spellDigits(digits, DEF.numbers, encliticWord(phonemizeWord, DEF.numbers));
    return renderNumber(n, DEF.numbers, encliticWord(phonemizeWord, DEF.numbers), balochiNumberWords);
}

/**
 * A word (Arabic Balochi letters OR Roman incl. diacritics) / number / punctuation token.
 *
 * ⚠ THE ARABIC ARM REACHES INTO THE ARABIC SUPPLEMENT (U+0750–U+077F), AND WITHOUT THAT ONE RANGE THE
 * BALOCHI STANDARD ALPHABET'S ē IS DELETED. ݔ U+0754 sits outside U+0620–U+06FF, so it matched no arm at
 * all: the letter vanished AND split its word in two — `وڈݔن` read as *wɖ n*, `شݔر` as *ʃ r*. It occurs
 * ×506 in 149 of the corpus's 383 paragraphs (38.9%), which makes it the largest single reading defect
 * this language had, and it is invisible to every DROP class because those hunt a symbol that SURVIVES.
 * Same shape as ug's presentation forms; see `normalize.ts` step 3 for the other half of that family.
 * ⚠ ADDING THE RANGE IS NOT ENOUGH ON ITS OWN — a letter the tokenizer now KEEPS but the manifest has no
 * rule for is dropped one layer down instead, which is why `balochi.jsonc` gained ݔ and ۏ in the same
 * change. The token class decides where the SCRIPT boundary falls; the manifest decides what is read.
 */
const TOKEN = new RegExp(`([ؠ-ۿݐ-ݿ‌]+|${LATIN_RUN})|(\\d+)|([،؛؟۔٬.!?…,:])`, "giu");  // ZWNJ
/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where the
 * SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A token
 * this class REJECTS carries a letter the language does not use — i.e. a foreign name. See core/hostWord.ts.
 *
 * ⚠ ONE ADDITION BEYOND THE VERBATIM LIFT: the combining caron U+030C. `ǰ` is precomposed in LOWER case only (U+01F0), so a capital J-caron is always base + combining caron — so a
 * CAPITALISED native word failed the inventory test and the fold stripped its diacritic. Harmless while the
 * class was only deciding tokenization (the letter fell out of the token and fragmented, which is the defect this
 * issue is about); it becomes a silent DELETION the moment the class also drives the fold. Found by checking every
 * class against the upper case of its own letters, not by a corpus.
 */
const NATIVE_CLASS = "[a-zāēīōūšžčǰṭḍṛġ\\u030C]";
/** ⚠ EXPORTED FOR `test/lexicon-reachability.test.ts`, which asserts that every key in this engine's
 *  lexicons survives its own fold. A key the fold rewrites can never be matched from `text()`, and both
 *  engines agree on the miss, so the parity gate cannot see it (#1068). */
export const nat = makeNativiser(NATIVE_CLASS, "iu");

export type ForeignPhonemizer = (latin: string) => string;

/** The text-normalization pass (`normalize.ts`), given the one thing it needs from this file: whether a
 *  spelling is a lexicon headword. Passed as a dependency rather than imported the other way, because the
 *  engine calls the normalizer and the reverse import would be a cycle. */
const normalizeBalochi = makeBalochiNormalizer({ knownWord: (w) => lexicon().ar.has(w) });

class BalochiPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(normalizeBalochi(input), TOKEN, (m, sink) => {
            // ⚠ `nat` moved INSIDE phonemizeWord's Roman branch — see the note there. Applied here it also hit
            // every Arabic token, whose marks it stripped.
            if (m[1]) sink.emit(phonemizeWord(m[1]));
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
