/**
 * Santali (sat) phonemizer — ᱥᱟᱱᱛᱟᱲᱤ, Munda (Austroasiatic), the OL CHIKI script (ᱚᱞ ᱪᱮᱢᱮᱫ, U+1C50–1C7F — a distinct
 * ALPHABET, 1925, now Santali's official script), canonical IPA, espeak-independent. The fleet's first Munda language
 * and first Ol Chiki. Ol Chiki is near-phonemic, so a grapheme scan + a few sign rules: ⟨ᱷ OH⟩ aspirates the preceding
 * stop (ᱵᱷ→bʱ) / is [h]; ⟨ᱹ GAAHLAA⟩ modifies the preceding vowel (ᱟᱹ→ə); ⟨ᱸ MU⟩ nasalizes it (ᱟᱸ→ã); ⟨ᱼ PHAARKAA⟩ /
 * ⟨ᱽ AHAD⟩ mark a CHECKED (glottalized) consonant (ᱜᱼ→kʼ); and the Santali HALLMARK — a WORD-FINAL voiced stop is
 * CHECKED/glottalized (ᱫᱟᱜ→dakʼ 'water', ᱢᱮᱫ→metʼ 'eye'). 🔷 single-source (kaikki). See docs/investigations/sat_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords, readDigits } from "./numbers.ts";

// Ol Chiki digits ᱐-᱙ (U+1C50–1C59) → ASCII, so an Ol-Chiki-numeral token composes exactly like a Western one.
const OL_CHIKI_DIGITS = "᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙";
const toAsciiDigits = (s: string): string =>
    [...s].map((c) => (OL_CHIKI_DIGITS.includes(c) ? String(OL_CHIKI_DIGITS.indexOf(c)) : c)).join("");

// Ol Chiki letter → IPA. Vowels + consonants (palatal stops ⟨ᱪ ᱡ⟩ → c/ɟ; retroflex ⟨ᱴ ᱰ ᱬ ᱲ⟩ → ʈ ɖ ɳ ɽ).
const BASE: Record<string, string> = {
    "ᱚ": "ɔ", "ᱟ": "a", "ᱤ": "i", "ᱩ": "u", "ᱮ": "e", "ᱳ": "o", // vowels
    "ᱜ": "ɡ", "ᱠ": "k", "ᱛ": "t", "ᱫ": "d", "ᱴ": "ʈ", "ᱰ": "ɖ", "ᱯ": "p", "ᱵ": "b", "ᱪ": "c", "ᱡ": "ɟ",
    "ᱢ": "m", "ᱱ": "n", "ᱝ": "ŋ", "ᱧ": "ɲ", "ᱬ": "ɳ", "ᱞ": "l", "ᱨ": "r", "ᱲ": "ɽ", "ᱥ": "s", "ᱦ": "h",
    "ᱭ": "j", "ᱣ": "w", "ᱶ": "w̃", "ᱷ": "h", // ⟨ᱶ OV⟩ is the NASAL labial glide /w̃/ (vs ⟨ᱣ AAW⟩ /w/)
};
const VOWEL = new Set(["ɔ", "a", "i", "u", "e", "ɛ", "o", "ə"]);
// A vowel NUCLEUS test that survives nasalization/length (NFD so ã→a+◌̃, ɛ̃→ɛ+◌̃ still count as vowels).
const VOWEL_BASE = new Set([..."ɔaiueɛoə"]);
const isVowelSeg = (s: string): boolean => [...s.normalize("NFD")].some((c) => VOWEL_BASE.has(c));
const STOP = new Set(["ɡ", "k", "t", "d", "ʈ", "ɖ", "p", "b", "c", "ɟ"]);
const VOICED_STOP = new Set(["ɡ", "d", "ɖ", "b", "ɟ"]);
// A checked (glottalized) stop: devoice + a glottal release ⟨ʼ⟩ (ɡ→kʼ, d→tʼ …).
const CHECKED: Record<string, string> = { "ɡ": "kʼ", "k": "kʼ", "d": "tʼ", "t": "tʼ", "ɖ": "ʈʼ", "ʈ": "ʈʼ", "b": "pʼ", "p": "pʼ", "ɟ": "cʼ", "c": "cʼ" };
// Aspiration by ⟨ᱷ OH⟩: voiceless → ʰ, voiced → breathy ʱ.
const ASPIRATE: Record<string, string> = { "p": "pʰ", "t": "tʰ", "ʈ": "ʈʰ", "c": "cʰ", "k": "kʰ", "b": "bʱ", "d": "dʱ", "ɖ": "ɖʱ", "ɟ": "ɟʱ", "ɡ": "ɡʱ" };
// ⟨ᱹ GAAHLAA⟩ vowel modification — the "extra" Santali vowels (chiefly ᱟ a→ə).
const GAHLA: Record<string, string> = { "a": "ə", "ɔ": "ɔ", "o": "ɔ", "e": "ɛ", "i": "i", "u": "u" };

const OH = "ᱷ", GAHLA_SIGN = "ᱹ", MU = "ᱸ", MU_GAHLA = "ᱺ", PHAARKAA = "ᱼ", AHAD = "ᱽ";

/** Phonemize a Santali (Ol Chiki) word → canonical IPA. A multi-word phrase (spaces, as some referee headwords are)
 *  is split so word-final checking applies to EACH word's last stop. */
