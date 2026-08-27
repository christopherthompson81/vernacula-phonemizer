/**
 * Latin (la) phonemizer — CLASSICAL Latin (Allen, *Vox Latina*), a context-sensitive grapheme scan over
 * macronized spelling, canonical IPA. This file owns the context rules: digraphs and diphthongs, the
 * ⟨i j⟩ glide/geminate-glide logic, hiatus tensing, dark/clear ⟨l⟩, ⟨n⟩→[ŋ], the word-final ⟨-Vm⟩
 * nasalization, and penult/antepenult weight stress. The vowel-quality and consonant tables and the
 * encyclopedic record live in latin.jsonc. Ecclesiastical Latin is deferred.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeLatin } from "./normalize.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";

interface LatinDef {
    short: Record<string, string>;
    long: Record<string, string>;
    tense: Record<string, string>;
    vowelLetters: readonly string[];
    velars: readonly string[];
    mutae: readonly string[];
    liquids: readonly string[];
    consonants: Record<string, string>;
}
const DEF = loadManifest<LatinDef>(import.meta.url, "latin.jsonc");
// Vowel-quality and consonant tables (latin.jsonc). The hiatus/glide/digraph/stress rules are the scan below.
const SHORT = DEF.short;
const LONG = DEF.long;
const TENSE = DEF.tense;
const CONS = DEF.consonants;
// Every vowel LETTER (short, macron, diaeresis) — for glide (i→j) and diphthong context tests.
const VOWEL_LETTER = new Set(DEF.vowelLetters);
// Phone classes (latin.jsonc). These were rebuilt inside the scan on every call; they are per-word
// constants, and Latin's own — the labiovelars and Greek-loan aspirates are members.
const VELAR = new Set(DEF.velars);
const MUTA = new Set(DEF.mutae); // muta cum liquida: obstruent + liquid onsets the ultima
const LIQUID = new Set(DEF.liquids);
// IPA vowel BASE chars — for segment-level tests (nasalization, stress nuclei). Excludes offglide/length marks.

const isVowelLetter = (c: string | undefined): boolean => c !== undefined && VOWEL_LETTER.has(c);
// NFD-normalise so a nasalized PRECOMPOSED vowel (ãẽĩõũ from nasalizeLong) decomposes to base+tilde and its base is found.
const isVowelSeg = (s: string | undefined): boolean => s !== undefined && [...s.normalize("NFD")].some((c) => IPA_VOWEL.has(c));
// Lax→tense map: a nasalized long vowel takes the CLOSE quality (referee: -em→ẽː, -um→ũː, not ɛ̃ː/ʊ̃ː).
const TENSE_BASE: Record<string, string> = { "ɛ": "e", "ɪ": "i", "ɔ": "o", "ʊ": "u" };
/** Add nasalization (U+0303) + length to a vowel segment (final ⟨-m⟩ / pre-fricative nasal): [ɛ]→[ẽː], [aː]→[ãː]. */
function nasalizeLong(seg: string): string {
    let base = seg.replace(/ː/gu, "").replace(/̃/gu, "");
    base = TENSE_BASE[base] ?? base;
    return (base + "̃").normalize("NFC") + "ː";
}

