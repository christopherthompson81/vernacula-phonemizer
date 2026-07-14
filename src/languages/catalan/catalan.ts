/**
 * Catalan (ca) phonemizer — General Eastern/Central Catalan, canonical IPA, espeak-independent. Rule-based g2p
 * (g2p.ts) → rule stress (2R + written accent) → UNSTRESSED VOWEL REDUCTION (a/e→ə, o→u) → spirantization →
 * palatal nasal assimilation → word-final devoicing + final-r deletion. No lexicon; stressed open/close mids
 * default (lexical ceiling). See docs/ca_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const NASALS = new Set(MANIFEST.nasals);
const STOP_TO_FRIC = MANIFEST.spirantize;
const FINAL_DEVOICE = MANIFEST.finalDevoice;
const PALATALS = new Set(MANIFEST.palatals);
const FUNCTION_WORDS = new Set(MANIFEST.functionWords);

/** Index of the stressed nucleus: written accent, else the Catalan 2R rule — penult when the word ends in a
 *  vowel, a vowel+s, or -en/-in; else final. */
function stressedNucleus(word: string, segs: Seg[]): number {
    const nuclei = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return -1;
    const accented = nuclei.find((i) => segs[i]!.accent);
    if (accented !== undefined) return accented;
    if (nuclei.length === 1) return nuclei[0]!;
    const w = word.toLowerCase();
    const penult =
        /[aeiouàèéíòóúüï]$/.test(w) ||
        /[aeiouàèéíòóúüï]s$/.test(w) ||
        /[ei]n$/.test(w);
    return penult ? nuclei[nuclei.length - 2]! : nuclei[nuclei.length - 1]!;
}

/** Reduce every UNSTRESSED nucleus to its Central-Catalan reduced vowel (a/e→ə, o→u; i/u unchanged). */
function reduce(segs: Seg[], stress: number): void {
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (s.nucleus && i !== stress && s.reduced !== undefined) s.ph = s.reduced;
    }
}

// Obstruent voicing pairs for regressive assimilation.
const DEVOICE: Record<string, string> = { b: "p", d: "t", ɡ: "k", z: "s", v: "f", ʒ: "ʃ", "d͡ʒ": "t͡ʃ", "d͡z": "t͡s" };
const VOICE: Record<string, string> = { p: "b", t: "d", k: "ɡ", s: "z", f: "v", ʃ: "ʒ", "t͡ʃ": "d͡ʒ", "t͡s": "d͡z" };
const VOICELESS = new Set(Object.keys(VOICE));
const VOICED = new Set(Object.keys(DEVOICE));

/** Regressive voicing assimilation: an obstruent takes the voicing of a following obstruent (abscessos → əpsəsus,
 *  esbós → əzβos). Right-to-left so it propagates through a cluster (abst → apst). */
function voicingAssim(segs: Seg[]): void {
    for (let i = segs.length - 2; i >= 0; i--) {
        const a = segs[i]!.ph, b = segs[i + 1]!.ph;
        if (VOICELESS.has(b) && VOICED.has(a)) segs[i]!.ph = DEVOICE[a]!;
        else if (VOICED.has(b) && VOICELESS.has(a)) segs[i]!.ph = VOICE[a]!;
    }
}

/** b/d/ɡ → β/ð/ɣ except utterance-initial, after a nasal, or after a lateral. */
function spirantize(segs: Seg[]): void {
    for (let i = 0; i < segs.length; i++) {
        const fric = STOP_TO_FRIC[segs[i]!.ph];
        if (fric === undefined) continue;
        const prev = i > 0 ? segs[i - 1]!.ph : "";
        const stop = i === 0 || NASALS.has(prev) || prev === "ɫ" || prev === "ʎ" || prev === "ɫː";
        if (!stop) segs[i]!.ph = fric;
    }
}

/** Coda /n/ place assimilation to the following consonant: → ɲ before a palatal (menja → meɲʒə), → ŋ before a
 *  velar (abrilenca → əbɾiləŋkə), → m before a labial (canvi → kambi). */
