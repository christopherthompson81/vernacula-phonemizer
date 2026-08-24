/**
 * Romanian (ro) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Romanian
 * g2p cannot already read into Romanian words the existing pipeline speaks. Pure text→text, no IPA. Runs
 * inside romanian.ts's `text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS ro_ro CORPUS, column 3 (the ORIGINAL cased text):
 *   period-grouped  N.NNN   56      colon clock  HH:MM  47      Latin units  N km  45
 *   ranges          N–N     38      decimal comma  N,N  35      percent      N %   22
 *   space-grouped   N NNN   12      degrees      N °     3      km²                3
 *
 * Romanian's engine is RULE-BASED with no pronunciation lexicon, so every word below was probed through
 * the g2p rather than checked against a word list: `la sută` → [ˈla ˈsutə], `virgulă` → [ˈvirɡulə],
 * `kilometri pătrați` → [kilomeˈtri pəˈtrat͡sʲ], `până` → [ˈpɨnə].
 *
 * ⚠ THE ORDINAL-DOT RULE IS DELIBERATELY ABSENT. It is the LARGEST
 * rule in both Norwegian (134 instances) and Danish (112), and the shape `N.` occurs 169 times here — so
 * porting it looks obviously right. Measured, Romanian has **zero** ordinal dots: of those 169, none is
 * followed by a lowercase word and 3 are followed by a capital. They are sentence ends and the
 * thousands-grouping periods counted above. Romanian writes its ordinals as WORDS (`primul`, `al doilea`)
 * and its dates without a dot (`3 mai`), so the construction simply does not exist. A rule ported from the
 * Germanic pair would have fired on sentence boundaries.
 *
 * ⚠ PERCENT IS `la sută`, NOT `procent`. The corpus writes the word out 11 times as *la sută* ("per
 * hundred") against 3 as *procent*, so the sign takes the majority reading rather than the cognate an
 * English speaker would reach for.
 *
 * ⚠ NO PERIOD-CLOCK RULE. `HH.MM` occurs, but every instance is `802.11a/b/g/n` — the Wi-Fi standard,
 * exactly as in Danish. The 47 real clocks are all colon-form.
 *
 * ORDERING, each constraint a bug that happened:
 *   · DE-GROUPING FIRST, both period and space forms. The period is clause punctuation, so `1.400` read
 *     as "unu" + a SENTENCE BREAK + "patru sute"; the space form arrived as two separate numerals.
 *   · DEGREES BEFORE the unit rules — the C of `20 °C` was read as Romanian [k].
 *   · km² BEFORE the plain unit rule, or the `km` is consumed first and the exponent left stranded.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Romanian;

public static class Normalize
{
    /** Unit abbreviations → Romanian words, all probed through the g2p. Longest first so `km` is not matched
     *  as `m` with a stray k left over. */
    private static readonly (JsRe Re, string Word)[] UNITS =
    {
        (JsRegex.Compile("\\bkm\\b", "giu"), "kilometri"),
        (JsRegex.Compile("\\bkg\\b", "giu"), "kilograme"),
        (JsRegex.Compile("\\bcm\\b", "giu"), "centimetri"),
        // A DOTTED DESIGNATION IS NOT A QUANTITY. These are bare word-boundary replacements with no number
        // context, so the trailing letter of a version designation was claimed outright: `802.11g` read as
        // "opt sute doi . unsprezece GRAME". That is the defect the shared tier's `NOT_VERSION` exists to stop
        // (its note records `802.11g` → "802.11 grams" in ten languages), and Romanian never got it because it
        // does not use the tier. `802.11g` is in ro_ro, so this was live, not theoretical.
        // The lookbehind rejects a one-letter unit GLUED to a dotted number and nothing else: `5 g` and
        // `100.5 g` keep their space and still read, and the only glued decimal-plus-letter forms in any corpus
        // are `3.50m` (ko) and `4.892m` (pt) — neither Romanian.
        // The second lookbehind NAMES THE STANDARD: 802.11's amendment suffixes are now TWO letters (ac, ax, ah,
        // be, bn) and `802.11ah` (Wi-Fi HaLow) collides with `Ah`, ampere-hours — which the digit-based arm, that
        // only sees one letter back, would not catch.
        (JsRegex.Compile("(?<!\\d[.,]\\d{1,4})(?<!802[.,]11[a-z]{0,3})\\bmm\\b", "giu"), "milimetri"),
        (JsRegex.Compile("(?<!\\d[.,]\\d{1,4})(?<!802[.,]11[a-z]{0,3})\\bm\\b", "giu"), "metri"),
        (JsRegex.Compile("(?<!\\d[.,]\\d{1,4})(?<!802[.,]11[a-z]{0,3})\\bg\\b", "giu"), "grame"),
    };

    /** THE SAME SYMBOLS STANDING ALONE. Step 9 requires a digit in front, so a bare `km` — a caption, a table
     *  header, or a figure whose numeral a bracket or an `&nbsp;` put out of its reach — reached the phoneme
     *  sink as raw ASCII, which in a Latin-script language no leak gate can see.
     *
     *  ⚠ THE KEYS ARE READ OFF THE TABLE ABOVE rather than written out again, so the two cannot drift; every
     *  source ends in its literal key. The shared guards (core/normalizeSymbols.ts) then drop `m` and `g` for
     *  being one letter — which is also what keeps the `802.11ah` and `1,5 m` hazards this table documents out
     *  of reach of this path entirely — and the rest fire only on an exact-case token with no numeral, no rate
     *  slash and no exponent beside it. */
    private static readonly JsRe BARE_KEY = JsRegex.Compile("\\\\b([a-z]+)\\\\b$", "u");
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(
        UNITS.Select(u =>
        {
            var m = BARE_KEY.Match(u.Re.Source);
            return new KeyValuePair<string, string>(m.Success ? m.Groups[1].Value : "", u.Word);
        }));

    /** Squared / cubed units. Romanian POSTPOSES the modifier — *kilometri pătrați*, "square kilometres" with
     *  the adjective after the noun, which is the opposite of the Germanic compounds and of Burmese. */
    private static readonly (JsRe Re, string Word)[] SQUARED =
    {
        (JsRegex.Compile("\\bkm\\s*\u00b2", "giu"), "kilometri pătrați"),
        (JsRegex.Compile("\\bm\\s*\u00b2", "giu"), "metri pătrați"),
        (JsRegex.Compile("\\bcm\\s*\u00b2", "giu"), "centimetri pătrați"),
        (JsRegex.Compile("\\bm\\s*\u00b3", "giu"), "metri cubi"),
    };

    /** Currency sign → the Romanian word. All three are attested in the corpus as words (euro 88, lei 80,
     *  dolari 18). Both placements are claimed: the corpus writes the sign before the amount, but a
     *  phonemizer is handed arbitrary text. */
    private static readonly IReadOnlyDictionary<string, string> CURRENCY = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["$"] = "dolari", ["€"] = "euro", ["£"] = "lire", ["¥"] = "yeni", ["lei"] = "lei",
    };

    /** Relational and operator signs, read in every position — a dropped sign is inaudible, the one outcome
     *  that cannot be right. `minus` and `plus` are attested in the corpus 15 times each. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    {
        (JsRegex.Compile("\u00b1", "gu"), " plus minus "),
        (JsRegex.Compile("\u2248", "gu"), " aproximativ egal cu "),
        (JsRegex.Compile("\u2264", "gu"), " mai mic sau egal cu "),
        (JsRegex.Compile("\u2265", "gu"), " mai mare sau egal cu "),
        (JsRegex.Compile("=", "gu"), " egal cu "),
        (JsRegex.Compile("<", "gu"), " mai mic decât "),
        (JsRegex.Compile(">", "gu"), " mai mare decât "),
        // ⚠ ASCII `x` TOO, not only `×`: `NxN` forms outnumber `×` roughly 85 to 20 across the corpora, and the
        // bare `x` was reaching the phoneme stream as its own LETTER NAME. Digit-bounded, so it cannot claim a letter.
        (JsRegex.Compile("\u00d7|(?<=\\p{Nd})[ \\t]?x[ \\t]?(?=\\p{Nd})", "gu"), " ori "),
        (JsRegex.Compile("\u00f7", "gu"), " împărțit la "),
    };

    private static readonly JsRe GROUP_DOT = JsRegex.Compile("(\\d)\\.(\\d{3})(?!\\d)", "gu");
    // ⚠ THE GROUPING CLASS IS THREE CHARACTERS — space, NBSP (U+00A0) and narrow NBSP (U+202F) — two of them
    // invisible in a source file. Written as escapes so an editor that folds an exotic space cannot narrow the
    // class in silence (the French golden-row defect earlier in this port).
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile("(\\d)[ \u00a0\u202f](\\d{3})(?!\\d)", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d+),(\\d+)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("\u2103", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("\u2109", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*\u00b0\\s*C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*\u00b0\\s*F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s*\u00b0", "gu");
    private static readonly JsRe KM_H = JsRegex.Compile("km\\s*\\/\\s*(?:h|or[ăa])(?!\\p{L})", "giu");
    private static readonly JsRe M_S = JsRegex.Compile("(?<!\\p{L})m\\s*\\/\\s*s(?!\\p{L})", "giu");
    private static readonly JsRe BACKSLASH_B = JsRegex.Compile("\\\\b", "gu");
    /** The counted form of each unit rule: the same source with its `\b` boundaries stripped, behind a digit. */
    private static readonly (JsRe Re, string Word)[] COUNTED_UNITS = UNITS
        .Select(u => (JsRegex.Compile($"(\\d)\\s*(?:{BACKSLASH_B.Replace(u.Re.Source, "")})(?![\\p{{L}}])", "gu"), u.Word))
        .ToArray();
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![-\u2013\u2014])(\\d+)\\s*[-\u2013\u2014]\\s*(\\d+)(?!\\d)(?!\\s*[-\u2013\u2014]\\s*\\d)", "gu");
    private static readonly JsRe NON_LETTER_FIRST = JsRegex.Compile("^[^\\p{L}]", "u");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe SIGNED = JsRegex.Compile("(?<![\\p{L}\\d])([-\u2212+])(\\d+)", "gu");
    private static readonly JsRe INFIX_PLUS = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&\uff06]\\s*", "gu");
    private static readonly JsRe RUNS = JsRegex.Compile("[ \\t]{2,}", "gu");

    public static string NormalizeRomanian(string input)
    {
        var t = input;

        // 1) PERIOD-GROUPED THOUSANDS (56), FIRST. The period is clause punctuation, so `1.400` read as
        //    "unu" + a SENTENCE BREAK + "patru sute". Exactly three digits, which is what separates grouping
        //    from the `802.11` technical shape.
        string prev;
        do
        {
            prev = t;
            t = GROUP_DOT.Replace(t, "$1$2");
        } while (t != prev);

        // 2) SPACE-GROUPED THOUSANDS (12). A space is a token boundary, so the numeral arrived as two.
        do
        {
            prev = t;
            t = GROUP_SPACE.Replace(t, "$1$2");
        } while (t != prev);

        // 3) DECIMAL COMMA (35). The comma is clause punctuation too, so `12,5` read as "doisprezece , cinci"
        //    — a PAUSE inside a number. Fractional part spoken digit by digit.
        t = DECIMAL_COMMA.Replace(t, m =>
            $"{m.Groups[1].Value} virgulă {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 4) CLOCK, COLON FORM ONLY (47). The colon was reaching clausePunctuation as a COMMA PAUSE, so
        //    `22:00` read as "douăzeci și doi , zero". The period form is a Wi-Fi standard — see the header.
        t = CLOCK.Replace(t, "$1 $2");

        // 5) PERCENT (22) → `la sută`, the majority reading — see the header.
        t = PERCENT.Replace(t, "$1 la sută");

        // 6) DEGREES (3), BEFORE the unit rules — the C of `20 °C` was read as Romanian [k].
        t = DEG_F_SIGN.Replace(DEG_C_SIGN.Replace(t, "\u00b0C"), "\u00b0F");
        t = DEG_C.Replace(t, "$1 grade Celsius");
        t = DEG_F.Replace(t, "$1 grade Fahrenheit");
        t = DEG.Replace(t, "$1 grade");

        // 7) SQUARED / CUBED UNITS (3), BEFORE the plain unit rule — otherwise `km` is consumed first and the
        //    exponent is left stranded. `km²` was reaching the output as the bare letters "km".
        foreach (var (re, word) in SQUARED) t = re.Replace(t, word);

        // 8) RATES (13) — `160 km/h`, `160 km/oră`. BEFORE the plain unit rule, or the `km` is consumed and
        //    a bare `/h` is left with nothing to attach to. The slash reached the tokenizer raw and was
        //    dropped, so the denominator vanished entirely. `pe oră` is attested 8 times in the corpus.
        //    ⚠ The trailing boundary is `(?!\p{L})`, NOT `\b`. `\b` is defined on ASCII word characters, so
        //    after the `ă` of `oră` — which is not one — it finds no boundary and the rule silently did not
        //    fire. Romanian's own alphabet (ă â î ș ț) walks straight into it.
        t = KM_H.Replace(t, "kilometri pe oră");
        t = M_S.Replace(t, "metri pe secundă");

        // 9) LATIN UNIT ABBREVIATIONS after a number (45).
        foreach (var (re, word) in COUNTED_UNITS) t = re.Replace(t, $"$1 {word}");
        //    …and the same abbreviations with NO number — see BARE_UNITS. After the loop, so every reading the
        //    counted rule can make is already made and only what it could not reach is left for this.
        t = BARE_UNITS(t);

        // 10) RANGES (38). Spoken `până la`, which the corpus writes out — `25 până la 30`.
        t = RANGE.Replace(t, "$1 până la $2");

        // 11) CURRENCY, both placements.
        foreach (var (sign, word) in CURRENCY)
        {
            if (!NON_LETTER_FIRST.IsMatch(sign)) continue; // `lei` is a word already, not a sign
            var esc = ESCAPE.Replace(sign, "\\$&");
            t = JsRegex.Compile($"{esc}\\s*(\\d+)", "gu").Replace(t, $"$1 {word}");
            t = JsRegex.Compile($"(\\d+)\\s*{esc}", "gu").Replace(t, $"$1 {word}");
        }

        // 12) SIGNED NUMBERS — a sign PREFIXED to a number. Boundary before it so a hyphenated compound is
        //     untouched, and after ranges so a range's dash is already gone.
        t = SIGNED.Replace(t, m => $"{(m.Groups[1].Value == "+" ? "plus" : "minus")} {m.Groups[2].Value}");

        // 13) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the
        //     relational signs are read in every position.
        t = INFIX_PLUS.Replace(t, "$1 plus $2");
        foreach (var (re, word) in RELATIONAL) t = re.Replace(t, word);

        // 14) AMPERSAND → și.
        t = AMPERSAND.Replace(t, " și ");

        // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
        return RUNS.Replace(t, " ");
    }
}
