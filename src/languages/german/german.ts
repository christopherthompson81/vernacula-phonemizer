/**
 * German (de) phonemizer — Standard German, canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) with
 * mostly-Germanic stress: the first syllable, or the first syllable after an unstressed prefix (be-/ge-/ver-…);
 * a stress lexicon (stress.tsv, from kaikki) overrides loanwords/exceptions. text() tokenizes words / numbers /
 * punctuation. See docs/de_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { decompose, PREFIX_IPA, SUFFIX_IPA } from "./morphology.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Stress dictionary: word → 0-based ordinal of the stressed syllable nucleus (loanwords / exceptions).
let STRESS: Map<string, number> | undefined;
function stressDict(): Map<string, number> {
    if (STRESS === undefined)
        STRESS = loadTsvMap(import.meta.url, "stress.tsv", Number, {
            optional: true,
        });
    return STRESS;
}

/** Rule stress for a word the morphology kept WHOLE (a single root) — the first syllable. Real prefixes are
 *  extracted by decompose() upstream, so no prefix guessing is needed here. */
function ruleStress(): number {
    return 0;
}

// Stressed-vowel length corrections (word → L long / S short) where the spelling rule mispredicts. From kaikki.
let LENGTH: Map<string, string> | undefined;
function lengthDict(): Map<string, string> {
    if (LENGTH === undefined)
        LENGTH = loadTsvMap(import.meta.url, "length.tsv", undefined, {
            optional: true,
        });
    return LENGTH;
}
// Unstressed e→ə reductions (word → nucleus ordinals to schwa) — lexical (native ə vs loanword ɛ), from kaikki.
let REDUCTION: Map<string, string> | undefined;
function reductionDict(): Map<string, string> {
    if (REDUCTION === undefined)
        REDUCTION = loadTsvMap(import.meta.url, "reduction.tsv", undefined, {
            optional: true,
        });
    return REDUCTION;
}
const LONG_OF = MANIFEST.vowels.longOf;
const SHORT_OF = MANIFEST.vowels.shortOf;
const VOWEL_CHARS = MANIFEST.vowelChars;

/** Fix vowel length+quality per a positional correction spec ("0S,2L" = nucleus 0 short, 2 long). Walks the
 *  IPA, counting syllable nuclei (a vowel not followed by an offglide ̯), applying the flag at each ordinal. */
function applyLength(ipa: string, spec: string | undefined): string {
    if (!spec) return ipa;
    const corr = new Map<number, string>();
    for (const c of spec.split(","))
        if (c) corr.set(Number(c.slice(0, -1)), c.slice(-1));
    let out = "",
        ord = 0,
        i = 0;
    while (i < ipa.length) {
        const ch = ipa[i]!;
        if (!VOWEL_CHARS.includes(ch)) {
            out += ch;
            i++;
            continue;
        }
        if ((ipa[i + 1] ?? "") === "̯") {
            out += ch;
            i++;
            continue;
        } // offglide, not a nucleus
        const long = (ipa[i + 1] ?? "") === "ː";
        // a TRUE diphthong (vowel + ɪ̯/ʊ̯/ʏ̯ glide) has no length axis; a vowel + ɐ̯ (vocalized r) still can (eːɐ̯).
        const diphthong =
            "ɪʊʏ".includes(ipa[i + 1] ?? "") && (ipa[i + 2] ?? "") === "̯";
        const flag = corr.get(ord);
        if (!diphthong && flag === "L" && !long) {
            out += LONG_OF[ch] ?? ch;
            i++;
        } else if (!diphthong && flag === "S" && long) {
            out += SHORT_OF[ch] ?? ch;
            i += 2;
        } else {
            out += long ? ch + "ː" : ch;
            i += long ? 2 : 1;
        }
        ord++;
    }
    return out;
}

/** Reduce the flagged unstressed nuclei to ə ("1,3" = nuclei 1 and 3). German unstressed ⟨e⟩ → [ə] is LEXICAL
 *  (native ə vs loanword ɛ), so the positions come from a kaikki-derived lexicon, not a rule. Never touches the
 *  stressed nucleus (guarded by the preceding ˈ). Runs after applyLength (schwa has no length axis). */
function applyReduction(ipa: string, spec: string | undefined): string {
    if (!spec) return ipa;
    const red = new Set(spec.split(",").map(Number));
    let out = "",
        ord = 0,
        i = 0;
    while (i < ipa.length) {
        const ch = ipa[i]!;
        if (!VOWEL_CHARS.includes(ch)) {
            out += ch;
            i++;
            continue;
        }
        if ((ipa[i + 1] ?? "") === "̯") {
            out += ch;
            i++;
            continue;
        } // offglide, not a nucleus
        const long = (ipa[i + 1] ?? "") === "ː";
        if (red.has(ord) && !out.endsWith("ˈ")) {
            out += "ə"; // reduce (drop length); never the stressed vowel
            i += long ? 2 : 1;
        } else {
            out += long ? ch + "ː" : ch;
            i += long ? 2 : 1;
        }
        ord++;
    }
    return out;
}

