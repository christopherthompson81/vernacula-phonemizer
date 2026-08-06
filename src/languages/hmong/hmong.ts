/**
 * Hmong (hmn) — White Hmong / Hmoob Dawb (Hmong Daw, mww), Hmong-Mien, tonal (~8M, SW China / SE Asia / diaspora).
 * This phonemizer consumes the **Romanized Popular Alphabet (RPA)** — the community-standard phonemic Latin
 * orthography — and converts it to canonical IPA. RPA has NO coda consonants, so a word-final consonant letter is
 * ALWAYS a TONE marker (⟨b j v s g m d⟩; no final letter = the mid tone). The converter: strip the final tone letter
 * → tone, then [onset] (longest multigraph match) + rime → IPA + a Chao tone letter. ⟨tx x⟩ PALATALISE to [t͡ɕ ɕ]
 * before /i/; a vowel-initial syllable gets a glottal onset [ʔ]. The rich onset system — prenasalised (np→ᵐb,
 * nts→ᶯd͡ʐ), voiceless sonorants (hm→m̥, hl→l̥), retroflex (r→ʈ, ts→t͡ʂ), uvular (q) — lives in hmong.jsonc.
 * Nasal vowels ⟨ee oo⟩→[ẽ ɒ̃]. Maps derived from the wikipron mww_latn_broad referee (~470 pairs) + the documented
 * RPA tables → 🔷 single-source (thin).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses, clauseSink } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToHmongWords } from "./numbers.ts";

interface HmongDef {
    initials: Record<string, string>;
    palatalBeforeI: Record<string, string>; // ⟨tx x⟩ → [t͡ɕ ɕ] before /i/
    rimes: Record<string, string>;
    toneLetter: Record<string, string>; // RPA final tone letter → tone number
    toneChao: Record<string, string>; // tone number → Chao contour letters
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<HmongDef>(import.meta.url, "hmong.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Onsets tried longest-first so ⟨ntsh⟩ beats ⟨nts⟩ beats ⟨nt⟩ beats ⟨n⟩, etc.
const INITIALS = Object.keys(DEF.initials).sort((a, b) => b.length - a.length);
// Rimes tried longest-first so ⟨ee⟩ beats ⟨e⟩, ⟨ai⟩ beats ⟨a⟩, etc.
const RIMES = Object.keys(DEF.rimes).sort((a, b) => b.length - a.length);
const TONE_LETTERS = new Set(Object.keys(DEF.toneLetter));

/** One RPA syllable → IPA. Strip the final tone letter, then onset + rime; palatalise ⟨tx x⟩ before /i/; a
 *  vowel-initial syllable takes a glottal onset [ʔ]. Unknown material is left visible for the residual report. */
function syllableToIpa(syl: string): string {
    const w = syl.normalize("NFC").toLowerCase();
    if (!w) return "";
    // The tone = the final consonant LETTER (RPA has no codas); no such letter → tone 4 (mid).
    const lastIsTone = w.length > 1 && TONE_LETTERS.has(w[w.length - 1]!);
    const base = lastIsTone ? w.slice(0, -1) : w;
    const tone = lastIsTone ? DEF.toneLetter[w[w.length - 1]!]! : "4";
    const chao = DEF.toneChao[tone] ?? "";
    // Onset: longest multigraph match; none matched + vowel-initial → glottal [ʔ]; none + consonant → unknown.
    let ini = "";
    for (const k of INITIALS) if (base.startsWith(k)) { ini = k; break; }
    const rimeRpa = base.slice(ini.length);
    const rime = RIMES.find((r) => rimeRpa === r);
    if (rime === undefined) return syl; // unknown rime → leave visible
    let iniIpa = ini === "" ? "ʔ" : (DEF.initials[ini] ?? "");
    if (rime[0] === "i" && DEF.palatalBeforeI[ini]) iniIpa = DEF.palatalBeforeI[ini]!; // ⟨tx x⟩ → palatal before /i/
    return iniIpa + DEF.rimes[rime] + chao;
}

class HmongPhonemizer implements Phonemizer {
    text(input: string): string {
        // `assembleClauses` rather than a private exec loop: this loop was already that shape and only
        // predated the shared helper, so it never got the GAP PASS and a run in a script it does not claim
        // was dropped outright. Routed by core/scripts.ts.
                // RPA syllables are space/hyphen-separated Latin letter-runs.
        const tok = new RegExp(`(${LATIN_RUN})|(\\d+)|([。，、？！；：.,?!;:])`, "gu");
        
        return assembleClauses(input, tok, (m, sink) => {
            if (m[1]) sink.emit(syllableToIpa(nat(m[1])));
            else if (m[2]) for (const wd of numberToHmongWords(Number(m[2]))) sink.emit(syllableToIpa(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hmong (White Hmong / RPA) phonemizer — RPA → IPA (segmental + citation tone). */
export function createHmong(): Phonemizer {
    return new HmongPhonemizer();
}

/** Bare RPA word → IPA (tests / referee eval). */
export function phonemizeWord(word: string): string {
    return syllableToIpa(word);
}

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it is no longer also
 * deciding where the script boundary falls.
 */
const NATIVE_CLASS = "[a-zA-Z]";
const nat = makeNativiser(NATIVE_CLASS, "u");