/**
 * Swedish (sv) phonemizer — Central Standard Swedish (rikssvenska), canonical IPA, espeak-independent. Rule-based
 * g2p (g2p.ts) + the NST accent/stress lexicon: tonal word accent 1/2 (accent-2 = combining grave on the
 * primary-stressed vowel) + non-initial stress, falling to first-syllable stress + shape-based accent for OOV
 * words + NST secondary stress for compounds (ˌ + boundary-safe vowel length/quality + 2nd-onset softening). A
 * small exception map covers irregular function words. text() tokenizes words / numbers / punctuation. Accent
 * validated at ~96% vs the independent wikipron ¹/² markers (tools/eval/sv-accent-eval.mts). See docs/investigations/sv_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { toSegments, type Compound } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const EXCEPTIONS = MANIFEST.exceptions;
const GRAVE = "̀"; // combining grave = the accent-2 mark, placed on the primary-stressed vowel

interface LexEntry {
    accent: string;
    ord?: number;
    oLong?: boolean; // stressed ⟨o⟩ is long [oː], not the default [uː]
    secOrd?: number; // secondary-stress nucleus (compound) → ˌ + secondary softening
    longOrds?: Set<number>; // NST-long vowel ordinals (compound length, boundary-safe)
    secVowelInitial?: boolean; // secondary element vowel-initial → don't soften the (coda) C before it
}

// Phase-2 lexicon (accent-stress.tsv, from the CC0 NST leksikon): word → pitch accent 1|2 + the primary-stress
// nucleus ordinal where it deviates from the first syllable. OOV words fall to the rule (first-syllable stress;
// accent by the swedishAccentRule). See tools/gen/build-sv-lexicon.mts + docs/investigations/sv_bringup_investigation.md.
let LEXICON: Map<string, LexEntry> | undefined;
function lexicon(): Map<string, LexEntry> {
    if (LEXICON === undefined)
        LEXICON = loadTsvMap(
            import.meta.url,
            "accent-stress.tsv",
            (rest) => {
                // tokens after accent: a number = stress ordinal, "o" = stressed-o-is-long, "s<N>" = secondary-stress
                // nucleus (compound), "L<ords>" = comma-sep NST-long vowel ordinals.
                const [accent, ...tokens] = rest.split("\t");
                const ordTok = tokens.find((t) => /^\d+$/.test(t));
                const secTok = tokens.find((t) => /^s\d+$/.test(t));
                const longTok = tokens.find((t) => /^L[\d,]+$/.test(t));
                return {
                    accent: accent!,
                    ord: ordTok ? Number(ordTok) : undefined,
                    oLong: tokens.includes("o"),
                    secOrd: secTok ? Number(secTok.slice(1)) : undefined,
                    longOrds: longTok
                        ? new Set(longTok.slice(1).split(",").map(Number))
                        : undefined,
                    secVowelInitial: tokens.includes("vi"),
                };
            },
            { optional: true },
        );
    return LEXICON;
}

/** Pitch accent for an OOV word from its shape (mirrors the NST rule): a monosyllable, or a polysyllable whose
 *  stress is NOT initial, is accent 1; a polysyllable with initial stress is accent 2 (the native default). */
function oovAccent(nuclei: number, stressOrd: number): string {
    return nuclei > 1 && stressOrd === 0 ? "2" : "1";
}

/** One Swedish word → canonical IPA. Stress ordinal + pitch accent come from the NST lexicon (falling to the
 *  rules for OOV words); the accent-2 grave marks the primary-stressed vowel. Monosyllables carry no ˈ / accent
 *  (per repo convention — no second syllable to host the contrast). Irregular function words are verbatim. */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase().normalize("NFC"); // robust to decomposed ö/ä/å input
    const exc = EXCEPTIONS[w];
    if (exc !== undefined) return exc;

    const lex = lexicon().get(w);
    const rawOrd = lex?.ord ?? 0;
    const oLong = lex?.oLong ?? false;
    // Compound prosody (NST secondary stress): a valid secondary nucleus distinct from the primary → drive length
    // from the NST-long set + a ˌ mark + secondary-onset softening. Absent → simplex rule.
    const nucleiProbe = toSegments(w, rawOrd, oLong).filter((s) => s.vowel).length;
    const compound: Compound | undefined =
        lex?.secOrd !== undefined &&
        lex.secOrd !== rawOrd &&
        lex.secOrd < nucleiProbe
            ? {
                  secOrd: lex.secOrd,
                  longOrds: lex.longOrds ?? new Set(),
                  secVowelInitial: lex.secVowelInitial,
              }
            : undefined;
    let segs = toSegments(w, rawOrd, oLong, compound);
    const nuclei = segs.filter((s) => s.vowel).length;
    if (nuclei === 0) return segs.map((s) => s.ph).join("");

    const ord = Math.min(rawOrd, nuclei - 1);
    if (ord !== rawOrd) segs = toSegments(w, ord, oLong, compound); // clamp: length must land on a real nucleus
    const accent = lex?.accent ?? oovAccent(nuclei, ord);

    let out = "",
        seen = 0;
    for (const s of segs) {
        if (s.vowel) {
            if (seen === ord && nuclei > 1) {
                out += "ˈ";
                out += accent === "2" ? s.ph[0]! + GRAVE + s.ph.slice(1) : s.ph;
            } else if (compound && seen === compound.secOrd) {
                out += "ˌ"; // secondary stress (compound element)
                out += s.ph;
            } else out += s.ph;
            seen++;
        } else out += s.ph;
    }
    return out.normalize("NFC"); // deterministic form for the accent-2 grave (u◌̀ → ù)
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([a-zåäöéA-ZÅÄÖÉ]+)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/gu;

// #562 symbol normalization — Swedish (procent/kilometer/dollar are invariant plurals).
const SYMBOLS = makeSymbolNormalizer({
    percent: ["procent"],
    currency: { "€": ["euro"], "$": ["dollar"], "£": ["pund"] },
    units: { km: ["kilometer"], cm: ["centimeter"], mm: ["millimeter"], kg: ["kilogram"] },
    magnitudes: ["miljoner", "miljon", "miljarder", "miljard"],
});

class SwedishPhonemizer implements Phonemizer {
    text(input: string): string {
        // NFC first so decomposed å/ä/ö/é tokenize as single letters (the TOKEN class matches only precomposed).
        return assembleClauses(SYMBOLS(input).normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(/[.,]/);
                for (const wd of numberToWords(Number(intPart)).split(" ")) sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord("komma"));
                    for (const d of frac)
                        for (const wd of numberToWords(Number(d)).split(" ")) sink.emit(phonemizeWord(wd));
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Swedish phonemizer (rule g2p + first-syllable stress + a function-word exception map). */
export function createSwedish(): Phonemizer {
    return new SwedishPhonemizer();
}
