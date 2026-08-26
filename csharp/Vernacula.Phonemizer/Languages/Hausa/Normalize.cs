/**
 * Hausa (ha) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/hausa/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hausa;

public static class Normalize
{
    /** Hausa letter names — the standard Boko alphabet (a, ba, bi, ca, da, e, fa, ga, ha, i, ja, ka, la,
     *  ma, na, o, pa, ku, ra, sa, ta, u, wa, ya, za). */
        /**
     * Hausa phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?).
     */
    public static readonly Func<string, bool> IsUnreadableHausa = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{Manifest.MANIFEST.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Codas, StringComparer.Ordinal),
    });

    /** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "opec", "un", "nasa", "aids", "laser", "covid" }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => Manifest.MANIFEST.LetterNames.GetValueOrDefault(l.ToLowerInvariant()),
        AcronymLetters = new HashSet<string>(new[]
        {
            "aol", "au", "pstn", "a1gp", "gps", "npws", "oha", "unaids", "ungu", "nc", "nsw", "xdr-tb",
            "h5n1", "dna", "hiv", "dvd", "cd", "tv", "pc", "pdf", "fbi", "cia", "nsa", "faa", "bbc",
            "cnn", "cbs", "nbc", "itv", "mri", "ms",
        }, StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = IsUnreadableHausa,
    });

    // The step patterns. The TS builds each inline; JsRegex.Compile caches, so hoisting them here is a
    // readability choice and not a behaviour one.
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe BC_BEFORE_KAFIN = JsRegex.Compile("B\\.?C\\.?(?=\\.?kafin)", "giu");
    private static readonly JsRe BCE = JsRegex.Compile("(?<![\\p{L}\\p{M}])B\\.?C\\.?E?\\.?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOT_OR_SPACE = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe INITIAL_DOT = JsRegex.Compile("(?<=\\p{Lu})\\.(?=\\s+\\p{Lu})", "gu");
    private static readonly JsRe VERSUS = JsRegex.Compile("(?<=\\p{L})\\s+v\\.\\s+(?=[A-Z])", "gu");
    private static readonly JsRe US_DOLLAR = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:US|uS)\\s?\\$\\s?(?=\\d)", "giu");
    private static readonly JsRe RANGE_DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+\\.\\d+)\\s*[-–]\\s*(\\d+\\.\\d+)(?![\\d.])", "gu");
    // ⚠ Each operand must END ON A DIGIT — see the TS. A trailing separator let `1,` match and the
    // range rule claimed the minus of `1, -2`, reading a range where the text has a negative number.
    private static readonly JsRe RANGE_PLAIN = JsRegex.Compile("(?<![\\d.,])(\\d(?:[\\d,]*\\d)?)\\s*[-–]\\s*(\\d(?:[\\d,]*\\d)?)(?![\\d.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d:,])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])(?:\\s*([Aa]\\.?[Mm]\\.?|[Pp]\\.?[Mm]\\.?))?", "giu");
    private static readonly JsRe CLOCK_DOT_TZ = JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\.(\\d{2})\\s*(UTC|GMT)", "giu");
    private static readonly JsRe GHZ = JsRegex.Compile("(?<![\\d.,])(\\d+\\.\\d+)\\s?Ghz?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DECIMAL_UNIT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)\\s?(km\\/h|m\\/s|km\\/u|mph|mil\\/awa|km|m|kg|mm|cm)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DECIMAL_VERSION = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?=[a-z](?![\\p{L}\\p{M}]))", "giu");
    private static readonly JsRe DECIMAL_PLAIN = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d.])", "giu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d\\/])(\\d{1,3})\\/(\\d{1,3})(?![\\d\\/])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?[°º]\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?[°º]\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?[°º]\\s?([NSEW])(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?[°º](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RATE_SLASH = JsRegex.Compile("(?<!\\d)(\\d+)\\s?(km|m|kg|mm|cm)\\s*\\/\\s*(h|s|u)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_WORD = JsRegex.Compile("(?<!\\d)(\\d+)\\s?(mph|kph|mil\\/awa)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_MBIT = JsRegex.Compile("(?<!\\d)(\\d+)\\s?Mbit\\/s(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe UNIT_BEFORE_NUM = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])(km|kg|mm|cm)(?=\\s\\p{Nd})", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+\\s?(?=\\d)", "gu");
    // ⚠ U+2212 IS IN THE CLASS AND THE HYPHEN'S GUARDS ARE UNCHANGED — see the TS module. The MINUS SIGN's
    // only Unicode meaning is the arithmetic operator and no keyboard types it, so it is read on the
    // character's identity rather than on corpus attestation; leading position only, so a range and a
    // negative exponent are still refused by the lookbehind.
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{Nd}])[-\u2212](\\d+)(?!\\s*[-\\d])", "gu");
    private static readonly JsRe AMP_INITIALS = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})&(\\p{Lu})(s?)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile("\\s&\\s", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(\\d)", "gu");
    private static readonly JsRe DECIMAL_PERCENT = JsRegex.Compile("(?<![kK]ashi\\s+)([\\p{L}\\p{M}\\d]+ maki [\\p{L}\\p{M} ]+?)\\s*%\\s*(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACE = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    private static readonly IReadOnlyDictionary<string, string> UNIT_NOUN = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilomita", ["m"] = "mita", ["kg"] = "kilogram", ["mm"] = "milimita", ["cm"] = "santimita",
        ["km/h"] = "kilomita a awa", ["km/u"] = "kilomita a awa", ["m/s"] = "mita a daƙiƙa",
        ["mph"] = "mil a awa", ["mil/awa"] = "mil a awa",
    };
    private static readonly IReadOnlyDictionary<string, string> RATE_NOUN = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilomita", ["m"] = "mita", ["kg"] = "kilogram", ["mm"] = "milimita", ["cm"] = "santimita",
    };
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "arewa", ["S"] = "kudu", ["E"] = "gabas", ["W"] = "yamma",
    };
    private static readonly IReadOnlyDictionary<string, string> UNIT_BEFORE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilomita", ["kg"] = "kilogram", ["mm"] = "milimita", ["cm"] = "santimita",
    };

    /** Digits of a fraction, each spelled by the cardinal compositor. */
    private static string SpellFraction(string f) =>
        string.Join(" ", Js.CodePoints(f).Select(d => HausaNumbers.NumberToWords(Js.Number(d))));

    /** Normalize one Hausa input string. The steps below are ORDER-DEPENDENT. */
    public static string NormalizeHausa(string input)
    {
        var s = input;

        // 1) HTML ENTITIES, FIRST — before the ampersand rule in step 11.
        s = JsRegex.Replace(s, AMP_ENTITY, _ => " da ");

        s = JsRegex.Replace(s, BC_BEFORE_KAFIN, _ => "");
        s = JsRegex.Replace(s, BCE, _ => "kafin haihuwar Yesu");

        s = JsRegex.Replace(s, DOTTED_CAPS, m => JsRegex.Replace(m.Value, DOT_OR_SPACE, _ => ""));
        // ⚠ `\p{Lu}`, NOT `[A-Z]` — the ASCII form leaves the dot after Hausa's own hooked capitals
        //    ⟨Ɓ Ɗ Ƙ⟩ standing as a spurious clause break.
        s = JsRegex.Replace(s, INITIAL_DOT, _ => "");
        s = JsRegex.Replace(s, VERSUS, _ => " da ");

        s = JsRegex.Replace(s, US_DOLLAR, _ => "dala ");

        // 4) RANGES and SCORES. The DECIMAL range must come FIRST: the plain-range lookbehind `(?<![\d.,])`
        //    blocks a digit that follows a dot, so `4.2-3.9` would never match and the hyphen would vanish.
        s = JsRegex.Replace(s, RANGE_DECIMAL, m => $"{m.Groups[1].Value} zuwa {m.Groups[2].Value}");
        s = JsRegex.Replace(s, RANGE_PLAIN, m => $"{m.Groups[1].Value} zuwa {m.Groups[2].Value}");

        // 5) CLOCK, COLON form. NOT a sports time: a THIRD `\d.\d\d` field (4:41.30) means a pace. The
        //    marker is captured WITHOUT eating the space before it (the clock-glue trap).
        s = JsRegex.Replace(s, CLOCK_COLON, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            var head = mv == 0
                ? HausaNumbers.NumberToWords(hv)
                : $"{HausaNumbers.NumberToWords(hv)} da {HausaNumbers.NumberToWords(mv)}";
            var apLower = (m.Groups[3].Success ? m.Groups[3].Value : "").ToLowerInvariant();
            var suffix = apLower.StartsWith("p", StringComparison.Ordinal) ? " na yamma"
                : apLower.StartsWith("a", StringComparison.Ordinal) ? " na safe" : "";
            return $"{head}{suffix}";
        });

        s = JsRegex.Replace(s, CLOCK_DOT_TZ, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = mv == 0
                ? HausaNumbers.NumberToWords(hv)
                : $"{HausaNumbers.NumberToWords(hv)} da {HausaNumbers.NumberToWords(mv)}";
            return $"{head} {m.Groups[3].Value}";
        });

        // 7) VERSION DOTS and DOT DECIMALS — Hausa follows English here (comma = thousands, dot = decimal).
        //    AFTER the clock steps, which have already claimed the clock-shaped dots.
        s = JsRegex.Replace(s, GHZ, m => $"{m.Groups[1].Value} gigahertz");
        // Longest-first alternation: km/h and m/s must win over the bare km/m.
        s = JsRegex.Replace(s, DECIMAL_UNIT, m =>
            $"{m.Groups[1].Value} maki {SpellFraction(m.Groups[2].Value)} {UNIT_NOUN[m.Groups[3].Value.ToLowerInvariant()]}");
        s = JsRegex.Replace(s, DECIMAL_VERSION, m =>
            $"{m.Groups[1].Value} maki {SpellFraction(m.Groups[2].Value)} ");
        s = JsRegex.Replace(s, DECIMAL_PLAIN, m =>
            $"{m.Groups[1].Value} maki {SpellFraction(m.Groups[2].Value)}");

        s = JsRegex.Replace(s, DECIMAL_COMMA, m =>
            $"{m.Groups[1].Value} maki {SpellFraction(m.Groups[2].Value)}");

        s = JsRegex.Replace(s, FRACTION, m =>
            $"{HausaNumbers.NumberToWords(Js.Number(m.Groups[1].Value))} bisa {HausaNumbers.NumberToWords(Js.Number(m.Groups[2].Value))}");

        s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} digiri Celsius");
        s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} digiri Fahrenheit");
        s = JsRegex.Replace(s, DEG_COMPASS, m =>
            $"{m.Groups[1].Value} digiri {COMPASS[m.Groups[2].Value.ToUpperInvariant()]}");
        s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} digiri");

        // 10) RATES. AFTER the version-dot rule (`12.8km` has been claimed by now), BEFORE the shared tier.
        s = JsRegex.Replace(s, RATE_SLASH, m =>
        {
            var d = m.Groups[3].Value.ToLowerInvariant();
            return $"{HausaNumbers.NumberToWords(Js.Number(m.Groups[1].Value))} {RATE_NOUN[m.Groups[2].Value.ToLowerInvariant()]} a {(d == "h" || d == "u" ? "awa" : "daƙiƙa")}";
        });
        s = JsRegex.Replace(s, RATE_WORD, m =>
            $"{HausaNumbers.NumberToWords(Js.Number(m.Groups[1].Value))} {(m.Groups[2].Value.ToLowerInvariant() == "kph" ? "kilomita" : "mil")} a awa");
        s = JsRegex.Replace(s, RATE_MBIT, m =>
            $"{HausaNumbers.NumberToWords(Js.Number(m.Groups[1].Value))} megabit a daƙiƙa");

        // 10b) THE UNIT SYMBOL BEFORE ITS NUMERAL — `km 2-3` is HAUSA'S OWN ORDER, not a typo, so only the
        //     symbol is spelled out and the number is left where it stands. AFTER the range step, which has
        //     already turned `2-3` into `2 zuwa 3`; run before it and the lookahead would have to admit the
        //     hyphen and would then also match a compound designation.
        s = JsRegex.Replace(s, UNIT_BEFORE_NUM, m => UNIT_BEFORE[m.Groups[1].Value]);

        s = JsRegex.Replace(s, PLUS, _ => " ƙari ");
        s = JsRegex.Replace(s, MINUS, m => $"rashin {m.Groups[1].Value}");
        s = JsRegex.Replace(s, AMP_INITIALS, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return $"{Manifest.MANIFEST.LetterNames.GetValueOrDefault(a.ToLowerInvariant()) ?? a} da {Manifest.MANIFEST.LetterNames.GetValueOrDefault(b.ToLowerInvariant()) ?? b}{m.Groups[3].Value}";
        });
        s = JsRegex.Replace(s, AMP_SPACED, _ => " da ");
        s = JsRegex.Replace(s, EQUALS, m => $"{m.Groups[1].Value} daidai {m.Groups[2].Value}");
        s = JsRegex.Replace(s, LESS_THAN, m => $"{m.Groups[1].Value} kasa da {m.Groups[2].Value}");
        s = JsRegex.Replace(s, GREATER_THAN, m => $"{m.Groups[1].Value} fiye da {m.Groups[2].Value}");
        s = JsRegex.Replace(s, TIMES, m => $"{m.Groups[1].Value} sau {m.Groups[2].Value}");
        s = JsRegex.Replace(s, DECIMAL_PERCENT, m => $"kashi {m.Groups[1].Value}");

        // 12) INITIALISMS, LAST of the letter rules: after the era markers (else `B.C.` → *ba. ca.*) and
        //     after the dotted-capital rule.
        s = NormalizeInitialisms(s);

        // The padded replacements above (` ƙari `, ` da `) can double a space or leave one at an edge.
        return JsRegex.Replace(JsRegex.Replace(s, SPACE_RUN, _ => " "), EDGE_SPACE, _ => "");
    }
}
