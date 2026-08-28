/**
 * Haitian Creole / kreyòl ayisyen (ht) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything
 * which is not already a pronounceable word into words the g2p already speaks. Pure text→text; no IPA.
 * Ported from src/languages/haitian/normalize.ts — see that file for the corpus evidence behind every arm,
 * and for the list of what is deliberately NOT done.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Haitian;

public static class Normalize
{
    /** ⚠ THE UNIT NOUN COMES AFTER THE NUMBER in Haitian, so the rewrite does NOT reorder. Longest key
     *  first — `km²`/`km2` must be tried before `km`, or the exponent is orphaned as a number. */
    private static readonly IReadOnlyList<KeyValuePair<string, string>> UNITS = new[]
    {
        new KeyValuePair<string, string>("km²", "kilomèt kare"),
        new KeyValuePair<string, string>("km2", "kilomèt kare"),
        new KeyValuePair<string, string>("m²", "mèt kare"),
        new KeyValuePair<string, string>("m2", "mèt kare"),
        new KeyValuePair<string, string>("m³", "mèt kib"),
        new KeyValuePair<string, string>("m3", "mèt kib"),
        new KeyValuePair<string, string>("km", "kilomèt"),
        new KeyValuePair<string, string>("cm", "santimèt"),
        new KeyValuePair<string, string>("mm", "milimèt"),
        new KeyValuePair<string, string>("kg", "kilogram"),
    };

    /** THE SAME SYMBOLS STANDING ALONE — the shared guards (Core/NormalizeSymbols.cs). */
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(UNITS);

    // ⚠ THE SEPARATOR CLASSES ARE SPELLED WITH ESCAPES, never with the invisible characters themselves: a
    // literal U+00A0 in a class is indistinguishable from the ASCII space beside it, and a class written
    // with two U+0020 is one space written twice (the shape #925 swept fleet-wide).
    private const string NBSP = "\u00a0";
    private const string GROUP_SPACE_CLASS = " \u00a0\u202f\u2009";

    private static readonly JsRe SUPERSCRIPT_TAIL = JsRegex.Compile("[²³]$", "u");
    private static readonly JsRe EXPONENT_TAIL = JsRegex.Compile("[²³23]$", "u");
    private static readonly JsRe ESC_RE = JsRegex.Compile(@"[.*+?^${}()|[\]\\]", "gu");
    private static readonly JsRe EXP_KEY_TAIL = JsRegex.Compile("([²³23])$", "u");

    /** …AND THE SAME THING WITH AN EXPONENT ON IT, which the shared pass cannot reach by construction. */
    private static readonly IReadOnlyList<(JsRe Re, string Word)> BARE_EXPONENT_UNITS = UNITS
        .Where(u => SUPERSCRIPT_TAIL.IsMatch(u.Key))
        .Select(u => (
            JsRegex.Compile(
                $@"(?<![\p{{L}}\p{{M}}\d.,/-]){u.Key[..^1]}\s?{u.Key[^1]}(?![\p{{L}}\p{{M}}\d/])",
                "gu"),
            u.Value))
        .ToList();

    /** ⚠ ASCENDING PAIRS ONLY — see normalize.ts for the ISBN / page-range / verse-span counts the guards
     *  are there to decline. */
    private static readonly JsRe RANGE =
        JsRegex.Compile(@"(?<![\d.,:\p{L}\p{M}-])(\d+)\s?[-–—]\s?(\d+)(?![\d\p{L}\p{M}-]|[.,]\d)", "gu");

    /** Read from the manifest — see the jsonc, where the evidence lives. */
    private static readonly IReadOnlyList<IReadOnlyList<string>> ORDINAL_TAIL = Manifest.MANIFEST.OrdinalTails;

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** The Haitian ordinal for `n`, or null when the composition has no attested tail (the `-en` band). */
    private static string? OrdinalWord(double n)
    {
        if (n == 1) return "premye"; // suppletive, ×6,723 — never *enyèm
        if (!IsSafeInteger(n) || n < 1) return null;
        var words = Numbers.NumberToWords(n).Split(' ');
        var last = words[^1];
        // Longest tail first, so `katòz` is not decided by `kat` and `senkant` is not decided by `senk`.
        IReadOnlyList<string>? best = null;
        foreach (var pair in ORDINAL_TAIL)
            if (last.EndsWith(pair[0], StringComparison.Ordinal) && (best is null || pair[0].Length > best[0].Length))
                best = pair;
        if (best is null) return null;
        words[^1] = last[..(last.Length - best[0].Length)] + best[1];
        return string.Join(" ", words);
    }

    /**
     * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period. `body` is the
     * abbreviation WITHOUT its final dot; the dot is consumed only when the sentence visibly continues.
     */
    private sealed record Dotted(JsRe AtEnd, JsRe Inline, string Word);

    private static Dotted MakeDotted(string body, string word) => new(
        JsRegex.Compile($@"(?<![\p{{L}}\p{{M}}]){body}\.(?=[ {NBSP}]*(?:$|\p{{Lu}}))", "gu"), // space, NBSP
        JsRegex.Compile($@"(?<![\p{{L}}\p{{M}}]){body}\.", "gu"),
        word);

    /** ⚠ LONGEST BODY FIRST — `av. J.-C.` must be claimed before a bare `J.-C.` can bite into its tail. */
    private static readonly IReadOnlyList<Dotted> ERA = new[]
    {
        MakeDotted(@"av\.\s?J\.-?[CK]", "anvan Jezi Kris"),
        MakeDotted(@"ap\.\s?J\.-?[CK]", "apre Jezi Kris"),
        MakeDotted(@"J\.-[CK]", "Jezi Kris"),
    };

    private static readonly JsRe ENTITIES = JsRegex.Compile(@"&\s?nbsp;|&#(?:x[0-9a-f]+|\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\u200b\u200c\u200d\ufeff]", "gu");
    private static readonly JsRe PAGE = JsRegex.Compile(@"(?<![\p{L}\p{M}])pp?\.\s?(?=\d)", "gu");
    private static readonly JsRe ISBN =
        JsRegex.Compile(@"(?<![\p{L}\p{M}])(ISBN(?:[- ]1[03])?)#?\s*:?\s*([\d][\d– -]*[\dXx])", "gu");
    private static readonly JsRe ISBN_SEPS = JsRegex.Compile("[– -]", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3})+)(?![\d]|\.\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile(@"\.", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        $@"(?<![\d.,])([1-9]\d{{0,2}})((?:[{GROUP_SPACE_CLASS}]\d{{3}})+)(?![\d]|[{GROUP_SPACE_CLASS}]\d)", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile($"[{GROUP_SPACE_CLASS}]", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile(@"(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)−(?=\p{Nd})", "gu");

    /** Step 5's per-unit arms, compiled once. */
    private sealed record UnitArms(JsRe? Rate, JsRe Magnitude, JsRe Span, JsRe Single, string Word);

    private static readonly IReadOnlyList<UnitArms> UNIT_ARMS = UNITS.Select(u =>
    {
        var sym = u.Key;
        // ⚠ THE EXPONENT MAY BE SET OFF BY A SPACE (`605 km ²`), so a key whose last character is the power
        // admits one optional gap before it.
        var key = JsRegex.Replace(JsRegex.Replace(sym, ESC_RE, "\\$&"), EXP_KEY_TAIL, "\\s?$1");
        var rate = EXPONENT_TAIL.IsMatch(sym)
            ? null // a rate never carries an exponent on its NUMERATOR here
            : JsRegex.Compile(
                $@"(?<![\p{{L}}\p{{M}}\d.,])(\d+(?:[.,]\d+)?)\s?{sym}\s?/\s?(h|èdtan)(?![\p{{L}}\p{{M}}\d])", "gu");
        return new UnitArms(
            rate,
            JsRegex.Compile(
                $@"(?<![\p{{L}}\p{{M}}\d.,])(\d+(?:[.,]\d+)?)\s?(milyon|milya|mil)\s?{key}(?![\p{{L}}\p{{M}}\d²³/])", "gu"),
            JsRegex.Compile(
                $@"(?<![\d.,:\p{{L}}\p{{M}}-])(\d+)\s?[-–—]\s?(\d+)\s?{key}(?![\p{{L}}\p{{M}}\d²³/])", "gu"),
            JsRegex.Compile(
                $@"(?<![\p{{L}}\p{{M}}\d.,])(?<!\d\s?[-–—]\s?)(\d+(?:[.,]\d+)?)\s?{key}(?![\p{{L}}\p{{M}}\d²³/])", "gu"),
            u.Value);
    }).ToList();

    private static readonly JsRe NUMERO = JsRegex.Compile(@"(?<![\p{L}\p{M}])[Nn]\s?°\s?(?=\d)", "gu");
    private static readonly JsRe CELSIUS = JsRegex.Compile(@"(?<![\d.,])(\d+(?:[.,]\d+)?)\s?°\s?C(?![\p{L}\p{M}])", "gui");
    private static readonly JsRe BARE_DEGREE = JsRegex.Compile(@"(?<=\d)\s?°(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe DIGIT_AFTER = JsRegex.Compile(@"^\s?\d", "u");
    private static readonly JsRe PCT_SPAN =
        JsRegex.Compile(@"(?<![\d.,])(\d+(?:[.,]\d+)?)\s?%\s?[-–—]\s?(\d+(?:[.,]\d+)?)\s?%", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile(@"(\d)\s?%", "gu");

    private const string MAG = "(?:milliards?|millions?|milyon|milya|mil)";
    private static readonly JsRe NAMED =
        JsRegex.Compile($@"^[\s)\]]*(?:{MAG}\s+)?(?:dola|dolar|dollars?)(?![\p{{L}}\p{{M}}])", "iu");
    private static readonly JsRe US_DOLLAR = JsRegex.Compile(@"(?<![\p{L}\p{M}])(US)\s?\$\s?(?=\d)", "giu");
    private static readonly JsRe DOLLAR =
        JsRegex.Compile($"\\$\\s?(\\d(?:[\\d \\u00a0,.]*\\d)?)(\\s?{MAG})?", "giu"); // NBSP
    /// <summary>⚠ THE GUARD IS A DOTTED CHAIN, NOT A TRAILING LETTER. It used to refuse any decimal a letter
    /// touched, to keep a designation (`802.11a`) out — but DECLINING IS NOT NEUTRAL: the separator survives
    /// and the tokenizer reads it as CLAUSE PUNCTUATION, so `17.09m.` came out *disɛt **.** nɛf m .*, a full
    /// stop mid-phrase and a dropped leading zero. Of the twelve letter-touching decimals in the corpora,
    /// six are real and six are DOI/URL fragments — and all six of the latter sit inside a dotted chain, so
    /// the LEADING guard already refused them. The trailing guard bought nothing and cost six.
    /// ⚠ Cost, stated: `802.11a` now reads a spurious *vigil* where it read a spurious full stop. Both are
    /// wrong; a false word is cheaper than a false clause boundary, and the shape is ×0 here. See the TS.</summary>
    private static readonly JsRe DECIMAL =
        JsRegex.Compile(@"(?<![\d.,])(\d+)[.,](\d+)(?![\d]|[.,]\d)", "gu");
    private static readonly JsRe FRACTION =
        JsRegex.Compile(@"(?<![\d\p{L}\p{M}/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu");
    private static readonly JsRe ORDINAL =
        JsRegex.Compile(@"(?<![\d\p{L}\p{M}])(\d+)\s?(?:yèm|ème|èm|em)(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile(@"\s?&\s?", "gu");

    /** Haitian Creole text normalization: symbols, numbers and ordinals → words the g2p already speaks. */
    public static string NormalizeHaitian(string input)
    {
        // 0) NFC at the entry, so a literal in this file matches whichever normalization the corpus used.
        var s = Renormalize(input, NormalizationForm.FormC);

        // 1) ZERO-WIDTH MARKS AND HTML ENTITIES, first — `&nbsp;` before the ampersand rule at step 13.
        s = Rewrite(Rewrite(s, ENTITIES, " "), ZERO_WIDTH, "");

        // 2) ERA MARKERS AND DOTTED ABBREVIATIONS, before anything can read an interior dot as a break.
        foreach (var d in ERA) s = Rewrite(Rewrite(s, d.AtEnd, $"{d.Word}."), d.Inline, d.Word);
        //    `p.` / `pp.` before a page number → `paj`.
        s = Rewrite(s, PAGE, "paj ");

        // 3) ISBN, before every numeric rule — an identifier is read DIGIT BY DIGIT, not as a quantity.
        s = Rewrite(s, ISBN, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(ISBN_SEPS.Replace(m.Groups[2].Value, "")))}");

        // 4) DIGIT DE-GROUPING, before every other numeric rule.
        s = Rewrite(s, GROUP_COMMA, m => COMMAS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_DOT, m => DOTS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_SPACE, m => GROUP_SPACES.Replace(m.Value, ""));

        // 4b) THE MINUS — U+2212 ONLY. See normalize.ts for why the ASCII hyphen is still refused.
        s = Rewrite(s, MINUS, "mwens ");

        // 5) UNITS, before decimals; the RATE first, before any arm that takes a unit on its own.
        foreach (var u in UNIT_ARMS)
            if (u.Rate is not null) s = Rewrite(s, u.Rate, $"$1 {u.Word} pa èdtan");
        foreach (var u in UNIT_ARMS)
        {
            s = Rewrite(s, u.Magnitude, $"$1 $2 {u.Word}");
            s = Rewrite(s, u.Span, m =>
                Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                    ? $"{m.Groups[1].Value} a {m.Groups[2].Value} {u.Word}"
                    : m.Value);
            s = Rewrite(s, u.Single, $"$1 {u.Word}");
        }
        //    …and the ones with NO numeral at all. Last, so the counted arms keep every match they can make.
        s = BARE_UNITS(s);
        foreach (var (re, word) in BARE_EXPONENT_UNITS) s = Rewrite(s, re, word);

        // 6) THE DEGREE SIGN, which does five different jobs on this wiki. The NUMERO arm runs first.
        s = Rewrite(s, NUMERO, "nimewo ");
        s = Rewrite(s, CELSIUS, "$1 degre Sèlsiyis");
        //    ⚠ AND IT RE-SPACES WHEN A DIGIT FOLLOWS, or `degre` and the arc-minutes fuse into one token.
        var beforeDegree = s;
        s = Rewrite(s, BARE_DEGREE, m =>
            DIGIT_AFTER.IsMatch(beforeDegree[(m.Index + m.Length)..]) ? " degre " : " degre");

        // 7) RANGES, before percent — `70-80%` is a range OF percents, so the pair must be claimed while
        //    both operands are still bare digits.
        s = Rewrite(s, PCT_SPAN, m =>
            Js.Number(Js.ReplaceFirst(m.Groups[1].Value, ",", ".")) < Js.Number(Js.ReplaceFirst(m.Groups[2].Value, ",", "."))
                ? $"{m.Groups[1].Value}% a {m.Groups[2].Value}%"
                : m.Value);
        s = Rewrite(s, RANGE, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                ? $"{m.Groups[1].Value} a {m.Groups[2].Value}"
                : m.Value);

        // 8) PERCENT → `pousan`, POSTPOSED.
        s = Rewrite(s, PERCENT, "$1 pousan");

        // 9) CURRENCY. `dola`, POSTPOSED, with the redundancy guard looking RIGHT.
        s = Rewrite(s, US_DOLLAR, "$1 ");
        var beforeDollar = s;
        s = Rewrite(s, DOLLAR, m =>
        {
            var quantity = m.Groups[1].Value + (m.Groups[2].Success ? m.Groups[2].Value : "");
            return NAMED.IsMatch(beforeDollar[(m.Index + m.Length)..]) ? quantity : $"{quantity} dola";
        });

        // 10) DECIMALS, after every rule that needs the number intact. The separator becomes `vigil`.
        s = Rewrite(s, DECIMAL, m =>
        {
            string @int = m.Groups[1].Value, frac = m.Groups[2].Value;
            return frac.Length <= 2 && !frac.StartsWith("0", StringComparison.Ordinal)
                ? $"{@int} vigil {frac}"
                : $"{@int} vigil {string.Join(" ", Js.CodePoints(frac))}";
        });

        // 11) FRACTIONS → the ordinal-denominator idiom. The denominator is capped at ten.
        s = Rewrite(s, FRACTION, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            var den = OrdinalWord(Js.Number(b));
            if (den is null || !(Js.Number(a) < Js.Number(b) && Js.Number(b) <= 10)) return m.Value;
            return Js.Number(a) == 1 ? $"yon {den}" : $"{a} {den}";
        });

        // 12) ORDINALS — this language's own suffix; the rule DECLINES rather than guesses.
        s = Rewrite(s, ORDINAL, m => OrdinalWord(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // 13) THE AMPERSAND → `ak`. ⚠ SPACED ON BOTH SIDES DELIBERATELY: `A&B` would otherwise be ONE token.
        s = Rewrite(s, AMPERSAND, " ak ");

        return s;
    }
}
