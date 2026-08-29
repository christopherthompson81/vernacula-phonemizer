/**
 * Catalan (ca) phonemizer — General Eastern/Central Catalan, canonical IPA. Rule-based g2p
 * (g2p.ts) → rule stress (2R + written accent) → UNSTRESSED VOWEL REDUCTION (a/e→ə, o→u) → spirantization →
 * palatal nasal assimilation → word-final devoicing + final-r deletion.
 *
 * ⚠ NOT "no lexicon", which this header claimed until the C# port read it against the code: two WORD LISTS
 * are consulted per word — `mid-vowels.tsv` (10,414 rows) for the stressed open/close mid height, which is
 * not spelling-derivable, and `bl-gl-geminate.tsv` (578 rows) for the popular ⟨bl⟩/⟨gl⟩ geminate. What is
 * absent is a PRONUNCIATION dictionary: every segment still comes from the rules, and a word in neither
 * list takes the open mid (ɛ/ɔ) by default — that default is the lexical ceiling the eval folds.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeCatalan } from "./normalize.ts";
import { noteRewrite } from "../../core/trace.ts";

// Lexical stressed mid-vowel HEIGHT (open/close is not spelling-derivable — dona/dóna, os/ós).
// word → "e" (stressed ⟨e⟩ is close /e/) or "o" (stressed ⟨o⟩ is close /o/).
// The engine defaults to OPEN (ɛ/ɔ), so a flag only marks the close deviations.
let MID_VOWELS: Map<string, string> | undefined;
function midVowels(): Map<string, string> {
    if (MID_VOWELS === undefined) MID_VOWELS = loadTsvMap(import.meta.url, "mid-vowels.tsv", undefined, { optional: true });
    return MID_VOWELS;
}

// Words whose intervocalic ⟨bl⟩/⟨gl⟩ GEMINATES (popular: poble→pˈɔbːlə) rather than spirantizes (learned:
// problema→pɾuβlə, obligar→uβliɣə)
let GEMINATE: Map<string, string> | undefined;
function geminates(word: string): boolean {
    if (GEMINATE === undefined) GEMINATE = loadTsvMap(import.meta.url, "bl-gl-geminate.tsv", undefined, { optional: true });
    return GEMINATE.has(word);
}

const NASALS = new Set(MANIFEST.nasals);
const STOP_TO_FRIC = MANIFEST.spirantize;
const FINAL_DEVOICE = MANIFEST.finalDevoice;
const PALATALS = new Set(MANIFEST.palatals);
const FUNCTION_WORDS = new Set(MANIFEST.functionWords);

/**
 * ⚠ SPIRANTIZATION IS POST-LEXICAL — it does not stop at the word edge, and `spirantize()` above cannot
 * see past one. Its `i === 0` guard is WORD-initial, because a per-word function has no other context,
 * so the identical environment read two ways depending on which side of a space it fell: `cabota` →
 * kəβˈɔtə but `la bota` → ɫə bˈotə. That INTERNAL INCONSISTENCY is the defect.
 *
 * Measured for Spanish, which had the same gap and the same fix: 1,292 of 1,500 FLEURS rows moved
 * CLOSER to the recogniser and 36 further (35.9:1).
 *
 * ⚠ CATALAN'S CONDITIONS ARE NOT SPANISH'S, and both extra ones carry across the boundary too:
 * only /d/ stays occlusive after a lateral (`alga` → aɫɣə keeps the fricative for /ɡ/), and a stop
 * before a sibilant stays occlusive (`examen` → əɡzamən). The sibilant now sits in the FOLLOWING word,
 * which is precisely the context the assembled string exposes.
 */
// ⚠ THE SIBILANT IS A LOOKAHEAD, NOT A CAPTURE. Consuming it advanced past the character that the NEXT
// word needs as its own left context, so a second stop in the same clause was silently missed:
// `segons de vídeo` came out `səɣˈons ðə bˈiðəu` — the /d/ spirantized and the /b/ one word later did
// not. Non-overlapping replacement makes any consumed right-context a bug of exactly this shape.
const CROSS_WORD_STOP = /([^\s])(\s+)([bdɡ])(?=([^\s]?))/gu;

function spirantizeAcrossWords(ipa: string): string {
    // ⚠ REPORTED TO THE TRACE (#1150): runs on the ASSEMBLED string, so a token's `emitted` reading is not
    // what ships. Without the event the discrepancy has no cause attached.
    const out = spirantizeAcrossWordsCore(ipa);
    noteRewrite("spirantize-across-words", ipa, out, true);
    return out;
}

function spirantizeAcrossWordsCore(ipa: string): string {
    return ipa.replace(CROSS_WORD_STOP, (m, prev: string, gap: string, stop: string, next: string) => {
        if (NASALS.has(prev)) return m;
        if (stop === "d" && (prev === "ɫ" || prev === "ʎ")) return m;   // homorganic, /d/ only
        if (next === "z" || next === "s" || next === "ʃ" || next === "ʒ") return m;  // before a sibilant
        if (!/[\p{L}\p{M}ˈˌ]/u.test(prev)) return m;                    // after a pause
        return prev + gap + (STOP_TO_FRIC[stop] ?? stop);
    });
}

