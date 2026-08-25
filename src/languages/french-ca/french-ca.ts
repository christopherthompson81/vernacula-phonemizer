/**
 * Québécois French (fr-CA) — Canadian/Quebec French, an ACCENT VARIANT of the France-French `fr` engine (not a
 * separate language). Reuses the full French G2P and applies a context-free surface DELTA — `toQuebecois()` — to
 * the output, the es-419/en-IN pattern (no information lost → a post-process, not an engine fork). ~7M native
 * speakers. NOTE: this is Québécois specifically, NOT "African French" — the latter is not a single phonology
 * (~120M speakers across dozens of substrate-conditioned national varieties) and has no single target or referee.
 *
 * The delta (France French → Québécois), from the documented phonology (Walker 1984, *The Pronunciation of
 * Canadian French*; Côté 2012):
 *   • AFFRICATION — the signature: /t d/ → [t͡s d͡z] before the HIGH FRONT vowels /i y/ and the glides /j ɥ/
 *     (tu→t͡sy, dire→d͡ziʁ, tuile→t͡sɥil, dimanche→d͡zimɑ̃ʃ). NOT before back /u/ (tout stays [tu]).
 *   • HIGH-VOWEL LAXING — /i y u/ → [ɪ ʏ ʊ] in a CLOSED syllable, UNLESS the coda is a "lengthening" consonant
 *     /ʁ v z ʒ/ which keeps the vowel tense/long (petite→pt͡sɪt, six→sɪs, jupe→ʒʏp, route→ʁʊt; but dire→d͡ziʁ
 *     stays tense — ʁ lengthens). Open syllables keep the tense vowel (petit→pt͡si, difficile→d͡zifisɪl: only the
 *     final closed ⟨il⟩ laxes).
 *     ⚠ THE EXAMPLE `musique→myzik` USED TO BE LISTED HERE AS TENSE AND IT IS NOT — the engine says myzɪk, and
 *     is right to. The lengthening set is about the coda AFTER the vowel; in *musique* the /z/ is an ONSET
 *     BEFORE /i/, and that /i/'s actual coda is /k/, which laxes like any other. A doc/code mismatch, caught
 *     by a C# port test written from the comment rather than from the behaviour.
 *   • WORD-FINAL /a/ → [ɑ] (posterior): Canada→kanadɑ.
 *
 * Deliberately DEFERRED (fine-grained, variable, and no fr-CA pronunciation corpus exists to adjudicate): the
 * NASAL-vowel shifts (/ɛ̃/→[ẽ]~[ẽɪ̯̃], /ɔ̃/→[õ], /ɑ̃/→[ã]~[aɔ̯̃]), long-vowel DIPHTHONGISATION in closed stressed
 * syllables (père→[paɛ̯ʁ], fête→[faɪ̯t]), and the /ɑ/–/a/ lexical distinction (pâte vs patte — merged by the
 * France engine, unrecoverable from its output).
 */
import type { Phonemizer } from "../../registry.ts";
import { createFrench } from "../french/french.ts";

const LAX: Record<string, string> = { i: "ɪ", y: "ʏ", u: "ʊ" };
// non-lengthening coda consonants; the LENGTHENING set /ʁ v z ʒ/ is deliberately absent (it keeps the vowel tense).
const CODA = "ptkbdɡfsʃmnɲŋlç";
// after a coda consonant: end-of-word or another consonant. A vowel / stress mark / affricate-TIE means the
// consonant is a syllable ONSET (open syllable) → no laxing. U+0361 tie: a coda C + tie is an affricate onset (t͡s).
const OPEN = "aeɛiouyœøəɑɔˈ͡";

/** France-French citation IPA → Québécois (affrication + high-vowel laxing + final-/a/ backing; context-free). */
export function toQuebecois(fr: string): string {
    let s = fr;
    // AFFRICATION first (needs the underlying /i y j ɥ/, before laxing rewrites them).
    s = s.replace(/t(?=[ˈˌ]?[iyɥj])/gu, "t͡s").replace(/d(?=[ˈˌ]?[iyɥj])/gu, "d͡z");
    // LAXING: high vowel before a non-lengthening coda consonant (not a syllable onset).
    s = s.replace(
        new RegExp(`([iyu])(?=[${CODA}](?![${OPEN}]))`, "gu"),
        (_m, v: string) => LAX[v]!,
    );
    // WORD-FINAL /a/ → posterior [ɑ].
    s = s.replace(/a(?=[ .,;!?…»)]|$)/gu, "ɑ");
    return s;
}

/** One fr-CA word → canonical IPA (France engine + the Québécois delta). Context-free → shipped == rule path. */
export function phonemizeWord(word: string): string {
    return toQuebecois(createFrench().text(word));
}
/** Alias kept for parity with the other accent variants (en-GB/pt-BR) that split a lexicon-bearing shipped path. */
export const phonemizeWordRules = phonemizeWord;

/** Build the Québécois-French phonemizer (France engine + the Québécois delta on the output). */
export function createFrenchCA(): Phonemizer {
    const e = createFrench();
    return { text: (input: string): string => toQuebecois(e.text(input)) };
}
