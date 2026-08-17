/**
 * Karakalpak (kaa) phonemizer — a left-to-right greedy scan over a digraph + letter table + word-final
 * (oxytone) stress, canonical IPA. This file owns the Turkish-style dotless-I casing and the stress
 * placement (backs up over one onset consonant: basqa→[bɑsˈqɑ]). The letter tables and the encyclopedic
 * record live in karakalpak.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeKarakalpak } from "./normalize.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";

interface KarakalpakDef {
    digraphs: [string, string][];
    letters: Record<string, string>;
}
const DEF = loadManifest<KarakalpakDef>(import.meta.url, "karakalpak.jsonc");
// Letter → IPA tables (karakalpak.jsonc). The dotless-I casing is handled in the scan below.
const DIGRAPHS = DEF.digraphs;
const LETTER = DEF.letters;

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
        // normalize.ts FIRST — its percent-suffix, separator, era, abbreviation, clock, degree and sign
        // steps need the figure and its mark still adjacent, which the shared tier would break; the tier
        // itself runs inside that pass, between the percent step and the de-grouping (see normalize.ts).
        return assembleClauses(normalizeKarakalpak(input.normalize("NFC")), TOKEN, (m, sink) => {
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
