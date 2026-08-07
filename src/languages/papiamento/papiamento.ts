/**
 * Papiamentu (pap) phonemizer — a greedy longest-match scan over the Curaçao/Bonaire phonemic
 * orthography, canonical IPA. This file owns the rules: word-final coda-⟨n⟩ → [ŋ] with vowel
 * nasalization, degemination, the ⟨ou⟩ diphthong, and stress placement (acute pin / penult default /
 * ultimate for consonant-final). The grapheme tables and the encyclopedic record (the coda-⟨n⟩ hallmark,
 * attestation caveat) live in papiamento.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface PapiamentoDef {
    digraphs: [string, string][];
    vowelLetters: readonly string[];
    letters: Record<string, string>;
    nasalized: Record<string, string>;
}
const DEF = loadManifest<PapiamentoDef>(import.meta.url, "papiamento.jsonc");
// Grapheme tables (papiamento.jsonc). The coda-⟨n⟩, degemination and stress rules are the scan below.
const DIGRAPHS = DEF.digraphs;
const LETTER = DEF.letters;
const NASALIZE = DEF.nasalized;
const VOWEL_G = new Set(DEF.vowelLetters); // the vowel letters counted to place an acute-marked stress
const IPA_VOWEL = new Set([..."aeiouɛɔø"]);
const ACUTE: Record<string, string> = { "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u" };

/** One Papiamentu word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Degeminate: Papiamentu has no geminate consonants, so a doubled consonant (mostly in Dutch/Spanish loans) is a
    // single one (Willemstad→[wiləmstad]). Vowels are left alone (they can be genuine sequences).
    const w = word.normalize("NFC").toLowerCase().replace(/([bcdfghjklmnpqrstvwxz])\1+/gu, "$1");
    const chars = [...w];
    const segs: string[] = [];
    const stressAcute = chars.findIndex((c) => ACUTE[c] !== undefined); // an acute vowel marks irregular stress
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        const dg = DIGRAPHS.find(([k]) => chars[i] === k[0] && chars[i + 1] === k[1]);
        if (dg) { segs.push(dg[1]); i++; continue; }
        if (c === "o" && chars[i + 1] === "u") { segs.push("ɔ"); continue; } // the ⟨ou⟩ diphthong → [ɔu] (Kòrsou→kɔrsɔu)
        // CODA ⟨n⟩ is RETAINED (Papiamentu does NOT delete it — Maurer; Kouwenberg & Murray): WORD-FINAL ⟨n⟩ → the
        // velar nasal [ŋ], also NASALIZING the preceding vowel (bon→[bõŋ], federashon→[fedeɾaʃõŋ]). A ⟨n⟩ before a
        // consonant or a vowel stays [n] (kontra→[kɔntra], abominabel→[abominabel]). (The Wiktionary referee's
        // "nasalize + drop the ⟨n⟩" is a Portuguese-style over-transcription — the ⟨n⟩→∅ is folded, not modelled.)
        if (c === "n" && i + 1 >= chars.length && segs.length && IPA_VOWEL.has(segs[segs.length - 1]!.slice(-1))) {
            const prev = segs[segs.length - 1]!;
            segs[segs.length - 1] = prev.slice(0, -1) + (NASALIZE[prev.slice(-1)] ?? prev.slice(-1));
            segs.push("ŋ");
            continue;
        }
        const ph = LETTER[c];
        if (ph !== undefined) segs.push(ph);
    }
    // STRESS: an acute-accented vowel pins it; otherwise the penultimate vowel (Iberian default).
    // Vowel nuclei for stress. A falling-diphthong OFFGLIDE — a high vowel [i]/[u] right after another vowel (ou, ai,
    // au, ei, oi) — is NOT a separate nucleus (Kòrsou→[ˈkɔrsou], one nucleus per the ⟨ou⟩ diphthong).
    const isVowelSeg = (s: string): boolean => [...s.normalize("NFD")].some((x) => IPA_VOWEL.has(x));
    const vIdx = segs.map((s, idx) => {
        if (!isVowelSeg(s)) return -1;
        if ((s === "i" || s === "u") && idx > 0 && isVowelSeg(segs[idx - 1]!)) return -1; // diphthong offglide
        return idx;
    }).filter((x) => x >= 0);
    if (vIdx.length) {
        let nucleus: number;
        if (stressAcute >= 0) {
            // map the acute grapheme position to its vowel seg (count vowels up to it)
            const vowelsBefore = chars.slice(0, stressAcute).filter((c) => VOWEL_G.has(c)).length;
            nucleus = vIdx[Math.min(vowelsBefore, vIdx.length - 1)]!;
        } else {
            // Iberian default: penultimate for a vowel-final word; ULTIMATE for a consonant-final word or one ending
            // in a NASALIZED vowel (a dropped coda-⟨n⟩ loan, -shon/-in → final stress: federashon, mashin).
            const last = segs[segs.length - 1]!;
            const lastVowel = [...last.normalize("NFD")].some((x) => IPA_VOWEL.has(x));
            const lastNasal = last.normalize("NFD").includes("̃");
            nucleus = (!lastVowel || lastNasal || vIdx.length < 2) ? vIdx[vIdx.length - 1]! : vIdx[vIdx.length - 2]!;
        }
        const at = nucleus > 0 && ![...segs[nucleus - 1]!.normalize("NFD")].some((x) => IPA_VOWEL.has(x)) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("");
}

// Papiamentu Latin — a-z + the accented/open letters. Word / number / punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zàáèéìíòóùúñA-ZÀÁÈÉÌÍÒÓÙÚÑ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class PapiamentoPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Papiamentu number WORDS, each phonemized like any other word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Papiamentu phonemizer (Curaçao-orthography scan + coda-n nasalization + stress). */
export function createPapiamento(): Phonemizer {
    return new PapiamentoPhonemizer();
}
