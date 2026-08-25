using System.Globalization;
/**
 * Hindi (hi) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/hindi/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hindi;

public static class Normalize
{
    /** Ordinal suffix → the gender/number it marks. */
    /**
     * ⚠ HINDI'S TABLES SERVE THE WHOLE FAMILY, which is inherited behaviour and now at least VISIBLE — see
     * the TS module for the argument. Kept as the DEFAULT; a family member that sources its own declares
     * them in its own jsonc.
     */
    private static HindiOrdinalSuffixes? DEFAULT_SUFFIXES => Hindi.DEF.OrdinalSuffixes;

    /** Longest-first alternation, regex metacharacters escaped. */
    private static string Alt(IEnumerable<string> keys) =>
        string.Join("|", keys.OrderByDescending(k => k.Length).Select(System.Text.RegularExpressions.Regex.Escape));

    /**
     * Irregular ordinals, from the manifest. ⚠ THE JSON KEYS ARE STRINGS and this code indexes by INT,
     * which is where a JS/.NET divergence is paid: the TS side writes `IRREGULAR[n]` and JS coerces the
     * numeric index; C# does not, so the conversion is explicit at the call site.
     */
    private static IReadOnlyDictionary<string, string[]> IRREGULAR => Hindi.DEF.IrregularOrdinals;

    /** Devanagari unit abbreviations → the full word. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["किमी"] = "किलोमीटर", ["किमी/घंटा"] = "किलोमीटर प्रति घंटा", ["किग्रा"] = "किलोग्राम",
        ["सेमी"] = "सेंटीमीटर", ["मिमी"] = "मिलीमीटर", ["ग्रा"] = "ग्राम", ["मि"] = "मिनट",
        ["मी/से"] = "मीटर प्रति सेकंड",
    };
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));

    /** Abbreviations. */
    private static readonly IReadOnlyDictionary<string, string> ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["डॉ"] = "डॉक्टर", ["प्रो"] = "प्रोफ़ेसर", ["कु"] = "कुमारी", ["श्रीमती"] = "श्रीमती",
        ["सं"] = "संख्या", ["पृ"] = "पृष्ठ", ["अध्या"] = "अध्याय",
    };
    private static readonly string ABBREV_ALT = string.Join("|", ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe ERA_ISP = JsRegex.Compile("(?<![\\p{L}\\p{M}])ई\\.?\\s?स\\.?\\s?पू\\.?", "gu");
    private static readonly JsRe ERA_IP = JsRegex.Compile("(?<![\\p{L}\\p{M}])ई\\.?\\s?पू\\.?", "gu");
    private static readonly JsRe ABBREV_RE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.?(\\s+)(?=[\\p{{L}}])", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe COORD = JsRegex.Compile("(\\d)\\s?[°º]\\s?(\\d+)\\s?[´′'](?:\\s?(\\d+)\\s?[″\"])?", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("(\\d)\\s?℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("(\\d)\\s?℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?[°º]\\s?C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?[°º]\\s?F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?[°º]", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(\\s*बजे)?", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe MINUS_BRACKET = JsRegex.Compile("(^|[(\\[（])\\s?[-−–](\\d)", "gu");
    private static readonly JsRe MINUS_DEGREE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\p{Nd}-])[-−–](\\d+(?:[.,]\\d+)?)(?=\\s?(?:°|℃|℉|डिग्री))", "gu");
    private static readonly JsRe MINUS_DECIMAL = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\p{Nd}-])(?<!\\p{Nd}[\\p{L}\\p{M}]{0,2}[.,]?[ \\t]?)[-−–](\\d+[.,]\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("\\s?×\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe AMP_LATIN = JsRegex.Compile("(?<=[A-Za-z])\\s?&\\s?(?=[A-Za-z])", "gu");
    private static readonly JsRe AMP = JsRegex.Compile("\\s?&\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");

    /** Build the Hindi normalizer. Takes the numbers definition so the ordinal rule can compose the cardinal
     *  words it attaches its suffix to — the same data the engine's own number path uses. */
    public static Func<string, string> MakeHindiNormalizer(NumbersDef numbers, HindiDef? own = null)
    {
        var irregular = own?.IrregularOrdinals is { Count: > 0 } o ? o : Hindi.DEF.IrregularOrdinals;
        var ordSuf = own?.OrdinalSuffixes ?? DEFAULT_SUFFIXES;
        var suffixForm = ordSuf?.Regular ?? new Dictionary<string, int>();
        var suppletive = ordSuf?.SuppletiveConsonants ?? new Dictionary<string, string>();
        var vowelForm = ordSuf?.VowelForms ?? new Dictionary<string, int>();
        var ordinalRe = suffixForm.Count == 0 ? null : JsRegex.Compile(
            $"(?<![\\d.,])(\\d+)\\s?({Alt(suffixForm.Keys)})(?![\\p{{L}}\\p{{M}}])", "gu");
        var suppletiveRe = suppletive.Count == 0 ? null : JsRegex.Compile(
            $"(?<![\\d.,])(\\d)({Alt(suppletive.Values.Distinct())})({Alt(vowelForm.Keys)})(?![\\p{{L}}\\p{{M}}])", "gu");
        /** Integer → its Devanagari cardinal words, as the engine's number path would render them. */
        List<string> Cardinal(double n) => Core.Numbers.indicNumberWords(n, numbers).Select(w => w ?? "").ToList();

        /** The ordinal, agreeing with whatever the written suffix marked. */
        string? Ordinal(double n, int form, string suffix)
        {
            if (double.IsInteger(n) && n >= int.MinValue && n <= int.MaxValue && irregular.TryGetValue(((int)n).ToString(CultureInfo.InvariantCulture), out var irr))
                return irr[form];
            var words = Cardinal(n);
            if (words.Count == 0 || words.Any(w => w == "")) return null;
            words[^1] = $"{words[^1]}{suffix}";
            return string.Join(" ", words);
        }

        return input =>
        {
            var s = input;

            // 1) ERA MARKERS, before the abbreviation rule in step 3 so the bare ई. is not claimed first.
            // ⚠ `\b` NEVER MATCHES BEFORE A DEVANAGARI LETTER — every boundary in this file is an explicit
            //    lookaround, and swapping one back to `\b` silently disables the guard.
            s = ERA_ISP.Replace(s, "ईसा पूर्व");
            s = ERA_IP.Replace(s, "ईसा पूर्व");

            // 2) ORDINAL SUFFIXES. THE TRAILING BOUNDARY IS LOAD-BEARING: without it the suffix matches the
            //    START of an ordinary word and `10 वापस` glues into one token.
            if (ordinalRe is not null)
                s = ordinalRe.Replace(s, m =>
                    Ordinal(Js.Number(m.Groups[1].Value), suffixForm[m.Groups[2].Value], m.Groups[2].Value) ?? m.Value);

            // 2b) THE SUPPLETIVE SPELLINGS — `1ला`, `2रा`, `4था`, `6ठा`. See the TS module: GLUED only
            //     (`था`/`थी` are the past copula), the consonant must be that NUMBER's own, and the
            //     trailing boundary keeps `2राज्य` out.
            if (suppletiveRe is not null)
                s = suppletiveRe.Replace(s, m =>
                {
                    var d = m.Groups[1].Value;
                    if (!suppletive.TryGetValue(d, out var c) || c != m.Groups[2].Value) return m.Value;
                    return irregular.TryGetValue(d, out var forms) && vowelForm.TryGetValue(m.Groups[3].Value, out var f)
                        && f < forms.Length ? forms[f] : m.Value;
                });

            s = ABBREV_RE.Replace(s, m => $"{ABBREV[m.Groups[1].Value]}{m.Groups[2].Value}");

            // 4) DEVANAGARI UNIT ABBREVIATIONS, after a number. Longest first, so किमी/घंटा beats किमी.
            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            // 5) DEGREES. 5a) COORDINATES FIRST, because the degree rules below would eat the ° and strand
            //    the minutes mark. The minutes mark is claimed ONLY after a degree — a bare `'` is an apostrophe.
            s = COORD.Replace(s, m =>
                $"{m.Groups[1].Value} डिग्री {m.Groups[2].Value} मिनट{(m.Groups[3].Success && m.Groups[3].Value.Length > 0 ? $" {m.Groups[3].Value} सेकंड" : "")}");
            s = DEG_C_SIGN.Replace(s, "$1 डिग्री सेल्सियस");
            s = DEG_F_SIGN.Replace(s, "$1 डिग्री फ़ारेनहाइट");
            s = DEG_C.Replace(s, "$1 डिग्री सेल्सियस");
            s = DEG_F.Replace(s, "$1 डिग्री फ़ारेनहाइट");
            s = DEG.Replace(s, "$1 डिग्री");

            s = CLOCK.Replace(s, m =>
            {
                var hw = string.Join(" ", Cardinal(Js.Number(m.Groups[1].Value)));
                if (Js.Number(m.Groups[2].Value) == 0)
                    return $"{hw}{(m.Groups[3].Success && m.Groups[3].Value.Length > 0 ? m.Groups[3].Value : " बजे")}";
                return $"{hw} बजकर {string.Join(" ", Cardinal(Js.Number(m.Groups[2].Value)))} मिनट";
            });

            s = PLUS_ATTACHED.Replace(s, "$1 प्लस $2");
            s = PLUS_LEADING.Replace(s, "$1प्लस $2");

            s = MINUS_BRACKET.Replace(s, "$1ऋण $2");
            s = MINUS_DEGREE.Replace(s, "ऋण $1");
            s = MINUS_DECIMAL.Replace(s, "ऋण $1");

            s = PostposedSignPass.PostposedSign(s, "<", "से कम");
            s = PostposedSignPass.PostposedSign(s, ">", "से अधिक");
            s = EQUALS.Replace(s, " बराबर ");
            // `/` is NOT routed here — step 8 already reads it as the fraction बटा.
            s = TIMES.Replace(s, " गुणा ");
            s = DIVIDE.Replace(s, " भाग ");
            // ⚠ Spaced on BOTH sides, or the reading fuses onto the preceding word (`तापमान±5`).
            s = PLUS_MINUS.Replace(s, " धन ऋण ");
            // The ampersand splits by context: between LATIN letters it stays inside the run delegated to
            // English (`AT&T`); elsewhere it is और. The Latin arm must therefore run first.
            s = AMP_LATIN.Replace(s, " and ");
            s = AMP.Replace(s, " और ");

            s = FRACTION.Replace(s, m =>
            {
                double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
                if (num == 1 && den == 2) return "आधा";
                if (num == 1 && den == 4) return "चौथाई";
                if (den == 3) return $"{string.Join(" ", Cardinal(num))} तिहाई";
                string nw = string.Join(" ", Cardinal(num)), dw = string.Join(" ", Cardinal(den));
                return nw == "" || dw == "" ? m.Value : $"{nw} बटा {dw}";
            });

            return s;
        };
    }
}
