/**
 * Icelandic (is) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Icelandic
 * g2p cannot already read into Icelandic words the existing pipeline speaks. Pure text→text; no IPA.
 * The ordinal form is selected by the FOLLOWING noun (Icelandic ordinals agree in gender and case,
 * unlike the Norwegian and Danish single-form tables), the period groups thousands and is resolved
 * to a fixpoint before the ordinal rule owns the remaining dots, and the colon is the only clock
 * shape (the period form is a decimal here).
 * Ported from src/languages/icelandic/normalize.ts — see that file for the corpus evidence and the
 * sourcing of each expansion.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Icelandic;

public static class Normalize
{
    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // The rules
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** DOTTED ICELANDIC ABBREVIATIONS — the ⟨o.s.frv.⟩ / ⟨o.fl.⟩ family; the trailing dot is consumed. */
    private static readonly (JsRe Re, string Word)[] ABBREV =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])o\\.\\s?s\\.\\s?frv\\.?(?![\\p{L}])", "giu"), "og svo framvegis"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])o\\.\\s?fl\\.?(?![\\p{L}])", "giu"), "og fleira"),
    };

    /** PERIOD-GROUPED THOUSANDS — run to a fixpoint, before the ordinal rule. */
    private static readonly JsRe GROUPED_DOT =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");

    /** DECIMAL COMMA — the fractional part is spoken digit by digit. */
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d+),(\\d+)", "gu");

    /** CLOCK, COLON FORM ONLY — the period form is a decimal here. */
    private static readonly JsRe CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");

    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe CELSIUS_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe FAHRENHEIT_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEGREE_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?!\\p{L})", "giu");
    private static readonly JsRe DEGREE_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?!\\p{L})", "giu");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile("(\\d)\\s*°", "gu");

    /** SQUARED UNITS, before the plain unit rule or the `km` is consumed and the exponent stranded. */
    private static readonly JsRe KM_SQUARED = JsRegex.Compile("(?<!\\p{L})km\\s*[²2](?!\\d)", "giu");
    private static readonly JsRe M_SQUARED = JsRegex.Compile("(?<!\\p{L})m\\s*[²2](?!\\d)", "giu");
    private static readonly JsRe KM_CUBED = JsRegex.Compile("(?<!\\p{L})km\\s*[³3](?!\\d)", "giu");
    private static readonly JsRe M_CUBED = JsRegex.Compile("(?<!\\p{L})m\\s*[³3](?!\\d)", "giu");

    /** RATES, before the plain unit loop — its `(?!\p{L})` guard is satisfied by a slash. */
    private static readonly JsRe RATE_KM = JsRegex.Compile("(?<!\\p{L})km\\s*/\\s*(?:klst\\.?|h)(?![\\p{L}])", "giu");

    /** The Latin unit table, keyed by the SOURCE the TS splices into the composed pattern. Placed in
     *  order: ⟨mph⟩ first so no later two-letter key can bite into it. */
    private static readonly (string Source, string Word)[] UNITS =
    {
        ("mph", "mílur á klukkustund"),
        ("km", "kílómetrar"),
        ("kg", "kílógrömm"),
        ("cm", "sentímetrar"),
        ("mm", "millímetrar"),
    };
    private static readonly (JsRe Re, string Word)[] UNITS_COMPOSED =
        UNITS.Select(u => (JsRegex.Compile($"(\\d)\\s*(?:{u.Source})(?!\\p{{L}})", "gu"), u.Word)).ToArray();

    /** ORDINAL DOT — the form is selected by what follows. */
    private static readonly JsRe ORDINAL_DOT =
        JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.(?=\\s+\\p{Ll})\\s+(\\p{Ll}+)", "gu");

    /** Month names select the MASCULINE NOMINATIVE — *sautjándi september*. */
    private static readonly JsRe MONTHS = JsRegex.Compile(
        "^(janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember)", "u");

    /** `öld` is FEMININE; its oblique forms take the `-u` ordinal — *átjándu aldar*. */
    private static readonly JsRe FEM_OBLIQUE = JsRegex.Compile("^(aldar|öldinni|aldarinnar|aldir)", "u");

    /** RANGES — spoken `til`. */
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![-–—])(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)(?!\\s*[-–—]\\s*\\d)", "gu");

    /** Currency sign → the Icelandic word. ⚠ INSERTION ORDER IS THE REWRITE ORDER — `Object.entries`
     *  is insertion order for string keys. */
    private static readonly (string Sign, string Word)[] CURRENCY =
    {
        ("$", "dalir"), ("€", "evrur"), ("£", "pund"), ("¥", "jen"),
    };

    /** Relational and operator signs, read in every position — a dropped sign is inaudible. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    {
        (JsRegex.Compile("±", "gu"), " plús mínus "),
        (JsRegex.Compile("[=≈]", "gu"), " jafnt og "),
        (JsRegex.Compile("<", "gu"), " minna en "),
        (JsRegex.Compile(">", "gu"), " meira en "),
        (JsRegex.Compile("×|(?<=\\p{Nd})[ \\t]?x[ \\t]?(?=\\p{Nd})", "gu"), " sinnum "),
        (JsRegex.Compile("÷", "gu"), " deilt með "),
    };

    private static readonly JsRe PLUS = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe SIGNED = JsRegex.Compile("(?<![\\p{L}\\d])([-−+])(\\d+)", "gu");
    private static readonly JsRe AMPSAND = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe WS_RUN = JsRegex.Compile("[ \\t]{2,}", "gu");

    /** The TS escapes a currency sign with `/[*+?^${}()|[\]\\]/gu → "\\$&"` (a literal backslash + the
     *  match) before building the two placement patterns. The C# literal is spelled the same: .NET's
     *  parser takes a backslash before $ as a literal backslash (only $$ escapes the dollar), so the
     *  replacement string is the same three characters in both engines. ⚠ DO NOT "double the escape"
     *  the .NET way: with an extra backslash the escape yields `\\$`, the composed pattern anchors on
     *  a stray end marker, and `$5` read *fˈɪm* — the sign silently dropped. Caught by the off-golden
     *  probe, not the gate. */
    private static readonly JsRe Escaper = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static string EscapeSign(string s) => Escaper.Replace(s, "\\$&");

    /** Normalize one Icelandic input string. Pure text→text. Steps are ORDER-DEPENDENT: de-grouping
     *  first, the ordinal rule after de-grouping and after the decimal rule, both of which own a
     *  period too. */
    public static string NormalizeIcelandic(string input)
    {
        var t = input;

        // 0) DOTTED ABBREVIATIONS, BEFORE every rule that reasons about a period. They carry no digit,
        //    so no numeric rule below could claim one — but the ordering is stated rather than relied on,
        //    because the period is contested by three separate rules in this file.
        foreach (var (re, word) in ABBREV) t = Rewrite(t, re, word);

        // 1) PERIOD-GROUPED THOUSANDS, FIRST — before the ordinal rule, which would otherwise claim the
        //    `1.` of `1.234`. The period is clause punctuation, so the numeral would read as "one" + a
        //    SENTENCE BREAK + "two hundred and thirty four".
        string prev;
        do
        {
            prev = t;
            t = Rewrite(t, GROUPED_DOT, "");
        } while (t != prev);

        // 2) DECIMAL COMMA. The comma is clause punctuation too, so `12,5` read as a PAUSE inside a
        //    number. Fractional part spoken digit by digit.
        t = Rewrite(t, DECIMAL_COMMA, m =>
            m.Groups[1].Value + " komma " + string.Join(" ", Js.CodePoints(m.Groups[2].Value)));

        // 3) CLOCK, COLON FORM ONLY. The period form is a decimal here — see the header.
        t = Rewrite(t, CLOCK, "$1 $2");

        // 4) PERCENT and DEGREES. Postposed.
        t = Rewrite(t, PERCENT, "$1 prósent");
        t = Rewrite(Rewrite(t, CELSIUS_SIGN, "°C"), FAHRENHEIT_SIGN, "°F");
        t = Rewrite(t, DEGREE_C, "$1 gráður á Celsíus");
        t = Rewrite(t, DEGREE_F, "$1 gráður á Fahrenheit");
        t = Rewrite(t, DEGREE_BARE, "$1 gráður");

        // 5) SQUARED UNITS, before the plain unit rule or the `km` is consumed and the exponent stranded.
        //    …and CUBED, the same shape — Icelandic fuses the measure word on like `fer-`.
        t = Rewrite(t, KM_SQUARED, "ferkílómetrar");
        t = Rewrite(t, M_SQUARED, "fermetrar");
        t = Rewrite(t, KM_CUBED, "rúmkílómetrar");
        t = Rewrite(t, M_CUBED, "rúmmetrar");

        // 6) LATIN UNIT ABBREVIATIONS after a number.
        // 6a) RATES, BEFORE the plain unit loop — that loop's guard is `(?!\p{L})`, which a slash
        //     satisfies, so it ate the numerator and left the denominator to read as a letter.
        t = Rewrite(t, RATE_KM, "kílómetrar á klukkustund");
        foreach (var (re, word) in UNITS_COMPOSED) t = Rewrite(t, re, $"$1 {word}");

        // 7) ORDINAL DOT — the largest defect. `3. maí` read as "þrír" + a SENTENCE BREAK + "maí".
        //    THE FORM IS SELECTED BY WHAT FOLLOWS: a month name takes the masculine nominative `-i`,
        //    the oblique forms of `öld` take `-u`, and everything else takes `-a` (the default).
        t = Rewrite(t, ORDINAL_DOT, m =>
        {
            if (!Manifest.MANIFEST.Ordinals.TryGetValue(m.Groups[1].Value, out var forms)) return m.Value;
            var next = m.Groups[2].Value;
            var word = MONTHS.IsMatch(next) ? forms.Masc
                : FEM_OBLIQUE.IsMatch(next) ? forms.FemOblique
                : forms.Common;
            return $"{word} {next}";
        });

        // 8) RANGES. Spoken `til`.
        t = Rewrite(t, RANGE, "$1 til $2");

        // 9) CURRENCY, both placements.
        foreach (var (sign, word) in CURRENCY)
        {
            var esc = EscapeSign(sign);
            t = Rewrite(t, JsRegex.Compile($"{esc}\\s*(\\d+)", "gu"), $"$1 {word}");
            t = Rewrite(t, JsRegex.Compile($"(\\d+)\\s*{esc}", "gu"), $"$1 {word}");
        }

        // 10) SIGNED NUMBERS — a sign PREFIXED to a number, after ranges so a range's dash is already gone.
        t = Rewrite(t, SIGNED, m =>
            (m.Groups[1].Value == "+" ? "plús" : "mínus") + " " + m.Groups[2].Value);

        // 11) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the
        //     relational signs are read in every position.
        t = Rewrite(t, PLUS, "$1 plús $2");
        foreach (var (re, word) in RELATIONAL) t = Rewrite(t, re, word);

        // 12) AMPERSAND → og.
        t = Rewrite(t, AMPSAND, " og ");

        // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
        return Rewrite(t, WS_RUN, " ");
    }
}
