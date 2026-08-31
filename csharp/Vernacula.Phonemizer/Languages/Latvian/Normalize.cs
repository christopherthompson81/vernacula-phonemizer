/**
 * Latvian (lv) TEXT NORMALIZATION — the pre-tokenizer pass. Pure text→text; no IPA.
 * Ported from src/languages/latvian/normalize.ts, where every reading's attestation and every refusal is
 * argued. The numbered order at the bottom is LOAD-BEARING.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Latvian;

public static class Normalize
{
    /** Latvian agreement: SINGULAR after a count ending in …1 but NOT …11. */
    private static readonly Func<double, int> CountForm = n => n % 10 == 1 && n % 100 != 11 ? 0 : 1;
    private static IReadOnlyList<string> Pair(string one, string many) => [one, many];

    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> UNITS =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = Pair("kilometrs", "kilometri"),
            ["m"] = Pair("metrs", "metri"),
            ["cm"] = Pair("centimetrs", "centimetri"),
            ["mm"] = Pair("milimetrs", "milimetri"),
            ["kg"] = Pair("kilograms", "kilogrami"),
            ["g"] = Pair("grams", "grami"),
            ["ha"] = Pair("hektārs", "hektāri"),
            // ⚠ FOUND BY THE LEAK GATE, not by reading the corpus: `610 nm` reached the IPA as raw Latin.
            ["nm"] = Pair("nanometrs", "nanometri"),
            ["t"] = Pair("tonna", "tonnas"),
        };

    /** ⚠ LATVIAN USES NO PREPOSITION IN A RATE — the denominator simply stands in the LOCATIVE, which is why
     *  `UnitPer` is the EMPTY STRING and not a word. `sek` is declared beside `s` because the corpus writes
     *  `71 km/sek./Mpc`, and without the longer key the whole rate fails and `km` reaches the IPA raw. */
    private static readonly IReadOnlyDictionary<string, string> RATE_DENOMINATORS =
        new Dictionary<string, string>(StringComparer.Ordinal)
        { ["h"] = "stundā", ["s"] = "sekundē", ["sek"] = "sekundē" };

    private const string SignPlus = "plus", SignMinus = "mīnuss", SignPlusMinus = "plusmīnuss";
    private const string SignEquals = "vienāds", SignLessThan = "mazāks par", SignGreaterThan = "lielāks par";
    private const string SignTimes = "reiz", SignDividedBy = "dalīts", SignAmpersand = "un";
    private const string SignApproximately = "aptuveni";

    /** ⚠ FAHRENHEIT IS ROBUSTNESS, NOT A MEASURED REPAIR: `°F` is ×0 in this corpus. It is declared because
     *  the arm exists for Celsius anyway, and an unmatched `°F` would leave ⟨F⟩ to be read as a letter. */
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> SCALE =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["C"] = Pair("Celsija grāds", "Celsija grādi"),
            ["F"] = Pair("Fārenheita grāds", "Fārenheita grādi"),
        };
    private static readonly IReadOnlyList<string> DEGREE = Pair("grāds", "grādi");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = ["procents", "procenti"],
        // ⚠ `eiro` is INDECLINABLE in Latvian — one form for both counts, which is why the pair repeats
        // rather than inventing a plural.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = Pair("dolārs", "dolāri"),
            ["€"] = Pair("eiro", "eiro"),
            ["£"] = Pair("mārciņa", "mārciņas"),
        },
        Units = UNITS,
        /** ⚠ THE INFLECTED FORMS ARE NOT OPTIONAL. Latvian declines its magnitude nouns, and the corpus
         *  writes the oblique forms MORE often than the nominative. The tier matches a magnitude with no
         *  trailing word boundary, so a short form matched and STRANDED the suffix (`$17.37 miljardiem` →
         *  *miljardi dolāri EM*); the `-u`/`-us` forms failed differently and worse — no match at all, so
         *  the figure was not adjacent to the sign and the currency was DROPPED. */
        Magnitudes =
        [
            "miljardiem", "miljardus", "miljardi", "miljardu", "miljards",
            "miljoniem", "miljonus", "miljoni", "miljonu", "miljons",
            "tūkstošiem", "tūkstošus", "tūkstoši", "tūkstošu", "tūkstotis",
        ],
        RateDenominators = RATE_DENOMINATORS,
        UnitPer = "",
        /** ⚠ `compound`, NOT `after`. Latvian FUSES the square word onto the front of the noun —
         *  *kvadrātkilometri*, one word. `after` would emit *kilometri kvadrāt* and `before`
         *  *kvadrāt kilometri*; neither is a Latvian word. */
        ExponentWords = new ExponentWordsDef { Squared = ["kvadrāt"], Cubed = ["kubik"], Position = ExponentPosition.Compound },
        // `kvadrātā` is the PREDICATE form — *pieci kvadrātā*, "five squared" — a different word-shape from
        // the modifier above, which is why the tier keeps the two fields apart.
        BareExponent = new BareExponentDef
        {
            Squared = "{n} kvadrātā", Cubed = "{n} kubā", Power = "{n} pakāpē {e}", Negative = SignMinus,
        },
        Multiply = new MultiplyDef { Times = SignTimes },
        Ampersand = SignAmpersand,
        CountForm = CountForm,
    });

    // ── 1. de-grouping ────────────────────────────────────────────────────────────────────────────────
    /** ⚠ The three grouping spaces are written as ESCAPES rather than literal characters — they are
     *  indistinguishable on the page, and a rule whose correctness cannot be read off the source is a rule
     *  nobody can review. */
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<=\\d)(?<!(?<![\\d\\.,])0)[ \\u00a0\\u202f\\u2009](?=\\d{3}(?!\\d))", "gu");

    // ── 2. dotted abbreviations ───────────────────────────────────────────────────────────────────────
    /** ⚠ ONLY INVARIANT EXPANSIONS ARE HERE. Every entry is a fixed phrase or a non-inflecting adverb, so
     *  expanding it claims no case. `gs.`, `izd.` and bare `sk.` are DELIBERATELY ABSENT: the abbreviation
     *  HIDES the noun's case, and expanding to a citation form would put a real Latvian word in the wrong
     *  case — worse than a raw `gs` a RAW-LATIN gate can see. */
    private static readonly IReadOnlyDictionary<string, string> ABBREVIATION =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["p.m.ē."] = "pirms mūsu ēras",
            ["m.ē."] = "mūsu ēras",
            ["u.tml."] = "un tamlīdzīgi",
            ["u.t.t."] = "un tā tālāk",
            ["t.sk."] = "tai skaitā",
            ["utt."] = "un tā tālāk",
            ["u.c."] = "un citi",
            ["t.i."] = "tas ir",
            ["piem."] = "piemēram",
            ["plkst."] = "pulksten",
        };

    private static readonly JsRe REGEX_META = JsRegex.Compile("[.*+?^${}()|\\[\\]\\\\]", "gu");

    /** Longest key first, so `m.ē.` cannot claim the tail of `p.m.ē.` and `t.t.` cannot split `u.t.t.`.
     *  ⚠ CASE-SENSITIVE: `T.I. Ivanovs` is a personal INITIAL PAIR, and case-insensitively it matched `t.i.`
     *  — introducing a surname. Latvian writes all of these lower case in running text. */
    private static readonly JsRe ABBREVIATION_RE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}.])(?:" + string.Join("|", ABBREVIATION.Keys
            .OrderByDescending(k => k.Length)
            .Select(k => REGEX_META.Replace(k, "\\$&"))) + ")", "gu");

    /** ⚠ `nr.` PRECEDES its figure and so takes the citation nominative — there is no preceding count for it
     *  to agree with, which is why it is a plain string and not a pair. */
    private static readonly IReadOnlyList<string> PAGE = Pair("lappuse", "lappuses");
    private const string NUMBER_ABBREV = "numurs";

    private static readonly JsRe LPP = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)(\\s*)lpp\\.?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe NR = JsRegex.Compile("(?<![\\p{L}\\p{M}.])nr\\.(\\s*)(?=\\d)", "giu");
    /** ⚠ `№` (U+2116) IS THE SAME WORD AND WAS SILENTLY DELETED (#1209) — see the call site. */
    private static readonly JsRe NUMERO = JsRegex.Compile("№(\\s*)(?=\\d)", "gu");
    private static readonly JsRe NEXT_IS_CAPITAL = JsRegex.Compile("^\\s+\\p{Lu}", "u");

    private static string Abbreviations(string text)
    {
        // The counted one first: it needs the figure the generic rule would not look at.
        // ⚠ THE TRAILING DOT IS OPTIONAL, because the corpus's one instance does not write it.
        var s = Rewrite(text, LPP, m =>
        {
            var gap = m.Groups[2].Value;
            return $"{m.Groups[1].Value}{(gap.Length > 0 ? gap : " ")}{PAGE[CountForm(Js.Number(m.Groups[1].Value))]}";
        });
        // ⚠ THE GAP IS RE-EMITTED, AND SUPPLIED WHEN THERE IS NONE. `nr.859` is written without a space and
        // the abbreviation's own period is consumed, so a bare replacement fused the noun onto the digits.
        s = Rewrite(s, NR, m =>
        {
            var gap = m.Groups[1].Value;
            return $"{NUMBER_ABBREV}{(gap.Length > 0 ? gap : " ")}";
        });
        /**
         * ⚠ `№` IS THE SAME WORD AND WAS SILENTLY DELETED (#1209). It is not a letter, so the tokenizer
         * never emitted it: `2MV-4 №3` read as *…divi trīs* with the "number" simply gone — nothing left
         * over, so no leak class, DROP or provenance gap could see it, while `nr. 3` two words away read
         * *numurs trīs*. The same word in the same slot, disagreeing with itself.
         * ⚠ A FOLLOWING DIGIT IS REQUIRED, and that is the whole guard. All four corpus instances are
         * spacecraft designations with the figure glued on (`2MV-4 №3`, `2MV-3 №1`); a bare `№` with no
         * operand is metalinguistic, the shape the `‰` refusal is keyed on for the same reason. The gap is
         * supplied when absent, exactly as `nr.` does, or the noun fuses onto the digits.
         */
        s = Rewrite(s, NUMERO, m =>
        {
            var gap = m.Groups[1].Value;
            return $"{NUMBER_ABBREV}{(gap.Length > 0 ? gap : " ")}";
        });
        var subject = s;
        return Rewrite(s, ABBREVIATION_RE, m =>
        {
            if (!ABBREVIATION.TryGetValue(m.Value, out var word)) return m.Value;
            /**
             * ⚠ THE ABBREVIATION'S FINAL PERIOD IS ALSO A SENTENCE'S, and swallowing it is the MIRROR of the
             * defect this step exists to fix: `u.c.` at the end of a sentence lost the boundary outright and
             * ran two sentences together. The discriminator is `OrdinalPeriod`'s, reused rather than
             * reinvented: whitespace plus an UPPER-CASE letter is a sentence boundary. End of input counts.
             * ⚠ IT COSTS A FALSE PAUSE BEFORE A MID-SENTENCE PROPER NOUN, and that is the side to err on.
             */
            var rest = subject[(m.Index + m.Value.Length)..];
            var endsSentence = rest.Length == 0 || NEXT_IS_CAPITAL.IsMatch(rest);
            return m.Value.EndsWith('.') && endsSentence ? $"{word}." : word;
        });
    }

    // ── 3./4. the ordinal steps ───────────────────────────────────────────────────────────────────────
    private static readonly JsRe ORDINAL_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\p{L}])(\\d{1,4})\\.\\s*[-–—]\\s*(\\d{1,4})\\.(\\s+)(\\p{Ll}[\\p{L}\\p{M}]*)", "gu");
    private static readonly JsRe ORDINAL_PERIOD = JsRegex.Compile(
        "(?<![\\d.,])(\\d{1,4})\\.(\\s+)(\\p{Ll}[\\p{L}\\p{M}]*)", "gu");

    /** ⚠ RUNS ABOVE BOTH `OrdinalPeriod` AND `RANGE`, and it has to: the former would claim the SECOND figure
     *  alone and leave the first as a bare cardinal with its period intact; the latter would replace the dash
     *  and destroy the shape this matches on. */
    private static string OrdinalRange(string text) => Rewrite(text, ORDINAL_RANGE, m =>
    {
        var a = m.Groups[1].Value;
        var b = m.Groups[2].Value;
        var gap = m.Groups[3].Value;
        var next = m.Groups[4].Value;
        var known = Ordinals.HEAD_NOUN.TryGetValue(Js.ToLowerCase(next), out var c);
        var first = known ? Ordinals.OrdinalWords(Js.Number(a), c) : null;
        var second = known ? Ordinals.OrdinalWords(Js.Number(b), c) : null;
        /**
         * ⚠ REFUSING MEANS BOTH HALVES, AND IT MUST STILL CONSUME THE PERIODS. Returning the whole match
         * looked like a clean refusal and was not: the next step matched the SECOND figure on its own and
         * composed it, so `3100.–1550. gadam` came out with one figure ordinalised and the other left with
         * its period. A refusal the following step can undo is not a refusal.
         */
        if (first is null || second is null) return $"{a} līdz {b}{gap}{next}";
        return $"{first} līdz {second}{gap}{next}";
    });

    /** ⚠ THE GUARD IS `\s+` PLUS A LOWER-CASE LETTER. A digit after the dot is a decimal point or a clock
     *  time in a foreign convention, and an upper-case letter after it is an ordinary sentence boundary.
     *  ⚠ AND A REFUSED ORDINAL STILL LOSES ITS PERIOD — the untabulated-noun branch drops it because it is
     *  never a full stop, and that reason does not depend on whether the ordinal could be composed. */
    private static string OrdinalPeriod(string text) => Rewrite(text, ORDINAL_PERIOD, m =>
    {
        var fig = m.Groups[1].Value;
        var gap = m.Groups[2].Value;
        var next = m.Groups[3].Value;
        if (!Ordinals.HEAD_NOUN.TryGetValue(Js.ToLowerCase(next), out var c)) return $"{fig}{gap}{next}";
        var words = Ordinals.OrdinalWords(Js.Number(fig), c);
        return words is null ? $"{fig}{gap}{next}" : $"{words}{gap}{next}";
    });

    // ── 5. ranges ─────────────────────────────────────────────────────────────────────────────────────
    /** ⚠ THE TRAILING GUARD REJECTS A DIGIT, NOT A CLAUSE MARK — `(?![\d,.-])` also refused `1990-1995.`, a
     *  range at the end of a SENTENCE. ⚠ A BARE TRAILING HYPHEN IS STILL REFUSED, so a hyphen CHAIN (an ISO
     *  date) is not read as a range. */
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![\\d,.\\p{L}-])(\\d+(?:,\\d+)?)\\s*[-–—]\\s*(\\d+(?:,\\d+)?)(?!\\d|[,.]\\d|-)", "gu");

    // ── 7. degrees ────────────────────────────────────────────────────────────────────────────────────
    /** ⚠ THE WHITESPACE AFTER `°` IS ONLY CONSUMED WHEN A SCALE LETTER IS ACTUALLY TAKEN — an unconditional
     *  `\s*([CF])?` made `6° virs nulles` come out *6 grādivirs nulles*, one word where there were two.
     *  ⚠ AND THE SCALE LETTER NEEDS A LETTER BOUNDARY, or `20° Celsija skalā` matches the ⟨C⟩ of *Celsija*
     *  and leaves *elsija* behind. */
    private static readonly JsRe DEGREE_SIGN =
        JsRegex.Compile("(\\d+(?:,\\d+)?)\\s*°(?:\\s*([CF])(?![\\p{L}\\p{M}]))?", "gui");
    private static readonly JsRe STARTS_WITH_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");

    private static string Degrees(string text)
    {
        var subject = text;
        return Rewrite(text, DEGREE_SIGN, m =>
        {
            var fig = m.Groups[1].Value;
            var scale = m.Groups[2].Success ? m.Groups[2].Value : null;
            var forms = scale is not null ? SCALE[scale.ToUpperInvariant()] : DEGREE;
            /** ⚠ A FIGURE WITH A FRACTION TAKES THE PLURAL, whatever its integer part: `21,5` ends in …1 by
             *  `CountForm`'s arithmetic but is read *…viens komats pieci GRĀDI* — the singular agrees with a
             *  count of exactly one, and 21,5 is not one. */
            var word = forms[fig.Contains(',') ? 1 : CountForm(Js.Number(fig))];
            /** ⚠ THE EMITTED NOUN MUST NOT FUSE WITH WHAT FOLLOWS. `6500°K` has no space to inherit, so
             *  without this the output is *grādiK*: one Latin run, one bogus stressed word, and the raw ⟨K⟩
             *  hidden inside it where the RAW-LATIN gate cannot see it. */
            var fuses = STARTS_WITH_LETTER.IsMatch(subject[(m.Index + m.Value.Length)..]);
            return $"{fig} {word}{(fuses ? " " : "")}";
        });
    }

    // ── 8. the remaining signs ────────────────────────────────────────────────────────────────────────
    /** ⚠ AN EQUALS SIGN MUST BE OPERAND-FLANKED AND NOT PART OF A LONGER OPERATOR. Unconditional replacement
     *  produced `a==b` → *a vienāds  vienāds b* (the word twice, plus a DOUBLE SPACE) and read a query string
     *  `url?q=1&t=2` aloud as arithmetic. */
    private static readonly JsRe EQUALS =
        JsRegex.Compile("(?<![=!<>])(?<=[\\d\\p{L}\\p{M})²³])\\s*=\\s*(?=[\\d\\p{L}(])(?![=<>])", "gu");
    private static readonly JsRe APPROX = JsRegex.Compile("≈\\s*(?=[+−–-]?\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("(?<![\\d\\p{L}])±(?=\\s?\\d)", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(?<![\\d\\p{L}])\\+(?=\\s?\\d)", "gu");
    /** ⚠ THE ASCII HYPHEN IS A MINUS HERE. espeak maps a bare `-` to *defise* ("hyphen"), but it is
     *  describing an ISOLATED mark; a hyphen bound to a following figure at a non-digit boundary is a sign.
     *  The range step above has already consumed every digit-hyphen-digit. */
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\d\\p{L}])[−–-](?=\\s?\\d)", "gu");
    private static readonly JsRe DIVIDED = JsRegex.Compile("(?<=\\d)\\s*÷\\s*(?=\\d)", "gu");
    private static readonly JsRe LESS_THAN =
        JsRegex.Compile("(?<![=!<>])(?<=[\\d\\p{L}])\\s*<\\s*(?=[\\d\\p{L}])(?![=<>])", "gu");
    private static readonly JsRe GREATER_THAN =
        JsRegex.Compile("(?<![=!<>])(?<=[\\d\\p{L}])\\s*>\\s*(?=[\\d\\p{L}])(?![=<>])", "gu");

    private static string Signs(string text)
    {
        var s = Rewrite(text, APPROX, $"{SignApproximately} ");
        s = Rewrite(s, PLUS_MINUS, $"{SignPlusMinus} ");
        s = Rewrite(s, PLUS, $"{SignPlus} ");
        s = Rewrite(s, MINUS, $"{SignMinus} ");
        s = Rewrite(s, DIVIDED, $" {SignDividedBy} ");
        s = Rewrite(s, EQUALS, $" {SignEquals} ");
        s = Rewrite(s, LESS_THAN, $" {SignLessThan} ");
        return Rewrite(s, GREATER_THAN, $" {SignGreaterThan} ");
    }

    // ── 9. the decimal comma ──────────────────────────────────────────────────────────────────────────
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d,.])(\\d+),(\\d+)(?![\\d,.])", "gu");
    private static readonly JsRe LEADING_ZEROS = JsRegex.Compile("^0*", "u");

    /** ⚠ EVERY LEADING ZERO IN THE FRACTION IS SPOKEN SEPARATELY. Reading the fraction as a NUMBER makes
     *  `5,09` and `5,9` identical, because `Number("09")` is 9 — the quantity wrong by a factor of ten, in
     *  perfectly well-formed text, invisible to every gate. */
    private static string DecimalComma(string text) => Rewrite(text, DECIMAL_COMMA, m =>
    {
        var head = m.Groups[1].Value;
        var frac = m.Groups[2].Value;
        if (head.Length > 15 || frac.Length > 15) return m.Value;
        var zeros = LEADING_ZEROS.Match(frac).Value;
        var rest = frac[zeros.Length..];
        var spoken = zeros.Select(_ => Numbers.NumberToWords(0)).ToList();
        if (rest.Length > 0) spoken.Add(Numbers.NumberToWords(Js.Number(rest), rest));
        return $"{Numbers.NumberToWords(Js.Number(head), head)} komats {string.Join(" ", spoken)}".TrimEnd();
    });

    /** The Latvian normalization pre-pass. The order is load-bearing. */
    public static string NormalizeLatvian(string input)
    {
        var s = input;
        s = Rewrite(s, GROUP_SPACE, "");   // 1. de-group 29 660 → 29660, before anything reads a number
        s = Abbreviations(s);              // 2. dotted abbreviations, whose periods are step 4's periods
        s = OrdinalRange(s);               // 3. N.–M. + noun, before either half can be claimed separately
        s = OrdinalPeriod(s);              // 4. the ordinal period, before any step consumes a dot
        s = Rewrite(s, RANGE, "$1 līdz $2"); // 5. ranges, before a dash can be read as a minus
        s = SYMBOLS(s);                    // 6. percent, currency, units, rates, exponents
        s = Degrees(s);                    // 7. ° and the scale names
        s = Signs(s);                      // 8. the remaining signs
        s = DecimalComma(s);               // 9. the decimal comma, last — the tier needs the figure intact
        return s;
    }
}