/** Phonemize one Classical Latin word → canonical IPA: context-sensitive grapheme scan + assimilation + stress. */
export function phonemizeWord(word: string): string {
    // A combining BREVE (U+0306) over a macron marks "common quantity" (ū̆/ī̆ — attested BOTH ways); the referee has both
    // variants, so we drop the breve and keep the macron's LONG citation form (the principled default).
    const w = word.normalize("NFC").toLowerCase().replace(/̆/gu, "");
    const segs: string[] = [];
    // Intervocalic ⟨i j⟩ is a GEMINATE glide [j j] after a SHORT vowel (eius→ɛjjʊs) but SINGLE [j] after a long/diphthong
    // (Phīnēia→pʰiːneːja) — the long nucleus already makes the syllable heavy.
    const pushIntervocalicGlide = (): void => {
        const prev = segs[segs.length - 1];
        const shortPrev = prev !== undefined && isVowelSeg(prev) && !/ː/u.test(prev) && !/̯/u.test(prev);
        if (shortPrev) segs.push("j", "j");
        else segs.push("j");
    };
    let i = 0;
    const at = (k: number): string | undefined => w[k];
    while (i < w.length) {
        const c = w[i]!;
        const n1 = w[i + 1];
        const two = c + (n1 ?? "");
        // ── Consonant digraphs ──────────────────────────────────────────────
        if (two === "qu") { segs.push("kʷ"); i += 2; continue; }
        if (c === "g" && n1 === "u" && isVowelLetter(at(i + 2)) && at(i - 1) === "n") { segs.push("ɡʷ"); i += 2; continue; } // ⟨ngu⟩+V → [ŋ ɡʷ]
        if (two === "ph") { segs.push("pʰ"); i += 2; continue; }
        if (two === "th") { segs.push("tʰ"); i += 2; continue; }
        if (two === "ch") { segs.push("kʰ"); i += 2; continue; }
        if (two === "rh") { segs.push("rʰ"); i += 2; continue; }
        if (two === "gn") { segs.push(...(i === 0 ? ["n"] : ["ŋ", "n"])); i += 2; continue; } // word-initial ⟨gn⟩→[n] (g silent)
        // ── Diphthongs ⟨ae au oe⟩ (⟨eu⟩ is mostly hiatus, excluded) ──────────
        if (two === "ae") { segs.push("a", "e̯"); i += 2; continue; }
        if (two === "au") { segs.push("a", "u̯"); i += 2; continue; }
        if (two === "oe") { segs.push("o", "e̯"); i += 2; continue; }
        // ── ⟨x⟩ → [k s] ─────────────────────────────────────────────────────
        if (c === "x") { segs.push("k", "s"); i += 1; continue; }
        // ── Glides: ⟨i⟩ before a vowel is [j] word-initially / GEMINATE [j j] intervocalically ──
        if (c === "i" && isVowelLetter(n1)) {
            if (i === 0) { segs.push("j"); i += 1; continue; }
            if (isVowelLetter(at(i - 1))) { pushIntervocalicGlide(); i += 1; continue; }
            // after a consonant ⟨i⟩+V stays a VOWEL (natiō→...tio, Magnentium→...tiũː): fall through
        }
        if (c === "j") { // ⟨j⟩ editorial spelling: geminate glide intervocalically, else single
            if (i > 0 && isVowelLetter(at(i - 1)) && isVowelLetter(n1)) pushIntervocalicGlide();
            else segs.push("j");
            i += 1; continue;
        }
        // ── ⟨b⟩ → [p] before a voiceless ⟨s t⟩ (absorbita→apsɔrbɪta, obtineō→optineoː) ──
        if (c === "b" && (n1 === "s" || n1 === "t")) { segs.push("p"); i += 1; continue; }
        // ── intervocalic ⟨z⟩ → GEMINATE [z z] (Greek zeta: byzantīna→byzzantiːna) ──
        if (c === "z" && isVowelLetter(at(i - 1)) && isVowelLetter(n1)) { segs.push("z", "z"); i += 1; continue; }
        // ── Dark ⟨l⟩: [ɫ] except geminate (⟨ll⟩ clear) or before a front vowel/⟨j⟩ ──
        if (c === "l") {
            const clear = n1 === "l" || at(i - 1) === "l" || n1 === "i" || n1 === "ī" || n1 === "j" || n1 === "y";
            segs.push(clear ? "l" : "ɫ");
            i += 1; continue;
        }
        // ── Vowels ──────────────────────────────────────────────────────────
        if (LONG[c] !== undefined) { segs.push(LONG[c]!); i += 1; continue; }
        if (SHORT[c] !== undefined) {
            // Hiatus tensing — but NOT before an ⟨i j⟩ that will itself surface as a GLIDE (eius→ɛjjʊs, not ejjʊs):
            // a following intervocalic ⟨i j⟩ (vowel after it) is a consonant [j], so the syllable is closed, not open.
            // A DIAERESIS vowel (ë ï ö ü ÿ) is post-hiatus by definition (poëta), so it tenses unconditionally.
            const nextGlide = (n1 === "i" || n1 === "j") && isVowelLetter(at(i + 2));
            const hiatus = "ëïöüÿ".includes(c) || (isVowelLetter(n1) && !nextGlide);
            segs.push(TENSE[c] !== undefined && hiatus ? TENSE[c]! : SHORT[c]!);
            i += 1; continue;
        }
        // ── Single consonants ───────────────────────────────────────────────
        if (CONS[c] !== undefined) { segs.push(CONS[c]!); i += 1; continue; }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed. Only
        // reached when every grapheme (digraphs included) has declined, so the language's own reading wins.
        { const p = latinPhone(c, { initial: i === 0, includeH: true }); if (p !== undefined) segs.push(p); }
        i += 1;
    }

    // ── Post-processing on the segment array ────────────────────────────────
    // (1) nasal ⟨n m⟩ before a fricative ⟨s f⟩ → drop nasal, lengthen+nasalize the preceding vowel (cōnsul→koːsʊɫ).
    for (let k = segs.length - 2; k >= 1; k--) {
        if ((segs[k] === "n" || segs[k] === "m") && (segs[k + 1] === "s" || segs[k + 1] === "f") && isVowelSeg(segs[k - 1])) {
            segs[k - 1] = nasalizeLong(segs[k - 1]!);
            segs.splice(k, 1);
        }
    }
    // (2) ⟨n⟩ → [ŋ] before a velar.
    for (let k = 0; k < segs.length - 1; k++) if (segs[k] === "n" && VELAR.has(segs[k + 1]!)) segs[k] = "ŋ";
    // (3) word-FINAL ⟨-Vm⟩ → nasalized long vowel [Ṽː] (bellum→bɛllũː, aquam→akʷãː).
    if (segs.length >= 2 && segs[segs.length - 1] === "m" && isVowelSeg(segs[segs.length - 2])) {
        segs[segs.length - 2] = nasalizeLong(segs[segs.length - 2]!);
        segs.pop();
    }

    // ── Stress: penult if HEAVY (long/diphthong nucleus or closed syllable), else antepenult; emitted (folded in eval).
    placeStress(segs);
    return segs.join("").normalize("NFC");
}

