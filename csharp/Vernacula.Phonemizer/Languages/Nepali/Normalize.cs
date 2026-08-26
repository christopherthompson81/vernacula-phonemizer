/**
 * Nepali (ne) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/nepali/normalize.ts — see that file for the ne_np corpus evidence, including
 * which of Hindi's inherited choices are wrong for Nepali and which are deliberately kept.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nepali;

public static class Normalize
{
    /** Suppletive ordinals 1-4 and 9; 6 is deliberately absent — see normalize.ts. */
    private static readonly IReadOnlyDictionary<double, string> IRREGULAR = new Dictionary<double, string>
    {
        [1] = "पहिलो", [2] = "दोस्रो", [3] = "तेस्रो", [4] = "चौथो", [9] = "नवौं",
    };

    /** Devanagari unit abbreviations → the full Nepali word, matched only after a digit. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["किमी"] = "किलोमिटर", ["मिमी"] = "मिलिमिटर", ["सेमी"] = "सेन्टिमिटर", ["किग्रा"] = "किलोग्राम",
    };
    // ⚠ Longest key first, and the sort must be STABLE so ties keep declaration order, as JS's
    // `Array.prototype.sort` does here — LINQ's OrderByDescending is stable.
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));

    private const string RATE_NUM = "किलोमिटर|मिलिमिटर|सेन्टिमिटर|मिटर|माइल|किमी|मिमी|गज";
    private const string RATE_DEN = "घण्टा|सेकेण्ड|सेकेन्ड|मिनेट";
    private static readonly HashSet<string> RATE_DEN_OK = new(StringComparer.Ordinal) { "घण्टा", "सेकेण्ड", "सेकेन्ड", "मिनेट" };

    private static readonly IReadOnlyDictionary<string, string> CURRENCY = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["$"] = "डलर", ["£"] = "पाउन्ड", ["€"] = "युरो", ["¥"] = "येन",
    };

    private const string NUM = "\\d+(?:[.,]\\d+)*(?![\\d]|[.,]\\d)";
    private const string MAGNITUDE_ALT = "मिलियन|बिलियन|ट्रिलियन|खरब|अर्ब|करोड|लाख|हजार";

    private static readonly JsRe DOLLAR_ESC = JsRegex.Compile("[$]", "gu");
    // Only `$` is a regex metacharacter among the four signs; escaping the others is an *invalid escape*
    // in `u` mode rather than harmless belt-and-braces.
    private static readonly string CUR_ALT = string.Join("|", CURRENCY.Keys.Select(c => JsRegex.Replace(c, DOLLAR_ESC, m => "\\" + m.Value)));
    // ⚠ `[...new Set(Object.values(CURRENCY))]` — de-duplicated but insertion-ordered, as the JS Set is.
    private static readonly string NOUN_ALT = string.Join("|", CURRENCY.Values.Distinct(StringComparer.Ordinal));
    private static readonly string MAG_TAIL = $"(\\s*(?:{MAGNITUDE_ALT})(?![\\p{{L}}\\p{{M}}]))?";
    private static readonly string NOUN_TAIL = $"(\\s*(?:{NOUN_ALT})(?![\\p{{L}}\\p{{M}}]))?";
    private static readonly JsRe CUR_BEFORE = JsRegex.Compile($"({CUR_ALT})\\s?({NUM}){MAG_TAIL}{NOUN_TAIL}", "gu");
    private static readonly JsRe CUR_AFTER = JsRegex.Compile($"({NUM}){MAG_TAIL}\\s?({CUR_ALT}){NOUN_TAIL}", "gu");

    /** The ordinal suffix as a VOWEL SIGN — joined to a consonant-final cardinal the independent vowel
     *  adds a spurious syllable (पन्ध्रऔं [pˈʌnd̪ʱɾʌʌũ] vs पन्ध्रौं [pˈʌnd̪ʱɾʌũ]). */
    private static readonly IReadOnlyDictionary<string, string> SUFFIX_MATRA = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["औं"] = "ौं", ["औँ"] = "ौँ",
    };
    // ⚠ CODE POINT ESCAPES, NOT LITERALS: the nukta letters U+0958–U+095F have canonical decompositions,
    // and a decomposed literal turns the range into "क + ़ - य + ़" — a reversed-range throw at load.
    private static readonly JsRe DEV_CONSONANT_FINAL = JsRegex.Compile("[\\u0915-\\u0939\\u0958-\\u095f]$", "u");

    private static readonly string VISARGA_WORD_ALT = string.Join("|",
        new[] { "प्राय", "पुन", "अन्तत", "मुख्यत", "विशेषत", "सामान्यत", "स्वत" });

    // The step patterns. The TS builds each inline in the returned closure; JsRegex.Compile caches, so
    // hoisting them is a readability choice and not a behaviour one.
    // U+200C ZWNJ / U+200D ZWJ, named by code point so the class body is visible in the source.
    private static readonly JsRe ZW_JOINERS = JsRegex.Compile("[‌‍]", "gu");
    private static readonly JsRe DEV_DIGIT = JsRegex.Compile("[०-९]", "gu");
    private static readonly JsRe COLON_INTERNAL = JsRegex.Compile("(?<=[ऀ-ॣॲ-ॿ]):(?=[ऀ-ॣॲ-ॿ])", "gu");
    private static readonly JsRe VISARGA_WORD = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({VISARGA_WORD_ALT}):(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe ABBR_KM = JsRegex.Compile("(?<![\\p{L}\\p{M}])कि\\.\\s?मी\\.?", "gu");
    private static readonly JsRe ABBR_US = JsRegex.Compile("(?<![\\p{L}\\p{M}])यु\\.\\s?एस\\.?", "gu");
    private static readonly JsRe ABBR_W = JsRegex.Compile("(?<![\\p{L}\\p{M}])(डब्ल्यु|डब्ल्यू)\\.(?=\\s)", "gu");
    private static readonly JsRe DOCTOR = JsRegex.Compile("(?<![\\p{L}\\p{M}])डा\\.(\\s+)(?=[\\p{L}])", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile("(?<![\\d.,:])([1-9]\\d{0,2}(?:,\\d{3})+|\\d+)\\s?(औं|औँ)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe SPORTS_TIME = JsRegex.Compile("(?<![\\d.,:])(\\d{1,2}):(\\d{2}\\.\\d{1,2})(?![\\d:])", "gu");
    private static readonly JsRe TIME_RANGE = JsRegex.Compile("(?<![\\d.,:])((?:[01]?\\d|2[0-3]):[0-5]\\d)\\s?[-–—]\\s?((?:[01]?\\d|2[0-3]):[0-5]\\d)(?![\\d:.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d:.])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.])(\\s*बजे(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe BAJ_NEXT = JsRegex.Compile("^\\s*बज", "u");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_LEFT = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS_AFTER_NONSPACE = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_AT_BOUNDARY = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![A-Za-z])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![A-Za-z])", "gui");
    private static readonly JsRe DEG_N = JsRegex.Compile("(\\d)\\s?°\\s?N(?![A-Za-z])", "gu");
    private static readonly JsRe DEG_S = JsRegex.Compile("(\\d)\\s?°\\s?S(?![A-Za-z])", "gu");
    private static readonly JsRe DEG_E = JsRegex.Compile("(\\d)\\s?°\\s?E(?![A-Za-z])", "gu");
    private static readonly JsRe DEG_W = JsRegex.Compile("(\\d)\\s?°\\s?W(?![A-Za-z])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe UNIT_SQUARED = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?:\\s?²|2)(?![\\p{{L}}\\p{{M}}\\d])", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe RATE = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({RATE_NUM})\\s*/\\s*({RATE_DEN})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\d.,:])(\\d+(?:\\.\\d+)?)\\s?[-–—]\\s?(\\d+(?:\\.\\d+)?)(?![\\d.,:])(?!\\s*देखि(?![\\p{L}\\p{M}]))", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe TILDE = JsRegex.Compile("~\\s?(?=\\d)", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile(" {2,}", "gu");

    /** Build the Nepali normalizer. Takes the numbers definition so the ordinal, clock, range and fraction
     *  rules compose their cardinals from exactly the data the engine's own number path uses. */
    public static Func<string, string> MakeNepaliNormalizer(NumbersDef numbers)
    {
        List<string> Cardinal(double n) => Core.Numbers.indicNumberWords(n, numbers).Select(w => w ?? "").ToList();
        string CardinalText(double n) => string.Join(" ", Cardinal(n));

        string? Ordinal(double n, string suffix)
        {
            if (IRREGULAR.TryGetValue(n, out var irr)) return irr;
            if (n == 6) return null; // छैटौं is un-attested in this repo's ne data — do not invent it
            var words = Cardinal(n);
            if (words.Count == 0 || words.Any(w => w == "")) return null;
            var last = words[^1];
            var join = DEV_CONSONANT_FINAL.IsMatch(last)
                ? SUFFIX_MATRA.TryGetValue(suffix, out var mt) ? mt : suffix
                : suffix;
            words[^1] = $"{last}{join}";
            return string.Join(" ", words);
        }

        string Clock(double h, double min) =>
            min == 0 ? CardinalText(h) : $"{CardinalText(h)} बजेर {CardinalText(min)} मिनेट";

        return input =>
        {
            var s = input;

            s = ZW_JOINERS.Replace(s, "");
            s = DEV_DIGIT.Replace(s, m => Js.NumberToString(Js.CodePointAt0(m.Value) - 0x0966));

            s = COLON_INTERNAL.Replace(s, "ः");
            s = VISARGA_WORD.Replace(s, "$1ः");

            s = ABBR_KM.Replace(s, "किलोमिटर");
            s = ABBR_US.Replace(s, "यु एस");
            s = ABBR_W.Replace(s, "$1");

            s = DOCTOR.Replace(s, m => $"डाक्टर{m.Groups[1].Value}");

            s = ORDINAL.Replace(s, m =>
            {
                var n = Js.Number(COMMA_G.Replace(m.Groups[1].Value, ""));
                return double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
                    ? Ordinal(n, m.Groups[2].Value) ?? m.Value
                    : m.Value;
            });

            s = SPORTS_TIME.Replace(s, "$1 $2");
            s = TIME_RANGE.Replace(s, "$1 देखि $2");
            // `whole7c` stands in for the JS replacer's fifth argument (the subject string); it must be
            // snapshotted, since `s` is reassigned by every step.
            var whole7c = s;
            s = CLOCK_COLON.Replace(s, m =>
            {
                var body = Clock(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value));
                if (Js.Number(m.Groups[2].Value) != 0) return body;
                var baje = m.Groups[3].Success ? m.Groups[3].Value : "";
                var rest = whole7c[(m.Index + m.Length)..];
                return baje != "" || !BAJ_NEXT.IsMatch(rest) ? $"{body} बजे" : body;
            });

            s = PLUSMINUS.Replace(s, " प्लस माइनस ");
            // The third guard: a digit ANYWHERE to the left rejects a SPACED range or score, which the
            // adjacency lookbehind alone misses.
            var wholeMinus = s;
            s = MINUS.Replace(s, m => DIGIT_LEFT.IsMatch(wholeMinus[..m.Index]) ? m.Value : "माइनस ");
            s = PLUS_AFTER_NONSPACE.Replace(s, "$1 प्लस ");
            s = PLUS_AT_BOUNDARY.Replace(s, "$1प्लस ");

            s = PostposedSignPass.PostposedSign(s, "<", "भन्दा कम");
            s = PostposedSignPass.PostposedSign(s, ">", "भन्दा बढी");
            s = EQUALS.Replace(s, " बराबर ");
            s = DIVIDE.Replace(s, " विभाजन ");

            s = DEG_C.Replace(s, "$1 डिग्री सेल्सियस ");
            s = DEG_F.Replace(s, "$1 डिग्री फरेनहाइट ");
            s = DEG_N.Replace(s, "$1 डिग्री उत्तर ");
            s = DEG_S.Replace(s, "$1 डिग्री दक्षिण ");
            s = DEG_E.Replace(s, "$1 डिग्री पूर्व ");
            s = DEG_W.Replace(s, "$1 डिग्री पश्चिम ");
            s = DEG_BARE.Replace(s, "$1 डिग्री ");

            string Money(string n, string mag, string sign, string? noun) =>
                $"{n}{mag}{noun ?? $" {CURRENCY[sign]}"}";
            s = CUR_BEFORE.Replace(s, m => Money(m.Groups[2].Value,
                m.Groups[3].Success ? m.Groups[3].Value : "", m.Groups[1].Value,
                m.Groups[4].Success ? m.Groups[4].Value : null));
            s = CUR_AFTER.Replace(s, m => Money(m.Groups[1].Value,
                m.Groups[2].Success ? m.Groups[2].Value : "", m.Groups[3].Value,
                m.Groups[4].Success ? m.Groups[4].Value : null));

            // THE SQUARED FORM FIRST, or the plain rule consumes the abbreviation and strands the `²`.
            s = UNIT_SQUARED.Replace(s, m => $"{m.Groups[1].Value} वर्ग {UNIT_WORD[m.Groups[2].Value]}");
            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");
            s = RATE.Replace(s, m =>
            {
                var num = m.Groups[1].Value;
                var den = m.Groups[2].Value;
                return RATE_DEN_OK.Contains(den)
                    ? $"{(UNIT_WORD.TryGetValue(num, out var w) ? w : num)} प्रति {den}"
                    : m.Value;
            });

            // Ranges fire only when ASCENDING: every descending or equal pair in this corpus is a sports
            // result, where "देखि" would be wrong.
            s = RANGE.Replace(s, m =>
            {
                var a = m.Groups[1].Value;
                var b = m.Groups[2].Value;
                return Js.Number(b) > Js.Number(a) ? $"{a} देखि {b}" : m.Value;
            });

            s = FRACTION.Replace(s, m =>
            {
                var nw = CardinalText(Js.Number(m.Groups[1].Value));
                var dw = CardinalText(Js.Number(m.Groups[2].Value));
                return nw == "" || dw == "" ? m.Value : $"{nw} बटा {dw}";
            });

            s = TILDE.Replace(s, "लगभग ");
            s = DOUBLE_SPACE.Replace(s, " ");

            return s;
        };
    }
}
