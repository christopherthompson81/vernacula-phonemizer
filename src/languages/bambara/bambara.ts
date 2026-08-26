/**
 * Bambara / Bamanankan (bm) phonemizer — Mande (Manding), the Latin orthography, canonical IPA.
 * Mali's principal language (~14M incl. L2). A greedy longest-match scan over the grapheme
 * table (manifest.ts) with ONE piece of code logic — NASALISATION: a syllable-final ⟨n⟩ (word-final or before a
 * consonant) nasalises the preceding vowel [Ṽ] and is dropped (ban→bã, kunun→kunũ), while an onset ⟨n⟩ before a
 * vowel stays [n] (na→na); a word-initial nasal + C is a prenasal onset (mburu→mburu). Signatures: ⟨c⟩→t͡ʃ,
 * ⟨j⟩→d͡ʒ, ⟨sh⟩→ʃ, ⟨ny⟩=⟨ɲ⟩→ɲ, ⟨ŋ⟩→ŋ; 7 oral vowels i e ɛ a ɔ o u. Tone (2-level H/L + downstep) and vowel
 * LENGTH are lexical / unwritten in the standard orthography → DEFERRED (segmental + nasal backbone only). N'Ko
 * (ߒߞߏ) is a 2nd script — bambaraNko.ts transliterates it to Latin then the same g2p runs (identical IPA;
 * N'Ko tone marks drop, the engine being toneless).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { normalizeBambara } from "./normalize.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { isNko, nkoToLatin } from "./bambaraNko.ts";
import { foldNkoDigits, numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const NASAL_TILDE = "̃"; // combining tilde — a nasalised vowel (matches the referee's ã õ ũ …)
const VOWELS = new Set(MANIFEST.vowelLetters); // orthographic oral vowels (bambara.jsonc)
// Named VOWEL_PH, not IPA_VOWELS: that name is the repo-wide regex STRING (core/ipa.ts), and binding
// it to a Set here would shadow it for anyone who later imports the real one.
const VOWEL_PH = IPA_VOWEL;

/** Phonemize a single Bambara word to canonical IPA (segmental + nasalisation; tone + length deferred). Accepts
 *  BOTH scripts: the Latin orthography and N'Ko (ߒߞߏ) — N'Ko is transliterated to Latin first (identical IPA). */
export function phonemizeWord(word: string): string {
    const w = (isNko(word) ? nkoToLatin(word) : word).toLowerCase();
    const out: string[] = []; // one entry per emitted segment (so we can nasalise the previous vowel)
    let i = 0;
    while (i < w.length) {
        // digraphs FIRST, so ⟨ny⟩→ɲ is not intercepted by the ⟨n⟩ nasalisation logic
        if (w.startsWith("ny", i)) { out.push("ɲ"); i += 2; continue; }
        if (w.startsWith("sh", i)) { out.push("ʃ"); i += 2; continue; }
        const c = w[i]!;
        // ⟨n m⟩ — nasalisation logic (not a plain grapheme)
        if (c === "n" || c === "m") {
            const next = w[i + 1];
            if (next !== undefined && VOWELS.has(next)) {
                out.push(c); // onset nasal before a vowel
            } else if (out.length > 0 && VOWEL_PH.has(out[out.length - 1]!)) {
                out[out.length - 1] += NASAL_TILDE; // syllable-final n → nasalise the preceding vowel, drop the n
            } else {
                // word-initial / post-consonant prenasal: assimilate place to the following consonant
                out.push(next === "g" || next === "k" ? "ŋ" : c === "n" ? "n" : "m");
            }
            i += 1;
            continue;
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed. Only
        // reached when every grapheme (digraphs included) has declined, so the language's own reading wins.
        const g = G[c] ?? latinPhone(c, { initial: i === 0, includeH: true });
        if (g !== undefined) out.push(g);
        i += 1;
    }
    return out.join("");
}

// A word — Bambara Latin (incl. ɛ ɔ ɲ ŋ) OR N'Ko (letters U+07CA–07EA + its tone/nasal marks) / number / punct.
// The number class covers BOTH digit sets the two registered scripts use: ASCII 0–9 and N'Ko ߀–߉ (U+07C0–07C9).
const TOKEN = new RegExp(`(${hostWordRun(["Latin", "Nko"])})|([\\d\\u{07C0}-\\u{07C9}]+)|([.!?…,;:])`, "giu");
/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where the
 * SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A token
 * this class REJECTS carries a letter the language does not use — i.e. a foreign name. See core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zɛɔɲŋ\\u{07CA}-\\u{07F5}\\u{07FA}\\u{07FD}]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class BambaraPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(normalizeBambara(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // numbers: N'Ko digits folded to ASCII, composed to Bambara words, then through the same g2p
            else if (m[2]) for (const wd of numberToWords(Number(foldNkoDigits(m[2])), foldNkoDigits(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Bambara phonemizer (greedy g2p + nasalisation; decimal numbers; tone + length deferred). */
export function createBambara(): Phonemizer {
    return new BambaraPhonemizer();
}
