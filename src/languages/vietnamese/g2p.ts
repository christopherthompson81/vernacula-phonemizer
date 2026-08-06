/**
 * Vietnamese grapheme→phoneme engine (Northern / Hanoi). A Vietnamese syllable is
 * onset + (glide) + nucleus + tone + coda. This engine:
 *   1. extracts the TONE from the vowel diacritic via Unicode NFD (grave/acute/hook/tilde/dot-below →
 *      6 Chao contours), leaving the toneless syllable (â ê ô ă ơ ư preserved);
 *   2. parses the ONSET by longest orthographic match (digraphs ngh/ng/nh/ch/gh/gi/kh/ph/th/tr/qu…),
 *      vowel-initial → glottal ʔ;
 *   3. looks up the RHYME (everything after the onset) in a table (rhymes.tsv, the closed Vietnamese rhyme
 *      set, ~370 entries — an exhaustive closed-class inventory);
 *   4. assembles onset + glide + ˈ + nucleus + tone + coda.
 */
import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Tone map, onset table, and vowel sets are DATA (vietnamese.jsonc). Northern tones: combining diacritic → Chao
// contour (placed after the nucleus); ngang (no mark) = ˧. Onsets are matched longest-first (order-preserved).
const TONE = MANIFEST.tones.diacritics;
const NGANG = MANIFEST.tones.ngang;
const ONSETS = MANIFEST.onsets;
const VOWEL_LETTER = new Set([...MANIFEST.vowelLetters]);
const VOWEL_IPA = new Set([...MANIFEST.vowelIpa]);
const CODA_RE = /(t̪|[ptkmnŋɲwj])$/u;

let RHYMES: Map<string, string> | undefined;
function rhymes(): Map<string, string> {
    if (RHYMES === undefined) RHYMES = loadTsvMap(import.meta.url, "rhymes.tsv");
    return RHYMES;
}

/** Split a syllable into its toneless base (NFC, keeping â/ê/ô/ă/ơ/ư) and its Chao tone contour. */
function splitTone(syl: string): { base: string; tone: string } {
    let tone = NGANG,
        out = "";
    for (const ch of syl.normalize("NFD")) {
        if (ch in TONE) tone = TONE[ch]!;
        else out += ch;
    }
    return { base: out.normalize("NFC").toLowerCase(), tone };
}

/** Parse the onset: longest orthographic match → IPA + the remaining rhyme orthography. */
function parseOnset(base: string): { onset: string; rest: string } {
    for (const [o, ipa] of ONSETS) {
        if (base.startsWith(o)) {
            let rest = base.slice(o.length);
            if (o === "gi") {
                // gì → z + i;  giết → z + iê (the i rejoins the diphthong)
                if (rest === "" || !VOWEL_LETTER.has(rest[0]!))
                    rest = "i" + rest;
                else if (rest[0] === "ê") rest = "i" + rest;
            } else if (o === "qu") {
                // Normally qu = k + w-glide (quả → kwaː). But before ô/ơ the u+ô/ơ is the NUCLEUS (quốc → kuək): drop
                // the kw glide, keep u in the rhyme.
                if (base[2] === "ô" || base[2] === "ơ")
                    return { onset: "k", rest: "u" + base.slice(2) };
                rest = base.slice(2);
            }
            return { onset: ipa, rest };
        }
    }
    if (base !== "" && VOWEL_LETTER.has(base[0]!))
        return { onset: "ʔ", rest: base }; // vowel-initial → glottal
    return { onset: "", rest: base };
}

/** One Vietnamese syllable → canonical IPA (with tone + a stress mark), or "" if not a parseable syllable. */
export function phonemizeSyllable(syl: string): string {
    const { base, tone } = splitTone(syl);
    if (base === "") return "";
    const { onset, rest } = parseOnset(base);
    const rhyme = rhymes().get(rest);
    if (rhyme === undefined) return ""; // not a known Vietnamese rhyme (foreign word / acronym)
    // Split the rhyme IPA into optional leading glide (w), nucleus, and coda so the tone lands after the nucleus.
    let r = rhyme,
        glide = "";
    if (r.startsWith("w") && r.length > 1 && VOWEL_IPA.has(r[1]!)) {
        glide = "w";
        r = r.slice(1);
    }
    const codaM = r.match(CODA_RE);
    const coda = codaM ? codaM[0] : "";
    const nucleus = coda ? r.slice(0, r.length - coda.length) : r;
    return onset + glide + "ˈ" + nucleus + tone + coda;
}
