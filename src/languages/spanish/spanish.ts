/**
 * Spanish (es) phonemizer — canonical IPA, broad Castilian. Rule-based g2p (g2p.ts) +
 * spirantization + rule-based stress; no lexicon. text() tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeSpanish, normalizeSpanishInitialisms } from "./normalize.ts";

const NASALS = new Set(MANIFEST.nasals);
const STOP_TO_FRIC = MANIFEST.spirantize;
const FINAL_VOWEL = /[aeiouáéíóú]$/i;

/** b/d/ɡ → β/ð/ɣ except utterance-initial, after a nasal, or d after l. (Nasal place assimilation n→ŋ is
 *  narrow allophony left broad here — like the folded e→ɛ laxing — matching the broad referees.) */
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
 * see past one. Its own comment says "except utterance-initial", but the code it describes tests
 * `i === 0`, which is WORD-initial, because a per-word function has no other context. So `nada` came
 * out `nˈaða` while `la duda` came out `la dˈuða` — the identical environment, one word later, read
 * two different ways. Measured against the FLEURS es_419 audio, our `d` is heard as [ð] in 2,278
 * aligned positions, 60% of them after a vowel and 30% after `s`.
 *
 * That INTERNAL INCONSISTENCY is the defect. The engine has already committed to marking allophony;
 * applying it in one environment and not the same environment across a space is what has to be fixed.
 *
 * The rule is the same one `spirantize()` states: keep the STOP utterance-initially, after a nasal,
 * and for `d` after `l`; spirantize otherwise. Here "utterance-initially" means after a pause mark or
 * at the start, which is exactly the context the assembled clause string makes visible.
 */
const CROSS_WORD_STOP = /([^\s])(\s+)([bdɡ])/gu;

function spirantizeAcrossWords(ipa: string): string {
    return ipa.replace(CROSS_WORD_STOP, (m, prev: string, gap: string, stop: string) => {
        if (NASALS.has(prev)) return m;                    // un dato, con base
        if (stop === "ɡ" && prev === "n") return m;        // (covered above, kept explicit)
        if (stop === "d" && prev === "l") return m;        // el dato
        if (!/[\p{L}\p{M}ˈˌ]/u.test(prev)) return m;       // after a pause mark = utterance-initial
        return prev + gap + (STOP_TO_FRIC[stop] ?? stop);
    });
}

/** Index of the stressed nucleus: the written accent, else penultimate (word ends vowel/n/s) or final. */
function stressedNucleus(word: string, segs: Seg[]): number {
    const nuclei = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return -1;
    const accented = nuclei.find((i) => segs[i]!.accent);
    if (accented !== undefined) return accented;
    if (nuclei.length === 1) return nuclei[0]!;
    const w = word.toLowerCase(); // n/s test must be case-insensitive (EXAMEN, CRISIS)
    const last = w[w.length - 1] ?? "";
    const penult = FINAL_VOWEL.test(w) || last === "n" || last === "s";
    return penult ? nuclei[nuclei.length - 2]! : nuclei[nuclei.length - 1]!;
}

/** Phonemize a single Spanish word to canonical IPA (with a stress mark). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    spirantize(segs);
    const stress = stressedNucleus(word, segs);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation; // ¿¡ openers are silent → absent from the map
// A word / number / clause-punctuation token. Numbers use the Spanish convention: dot = thousands separator
// (1.500), comma = decimal (3,14). Each dot/comma must be followed by digits, so a clause-final "." or ","
// glued to a number falls through to the punctuation branch. Spanish letters incl. accents + ñ/ü.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+(?:\\.\\d+)*(?:,\\d+)?)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-záéíóúüñ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

/** A number token (with Spanish thousands-dots / decimal-comma) → spoken words. */
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
// running text (DATA: spanish.jsonc). Accented counterparts (sí, tú, mí, más) keep their accent and stay stressed.
const FUNCTION_WORDS = new Set(MANIFEST.functionWords);