export function phonemizeWord(word: string): string {
    if (/\s/u.test(word.trim())) return word.trim().split(/\s+/u).map(phonemizeWord).join(" ");
    const chars = [...word.normalize("NFC")];
    const segs: string[] = [];
    let ahadAt = -1; // index of a segment marked plain by a trailing ⟨ᱽ AHAD⟩ (blocks word-final checking)
    const last = (): string | undefined => segs[segs.length - 1];
    for (const ch of chars) {
        if (BASE[ch] !== undefined && ch !== OH) { segs.push(BASE[ch]!); continue; }
        if (ch === OH) { // aspirate the preceding stop, else [h]
            const l = last();
            if (l !== undefined && ASPIRATE[l] !== undefined) segs[segs.length - 1] = ASPIRATE[l]!;
            else segs.push("h");
            continue;
        }
        if (ch === GAHLA_SIGN) { const l = last(); if (l !== undefined && GAHLA[l] !== undefined) segs[segs.length - 1] = GAHLA[l]!; continue; }
        if (ch === MU || ch === MU_GAHLA) { // nasalize the preceding vowel; ⟨ᱺ MU-GAHLA⟩ ALSO lowers it (ᱮᱺ→ɛ̃)
            let l = last();
            if (ch === MU_GAHLA && l !== undefined && GAHLA[l] !== undefined) { segs[segs.length - 1] = GAHLA[l]!; l = GAHLA[l]!; }
            if (l !== undefined && VOWEL.has(l)) segs[segs.length - 1] = (l + "̃").normalize("NFC");
            continue;
        }
        if (ch === PHAARKAA) { const l = last(); if (l !== undefined && CHECKED[l] !== undefined) segs[segs.length - 1] = CHECKED[l]!; continue; }
        if (ch === AHAD) { ahadAt = segs.length - 1; continue; } // ⟨ᱽ AHAD⟩ marks the preceding stop PLAIN/released — before a
        // consonant it's a bare separator (ᱫᱽᱨ→dr, ɡidrə); word-finally it BLOCKS the checking rule (ᱨᱳᱜᱽ→roɡ, not rokʼ).
        // digits / punctuation / unmapped signs: handled by text() or dropped
    }
    // ★ Santali hallmark: a WORD-FINAL voiced stop is CHECKED/glottalized (dak→dakʼ, met→metʼ) — but NOT when marked
    // plain by a trailing ⟨ᱽ AHAD⟩, and only in a real syllable (a lone-consonant citation like ⟨ᱵ⟩ stays [b]).
    const l = last();
    if (l !== undefined && VOICED_STOP.has(l) && ahadAt !== segs.length - 1 && segs.some(isVowelSeg)) segs[segs.length - 1] = CHECKED[l]!;
    return segs.join("").normalize("NFC");
}

// A Santali word (Ol Chiki letters + signs U+1C5A–1C7D) / number (Ol Chiki digits) / punctuation. Numbers deferred.
const TOKEN = /([ᱚ-ᱽ]+)|([᱐-᱙]+|\d+)|([.!?…,;:᱾᱿])/gu;

class SantaliPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                // Ol Chiki digits and Western digits are the same numbers — normalise, then compose. ≤15 digits
                // stays inside the safe-integer range; longer reads the raw string digit-by-digit.
                const d = toAsciiDigits(m[2]);
                const words = d.length <= 15 ? numberToWords(Number(d)) : readDigits(d);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) sink.pause(m[3] === "᱾" || m[3] === "᱿" || m[3] === "." || m[3] === "!" || m[3] === "?" ? "." : ",");
        });
    }
}

/** Build the Santali phonemizer (Ol Chiki grapheme scan + sign rules + final checked stop). */
export function createSantali(): Phonemizer {
    return new SantaliPhonemizer();
}
