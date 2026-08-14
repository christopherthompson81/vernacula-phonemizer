/**
 * Santali (sat) phonemizer — a grapheme scan over Ol Chiki + the sign rules, canonical IPA. This file
 * owns the sign machinery: ⟨ᱷ OH⟩ aspirating the preceding stop, ⟨ᱹ GAAHLAA⟩ vowel modification, ⟨ᱸ MU⟩ /
 * ⟨ᱺ MU-GAHLA⟩ nasalization, ⟨ᱻ RELAA⟩ vowel LENGTH, ⟨ᱼ PHAARKAA⟩ / ⟨ᱽ AHAD⟩ checking, and the hallmark
 * WORD-FINAL voiced-stop checking rule with its AHAD block. The letter values, substitution tables and the
 * encyclopedic record live in santali.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { getDefaultForeign } from "../../core/foreign.ts";
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

const OH = "ᱷ", GAHLA_SIGN = "ᱹ", MU = "ᱸ", MU_GAHLA = "ᱺ", RELAA = "ᱻ", PHAARKAA = "ᱼ", AHAD = "ᱽ";

/**
 * ⚠ ⟨ᱻ RELAA⟩ (U+1C7B) IS THE VOWEL-LENGTH MARK, AND UNTIL NOW IT HAD NO BRANCH AT ALL. It sits inside
 * `TOKEN`'s word class, so it was consumed and contributed the EMPTY STRING *inside a live word* — the
 * silent-deletion class. It is not a letter and has no phone of its own: it MODIFIES its neighbour.
 *
 *   · function — "to indicate a prolonged vowel sound, ᱻ is used" (r12a's Ol Chiki orthography notes);
 *     the Unicode/encoding material calls it a length mark that "may combine with any oral or nasal vowel".
 *   · placement — it is written AFTER the vowel it modifies (unlike the diacritics of most Indic scripts,
 *     which sit above), and AFTER ⟨ᱹ GAAHLAA⟩ when both are present. The scan below already applies GAAHLAA
 *     to the vowel segment before RELAA arrives, so `ᱟᱹᱻ` → [ə] → [əː] falls out of the loop order for free.
 *   · corroboration in a dictionary — en.wiktionary's only RELAA headword, `ᱡᱤᱻ` "to smell", ROMANISES as
 *     *jiː* with the length mark and lists `ᱡᱤ` as its alternative spelling. (Its IPA line writes [ɟĩ], a
 *     nasal, which is why the referee's one RELAA row is unreachable either way — see the run log.)
 *
 * So the branch appends a LENGTH MARK to the preceding vowel and nothing else. A RELAA with no vowel to its
 * left carries nothing and is consumed silently — that is the mark doing its job on an absent neighbour,
 * not an unclaimed character; `normalize.ts` step 2 has already repaired the consonant-preceded case, which
 * this corpus shows is a keyboard slip for ⟨ᱼ PHAARKAA⟩.
 */
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
        if (ch === RELAA) { // ⟨ᱻ RELAA⟩ LENGTHENS the preceding vowel — see the block comment below
            const l = last();
            if (l !== undefined && isVowelSeg(l) && !l.endsWith("ː")) segs[segs.length - 1] = l + "ː";
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

/**
 * A Santali word (Ol Chiki letters + signs U+1C5A–1C7D) / an ASCII-digit ENGLISH ORDINAL / a number
 * (Ol Chiki or ASCII digits) / punctuation.
 *
 * ⚠ THE ORDINAL ARM EXISTS BECAUSE THIS TOKENIZER WAS CUTTING AN ENGLISH EXPRESSION IN HALF. `1st` read as
 * *mitʼ stɹˈiːt* — the numeral arm claimed the `1` and spoke it in Santali, and the orphaned `st` fell to
 * `assembleClauses`'s Latin→English fallback, which expanded the abbreviation *st* to **STREET**. Same shape
 * for `4th`/`13th`/`131st` → *pun tʰˈiːʲˈeᶦt͡ʃ*. Seven instances in the mined corpus and every one sits inside
 * an ENGLISH phrase — `4th century BCE`, `c. 6th century BCE`, `Languages attested from the 19th century`,
 * and `(13th)`/`(14th)`/`(131st)` as a country's world area RANK — so the whole run belongs to English, which
 * reads `13th` as *θˈɝtʰˈiːnθ* once it is handed the digits too. The fix is to stop cutting the expression in
 * half, which is `FOREIGN_RUN`'s own argument for carrying a trailing superscript.
 *
 * Narrow by construction (trap 9): ASCII digits plus one of the four English ordinal suffixes, and only where
 * no further Latin letter follows. Ol Chiki digits are deliberately NOT matched — a Santali numeral takes no
 * Latin ordinal suffix and `᱑᱓th` does not occur.
 */
const TOKEN = /([ᱚ-ᱽ]+)|(\d+(?:st|nd|rd|th)(?![\p{sc=Latn}]))|([᱐-᱙]+|\d+)|([.!?…,;:᱾᱿])/gu;

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
                // An English ordinal — hand the WHOLE run to the same English reader the surrounding phrase
                // already goes to. ⚠ WITH A FLOOR RATHER THAN A GUESS: `core` may be loaded without the
                // registry (no default foreign reader), and then the honest reading is the QUANTITY in
                // Santali with the untranslatable ordinal morphology dropped — never a Santali letter name
                // for `st`/`th`, none of which is attested (the `hmn` refusal).
                const foreign = getDefaultForeign();
                if (foreign !== undefined) sink.emit(foreign(m[2]));
                else for (const wd of numberToWords(Number(m[2].replace(/\D+$/u, ""))).split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) {
                // Ol Chiki digits and Western digits are the same numbers — normalise, then compose. ≤15 digits
                // stays inside the safe-integer range; longer reads the raw string digit-by-digit.
                const d = toAsciiDigits(m[3]);
                const words = d.length <= 15 ? numberToWords(Number(d)) : readDigits(d);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[4]) sink.pause(m[4] === "᱾" || m[4] === "᱿" || m[4] === "." || m[4] === "!" || m[4] === "?" ? "." : ",");
        });
    }
}

/** Build the Santali phonemizer (Ol Chiki grapheme scan + sign rules + final checked stop). */
export function createSantali(): Phonemizer {
    return new SantaliPhonemizer();
}
