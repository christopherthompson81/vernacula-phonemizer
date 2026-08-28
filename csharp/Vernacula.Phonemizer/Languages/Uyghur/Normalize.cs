/**
 * Uyghur / ئۇيغۇرچە (ug) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/uyghur/normalize.ts — see that file for the corpus evidence, and for why the
 * unit table is LOCAL rather than the shared symbol tier.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Uyghur;

public static class Normalize
{
    /** ASCII + Extended Arabic-Indic + Arabic-Indic, written out rather than `\d`: the engine's own number
     *  token is `\d+` and the two must agree. */
    private const string D = "0-9۰-۹٠-٩";
    /** A number with an optional decimal tail — the operand every symbol rule takes. */
    private const string NUM = "[" + D + "]+(?:[.][" + D + "]+)?";
    /** Every dash the corpus writes between a numeral and its ordinal noun, including the TATWEEL. */
    private const string DASH = "[-‐‑–—ـ]";

    private static readonly IReadOnlyDictionary<string, string> EASTERN = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["۰"] = "0", ["۱"] = "1", ["۲"] = "2", ["۳"] = "3", ["۴"] = "4", ["۵"] = "5", ["۶"] = "6", ["۷"] = "7", ["۸"] = "8", ["۹"] = "9",
        ["٠"] = "0", ["١"] = "1", ["٢"] = "2", ["٣"] = "3", ["٤"] = "4", ["٥"] = "5", ["٦"] = "6", ["٧"] = "7", ["٨"] = "8", ["٩"] = "9",
    };
    private static string ToAscii(string s) =>
        string.Concat(Js.CodePoints(s).Select(c => EASTERN.TryGetValue(c, out var v) ? v : c));

    /** Era abbreviation → the word it is read as. THE MULTI-PART ONES FIRST, or the era reads as its own
     *  opposite: both two-letter bodies open with the `م` of the bare AD marker. */
    private static readonly (string Body, string Word)[] ERA =
    {
        ("م\\s?\\.?\\s?ب", "مىلادىدىن بۇرۇن"),
        ("م\\s?\\.?\\s?ك", "مىلادىدىن كېيىن"),
        ("م", "مىلادى"),
        ("ھ", "ھىجرىيە"),
    };
    private const string ERA_TAIL = "\\s?\\.?\\s*";
    /** The first word of every ERA expansion, for the ordinal rule's guard — see step 7. */
    private const string ERA_HEADS = "مىلادى|ھىجرىيە";

    /** ⚠ MULTI-LETTER KEYS ONLY, longest first — `km²` before `km`, or the exponent is orphaned and read
     *  as an English word. */
    private static readonly (string Sym, string Word)[] UNITS =
    {
        ("km²", "كۋادرات كىلومېتىر"), ("km2", "كۋادرات كىلومېتىر"),
        ("كم²", "كۋادرات كىلومېتىر"), ("كم2", "كۋادرات كىلومېتىر"),
        ("km", "كىلومېتىر"), ("كم", "كىلومېتىر"),
        ("kg", "كىلوگرام"),
    };

    /** The bound case suffix on a percent, RE-DERIVED onto the ت-final stem `پىرسەنت` rather than copied. */
    private static readonly (string Written, string Derived)[] PCT_SUFFIX =
    {
        ("تىنى", "ىنى"), ("ىنى", "ىنى"), ("نىڭ", "نىڭ"), ("ىنىڭ", "ىنىڭ"),
        ("دىن", "تىن"), ("تىن", "تىن"), ("نى", "نى"), ("كە", "كە"), ("گە", "كە"),
        ("غا", "كە"), ("قا", "كە"), ("دا", "تا"), ("تا", "تا"), ("ى", "ى"),
    };
    // OrderByDescending, not List.Sort: JS Array.prototype.sort is STABLE and List.Sort is not, and the
    // alternation's order among equal-length keys is what the pattern's first-match picks.
    private static readonly string PCT_ALT =
        string.Join("|", PCT_SUFFIX.OrderByDescending(p => p.Written.Length).Select(p => p.Written));
    private static readonly IReadOnlyDictionary<string, string> PCT_MAP =
        PCT_SUFFIX.ToDictionary(p => p.Written, p => p.Derived, StringComparer.Ordinal);

    /** Re-spaced, never re-emitted verbatim: the corpus writes `35%نى` with no space anywhere. */
    private static string Percent(string n, string? suf) =>
        $"{n} پىرسەنت{(suf is null ? "" : (PCT_MAP.TryGetValue(Js.Trim(suf), out var v) ? v : ""))} ";

    private static readonly JsRe ENTITIES = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    private static readonly JsRe BOM = JsRegex.Compile("﻿", "gu");
    private static readonly JsRe PRESENTATION = JsRegex.Compile("[ﭐ-﷿ﹰ-﻿]", "gu");
    private static readonly JsRe HEH = JsRegex.Compile("ه", "gu");
    private static readonly JsRe KEHEH = JsRegex.Compile("ک", "gu");
    private static readonly JsRe QAF_DOT = JsRegex.Compile("ڧ", "gu");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe WS = JsRegex.Compile("\\s+", "u");
    private static readonly JsRe ORDINAL = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}([{D}]+)\\s*{DASH}\\s*(?=(?!{ERA_HEADS})[\\u0620-\\u06FF]{{2,}})", "gu");
    /** A magnitude word may sit between the number and its unit — `10 مىڭ كم²`. */
    private const string MAG = "(?:\\s(?:مىڭ|مىليون|مېليون|مىلىيون|مىليۇن|مېليۇن|مىليارد|مىليارت|مېليارت|تۈمەن))?";
    private static readonly JsRe SPELLED_EXPONENT = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(كىلومېت[ىې]?ر|مېت[ىې]?ر|مىتىر)\\s?²", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile($"(^|[\\s(\\[])[-−–]\\s?({NUM})(?=\\s?°\\s?[CF])", "gui");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile(
        $"(?<![{D}.,،])({NUM})\\s?°\\s?[CF]{Boundaries.NOT_LETTER_AFTER}", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile($"(?<![{D}.,،])({NUM})\\s?°", "gu");
    private static readonly string PCT_TAIL = $"(?:({PCT_ALT}){Boundaries.NOT_LETTER_AFTER})?";
    private const string NAMED = "(\\s*پ[ېى]رسەنت)?";
    private static readonly JsRe PCT_AFTER = JsRegex.Compile($"({NUM})\\s?[%٪]\\s?{NAMED}{PCT_TAIL}", "gu");
    private static readonly JsRe PCT_BEFORE = JsRegex.Compile($"[%٪]\\s?({NUM})\\s?{NAMED}{PCT_TAIL}", "gu");
    private static readonly (string Sign, string Word)[] CURRENCY =
    {
        ("US\\$", "ئامېرىكا دوللىرى"), ("\\$", "دوللار"), ("[￥¥]", "يۈەن"), ("₺", "لىرا"),
    };
    private static readonly JsRe DECIMAL = JsRegex.Compile(
        $"(?<![{D}.])([{D}]+)\\.([{D}]+)(?![{D}]|\\.[{D}])", "gu");

    /**
     * THE UYGHUR ORDINAL, COMPOSED from the cardinal: consonant-final + ىنچى, ى-final + نچى, ە-final drops
     * the ە first. In a multi-word numeral the suffix lands on the LAST word only.
     */
    private static string OrdinalWord(double n, Func<double, string> cardinal)
    {
        var words = WS.Re.Split(Js.Trim(cardinal(n))).ToList();
        var last = words.Count > 0 ? words[^1] : null;
        if (words.Count == 0 || last is null || last == "") return "";
        var stem = last.EndsWith("ە", StringComparison.Ordinal) ? last[..^1] : last;
        words[^1] = stem.EndsWith("ى", StringComparison.Ordinal) ? $"{stem}نچى" : $"{stem}ىنچى";
        return string.Join(" ", words);
    }

    /**
     * Builds the normalizer. `numeralWords` (non-negative integer → its Uyghur spelling) is INJECTED rather
     * than referenced directly: the engine calls the normalizer, so reaching back into it would be a cycle.
     */
    public static Func<string, string> MakeUyghurNormalizer(Func<double, string> numeralWords)
    {
        return input =>
        {
            // 1) NFC at the entry.
            var s = input.Normalize(NormalizationForm.FormC);

            // 2) HTML ENTITIES, before anything can read one as letters.
            s = Rewrite(Rewrite(s, ENTITIES, " "), BOM, "");

            // 3) ARABIC PRESENTATION FORMS — NFKC PER CHARACTER over a curated range, never over the whole
            //    string. The plain isolated/final heh forms are Uyghur's VOWEL ە, which NFKC gets wrong.
            s = Rewrite(s, PRESENTATION, m =>
                m.Value == "ﻩ" || m.Value == "ﻪ" ? "ە" : m.Value.Normalize(NormalizationForm.FormKC));

            // 4) ه U+0647 → ھ U+06BE, and 4b) the two other foreign-keyboard letters.
            s = Rewrite(s, HEH, "ھ");
            s = Rewrite(Rewrite(s, KEHEH, "ك"), QAF_DOT, "ف");

            // 5) ERA MARKERS, digit-anchored, and ABOVE the ordinal rule.
            foreach (var (body, word) in ERA)
            {
                var dot = body == "م" || body == "ھ" ? "\\s?\\." : "";
                s = Rewrite(s, JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}{body}{dot}{ERA_TAIL}(?=[{D}])", "gu")
                    , $"{word} ");
            }

            // 6) DIGIT DE-GROUPING, before the ordinal so a grouped operand is one number.
            foreach (var mark in new[] { "،", "," })
            {
                var strip = JsRegex.Compile(mark, "gu");
                s = Rewrite(s, JsRegex.Compile(
                        $"(?<![{D}.,،])[{D}]{{1,3}}(?:(?<!(?<![{D}])0){mark}[{D}]{{3}})+(?![{D}]|{mark}[{D}])", "gu")
                    , m => strip.Replace(m.Value, ""));
            }

            // 7) THE HYPHENATED ORDINAL — this language's defining rule, and the one rule here that emits
            //    WORDS rather than digits: the suffix attaches to the last word of the spoken numeral.
            s = Rewrite(s, ORDINAL, m =>
            {
                var n = Js.Number(ToAscii(m.Groups[1].Value));
                if (!UyghurPhonemizer.IsSafeInteger(n) || n < 1) return m.Value;
                var w = OrdinalWord(n, numeralWords);
                return w == "" ? m.Value : $"{w} ";
            });

            // 8) UNITS, before decimals and after de-grouping.
            foreach (var (sym, word) in UNITS)
            {
                var key = JsRegex.Replace(sym, ESCAPE, "\\$&");
                // The right guard is relaxed to Latin-only for a Latin key, so a bound case suffix glued to
                // `kg`/`km` does not make the whole match decline; ⟨ئ⟩ is the word boundary that keeps a
                // glued NEXT WORD out of the unit.
                var tail = JsRegex.Compile("^[A-Za-z]", "u").IsMatch(sym) ? "A-Za-z" : "\\p{L}";
                s = Rewrite(s, JsRegex.Compile(
                        $"(?<![\\p{{L}}\\p{{M}}{D}.,،])({NUM}{MAG})\\s?{key}(?![{tail}\\p{{M}}{D}²])(ئ?)", "gu")
                    , m =>
                    {
                        var hamza = m.Groups[2].Value;
                        return $"{m.Groups[1].Value} {word}{(hamza == "" ? "" : $" {hamza}")}";
                    });
            }
            // …and the unit noun already spelled out with a bare `²` hanging off it, which no symbol key
            // can reach: the exponent is lifted onto the WORD, in the preposed position كۋادرات takes.
            s = Rewrite(s, SPELLED_EXPONENT, "كۋادرات $1");

            // 9) THE MINUS, read only where a TEMPERATURE follows — the right context is what separates it
            //    from a range dash. Above step 10, which spends the `°C` this guard reads.
            s = Rewrite(s, MINUS, "$1مىنۇس $2");

            // 10) DEGREES. `°C` before the bare `°`, or the scale letter is read as the ENGLISH letter name.
            s = Rewrite(s, DEG_SCALE, "$1 گرادۇس");
            s = Rewrite(s, DEG_BARE, "$1 گرادۇس ");

            // 11) PERCENT — both sign orders, both signs, and the suffix re-derived onto the word.
            string Pct(System.Text.RegularExpressions.Match m)
            {
                var named = m.Groups[2].Success ? m.Groups[2].Value : null;
                var suf = m.Groups[3].Success ? m.Groups[3].Value : null;
                return named is null
                    ? Percent(m.Groups[1].Value, suf)
                    : $"{m.Groups[1].Value} {Js.Trim(named)}{suf ?? ""} ";
            }
            s = Rewrite(s, PCT_AFTER, Pct);
            s = Rewrite(s, PCT_BEFORE, Pct);

            // 12) CURRENCY. `US$` before `$`, or the `US` is left to the Latin fallback as letter names.
            foreach (var (sign, word) in CURRENCY)
            {
                s = Rewrite(s, JsRegex.Compile($"{sign}\\s?({NUM})", "gu"), $"$1 {word} ");
                s = Rewrite(s, JsRegex.Compile($"({NUM})\\s?{sign}", "gu"), $"$1 {word} ");
            }

            // 13) DECIMALS, LAST, because every rule above needs the number intact — and the separator is
            //     replaced by a SPACE rather than by a word (no decimal-point word is attested).
            s = Rewrite(s, DECIMAL, "$1 $2");

            return s;
        };
    }
}
