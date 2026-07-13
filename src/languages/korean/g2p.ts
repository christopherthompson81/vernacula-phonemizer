/**
 * Korean grapheme→phoneme engine (Seoul standard), espeak-independent. Hangul syllable blocks are decomposed
 * algorithmically into initial (L) / medial (V) / final (T) jamo, then Korean's extensive cross-syllable sandhi
 * is applied over the jamo sequence:
 *   - liaison: a coda before a null-onset (ㅇ) vowel moves to onset (국이→kuɡi); ㅎ deletes (좋아→t͡ɕoɐ);
 *   - palatalization: ㄷ/ㅌ + 이 → t͡ɕ/t͡ɕʰ (같이→kɐt͡ɕʰi);
 *   - lenis voicing: ㄱㄷㅂㅈ → ɡdbd͡ʑ after a vowel/sonorant (가다→kɐdɐ);
 *   - aspiration: ㅎ ± a lenis stop → aspirated (놓고→nokʰo, 좋다→t͡ɕotʰɐ);
 *   - tensification: an obstruent coda + a lenis stop → tense (학교→hɐk̚k͈jo, 맑다→mɐk̚t͈ɐ);
 *   - nasalization: an obstruent coda + a nasal → nasal coda (국물→kuŋmuɭ… wait kuŋmul; 합니→hɐmni);
 *   - lateralization: ㄴㄹ / ㄹㄴ → ll (신라→siɭɭɐ);
 *   - coda neutralization: the 7 possible codas, obstruents unreleased ̚ (밥→pɐp̚).
 * Contributes ̚ (unreleased) and ͈ (tense). See docs/ko_native_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Unicode Hangul-decomposition constants (structural — drive the syllable-block index math).
const SBASE = 0xac00,
    LCOUNT = 19,
    VCOUNT = 21,
    TCOUNT = 28,
    NCOUNT = VCOUNT * TCOUNT;
// Jamo inventories + all letter→IPA / sandhi lookup tables are DATA (korean.jsonc). T_JAMO's leading null coda
// is re-added here (the manifest stores the codas without it so index math lines up with the Unicode T value).
const L_JAMO = [...MANIFEST.jamo.onset];
const V_JAMO = [...MANIFEST.jamo.vowel];
const T_JAMO = ["", ...MANIFEST.jamo.coda];

const ONSET = MANIFEST.onset; // onset jamo → phoneme (underlying, before voicing)
const VOWEL = MANIFEST.vowel; // medial jamo → phoneme
const CODA = MANIFEST.coda; // coda jamo → { cons, lc, lo } (cluster resolution)
const CODA_PH = MANIFEST.codaPhoneme; // underlying coda jamo → surface phoneme (7-way neut.)
const NASAL_CODA = new Set([...MANIFEST.nasalCodas]); // sonorant-nasal codas
const NEUT = MANIFEST.neutralize; // 7-way coda neutralisation → representative jamo
const OBSTR_CODA_TO_NASAL = MANIFEST.obstruentToNasal; // obstruent coda → homorganic nasal (before nasal onset)
const VOICE = MANIFEST.voice; // lenis onset phoneme → voiced allophone
const TENSE = MANIFEST.tense; // lenis onset phoneme → tense (tensifiability test)
const TENSE_JAMO = MANIFEST.tenseJamo; // lenis onset jamo → tense counterpart jamo
const ASP_H_CODA = MANIFEST.aspiration.hCodaLenisOnset; // ㅎ coda + lenis onset → aspirated onset jamo
const ASP_STOP_H = MANIFEST.aspiration.stopCodaHOnset; // stop coda + ㅎ onset → aspirated onset jamo
// Korean lexical/사잇소리 tensification (경음화) that is NOT phonologically rule-derivable (Sino-Korean §26
// needs Hanja etymology). Word → 0-based syllable indices whose onset tenses. From wikipron (tensification.tsv).
let TENS: Map<string, number[]> | undefined;
function tensLexicon(): Map<string, number[]> {
    if (TENS === undefined)
        TENS = loadTsvMap(
            import.meta.url,
            "tensification.tsv",
            (v) => v.split(",").map(Number),
            { optional: true },
        );
    return TENS;
}

interface Syl {
    L: string;
    V: string;
    T: string;
} // jamo; T = "" if none

/** Decompose a run into syllables (non-Hangul chars are dropped). */
function decompose(word: string): Syl[] {
    const out: Syl[] = [];
    for (const ch of word) {
        const c = ch.codePointAt(0)!;
        if (c < SBASE || c > 0xd7a3) continue;
        const s = c - SBASE;
        out.push({
            L: L_JAMO[Math.floor(s / NCOUNT)]!,
            V: V_JAMO[Math.floor((s % NCOUNT) / TCOUNT)]!,
            T: T_JAMO[s % TCOUNT]!,
        });
    }
    return out;
}

