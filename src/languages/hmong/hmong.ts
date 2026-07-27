/**
 * Hmong (hmn) — White Hmong / Hmoob Dawb (Hmong Daw, mww), Hmong-Mien, tonal (~8M, SW China / SE Asia / diaspora).
 * This phonemizer consumes the **Romanized Popular Alphabet (RPA)** — the community-standard phonemic Latin
 * orthography — and converts it to canonical IPA. RPA has NO coda consonants, so a word-final consonant letter is
 * ALWAYS a TONE marker (⟨b j v s g m d⟩; no final letter = the mid tone). The converter: strip the final tone letter
 * → tone, then [onset] (longest multigraph match) + rime → IPA + a Chao tone letter. ⟨tx x⟩ PALATALISE to [t͡ɕ ɕ]
 * before /i/; a vowel-initial syllable gets a glottal onset [ʔ]. The rich onset system — prenasalised (np→ᵐb,
 * nts→ᶯd͡ʐ), voiceless sonorants (hm→m̥, hl→l̥), retroflex (r→ʈ, ts→t͡ʂ), uvular (q) — lives in hmong.jsonc.
 * Nasal vowels ⟨ee oo⟩→[ẽ ɒ̃]. Maps derived from the wikipron mww_latn_broad referee (~470 pairs) + the documented
 * RPA tables → 🔷 single-source (thin). See docs/investigations/hmn_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

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
        const { sink, finish } = clauseSink();
        // RPA syllables are space/hyphen-separated Latin letter-runs.
        const tok = /([a-zA-Z]+)|([。，、？！；：.,?!;:])/gu;
        let m: RegExpExecArray | null;
        while ((m = tok.exec(input))) {
            if (m[1]) sink.emit(syllableToIpa(m[1]));
            else if (m[2]) {
                const mk = CLAUSE_MARK[m[2]];
                if (mk) sink.pause(mk);
            }
        }
        return finish();
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
