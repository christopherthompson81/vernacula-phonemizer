/**
 * Santali (sat) phonemizer — a grapheme scan over Ol Chiki + the sign rules, canonical IPA. This file
 * owns the sign machinery: ⟨ᱷ OH⟩ aspirating the preceding stop, ⟨ᱹ GAAHLAA⟩ vowel modification, ⟨ᱸ MU⟩ /
 * ⟨ᱺ MU-GAHLA⟩ nasalization, ⟨ᱼ PHAARKAA⟩ / ⟨ᱽ AHAD⟩ checking, and the hallmark WORD-FINAL voiced-stop
 * checking rule with its AHAD block. The letter values, substitution tables and the encyclopedic record
 * live in santali.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { normalizeSantali } from "./normalize.ts";

interface SantaliDef {
    letters: Record<string, string>;
    voicedStops: readonly string[];
    checked: Record<string, string>;
    aspirated: Record<string, string>;
    gahla: Record<string, string>;
}
const DEF = loadManifest<SantaliDef>(import.meta.url, "santali.jsonc");

// Ol Chiki digits ᱐-᱙ (U+1C50–1C59) → ASCII, so an Ol-Chiki-numeral token composes exactly like a Western one.
const OL_CHIKI_DIGITS = "᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙";
const toAsciiDigits = (s: string): string =>
    [...s].map((c) => (OL_CHIKI_DIGITS.includes(c) ? String(OL_CHIKI_DIGITS.indexOf(c)) : c)).join("");

// Ol Chiki letter → IPA and the sign-driven substitution tables (santali.jsonc).
const BASE = DEF.letters;
const VOWEL = IPA_VOWEL;
// A vowel NUCLEUS test that survives nasalization/length (NFD so ã→a+◌̃, ɛ̃→ɛ+◌̃ still count as vowels).
const VOWEL_BASE = IPA_VOWEL;
const isVowelSeg = (s: string): boolean => [...s.normalize("NFD")].some((c) => VOWEL_BASE.has(c));
const VOICED_STOP = new Set(DEF.voicedStops);
const CHECKED = DEF.checked;
const ASPIRATE = DEF.aspirated;
const GAHLA = DEF.gahla;

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
    // ⚠ Santali hallmark: a WORD-FINAL voiced stop is CHECKED/glottalized (dak→dakʼ, met→metʼ) — but NOT when marked
    // plain by a trailing ⟨ᱽ AHAD⟩, and only in a real syllable (a lone-consonant citation like ⟨ᱵ⟩ stays [b]).
    const l = last();
    if (l !== undefined && VOICED_STOP.has(l) && ahadAt !== segs.length - 1 && segs.some(isVowelSeg)) segs[segs.length - 1] = CHECKED[l]!;
    return segs.join("").normalize("NFC");
}

// A Santali word (Ol Chiki letters + signs U+1C5A–1C7D) / number (Ol Chiki digits) / punctuation. Numbers deferred.
const TOKEN = /([ᱚ-ᱽ]+)|([᱐-᱙]+|\d+)|([.!?…,;:᱾᱿])/gu;

class SantaliPhonemizer implements Phonemizer {
    text(input: string): string {
        // ⚠ THE NORMALIZATION PASS RUNS FIRST, and for this language it is not mainly a number layer.
        // sat.wikipedia types ⟨ᱹ GAAHLAA⟩ as an ASCII PERIOD and ⟨ᱼ PHAARKAA⟩ as an ASCII HYPHEN — 246 and
        // 99 occurrences in the mined artifact's 242 retained segments — and both characters fall in
        // `TOKEN`'s punctuation arm or outside it entirely, so each one splits its word and (for the dot)
        // inserts a clause pause where the language has a modified vowel. See normalize.ts's header.
        return assembleClauses(normalizeSantali(input), TOKEN, (m, sink) => {
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
