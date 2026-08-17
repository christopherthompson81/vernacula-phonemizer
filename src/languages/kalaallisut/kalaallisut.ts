/**
 * Kalaallisut (kl) phonemizer — a near-1:1 scan over the 1973 phonemic orthography, canonical IPA. This
 * file owns the longest-match mechanics: ⟨nng⟩/⟨ng⟩ before singles, doubled vowel/consonant → length
 * (keyed on the same grapheme, so ⟨ei⟩/⟨ou⟩ never wrongly merge). The letter tables and the encyclopedic
 * record (the three-vowel system, the deferred narrow layer) live in kalaallisut.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { normalizeKalaallisut } from "./normalize.ts";

interface KalaallisutDef {
    vowels: Record<string, string>;
    consonants: Record<string, string>;
}
const DEF = loadManifest<KalaallisutDef>(import.meta.url, "kalaallisut.jsonc");
// Letter → IPA tables (kalaallisut.jsonc). Gemination and ng/nng are handled in the scan below.
const VOWEL = DEF.vowels;
const CONS = DEF.consonants;
const isVowelChar = (c: string): boolean => VOWEL[c] !== undefined;

/** Phonemize one Kalaallisut word → canonical IPA (near-1:1 scan; doubled letter → length; ng/nng → ŋ/ŋː). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const chars = [...w];
    const out: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!, nx = chars[i + 1] ?? "", nx2 = chars[i + 2] ?? "";
        // ⟨nng⟩ → [ŋː], ⟨ng⟩ → [ŋ] (longest-match).
        if (c === "n" && nx === "n" && nx2 === "g") { out.push("ŋː"); i += 2; continue; }
        if (c === "n" && nx === "g") { out.push("ŋ"); i += 1; continue; }
        // Doubled VOWEL → long (aa→aː, ee→iː, oo→uː). Keyed on the same GRAPHEME (c===nx) so a heterographic
        // ⟨ei⟩/⟨ou⟩ (both mapping to the same /i u/) is NOT wrongly merged to a single long vowel.
        if (isVowelChar(c) && c === nx) { out.push(VOWEL[c]! + "ː"); i += 1; continue; }
        if (isVowelChar(c)) { out.push(VOWEL[c]!); continue; }
        // Doubled CONSONANT → long (aallaat→aːlːaːt, aappaa→aːpːaː).
        if (CONS[c] !== undefined && c === nx) { out.push(CONS[c]! + "ː"); i += 1; continue; }
        if (CONS[c] !== undefined) { out.push(CONS[c]!); continue; }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Reached only when every rule above has declined, so the language's own reading always wins.
        { const p = latinPhone(c, { initial: i === 0, includeH: true }); if (p !== undefined) out.push(p); }
    }
    return out.join("");
}

// Kalaallisut Latin letters (+ Danish-loan æ ø å). Word / number / punctuation. Numbers deferred.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zæøåA-ZÆØÅ'’-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class KalaallisutPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(normalizeKalaallisut(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string so the
                // Number() conversion can't lose precision. Native 0–12, Danish above — see numbers.ts.
                const words = m[2].length <= 12 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Kalaallisut phonemizer (near-1:1 phonemic scan). */
export function createKalaallisut(): Phonemizer {
    return new KalaallisutPhonemizer();
}
