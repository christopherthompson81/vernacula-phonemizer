/**
 * Welsh (cy) phonemizer — canonical IPA, espeak-independent, Northern-leaning. Rule-based g2p (g2p.ts) +
 * PENULTIMATE stress + the Welsh vowel-length rule. A stressed monophthong in a long context — open, or before a
 * single voiced/fricative coda — takes full length (ː) in a monosyllable/final syllable (mis → miːs); in a penult
 * it stays SHORT and LAX (pobol → pɔbɔl, nesaf → nɛsav — the NW referee shows lax, not the espeak-tensed [o]/[e]).
 * Elsewhere it stays lax and short (bore → bɔrɛ). Diphthongs and circumflex vowels are already long and untouched.
 * See docs/cy_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { type Seg, toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const LONG = MANIFEST.longVowel; // lax short → long tense (adds ː): ɛ→eː, ɔ→oː, …
const LENGTHENS = new Set([...MANIFEST.lengthenBefore]); // single coda consonants that give a long/tense context

/** Apply the vowel-length rule to the stressed nucleus. `stress` is its index; `isFinal` = no nucleus follows. */
function applyLength(segs: Seg[], stress: number, isFinal: boolean): void {
    const v = segs[stress]!;
    if (v.long || v.ph === "ə") return; // diphthong / circumflex / schwa: never length-adjusted
    // coda = the consonants between this nucleus and the next nucleus (or word end)
    let coda = 0,
        single = "";
    for (let j = stress + 1; j < segs.length && !segs[j]!.nucleus; j++) {
        coda++;
        single = segs[j]!.ph;
    }
    const longContext = coda === 0 || (coda === 1 && LENGTHENS.has(single));
    if (!longContext) return; // lax + short (voiceless stop, m, ŋ, ɬ, cluster, or the deferred n/r/l)
    // Full length ː only in a monosyllable / final syllable; a PENULT keeps its short LAX quality (pobol→pɔbɔl,
    // nesaf→nɛsav — the NW referee shows lax; the espeak-tensed penult [o]/[e] was an oracle artifact, cf. i→ɨ).
    if (isFinal) v.ph = LONG[v.ph] ?? v.ph;
}

const EXCEPTIONS = MANIFEST.exceptions; // irregular function words (short/lax where the rule would lengthen)
const ENCLITICS = MANIFEST.enclitics; // apostrophe-contracted enclitics (o'r, hi'n)

/** One Welsh word → canonical IPA: scan, penultimate stress, vowel length. */
export function phonemizeWord(word: string): string {
    const lw = word.toLowerCase();
    const exc = EXCEPTIONS[lw.replace(/['’]/g, "")];
    if (exc !== undefined) return exc; // irregular function word (i → ɨ, bod → bɔd)
    // Apostrophe enclitic (o'r → oːr, hi'n → hiːn): phonemize the STEM as its own word so its length rule sees the
    // real (open) syllable, then append the enclitic — instead of merging them into one closed syllable.
    const clitic = lw.match(/^(.+)['’]([a-z]+)$/);
    if (clitic && ENCLITICS[clitic[2]!]) return phonemizeWord(clitic[1]!) + ENCLITICS[clitic[2]!]!;
    const segs = toSegments(word.replace(/['’]/g, "")); // strip clitic apostrophes (mae'r, cymru'n)
    if (segs.length === 0) return "";
    const nucleiIdx = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nucleiIdx.length === 0) return segs.map((s) => s.ph).join("");
    // PENULTIMATE stress (the second-to-last nucleus; the only nucleus in a monosyllable).
    const stressN = nucleiIdx.length >= 2 ? nucleiIdx.length - 2 : 0;
    const stress = nucleiIdx[stressN]!;
    applyLength(segs, stress, stressN === nucleiIdx.length - 1);
    // NB: the letter ⟨i⟩ stays FRONT (i/ɪ/iː) everywhere — Northern Welsh centralizes only ⟨u⟩ and clear ⟨y⟩ to
    // ɨ, keeping the i/ɨ contrast (melin → mɛlɪn, gwin → ɡwiːn). Run 1's i→ɨ rules matched an espeak ARTEFACT the
    // independent NW referee contradicts, and were removed in Run 3. The residual is now purely n/r/l LENGTH.
    // Secondary stress on the first syllable when the primary is the 3rd nucleus or later (cymdeithasol →
    // ˌkəmdəᶦˈθasɔl).
    const secondary = stressN >= 2 ? nucleiIdx[0]! : -1;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        else if (i === secondary) out += "ˌ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN =
    /([a-zâêîôûŵŷàèìòùïëöäüA-ZÂÊÎÔÛŴŶ]+(?:['’-][a-zâêîôûŵŷA-Z]+)*)|(\d+)|([.!?…,;:])/gu;

class WelshPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Welsh phonemizer (rule-based; penultimate stress + vowel length). */
export function createWelsh(): Phonemizer {
    return new WelshPhonemizer();
}