const VOWEL_G = /[aɐeɛiɪoɔuʊøœyʏə]/g;

/** Count syllable nuclei (vowels, skipping non-syllabic offglides ̯) in an IPA string. */
function countNuclei(ipa: string): number {
    let n = 0;
    for (const m of ipa.matchAll(VOWEL_G))
        if ((ipa[m.index + 1] ?? "") !== "̯") n++;
    return n;
}

/** Insert ˈ before the ordinal-th nucleus of an IPA string (skipping non-syllabic offglides ̯). */
function placeStress(ipa: string, ordinal: number): string {
    let n = 0;
    for (const m of ipa.matchAll(VOWEL_G)) {
        if ((ipa[m.index + 1] ?? "") === "̯") continue; // offglide, not a nucleus
        if (n === ordinal)
            return ipa.slice(0, m.index) + "ˈ" + ipa.slice(m.index);
        n++;
    }
    return ipa;
}

/** One German word → canonical IPA. Words that decompose into ≥2 morphemes are composed morpheme-by-morpheme,
 *  so each stem is element-initial (sp/st→ʃ), devoices at its own boundary, and doesn't assimilate across it. */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    const d = decompose(w);
    // Vowel-initial suffixes resyllabify onto the stem (lieb+en → lie-ben, häus+er → häu-ser): NO boundary, NO
    // devoicing. Merge them back into the preceding stem so it is g2p'd together; consonant-initial suffixes
    // (lich, keit, chen…) keep their boundary (freund+lich → freunt-lich).
    const VINIT_SUFFIX = new Set(MANIFEST.morphology.vowelInitialSuffixes);
    const merged: { text: string; kind: string }[] = [];
    for (let i = 0; i < d.parts.length; i++) {
        const p = d.parts[i]!,
            k = d.kinds[i]!;
        const last = merged[merged.length - 1];
        if (k === "suffix" && VINIT_SUFFIX.has(p) && last?.kind === "stem")
            last.text += p;
        else merged.push({ text: p, kind: k });
    }
    if (merged.length > 1) {
        const pieces = merged.map((m) => {
            if (m.kind === "prefix" && PREFIX_IPA[m.text])
                return PREFIX_IPA[m.text]!;
            if (m.kind === "suffix" && SUFFIX_IPA[m.text])
                return SUFFIX_IPA[m.text]!;
            return toSegments(m.text)
                .map((s) => s.ph)
                .join(""); // stem: element-initial g2p (i===0 inside)
        });
        const full = pieces.join("");
        // stress: the kaikki lexicon ordinal if known, else the morphology stress part's first vowel.
        const dictOrd = stressDict().get(w);
        const ord =
            dictOrd ?? countNuclei(pieces.slice(0, d.stressPart).join(""));
        return applyReduction(applyLength(placeStress(full, ord), lengthDict().get(w)), reductionDict().get(w));
    }

    const segs = toSegments(w);
    const vowelIdx = segs
        .map((s, i) => (s.vowel ? i : -1))
        .filter((i) => i >= 0);
    if (vowelIdx.length === 0) return segs.map((s) => s.ph).join("");
    const dictOrd = stressDict().get(w);
    const ord = dictOrd ?? ruleStress();
    const stressPos = vowelIdx[Math.min(ord, vowelIdx.length - 1)]!;

    // An undecomposed be-/ge-/ver-… word whose DICTIONARY stress isn't on the first syllable has a real unstressed
    // prefix (bestimmt ord 1 → bə), whereas a be-/ge- ROOT is dict-stressed on the first (beiden ord 0 → no ə).
    if (dictOrd !== undefined && ord > 0) {
        const first = segs[vowelIdx[0]!]!;
        if (w.startsWith("be") || w.startsWith("ge")) first.ph = "ə";
        else if (/^(ver|zer|ent|emp|er)/.test(w)) first.ph = "ɛ";
    }

    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressPos && vowelIdx.length > 1) out += "ˈ";
        out += segs[i]!.ph;
    }
    return applyReduction(applyLength(out, lengthDict().get(w)), reductionDict().get(w));
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([a-zäöüßA-ZÄÖÜ]+)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/gu;

class GermanPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(/[.,]/);
                for (const wd of numberToWords(Number(intPart)).split(" "))
                    sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord("Komma"));
                    for (const d of frac)
                        for (const wd of numberToWords(Number(d)).split(" "))
                            sink.emit(phonemizeWord(wd));
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the German phonemizer (rule g2p + stress rules + a loanword stress lexicon). */
export function createGerman(): Phonemizer {
    return new GermanPhonemizer();
}
