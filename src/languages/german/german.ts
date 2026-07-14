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
// Unstressed vowel QUALITY corrections (word → ordinal+target,…) — lexical (native reduces/keeps-lax vs loanword
// keeps-tense), from kaikki. Subsumes the earlier e→ə reduction lexicon with lax→tense targets (ɪ→i, ɔ→o, …).
let QUALITY: Map<string, string> | undefined;
function qualityDict(): Map<string, string> {
    if (QUALITY === undefined)
        QUALITY = loadTsvMap(import.meta.url, "quality.tsv", undefined, {
            optional: true,
        });
    return QUALITY;
}
// Loanword CONSONANT corrections (word → cons-ordinal+target,…) — lexical native-vs-loan splits (v→f/f→v,
// s→z/z→s, x→ç/k, ŋ→n), from kaikki. Companion to the vowel quality lexicon.
let CONSONANT: Map<string, string> | undefined;
function consonantDict(): Map<string, string> {
    if (CONSONANT === undefined)
        CONSONANT = loadTsvMap(import.meta.url, "consonant.tsv", undefined, {
            optional: true,
        });
    return CONSONANT;
}
// Ɛ = the g2p's internal marker for short ⟨ä⟩ (see g2p.ts): it lengthens to ɛː (not the eː that ⟨e⟩'s ɛ gives),
// and applyLength normalises any surviving Ɛ back to plain ɛ. It must count as a vowel nucleus everywhere upstream.
const LONG_OF: Record<string, string> = { ...MANIFEST.vowels.longOf, "Ɛ": "ɛː" };
const SHORT_OF = MANIFEST.vowels.shortOf;
const VOWEL_CHARS = MANIFEST.vowelChars + "Ɛ";

/** Fix vowel length+quality per a positional correction spec ("0S,2L" = nucleus 0 short, 2 long). Walks the
 *  IPA, counting syllable nuclei (a vowel not followed by an offglide ̯), applying the flag at each ordinal. */
function applyLength(ipa: string, spec: string | undefined): string {
    if (!spec) return ipa.replace(/Ɛ/gu, "ɛ"); // no length flag: a short-ä marker just normalises to ɛ (hätte)
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
    return out.replace(/Ɛ/gu, "ɛ"); // normalise any short-ä marker that wasn't lengthened (ɛː done above)
}

/** Set the flagged UNSTRESSED nuclei to their kaikki quality ("1ə,2i" = nucleus 1 → ə, nucleus 2 → i). German
 *  unstressed vowel quality is LEXICAL (native reduce/lax vs loanword tense), so the targets come from a
 *  kaikki-derived lexicon, not a rule. Never touches the stressed nucleus (guarded by the preceding ˈ). Runs
 *  after applyLength (the target quality drops any length). */
function applyQuality(ipa: string, spec: string | undefined): string {
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
        const t = corr.get(ord);
        if (t !== undefined && !/[ˈˌ]$/.test(out)) {
            out += t; // set the kaikki quality (drops length); never the stressed vowel
            i += long ? 2 : 1;
        } else {
            out += long ? ch + "ː" : ch;
            i += long ? 2 : 1;
        }
        ord++;
    }
    return out;
}

/** Set flagged CONSONANT positions to their kaikki (loanword) value ("0v,3s"). A "consonant" is a char that is
 *  not a vowel / stress-boundary / length / combining mark (must match the build's counting). Lexical
 *  native-vs-loan splits (November → …v…, Safe → s…), from a kaikki-derived lexicon. */
function applyConsonant(ipa: string, spec: string | undefined): string {
    if (!spec) return ipa;
    const corr = new Map<number, string>();
    for (const c of spec.split(","))
        if (c) corr.set(Number(c.slice(0, -1)), c.slice(-1));
    let out = "", ci = 0;
    for (const ch of ipa) {
        if (!VOWEL_CHARS.includes(ch) && !"ˈˌʔ()ː̯̩̥͡".includes(ch)) {
            out += corr.get(ci) ?? ch;
            ci++;
        } else out += ch;
    }
    return out;
}

/** German has no stressed schwa: a ˈə/ˌə is the g2p weak-schwa rule ("final-syllable e → ə") mis-firing on what
 *  turned out to be the STRESSED root syllable (gesetz → the setz e; the g2p runs before stress and can't see it).
 *  Restore it to short ɛ — applyLength then lengthens to eː where the length lexicon flags that nucleus long
 *  (Problem → …bleːm, System → …teːm). Must run BEFORE applyLength. */
function fixStressedSchwa(ipa: string): string {
    return ipa.replace(/([ˈˌ])ə/gu, "$1ɛ");
}

/** A -ie/-ien suffix the g2p rendered i̯ə but that turned out to carry primary stress is a final-stressed loan
 *  (Melodie → melodˈiː, not …di̯ˈə): restore the stressed glide+schwa back to iː. Runs last (after stress). */
function restoreStressedIe(ipa: string): string {
    // the schwa is already ɛ here (fixStressedSchwa ran first on the stressed nucleus), so match either.
    return ipa.replace(/i̯([ˈˌ])[əɛ]/gu, "$1iː");
}

const VOWEL_G = /[aɐeɛiɪoɔuʊøœyʏəƐ]/g; // includes the short-ä marker Ɛ so stress/nucleus counts see it

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
        return restoreStressedIe(applyConsonant(applyQuality(applyLength(fixStressedSchwa(placeStress(full, ord)), lengthDict().get(w)), qualityDict().get(w)), consonantDict().get(w)));
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
    return restoreStressedIe(applyConsonant(applyQuality(applyLength(fixStressedSchwa(out), lengthDict().get(w)), qualityDict().get(w)), consonantDict().get(w)));
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
