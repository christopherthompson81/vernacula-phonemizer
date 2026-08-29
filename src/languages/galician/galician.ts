/**
 * Galician (gl) phonemizer — canonical IPA, galego. Rule-based g2p (g2p.ts) + nasal
 * velarization + spirantization + rule-based stress; no lexicon. text() tokenizes words / numbers / punctuation.
 * Galician shares the Ibero-Romance shape with Spanish; the deltas are ⟨x⟩/⟨j⟩→ʃ, ⟨g⟩→ɡ (no jota), ⟨nh⟩→ŋ,
 * and the coda/pre-velar ⟨n⟩→ŋ velarization applied here.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeGalician } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";
import { noteRewrite } from "../../core/trace.ts";

const NASALS = new Set(MANIFEST.nasals);
const STOP_TO_FRIC = MANIFEST.spirantize;
const VELARS = new Set(MANIFEST.velars);

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

/**
 * ⚠ SPIRANTIZATION IS POST-LEXICAL — it does not stop at the word edge, and `spirantize()` above cannot
 * see past one. Its `i === 0` guard is WORD-initial, because a per-word function has no other context,
 * so the identical environment read two different ways depending on which side of a space it fell:
 * word-internally spirantized, across a boundary not. That INTERNAL INCONSISTENCY is the defect — the
 * engine has already committed to marking allophony.
 *
 * Measured for Spanish against the FLEURS audio, where the same fix moved 1,292 of 1,500 rows CLOSER
 * to the recogniser and 36 further (35.9:1), median skeleton distance 0.146 -> 0.103.
 *
 * "Utterance-initial" here means after a pause mark or at the start — which is exactly what the
 * assembled clause string makes visible.
 */
const CROSS_WORD_STOP = /([^\s])(\s+)([bdɡ])/gu;

function spirantizeAcrossWords(ipa: string): string {
    // ⚠ REPORTED TO THE TRACE (#1150): runs on the ASSEMBLED string, so a token's `emitted` reading is not
    // what ships. Without the event the discrepancy has no cause attached.
    const out = spirantizeAcrossWordsCore(ipa);
    noteRewrite("spirantize-across-words", ipa, out, true);
    return out;
}

function spirantizeAcrossWordsCore(ipa: string): string {
    return ipa.replace(CROSS_WORD_STOP, (m, prev: string, gap: string, stop: string) => {
        if (NASALS.has(prev)) return m;                   // nasal + stop stays occlusive
        if (stop === "d" && prev === "l") return m;       // homorganic: only /d/ after /l/
        if (!/[\p{L}\p{M}ˈˌ]/u.test(prev)) return m;      // after a pause = utterance-initial
        return prev + gap + (STOP_TO_FRIC[stop] ?? stop);
    });
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
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+(?:(?<!(?<!\\d)0)\\.\\d+)*(?:,\\d+)?)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-záéíóúüñ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

/** A number token (with thousands-dots / decimal-comma) → spoken words. */
function numberTokenToWords(tok: string): string {
    const [intRaw, frac] = tok.split(",");
    let words = numberToWords(Number(intRaw!.replace(/\./g, "")), intRaw!.replace(/\./g, ""));
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

/**
 * SYMBOL NORMALIZATION — Galician. Every word here is a gl.wikipedia TOKEN attestation whose examples were
 * read (see normalize.ts's header and docs/investigations/gl_normalization_investigation.md, run 2):
 *   `por cento` ×7 — the *Porcentaxe* article, "Tamén se lle chama comunmente tanto por cento"
 *   `euro` ×298 / `dólar` ×641 / `libras` ×41 / `ien` ×59 — the euro and ien articles NAME their sign
 *   `cadrado` ×219 / `cúbico` ×21 — "O metro cúbico é unha unidade de volume", "Quilómetro cúbico"
 *   `multiplicado por` ×10 — "dobre equivale a multiplicado por dous"; the bare `por` is the dimension idiom
 * `units` is excluded from the sourcing gate by design (kilogram and millimetre are absent from most
 * corpora and perfectly correct), but the corpus does write `110 g`, `4.500 kg`, `24 km`, `1540 m`,
 * `3.000 toneladas` and spells `quilómetros`, `metros`, `gramos`, `toneladas` out beside numbers.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["por cento"],
    currency: {
        "€": ["euro", "euros"], "$": ["dólar", "dólares"],
        "£": ["libra", "libras"], "¥": ["ien", "iens"],
    },
    units: {
        km: ["quilómetro", "quilómetros"], cm: ["centímetro", "centímetros"],
        mm: ["milímetro", "milímetros"], kg: ["quilogramo", "quilogramos"],
        t: ["tonelada", "toneladas"], g: ["gramo", "gramos"], l: ["litro", "litros"],
        ha: ["hectárea", "hectáreas"], h: ["hora", "horas"], s: ["segundo", "segundos"],
        m: ["metro", "metros"],
    },
    unitPer: "por", // 120 km/h → cento vinte quilómetros POR hora; the /h was dropped outright
    exponentWords: { squared: ["cadrado", "cadrados"], cubed: ["cúbico", "cúbicos"] },
    // A BARE power — `5²`, with no unit noun for the exponent to modify — was dropped outright.
    // ⚠ ONLY `squared` IS DECLARED, and the asymmetry is the evidence, not an oversight. `ao cadrado` is
    // ×13/5 and gl.wikipedia states the notation itself: "un número x ao cadrado represéntase x2", "escrito
    // como n², e equivale a n × n. A operación alxébrica de elevar ao cadrado un número n". Against that,
    // `ao cubo` scores **0** and `elevado a` scores ×1 whose single hit is "foi elevado a cardeal" — raised
    // to the rank, not to the power, i.e. a false attestation of exactly the shape this file's header
    // warns about. An undeclared power leaves the superscript where the RAWMARK gate can see it, which is
    // strictly better than inventing a reading for it.
    bareExponent: { squared: "{n} ao cadrado" },
    // `×` performs a product; an unspaced ASCII `x` between digits is the `4x4` dimension idiom, which
    // Galician says with the bare preposition. Declaring `multiply` is also what makes ASCII `x` reachable.
    multiply: { times: "multiplicado por", by: "por" },
    ampersand: "e", // the corpus's `&` are all bibliographic — "Thames & Hudson", "Bendor-Samuel & Hartell"
    magnitudes: ["millóns", "millón"],
    magnitudeConnective: "de", // cinco millóns DE dólares
});

class GalicianPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal, clock, era and range steps
        // need the number and its suffix still adjacent, which the tier would break; and the tier matches a
        // unit only when a NUMBER is adjacent, which is why the degree and clock rules run before it.
        return spirantizeAcrossWords(assembleClauses(SYMBOLS(normalizeGalician(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(wordIpa(nat(m[1])));
            else if (m[2])
                sink.emit(
                    numberTokenToWords(m[2]).split(" ").map(wordIpa).join(" "),
                );
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        }));
    }
}

/** Build the Galician phonemizer (no data files beyond the manifest — the engine is fully rule-based). */
export function createGalician(): Phonemizer {
    return new GalicianPhonemizer();
}
