/**
 * Uyghur / ئۇيغۇرچە (ug) phonemizer — Turkic (Karluk), the Uyghur Arabic alphabet (Ereb Yéziqi), canonical IPA,
 * espeak-independent. ~11M speakers (Xinjiang). The Uyghur Arabic script is a FULL PHONEMIC ALPHABET (it writes
 * all 8 vowels), so — unlike the Arabic/Persian/Urdu abjads — there is NO short-vowel restoration: a plain greedy
 * letter→IPA scan suffices, plus one code rule (word-final obstruent devoicing). Signatures: ا→ɑ (back a), ە→ɛ,
 * the hamza ئ→ʔ (glottal onset), ⟨چ ج⟩→t͡ʃ d͡ʒ, ⟨غ⟩→ʁ, ⟨خ⟩→χ, ⟨ق⟩→q, ⟨ڭ⟩→ŋ. Non-tonal (Turkic).
 * Cardinal numbers use the TURKIC compositor (units + round-ten words juxtaposed, no connective).
 * See docs/investigations/ug_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Word-final voiced STOP → voiceless (⟨ب د گ⟩ b/d/g → p/t/k). Uyghur devoices the final stops but NOT the
// fricatives/affricates — final z/ʒ/ʁ/d͡ʒ stay voiced (ئاز→ʔɑz, ئاغ→ʔɑʁ), per the wikipron referee.
const FINAL_DEVOICE: Record<string, string> = { b: "p", d: "t", ɡ: "k" };

/** Phonemize a single Uyghur word to canonical IPA (segmental; final devoicing; non-tonal). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC");
    const seg: string[] = []; // one IPA segment per grapheme, so the last can be devoiced
    for (const ch of w) {
        const g = G[ch];
        if (g !== undefined) seg.push(g);
    }
    if (seg.length > 0) {
        const last = seg[seg.length - 1]!;
        if (last in FINAL_DEVOICE) seg[seg.length - 1] = FINAL_DEVOICE[last]!;
    }
    return seg.join("");
}

// ── Numbers ───────────────────────────────────────────────────────────────────────────────────────────────────
// TURKIC decimal composition (the Karluk sibling of Uzbek/Kazakh/Turkish — NOT the Iranian connective system of
// its ckb/fa neighbours): units + a distinct word per round ten, JUXTAPOSED with NO connector (ئون بىر = 11,
// يىگىرمە بەش = 25). The round hundred/thousand drop the leading بىر (100 = يۈز, 1000 = مىڭ); million/billion
// keep it (بىر مىليون). Spellings live in uyghur.jsonc; the IPA is derived by phonemizeWord.
function turkicNumberWords(n: number, d: NumbersDef): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [...(h > 1 ? [d.units[h]!] : []), d.magnitudes.hundred, ...(r ? turkicNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [...(th > 1 ? turkicNumberWords(th, d) : []), d.magnitudes.thousand, ...(r ? turkicNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...turkicNumberWords(m, d), d.magnitudes.million!, ...(r ? turkicNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...turkicNumberWords(b, d), d.magnitudes.billion!, ...(r ? turkicNumberWords(r, d) : [])];
}

/** A run of ASCII digits → the spoken Uyghur cardinal in canonical IPA (out-of-range integers pass through). */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, MANIFEST.numbers, phonemizeWord, turkicNumberWords);
}

// A word (Uyghur Arabic letters, U+0620–06FF, incl. the hamza-carrier ئ) / number / punctuation token.
const TOKEN = /([ؠ-ۿ]+)|(\d+)|([؟؛،.!?…,])/gu;

class UyghurPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Uyghur phonemizer (greedy letter g2p + final devoicing + the Turkic number compositor). */
export function createUyghur(): Phonemizer {
    return new UyghurPhonemizer();
}
