/**
 * Haitian Creole (ht) phonemizer — kreyòl ayisyen, a French-lexified creole of Haiti (~12M), Latin script (the
 * phonemic IPN orthography), canonical IPA. A greedy longest-match scan + the nasal-vowel rule:
 *   - ⟨ou⟩→[u], ⟨ui⟩→[ɥi], ⟨ch⟩→[ʃ]; ⟨è⟩→[ɛ], ⟨ò⟩→[ɔ]; the Haitian ⟨r⟩→[ɣ] (velar fricative), ⟨j⟩→[ʒ], ⟨y⟩→[j];
 *   - the NASAL VOWELS ⟨an en on⟩ (plain a/e/o + ⟨n⟩) → [ã ɛ̃ ɔ̃] when the ⟨n⟩ is syllable-final (before a consonant or
 *     word-end): nan→nã, senk→sɛ̃k, lang→lãɡ. Before a VOWEL the ⟨n⟩ is an oral onset; a DOUBLED ⟨nn⟩ → nasal + [n]
 *     (Enndyana→ɛ̃ndjana). ⟨i⟩ and ⟨ou⟩ do NOT nasalize (machin→maʃin, moun→mun); ⟨è ò⟩ stay oral.
 * Stress (final-syllable, predictable) is not emitted.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface HaitianDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<HaitianDef>(import.meta.url, "haitian.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
// TRUE vowels (not the glides ⟨y w⟩) — an ⟨n⟩ stays an oral onset only before one of these; before a glide the vowel
// still nasalizes (anyen→ãjɛ̃, anwo→ãwo).
const HIATUS_VOWEL = new Set([..."aeiouèòéà"]);
// Plain ⟨a e o⟩ + a syllable-final ⟨n⟩ → the nasal vowel.
const NASAL: Record<string, string> = { a: "ã", e: "ɛ̃", o: "ɔ̃" };

/** Scan a lowercased Haitian word into IPA phone tokens (the ⟨ou ui ch⟩ digraphs + the context-dependent nasals). */
function scan(word: string): string[] {
    const w = word.normalize("NFC").toLowerCase();
    const out: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        const c = w[i]!;
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { out.push(DIGRAPHS[key]!); i += key.length; continue outer; }
        }
        // NASAL VOWELS: plain ⟨a e o⟩ + ⟨n⟩ → [ã ɛ̃ ɔ̃] when the ⟨n⟩ is syllable-final; oral before a vowel; a doubled
        // ⟨nn⟩ nasalizes the vowel and keeps ONE [n] (Enndyana→ɛ̃ndjana).
        if (c in NASAL && w[i + 1] === "n") {
            const after = w[i + 2] ?? "";
            if (after === "n") { out.push(NASAL[c]!); i += 2; continue; } // ⟨Vnn⟩ → nasal + [n] (the 2nd n emitted next)
            if (HIATUS_VOWEL.has(after)) { out.push(G[c]!); i += 1; continue; } // ⟨Vn⟩ before a TRUE vowel → oral V + [n]
            out.push(NASAL[c]!); i += 2; continue; // ⟨Vn⟩ before a consonant / word-end → nasal, [n] absorbed
        }
        const ph = G[c];
        if (ph !== undefined && ph !== "") out.push(ph);
        i += 1;
    }
    return out;
}

const VOWEL_PH = new Set([..."aeiouɛɔ"]); // IPA vowel heads (for the geminate test — collapse only CONSONANT doubles)
/** Geminate collapse: a doubled consonant (from a loan spelling) → a single phone (accoma→akoma). */
function degeminate(toks: string[]): void {
    for (let i = toks.length - 1; i > 0; i--) {
        if (toks[i] === toks[i - 1] && !VOWEL_PH.has([...toks[i]!][0]!)) toks.splice(i, 1);
    }
}

const ROUNDED = new Set([..."ouɔ"]); // the Haitian ⟨r⟩ [ɣ] → the glide [w] before a rounded vowel (ayeropò→ajewopɔ).
function rBeforeRounded(toks: string[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i] === "ɣ" && ROUNDED.has([...toks[i + 1]!][0]!)) toks[i] = "w";
    }
}

/** Phonemize a single Haitian Creole word to canonical IPA (segmental; stress folded/deferred). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    degeminate(toks);
    rBeforeRounded(toks);
    return toks.join("");
}

// A word (Haitian Latin letters incl. è ò é à and the apostrophe elisions m'/l'/w') / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zèòéàA-ZÈÒÉÀ'-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class HaitianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Haitian Creole number WORDS, each phonemized like any other word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Haitian Creole phonemizer (phonemic IPN g2p + the nasal-vowel rule; stress folded). */
export function createHaitian(): Phonemizer {
    return new HaitianPhonemizer();
}
