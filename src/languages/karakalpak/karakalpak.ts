/**
 * Native Karakalpak / qaraqalpaq tili (kaa) text phonemizer — canonical IPA. Karakalpak is KIPCHAK
 * Turkic (closely related to Kazakh), ~600k speakers (Karakalpakstan, NW Uzbekistan). Since the 2016 reform the
 * official script is a LATIN alphabet, and it is highly phonemic → a left-to-right greedy scan over a digraph + letter
 * table with word-final (oxytone) stress.
 *
 * ⚠ The 2016 Latin alphabet with its acute-marked front/uvular letters: ⟨á⟩→[æ], ⟨ó⟩→[ø], ⟨ú⟩→[y] (front vowels vs
 *   plain ⟨a o u⟩→[ɑ o u]); the DOTLESS ⟨ı⟩→[ɯ] vs dotted ⟨i⟩→[i]; ⟨q⟩→[q] (uvular, back-harmony) vs ⟨k⟩→[k], ⟨x⟩→[χ]
 *   (uvular) vs ⟨h⟩→[h], ⟨ǵ⟩→[ʁ] (uvular voiced fricative, back) vs ⟨g⟩→[ɡ]; ⟨ń⟩→[ŋ]; ⟨j⟩→[ʒ], ⟨w⟩→[w], ⟨y⟩→[j];
 *   digraphs ⟨sh⟩→[ʃ], ⟨ch⟩→[t͡ʃ]. (Unlike Kazakh, the uvular/velar choice is WRITTEN — q/k, x/h, ǵ/g — so no
 *   harmony inference is needed.) Word-final stress backs up over one onset consonant (basqa→[bɑsˈqɑ]).
 *
 * ⚠ THIN SINGLE-SOURCE: English Wiktionary "Karakalpak terms with IPA pronunciation", ~11 usable Latin pairs — no
 * wikipron/kaikki/epitran kaa).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";

const DIGRAPHS: [string, string][] = [["sh", "ʃ"], ["ch", "t͡ʃ"]];
// Single letters. Vowels: the acute letters ⟨á ó ú⟩ are the front counterparts of ⟨a o u⟩; ⟨ı⟩ (dotless) is [ɯ].
const LETTER: Record<string, string> = {
    "a": "ɑ", "á": "æ", "e": "e", "ı": "ɯ", "i": "i", "o": "o", "ó": "ø", "u": "u", "ú": "y",
    "b": "b", "d": "d", "f": "f", "g": "ɡ", "ǵ": "ʁ", "h": "h", "x": "χ", "j": "ʒ", "k": "k", "q": "q",
    "l": "l", "m": "m", "n": "n", "ń": "ŋ", "p": "p", "r": "r", "s": "s", "t": "t", "w": "w", "y": "j", "z": "z",
    "v": "v", // the loan letter ⟨v⟩ (Russian в). ⟨c⟩ is NOT in the Karakalpak alphabet — it occurs only in the ⟨ch⟩
    // digraph (handled above), so there is no standalone ⟨c⟩ mapping.
    "í": "ɯ", // the dotless-⟨ı⟩ letter as Wiktionary titles it (I-acute); not a real Karakalpak grapheme otherwise
};
const IPA_VOWEL = new Set([..."ɑæeɯioøuy"]);

/** One Karakalpak word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Turkish-style casing FIRST: the dotless capital ⟨I⟩→[ɯ] must lowercase to ⟨ı⟩ (JS toLowerCase would give dotted
    // ⟨i⟩=[i]), and the dotted capital ⟨İ⟩→⟨i⟩. Do this before the generic lowercase so capitalized back-vowel words
    // (proper nouns) keep [ɯ].
    const cased = word.normalize("NFC").replace(/İ/gu, "i").replace(/I/gu, "ı");
    const chars = [...cased.toLowerCase()];
    const segs: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const dg = DIGRAPHS.find(([k]) => chars[i] === k[0] && chars[i + 1] === k[1]);
        if (dg) { segs.push(dg[1]); i++; continue; }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Reached only when every rule above has declined, so the language's own reading always wins.
        const ph = LETTER[chars[i]!] ?? latinPhone(chars[i]!, { initial: i === 0, includeH: true });
        if (ph !== undefined) segs.push(ph);
    }
    // Word-final (oxytone) stress — ˈ before the last vowel's onset consonant (Turkic default).
    const vIdx = segs.map((s, idx) => (IPA_VOWEL.has(s) ? idx : -1)).filter((x) => x >= 0);
    if (vIdx.length) {
        const nucleus = vIdx[vIdx.length - 1]!;
        const at = nucleus > 0 && !IPA_VOWEL.has(segs[nucleus - 1]!) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("");
}

/** A digit run → spoken Karakalpak, phonemized through the same g2p (data + provenance in numbers.ts). */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToWords(n).map(phonemizeWord).join(" ");
}

// Karakalpak Latin (2016) — a-z + the acute/dotless letters. Both capital ⟨I⟩ (dotless, U+0049 → [ɯ]) and ⟨İ⟩ (dotted,
// U+0130 → [i]) must be in the class (İ is the Karakalpak capital of ⟨i⟩; omitting it drops the letter and splits the
// word). ⟨ç⟩ is NOT Karakalpak (the affricate is the ⟨ch⟩ digraph), so it's excluded. Word / number / punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-záóúíńǵıA-ZÁÓÚÍŃǴIİ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class KarakalpakPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Karakalpak phonemizer (Latin 2016 greedy scan + final stress). */
export function createKarakalpak(): Phonemizer {
    return new KarakalpakPhonemizer();
}
