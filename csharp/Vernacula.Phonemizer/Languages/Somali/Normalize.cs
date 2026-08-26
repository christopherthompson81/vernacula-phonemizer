/**
 * Somali (so) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/somali/normalize.ts — see that file for the corpus evidence behind every arm.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Somali;

public static class Normalize
{
    /** The unit table, named once so the tier and the four local rules in step 3b cannot disagree.
     *  ⚠ INSERTION-ORDERED: the longest-first sorts below are STABLE, so this order decides the ties. */
    private static readonly IReadOnlyDictionary<string, string> UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kiiloomitir", ["m"] = "mitir", ["cm"] = "sentimitir",
        ["mm"] = "milimitir", ["ha"] = "hektar", ["mi"] = "mayl",
    };

    private static readonly IReadOnlyDictionary<string, string> EXPONENT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["²"] = "laba jibaaran", ["³"] = "cubo", ["2"] = "laba jibaaran", ["3"] = "cubo",
    };

    /** Any declared key, longest first so `km` cannot be matched as `m`. */
    private static readonly string UNIT_KEYS =
        string.Join("|", UNIT.Keys.OrderByDescending(k => k.Length));

    /** The keys safe to read with NO NUMBER ATTACHED — `IsBareUnitKey`'s test on this language's table. */
    private static readonly string BARE_KEYS =
        string.Join("|", UNIT.Keys.Where(NormalizeSymbols.IsBareUnitKey).OrderByDescending(k => k.Length));

    /** The shared symbol tier — see the TS module for the per-word corpus counts and the `kg` refusal. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "boqolkiiba" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "doolar" },
            ["US$"] = new[] { "doolar Maraykanka" },
            ["€"] = new[] { "yuuro" },
            ["Sh.So."] = new[] { "shilin Soomaali" },
        },
        Magnitudes = new[] { "kun", "malyan", "milyan", "bilyan", "tirilyan" },
        Units = UNIT.ToDictionary(e => e.Key, e => (IReadOnlyList<string>)new[] { e.Value }, StringComparer.Ordinal),
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "laba jibaaran" },
            Cubed = new[] { "cubo" },
        },
        UnitPer = "halkii",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["s"] = "ilbiriqsi", ["h"] = "saacad" },
        Ampersand = "iyo",
        Multiply = new MultiplyDef { Times = "ku dhufan" },
    });

    /** Compass points for the COORDINATE sense of `°`, keyed lowercase (the rule matches case-insensitively). */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["n"] = "waqooyi", ["s"] = "koonfur", ["e"] = "bari", ["w"] = "galbeed",
    };

    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_PERIOD = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMA = JsRegex.Compile(",", "g");
    private static readonly JsRe PERIOD = JsRegex.Compile("\\.", "g");
    private static readonly JsRe GLUED_H = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)H(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe GLUED_M = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)M(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe YEAR_CONTEXT = JsRegex.Compile("[Ss]anad|[Bb]ish|[Qq]arni|Hijri|=", "u");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d.:])([01]?\\d|2[0-3]):([0-5]\\d)\\b(?!\\.?\\d)", "gu");
    private static readonly JsRe ORDINAL_TAIL = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe BARE_RATE = JsRegex.Compile(
        $@"(?<=[\d\p{{L}}])\s*/\s*(?=(?:sq |cu )?(?:{UNIT_KEYS})(?:[²³23])?(?![\p{{L}}\p{{M}}\d]))", "gu");
    private static readonly JsRe SPACED_EXPONENT = JsRegex.Compile(
        $@"(?<![\p{{L}}\p{{M}}])({UNIT_KEYS})\s+([23])(?![\d\p{{L}}\p{{M}}])", "gu");
    private static readonly JsRe SQ_CU = JsRegex.Compile(
        $@"(?<![\p{{L}}\p{{M}}])(sq|cu)\s+({UNIT_KEYS})(?![\p{{L}}\p{{M}}\d])", "giu");
    private static readonly JsRe MPH = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d)\\s*mph(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe BARE_UNIT_EXPONENT = JsRegex.Compile(
        $@"(?<![\p{{L}}\p{{M}}\p{{Nd}}'’ʼ-])({BARE_KEYS})([²³23])(?![\p{{L}}\p{{M}}\d])", "gu");
    private static readonly JsRe HYPHEN_UNIT = JsRegex.Compile(
        $@"(\d)-(?=(?:{UNIT_KEYS})(?:[²³23])?(?![\p{{L}}\p{{M}}\d]))", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)[.,](\\d{1,2})(?![\\d.,])", "gu");
    private static readonly JsRe ERA_CH = JsRegex.Compile("(\\d)\\s*C\\.?\\s?H\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_CD = JsRegex.Compile("(\\d)\\s*C\\.?\\s?D\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile("(\\d)\\s*(?:BCE|BC)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_CE = JsRegex.Compile("(\\d)\\s*(?:CE|AD)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_AH = JsRegex.Compile("(\\d)\\s*AH(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<!\\b(?:ilaa|dhaxaysay|inta)\\s)(?<![\\d.,\\p{L}-])(\\d+)\\s?[-–]\\s?(\\d+)(?![\\d,-])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEW])(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
    public static string NormalizeSomali(string input)
    {
        var s = input;

        // 1. De-group thousands — EXACTLY THREE DIGITS PER GROUP, so `0.53` and `2.5` survive as decimals.
        s = GROUP_COMMA.Replace(s, m => COMMA.Replace(m.Value, ""));
        s = GROUP_PERIOD.Replace(s, m => PERIOD.Replace(m.Value, ""));

        // 2. The glued calendar letters — BEFORE the tier, which would otherwise strand the `M`.
        s = GLUED_H.Replace(s, "$1 Hijri");
        var src = s; // the JS callback's 4th argument: the string as it stands BEFORE this replace
        s = GLUED_M.Replace(src, m =>
        {
            var n = m.Groups[1].Value;
            if (n.Length < 3) return $"{n} milyan";
            var off = m.Index;
            return YEAR_CONTEXT.IsMatch(src[Math.Max(0, off - 45)..off]) ? $"{n} Miilaadi" : m.Value;
        });

        // 3. Clock — BEFORE the decimal rule, which would otherwise claim `2:00` and `8:15`.
        s = CLOCK.Replace(s, m =>
        {
            var h = Js.NumberToString(Js.Number(m.Groups[1].Value));
            var min = Js.Number(m.Groups[2].Value);
            return min == 0 ? h : $"{h} iyo {Js.NumberToString(min)}";
        });

        // 3b-i. The English ordinal tail → the corpus's own bound `-aad`.
        s = ORDINAL_TAIL.Replace(s, "$1aad");
        // 3b-ii. The bare rate — ⚠ FIRST of the four, because every rule below rewrites the text its
        //        lookahead is reading.
        s = BARE_RATE.Replace(s, " halkii ");
        // 3b-iii. The exponent written with a space (`91 km 2`) — a MIS-READING, not a leak.
        s = SPACED_EXPONENT.Replace(s, "$1$2");
        // 3b-iv. `sq`/`cu` → the measure WORDS, and only before a DECLARED unit. ⚠ BOTH captures are folded:
        //        this is the only arm in step 3b with the `i` flag, and an unfolded unit key missed the table.
        s = SQ_CU.Replace(s, m =>
        {
            var mod = m.Groups[1].Value;
            var u = m.Groups[2].Value;
            return $"{UNIT[u.ToLowerInvariant()]} {(mod.ToLowerInvariant() == "sq" ? EXPONENT["2"] : EXPONENT["3"])}";
        });
        // 3b-v. `mph` spelled as the rate it abbreviates.
        s = MPH.Replace(s, "$1 mi/h");
        // 3b-vi. A bare unit carrying an exponent — Somali has both measure words, so nothing is stranded.
        s = BARE_UNIT_EXPONENT.Replace(s, m => $"{UNIT[m.Groups[1].Value]} {EXPONENT[m.Groups[2].Value]}");
        // 3b-vii. The hyphen-attached unit (`750-km`) — a declared unit key is not a Somali suffix.
        s = HYPHEN_UNIT.Replace(s, "$1 ");

        // 4. The shared tier — BEFORE the decimal rule, AFTER de-grouping.
        s = SYMBOLS(s);

        // 5. Decimals → `dhibic`, fractional part digit by digit.
        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} dhibic {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 6. Era markers. ⚠ LONGEST FIRST, and BCE before BC or the `E` is stranded.
        s = ERA_CH.Replace(s, "$1 Ciise Hortiis");
        s = ERA_CD.Replace(s, "$1 Ciise Dabadiis");
        s = ERA_BC.Replace(s, "$1 Ciise Hortiis");
        s = ERA_CE.Replace(s, "$1 Miilaadi");
        s = ERA_AH.Replace(s, "$1 Hijri");

        // 7. Ranges → `ilaa`.
        s = RANGE.Replace(s, "$1 ilaa $2");

        // 8. Fractions.
        s = FRACTION.Replace(s, m =>
        {
            double n = Js.Number(m.Groups[1].Value), d = Js.Number(m.Groups[2].Value);
            if (n == 1 && d == 2) return "nus";
            if (n == 1 && d == 4) return "rubuc";
            return $"{m.Groups[1].Value} {m.Groups[2].Value} meelood";
        });

        // 9. Degrees.
        s = DEG_C.Replace(s, "$1 darajo Celsius");
        s = DEG_F.Replace(s, "$1 darajo Fahrenheit");
        s = DEG_COMPASS.Replace(s, m =>
            $"{m.Groups[1].Value} darajo {COMPASS[m.Groups[2].Value.ToLowerInvariant()]}");
        s = DEG_BARE.Replace(s, "$1 darajo");

        // 10. Signs. ⚠ PLUS BEFORE MINUS, or the minus arm claims the bracketed operand of `5 + (−3)`.
        s = PLUS_AFTER.Replace(s, "$1 ku dar $2");
        s = PLUS_LEADING.Replace(s, "$1ku dar $2");
        s = MINUS.Replace(s, "$1laga jaray $2");
        s = PLUS_MINUS.Replace(s, " ku dar ama laga jaray ");
        s = EQUALS.Replace(s, " u dhiganta ");
        s = LESS_THAN.Replace(s, " ka yar ");
        s = GREATER_THAN.Replace(s, " ka badan ");
        s = DIVIDE.Replace(s, " loo qeybiyay ");

        return s;
    }
}
