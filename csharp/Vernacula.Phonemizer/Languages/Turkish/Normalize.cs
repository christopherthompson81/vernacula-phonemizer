/**
 * Turkish (tr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/turkish/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public static class Normalize
{
    private static readonly JsRe VOWEL = JsRegex.Compile("[aeıioöuü]", "u");

    /** Four-way vowel harmony: the high vowel a suffix takes after each possible last stem vowel. */
    private static readonly IReadOnlyDictionary<string, string> HIGH = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "ı", ["ı"] = "ı", ["e"] = "i", ["i"] = "i", ["o"] = "u", ["u"] = "u", ["ö"] = "ü", ["ü"] = "ü",
    };

    private static string? LastVowelOf(string w)
    {
        for (var i = w.Length - 1; i >= 0; i--) if (VOWEL.IsMatch(w[i].ToString())) return w[i].ToString();
        return null;
    }

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");

    /** Integer → the Turkish ORDINAL: the cardinal with the ordinal suffix on its LAST word (18 → `on
     *  sekizinci`, 1000 → `bininci`). */
    public static string? OrdinalWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0) return null;
        var card = TurkishNumbers.NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        var words = card.Split(' ');
        var stem = words[^1];
        if (stem == "dört") stem = "dörd";
        var v = LastVowelOf(stem);
        if (v is null) return null;
        var h = HIGH[v];
        words[^1] = stem.Length > 0 && VOWEL.IsMatch(stem[^1].ToString()) ? $"{stem}nc{h}" : $"{stem}{h}nc{h}";
        return string.Join(" ", words);
    }

    /**
     * Glue an apostrophe-attached case/possessive/plural suffix onto the LAST word of a spoken numeral:
     * `1985'te` → bin dokuz yüz seksen **beşte**, `1970'lerin` → … **yetmişlerin**.
     */
    public static List<string> AttachSuffix(IReadOnlyList<string> words, string suffix)
    {
        if (words.Count == 0) return new List<string> { suffix };
        var outp = words.ToList();
        var last = outp[^1];
        var stem = last == "dört" && VOWEL.IsMatch(suffix.Length > 0 ? suffix[0].ToString() : "") ? "dörd" : last;
        outp[^1] = stem + suffix;
        return outp;
    }

    /** Dotted abbreviations → the spoken words. Counts are corpus counts; `vb.` and `Dr.` are the frequent ones
     *  and both previously left the interior dot behind as a phrase break (`vb.` → `vb .`). */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["vb"] = "ve benzeri", // ×7
        ["vs"] = "ve saire",   // ×1
        ["dr"] = "Doktor",     // ×5
        ["no"] = "numara",     // ×1
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(a => a.Length));

    /** Turkish letter names (TDK alphabet, 29 letters). q/w/x are NOT Turkish letters and are deliberately
     *  absent — see the file header. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "ce", ["ç"] = "çe", ["d"] = "de", ["e"] = "e", ["f"] = "fe",
        ["g"] = "ge", ["ğ"] = "yumuşak ge", ["h"] = "he", ["ı"] = "ı", ["i"] = "i", ["j"] = "je",
        ["k"] = "ke", ["l"] = "le", ["m"] = "me", ["n"] = "ne", ["o"] = "o", ["ö"] = "ö", ["p"] = "pe",
        ["r"] = "re", ["s"] = "se", ["ş"] = "şe", ["t"] = "te", ["u"] = "u", ["ü"] = "ü", ["v"] = "ve",
        ["y"] = "ye", ["z"] = "ze",
    };

    /** Turkish phonotactics, for the OOV rule in core/initialisms.ts. Native Turkish words admit NO initial
     *  cluster at all; the onsets listed are the obstruent+liquid and s+stop clusters loanwords brought in. */
    public static readonly Func<string, bool> IsUnreadableTurkish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeıioöuüâîû]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "pl", "pr", "ps", "sk", "sl", "sm",
            "sn", "sp", "st", "tr",
            "ch", "yl", "sf",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ft", "kt", "ks", "lç", "lf", "lk", "lm", "lp", "ls", "lt", "nç", "nk", "ns", "nt", "nz",
            "pt", "rç", "rd", "rf", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "rz", "sk", "st", "şt",
            "zm", "ng", "lg", "ht", "ny", "nc",
        }, StringComparer.Ordinal),
    });

    /** Turkish has no pronunciation dictionary here (the g2p is rule-based), so nothing is "recorded" and the
     *  decision rests on the phonotactic OOV test alone. `acronymLetters` is empty on purpose. */
    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        Lower = G2p.TrLower,
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        AcronymLetters = new HashSet<string>(StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableTurkish,
    });

    // The step patterns. The TS builds several inline; JsRegex.Compile caches, so hoisting them here is a
    // readability choice and not a behaviour one.
    private static readonly JsRe ERA_MO_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])M\\.\\s?Ö\\.", "gu");
    private static readonly JsRe ERA_MS_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])M\\.\\s?S\\.", "gu");
    private static readonly JsRe ERA_MO = JsRegex.Compile("(?<![\\p{L}\\p{M}])MÖ(?=\\s+\\d)", "gu");
    private static readonly JsRe ERA_MS = JsRegex.Compile("(?<![\\p{L}\\p{M}])MS(?=\\s+\\d)", "gu");
    private static readonly JsRe NO_LU = JsRegex.Compile("(?<![\\p{L}\\p{M}])No\\.['’]lu(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?![\\d'’])", "gu");
    private static readonly JsRe RATE_KM = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?km\\s?\\/\\s?(?:saat|sa|s)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RATE_MIL = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?mil\\s?\\/\\s?(?:saat|sa|s)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RATE_MS = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?m\\s?\\/\\s?s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s?&\\s?", "gu");
    private const string OPERAND = "\\d+";

    /** Normalize one Turkish input string. */
    public static string NormalizeTurkish(string input)
    {
        var s = input;

        s = JsRegex.Replace(s, ERA_MO_DOTTED, _ => "milattan önce");
        s = JsRegex.Replace(s, ERA_MS_DOTTED, _ => "milattan sonra");
        s = JsRegex.Replace(s, ERA_MO, _ => "milattan önce");
        s = JsRegex.Replace(s, ERA_MS, _ => "milattan sonra");

        s = JsRegex.Replace(s, NO_LU, _ => "numaralı"); // 11 No.'lu → 11 numaralı
        s = JsRegex.Replace(s, ABBREV_MID, m =>
            $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = JsRegex.Replace(s, ABBREV_END, m =>
            $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        System.Text.RegularExpressions.MatchEvaluator Clock = m =>
            Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} {m.Groups[2].Value}";
        s = JsRegex.Replace(s, CLOCK_COLON, Clock);
        s = JsRegex.Replace(s, CLOCK_DOT, Clock);

        s = JsRegex.Replace(s, RATE_KM, m => $"saatte {m.Groups[1].Value} kilometre");
        s = JsRegex.Replace(s, RATE_MIL, m => $"saatte {m.Groups[1].Value} mil");
        s = JsRegex.Replace(s, RATE_MS, m => $"saniyede {m.Groups[1].Value} metre");

        s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} derece");
        s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} derece");

        s = JsRegex.Replace(s, PLUSMINUS, _ => " artı eksi ");
        s = JsRegex.Replace(s, PLUS_AFTER, m => $"{m.Groups[1].Value} artı {m.Groups[2].Value}");
        s = JsRegex.Replace(s, PLUS_START, m => $"{m.Groups[1].Value}artı {m.Groups[2].Value}");
        s = JsRegex.Replace(s, MINUS, m => $"{m.Groups[1].Value}eksi {m.Groups[2].Value}");

        static string LowVowel(string stem)
        {
            var v = LastVowelOf(stem);
            return v is not null && "aıou".Contains(v, StringComparison.Ordinal) ? "a" : "e";
        }
        /** Ablative -DEn: the consonant assimilates to a voiceless stem final (üç → üçten, dört → dörtten). */
        static string Ablative(string w)
        {
            var cut = w.LastIndexOf(' ') + 1;
            string head = w[..cut], stem = w[cut..];
            var d = "pçtkfhsş".Contains(stem[^1]) ? "t" : "d";
            return $"{head}{stem}{d}{LowVowel(stem)}n";
        }
        static string TrWord(string t)
        {
            var w = TurkishNumbers.NumberToWords(Js.Number(t));
            return w != "" ? w : t;
        }
        void Postposed(string sign, Func<string, string> inflect, string verb)
        {
            s = JsRegex.Replace(s, JsRegex.Compile($"({OPERAND})\\s?{sign}\\s?({OPERAND})", "gu"),
                m => $"{TrWord(m.Groups[1].Value)} {inflect(TrWord(m.Groups[2].Value))} {verb}");
        }
        Postposed("<", Ablative, "küçüktür");
        Postposed(">", Ablative, "büyüktür");
        s = JsRegex.Replace(s, EQUALS, _ => " eşittir ");
        s = JsRegex.Replace(s, DIVIDE, _ => " bölü ");

        s = JsRegex.Replace(s, AMPERSAND, _ => " ve ");

        s = NormalizeInitialisms(s);

        return s;
    }
}
