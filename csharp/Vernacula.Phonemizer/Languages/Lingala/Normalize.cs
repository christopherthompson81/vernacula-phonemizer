/**
 * Lingala / Lingála (ln) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/lingala/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lingala;

public static class Normalize
{
    /**
     * ⚠ THE UNIT NOUN COMES BEFORE THE NUMBER IN LINGALA, which is why units are local and not the shared
     * tier's — `normalizeSymbols` can only POSTPOSE (playbook §47 reason 2, the Oromo case).
     */
    private static readonly (string Sym, string Word)[] UNITS =
    {
        // ⚠ ORDER IS LOAD-BEARING: iterated in order, so `km²`/`km2` must be claimed before `km`, or the
        // exponent is orphaned and read as a separate number.
        ("km\u00b2", "kilomɛtrɛ-kare"), ("km2", "kilomɛtrɛ-kare"),
        ("m\u00b2", "mɛtrɛ-kare"), ("m2", "mɛtrɛ-kare"),
        ("km", "kilomɛtrɛ"), ("cm", "sɛntimɛtɛlɛ"), ("mm", "milimɛtrɛ"), ("kg", "kilogálame"),
    };

    /** The same unit symbols standing alone, with no numeral beside them. */
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(
        UNITS.Select(u => new KeyValuePair<string, string>(u.Sym, u.Word)));

    /** Number ranges → the connective `kino`. ASCENDING pairs only; chained and colon-preceded pairs are
     *  declined (ISBNs, ISO codes, scripture spans). */
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,:\\p{L}\\p{M}-])(\\d+)(\\s?)[-\u2013\u2014]\\s?(\\d+)(?![\\d\\p{L}\\p{M}-]|[.,]\\d)", "gu");

    /** Era markers and dotted abbreviations, expanded before any rule can read an interior dot as a break. */
    private static readonly (string Body, string Word)[] DOTTED =
    {
        // ⚠ ORDER IS LOAD-BEARING: longest body first — `L.T.B` must be claimed before `T.B` bites into its
        // tail, and `n. Y.K` before bare `Y.K`.
        ("L\\.T\\.B", "liboso ya tango na biso"),
        ("T\\.B", "tango na biso"),
        ("n\\.\\s?Y\\.K", "nsima ya Yézu Klísto"),
        ("Y\\.K", "Yézu Klísto"),
        ("b\\.n\\.b", "bôngó na bôngó"),
    };

    /** Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period. */
    private static string ExpandDotted(string s, string body, string word)
    {
        var atEnd = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.(?=[ \u00a0]*(?:$|\\p{{Lu}}))", "gu");
        var inline = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.", "gu");
        return inline.Replace(atEnd.Replace(s, $"{word}."), word);
    }

    private static readonly JsRe ENTITIES = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\u200b\u200c\u200d\ufeff]", "gu");
    private static readonly JsRe ISBN = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(ISBN(?:[- ]1[03])?)\\s*:?\\s*([\\d][\\d\u2013 -]*[\\dXx])", "gu");
    private static readonly JsRe ISBN_SEPS = JsRegex.Compile("[\u2013 -]", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?![\\d]|,\\d)", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?![\\d]|\\.\\d)", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<![\\d.,])([1-9]\\d{0,2})((?:[ \u00a0\u202f\u2009]\\d{3})+)(?![\\d]| \\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile("[ \u00a0\u202f\u2009]", "gu");
    private static readonly JsRe DEGREE_C = JsRegex.Compile(
        "(?<![\\d.,])(\\d+(?:[.,]\\d+)?)\\s?\u00b0\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe PCT_RANGE = JsRegex.Compile(
        "(?<![\\d.,])(\\d+(?:[.,]\\d+)?)\\s?%\\s?[-\u2013\u2014]\\s?(\\d+(?:[.,]\\d+)?)\\s?%", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+)\\s?%", "gu");
    private static readonly JsRe NAMED = JsRegex.Compile(
        "(?:dolare|dolar|badollar|dollars?|falánga|falanga)\\s*$", "iu");
    private static readonly JsRe US_DOLLAR = JsRegex.Compile("(?<![\\p{L}\\p{M}])US\\s?\\$\\s?(\\d)", "giu");
    private static readonly JsRe DOLLAR_BEFORE = JsRegex.Compile("\\$\\s?(\\d[\\d ,.]*)", "gu");
    private static readonly JsRe DOLLAR_AFTER = JsRegex.Compile("(\\d[\\d ,.]*?)\\s?\\$", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+)[.,](\\d+)(?![\\d\\p{L}\\p{M}])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d\\p{L}\\p{M}/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe QUARTER = JsRegex.Compile("\u00bc", "gu");
    private static readonly JsRe HALF = JsRegex.Compile("\u00bd", "gu");
    private static readonly JsRe ORD_FIRST = JsRegex.Compile("(?<![\\d\\p{L}\\p{M}])1\\s?(?:er|ère|re)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ORD_EME = JsRegex.Compile("(?<![\\d\\p{L}\\p{M}])(\\d+)\\s?(?:ème|nd)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ORD_E = JsRegex.Compile("(?<![\\d\\p{L}\\p{M}])(\\d+)e(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s?&\\s?", "gu");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");

    /** The ONE number word this layer emits: the suppletive first ordinal, for the French `1er`/`1ère`
     *  shape. Read from the manifest rather than spelled here, so it cannot drift from the data. */
    private static string FIRST_ORDINAL => Manifest.DEF.Numbers.FirstCard;

    /**
     * Normalize one Lingala input string. Pure text→text; every rule emits DIGITS wherever a number is
     * involved and lets the engine's own number path speak them (the first ordinal above is the exception).
     */
    public static string NormalizeLingala(string input)
    {
        // NFC at the entry so the literals in this file match whichever normalization the text arrived in;
        // the engine NFDs again downstream.
        var s = input.Normalize(System.Text.NormalizationForm.FormC);

        // ⚠ Entities first, before the ampersand rule at the bottom, or `&nbsp;` reads as "and n-b-s-p".
        s = ZERO_WIDTH.Replace(ENTITIES.Replace(s, " "), "");

        // ⚠ Dotted abbreviations before the de-grouping arms below: both look at dots, and de-grouping first
        // would leave nothing recognisable.
        foreach (var (body, word) in DOTTED) s = ExpandDotted(s, body, word);

        // ⚠ ISBN before every numeric rule, RANGE included: its inner hyphen pairs are exactly the ascending
        // shape RANGE looks for. Read digit by digit — an identifier is not a quantity.
        s = ISBN.Replace(s, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(ISBN_SEPS.Replace(m.Groups[2].Value, "")))}");

        // ⚠ Digit de-grouping before every other numeric rule, or the grouping mark reads as clause
        // punctuation and the tail as its own number. Exactly three digits per group is the discriminator
        // against the decimal separator.
        s = GROUP_COMMA.Replace(s, m => COMMAS.Replace(m.Value, ""));
        s = GROUP_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));
        s = GROUP_SPACE.Replace(s, m => SPACES.Replace(m.Value, ""));

        // ⚠ Units before decimals — the number-unit adjacency is destroyed the moment a decimal is rewritten
        // into spaced digits — and after de-grouping, so `1 800 km` is already one token. The rewrite
        // REORDERS: Lingala puts the unit noun in front of the figure.
        foreach (var (sym, word) in UNITS)
        {
            var key = ESCAPE.Replace(sym, "\\$&");
            s = JsRegex.Compile(
                    $"(?<![\\d.,:\\p{{L}}\\p{{M}}-])(\\d+)\\s?[-\u2013\u2014]\\s?(\\d+)\\s?{key}(?![\\p{{L}}\\p{{M}}\\d²³/])",
                    "gu")
                .Replace(s, m =>
                {
                    string a = m.Groups[1].Value, b = m.Groups[2].Value;
                    return Js.Number(a) < Js.Number(b) ? $"{word} {a} kino {b}" : m.Value;
                });
            s = JsRegex.Compile(
                    $"(?<![\\p{{L}}\\p{{M}}\\d.,])(?<!\\d\\s?[-\u2013\u2014]\\s?)(\\d+(?:[.,]\\d+)?)\\s?{key}(?![\\p{{L}}\\p{{M}}\\d²³/])",
                    "gu")
                // ⚠ The single-operand arm must refuse a span's second half (`(?<!\d\s?[-–—]\s?)`), so a
                // span it declined reaches RANGE whole rather than with its tail already rewritten.
                .Replace(s, $"{word} $1");
        }
        s = BARE_UNITS(s);

        s = DEGREE_C.Replace(s, "Celsius $1");

        // ⚠ Ranges before percent: `2-3%` is a range OF percents, and once the percent words are inserted
        // there is no digit pair left to match.
        s = PCT_RANGE.Replace(s, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            return Js.Number(Js.ReplaceFirst(a, ",", ".")) < Js.Number(Js.ReplaceFirst(b, ",", "."))
                ? $"{a}% kino {b}%" : m.Value;
        });
        s = RANGE.Replace(s, m =>
        {
            string a = m.Groups[1].Value, gap = m.Groups[2].Value, b = m.Groups[3].Value;
            if (Js.Number(a) >= Js.Number(b)) return m.Value;
            if (gap != "" && a.Length < 2 && b.Length < 2) return m.Value; // spaced single digits: a score
            return $"{a} kino {b}";
        });

        s = PERCENT.Replace(s, "$1 likolo ya mokama");

        s = US_DOLLAR.Replace(s, "dolare $1");
        {
            var subject = s;
            s = DOLLAR_BEFORE.Replace(s, m =>
                NAMED.IsMatch(subject[..m.Index]) ? m.Groups[1].Value : $"dolare {m.Groups[1].Value}");
        }
        {
            var subject = s;
            s = DOLLAR_AFTER.Replace(s, m =>
                NAMED.IsMatch(subject[..m.Index]) ? m.Groups[1].Value : $"dolare {m.Groups[1].Value}");
        }

        // ⚠ Decimals last of the numeric rules, after everything that needs the number intact. The separator
        // becomes NOTHING and the fractional digits are spaced apart, so they are read one at a time.
        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        s = FRACTION.Replace(s, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) && Js.Number(b) <= 10 ? $"{a} ya {b}" : m.Value;
        });
        s = HALF.Replace(QUARTER.Replace(s, " mǒkó ya mínei "), " mǒkó ya míbalé ");

        s = ORD_FIRST.Replace(s, $"ya {FIRST_ORDINAL}");
        s = ORD_EME.Replace(s, "ya $1");
        s = ORD_E.Replace(s, "ya $1");

        s = AMPERSAND.Replace(s, " mpé ");

        return s;
    }
}
