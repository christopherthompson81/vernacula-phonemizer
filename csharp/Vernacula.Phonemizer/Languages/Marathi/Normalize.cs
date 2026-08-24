/**
 * Marathi (mr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/marathi/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Marathi;

public static class Normalize
{
    /**
     * Ordinal suffixes → the agreement slot they mark. Marathi attaches these to the cardinal and the suffix
     * itself carries the agreement, so it is read off the text, not guessed. Matched LONGEST FIRST.
     */
    private static readonly IReadOnlyDictionary<string, int> SUFFIX_FORM = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["व्या"] = 3, ["वा"] = 0, ["वी"] = 1, ["वे"] = 2,
    };
    private static readonly string SUFFIX_ALT = string.Join("|", SUFFIX_FORM.Keys.OrderByDescending(k => k.Length));

    /** Suppletive ordinals 1-4, indexed [masc, fem, plural/neuter, oblique]. */
    private static readonly IReadOnlyDictionary<int, string[]> IRREGULAR = new Dictionary<int, string[]>
    {
        [1] = new[] { "पहिला", "पहिली", "पहिले", "पहिल्या" },
        [2] = new[] { "दुसरा", "दुसरी", "दुसरे", "दुसऱ्या" },
        [3] = new[] { "तिसरा", "तिसरी", "तिसरे", "तिसऱ्या" },
        [4] = new[] { "चौथा", "चौथी", "चौथे", "चौथ्या" },
    };

    /**
     * Devanagari consonant letters (base + nukta block) — used to test whether a cardinal ends in a bare
     * consonant, which is what conditions the ordinal's linking -आ- (साठ → साठावा).
     */
    // ⚠ THE TWO NUKTA LETTERS IN THIS CLASS MUST BE PRECOMPOSED — U+0958 and U+095F, one code point each.
    // Both are Unicode COMPOSITION EXCLUSIONS, so NFC will NOT rebuild them; decomposed, the class gains two
    // characters and its second range runs U+093C → U+092F, which .NET rejects as reversed — a type-init
    // throw that fails every golden row at once. (Named by code point rather than shown, so this warning
    // does not itself plant the hazard.)
    private static readonly JsRe DEV_CONSONANT_FINAL = JsRegex.Compile("[क-हक़-य़]$", "u");

    /** Devanagari unit abbreviations → the full Marathi word. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["किमी/ताशी"] = "किलोमीटर ताशी", // ताशी already means "per hour"; प्रति would double it
        ["किमी/तास"] = "किलोमीटर प्रति तास",
        ["मी/से"] = "मीटर प्रति सेकंद",
        ["किमी²"] = "चौरस किलोमीटर", ["किमी2"] = "चौरस किलोमीटर",
        ["सेमी²"] = "चौरस सेंटीमीटर", ["सेमी2"] = "चौरस सेंटीमीटर",
        ["मिमी²"] = "चौरस मिलीमीटर", ["मिमी2"] = "चौरस मिलीमीटर",
        ["मी²"] = "चौरस मीटर", ["मी2"] = "चौरस मीटर",
        ["किमी"] = "किलोमीटर", ["सेमी"] = "सेंटीमीटर", ["मिमी"] = "मिलीमीटर",
        ["किग्रॅ"] = "किलोग्रॅम", ["ग्रॅ"] = "ग्रॅम",
        ["मी"] = "मीटर",
        ["km²"] = "चौरस किलोमीटर", ["km2"] = "चौरस किलोमीटर",
        ["m²"] = "चौरस मीटर", ["cm²"] = "चौरस सेंटीमीटर",
        ["mm²"] = "चौरस मिलीमीटर", ["mm2"] = "चौरस मिलीमीटर",
        ["km"] = "किलोमीटर", ["cm"] = "सेंटीमीटर", ["mm"] = "मिलीमीटर", ["kg"] = "किलोग्रॅम",
        ["ha"] = "हेक्टर", ["l"] = "लिटर", ["L"] = "लिटर",
    };
    // Longest key first, and each key is guarded by `(?![\p{L}\p{M}])` at the use site — that is what keeps
    // मी (metre) out of मीटर, मिनिटे and the pronoun मी.
    private static readonly JsRe UNIT_ESC = JsRegex.Compile("[.*+?^${}()|[\\]\\\\/]", "g");
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys
        .OrderByDescending(k => k.Length)
        .Select(k => JsRegex.Replace(k, UNIT_ESC, m => "\\" + m.Value)));

    /** Currency sign → the Marathi noun (युरो / पौंड where Hindi's tier says यूरो / पाउंड). */
    private static readonly IReadOnlyDictionary<string, string> CURRENCY = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["$"] = "डॉलर", ["€"] = "युरो", ["¥"] = "येन", ["£"] = "पौंड", ["₹"] = "रुपये",
    };

    /** Magnitude words that hop over the currency sign — "$२.३ बिलियन" is said "…बिलियन डॉलर". */
    private const string MAGNITUDE_ALT = "बिलियन|ट्रिलियन|मिलियन|दशलक्ष|अब्ज|कोटी|लाख|हजार";

    /** The -तः adverbs, commonly written with an ASCII colon standing in for the visarga. */
    private static readonly string TAH_ADVERB_ALT = string.Join("|", new[]
    {
        "विशेषत", "सामान्यत", "साधारणत", "संभाव्यत", "मुख्यत", "अंशत", "स्वत", "दुख",
    });

    // The step patterns. The TS builds each inline in the returned closure; JsRegex.Compile caches, so
    // hoisting them here is a readability choice and not a behaviour one.
    private static readonly JsRe AE_DIGRAPH = JsRegex.Compile("अ[‌‍]?ॅ", "gu");
    private static readonly JsRe AO_DIGRAPH = JsRegex.Compile("अ[‌‍]?ॉ", "gu");
    private static readonly JsRe ZW_JOINERS = JsRegex.Compile("[‌‍]", "gu");
    private static readonly JsRe DEV_DIGIT = JsRegex.Compile("[०-९]", "gu");
    private static readonly JsRe VISARGA_CLOCK = JsRegex.Compile("(\\d)ः(\\d)", "gu");
    private static readonly JsRe COLON_INTERNAL = JsRegex.Compile("(?<=[ऀ-ॣॲ-ॿ]):(?=[ऀ-ॣॲ-ॿ])", "gu");
    private static readonly JsRe TAH_COLON = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({TAH_ADVERB_ALT}):(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe ERA_BCE_FULL = JsRegex.Compile("(?<![\\p{L}\\p{M}])[इई]\\.?\\s?स\\.?\\s?प[ूु]\\.?", "gu");
    private static readonly JsRe ERA_BCE_SHORT = JsRegex.Compile("(?<![\\p{L}\\p{M}])[इई]\\.?\\s?प[ूु]\\.?", "gu");
    private static readonly JsRe ERA_CE = JsRegex.Compile("(?<![\\p{L}\\p{M}])[इई]\\.?\\s?स\\.", "gu");
    private static readonly JsRe DOCTOR = JsRegex.Compile("(?<![\\p{L}\\p{M}])डॉ\\.?(\\s+)(?=[\\p{L}])", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s?({SUFFIX_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe NUM_BEFORE_VA = JsRegex.Compile("(?<![\\d.,:])(\\d+)(\\s*)(?=व[ाीे])", "gu");
    private static readonly JsRe SPORTS_TIME = JsRegex.Compile("(?<![\\d.,:])(\\d{1,2}):(\\d{2}\\.\\d{1,2})(?![\\d:])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d:.])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.])(\\s*वाजता(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe VAAJ_NEXT = JsRegex.Compile("^\\s*वाज", "u");
    private static readonly JsRe CLOCK_DOT_TZ = JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?![\\d.,:])(?=\\s*(?:GMT|UTC|यूटीसी|जीएमटी))", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?(?:C|से\\.?)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_N = JsRegex.Compile("(\\d)\\s?°\\s?N(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_S = JsRegex.Compile("(\\d)\\s?°\\s?S(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_E = JsRegex.Compile("(\\d)\\s?°\\s?E(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_W = JsRegex.Compile("(\\d)\\s?°\\s?W(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+(?:[.,]\\d+)*)\\s?[%٪％]", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "g");
    private static readonly JsRe CURRENCY_RE = JsRegex.Compile($"([$€¥£₹])\\s?(\\d+(?:[.,]\\d+)*)(\\s*(?:{MAGNITUDE_ALT})(?![\\p{{L}}\\p{{M}}]))?", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+(?:\\.\\d+)?)\\s?[-–—]\\s?(\\d+(?:\\.\\d+)?)(?![\\d.,])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})\\/(\\d{1,3})(?![\\d\\/])", "gu");
    private static readonly JsRe BARE_HUNDRED = JsRegex.Compile("(?<![\\d,.\\-–—])100(?![\\d,.\\-–—])(?!\\s*[A-Za-z])", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe TILDE = JsRegex.Compile("~\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile(" {2,}", "gu");
    private static readonly JsRe ENDS_EES = JsRegex.Compile("ीस$", "u");

    /** Build the Marathi normalizer. Takes the numbers definition so the ordinal and clock rules compose
     *  their cardinals from the same data the engine's own number path uses. */
    public static Func<string, string> MakeMarathiNormalizer(NumbersDef numbers)
    {
        /** Integer → its Marathi cardinal words, exactly as the engine's number path would render them. */
        List<string> Cardinal(double n) =>
            Numbers.indicNumberWords(n, numbers).Select(w => w ?? "").ToList();
        string CardinalText(double n) => string.Join(" ", Cardinal(n));

        var UNITS = new HashSet<string>(numbers.Units, StringComparer.Ordinal);
        var TEENS = new HashSet<string>(numbers.Teens ?? [], StringComparer.Ordinal);

        /** The ordinal STEM of the last cardinal word. */
        string OrdinalStem(string w)
        {
            if (w == numbers.Magnitudes.Hundred) return "शंभरा"; // शे is the combining form; the ordinal is शंभरावा
            if (w == "नऊ") return "नव"; // 9 → नववा, the one unit with a stem change
            if (ENDS_EES.IsMatch(w)) return JsRegex.Replace(w, ENDS_EES, _ => "िसा");
            if (UNITS.Contains(w) || TEENS.Contains(w)) return w;
            return DEV_CONSONANT_FINAL.IsMatch(w) ? $"{w}ा" : w;
        }

        string? Ordinal(double n, int form, string suffix)
        {
            if (double.IsInteger(n) && n >= int.MinValue && n <= int.MaxValue &&
                IRREGULAR.TryGetValue((int)n, out var irr)) return irr[form];
            var words = Cardinal(n);
            if (words.Count == 0 || words.Any(w => w == "")) return null;
            words[^1] = $"{OrdinalStem(words[^1])}{suffix}";
            return string.Join(" ", words);
        }

        /** H:MM → the Marathi clock. वाजून is the equivalent of Hindi बजकर; at :00 the minutes drop and
         *  the postposition is वाजता (never बजे). */
        string Clock(double h, double min) =>
            min == 0
                ? CardinalText(h)
                : $"{CardinalText(h)} वाजून {CardinalText(min)} मिनिटे";

        return input =>
        {
            var s = input;

            s = JsRegex.Replace(s, AE_DIGRAPH, _ => "ऍ");
            s = JsRegex.Replace(s, AO_DIGRAPH, _ => "ऑ");
            s = JsRegex.Replace(s, ZW_JOINERS, _ => "");

            s = JsRegex.Replace(s, DEV_DIGIT, m => Js.NumberToString(Js.CodePointAt0(m.Value) - 0x0966));

            s = JsRegex.Replace(s, VISARGA_CLOCK, m => $"{m.Groups[1].Value}:{m.Groups[2].Value}");
            s = JsRegex.Replace(s, COLON_INTERNAL, _ => "ः");
            s = JsRegex.Replace(s, TAH_COLON, m => $"{m.Groups[1].Value}ः");

            s = JsRegex.Replace(s, ERA_BCE_FULL, _ => "इसवी सन पूर्व");
            s = JsRegex.Replace(s, ERA_BCE_SHORT, _ => "इसवी सन पूर्व");
            s = JsRegex.Replace(s, ERA_CE, _ => "इसवी सन");

            s = JsRegex.Replace(s, DOCTOR, m => $"डॉक्टर{m.Groups[1].Value}");

            s = JsRegex.Replace(s, ORDINAL, m =>
                Ordinal(Js.Number(m.Groups[1].Value), SUFFIX_FORM[m.Groups[2].Value], m.Groups[2].Value) ?? m.Value);

            s = JsRegex.Replace(s, NUM_BEFORE_VA, m =>
            {
                var n = Js.Number(m.Groups[1].Value);
                if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return m.Value;
                var words = Cardinal(n);
                if (words.Count == 0 || words.Any(w => w == "")) return m.Value;
                var sp = m.Groups[2].Value;
                return $"{string.Join(" ", words)}{(sp != "" ? sp : " ")}";
            });

            // Sports times (mm:ss.hh) FIRST, and the guard between the two time rules is the point: these are
            // not clocks, but the inherited Hindi clock rule claims them. Dropping the colon leaves two plain
            // numbers, which nothing downstream can re-claim.
            s = JsRegex.Replace(s, SPORTS_TIME, m => $"{m.Groups[1].Value} {m.Groups[2].Value}");
            // The clock proper; its `(?![\d:.])` is what refuses 7a's leftovers. `whole7b` stands in for the JS
            // replacer's fifth argument (the subject string) and must be snapshotted, since `s` is reassigned
            // by every step.
            var whole7b = s;
            s = JsRegex.Replace(s, CLOCK_COLON, m =>
            {
                var h = m.Groups[1].Value;
                var min = m.Groups[2].Value;
                var vaajta = m.Groups[3].Success ? m.Groups[3].Value : null;
                var body = Clock(Js.Number(h), Js.Number(min));
                if (Js.Number(min) != 0) return body;
                var rest = whole7b[(m.Index + m.Length)..];
                return !string.IsNullOrEmpty(vaajta) || !VAAJ_NEXT.IsMatch(rest) ? $"{body} वाजता" : body;
            });
            s = JsRegex.Replace(s, CLOCK_DOT_TZ, m => Clock(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));

            s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} अंश सेल्सिअस");
            s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} अंश फॅरेनहाइट");
            s = JsRegex.Replace(s, DEG_N, m => $"{m.Groups[1].Value} अंश उत्तर");
            s = JsRegex.Replace(s, DEG_S, m => $"{m.Groups[1].Value} अंश दक्षिण");
            s = JsRegex.Replace(s, DEG_E, m => $"{m.Groups[1].Value} अंश पूर्व");
            s = JsRegex.Replace(s, DEG_W, m => $"{m.Groups[1].Value} अंश पश्चिम");
            s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} अंश");

            s = JsRegex.Replace(s, PERCENT, m =>
            {
                var n = m.Groups[1].Value;
                return $"{n} {(Js.Number(JsRegex.Replace(n, COMMA_G, _ => "")) == 1 ? "टक्का" : "टक्के")}";
            });

            s = JsRegex.Replace(s, CURRENCY_RE, m =>
                $"{m.Groups[2].Value}{(m.Groups[3].Success ? m.Groups[3].Value : "")} {CURRENCY[m.Groups[1].Value]}");

            s = JsRegex.Replace(s, UNIT_RE, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            // Ranges N-M → "N ते M", but ONLY when ascending: a descending or equal pair is a sports result,
            // where "ते" would be wrong and the silent hyphen the engine already produces is correct.
            s = JsRegex.Replace(s, RANGE, m =>
            {
                var a = m.Groups[1].Value;
                var b = m.Groups[2].Value;
                return Js.Number(b) > Js.Number(a) ? $"{a} ते {b}" : m.Value;
            });

            s = JsRegex.Replace(s, FRACTION, m =>
            {
                double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
                if (num == 1 && den == 2) return "अर्धा";
                if (num == 1 && den == 4) return "पाव";
                if (num == 3 && den == 4) return "पाऊण";
                var nw = CardinalText(num);
                var dw = CardinalText(den);
                return nw == "" || dw == "" ? m.Value : $"{nw} भागिले {dw}";
            });

            s = JsRegex.Replace(s, BARE_HUNDRED, _ => "शंभर");

            s = JsRegex.Replace(s, PLUS, _ => " अधिक ");
            s = JsRegex.Replace(s, TILDE, _ => " सुमारे ");

            s = JsRegex.Replace(s, PLUSMINUS, _ => " अधिक उणे ");
            s = PostposedSignPass.PostposedSign(s, "<", "पेक्षा कमी");
            s = PostposedSignPass.PostposedSign(s, ">", "पेक्षा जास्त");
            s = PostposedSignPass.PostposedSign(s, "÷", "ने भागणे");
            s = JsRegex.Replace(s, EQUALS, _ => " बरोबर ");
            s = JsRegex.Replace(s, DOUBLE_SPACE, _ => " ");

            return s;
        };
    }
}
