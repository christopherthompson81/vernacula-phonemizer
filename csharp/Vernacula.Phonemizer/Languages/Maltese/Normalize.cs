/**
 * Maltese / Malti (mt) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ MALTESE IS SEMITIC MORPHOLOGY IN A LATIN ORTHOGRAPHY AND IS ALONE IN THIS FLEET. Every word emitted here
 * is sourced from Maltese text; the Arabic layers were read for the QUESTIONS they ask and never for an
 * answer. The per-word sourcing — `fil-mija` at 140 tokens / 20 articles against the trap-37 competitor
 * `perċentwal` (the NOUN "percentage", never post-numeral), `punt` on two independent but weak tiers,
 * `fis-siegħa`/`fis-sekonda` as collocations in the numeral slot — is in the TypeScript original,
 * src/languages/maltese/normalize.ts, and is not restated here.
 *
 * ── THE ONE FACT THAT SHAPES EVERY RULE: THE HYPHEN IS THE DEFINITE ARTICLE ──────────────────────────────
 * Maltese writes `il-`/`l-` and its assimilated allomorphs BOUND to the following word with a hyphen, and
 * every preposition fuses with it too — 3,322 hyphens in 449 retained segments. A hyphen here is almost
 * never a range or a minus, which is why the MINUS rule is anchored on what PRECEDES the sign AND on what
 * FOLLOWS the number, and why there is NO range rule at all.
 *
 * ── COUNT AGREEMENT, MEASURED ───────────────────────────────────────────────────────────────────────────
 * Maltese takes the PLURAL after 2–10 and the SINGULAR from 11 up — the Semitic pattern — and a DECIMAL
 * takes the plural (~20 attested plural decimals against 8 singular). That is `CountForm` below, and it
 * governs every unit, currency and measure word this file emits.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Maltese;

public static class Normalize
{
    /** The best-attested word in this layer: 140 tokens / 20 articles, every hit postposed to a figure.
     *  ⚠ INVARIANT, deliberately — a prepositional phrase, not a countable noun, so one form for every
     *  numeral. It is the one place in this file where the agreement rule does not apply. */
    private const string PERCENT = "fil-mija";
    /** ⚠ THE WEAKEST SOURCING IN THIS FILE, said here rather than in a footnote: espeak's `_.` slot plus
     *  mt.wikipedia NAMING the mark definitionally. Two independent sources, neither of them a reader. */
    private const string DECIMAL_POINT = "punt";
    private const string DEGREE_SG = "grad";
    private const string DEGREE_PL = "gradi";
    private const string CELSIUS = "Ċelsju";
    private const string FAHRENHEIT = "Fahrenheit";
    private const string MINUS_WORD = "minus";
    private const string BCE = "Qabel Kristu";
    private const string CE = "Wara Kristu";

    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> UNITS =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometru", "kilometri" },
            ["m"] = new[] { "metru", "metri" },
            ["cm"] = new[] { "ċentimetru", "ċentimetri" },
            ["ċm"] = new[] { "ċentimetru", "ċentimetri" },
            ["mi"] = new[] { "mil", "mili" },
            ["ft"] = new[] { "pied" },
            ["sq mi"] = new[] { "mil kwadru", "mili kwadri" },
        };
    private static readonly IReadOnlyList<string> SQUARED = new[] { "kwadru", "kwadri" };
    private static readonly IReadOnlyList<string> CUBED = new[] { "kubu", "kubi" };
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> CURRENCY =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["€"] = new[] { "ewro" },
            ["$"] = new[] { "dollaru", "dollari" },
            ["£"] = new[] { "sterlina", "sterlini" },
        };

    /**
     * ⚠ THE `-il` LINKED FORMS ARE MAGNITUDES TOO. A Maltese teen takes the linker before a magnitude and
     * the corpus writes it after the DIGITS: `€12-il miljun`. The tier's magnitude alternation allows only
     * WHITESPACE between the number and the magnitude, so `12` matched, `-il miljun` did not, and the
     * currency word landed BETWEEN the numeral and its own magnitude — *tnaʃ EWRO ɪl mɪljun*. Declaring the
     * linked form as its own alternative makes `12-il miljun` one magnitude phrase; longest-first sorting
     * inside the tier puts these ahead of the bare words, and the linker survives.
     */
    private static readonly IReadOnlyList<string> MAGNITUDES = new[]
    {
        "-il miljun", "-il biljun", "-il elf",
        "miljun", "miljuni", "biljun", "biljuni", "elf", "elef", "triljun",
    };

    /** PLURAL after 2–10, SINGULAR from 11 up; a fraction takes the plural. */
    private static int CountForm(double n) => n == 1 || (n >= 11 && n % 1 == 0) ? 0 : 1;

    private static readonly JsRe SPACE_GROUPING = JsRegex.Compile("[ \\u00a0]", "gu");  // space, NBSP
    private static readonly JsRe NUMERAL_SHAPE =
        JsRegex.Compile("^(\\d+(?:[.,]\\d{3})*)(?:[.,](\\d+))?$", "");
    private static readonly JsRe SEPARATORS = JsRegex.Compile("[.,]", "g");

    /**
     * The numeral string → the value `CountForm` is asked about, for the two rules that resolve their own
     * agreement rather than going through the tier.
     *
     * ⚠ IT MUST AGREE WITH `Core/NormalizeSymbols.cs`'s `NumValue`, AND THE CORPUS DIFF IS WHAT CAUGHT IT NOT
     * DOING SO. A plain `Number()` makes the FRACTION invisible when the decimal is a whole value: `68.0 °F`
     * parsed to 68 and took the singular while `30.2 °F` in the same sentence took the plural — the split on
     * a trailing zero rather than on anything about the language. A fraction is detected from the STRING.
     * ⚠ AND THE THREE-DIGIT BLOCK IS GROUPING, not a decimal, which is the one ambiguous shape: this is the
     * tier's own expression character for character, copied rather than paraphrased because `NumValue` is
     * not exported. Whoever changes one must change both.
     */
    private static double NumeralValue(string num)
    {
        var cleaned = JsRegex.Replace(num, SPACE_GROUPING, "");
        var m = NUMERAL_SHAPE.Match(cleaned);
        if (!m.Success) return double.NaN;
        var intPart = Js.Number(JsRegex.Replace(m.Groups[1].Value, SEPARATORS, ""));
        return m.Groups[2].Success && m.Groups[2].Value.Length != 3 ? intPart + 0.5 : intPart;
    }

    // ── STEP 1. DIGIT DE-GROUPING — first, because a grouping comma is otherwise a CLAUSE PAUSE ──────────
    // ⚠ THE GUARD IS "EXACTLY THREE DIGITS AND NO DIGIT AFTER". mt.wikipedia writes the English convention
    // throughout (comma thousands, dot decimal) but lapses ONCE into the European one, `8,2 %`; a looser
    // rule would claim that and every genuine clause comma between two digits.
    // ⚠ AND THE LOOP IS REQUIRED: `9,750,000` needs two passes, because the first replacement consumes the
    // digit the second match would have started on.
    private static readonly JsRe DEGROUP =
        JsRegex.Compile("(?<=\\p{Nd})(?<!(?<![\\p{Nd}\\.,])0)[,](?=\\p{Nd}{3}(?!\\p{Nd}))", "gu");
    private static string Degroup(string text) => Rewrite(text, DEGROUP, "");

    // ── STEP 2. ERA ABBREVIATIONS — the multi-dot form BEFORE the single-dot one ─────────────────────────
    /** ⚠ THE SECOND DOT IS SOMETIMES A FULL STOP TOO, AND SWALLOWING IT MERGED TWO SENTENCES. The
     *  discriminator is the writer's own CAPITALISATION — the dot is re-emitted when the next non-space
     *  character is upper-case or the input ends, which is the same evidence a human reader has. */
    private static readonly JsRe SENTENCE_AFTER = JsRegex.Compile("^\\s*(?:\\p{Lu}|$)", "u");
    private static readonly JsRe QK_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])Q\\s?\\.\\s?K\\s?\\.", "giu");
    private static readonly JsRe WK_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])W\\s?\\.\\s?K\\s?\\.", "giu");
    /** ⚠ BOUNDED ON BOTH SIDES with letter lookarounds and not with `\b`: this orthography glues an article
     *  onto the front of everything with a hyphen, which is not a letter, so the LEFT guard alone would
     *  still admit `il-QK` — correct and intended. What the guard excludes is a match inside a longer
     *  all-caps token. Case-insensitive, because the artifact also writes `w.K.` */
    private static readonly JsRe QK_BARE = JsRegex.Compile("(?<![\\p{L}\\p{M}])QK(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe WK_BARE = JsRegex.Compile("(?<![\\p{L}\\p{M}])WK(?![\\p{L}\\p{M}])", "giu");

    private static string EraMarkers(string text)
    {
        var s = text;
        {
            var subject = s;
            s = Rewrite(s, QK_DOTTED, m =>
                SENTENCE_AFTER.IsMatch(subject[(m.Index + m.Length)..]) ? $"{BCE}." : BCE);
        }
        {
            var subject = s;
            s = Rewrite(s, WK_DOTTED, m =>
                SENTENCE_AFTER.IsMatch(subject[(m.Index + m.Length)..]) ? $"{CE}." : CE);
        }
        s = Rewrite(s, QK_BARE, BCE);
        return Rewrite(s, WK_BARE, CE);
    }

    // ── STEP 3. MINUS — narrowed by MEASUREMENT to the two contexts that are unambiguous ─────────────────
    /**
     * ⚠ THE RULE TAKES THE RIGHT CONTEXT AS THE DISCRIMINATOR: the number must be followed by a DEGREE or a
     * PERCENT sign. Enumerated over the retained text, the fleet's usual opener-only shape returns 14
     * candidates — 13 genuine negatives and one false positive, `fl -2021`, the article-fused preposition
     * with a stray space before its hyphen. The right context covers 12 of the 13 and ZERO of the false one.
     * The thirteenth (`-3.54 m`) is knowingly left: buying it would mean admitting a bare unit after the
     * sign, and `fl -2021` is one token away from that shape.
     * ⚠ THE LEFT GUARD DOES THE OTHER HALF, because in Maltese the character before a hyphen is usually a
     * LETTER: `it-43.8°C`, `it-48.1%` and `l-1%` are the definite article and would otherwise match exactly.
     * ⚠ RUNS BEFORE THE DEGREE STEP, while the `°` it inspects still exists — a guard's evidence has a
     * lifetime. The apostrophe is in the opener set for one attested reason: `ta '-35.5 °C`.
     */
    private static readonly JsRe MINUS_RE =
        JsRegex.Compile("(^|[\\s(‘’'\"“])[-−–](\\p{Nd}[\\p{Nd}.,]*)(?=\\s?[°%])", "gu");
    private static string MinusSign(string text) => Rewrite(text, MINUS_RE, $"$1{MINUS_WORD} $2");

    // ── STEP 4. °C AND °F — LOCAL, and the bare degree sign is DECLINED ──────────────────────────────────
    /**
     * ⚠ LOCAL RATHER THAN ON THE TIER because this rule must also decide the BARE degree sign, which the
     * tier has no path for — and the decision is to decline it. Of the 51 degree signs in the retained text,
     * 36 are `°C`/`°F` and the other 15 are COORDINATES plus one Richter magnitude. A bare-° rule would cut
     * a coordinate in half with no minutes/seconds reading to put back.
     * ⚠ RUNS BEFORE THE DECIMAL STEP, AND THE ORDER DECIDES THE AGREEMENT: read after it, `21.8 °C` would
     * arrive as `21 punt 8 °C`, the rule would take 8 as its numeral and emit the PLURAL where 21.8 takes
     * the singular.
     */
    private static readonly JsRe DEGREE_RE =
        JsRegex.Compile("(\\p{Nd}[\\p{Nd}.,]*)\\s?°\\s?([CF])(?![\\p{L}\\p{M}])", "gui");
    private static string Degrees(string text) => Rewrite(text, DEGREE_RE, m =>
    {
        var num = m.Groups[1].Value;
        var scale = m.Groups[2].Value;
        var n = NumeralValue(num);
        var word = double.IsNaN(n) || CountForm(n) == 1 ? DEGREE_PL : DEGREE_SG;
        // ⚠ `ToUpperInvariant` is exactly JS `toUpperCase` here BY CONSTRUCTION: the capture is `([CF])`
        // under the `i` flag, so the only values reachable are C, F, c and f.
        return $"{num} {word} {(scale.ToUpperInvariant() == "C" ? CELSIUS : FAHRENHEIT)}";
    });

    // ── STEP 5. THE RATE — LOCAL, because the idiom is not "A per B" ─────────────────────────────────────
    /**
     * Maltese says *kilometri FIS-SIEGĦA* / *kilometru FIS-SEKONDA* — a preposition fused with the definite
     * article and its noun, one lexicalised phrase. `UnitPer` is a single invariant string joining a
     * numerator to a SEPARATE denominator word, and there is no way to spell this with it: the tier would
     * emit the noun `siegħa` after the phrase that already contains it.
     * ⚠ THE DENOMINATOR TABLE IS CLOSED AND THE RESIDUAL IS STATED: `h` and `s` are the only two the corpus
     * writes. An UNLISTED denominator falls through to the tier, which matches the head unit and strands the
     * rest (`5 km/j` → *5 kilometri/j*) — that cannot be closed from here, because the tier's unit match ends
     * in a guard a `/` passes. Reported, not edited, and pinned in the suite so the day the guard lands the
     * assertion fails and says so.
     */
    private static readonly IReadOnlyDictionary<string, string> RATE_DENOMINATORS =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "fis-siegħa", ["s"] = "fis-sekonda" };
    /** ⚠ LONGEST-FIRST, so `sq mi` and `km` are tried before `m`. A stable sort by length descending, which
     *  is the TS's `sort((a, b) => b.length - a.length)` over the same insertion order. */
    private static readonly string UNIT_ALT =
        string.Join("|", UNITS.Keys.OrderByDescending(k => k.Length));
    private static readonly JsRe RATE_RE = JsRegex.Compile(
        $"(\\p{{Nd}}[\\p{{Nd}}.,]*)\\s?({UNIT_ALT})\\s?/\\s?({string.Join("|", RATE_DENOMINATORS.Keys)})(?![\\p{{L}}\\p{{M}}])",
        "gu");
    private static string Rates(string text) => Rewrite(text, RATE_RE, m =>
    {
        var num = m.Groups[1].Value;
        var forms = UNITS[m.Groups[2].Value];
        var n = NumeralValue(num);
        var noun = double.IsNaN(n) ? forms[^1] : (CountForm(n) < forms.Count ? forms[CountForm(n)] : forms[0]);
        return $"{num} {noun} {RATE_DENOMINATORS[m.Groups[3].Value]}";
    });

    // ── STEP 5b. THE `-il` LINKER BETWEEN A NUMBER AND A UNIT SYMBOL ─────────────────────────────────────
    /** A Maltese numeral from 11 up takes the linker `-il` before the noun it governs, written glued to the
     *  DIGITS (`16-il ċm`). The tier's number→unit pattern allows only whitespace there, so the unit fell
     *  through to the phoneme sink. The linker is MATCHED and RE-EMITTED, never stripped: it is a real
     *  morpheme of the spoken numeral. */
    private static readonly JsRe IL_UNIT_RE =
        JsRegex.Compile($"(\\p{{Nd}}[\\p{{Nd}}.,]*)-il\\s+({UNIT_ALT})(?![\\p{{L}}\\p{{M}}²³/])", "gu");
    private static string IlLinkedUnit(string text) => Rewrite(text, IL_UNIT_RE, m =>
    {
        var num = m.Groups[1].Value;
        var forms = UNITS[m.Groups[2].Value];
        var n = NumeralValue(num);
        var noun = double.IsNaN(n) ? forms[0] : (CountForm(n) < forms.Count ? forms[CountForm(n)] : forms[0]);
        return $"{num}-il {noun}";
    });

    // ── STEP 6. THE € SPELLING FOLD — one instance, and it exists to stop a DOUBLING ─────────────────────
    /** The tier suppresses its own currency word when the text already carries it, testing every DECLARED
     *  form. The artifact writes `€0.05 euro` and `euro` is not `ewro`, so the suppression cannot see it and
     *  the reading says the currency twice. ⚠ GUARDED TO THE POST-AMOUNT SLOT: the other `euro` instances
     *  are ordinary prose, and rewriting those would be a spelling reform, not a normalization. */
    private static readonly JsRe EURO_RE =
        JsRegex.Compile("(€\\s?\\p{Nd}[\\p{Nd}.,]*(?:\\s\\p{L}+)?\\s)euro(?![\\p{L}\\p{M}])", "giu");
    private static string EuroSpelling(string text) => Rewrite(text, EURO_RE, "$1ewro");

    // ── THE CLOCK, then STEP 8. THE DECIMAL POINT ────────────────────────────────────────────────────────
    /** ⚠ THE TIMEZONE IS IN THIS LIST BECAUSE `f'12.00 GMT` WAS NOT (#1102): it fell through to the decimal
     *  rule and read *tnaʃ punt zɛrɔ*, the exact confidently-wrong reading the guard exists to prevent. */
    private static readonly JsRe CLOCK_TAIL =
        JsRegex.Compile("^\\s?(?:[ap]\\s?\\.?\\s?m\\b|ta['’’]\\s?(?:filg|wara|bil)|(?:GMT|UTC|CET|CEST)\\b)", "iu");
    private static readonly JsRe CLOCK_COLON =
        JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe CLOCK_DOT =
        JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?![\\d:])", "gu");

    /**
     * ⚠ THE MINUTE-NOUN IS DELIBERATELY NOT EMITTED, because the corpus readers do not agree on it: 11:20 is
     * bare, 11:29 takes *minuta*, 7:19 the teen linker *dsatax-il minuta*, 10:08 the construct plural *tmien
     * minuti*. Three agreements for one slot; `hour u minutes` matches four of the ten readings exactly and
     * the rest to within that noun, and choosing one agreement would be wrong more often than silence is.
     * ⚠ 13–23 ARE SPOKEN AS 1–11 — the reader says *it-tlieta* for 15:00, never *ħmistax*.
     * ⚠ ONE O'CLOCK IS `siegħa`, NOT `wieħed`: the hour is feminine in the clock frame and the written
     * article agrees with it (`fis-1:15` < *fi + is-* selects *siegħa*).
     */
    private static string ClockPhrase(double h, double mi)
    {
        var h12 = h % 12 == 0 ? 12 : h % 12;
        var hour = h12 == 1 ? "siegħa" : Js.NumberToString(h12);
        if (mi == 0) return hour;
        if (mi == 15) return $"{hour} u kwart";
        if (mi == 30) return $"{hour} u nofs";
        return $"{hour} u {Js.NumberToString(mi)}";
    }

    private static string Clock(string text)
    {
        var s = Rewrite(text, CLOCK_COLON,
            m => ClockPhrase(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));
        var subject = s;
        return Rewrite(s, CLOCK_DOT, m =>
            CLOCK_TAIL.IsMatch(subject[(m.Index + m.Length)..])
                ? ClockPhrase(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value))
                : m.Value);
    }

    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(\\p{Nd})\\.(\\p{Nd}+)", "gu");
    private static string DecimalPoint(string text) =>
        Rewrite(text, DECIMAL_RE, m => $"{m.Groups[1].Value} {DECIMAL_POINT} {m.Groups[2].Value}");

    // ── STEP 7. THE SHARED SYMBOL TIER ───────────────────────────────────────────────────────────────────
    /** `Ampersand = "u"` — the Maltese conjunction, which is the manifest's OWN `numbers.connector` (the ⟨u⟩
     *  of *wieħed u għoxrin*) and espeak's `mt_list` `_& u` independently. `R&Ż` is *Riċerka u Żvilupp*,
     *  this language's own R&D, where ⟨u⟩ is literally the expansion; it read *r s* before. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { PERCENT },
        Currency = CURRENCY,
        Units = UNITS,
        Magnitudes = MAGNITUDES,
        ExponentWords = new ExponentWordsDef { Squared = SQUARED, Cubed = CUBED, Position = ExponentPosition.After },
        Ampersand = "u",
        CountForm = CountForm,
        // A magnitude governs the SINGULAR in Maltese, exactly as a numeral above ten does — see `CountForm`.
        // 11 is the smallest count that rule maps to the singular, so the fact lives in one place.
        MagnitudeCount = 11,
    });

    /**
     * The Maltese normalization pass. The two couplings that cannot be recovered from the code are that
     * **step 3 needs the `°` step 4 spends**, and that **step 8 must run after the tier** or a currency
     * magnitude loses its hop (`$88.08 biljun` would arrive as `$88 punt 08 biljun`, the magnitude no longer
     * adjacent, and the currency would land in the wrong slot).
     */
    public static string NormalizeMaltese(string input)
    {
        var s = Degroup(input);   // 1. before anything: a grouping comma is otherwise a clause pause
        s = EraMarkers(s);        // 2. multi-dot abbreviations before any single-dot rule
        s = MinusSign(s);         // 3. needs the ° and % that steps 4 and 7 consume
        s = Degrees(s);           // 4. needs the whole number, so before step 8
        s = Rates(s);             // 5. before the tier, so no unit is ever seen with a slash after it
        s = IlLinkedUnit(s);      // 5b. the tier cannot cross the `-il` linker between a number and its unit
        s = EuroSpelling(s);      // 6. lets the tier's own redundancy guard see a variant spelling
        s = SYMBOLS(s);           // 7. percent, currency + magnitude, units, exponent, ampersand
        s = Clock(s);             // 7b. BEFORE the decimal — 9.30 am is a time, and step 8 claims every
                                  //     digit-dot-digit unconditionally, so the clock must take its own first
        return DecimalPoint(s);   // 8. last: the tier needs the number whole (see the step's note)
    }
}
