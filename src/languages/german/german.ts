/**
 * German (de) phonemizer — Standard German, canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) with
 * mostly-Germanic stress: the first syllable, or the first syllable after an unstressed prefix (be-/ge-/ver-…);
 * a stress lexicon (stress.tsv, from kaikki) overrides loanwords/exceptions. text() tokenizes words / numbers /
 * punctuation. See docs/investigations/de_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { decompose, PREFIX_IPA, SUFFIX_IPA } from "./morphology.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeGerman, normalizeGermanInitialisms } from "./normalize.ts";
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
// Loanword -er RESTORATION (word → nucleus-ordinal,…) — the unstressed ⟨er⟩ that stays the full ɛʁ in loans
// (universal → univɛʁzaːl) instead of our native reduction ɐ; from kaikki. Can't live in the vowel/consonant
// lexicons — it INSERTS a consonant (ɐ → ɛ + ʁ). Applied as a post-pass (after applyConsonant, so ordinals hold).
let ER: Map<string, string> | undefined;
function erDict(): Map<string, string> {
    if (ER === undefined)
        ER = loadTsvMap(import.meta.url, "er.tsv", undefined, { optional: true });
    return ER;
}
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
    for (let i = 0; i < ipa.length; i++) {
        const ch = ipa[i]!;
        // a vocalised coda-r ɐ̯ holds ONE consonant slot (matches the build's counting) but is never corrected.
        if (ch === "ɐ" && ipa[i + 1] === "̯") {
            out += (corr.get(ci) ?? "ɐ̯");
            ci++;
            i++; // consume the ̯
            continue;
        }
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

/** Restore an UNSTRESSED reduced -er (bare ɐ) to the full loanword ɛʁ at the kaikki-flagged nuclei (universal →
 *  univɛʁzaːl). Post-pass — runs after applyConsonant so the inserted ʁ doesn't shift consonant ordinals. The
 *  stressed case is the restoreStressedEr rule; this is the lexical unstressed native(ɐ)-vs-loan(ɛʁ) split. */
function applyErRestore(ipa: string, spec: string | undefined): string {
    if (!spec) return ipa;
    const corr = new Set(spec.split(",").map(Number));
    let out = "", ord = 0, i = 0;
    while (i < ipa.length) {
        const ch = ipa[i]!;
        if (!VOWEL_CHARS.includes(ch) || (ipa[i + 1] ?? "") === "̯") {
            out += ch; // consonant, or an offglide (incl. ɐ̯) which is not a nucleus
            i++;
            continue;
        }
        if (corr.has(ord) && ch === "ɐ") {
            out += "ɛʁ";
            i++;
        } else {
            const long = (ipa[i + 1] ?? "") === "ː";
            out += long ? ch + "ː" : ch;
            i += long ? 2 : 1;
        }
        ord++;
    }
    return out;
}

/** A STRESSED bare ɐ is always a wrongly-reduced -er: our g2p reduces ⟨er⟩+C to ɐ (correct for the unstressed
 *  ending, Wasser → vasɐ), but that nucleus can never legitimately carry stress — a stressed -er is the full ɛʁ
 *  (Laterne → latɛʁnə, Inferno → ɪnfɛʁno, modern → modɛʁn). Restore ˈɐ/ˌɐ (not the ɐ̯ offglide) to ɛʁ. Runs last. */
