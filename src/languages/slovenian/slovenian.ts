/**
 * Slovenian (sl) phonemizer — canonical IPA, slovenščina. Rule g2p (g2p.ts): consonant scan +
 * l-vocalization + lj/nj + syllabic-r + voicing/devoicing. STRESS is emitted as ˈ before the stressed nucleus,
 * from stress.tsv (37340 words, kaikki/Wiktionary), reaching 42.6% of polysyllabic sl_si corpus tokens, with a PENULTIMATE fallback out of lexicon. Vowel
 * quality/length are still unwritten and unfolded.
 *
 * ⚠ STRESS ONLY, NO TONE — AND THE SOURCE SETTLES THAT RATHER THAN A JUDGEMENT CALL. Slovene has two accepted
 * standard norms, and the kaikki dump labels every pronunciation with which one it is ("phoneme, tonal variety"
 * against "phoneme, non-tonal variety"). The non-tonal (stress + length) norm is the broadcast standard and what
 * most speakers use; the tonemic norm is a minority standard. So unlike the sibling sr/hr/bs engine — where the
 * four-way pitch accent IS the system and is emitted as Chao letters — Slovene gets position and nothing else.
 * docs/investigations/south_slavic_stress_sources_investigation.md. text() tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { normalizeSlovenian } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

/**
 * Lexical stress: word → 0-based ordinal of the stressed NUCLEUS. Built by
 * tools/slovenian/build_sl_stress_lexicon.py from the ACCENTED ORTHOGRAPHY (robót, rávən) in the kaikki
 * Slovene dump, not from its IPA — the mark already sits on the letter this g2p will pronounce, so the two
 * cannot drift apart on nucleus count.
 */
let STRESS: Map<string, number> | undefined;
function stressDict(): Map<string, number> {
    if (STRESS === undefined) STRESS = loadTsvMap(import.meta.url, "stress.tsv", (v) => Number(v));
    return STRESS;
}

/** Whether the lexicon knows this word's stress. ⚠ EXPORTED BECAUSE ABSENCE IS INVISIBLE IN THE OUTPUT: an
 *  OOV polysyllable is emitted with a FALLBACK ˈ that looks exactly like a lexicon one, so an eval cannot
 *  otherwise separate "known" from "guessed". Same reason serbian.ts exports accentLexiconHas. */
export function stressLexiconHas(word: string): boolean {
    return stressDict().has(word.toLowerCase());
}