/** Phonemize one running-text word, de-accenting unstressed function words (y → i, de → de). */
function wordIpa(word: string): string {
    const ipa = phonemizeWord(word);
    return FUNCTION_WORDS.has(word.toLowerCase()) ? ipa.replace("ˈ", "") : ipa;
}

// symbol normalization — Spanish (shared by es and es-419; the words are variety-neutral).
const SYMBOLS = makeSymbolNormalizer({
    // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `y` ×1141 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
    // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
    // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
    // One word, so `by` defaults to it; this language does not split dimension from product.
    multiply: { times: "por" },
    ampersand: "y",
    percent: ["por ciento"],
    currency: { "€": ["euro", "euros"], "$": ["dólar", "dólares"], "£": ["libra", "libras"], "¥": ["yen", "yenes"] },
    // Longest keys match first (the builder sorts by length), so km/h beats km and °c beats c.
    units: { "km/h": ["kilómetro por hora", "kilómetros por hora"], "m/s": ["metro por segundo", "metros por segundo"],
        "°c": ["grado Celsius", "grados Celsius"], "°f": ["grado Fahrenheit", "grados Fahrenheit"],
        "°": ["grado", "grados"],
        m: ["metro", "metros"], // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
        // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
        // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
        l: ["litro", "litros"], L: ["litro", "litros"], ml: ["mililitro", "mililitros"],
        g: ["gramo", "gramos"], t: ["tonelada", "toneladas"], ha: ["hectárea", "hectáreas"],
        // ⚠ SI CASE: ⟨kW⟩ ⟨W⟩ ⟨Hz⟩ are capitalised because watt and hertz are named after people. Declared
        // exactly so, since #763 resolves a one-letter symbol case-SENSITIVELY — a lower-case ⟨w⟩ is not a
        // unit. The multi-letter ones still fold, so ⟨kw⟩/⟨KW⟩/⟨hz⟩ in shouty or sloppy text still read.
        kW: ["kilovatio", "kilovatios"], W: ["vatio", "vatios"], Hz: ["hercio", "hercios"],
        gb: ["gigabyte", "gigabytes"], mb: ["megabyte", "megabytes"],
        km: ["kilómetro", "kilómetros"], cm: ["centímetro", "centímetros"], mm: ["milímetro", "milímetros"],
        kg: ["kilogramo", "kilogramos"], mg: ["miligramo", "miligramos"] },
    exponentWords: { squared: ["cuadrado", "cuadrados"], cubed: ["cúbico", "cúbicos"] },
    // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
    // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
    // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
    // they are different words (kilómetros cuadrados but veinte al cuadrado).
    // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
    // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
    // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
    // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
    // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
    // The cardinal is used for the generic power, never the ordinal — see core for that argument.
    bareExponent: { squared: "{n} al cuadrado", cubed: "{n} al cubo", power: "{n} elevado a {e}" , negative: "menos" },
    magnitudes: ["millones", "millón"],
    magnitudeConnective: "de", // cinco millones DE dólares
});

class SpanishPhonemizer implements Phonemizer {
    constructor(private readonly americas = false) {}

    text(input: string): string {
        // normalization order: general text normalization (abbreviations, era markers, ordinal
        // indicators, times, dates) → INITIALISMS → SYMBOLS (%, currency, units) last, since the time rule
        // upstream has already claimed the hour. Roman numerals need no ordering care here: `es` is not in
        // the registry's ROMAN_NATIVE set, so the shared pass has already converted them before text().
        const normalized = SYMBOLS(normalizeSpanishInitialisms(normalizeSpanish(input, { americas: this.americas })));
        return spirantizeAcrossWords(assembleClauses(normalized, TOKEN, (m, sink) => {
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

/** Build the Spanish phonemizer (no data files — the engine is fully rule-based). */
/** `americas` selects Latin-American usage in the normalization layer — currently just the first of the
 *  month, an ordinal in America and a cardinal in Spain. es-419 passes it; `es` (Castilian) does not. */
export function createSpanish(americas = false): Phonemizer {
    return new SpanishPhonemizer(americas);
}