function restoreStressedEr(ipa: string): string {
    return ipa.replace(/([ˈˌ])ɐ(?!̯)/gu, "$1ɛʁ");
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

/** Compose an OOV compound morpheme-by-morpheme, each stem corrected by its OWN morpheme-keyed dict entry with LOCAL
 *  ordinals — so the length/quality/consonant/er corrections generalize to compounds ABSENT from the whole-word dicts
 *  (Kanzler, Haus, freundlich… are standalone kaikki entries even when the whole compound is not). Re-normalised to a
 *  single primary stress at the stress-part morpheme. Holdout-measured +7.7pp vs the no-correction fallback on OOV
 *  compounds (docs/investigations/de_morpheme_keyed_investigation.md). */
function composeMorphemeKeyed(merged: { text: string; kind: string }[], stressPart: number): string {
    const pieces = merged.map((m) => {
        if (m.kind === "prefix" && PREFIX_IPA[m.text]) return PREFIX_IPA[m.text]!;
        if (m.kind === "suffix" && SUFFIX_IPA[m.text]) return SUFFIX_IPA[m.text]!;
        return phonemizeWord(m.text); // recurse: each stem gets the FULL pipeline (its own dicts + prefix reduction)
    });
    // Collapse the per-morpheme stress marks to ONE primary at the stress-part morpheme (German emits a single ˈ).
    const sp = Math.min(stressPart, pieces.length - 1);
    const before = pieces.slice(0, sp).join("").replace(/[ˈˌ]/gu, "");
    const spPiece = pieces[sp] ?? "";
    const markIdx = spPiece.search(/[ˈˌ]/u);
    const localOrd = markIdx < 0 ? 0 : countNuclei(spPiece.slice(0, markIdx));
    return placeStress(pieces.join("").replace(/[ˈˌ]/gu, ""), countNuclei(before) + localOrd);
}

// ── Exposed for the morpheme-keyed experiment (docs/investigations/de_morpheme_keyed_investigation.md). These are
// the whole-word correction stages + dict accessors; the experiment re-applies them keyed per MORPHEME. ──
export const _internal = {
    stressDict, lengthDict, qualityDict, consonantDict, erDict,
    applyLength, applyQuality, applyConsonant, applyErRestore,
    fixStressedSchwa, restoreStressedIe, restoreStressedEr, placeStress, countNuclei,
    composeMorphemeKeyed,
};

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
        // HYBRID: a word with ANY whole-word correction (in-kaikki) uses its exact whole-word entry (unchanged); an
        // OOV compound — absent from every dict — falls back to MORPHEME-KEYED corrections that compose per stem
        // (see de_morpheme_keyed_investigation.md). Known words are byte-identical; only novel compounds change.
        const known = stressDict().has(w) || lengthDict().has(w) || qualityDict().has(w) || consonantDict().has(w) || erDict().has(w);
        if (!known) return composeMorphemeKeyed(merged, d.stressPart);
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
        return restoreStressedEr(restoreStressedIe(applyConsonant(applyErRestore(applyQuality(applyLength(fixStressedSchwa(placeStress(full, ord)), lengthDict().get(w)), qualityDict().get(w)), erDict().get(w)), consonantDict().get(w))));
    }

    const segs = toSegments(w);
    const vowelIdx = segs
        .map((s, i) => (s.vowel ? i : -1))
        .filter((i) => i >= 0);
    if (vowelIdx.length === 0) return segs.map((s) => s.ph).join("");
    // Dict stress, extended to INFLECTED forms: the 68k dict stores lemmas, so bedeutet/genutzten/behörden
    // missed while bedeuten/genutzt/behörde carry the answer. Suffix stripping cannot shift the ordinal —
    // an inflectional ending never adds a nucleus BEFORE the stress. This also protects roots: beiden finds
    // beide (ord 0) and stays unreduced.
    const dictOrd = stressDict().get(w) ?? inflectedStressOrd(w);
    // Dict-missing prefix fallback (gegangen, gebracht — ablaut participles have no lemma the stripper can
    // reach): a word STARTING with an unstressed prefix whose remainder looks like a stem (legal onset,
    // its own vowel) is read as prefix + stem. Safe because any common ROOT is in the 68k dict and roots
    // resolve above; this only fires on derived forms the dict has never seen.
    const prefixGuess = dictOrd === undefined && guessUnstressedPrefix(w);
    const ord = dictOrd ?? (prefixGuess ? 1 : ruleStress());
    const stressPos = vowelIdx[Math.min(ord, vowelIdx.length - 1)]!;

    // An undecomposed be-/ge-/ver-… word whose stress isn't on the first syllable has a real unstressed
    // prefix (bestimmt ord 1 → bə), whereas a be-/ge- ROOT is dict-stressed on the first (beiden ord 0 → no ə).
    if ((dictOrd !== undefined || prefixGuess) && ord > 0) {
        const first = segs[vowelIdx[0]!]!;
        if (w.startsWith("be") || w.startsWith("ge")) first.ph = "ə";
        else if (/^(ver|zer|ent|emp|er)/.test(w)) first.ph = "ɛ";
    }

    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressPos && vowelIdx.length > 1) out += "ˈ";
        out += segs[i]!.ph;
    }
    return restoreStressedEr(restoreStressedIe(applyConsonant(applyErRestore(applyQuality(applyLength(fixStressedSchwa(out), lengthDict().get(w)), qualityDict().get(w)), erDict().get(w)), consonantDict().get(w))));
}


