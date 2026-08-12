/**
 * Nogai (nog) phonemizer — a near-deterministic digraph-aware Cyrillic grapheme scan + word-final
 * (oxytone) stress, canonical IPA. This file owns the position rules: coda ⟨в⟩→[w] vs onset [v], ⟨е⟩
 * iotation, stray ⟨ъ⟩→[ʔ], and the maximal-onset stress placement. The letter/digraph tables and the
 * encyclopedic record (written uvulars, attestation caveat) live in nogai.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { numberToWords } from "./numbers.ts";

interface NogaiDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    digraphs: Record<string, string>;
    vowelLetters: readonly string[];
}
const DEF = loadManifest<NogaiDef>(import.meta.url, "nogai.jsonc");
// Letter → IPA tables (nogai.jsonc). The position-dependent ⟨в е ъ⟩ are handled in the scan below.
const CONS = DEF.consonants;
const VOWEL = DEF.vowels;
const IOTATED = DEF.iotated;
const DIGRAPH = DEF.digraphs;
const CYR_VOWEL = new Set(DEF.vowelLetters);
const STRESS_NASAL = new Set(["m", "n", "ŋ"]);

/** Sonority for maximal-onset stress: vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
function sonority(seg: string): number {
    if ([...seg].some((c) => IPA_VOWEL.has(c))) return 6;
    if (seg === "j" || seg === "w") return 5;
    if (["l", "r"].includes(seg)) return 4;
    if (STRESS_NASAL.has(seg)) return 3;
    if (seg.includes("͡")) return 1;
    if (["f", "v", "s", "z", "ʃ", "ʒ", "x", "χ", "h", "ʁ", "ɣ"].includes(seg)) return 2;
    return 0;
}

/** Is an emitted IPA segment a vowel (or vowel-bearing)? Used for the coda-⟨в⟩, ⟨е⟩-iotation, and stress tests. */
const isVowelSeg = (s: string | undefined): boolean => s !== undefined && [...s].some((c) => IPA_VOWEL.has(c));

/** Phonemize one Nogai (Cyrillic) word → canonical IPA: digraph-aware grapheme scan + word-final stress. */
export function phonemizeWord(word: string): string {
    const chars = [...word.normalize("NFC").toLowerCase()];
    const segs: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        const pair = ch + (chars[i + 1] ?? "");
        if (DIGRAPH[pair] !== undefined) {
            segs.push(DIGRAPH[pair]!);
            i++; // consumed the second character
            continue;
        }
        // ⟨в⟩ → [w] in a post-vocalic coda (before a consonant or word-final): сув→suw, тав→taw; else [v] (onset/loan).
        // The "previous vowel" test reads the last EMITTED segment (not the raw prior char), so a front-vowel DIGRAPH
        // ⟨аь оь уь⟩ — whose second char is the soft sign ь — still counts as the preceding vowel.
        if (ch === "в") {
            const nx = chars[i + 1];
            const coda = nx === undefined || !CYR_VOWEL.has(nx);
            segs.push(isVowelSeg(segs[segs.length - 1]) && coda ? "w" : "v");
            continue;
        }
        // word-initial / post-vocalic ⟨е⟩ → [je]; after a consonant → [e]. Uses the last emitted segment so a preceding
        // front-vowel digraph counts as a vowel too.
        if (ch === "е") {
            segs.push(segs.length === 0 || isVowelSeg(segs[segs.length - 1]) ? "je" : "e");
            continue;
        }
        if (CONS[ch] !== undefined) segs.push(CONS[ch]!);
        else if (IOTATED[ch] !== undefined) segs.push(IOTATED[ch]!);
        else if (VOWEL[ch] !== undefined) segs.push(VOWEL[ch]!);
        else if (ch === "ъ") segs.push("ʔ"); // a stray hard sign (not part of гъ/къ/нъ) — glottal / hiatus
        // ь (a stray soft sign, not part of аь/оь/уь): loan palatalization — dropped
    }
    // Word-final (oxytone) stress — the Turkic default: ˈ before the maximal onset of the last vowel's syllable
    // (native Nogai has no onset clusters; loans do). Same algorithm as the Tatar/Turkmen scans.
    const vidx = segs.map((s, idx) => (isVowelSeg(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        let at = vidx[vidx.length - 1]!;
        if (at > 0 && !isVowelSeg(segs[at - 1]!)) at--; // the immediate onset consonant
        while (at > 0 && !isVowelSeg(segs[at - 1]!)) {
            const p = segs[at - 1]!,
                l = segs[at]!;
            const obstruentLiquid = sonority(p) <= 2 && sonority(l) >= 4;
            const sibilantStop = ["s", "ʃ"].includes(p) && sonority(l) <= 1;
            if (!(obstruentLiquid || sibilantStop)) break;
            at--;
        }
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

/** A digit run → spoken Nogai, phonemized through the same Cyrillic g2p (data + provenance in numbers.ts). */
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time instead, THROUGH THE SAME COMPOSER: a one-digit number is a call this engine already
    // answers, so the fallback cannot invent a word. See core/numbers.ts `spellDigits` for the full
    // account and the cost — above 2^53 the reading is a digit string, not a quantity.
    if (!Number.isSafeInteger(n))
        return [...digits].flatMap((d) => numberToWords(Number(d))).map(phonemizeWord).join(" ");
    return numberToWords(n).map(phonemizeWord).join(" ");
}

// A word (Cyrillic letters) / number / punctuation token.
const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])/gu;

class NogaiPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Nogai phonemizer (digraph-aware Cyrillic g2p + final stress). */
export function createNogai(): Phonemizer {
    return new NogaiPhonemizer();
}
