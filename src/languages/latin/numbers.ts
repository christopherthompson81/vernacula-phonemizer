/**
 * Classical Latin number → words. A compositor for 0–999,999,999,999 (before this the la engine passed digit
 * strings straight through, so `phonemize("18", "la")` leaked "18" into the IPA).
 *
 * SOURCE: Allen & Greenough, *New Latin Grammar* §§132–138 (the cardinal-numeral table, the subtractive
 * duodē-/ūndē- forms, and the mīlle / mīlia rule); cross-checked against Gildersleeve & Lodge §§94–97 and
 * Wiktionary's Latin numeral entries. Spellings are MACRONIZED because the la g2p reads vowel length off the
 * macron (see latin.ts) — an unmacronized ⟨unus⟩ would surface as [ˈʊnʊs] instead of [ˈuːnʊs].
 *
 * ── The three things that make Latin not a plain units/tens/hundreds table ────────────────────────────────
 *  1. **★ SUBTRACTIVE 18/19 and x8/x9.** The standard Classical forms for the last two of every decade are
 *     built DOWN from the next ten: 18 duodēvīgintī ("two from twenty"), 19 ūndēvīgintī, 28 duodētrīgintā,
 *     29 ūndētrīgintā, … 88 duodēnōnāgintā, 98 duodēcentum, 99 ūndēcentum (A&G §133). This is not a stylistic
 *     variant — it is the expected reading, so it is what this emits; the additive alternatives
 *     (octōdecim, vīgintī novem) are not produced.
 *  2. **mīlle vs mīlia.** 1000 is the indeclinable adjective `mīlle` (bare — no *ūnum mīlle); every higher
 *     multiple is the NEUTER PLURAL NOUN `mīlia` counted by a neuter numeral: duo mīlia, tria mīlia,
 *     ducenta mīlia (A&G §138).
 *  3. **Inflection.** 1–3 and the hundreds decline. The CITATION FORM chosen here is the MASCULINE NOMINATIVE
 *     (ūnus, duo, trēs, ducentī, trecentī, …) — the dictionary/paradigm form, and the one a reader hears as
 *     "the numeral" out of context. 4–100 and the subtractive compounds are indeclinable anyway. The ONE place
 *     the citation form is overridden is a count of `mīlia`, where the neuter is structural rather than
 *     contextual (see `neuter`): ūnus→ūna, trēs→tria, ducentī→ducenta.
 *
 * ── ZERO and the MILLIONS: two documented departures from Classical usage ─────────────────────────────────
 * Classical Latin has NO cardinal zero and NO word for a million. Both are unavoidable for a TTS over arbitrary
 * digit strings, so:
 *   - 0 → `nihil` ("nothing"), the conventional Latin stand-in.
 *   - 10⁶ → `mīlliō` (pl. mīlliōnēs), 10⁹ → `mīlliardum` (pl. mīlliarda) — the standard NEO-LATIN coinages.
 *     The Classical expression for a million is the numeral-adverb periphrasis `deciēs centēna mīlia`
 *     ("ten times a hundred thousand", A&G §138.b), which does not generalise: 2,000,000 needs `vīciēs`,
 *     3,000,000 `triciēs`, and there is no adverb series to lean on past a few million. mīlliō composes.
 * Both are flagged here rather than silently naturalised.
 */

// Cardinals 0–9 (masculine nominative citation forms). 0 = nihil, the Classical stand-in for a zero cardinal.
const UNITS = ["nihil", "ūnus", "duo", "trēs", "quattuor", "quīnque", "sex", "septem", "octō", "novem"];
// 10–19. NOTE 18/19 are the SUBTRACTIVE forms (A&G §133), not *octōdecim / *novendecim.
const TEENS = [
    "decem", "ūndecim", "duodecim", "tredecim", "quattuordecim",
    "quīndecim", "sēdecim", "septendecim", "duodēvīgintī", "ūndēvīgintī",
];
// Round tens, keyed by VALUE. "100" is present because the x8/x9 subtractives build on the NEXT ten, and the
// next ten after 90 is centum (98 duodēcentum, 99 ūndēcentum).
const TENS: Record<string, string> = {
    "20": "vīgintī", "30": "trīgintā", "40": "quadrāgintā", "50": "quīnquāgintā", "60": "sexāgintā",
    "70": "septuāgintā", "80": "octōgintā", "90": "nōnāgintā", "100": "centum",
};
// Round hundreds 100–900 (masculine nominative plural from 200 up; centum is indeclinable).
const HUNDREDS = [
    "", "centum", "ducentī", "trecentī", "quadringentī",
    "quīngentī", "sescentī", "septingentī", "octingentī", "nōngentī",
];
const MAGNITUDES = {
    thousandSingular: "mīlle", // indeclinable adjective, used bare for exactly 1000
    thousandPlural: "mīlia", // neuter plural noun, counted by a neuter numeral
    millionSingular: "mīlliō", millionPlural: "mīlliōnēs",
    billionSingular: "mīlliardum", billionPlural: "mīlliarda",
};

/**
 * Neuter-plural agreement for a count of `mīlia` (tria mīlia, ducenta mīlia, vīgintī ūna mīlia). Only three
 * words in the table are not already indeclinable: ūnus→ūna, trēs→tria, and the -ī hundreds→-a. `duo` is
 * identical in the neuter nominative, so it needs no entry.
 */
function neuter(phrase: string): string {
    return phrase
        .split(" ")
        .map((w) => (w === "ūnus" ? "ūna" : w === "trēs" ? "tria" : /ntī$/u.test(w) ? w.slice(0, -1) + "a" : w))
        .join(" ");
}

/** 1–99. Tens-first for the additive compounds (vīgintī ūnus, A&G §133), subtractive for every x8/x9. */
function underHundred(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const t = Math.floor(n / 10) * 10, u = n % 10;
    // ★ SUBTRACTIVE: the last two of each decade count DOWN from the next ten (28 duodētrīgintā, 99 ūndēcentum).
    if (u === 8) return "duodē" + TENS[String(t + 10)]!;
    if (u === 9) return "ūndē" + TENS[String(t + 10)]!;
    return TENS[String(t)]! + (u ? ` ${UNITS[u]!}` : "");
}

/** A magnitude group: bare singular for a count of 1 (mīlle, mīlliō), else count + the plural. */
function magnitude(count: number, singular: string, plural: string, neuterCount: boolean): string {
    if (count === 1) return singular;
    const c = compose(count);
    return `${neuterCount ? neuter(c) : c} ${plural}`;
}

function compose(n: number): string {
    if (n < 100) return underHundred(n);
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        return HUNDREDS[h]! + (r ? ` ${compose(r)}` : "");
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        return magnitude(th, MAGNITUDES.thousandSingular, MAGNITUDES.thousandPlural, true) + (r ? ` ${compose(r)}` : "");
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000), r = n % 1_000_000;
        return magnitude(m, MAGNITUDES.millionSingular, MAGNITUDES.millionPlural, false) + (r ? ` ${compose(r)}` : "");
    }
    const b = Math.floor(n / 1_000_000_000), r = n % 1_000_000_000;
    return magnitude(b, MAGNITUDES.billionSingular, MAGNITUDES.billionPlural, false) + (r ? ` ${compose(r)}` : "");
}

/** Non-negative integer → Classical Latin words. Out-of-range input falls back to digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(n)].filter((c) => c >= "0" && c <= "9").map((d) => UNITS[Number(d)]!).join(" ");
    }
    if (n === 0) return UNITS[0]!; // nihil
    return compose(n).replace(/\s+/gu, " ").trim();
}
