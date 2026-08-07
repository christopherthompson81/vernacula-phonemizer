/**
 * Crimean Tatar (crh) phonemizer — a left-to-right Latin grapheme scan (no digraphs) + gemination +
 * word-final (oxytone) stress, canonical IPA. This file owns the position rules: the ⟨v⟩→[w] post-vocalic
 * coda, the Turkish-style dotless-I casing, and the stress placement. The letter table and the
 * encyclopedic record live in crimeantatar.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";

interface CrimeanTatarDef {
    letters: Record<string, string>;
}
// Letter → IPA (crimeantatar.jsonc). The ⟨v⟩→[w] coda rule and dotless-I casing are handled in the scan.
const LETTER = loadManifest<CrimeanTatarDef>(import.meta.url, "crimeantatar.jsonc").letters;
const CYR_VOWEL = new Set([..."aâeıioöuü"]); // Latin vowels (for the ⟨v⟩→[w] coda context)
const IPA_VOWEL = new Set([..."ɑaeɯioøuy"]);

/** One Crimean Tatar word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Turkish-style casing: the dotless capital ⟨I⟩→[ɯ] must lowercase to ⟨ı⟩ (JS would give dotted ⟨i⟩=[i]); dotted
    // ⟨İ⟩→⟨i⟩. Do this before the generic lowercase so capitalised back-vowel words (Qırım) keep [ɯ].
    const cased = word.normalize("NFC").replace(/İ/gu, "i").replace(/I/gu, "ı");
    const chars = [...cased.toLowerCase()];
    const segs: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Reached only when every rule above has declined, so the language's own reading always wins.
        let ph = LETTER[c] ?? latinPhone(c, { initial: i === 0, includeH: true });
        if (ph === undefined) continue; // not a letter at all (stray mark) — skip
        // ⟨v⟩ → [w] in a POST-VOCALIC CODA (after a vowel, not before one): the Kipchak offglide (av→ɑw, suv→suw).
        // Intervocalic / onset ⟨v⟩ stays [v] (quvet→quvet, vatan→vɑtɑn) — the referee's Arabic-loan quvetsiz confirms.
        if (c === "v" && i > 0 && CYR_VOWEL.has(chars[i - 1]!) && !(i + 1 < chars.length && CYR_VOWEL.has(chars[i + 1]!))) {
            ph = "w";
        }
        // Gemination: a doubled letter → the phoneme + length (yollamaq → jolːɑmɑq, şeer → ʃeːr).
        if (chars[i + 1] === c) { segs.push(ph + "ː"); i++; }
        else segs.push(ph);
    }
    // Word-final (oxytone) stress — ˈ before the last vowel's onset consonant (Turkic default).
    const vIdx = segs.map((s, idx) => ([...s].some((x) => IPA_VOWEL.has(x)) ? idx : -1)).filter((x) => x >= 0);
    if (vIdx.length) {
        const nucleus = vIdx[vIdx.length - 1]!;
        const at = nucleus > 0 && ![...segs[nucleus - 1]!].some((x) => IPA_VOWEL.has(x)) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("");
}

/** A digit run → spoken Crimean Tatar, phonemized through the same g2p (data + provenance in numbers.ts). */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToWords(n).map(phonemizeWord).join(" ");
}

// Crimean Tatar Latin — a-z + the Turkish-style letters. Word / number / punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zâçğıiñöşüA-ZÂÇĞIİÑÖŞÜ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class CrimeanTatarPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Crimean Tatar phonemizer (Latin grapheme scan + gemination + final stress). */
export function createCrimeanTatar(): Phonemizer {
    return new CrimeanTatarPhonemizer();
}
