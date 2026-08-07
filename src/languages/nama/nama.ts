/**
 * Nama / Khoekhoe (naq) phonemizer — a greedy scan over the Khoekhoegowab click orthography, canonical
 * IPA. This file owns the click composition (place × efflux is a rule, not a 20-row table — clickIPA
 * below), the ⟨kh⟩ digraph, doubled-vowel length, and the word-final gender-⟨-b⟩ devoicing. The non-click
 * letter table and the encyclopedic record (the click system, the spec-verification caveat) live in
 * nama.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";

interface NamaDef {
    letters: Record<string, string>;
}

const CLICK = new Set(["ǀ", "ǁ", "ǂ", "ǃ"]); // dental, lateral, palatal, alveolar
/** A click letter + its accompaniment (the following g/kh/h/n, longest-first) → the IPA click cluster. */
function clickIPA(click: string, accomp: string): string {
    switch (accomp) {
        case "g": return "ᵏ" + click; // tenuis (voiceless unaspirated)
        case "kh": return "ᵏ" + click + "ʰ"; // aspirated
        case "h": return "ᵑ̊" + click + "ʰ"; // aspirated (voiceless) nasal
        case "n": return "ᵑ" + click; // voiced nasal
        default: return "ᵑ̊" + click + "ˀ"; // BARE click → the glottalised nasal click
    }
}
// Non-click letters (nama.jsonc). ⟨kh⟩→[kʰ] handled as a digraph; ⟨g⟩ NOT after a click → [x].
const LETTER = loadManifest<NamaDef>(import.meta.url, "nama.jsonc").letters;
const PLAIN_VOWEL = new Set([..."aeiou"]);

/** One Nama word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const chars = [...word.normalize("NFC")];
    // Lowercase PER-INDEX (not a separate array) so a char that lowercases to a different code-point count (İ→i̇, ß→ss)
    // can never desync the index from `chars`.
    const lc = (idx: number): string => (chars[idx] ?? "").toLowerCase();
    const segs: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        if (CLICK.has(c)) {
            // Accompaniment: longest-first — ⟨kh⟩ (2 letters) before ⟨g h n⟩. Case-insensitive (ǀKh, ǀG in citations).
            const next2 = lc(i + 1) + lc(i + 2);
            const next1 = lc(i + 1);
            if (next2 === "kh") { segs.push(clickIPA(c, "kh")); i += 2; }
            else if (next1 === "g" || next1 === "h" || next1 === "n") { segs.push(clickIPA(c, next1)); i += 1; }
            else segs.push(clickIPA(c, ""));
            continue;
        }
        const cur = lc(i);
        if (cur === "k" && lc(i + 1) === "h") { segs.push("kʰ"); i++; continue; } // ⟨kh⟩ digraph
        // A DOUBLED identical vowel → a long vowel [Vː] (the standard Khoekhoegowab length convention, aa/ee…).
        if (PLAIN_VOWEL.has(cur) && lc(i + 1) === cur) { segs.push(LETTER[cur]! + "ː"); i++; continue; }
        // WORD-FINAL gender suffix ⟨-b⟩ → [p] (devoicing): ǀgomab→ǀómàp.
        if (cur === "b" && i === chars.length - 1) { segs.push("p"); continue; }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Reached only when every rule above has declined, so the language's own reading always wins.
        const ph = LETTER[cur] ?? latinPhone(cur, { initial: i === 0, includeH: true });
        if (ph !== undefined) segs.push(ph);
        // tone diacritics on vowels, ʼ, etc.: dropped (tone not emitted; it folds)
    }
    return segs.join("").normalize("NFC");
}

// Nama Latin + the click letters ǀ ǁ ǂ ǃ. Word / number / punctuation.
/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class below decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name, which `nat`
 * then folds to a base the g2p does have a rule for. See core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zA-Zǀǁǂǃ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "gu");

class NamaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // Cardinals 1 … 10¹²−1 compose natively; 0 emits the flagged Afrikaans stopgap `nul` and anything
                // above the ceiling reads digit-by-digit. Never silently dropped. See numbers.ts.
                const words = m[2].length <= 12 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Nama (Khoekhoe) phonemizer (click-aware Khoekhoegowab scan). */
export function createNama(): Phonemizer {
    return new NamaPhonemizer();
}
