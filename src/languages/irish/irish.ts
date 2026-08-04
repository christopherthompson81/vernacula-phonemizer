/**
 * Irish Gaelic (ga) phonemizer — Standard/Connacht-leaning, canonical IPA, espeak-independent. Rule-based g2p
 * (g2p.ts, the broad/slender axis) + first-syllable stress (the native default) + i-offglide and svarabhakti
 * passes, with a Connacht pronunciation lexicon (lexicon.tsv, Run 3) pinning the semi-lexical vowel detail the
 * rules defer (io/oi/eo splits). Lexicon first, g2p for OOV. See docs/investigations/ga_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { type Seg, toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeIrish } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

// Connacht pronunciation lexicon (Run 3): oracle-distilled, consonant+glide-skeleton-verified overrides that pin
// the semi-lexical vowel-QUALITY detail the rules defer (io/oi/eo splits). Consulted before the g2p; OOV words
// fall through to the rules. Lazily loaded (like french/swedish) so merely importing this module — e.g. from the
// referee eval to score another language — does not parse the whole TSV. See lexicon.tsv.
let LEXICON: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEXICON === undefined) LEXICON = loadTsvMap(import.meta.url, "lexicon.tsv");
    return LEXICON;
}

// Short vowels reduce to ə when unstressed; long vowels + diphthongs (with ː) keep their quality. ɪ IS reduced:
// the independent wikipron referee transcribes unstressed short i as ə (féidir → fʲeːdʲəɾʲ, milis → mʲɪlʲəʃ),
// NOT the oracle's ɪ — espeak keeps the underlying i, but real Connacht centralizes it like a/o/u.
const SHORT = new Set(["a", "ɛ", "ɪ", "ɔ", "ʊ"]);

// A slender consonant (palatalized, or a palatal). A back vowel before a slender CODA gets an i-offglide.
const isSlenderC = (ph: string): boolean => ph.endsWith("ʲ") || ph === "c" || ph === "ɟ" || ph === "ʃ" || ph === "ç";
const BACK_V = new Set(["ɑː", "oː"]); // LONG back vowels only (áit, cóir); short a is inconsistent (gairm has none)
// /r/ or /l/ (broad or slender) triggers svarabhakti before a labial/velar/palatal consonant.
const LIQUID = new Set(["ɾˠ", "ɾʲ", "l̪ˠ", "lʲ"]);
const SVARABHAKTI_NEXT = new Set(["mˠ", "mʲ", "bˠ", "bʲ", "vˠ", "vʲ", "w", "ɡ", "ɟ", "x", "ç", "ɣ", "j", "n̪ˠ", "nʲ"]);

/** Long back vowel + a following slender consonant → insert an i-offglide ⁱ, whether that consonant is a coda
 *  (áit → ɑːⁱtʲ, cóir → oːⁱɾʲ) or an onset of the next syllable (óige → oːⁱɟə, áirithe → ɑːⁱɾʲə). A short back
 *  vowel (baile → balʲə), an ⟨eo⟩-derived oː (ceoil), or uː/iː/eː gets none. */
function offglide(segs: Seg[]): void {
    for (let i = segs.length - 1; i >= 1; i--) {
        const c = segs[i]!, prev = segs[i - 1]!;
        if (c.nucleus || !prev.nucleus) continue;
        if (isSlenderC(c.ph) && BACK_V.has(prev.ph) && !prev.noGlide) segs.splice(i, 0, { ph: "ⁱ", nucleus: false });
    }
}

/** Svarabhakti (epenthesis): a schwa between /r l/ and a following labial/velar/palatal (gorm → ɡɔɾˠəmˠ,
 *  bolg → bˠɔl̪ˠəɡ). /n/ does not trigger it (ainm → ˈanʲmˠ). */
function epenthesis(segs: Seg[]): void {
    for (let i = segs.length - 2; i >= 0; i--) {
        const coda = i + 2 >= segs.length || !segs[i + 2]!.nucleus; // the 2nd consonant must be a coda (bolg, not Gaeilge)
        if (coda && LIQUID.has(segs[i]!.ph) && SVARABHAKTI_NEXT.has(segs[i + 1]!.ph))
            segs.splice(i + 1, 0, { ph: "ə", nucleus: false });
    }
}

/** Native ⟨ng⟩ → ŋ (long → l̪ˠɔŋ), the word-final ɡ absorbed. Only before ɡ — not ⟨nc⟩, which stays n̪ˠk in the
 *  loanwords that have it (banc → bˠan̪ˠk). */