/** Index of the stressed nucleus: written accent, else the Catalan 2R rule — penult when the word ends in a
 *  vowel, a vowel+s, or -en/-in; else final. */
function stressedNucleus(word: string, segs: Seg[]): number {
    const nuclei = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return -1;
    const accented = nuclei.find((i) => segs[i]!.accent);
    if (accented !== undefined) return accented;
    if (nuclei.length === 1) return nuclei[0]!;
    // A word whose FINAL syllable is a falling diphthong (…V + glide j/w, optionally + a coda like the plural -s)
    // is OXYTONE — the glide closes the syllable, so the 2R rule stresses the final nucleus: correu → kurˈɛw,
    // correus → kurˈɛws, remeis → rəmˈɛjs, dijous → diʒˈɔws. (Check the seg after the LAST nucleus, not the last
    // seg, so a following coda consonant doesn't mask the diphthong.)
    const lastNuc = nuclei[nuclei.length - 1]!;
    const afterLastNuc = segs[lastNuc + 1];
    if (afterLastNuc && !afterLastNuc.nucleus && (afterLastNuc.ph === "j" || afterLastNuc.ph === "w")) return lastNuc;
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

/** Intervocalic ⟨bl⟩/⟨gl⟩ geminate the stop (poble → pˈɔbːlə, regla → rˈeɡːlə); the geminate blocks
 *  spirantization (bː/ɡː are not in the STOP_TO_FRIC keys, so spirantize skips them). */
function geminateBlGl(segs: Seg[]): void {
    for (let i = 1; i < segs.length - 1; i++) {
        const ph = segs[i]!.ph;
        if ((ph === "b" || ph === "ɡ") && segs[i - 1]!.nucleus && segs[i + 1]!.ph === "ɫ") segs[i]!.ph = ph + "ː";
    }
}

/** b/d/ɡ → β/ð/ɣ except utterance-initial, after a nasal, or after a lateral. */
function spirantize(segs: Seg[]): void {
    for (let i = 0; i < segs.length; i++) {
        const fric = STOP_TO_FRIC[segs[i]!.ph];
        if (fric === undefined) continue;
        const prev = i > 0 ? segs[i - 1]!.ph : "";
        const nextPh = segs[i + 1]?.ph ?? "";
        const afterLateral = prev === "ɫ" || prev === "ʎ" || prev === "ɫː";
        // Only /d/ stays occlusive after a lateral (homorganic); /b/ and /ɡ/ DO spirantize (alga → aɫɣə). A stop
        // before a sibilant stays occlusive too (examen → əɡzamən, not əɣz).
        const beforeSibilant = nextPh === "z" || nextPh === "s" || nextPh === "ʃ" || nextPh === "ʒ";
        const stop = i === 0 || NASALS.has(prev) || (afterLateral && segs[i]!.ph === "d") || beforeSibilant;
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
// The same drop before a FINAL plural -s (cents→sens, forts→fɔrs, molts→mɔls, camps→kams). ⟨r⟩ is included here
// (rt+s → rs) but NOT in CLUSTER_DROP — word-final -rt KEEPS its stop (fort → fɔrt), only -rts drops it.
const CLUSTER_DROP_S: Record<string, string[]> = { ...CLUSTER_DROP, r: ["t", "d"], ɾ: ["t", "d"] };

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
    // -nts→ns, -rts→rs, -lts→ls, -mps→ms: a stop between a homorganic sonorant and the FINAL plural -s drops.
    if (last.ph === "s" && segs.length >= 3) {
        const stopPh = segs[segs.length - 2]!.ph, sonPh = segs[segs.length - 3]!.ph;
        if (CLUSTER_DROP_S[sonPh]?.includes(stopPh)) { segs.splice(segs.length - 2, 1); return finalPass(segs, nucleiCount); }
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

/** Phonemize a single Catalan word to canonical IPA (with a stress mark).
 *
 *  `unstressed`: treat the word as a PROCLITIC — no stress mark AND no stressed nucleus, so vowel
 *  reduction covers every syllable (el→əɫ, del→dəɫ, em→əm). The old approach stripped the ˈ from the
 *  finished IPA, which removed the mark but left the vowel with its stressed quality (ɛɫ) — reduction
 *  had already run with the word's only nucleus at the stress index. The human referee attests the
 *  reduced form (em → "ə m"). */
export function phonemizeWord(word: string, unstressed = false): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    const stress = unstressed ? -1 : stressedNucleus(word, segs);
    reduce(segs, stress);
    // lexical mid-vowel height: the stressed open default (ɛ/ɔ) → close (e/o) for flagged words (pedra→pˈeðɾə).
    if (stress >= 0) {
        const flag = midVowels().get(word.toLowerCase());
        if (flag === "e" && segs[stress]!.ph === "ɛ") segs[stress]!.ph = "e";
        else if (flag === "o" && segs[stress]!.ph === "ɔ") segs[stress]!.ph = "o";
    }
    nasalAssim(segs); // BEFORE finalPass so n→ŋ feeds the coda-cluster drop (banc → baŋ)
    voicingAssim(segs); // regressive cluster voicing (abs → aps)
    finalPass(segs, segs.filter((s) => s.nucleus).length); // devoice + final-r + cluster drop
    if (geminates(word.toLowerCase())) geminateBlGl(segs); // bl/gl → bːl/ɡːl for LEXICALLY-geminating words only
    spirantize(segs); // last: after voicing/nasal context is settled
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress && stress >= 0) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Catalan letters incl. accents + ç + the l·l middot; numbers: dot = thousands, comma = decimal.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "·")})|(\\d+(?:(?<!(?<!\\d)0)\\.\\d+)*(?:,\\d+)?)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zàèéíòóúüïç·]";
/** ⚠ EXPORTED FOR `test/lexicon-reachability.test.ts`, which asserts that every key in this engine's
 *  lexicons survives its own fold. A key the fold rewrites can never be matched from `text()`, and both
 *  engines agree on the miss, so the parity gate cannot see it (#1068). */