/** One Korean word → canonical IPA (Hangul decomposition + sandhi + coda neutralisation). */
export function phonemizeWord(word: string): string {
    const syls = decompose(word);
    if (syls.length === 0) return "";
    // coda[i] = the underlying coda jamo kept before a consonant/pause; onset[i] = onset jamo (reassigned by liaison).
    const coda: string[] = syls.map((s) => (s.T ? CODA[s.T]!.cons : ""));
    const onset: string[] = syls.map((s) => s.L);
    const liaised: boolean[] = syls.map(() => false); // onset was moved here by liaison (gates palatalization)

    // Cross-boundary sandhi (coda of i vs onset of i+1).
    for (let i = 0; i < syls.length - 1; i++) {
        const cd = coda[i]!;
        if (cd === "") continue;
        const on = onset[i + 1]!;
        // LIAISON: coda before a null onset ㅇ — the underlying consonant moves to onset (ㅎ deletes).
        if (on === "ㅇ") {
            const info = CODA[syls[i]!.T]!;
            if (info.lo === "ㅎ") {
                coda[i] = info.lc;
                onset[i + 1] = "ㅇ";
            } // ㅎ deletes before a vowel
            else {
                onset[i + 1] = info.lo;
                coda[i] = info.lc;
                liaised[i + 1] = true;
            }
            continue;
        }
        // ㅎ coda + lenis stop → aspirate the onset; ㅎ deletes (checks the UNDERLYING ㅎ, incl. ㄶ/ㅀ clusters).
        if (
            cd === "ㅎ" &&
            (on === "ㄱ" || on === "ㄷ" || on === "ㅈ" || on === "ㅅ")
        ) {
            onset[i + 1] = ASP_H_CODA[on]!;
            coda[i] =
                syls[i]!.T === "ㄶ" ? "ㄴ" : syls[i]!.T === "ㅀ" ? "ㄹ" : "";
            continue;
        }
        const ncd = NEUT[cd] ?? cd; // 7-way neutralised coda for the obstruent-based rules below
        // stop coda + ㅎ onset → aspirate; the ㅎ becomes the aspirated stop, coda drops.
        if (on === "ㅎ" && (ncd === "ㄱ" || ncd === "ㄷ" || ncd === "ㅂ")) {
            onset[i + 1] = ASP_STOP_H[ncd]!;
            coda[i] = "";
            continue;
        }
        // LATERALIZATION: ㄴㄹ or ㄹㄴ → ll.
        if ((ncd === "ㄴ" && on === "ㄹ") || (ncd === "ㄹ" && on === "ㄴ")) {
            coda[i] = "ㄹ";
            onset[i + 1] = "ㄹ";
            continue;
        }
        // NASALIZATION: obstruent coda + nasal onset → the coda becomes the homorganic nasal.
        if ((on === "ㄴ" || on === "ㅁ") && ncd in OBSTR_CODA_TO_NASAL) {
            coda[i] = OBSTR_CODA_TO_NASAL[ncd]!;
            continue;
        }
        // ㄹ after an obstruent(→nasal) or a nasal coda → ㄴ (독립→toŋnip, 국립).
        if (
            on === "ㄹ" &&
            (ncd in OBSTR_CODA_TO_NASAL || NASAL_CODA.has(ncd))
        ) {
            onset[i + 1] = "ㄴ";
            if (ncd in OBSTR_CODA_TO_NASAL) coda[i] = OBSTR_CODA_TO_NASAL[ncd]!;
            continue;
        }
        // TENSIFICATION: obstruent coda + lenis stop/s → tense.
        if (
            (ncd === "ㄱ" || ncd === "ㄷ" || ncd === "ㅂ") &&
            ONSET[on]! in TENSE
        ) {
            onset[i + 1] = TENSE_JAMO[on] ?? on;
        }
    }

    // LEXICAL tensification (경음화): force-tense the onsets the lexicon lists for this word (a tense onset
    // never voices). Applied after sandhi so it overrides the lenis realisation.
    const tens = tensLexicon().get(word);
    if (tens)
        for (const j of tens)
            if (onset[j] !== undefined && onset[j]! in TENSE_JAMO)
                onset[j] = TENSE_JAMO[onset[j]!]!;

    // Stress: the first HEAVY (coda-bearing, underlying) syllable; if none is closed, the first syllable.
    let stressIdx = syls.findIndex((s) => s.T !== "");
    if (stressIdx < 0) stressIdx = 0;

    // Realize phonemes; ˈ goes before the stressed syllable's nucleus (after its onset).
    let out = "";
    const isSonorant = (cd: string): boolean =>
        NASAL_CODA.has(cd) || cd === "ㄹ";
    for (let i = 0; i < syls.length; i++) {
        // onset
        let onPh = ONSET[onset[i]!] ?? "";
        const prevCoda = i > 0 ? coda[i - 1]! : null;
        // palatalization ㄷ/ㅌ + 이 → t͡ɕ/t͡ɕʰ (onset came from a liaised ㄷ/ㅌ before ㅣ).
        if (
            liaised[i]! &&
            (onset[i] === "ㄷ" || onset[i] === "ㅌ") &&
            syls[i]!.V === "ㅣ"
        )
            onPh = onset[i] === "ㄷ" ? "t͡ɕ" : "t͡ɕʰ";
        // ㄹ onset after a ㄹ coda → the lateral ɭ (geminate ll: 신라→siɭɭɐ); elsewhere ㄹ onset is the tap ɾ.
        else if (onset[i] === "ㄹ" && prevCoda === "ㄹ") onPh = "ɭ";
        // lenis voicing between sonorants/vowels (prev syllable had a vowel or a sonorant coda, and no coda here-before).
        const voiceable = onPh in VOICE;
        const afterSonorant =
            i > 0 &&
            (prevCoda === "" || (prevCoda !== null && isSonorant(prevCoda)));
        if (voiceable && afterSonorant) onPh = VOICE[onPh]!;
        out += onPh;
        if (i === stressIdx) out += "ˈ"; // ˈ before the whole medial (incl. any onglide j/w — espeak convention)
        out += VOWEL[syls[i]!.V] ?? "";
        // coda
        if (coda[i]) out += CODA_PH[coda[i]!] ?? "";
    }
    return out;
}