function nasalAssim(segs: { ph: string; nucleus: boolean }[]): void {
    for (let i = 0; i < segs.length - 1; i++)
        if ((segs[i]!.ph === "n̪ˠ" || segs[i]!.ph === "nʲ") && segs[i + 1]!.ph === "ɡ")
            segs[i]!.ph = "ŋ";
    const L = segs.length;
    if (L >= 2 && segs[L - 1]!.ph === "ɡ" && segs[L - 2]!.ph === "ŋ") segs.pop();
}

/** One Irish word → canonical IPA. Stress the first nucleus (native default; marked even on monosyllables);
 *  every OTHER short-vowel nucleus reduces to ə (unstressed reduction, e.g. madra → mˠˈad̪ˠɾˠə). */
export function phonemizeWord(word: string): string {
    const hit = lexicon().get(word.toLowerCase()); // Connacht lexicon override (semi-lexical vowel detail)
    return hit !== undefined ? hit : g2pWord(word);
}

/** The pure rule-based g2p (no lexicon) — the OOV path, and the reference the lexicon build compares against. */
export function g2pWord(word: string): string {
    const segs = toSegments(word.replace(/['’\-]/g, "")); // strip elision/prothesis apostrophes + hyphens
    if (segs.length === 0) return "";
    nasalAssim(segs);
    epenthesis(segs); // svarabhakti schwa (gorm → ɡɔɾˠəmˠ)
    offglide(segs); // i-offglide before a slender coda (áit → ɑːⁱtʲ)
    const nucleiIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nucleiIdx.length === 0) return segs.map((s) => s.ph).join("");
    const stress = nucleiIdx[0]!;
    for (const idx of nucleiIdx) if (idx !== stress && SHORT.has(segs[idx]!.ph)) segs[idx]!.ph = "ə";
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Irish groups thousands with COMMAS (1,400 — the TOKEN swallows the comma so the tier can still see the
// number next to its unit/sign); the dot is a DECIMAL (1.5 → "pointe") or a version, claimed by normalize.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "", "'’-")})|(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-záéíóúA-ZÁÉÍÓÚ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

// #562 symbol normalization — Irish: % is "faoin gcéad" (after the number, as written).
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "faoi" },
    percent: ["faoin gcéad"],
    currency: { "€": ["euro"], "$": ["dollar", "dollair"], "£": ["punt"], "¥": ["yen"] },
    // `m` ADDED so the cube reading below has a head noun at all: méadar ×12, and every digit-adjacent bare
    // `m` in this corpus is a metre — `100m agus 200m` (freestyle events), `100 troith (30 m)`, `133 m/s`.
    // That is the one-letter-key hazard checked rather than assumed, and here it comes back clean.
    units: { km: ["ciliméadar"], cm: ["ceintiméadar"], mm: ["milliméadar"], kg: ["cileagram"],
        m: ["méadar"] },
    // `méadar ciúbach` ×3 in the FLEURS corpus. The SQUARED word is ×0 there — and rather than leave the
    // artifact's own `19,500 km²` ×2 reading with the power dropped, it was sourced the way a zero corpus
    // count is supposed to be: `attest.ts` against ga.wikipedia, sense-checked on three examples.
    //   ciliméadar cearnach ×1  "cad é achar na cearnóige atá 2 ciliméadar ar leithead? 4 ciliméadar
    //                   cearnach atá an t-achar."  ← a MATHS-LESSON sentence, and it uses `cearnóg` for the
    //                   shape and `ciliméadar cearnach` for the unit in the same breath
    //   cearnach   ×1  "179.7 milliún km² (69.4 milliún míle cearnach)"   ← the modifier, POSTPOSED, in the
    //                   very sentence that writes km² as a symbol
    //   chearnach  ×1  "4,840 slat chearnach … (10,000 méadar cearnach)"  ← lenited after a feminine noun
    //   cearnacha  ×1  "174,600 ciliméadar, nó 67,400 míle cearnacha"     ← plural variant
    // ⚠ `cearnóg` ×1 is NOT this word: it is the noun "a square" ("Is cearnóg suite i gCathair Westminster
    // í Berkeley Square"), the same shape-vs-unit split that bare `carré`, `kare` and ਵਰਗ have here.
    // ONE INVARIANT FORM, matching `units`' single `ciliméadar` and the singular in two of the three
    // examples; the sources disagree about agreement (`4,840 slat chearnach` singular against `67,400 míle
    // cearnacha` plural), so a count-form split would be inventing a rule neither one settles.
    exponentWords: { squared: ["cearnach"], cubed: ["ciúbach"], position: "after" },
});

class IrishPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/era/version steps need
        // the number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeIrish(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) for (const wd of numberToWords(Number(m[2].replace(/,/gu, ""))).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Irish phonemizer (rule-based; the broad/slender axis is the core). */
export function createIrish(): Phonemizer {
    return new IrishPhonemizer();
}
