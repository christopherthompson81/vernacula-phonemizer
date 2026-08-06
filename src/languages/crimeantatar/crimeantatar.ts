/**
 * Native Crimean Tatar / qırımtatar tili (crh) text phonemizer — canonical IPA. Crimean Tatar is
 * KIPCHAK Turkic with strong OGHUZ influence, ~540k speakers (Crimea + diaspora). The standard Latin alphabet (Turkish-
 * based) is highly phonemic → a left-to-right grapheme scan (no digraphs — ⟨ç ş ñ ğ⟩ are single letters) with
 * gemination and word-final (oxytone) stress.
 *
 * ★ The alphabet: back ⟨a o u ı⟩→[ɑ o u ɯ] vs front ⟨e ö ü i⟩→[e ø y i] (harmony is SPELLED); ⟨q⟩→[q] (uvular) vs
 *   ⟨k⟩→[k], ⟨ğ⟩→[ɣ] (voiced dorsal) vs ⟨g⟩→[ɡ]; ⟨c⟩→[d͡ʒ], ⟨ç⟩→[t͡ʃ], ⟨ş⟩→[ʃ], ⟨j⟩→[ʒ], ⟨ñ⟩→[ŋ], ⟨y⟩→[j],
 *   ⟨v⟩→[v], ⟨h⟩→[h]; ⟨â⟩ is the palatalisation vowel → [a]. Doubled letters geminate (yollamaq→[jolːɑmɑq]).
 *
 * 🔷 thin single-source (English Wiktionary "Crimean Tatar terms with IPA pronunciation", ~18 Latin pairs — no
 * wikipron/kaikki/epitran crh).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";

// Single letters (no digraphs in the Crimean Tatar Latin alphabet). ⟨â⟩→[a] (the palatalisation vowel; the
// palatalisation of the preceding consonant, kâr→[cɑr], is a low-frequency loanword feature — deferred). ⟨v⟩ is
// context-dependent ([w] in a post-vocalic coda) and handled in the scan. ⟨x⟩/⟨w⟩ are NOT Crimean Tatar letters.
const LETTER: Record<string, string> = {
    "a": "ɑ", "â": "a", "e": "e", "ı": "ɯ", "i": "i", "o": "o", "ö": "ø", "u": "u", "ü": "y",
    "b": "b", "c": "d͡ʒ", "ç": "t͡ʃ", "d": "d", "f": "f", "g": "ɡ", "ğ": "ɣ", "h": "h", "j": "ʒ", "k": "k",
    "l": "l", "m": "m", "n": "n", "ñ": "ŋ", "p": "p", "q": "q", "r": "r", "s": "s", "ş": "ʃ", "t": "t",
    "v": "v", "y": "j", "z": "z",
};
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
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls.
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