function nasalAssim(segs: Seg[]): void {
    for (let i = 0; i < segs.length - 1; i++) {
        if (segs[i]!.ph !== "n") continue;
        const nx = segs[i + 1]!.ph;
        if (PALATALS.has(nx)) segs[i]!.ph = "ɲ";
        else if (nx === "k" || nx === "ɡ" || nx === "ɣ") segs[i]!.ph = "ŋ";
        else if (nx === "p" || nx === "b" || nx === "m" || nx === "β" || nx === "f") segs[i]!.ph = "m";
    }
}

// Final coda-cluster simplification: a word-final stop drops after a homorganic nasal / lateral (Central).
const CLUSTER_DROP: Record<string, string[]> = {
    n: ["t", "d"], ɲ: ["t", "d"], ŋ: ["k", "ɡ"], ɫ: ["t", "d"], l: ["t", "d"], m: ["p", "b"],
};

/** Central word-final processes: final-r deletion (polysyllabic vowel+r → drop), coda-cluster simplification
 *  (vint → bin, camp → kam, banc → baŋ), then obstruent devoicing of the resulting final consonant. */
function finalPass(segs: Seg[], nucleiCount: number): void {
    if (segs.length === 0) return;
    const last = segs[segs.length - 1]!;
    // final-r deletion: cantar → kənta, carrer → kəre (polysyllables; monosyllables keep it: mar, cor)
    if ((last.ph === "ɾ" || last.ph === "r") && nucleiCount >= 2) {
        const prev = segs[segs.length - 2];
        if (prev && prev.nucleus) { segs.pop(); return finalPass(segs, nucleiCount); }
    }
    // coda-cluster simplification: drop the final stop after a homorganic sonorant (nt→n, mp→m, nk→ŋ, lt→l)
    if (segs.length >= 2) {
        const prev = segs[segs.length - 2]!.ph;
        if (CLUSTER_DROP[prev]?.includes(last.ph)) { segs.pop(); return finalPass(segs, nucleiCount); }
    }
    const newLast = segs[segs.length - 1]!;
    const dev = FINAL_DEVOICE[newLast.ph];
    if (dev !== undefined && !newLast.nucleus) newLast.ph = dev;
}

/** Phonemize a single Catalan word to canonical IPA (with a stress mark). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    const stress = stressedNucleus(word, segs);
    reduce(segs, stress);
    finalPass(segs, segs.filter((s) => s.nucleus).length); // devoice + drop final-r BEFORE spirantization
    voicingAssim(segs); // regressive cluster voicing (abs → aps) before spirantization
    spirantize(segs);
    nasalAssim(segs);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress && stress >= 0) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Catalan letters incl. accents + ç + the l·l middot; numbers: dot = thousands, comma = decimal.
const TOKEN = /([a-zàèéíòóúüïç·]+)|(\d+(?:\.\d+)*(?:,\d+)?)|([.!?…,;:])/giu;

function numberTokenToWords(tok: string): string {
    const [intRaw, frac] = tok.split(",");
    let words = numberToWords(Number(intRaw!.replace(/\./g, "")));
    if (frac !== undefined)
        words += ` ${MANIFEST.numbers.decimalConnector} ` + [...frac].map((d) => numberToWords(Number(d))).join(" ");
    return words;
}

/** Phonemize one running-text word, de-stressing unstressed monosyllabic function words. */
function wordIpa(word: string): string {
    const ipa = phonemizeWord(word);
    return FUNCTION_WORDS.has(word.toLowerCase()) ? ipa.replace("ˈ", "") : ipa;
}

class CatalanPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(wordIpa(m[1]));
            else if (m[2]) sink.emit(numberTokenToWords(m[2]).split(" ").map(wordIpa).join(" "));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Catalan phonemizer (fully rule-based; no data files beyond the manifest). */
export function createCatalan(): Phonemizer {
    return new CatalanPhonemizer();
}