/** Insert ˈ before the onset of the stressed syllable per the Latin penult/antepenult weight rule. */
function placeStress(segs: string[]): void {
    // Nuclei: a vowel segment, absorbing an immediately-following offglide (diphthong = ONE nucleus; the offglide seg
    // itself is skipped so it is not miscounted as a second nucleus).
    const nuclei: { idx: number; heavy: boolean }[] = [];
    for (let k = 0; k < segs.length; k++) {
        if (/̯/u.test(segs[k]!)) continue; // an offglide is part of the preceding nucleus, not its own
        if (!isVowelSeg(segs[k])) continue;
        const diphthong = segs[k + 1] !== undefined && /̯/u.test(segs[k + 1]!);
        const long = /ː/u.test(segs[k]!);
        nuclei.push({ idx: k, heavy: long || diphthong });
    }
    if (nuclei.length === 0) return;
    let target: number;
    if (nuclei.length <= 2) target = 0; // monosyllable → sole vowel; disyllable → penult (= the first nucleus)
    else {
        const penult = nuclei[nuclei.length - 2]!;
        const ultima = nuclei[nuclei.length - 1]!;
        // Penult heavy BY POSITION iff it is CLOSED — i.e. a coda consonant remains after the ultima takes its maximal
        // onset. A muta-cum-liquida cluster (obstruent/f + liquid) onsets the ultima and does NOT close the penult
        // (volucris→ˈwɔɫʊkrɪs antepenult), so it counts as onset, not coda.
        const cons: string[] = [];
        for (let k = penult.idx + 1; k < ultima.idx; k++) if (!isVowelSeg(segs[k]) && !/̯/u.test(segs[k]!)) cons.push(segs[k]!);
        const m = cons.length;
        let onset = m >= 1 ? 1 : 0;
        if (m >= 2 && MUTA.has(cons[m - 2]!) && LIQUID.has(cons[m - 1]!)) onset = 2; // muta cum liquida → 2-consonant onset
        const closedPenult = m - onset >= 1;
        target = penult.heavy || closedPenult ? nuclei.length - 2 : nuclei.length - 3;
    }
    // Onset: back up over a valid onset (single C, or obstruent+liquid muta-cum-liquida) — folded, so placement is loose.
    let pos = nuclei[target]!.idx;
    if (pos > 0 && !isVowelSeg(segs[pos - 1]) && !/̯/u.test(segs[pos - 1]!)) pos--;
    if (pos > 0 && !isVowelSeg(segs[pos - 1]) && ["l", "ɫ", "r"].includes(segs[pos]!) && !["l", "ɫ", "r"].includes(segs[pos - 1]!)) pos--;
    segs.splice(pos, 0, "ˈ");
}