export const nat = makeNativiser(NATIVE_CLASS, "iu");

function numberTokenToWords(tok: string): string {
    const [intRaw, frac] = tok.split(",");
    let words = numberToWords(Number(intRaw!.replace(/\./g, "")), intRaw!.replace(/\./g, ""));
    if (frac !== undefined)
        words += ` ${MANIFEST.numbers.decimalConnector} ` + [...frac].map((d) => numberToWords(Number(d))).join(" ");
    return words;
}

// Function words that resist REDUCTION even though they are de-stressed: the conjunction "o" keeps [o]
// (contrast with the vowel u — the referee attests o → "o"), and the adverbs no/com keep their vowel in
// standard Central Catalan. They lose the stress MARK only.
const KEEP_VOWEL = new Set(["o", "no", "com"]);

/** Phonemize one running-text word; an unstressed monosyllabic function word is both de-stressed AND
 *  vowel-reduced (el → əɫ, not ɛɫ), except the KEEP_VOWEL words, which only lose the mark. */
function wordIpa(word: string): string {
    const lower = word.toLowerCase();
    if (!FUNCTION_WORDS.has(lower)) return phonemizeWord(word);
    if (KEEP_VOWEL.has(lower)) return phonemizeWord(word).replace("ˈ", "");
    return phonemizeWord(word, true);
}

// symbol normalization — Catalan. `¥` (yen) was missing, so the corpus's 2.500 ¥ / 130.000 ¥ read as
// bare numbers with the sign dropped.
const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "per" },
    percent: ["per cent"],
    currency: { "€": ["euro", "euros"], "$": ["dòlar", "dòlars"], "£": ["lliura", "lliures"], "¥": ["ien", "iens"] },
    units: { km: ["quilòmetre", "quilòmetres"], cm: ["centímetre", "centímetres"], mm: ["mil·límetre", "mil·límetres"],
        kg: ["quilogram", "quilograms"], h: ["hora", "hores"], s: ["segon", "segons"],
        m: ["metre", "metres"] },
    // `m` — metres ×12 ("un màxim de 4.892 m del Mont Vinson", the corpus's only digit-adjacent bare `m`,
    // and a genuine metre). The singular is regular agreement, not a separate attestation.
    // Without it `cúbic`/`cúbics` below were dead data: the exponent branch needs the unit word first.
    // ⚠ RESIDUAL EXPOSURE — a local rule that depends on a character an earlier rule has already rewritten will not fire: normalize.ts step 6 rewrites the dot to "punt" before the tier, so the
    // tier's `NOT_VERSION` guard has no dot left to see and `802.11m` reads as "…onze METRES". Note the same
    // rule makes `6.5m` read as 6.5 metres, which is RIGHT — the ambiguity is real, and the only wrong case
    // is a dotted version whose trailing letter is `m`, which no corpus contains (802.11 comes as a/b/g/n).
    unitPer: "per", // 120 km/h -> cent vint quilòmetres per hora; the /h used to be dropped outright
    exponentWords: { squared: ["quadrat", "quadrats"], cubed: ["cúbic", "cúbics"] },
    magnitudes: ["milions", "milió"],
    magnitudeConnective: "de", // cinc milions DE dòlars
});

class CatalanPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/clock/era steps need the
        // number and its suffix still adjacent, which the tier would break.
        return spirantizeAcrossWords(assembleClauses(SYMBOLS(normalizeCatalan(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(wordIpa(nat(m[1])));
            else if (m[2]) sink.emit(numberTokenToWords(m[2]).split(" ").map(wordIpa).join(" "));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        }));
    }
}

/** Build the Catalan phonemizer (rule g2p + the manifest + the two word lists named in the header). */
export function createCatalan(): Phonemizer {
    return new CatalanPhonemizer();
}
