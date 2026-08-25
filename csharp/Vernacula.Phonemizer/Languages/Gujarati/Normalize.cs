using System.Globalization;
/**
 * Gujarati (gu) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/gujarati/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Gujarati;

public static class Normalize
{
    /**
     * Irregular ordinals, from the manifest. ⚠ THE JSON KEYS ARE STRINGS and this code indexes by INT,
     * which is where a JS/.NET divergence is paid: the TS side writes `IRREGULAR[n]` and JS coerces the
     * numeric index; C# does not, so the conversion is explicit at the call site.
     */
    private static IReadOnlyDictionary<string, string[]> IRREGULAR => GujaratiPhonemizer.DEF.IrregularOrdinals;

    /** The written vowel of an ordinal suffix → the agreement slot it marks. Read off the text, never
     *  guessed: the suffix itself carries the gender/number in Gujarati (પંદરમી / પંદરમો / પંદરમા). */
    private static readonly IReadOnlyDictionary<string, int> FORM = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["ો"] = 0, ["ી"] = 1, ["ું"] = 2, ["ા"] = 3, ["ે"] = 3,
    };
    /** The suppletive consonant each of 1-4/6 takes. 4's is થ, which is ALSO the ablative postposition થી —
     *  so `4થી` is ambiguous, and ⚠ the pairing is excluded at the call site rather than resolved here. */
    private static readonly IReadOnlyDictionary<int, string> IRREGULAR_CONSONANT = new Dictionary<int, string>
    {
        [1] = "લ", [2] = "જ", [3] = "જ", [4] = "થ", [6] = "ઠ્ઠ",
    };

    /**
     * POSTPOSITIONS written ATTACHED to a numeral. ⚠ No SPACED form belongs in this list: a postposition
     * written with a space genuinely IS a separate word. Longest first (માંથી must beat માં).
     */
    private static readonly string POSTPOSITION = string.Join("|",
        new[] { "માંથી", "માં", "નાં", "ના", "ની", "નું", "નો", "થી" }.OrderByDescending(a => a.Length));

    /**
     * Gujarati DOTTED abbreviations that are not initialisms and must be claimed before the generic dotted-
     * initialism rule in step 5 would spell them out letter by letter.
     */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["કિ.મી."] = "કિલોમીટર", ["કી.મી."] = "કિલોમીટર",
        ["દા.ત."] = "દાખલા તરીકે",
        ["ફે."] = "ફેરનહીટ",
    };
    private static readonly JsRe DOT_ESC = JsRegex.Compile("\\.", "gu");
    private static readonly string DOTTED_ALT = string.Join("|", DOTTED.Keys
        .OrderByDescending(a => a.Length)
        .Select(k => JsRegex.Replace(k, DOT_ESC, _ => "\\.")));

    /**
     * The -તઃ / -નઃ adverbs and prefixes, written with an ASCII colon for the visarga (પુન:, સંભવત:, ક્રમશ:).
     * ⚠ A CLOSED LIST, not the pattern `ત:` — an ordinary list colon must stay the phrase break it is.
     */
    private static readonly string VISARGA_WORD = string.Join("|",
        new[] { "પુન", "સંભવત", "ક્રમશ", "અંત", "વિશેષત", "મુખ્યત", "સામાન્યત", "અંશત" });

    // The step patterns. The TS builds several of these inline; JsRegex.Compile caches, so hoisting them
    // here is a readability choice and not a behaviour one.
    private static readonly JsRe GU_DIGIT = JsRegex.Compile("[૦-૯]", "gu");
    private static readonly JsRe VISARGA_RE = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({VISARGA_WORD}):", "gu");
    private static readonly JsRe ERA_RE = JsRegex.Compile("(?<![\\p{L}\\p{M}])[ઇઈ]\\.\\s?સ\\.", "gu");
    private static readonly JsRe DOTTED_RE = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})", "gu");
    private static readonly JsRe INITIALISM_RE = JsRegex.Compile("(?:[઀-૿]{1,2}\\.){2,}", "gu");
    private static readonly JsRe DOCTOR = JsRegex.Compile("(?<![\\p{L}\\p{M}])ડ[ોૉ]\\.(\\s+)(?=[\\p{L}])", "gu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?![\\d.,])(?=\\s?[-–]\\s?\\d{1,2}[:.]\\d{2}|\\s*(?:વાગ|કલાક))", "gu");
    private static readonly JsRe SPORTS_TIME = JsRegex.Compile("(?<![\\d.,:])(\\d{1,2}):(\\d{2}\\.\\d{1,2})(?![\\d:])", "gu");
    private static readonly JsRe HMS = JsRegex.Compile("(?<![\\d.,:])(\\d{1,2}):\\s?([0-5]\\d):\\s?([0-5]\\d)(?![\\d.,:])", "gu");
    private static readonly JsRe CLOCK_RE = JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3]):\\s?([0-5]\\d)(?![\\d.:])", "gu");
    private static readonly JsRe CLOCK_WORD_AFTER = JsRegex.Compile("વાગ|કલાક|GMT|UTC|જીએમટી|યુટીસી|યુ\\.?\\s?ટી", "u");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe TILDE = JsRegex.Compile("~\\s?(?=\\d)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+(?:\\.\\d+)?)\\s?[-–—]\\s?(\\d+(?:\\.\\d+)?)(?![\\d.,])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})\\/(\\d{1,3})(?![\\d\\/])", "gu");
    private static readonly JsRe ORD_SUPPLETIVE = JsRegex.Compile("(?<![\\d.,])(\\d)(લ|જ|થ|ઠ્ઠ)(ો|ી|ું|ા|ે)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ORD_REGULAR_SUPPL = JsRegex.Compile("(?<![\\d.,])([12346])\\s?મ(ો|ી|ું|ા|ે)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe JOIN_RE = JsRegex.Compile(
        $"(?<![\\d.,$€£¥₹])(\\d+(?:,\\d+)*)(?:\\s?(મ[ોીાે]|મું)|({POSTPOSITION}))(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile(" {2,}", "gu");

    /** Build the Gujarati normalizer. Takes the numbers definition so the ordinal and join rules compose
     *  their cardinals from the same data the engine's own number path uses. */
    public static Func<string, string> MakeGujaratiNormalizer(NumbersDef numbers)
    {
        /** Integer → its Gujarati cardinal words, exactly as the engine's number path would render them. */
        List<string> Cardinal(double n) => Numbers.indicNumberWords(n, numbers).Select(w => w ?? "").ToList();
        string CardinalText(double n) => string.Join(" ", Cardinal(n));

        /** Spell `digits` (possibly comma-grouped) and GLUE `suffix` to the final word — the whole point of
         *  the join: સાડત્રીસ + માં is one word in the orthography and must be one token here. */
        string? Glue(string digits, string suffix)
        {
            var n = Js.Number(JsRegex.Replace(digits, COMMA_G, _ => ""));
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return null;
            var words = Cardinal(n);
            if (words.Count == 0 || words.Any(w => w == "")) return null;
            words[^1] = $"{words[^1]}{suffix}";
            return string.Join(" ", words);
        }

        return input =>
        {
            var s = input;

            s = JsRegex.Replace(s, GU_DIGIT, m => Js.NumberToString(Js.CodePointAt0(m.Value) - 0x0ae6));

            s = JsRegex.Replace(s, VISARGA_RE, m => $"{m.Groups[1].Value}ઃ");

            s = JsRegex.Replace(s, ERA_RE, _ => "ઈસવીસન");

            s = JsRegex.Replace(s, DOTTED_RE, m => DOTTED[m.Groups[1].Value]);

            s = JsRegex.Replace(s, INITIALISM_RE, m => $"{string.Join(" ", m.Value[..^1].Split('.'))} ");

            s = JsRegex.Replace(s, DOCTOR, m => $"ડૉક્ટર{m.Groups[1].Value}");

            s = JsRegex.Replace(s, CLOCK_DOT, m => $"{m.Groups[1].Value}:{m.Groups[2].Value}");
            //    7b) SPORTS times mm:ss.hh are NOT clocks; dropping the colon leaves two plain numbers,
            //        which is the honest reading and which nothing downstream can re-claim.
            s = JsRegex.Replace(s, SPORTS_TIME, m => $"{m.Groups[1].Value} {m.Groups[2].Value}");
            s = JsRegex.Replace(s, HMS, m => $"{m.Groups[1].Value} {m.Groups[2].Value} {m.Groups[3].Value}");
            var whole7 = s;
            s = JsRegex.Replace(s, CLOCK_RE, m =>
            {
                var h = m.Groups[1].Value;
                var min = m.Groups[2].Value;
                if (Js.Number(min) != 0) return $"{h} {min}";
                var start = m.Index + m.Length;
                var rest = whole7[start..Math.Min(whole7.Length, start + 40)];
                return CLOCK_WORD_AFTER.IsMatch(rest) ? h : $"{h} વાગ્યે";
            });

            s = JsRegex.Replace(s, PLUS_AFTER, m => $"{m.Groups[1].Value} પ્લસ ");
            s = JsRegex.Replace(s, PLUS_START, m => $"{m.Groups[1].Value}પ્લસ ");

            s = JsRegex.Replace(s, PLUSMINUS, _ => " પ્લસ માઈનસ ");
            s = PostposedSignPass.PostposedSign(s, "<", "કરતાં ઓછું");
            s = PostposedSignPass.PostposedSign(s, ">", "કરતાં વધુ");
            s = PostposedSignPass.PostposedSign(s, "÷", "દ્વારા વિભાજીત");
            s = JsRegex.Replace(s, EQUALS, _ => " બરાબર ");

            s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} ડિગ્રી સેલ્સિયસ");
            s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} ડિગ્રી ફેરનહીટ");
            s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} ડિગ્રી");

            s = JsRegex.Replace(s, TILDE, _ => "આશરે ");

            // RANGES N-M → "N થી M". ⚠ THE ASCENDING GUARD IS THE RULE: a descending or equal pair is a
            // sports result, where "from…to" would be flatly wrong.
            s = JsRegex.Replace(s, RANGE, m =>
                Js.Number(m.Groups[2].Value) > Js.Number(m.Groups[1].Value)
                    ? $"{m.Groups[1].Value} થી {m.Groups[2].Value}"
                    : m.Value);

            s = JsRegex.Replace(s, FRACTION, m =>
            {
                double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
                if (num >= den) return m.Value;
                if (num == 1 && den == 2) return "અડધો";
                var nw = CardinalText(num);
                var dw = CardinalText(den);
                return nw == "" || dw == "" ? m.Value : $"{nw} ભાગ્યા {dw}";
            });

            s = JsRegex.Replace(s, ORD_SUPPLETIVE, m =>
            {
                var n = (int)Js.Number(m.Groups[1].Value);
                var cons = m.Groups[2].Value;
                var vowel = m.Groups[3].Value;
                if (IRREGULAR_CONSONANT.GetValueOrDefault(n) != cons) return m.Value;
                if (n == 4 && cons == "થ" && vowel == "ી") return m.Value;
                return IRREGULAR[n.ToString(CultureInfo.InvariantCulture)][FORM[vowel]];
            });
            s = JsRegex.Replace(s, ORD_REGULAR_SUPPL, m =>
                IRREGULAR[((int)Js.Number(m.Groups[1].Value)).ToString(CultureInfo.InvariantCulture)][FORM[m.Groups[2].Value]]);
            s = JsRegex.Replace(s, JOIN_RE, m =>
            {
                var digits = m.Groups[1].Value;
                var ord = m.Groups[2].Success ? m.Groups[2].Value : null;
                var post = m.Groups[3].Success ? m.Groups[3].Value : null;
                return Glue(digits, ord ?? post!) ?? m.Value;
            });

            return JsRegex.Replace(s, DOUBLE_SPACE, _ => " ");
        };
    }
}
