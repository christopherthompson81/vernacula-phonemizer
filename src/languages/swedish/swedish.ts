/**
 * Swedish (sv) phonemizer — Central Standard Swedish (rikssvenska), canonical IPA. Rule-based
 * g2p (g2p.ts) + the NST accent/stress lexicon: tonal word accent 1/2 (accent-2 = combining grave on the
 * primary-stressed vowel) + non-initial stress, falling to first-syllable stress + shape-based accent for OOV
 * words + NST secondary stress for compounds (ˌ + boundary-safe vowel length/quality + 2nd-onset softening). A
 * small exception map covers irregular function words. text() tokenizes words / numbers / punctuation. Accent
 * validated at ~96% vs the independent wikipron ¹/² markers (tools/eval/sv-accent-eval.mts).
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { toSegments, type Compound } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeSwedish, normalizeSwedishInitialisms } from "./normalize.ts";
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

// The accent lexicon (accent-stress.tsv, from the CC0 NST leksikon): word → pitch accent 1|2 + the primary-stress
// nucleus ordinal where it deviates from the first syllable. OOV words fall to the rule (first-syllable stress;
// accent by the swedishAccentRule). See tools/gen/build-sv-lexicon.mts +.
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

/** NFC fold, hoisted OUT of `text()` on purpose. `normalization/review.ts`'s trap-6 check scans `text()`
 *  bodies for word literals that never reach the g2p, and `"NFC"` is a two-letter-plus Latin string the
 *  Swedish g2p happily reads as [ɛnː ɛfː seː] — so the argument of `.normalize()` reported as an
 *  unphonemized spelling. It is the first false positive that check has produced (see the PR); moving the
 *  call out of the scanned body costs nothing and keeps the check meaningful. */
const nfc = (s: string): string => s.normalize("NFC");
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+(?:[.,]\\d+)?)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zåäöéA-ZÅÄÖÉ]";
/** ⚠ EXPORTED FOR THE EVAL, and that is a finding rather than a convenience. `tools/eval/sv-accent-eval.mts`
 *  called `phonemizeWord` directly, but `text()` calls `phonemizeWord(nat(w))` — so the eval was scoring a
 *  path the shipped engine never takes, and the accent number it reported was for a stage, not a product.
 *  It matters here specifically: `nat` folds ü→u BEFORE the lexicon is consulted, which is exactly the seam
 *  #1068 is about, so the one instrument that could have caught those readings was looking past them. */
export const nat = makeNativiser(NATIVE_CLASS, "u");

// symbol normalization — Swedish (procent/kilometer/dollar are invariant plurals).
const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — this language's OWN word, harvested from its existing `×` rule, so nothing new is
    // sourced. Declaring it here is what makes ASCII `x` read like `×`: `6x6 cm` read the `x` as a LETTER NAME,
    // and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` defaults to it.
    multiply: { times: "gånger" },
    percent: ["procent"],
    currency: { "€": ["euro"], "$": ["dollar"], "£": ["pund"] },
    // `m` added: 4 corpus instances of a bare metre (`4892 m`, `100 m`, `30 m`, and the `133 m/s`
    // denominator) were reaching the g2p as a bare [m].
    //
    // `ghz` and `mbit` WERE tried, reverted, and are now back, because the reason for reverting did not
    // survive being measured against the alternative. Undeclared, `2,4 GHz` reads [ɡhs] and `600 Mbit/s`
    // reads [mbiːt s] — unpronounceable clusters. Declared, they read [jˈiːɡahɛʈs] and [mˈeːɡabiːt], the
    // right words with ⟨g⟩ softened before a front vowel. That softening is a SYSTEMATIC g2p gap in
    // loanwords, not something this declaration causes: `gitarr` reads [jɪtˈarː] for /ɡɪˈtar/ with no
    // symbol tier involved at all. So the declaration is CORRECT and only the g2p is wrong — which also
    // means a later g2p fix repairs these for free, where leaving the letters raw stays wrong forever.
    // A recognisable word with one wrong segment beats a cluster that is not a word.
    // UNIT BORROWINGS are the class §5e excludes from the sourcing check by measurement — gigahertz and
    // megabit are absent from every in-repo Swedish source, as kilogram and millimetre are in some thirty
    // languages. The corpus writes the abbreviation `Mbit` ×3 and never the expansion.
    units: { km: ["kilometer"], m: ["meter"], cm: ["centimeter"], mm: ["millimeter"],
        kg: ["kilogram"], ghz: ["gigahertz"], mbit: ["megabit"] },
    // `h`/`s` MOVED out of `units` into rateDenominators, and `t`/`min` added. The tier's own header
    // records why a one-letter denominator must not be standalone-matchable (the Dutch `Il-76s` →
    // *zesenzeventig seconde*), and this corpus has the same shape in `Il-76:or`. Measured: 0 bare `N h`
    // and 0 bare `N s` in sv_se, so the move changes no reading — it removes a latent misfire. `t` is the
    // Swedish variant denominator (`160 km/t`, 1 instance, previously [km t]).
    rateDenominators: { h: "timme", t: "timme", s: "sekund", min: "minut" },
    unitPer: "per", // the /h was reaching the g2p as a bare letter
    // Swedish COMPOUNDS the measure word onto the unit: kvadratkilometer, one word — hence "before".
    exponentWords: { squared: ["kvadrat"], cubed: ["kubik"], position: "compound" },
    magnitudes: ["miljoner", "miljon", "miljarder", "miljard"],
});

class SwedishPhonemizer implements Phonemizer {
    text(input: string): string {
        // NFC first so decomposed å/ä/ö/é tokenize as single letters (the TOKEN class matches only precomposed).
        // order: normalize.ts, then the INITIALISM pass (which must see abbreviations already expanded
        // and the inflectional colon already resolved), then the shared symbol tier — which still needs to
        // see number–unit adjacency, so normalize.ts leaves digits as digits.
        const normalized = SYMBOLS(normalizeSwedishInitialisms(normalizeSwedish(input)));
        return assembleClauses(nfc(normalized), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(/[.,]/);
                for (const wd of numberToWords(Number(intPart), intPart).split(" ")) sink.emit(phonemizeWord(wd));
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
