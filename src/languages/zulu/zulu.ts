/**
 * Zulu (zu) phonemizer — canonical IPA, espeak-independent and AUTHORED beyond-espeak. Rule g2p (g2p.ts) +
 * Nguni penultimate stress with vowel LENGTHENING (the penult vowel takes ˈ and ː) + a lexical TONE overlay.
 * Zulu tone is not derivable from spelling, so it is overlaid from tone.tsv (kaikki/Wiktionary-derived, one
 * H/L/F/R code per vowel nucleus, placed after the vowel and its length); out-of-lexicon words are left untoned.
 * See docs/investigations/zu_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeZulu } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

const TONE_CHAO = MANIFEST.toneChao;

// Tone lexicon: word → per-vowel tone codes (H/L/F/R). Out-of-lexicon words are left untoned.
let TONE: Map<string, string> | undefined;
function toneLexicon(): Map<string, string> {
    if (TONE === undefined)
        TONE = loadTsvMap(import.meta.url, "tone.tsv", (v) => v.trim(), {
            optional: true,
        });
    return TONE;
}

const SPLIT = /(?<=.)(?=[A-Z][a-z])/u; // compound boundary: before an internal Titlecase run

/** Phonemize a (possibly camelCase-compound) Zulu word to an array of IPA words. A compound whose FULL form is
 *  in the tone lexicon (isingisi→HLHL) threads those codes across its split parts, since espeak overlays the
 *  compound's tone across the whole word even though it splits on the internal capital. */
export function phonemizeCompound(word: string): string[] {
    const parts = word.split(SPLIT);
    if (parts.length === 1) return [phonemizeWord(word)];
    // espeak tones only whole-word lexicon hits: if the full compound isn't listed, the whole word is untoned
    // (isiTsonga → untoned, even though standalone "isi" carries tone).
    const codes = toneLexicon().get(word.toLowerCase());
    if (codes === undefined) return parts.map((p) => phonemizeWord(p, ""));
    const out: string[] = [];
    let ci = 0;
    for (const p of parts) {
        const nv = toSegments(p).filter((s) => s.v).length;
        out.push(phonemizeWord(p, codes.slice(ci, ci + nv)));
        ci += nv;
    }
    return out;
}

/** One Zulu word → canonical IPA: segments + penultimate stress/length + lexical tone overlay. */
export function phonemizeWord(word: string, toneCodes?: string): string {
    const segs = toSegments(word);
    const vowelIdx = segs.map((s, i) => (s.v ? i : -1)).filter((i) => i >= 0);
    if (vowelIdx.length === 0) return segs.map((s) => s.ph).join("");
    // Nguni penultimate stress: ˈ + ː on the penult vowel (the only vowel if monosyllabic).
    const stressIdx =
        vowelIdx.length >= 2 ? vowelIdx[vowelIdx.length - 2]! : vowelIdx[0]!;
    const codes = toneCodes ?? toneLexicon().get(word.toLowerCase()) ?? "";
    let out = "",
        vi = 0;
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (s.v) {
            if (i === stressIdx) out += `ˈ${s.ph}ː`;
            else out += s.ph;
            out += TONE_CHAO[codes[vi] ?? ""] ?? ""; // tone after the vowel (and its length)
            vi++;
        } else out += s.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([A-Za-z]+)|(\d+)|([.!?…,;:])/gu;

// #562 symbol normalization — Zulu: loan plurals (amaphesenti, amadola, amakhilomitha).
//
// EVERY NOUN HERE IS POSTPOSED, which is the tier's default and is right for Zulu for a non-obvious
// reason: the corpus writes a measure noun BEFORE its numeral (`amakhilomitha angu-1,600`), but the
// head-noun slot in the shapes this tier claims is ALREADY FILLED by the relative-concord + copulative
// prefix the text hyphenates onto the digits (349 instances — see normalize.ts). Emitting the noun first
// would double that copulative (`ingu-amamilimitha angu-36` for `ingu-36mm`) or strand it
// (`ka-amamilimitha angu-35` for `Ifomethi ka-35mm`). Postposed keeps `ingu-36 amamilimitha`.
//
// `US$` and `AUD$` are MULTI-CHARACTER KEYS. Without them the tier's `$` is letter-bounded on the left,
// so `ku-US$11,000` matched nothing and the sign was DROPPED (`mine.ts scan`: DROP currency ×1) while the
// `US` reached the g2p as the cluster [ˈuːs]; `engu-AUD$45` reported REDUNDANT for the same reason. Both
// codes are attested in the corpus, keyed to the sign exactly as the Polish/Malay runs intended.
//
// `exponentWords.squared` = `skwele`, position AFTER — which is verbatim the corpus's own order,
// `amakhilomitha skwele angu-783,562` ×3. Without it the `²` destroyed the unit match outright and
// `3,850 km²` read [… kʼm].
//
// NO `rateDenominators`/`unitPer`: Zulu's rate is ONE agglutinated word (nga- + ihora → `ngehora`, ×6)
// and this tier emits a rate as four tokens, so the rate is handled in normalize.ts. See the note there.
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language's OWN word, harvested from its existing `×` rule, so nothing new is
    // sourced. Declaring it here is what makes ASCII `x` read like `×`: `6x6 cm` read the `x` as a LETTER NAME,
    // and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` defaults to it.
    multiply: { times: "kuphindwe ngo-" },
    percent: ["amaphesenti"],
    currency: { "US$": ["amadola"], "AUD$": ["amadola"], "$": ["amadola"], "£": ["amaphawundi"] },
    units: {
        km: ["amakhilomitha"], m: ["amamitha"], mm: ["amamilimitha"], cm: ["amasentimitha"],
        kg: ["amakhilogremu"], mi: ["amamayela"], ft: ["amafidi"],
    },
    exponentWords: { squared: ["skwele"], position: "after" },
});

class ZuluPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — the era, clock, range, rate and degree steps
        // all need the number and its neighbour still adjacent, which the tier would break. The one rule
        // that breaks adjacency the other way (the decimal rewrite) claims its own currency sign and unit.
        return assembleClauses(SYMBOLS(normalizeZulu(input)), TOKEN, (m, sink) => {
            // Compound (noun-class prefix + Titlecase stem, eNingizimu / INingizimu) splits before an internal
            // Titlecase run; a full-word tone-lexicon hit is threaded across the parts.
            if (m[1]) for (const part of phonemizeCompound(m[1])) sink.emit(part);
            // Numbers are ordinary Zulu nouns: tone them via the lexicon like any other word (ishumi→toned), rather
            // than mirroring espeak's untoned number path — the kaikki/Wiktionary referee confirms they carry tone.
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}
export function createZulu(): Phonemizer {
    return new ZuluPhonemizer();
}