// A word (Latin letters incl. macrons/diaeresis + editorial ⟨v j⟩ + combining marks like the U+0306 "common-quantity"
// breve, which phonemizeWord strips) / number / punctuation. The combining range keeps ū̆/ī̆ inside one token.
/**
 * The shared SYMBOL tier. Every word is a la.wikipedia TOKEN attestation whose examples were read, and
 * the two highest-traffic ones are glossed against their own sign inside this corpus:
 *   `centesimae` — "electus est cum **53,79%** suffragiorum contra **46,21 centesimae** suffragiorum",
 *     one clause carrying the sign and the word for the same quantity.
 *   `gradus` — "Mediocris temperatura est **10.6° C** … quo **18.0 gradus Celsius**", one paragraph.
 *
 * ⚠ NUMBER IS DECLARED AND CASE IS NOT, which is the same limitation the ordinal refusal in normalize.ts
 * rests on. A Latin measure word after a numeral takes the case its clause governs — `600 chiliometra`
 * (nominative/accusative plural, the corpus's own) but `in chiliometro` (ablative singular) two lines
 * later. `CountForms` can express the singular/plural split and nothing can express the case, so the
 * tier emits the nominative and the reading is right in the commonest slot and uninflected elsewhere.
 * Said here rather than left for a reader to discover.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["centesima", "centesimae"],
    currency: { "$": ["dollarium", "dollaria"], "€": ["euro"] },
    units: {
        "km": ["chiliometrum", "chiliometra"], "m": ["metrum", "metra"],
        "cm": ["centimetrum", "centimetra"], "mm": ["millimetrum", "millimetra"],
        "kg": ["chiligramma", "chiligrammata"],
    },
    exponentWords: { squared: ["quadratum", "quadrata"], cubed: ["cubicum", "cubica"], position: "after" },
    magnitudes: ["milia", "miliones", "milliones"],
});

const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zāēīōūȳëïöüÿA-ZĀĒĪŌŪȲËÏÖÜŸ̀-ͯ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class LatinPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its era, degree and range steps need the figure and its mark still
        // adjacent, which the tier would break — then the shared symbol tier, which matches a unit only
        // when a NUMBER is adjacent.
        return assembleClauses(SYMBOLS(normalizeLatin(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // Numbers: compose the Latin cardinal phrase (subtractive x8/x9, mīlle/mīlia), then phonemize each word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Classical Latin phonemizer (macron-aware g2p + nasal assimilation + weight-based stress). */
export function createLatin(): Phonemizer {
    return new LatinPhonemizer();
}
