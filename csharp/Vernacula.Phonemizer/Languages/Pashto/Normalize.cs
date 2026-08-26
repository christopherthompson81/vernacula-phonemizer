/**
 * Pashto / پښتو (ps) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/pashto/normalize.ts — see that file for the corpus evidence.
 */

using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Pashto;

public static class Normalize
{
    /** ASCII + Arabic-Indic + Extended Arabic-Indic, written out rather than `\p{Nd}`/`\d`: the engine's own
     *  `DIGIT_CLASS` is exactly this set and the two must agree, and .NET's `\d` is Unicode-wide where the
     *  TS `\d` is ASCII — neither is the set Pashto actually writes. */
    private const string D = "0-9\u06f0-\u06f9\u0660-\u0669";
    /** "not inside a word": `\p{M}` beside `\p{L}`, never `\b` — `\b` is ASCII-word-based in both runtimes. */
    private static readonly IReadOnlyDictionary<string, string> EASTERN = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["۰"] = "0", ["۱"] = "1", ["۲"] = "2", ["۳"] = "3", ["۴"] = "4", ["۵"] = "5", ["۶"] = "6", ["۷"] = "7", ["۸"] = "8", ["۹"] = "9",
        ["٠"] = "0", ["١"] = "1", ["٢"] = "2", ["٣"] = "3", ["٤"] = "4", ["٥"] = "5", ["٦"] = "6", ["٧"] = "7", ["٨"] = "8", ["٩"] = "9",
    };
    private static string ToAscii(string s) =>
        string.Concat(Js.CodePoints(s).Select(c => EASTERN.TryGetValue(c, out var v) ? v : c));

    /** Era abbreviation → the word it is read as. ORDER IS LOAD-BEARING throughout — see the notes below. */
    private static readonly (string Body, string Word)[] ERA =
    {
        // Longest body first: the qualified Hijri forms must precede bare هـ, or the qualifier is stranded
        // as a one-letter token (`۶۳هـ ق` is Hijri LUNAR, `۱۴۰۰ هـ ش` Hijri SOLAR).
        ("هـ\\s?ق", "هجري قمري"),
        ("هـ\\s?[شس]", "هجري شمسي"),
        ("هـ\\s?ل", "هجري لمريز"),
        ("هـ\\.?", "هجري"),
        // ⚠ `م.ز` IS BC AND MUST BE CLAIMED BEFORE THE BARE `م` below, or the era is read as its own OPPOSITE:
        // the `م` arm would take the `م`, emit میلادي (AD) and strand the `ز` as a bare consonant.
        ("م\\s?[.‌ ]?\\s?ز", "مخزېږديز"),
        // Multi-part before single part, same coupling as above: claimed whole so the abbreviated `ک.` is not
        // left behind, and the doubled `ل ل` before the single `ل`.
        ("ز\\s?\\.\\s?ک\\.?", "زېږديز کال"),
        ("ل\\s?\\.?\\s?ل", "لمريز"),
        ("ل\\.?", "لمريز"),
        ("ز\\.?", "زېږديز"),
        // ⚠ THE BARE `م` IS SAFE HERE ONLY BECAUSE THE ORDINAL STEP HAS ALREADY RUN. It is the same letter as
        // the ordinal suffix; the ordinal rule claims every `Nم` below 100 first, so whatever bare `م` still
        // stands against a digit is a year. Reversing the two steps reads `۲۰م پېړۍ` (20th century) as "20 AD".
        ("م\\.?", "میلادي")
    };

    /**
     * ⚠ THE ORDINAL SUFFIX AND THE `م` ERA MARKER ARE THE SAME LETTER. `مه`/`مې` are unambiguously the ordinal
     * and are claimed first (longest form first); bare `م` is settled by the operand's SIZE — ordinal below
     * 100, era at 100 and above — which is the `cutoff` in the loop that consumes this array.
     */
    private static readonly string[] ORD_SUFFIX = { "مه", "مې", "م" };

    private static readonly JsRe WS = JsRegex.Compile("\\s+", "u");

    /**
     * The Pashto ordinal, COMPOSED from the cardinal rather than tabulated: three suppletive/irregular cells
     * (1, 2, 3) plus a stem alternation on the last cardinal word. The suffix is whatever the text wrote, so
     * the rule never has to guess gender/case agreement.
     */
    private static string OrdinalWords(double n, string suffix, Func<double, string> cardinal)
    {
        var tail = suffix[1..]; // "" | "ه" | "ې" — the gender/case vowel the text chose
        if (n == 1) return suffix == "م" ? "لومړی" : "لومړۍ";
        if (n == 2) return $"دویم{tail}";
        if (n == 3) return $"درېیم{tail}";
        var words = WS.Re.Split(cardinal(n).Trim()).ToList();
        if (words.Count == 0 || words[0] == "") return "";
        var last = words[^1];
        var stem = last.EndsWith("ه", StringComparison.Ordinal) ? last[..^1]
            : last.EndsWith("ا", StringComparison.Ordinal) ? $"{last}ه"
            : last;
        words[^1] = $"{stem}{suffix}";
        return string.Join(" ", words);
    }

    /**
     * Units are handled locally rather than by the shared tier: that tier runs AFTER this file, and this file
     * rewrites the decimal point into a WORD, so by then there is no number-unit adjacency left to match.
     * Multi-letter keys only — a bare `m` key would claim fragments of embedded Latin text.
     */
    private static readonly (string Sym, string Word)[] UNITS =
    {
        // Longest key first — `km²`/`km2` before `km`, or the exponent is orphaned and read as a number.
        ("km²", "کیلو متر مربع"),
        ("km2", "کیلو متر مربع"),
        ("m²", "متر مربع"),
        ("m2", "متر مربع"),
        ("km", "کیلومتره"),
        ("cm", "سانتي متره"),
        ("mm", "ملي متره"),
        ("kg", "کیلوګرامه")
    };

    private static readonly JsRe ENTITIES = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    private static readonly JsRe BOM = JsRegex.Compile("[\ufeff]", "gu");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe QM_ERA = JsRegex.Compile($"([{D}])\\s*ق\\s*\\.?\\s*م\\s*\\.?{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe GROUP_AR_COMMA = JsRegex.Compile(
        $"(?<![{D}.,،])([{D}]{{1,3}})((?:(?<!(?<![{D}])0)،[{D}]{{3}})+)(?![{D}]|،[{D}])", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile(
        $"(?<![{D}.,،])([{D}]{{1,3}})((?:(?<!(?<![{D}])0),[{D}]{{3}})+)(?![{D}]|,[{D}])", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile(
        $"(?<![{D}.,،])([{D}]{{1,3}})((?:(?<!(?<![{D}])0)\\.[{D}]{{3}}){{2,}})(?![{D}]|\\.[{D}])", "gu");
    private static readonly JsRe AR_COMMAS = JsRegex.Compile("،", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile(
        $"(?<![{D}.,،])([{D}]+(?:[.,،][{D}]+)?)\\s?°\\s?[CcسS]{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe DEG_SIGN = JsRegex.Compile($"(?<![{D}.,،])([{D}]+(?:[.,،][{D}]+)?)\\s?℃", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile($"(?<![{D}:.])([{D}]{{1,2}}):([{D}]{{2}})(?![{D}:.])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        $"(?<![{D}.,،:\\p{{L}}\\p{{M}}-])([{D}]+)\\s?[-–—]\\s?([{D}]+)(?![{D}\\p{{L}}\\p{{M}}-]|[,،][{D}])", "gu");
    private static readonly JsRe PCT_AFTER = JsRegex.Compile($"([{D}]+(?:[.,،][{D}]+)?)\\s?[٪%](\\s*سلنه)?", "gu");
    private static readonly JsRe PCT_BEFORE = JsRegex.Compile($"[٪%]\\s?([{D}]+(?:[.,،][{D}]+)?)(\\s*سلنه)?", "gu");
    private static readonly JsRe NAMED_L = JsRegex.Compile("(?:ډالر[وه]?|dollars?|USD)\\s*$", "iu");
    private static readonly JsRe NAMED_R = JsRegex.Compile("^[^\\n]{0,30}?(?:ډالر|USD|امریکایي|امريکايي)", "u");
    private const string MAG = "(\\s*(?:میلیارد|ميليارد|میلیون|ميليون|ملیون|بیلیون|بيليون|ټریلیون|زره|زر)[هو]?)?";
    private static readonly JsRe DOLLAR_BEFORE = JsRegex.Compile($"\\$\\s?([{D}]+(?:[.,،][{D}]+)?){MAG}", "gu");
    private static readonly JsRe DOLLAR_AFTER = JsRegex.Compile($"([{D}]+(?:[.,،][{D}]+)?)\\s?\\${MAG}", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile($"(^|[\\s(（\\[])[-−–]([{D}])", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile(
        $"(?<![{D}.,،٫])([{D}]+)[.,،٫]([{D}]+)(?![{D}\\p{{L}}\\p{{M}}]|[.,،٫][{D}])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile(
        $"(?<![{D}\\p{{L}}\\p{{M}}/])([{D}]{{1,3}})/([{D}]{{1,3}})(?![{D}/])(\\s*برخ[ېه])?", "gu");

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /**
     * Builds the normalizer. `numeralWords` (non-negative integer → its Pashto spelling) is INJECTED rather
     * than referenced directly: the engine calls the normalizer, so reaching back into it would be a cycle.
     * Every rule emits DIGITS where the value is spoken, leaving the engine's numeral path the single place a
     * number becomes words; the ordinal rule is the one exception, because a suffix cannot be applied to digits.
     */
    public static Func<string, string> MakePashtoNormalizer(Func<double, string> numeralWords)
    {
        return input =>
        {
            var s = input.Normalize(System.Text.NormalizationForm.FormC);

            s = BOM.Replace(ENTITIES.Replace(s, " "), "");

            // ORDINALS BEFORE THE ERA RULE: `مه`/`مې` are longer than the era's bare `م` and are the same
            // letter (see ORD_SUFFIX). This rule emits WORDS where every other rule emits digits, because a
            // gender/case suffix written after the digits has to agree with the words.
            foreach (var suffix in ORD_SUFFIX)
            {
                var cutoff = suffix == "م" ? 100d : double.PositiveInfinity; // the bare-`م` era/ordinal split, see ORD_SUFFIX
                s = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}([{D}]+)\\s?{suffix}{Boundaries.NOT_LETTER_AFTER}", "gu").Replace(s, m =>
                {
                    var n = Js.Number(ToAscii(m.Groups[1].Value));
                    if (!IsSafeInteger(n) || n < 1 || n >= cutoff) return m.Value;
                    var w = OrdinalWords(n, suffix, numeralWords);
                    return w == "" ? m.Value : w;
                });
            }

            // ERA MARKERS, after the ordinals and BEFORE de-grouping — a marker can sit against the year's
            // last digit, and the de-grouping patterns match on digit runs. `ق.م` is digit-anchored on
            // purpose: unanchored it mostly matches `قم` inside ordinary words.
            s = QM_ERA.Replace(s, "$1 له ميلاد څخه مخکې");
            // ⚠ THE TRAILING GUARD REJECTS A ZWNJ AS WELL AS A LETTER. U+200C is category `Cf`, so
            // `(?![\p{L}\p{M}])` alone treats it as a word END — and Pashto joins abbreviations with it, so
            // `م‌ز` would pass the guard and the bare-`م` arm would fire on a BC date.
            foreach (var (eraBody, word) in ERA)
                s = JsRegex.Compile($"([{D}])\\s?{eraBody}(?![\\p{{L}}\\p{{M}}‌])", "gu").Replace(s, $"$1 {word}");

            // DE-GROUPING. The dot form is de-grouped ONLY in its unambiguous multi-group shape; a single
            // `D{1,3}.D{3}` is far more often a decimal here. There is deliberately no space arm.
            s = GROUP_AR_COMMA.Replace(s, m => AR_COMMAS.Replace(m.Value, ""));
            s = GROUP_COMMA.Replace(s, m => COMMAS.Replace(m.Value, ""));
            s = GROUP_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));

            // UNITS before decimals (the adjacency dies the moment a decimal becomes words) and after
            // de-grouping (so a grouped operand is already one token).
            foreach (var (sym, word) in UNITS)
            {
                var key = ESCAPE.Replace(sym, "\\$&");
                s = JsRegex.Compile(
                        $"(?<![\\p{{L}}\\p{{M}}{D}.,،])([{D}]+(?:[.,،][{D}]+)?)\\s?{key}(?![\\p{{L}}\\p{{M}}{D}])",
                        "gu")
                    .Replace(s, $"$1 {word}");
            }

            // A bare exponent's digits, AFTER the unit rule above and never before it — `km²` is the unit's.
            s = NormalizeSymbols.SpacedBareExponent(s);

            s = DEG_C.Replace(s, "$1 سانتيګراد");
            s = DEG_SIGN.Replace(s, "$1 سانتيګراد");

            s = CLOCK.Replace(s, m =>
            {
                string h = m.Groups[1].Value, min = m.Groups[2].Value;
                var mm = Js.Number(ToAscii(min));
                if (!IsSafeInteger(mm) || mm > 59) return m.Value;
                return mm == 0 ? $"{h} بجې" : $"{h} بجې او {min} دقیقې";
            });

            // RANGES BEFORE PERCENT — `۹۰-۹۵٪` is a range OF percents, so the pair must be claimed while both
            // operands are still bare digits. Non-ascending pairs are left alone (birth–death, scores).
            // The trailing guard rejects the two commas but NOT the dot: a trailing dot is a sentence end far
            // more often than a fractional part, and the decimal step runs later, so `۹۰-۹۵.۵` still works out.
            s = RANGE.Replace(s, m =>
            {
                string a = m.Groups[1].Value, b = m.Groups[2].Value;
                double x = Js.Number(ToAscii(a)), y = Js.Number(ToAscii(b));
                if (!IsSafeInteger(x) || !IsSafeInteger(y) || x >= y) return m.Value;
                return $"{a} تر {b}";
            });

            static string Pct(System.Text.RegularExpressions.Match m)
            {
                // One helper for the TS's two identical replacers — the arms differ only in their pattern.
                // Re-spaced rather than re-emitted verbatim: the corpus writes `۱۰%سلنه`, and dropping the
                // sign without restoring a boundary would fuse two tokens into one.
                var named = m.Groups[2].Success ? m.Groups[2].Value.Trim() : "سلنه";
                return $"{m.Groups[1].Value} {named}";
            }
            s = PCT_AFTER.Replace(s, Pct);
            s = PCT_BEFORE.Replace(s, Pct);

            static string Money(string n, string mag, int off, string all, int len)
            {
                var named = NAMED_L.IsMatch(all[..off]) || NAMED_R.IsMatch(all[(off + len)..]);
                return named ? $"{n}{mag} " : $"{n}{mag} ډالر ";
            }
            {
                var subject = s;
                s = DOLLAR_BEFORE.Replace(s, m =>
                    Money(m.Groups[1].Value, m.Groups[2].Success ? m.Groups[2].Value : "", m.Index, subject, m.Length));
            }
            {
                var subject = s;
                s = DOLLAR_AFTER.Replace(s, m =>
                    Money(m.Groups[1].Value, m.Groups[2].Success ? m.Groups[2].Value : "", m.Index, subject, m.Length));
            }

            s = MINUS.Replace(s, "$1منفي $2");

            // DECIMALS LAST of the number rules, so every earlier rule sees the number intact. The fractional
            // digits are spoken ONE AT A TIME, which is why they are spaced apart here.
            // The trailing `(?!\.[digit])` guard is what keeps an IP address out: without it `192.168` matches
            // and the rest of the address trails behind. Written as `\.[D]`, not a bare `.`, so a decimal that
            // ends a sentence is still read.
            s = DECIMAL.Replace(s, m =>
                $"{m.Groups[1].Value} اعشاريه {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

            s = FRACTION.Replace(s, m =>
            {
                string a = m.Groups[1].Value, b = m.Groups[2].Value;
                double x = Js.Number(ToAscii(a)), y = Js.Number(ToAscii(b));
                if (!IsSafeInteger(x) || !IsSafeInteger(y)) return m.Value;
                if (!(x < y && y <= 10)) return m.Value;
                var den = OrdinalWords(y, "مه", numeralWords);
                var noun = m.Groups[3].Success ? m.Groups[3].Value.Trim() : "برخه";
                return den == "" ? m.Value : $"{a} {den} {noun}";
            });

            return s;
        };
    }
}
