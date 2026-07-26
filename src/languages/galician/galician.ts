/**
 * Galician (gl) phonemizer — canonical IPA, galego, espeak-independent. Rule-based g2p (g2p.ts) + nasal
 * velarization + spirantization + rule-based stress; no lexicon. text() tokenizes words / numbers / punctuation.
 * Galician shares the Ibero-Romance shape with Spanish; the deltas are ⟨x⟩/⟨j⟩→ʃ, ⟨g⟩→ɡ (no jota), ⟨nh⟩→ŋ,
 * and the coda/pre-velar ⟨n⟩→ŋ velarization applied here. See docs/investigations/gl_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const NASALS = new Set(MANIFEST.nasals);
const STOP_TO_FRIC = MANIFEST.spirantize;
const VELARS = new Set(["k", "ɡ"]);

/** Coda velarization — Galician neutralizes a coda/word-final nasal to the velar [ŋ]:
 *   • ⟨n⟩ → ŋ word-finally (Alén→alɛŋ), before a velar stop (cinco→siŋko), and in the word-final -ns plural
 *     cluster (cans→kaŋs, cancións→kanθjoŋs, millóns→miʎoŋs) — a very common inflection;
 *   • word-final ⟨m⟩ → ŋ (álbum→alβuŋ) — the same neutralization on the rare -m latinisms.
 *  Runs before spirantization so the resulting ŋ blocks the following ɡ from spirantizing (ningún→niŋɡuŋ). */
function velarizeNasal(segs: Seg[]): void {
    const last = segs.length - 1;
    for (let i = 0; i < segs.length; i++) {
        const ph = segs[i]!.ph;
        const next = i < last ? segs[i + 1]!.ph : "";
        if (ph === "n") {
            // word-final, before a velar, or the final -ns cluster (n at len-2, s at len-1)
            if (next === "" || VELARS.has(next) || (next === "s" && i === last - 1))
                segs[i]!.ph = "ŋ";
        } else if (ph === "m" && next === "") {
            segs[i]!.ph = "ŋ"; // final-nasal neutralization (rare -m loans)
        }
    }
}

/** b/d/ɡ → β/ð/ɣ except utterance-initial, after a nasal, or d after l. */
function spirantize(segs: Seg[]): void {
    for (let i = 0; i < segs.length; i++) {
        const ph = segs[i]!.ph;
        const fric = STOP_TO_FRIC[ph];
        if (fric === undefined) continue;
        const prev = i > 0 ? segs[i - 1]!.ph : "";
        const stop =
            i === 0 || NASALS.has(prev) || (ph === "d" && prev === "l");
        if (!stop) segs[i]!.ph = fric;
    }
}

/** Index of the stressed nucleus: the written accent, else penultimate (word ends in a syllabic vowel / n / s)
 *  or final. The "ends in a vowel" test is on the last SEGMENT being a nucleus — a word ending in a falling
 *  diphthong is glide-final (cantou→[kanˈtow], amei→[aˈmej]), so it takes oxytone stress, not penult. */
function stressedNucleus(word: string, segs: Seg[]): number {
    const nuclei = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return -1;
    const accented = nuclei.find((i) => segs[i]!.accent);
    if (accented !== undefined) return accented;
    if (nuclei.length === 1) return nuclei[0]!;
    const last = word.toLowerCase().at(-1) ?? "";
    const endsNucleus = segs[segs.length - 1]!.nucleus; // a TRUE final vowel (a diphthong offglide is not one)
    const penult = endsNucleus || last === "n" || last === "s";
    return penult ? nuclei[nuclei.length - 2]! : nuclei[nuclei.length - 1]!;
}

/** Phonemize a single Galician word to canonical IPA (with a stress mark). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    velarizeNasal(segs);
    spirantize(segs);
    const stress = stressedNucleus(word, segs);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word / number / clause-punctuation token. Numbers use the Iberian convention: dot = thousands separator
// (1.500), comma = decimal (3,14). Galician letters incl. accents + ñ/ü.
const TOKEN = /([a-záéíóúüñ]+)|(\d+(?:\.\d+)*(?:,\d+)?)|([.!?…,;:])/giu;

/** A number token (with thousands-dots / decimal-comma) → spoken words. */
function numberTokenToWords(tok: string): string {
    const [intRaw, frac] = tok.split(",");
    let words = numberToWords(Number(intRaw!.replace(/\./g, "")));
    if (frac !== undefined)
        words +=
            ` ${MANIFEST.numbers.decimalConnector} ` +
            [...frac].map((d) => numberToWords(Number(d))).join(" ");
    return words;
}
// Unstressed monosyllabic clitics (articles, prepositions, conjunctions, clitic pronouns) — de-accented in
// running text (DATA: galician.jsonc).
const FUNCTION_WORDS = new Set(MANIFEST.functionWords);

/** Phonemize one running-text word, de-accenting unstressed function words. */
function wordIpa(word: string): string {
    const ipa = phonemizeWord(word);
    return FUNCTION_WORDS.has(word.toLowerCase()) ? ipa.replace("ˈ", "") : ipa;
}

class GalicianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(wordIpa(m[1]));
            else if (m[2])
                sink.emit(
                    numberTokenToWords(m[2]).split(" ").map(wordIpa).join(" "),
                );
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Galician phonemizer (no data files beyond the manifest — the engine is fully rule-based). */
export function createGalician(): Phonemizer {
    return new GalicianPhonemizer();
}