/**
 * One Slovene word → canonical IPA, with ˈ before the stressed nucleus.
 *
 * ⚠ THE FALLBACK IS PENULTIMATE, AND THAT WAS MEASURED RATHER THAN INHERITED. The sibling Serbo-Croatian
 * engine falls back to the FIRST nucleus, which is right for it (66.8% baseline there) and wrong here:
 * against this lexicon, first-nucleus scores 43.5% by type / 51.7% by token where penultimate scores
 * **57.2% / 76.1%**. Antepenultimate ties by type (56.8%) and is far worse by token (56.7%); last-nucleus is
 * 6%. Copying the sibling's rule would have cost 24 points of token accuracy.
 *
 * ⚠ THE TOKEN FIGURE IS MEASURED ON LEXICON-COVERED WORDS, so it is a frequent-word number and the OOV
 * population it actually applies to is likelier to behave like the 57.2% type figure. Both are stated
 * because the optimistic one is not the one the fallback will be judged on.
 *
 * A monosyllable takes no mark — position carries no information there, and marking every one would put a
 * stress on the clitics (v, in, na, ki, za) that carry most of the OOV misses.
 */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nuclei: number[] = [];
    for (let i = 0; i < segs.length; i++) if (segs[i]!.nucleus) nuclei.push(i);
    if (nuclei.length < 2) return segs.map((s) => s.ph).join("");
    const known = stressDict().get(word.toLowerCase());
    const at = known !== undefined && known < nuclei.length ? known : nuclei.length - 2;
    const mark = nuclei[at]!;
    return segs.map((s, i) => (i === mark ? "ˈ" + s.ph : s.ph)).join("");
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_CLASS = "[A-Za-zČčŠšŽžĆćĐđ]";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
 */
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * Slovene count-form selector — index into a five-slot `CountForms` array:
 *
 *     0 sg (1)   1 DUAL (2)   2 paucal (3–4)   3 gen.pl (5+)   4 gen.sg (a decimal)
 *
 * NOT the shared `slavicCountForm`, which is wrong for Slovene twice over. Slovene has a LIVING DUAL, so
 * 1 / 2 / 3–4 / 5+ are four distinct forms — *en odstotek · dva odstotka · trije odstotki · pet odstotkov*
 * — where the shared three-way selector collapses the dual into the paucal and would read `2 %` as
 * *dva odstotki*. And it is keyed on the WHOLE numeral rather than its final digits, because a Slovene
 * compound takes the genitive plural whatever it ends in (*dvaindvajset odstotkov*, never the Russian
 * *dvaindvajset odstotek* nor the Czech *dvaindvajset odstotki*).
 *
 * The fifth slot is the genitive SINGULAR a decimal governs: *2,4 gigaherca*, *1,5 kilometra* (the corpus
 * writes `1,5 kilometra na sekundo` and `1,5 ure` — both genitive singular). `numValue` in the tier hands a
 * decimal through as `int + 0.5`, so a non-integer is exactly the decimal case.
 *
 * SOURCED FROM THIS ENGINE'S OWN DATA, not from a sibling language: `numbers.ts` has selected the magnitude
 * form with `count === 1 ? sg : count === 2 ? dual : count <= 4 ? paucal : plural` since bringup, and
 * slovenian.jsonc documents it ("Slovene numerals 2–4 AGREE with the gender of the counted magnitude
 * noun … Compound counts (22 milijonov) use the plain form + the plural noun"). All four `odstotek` forms
 * are attested in the sl_si corpus: odstotek ×1, odstotka ×1, odstotki ×1, odstotkov ×11.
 *
 * Declared HERE, beside the tier that consumes it, so the two cannot drift apart, and so the module graph
 * has no initialisation cycle (normalize.ts imports this file, never the reverse at init time).
 */
export const slCountForm = (n: number): number =>
    !Number.isInteger(n) ? 4 : n === 1 ? 0 : n === 2 ? 1 : n <= 4 ? 2 : 3;

/** A counted noun in the five slots `slCountForm` indexes, plus its grammatical GENDER — which the tier
 *  does not need but normalize.ts step 15 does, because Slovene marks gender on the numerals 1–4 and the
 *  tokenizer reads a bare digit as the feminine form. */
interface Counted {
    readonly g: "m" | "f";
    readonly forms: readonly [string, string, string, string, string];
}
const C = (g: "m" | "f", ...forms: readonly string[]): Counted =>
    ({ g, forms: forms as unknown as Counted["forms"] });

/**
 * The counted nouns this layer can emit. Kept in the ENGINE file (not normalize.ts) so the review
 * tool's sourcing check can read the declaration, and shared with normalize.ts's gender repair so the two
 * cannot disagree about a form.
 *
 * SOURCING, token-level against the sl_si corpus unless noted: odstotek ×1 / odstotka ×1 / odstotki ×1 /
 * odstotkov ×11; kilometra ×1 / kilometrov ×6 (kilometer in the wikipron slv referee); metra ×1 /
 * metrov ×7; milimeter in the referee; milje ×3 / milj ×26; stopinj ×2 (`s temperaturami nad 90 stopinj`);
 * dolarjev ×8; evrov ×1 (evro in the referee); funtov ×5 (funt in the
 * referee); jenov ×2. The SI stems `centimeter`, `kilogram`, `gigaherc` and `megabit` have no in-repo
 * attestation and are the orthographic expansions of the abbreviations the corpus writes (cm, kg ×2,
 * GHz ×2, Mbit ×1) — see the SOURCING paragraph in normalize.ts.
 *
 * `g` (gram) and `mi` (mile) are DELIBERATELY ABSENT. The corpus's only number-adjacent `g` is `802.11g`,
 * the Wi-Fi standard, so declaring it would read that letter as *gram*; and `mi` is the Slovene pronoun
 * "we". Both are the `Il-76s` hazard from the Dutch migration — a short unit key that is confidently wrong
 * is worse than the raw letter it replaces.
 */
export const COUNTED: Readonly<Record<string, Counted>> = {
    km: C("m", "kilometer", "kilometra", "kilometri", "kilometrov", "kilometra"),
    m: C("m", "meter", "metra", "metri", "metrov", "metra"),
    mm: C("m", "milimeter", "milimetra", "milimetri", "milimetrov", "milimetra"),
    cm: C("m", "centimeter", "centimetra", "centimetri", "centimetrov", "centimetra"),
    kg: C("m", "kilogram", "kilograma", "kilogrami", "kilogramov", "kilograma"),
    ghz: C("m", "gigaherc", "gigaherca", "gigaherci", "gigahercev", "gigaherca"),
    mbit: C("m", "megabit", "megabita", "megabiti", "megabitov", "megabita"),
    // `mph` is a RATE abbreviation, not a composable unit — the denominator is inside the noun phrase, so
    // the whole reading is the form. The corpus spells it out five times (`105 milj na uro`).
    mph: C("f", "milja na uro", "milji na uro", "milje na uro", "milj na uro", "milje na uro"),
    // Not a tier unit: the degree sign is claimed in normalize.ts step 9, because the scale letter sits
    // between the number and the noun. Declared here so the gender repair and the count agreement are the
    // same code path as every other noun.
    deg: C("f", "stopinja", "stopinji", "stopinje", "stopinj", "stopinje"),
    pct: C("m", "odstotek", "odstotka", "odstotki", "odstotkov", "odstotka"),
    usd: C("m", "dolar", "dolarja", "dolarji", "dolarjev", "dolarja"),
    eur: C("m", "evro", "evra", "evri", "evrov", "evra"),
    gbp: C("m", "funt", "funta", "funti", "funtov", "funta"),
    jpy: C("m", "jen", "jena", "jeni", "jenov", "jena"),
};
const F = (k: string): string[] => [...COUNTED[k]!.forms];

/**
 * SYMBOL NORMALIZATION — Slovenian. There was NO tier here before, so every sign class in this
 * language was unread: `km` reached the sink as the raw letters [km], `km²` dropped its exponent, `/h` read
 * as [x], `mm2` read the ASCII 2 as the number *dva*, and `%` was dropped outright.
 *
 *   percent  the corpus writes `odstotkov` 11 times and `%` 4 times (93 %, 88 %, 80 %, 3 %).
 *   currency ZERO currency SIGNS occur in sl_si, but the nouns all do (dolarjev ×8, evrov ×1, funtov ×5,
 *            jenov ×2) and a dropped sign is inaudible, so the four signs are declared. `USD` is
 *            declared as a compound KEY because the corpus's one ISO code carries a real amount
 *            (`10 milijard evrov (14,7 milijard USD)`), and the tier's letter-code support (Polish `zł`)
 *            is exactly for that.
 *   units    km ×23, milj ×26 (spelled, see normalize step 12), m ×4, mm ×3, kg ×2, km²/km2 ×3, mm2 ×1,
 *            GHz ×2, mph ×2, Mbit ×1.
 *   rate     `km/h` ×6, `m/s` ×1, `Mbit/s` ×1 → *NA uro* / *NA sekundo*, the accusative that Slovene `na`
 *            governs; the corpus spells both out (`240 kilometrov na uro`, `1,5 kilometra na sekundo`).
 *   exponent `km²` ×2, `km2` ×1, `mm2` ×1 → *kvadratnih kilometrov* — an agreeing adjective BEFORE the
 *            noun, as in Russian, and the corpus writes `kvadratnih` ×6 and `kubičnih` ×1 itself.
 *
 * COUNT AGREEMENT uses `slCountForm`, not `slavicCountForm` — see its comment above.
 */
export const SYMBOLS = makeSymbolNormalizer({
    // Written as LITERAL arrays, not `F("pct")`, so `normalization/review.ts`'s sourcing check can read the
    // declaration — it greps the tier's source for `percent: [...]` and `currency: { ... }`, and a helper
    // call makes the whole check inert. The `tierMatchesCounted` test pins them against COUNTED so the two
    // copies cannot drift.
    // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "krat" },
    percent: ["odstotek", "odstotka", "odstotki", "odstotkov", "odstotka"],
    currency: {
        "$": ["dolar", "dolarja", "dolarji", "dolarjev", "dolarja"],
        "USD": ["dolar", "dolarja", "dolarji", "dolarjev", "dolarja"],
        "€": ["evro", "evra", "evri", "evrov", "evra"],
        "£": ["funt", "funta", "funti", "funtov", "funta"],
        "¥": ["jen", "jena", "jeni", "jenov", "jena"],
    },
    units: {
        km: F("km"), m: F("m"), mm: F("mm"), cm: F("cm"), kg: F("kg"),
        ghz: F("ghz"), mbit: F("mbit"), mph: F("mph"),
    },
    magnitudes: [
        "milijon", "milijona", "milijoni", "milijonov",
        "milijarda", "milijardi", "milijarde", "milijard", "tisoč",
    ],
    unitPer: "na",
    rateDenominators: { h: "uro", s: "sekundo" },
    exponentWords: {
        squared: ["kvadratni", "kvadratna", "kvadratni", "kvadratnih", "kvadratnega"],
        cubed: ["kubični", "kubična", "kubični", "kubičnih", "kubičnega"],
        position: "before",
    },
    countForm: slCountForm,
});

class SlovenianPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts owns the whole pre-tokenizer pass and calls the shared symbol tier itself, at
        // the one point in its numbered sequence where the number is still adjacent to its unit and still
        // carries its decimal comma (step 14).
        return assembleClauses(normalizeSlovenian(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤15 digits stays a safe integer → hand to numberToWords (which composes <1e12 and reads the rest
                // digit-by-digit); 16+ digits → read the raw string so the float conversion can't lose precision.
                const words = m[2].length <= 15 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Slovenian phonemizer (rule g2p + cardinal numbers; stress deferred). */
export function createSlovenian(): Phonemizer {
    return new SlovenianPhonemizer();
}