// German inflectional endings, longest first. Stripping (and the -et→-en / -t→-en swaps) reaches the lemma
// the stress dict stores. The base must keep ≥3 letters so short roots don't dissolve.
const INFLECT = ["esten", "sten", "eten", "ten", "est", "en", "et", "em", "es", "er", "e", "n", "st", "t", "s"];
function inflectedStressOrd(w: string): number | undefined {
    const dict = stressDict();
    for (const suf of INFLECT) {
        if (!w.endsWith(suf) || w.length - suf.length < 3) continue;
        const base = w.slice(0, -suf.length);
        const hit = dict.get(base) ?? dict.get(base + "e") ?? dict.get(base + "en");
        if (hit !== undefined) return hit;
    }
    return undefined;
}

// The single-nucleus unstressed prefixes (their reduction targets are set in the caller). ver/zer/ent/emp
// before er, so er never shadows them. The remainder must be ≥4 letters, start with a LEGAL German onset
// (≤3 consonants then a vowel — rejects be+rlin-style accidents), and contain a vowel of its own.
const PREFIX_GUESS = /^(?:be|ge|ver|zer|ent|emp|er)(?=([a-zäöüß]{4,})$)/;
const LEGAL_ONSET = /^[bcdfghjklmnpqrstvwxzß]{0,3}[aeiouäöüy]/;
function guessUnstressedPrefix(w: string): boolean {
    const m = PREFIX_GUESS.exec(w);
    return m !== null && LEGAL_ONSET.test(m[1]!);
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// German groups thousands with a PERIOD and takes a COMMA decimal. The old class accepted either as a
// decimal, so "1.000" read as *eins komma null null null*. Times are claimed by normalize.ts first, so a
// dot reaching here is grouping.
const TOKEN = /([a-zäöüßA-ZÄÖÜ]+)|(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)|([.!?…,;:])/gu;

// #562 symbol normalization — German words (Prozent/Euro/Kilometer are invariant plurals).
const SYMBOLS = makeSymbolNormalizer({
    percent: ["Prozent"],
    currency: { "€": ["Euro"], "$": ["Dollar"], "£": ["Pfund"], "¥": ["Yen"] },
    // `m` — Meter ×6, and every digit-adjacent bare `m` in this corpus is a metre: `4892 m Höhe`,
    // `100 m und 200 m Freistil`, `133 m/s`. Without it `Kubik`/`Quadrat` below could not reach a bare
    // metre, so `5 m³` read as the raw letter while `5 km³` read correctly.
    units: { km: ["Kilometer"], cm: ["Zentimeter"], mm: ["Millimeter"], kg: ["Kilogramm"], mg: ["Milligramm"],
        m: ["Meter"] },
    // #586. `5 km²` read as *fʏnf km* — the abbreviation reaching the phoneme sink verbatim, the QUANTITY lost
    // and not merely its power, because an undeclared measure word made the tier abandon the whole match. The
    // core now emits the unit and hands the exponent back, so this became a VISIBLE `DROP:exponent` (de went
    // 3 → 6 drops while three sentences' units were repaired); this declaration is what closes it.
    // German FUSES the measure word onto the front, which is `compound`: corpus ×2
    // "2,2 Millionen Quadratkilometer Ozeanfläche", and Kubik ×2 for the cube.
    exponentWords: { squared: ["Quadrat"], cubed: ["Kubik"], position: "compound" },
    magnitudes: ["Millionen", "Million", "Milliarden", "Milliarde"],
});

class GermanPhonemizer implements Phonemizer {
    text(input: string): string {
        // #562 order: German rewrites (era, abbreviations, ORDINALS, clock, units) → INITIALISMS →
        // the shared symbol tier. The clock and the ordinals must precede the number tokenizer.
        const normalized = SYMBOLS(normalizeGermanInitialisms(normalizeGerman(input)));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                // The PERIOD is thousands grouping in German and the COMMA is the decimal point. Splitting
                // on either made "1.000" a decimal — *eins komma null null null*.
                const [intPart, frac] = m[2].replace(/\./gu, "").split(",");
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
