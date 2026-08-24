/**
 * Hausa (ha) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE PERCENT WORD PRECEDES THE NUMBER: Hausa's register is "kashi 80%" (kashi = portion), so this is a
 * PREPOSED reading, not the postposed one most of the fleet uses.
 *
 * ⚠ THE CLOCK MARKERS ARE HAUSA WORDS, not a.m./p.m.: `na safe` (morning) and `na yamma` (evening) attach to
 * a colon clock, and 24-hour forms arrive with a timezone instead (`12.00 GMT`). A rule that assumes one of
 * the three silently mishandles the others.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hausa;

public static class Normalize
{
    // ─────────────────────────────────────────────────────────────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────────────────────────────────────────────────────────────

    /** Hausa letter names — the standard Boko alphabet (a, ba, bi, ca, da, e, fa, ga, ha, i, ja, ka, la,
     *  ma, na, o, pa, ku, ra, sa, ta, u, wa, ya, za). */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "ba", ["c"] = "ca", ["d"] = "da", ["e"] = "e", ["f"] = "fa", ["g"] = "ga",
        ["h"] = "ha", ["i"] = "i", ["j"] = "ja", ["k"] = "ka", ["l"] = "la", ["m"] = "ma", ["n"] = "na",
        ["o"] = "o", ["p"] = "pa", ["q"] = "ku", ["r"] = "ra", ["s"] = "sa", ["t"] = "ta", ["u"] = "u",
        ["v"] = "fa", ["w"] = "wa", ["x"] = "iks", ["y"] = "ya", ["z"] = "za",
        ["ɓ"] = "ɓa", ["ɗ"] = "ɗa", ["ƙ"] = "ƙa", ["ƴ"] = "ƴa",
    };

    /** Hausa phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
    public static readonly Func<string, bool> IsUnreadableHausa = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        // ɓ ɗ ƙ ƴ are the hooked CONSONANTS, not vowels — they are already in `legalOnsets` below. Listing
        // them here made any run containing one count as pronounceable, so a letter-run with a hooked letter
        // would never be spelled out.
        Vowels = JsRegex.Compile("[aeiou]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "ɓ", "ɗ", "ƙ", "ƴ", "sh", "ts", "ch", "gw", "kw", "hw", "gy", "ky", "ny", "b", "d", "f",
            "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t", "w", "y",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "b", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "w", "y", "n",
        }, StringComparer.Ordinal),
    });

    /** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "opec", "un", "nasa", "aids", "laser", "covid" }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l.ToLowerInvariant()),
        AcronymLetters = new HashSet<string>(new[]
        {
            "aol", "au", "pstn", "a1gp", "gps", "npws", "oha", "unaids", "ungu", "nc", "nsw", "xdr-tb",
            "h5n1", "dna", "hiv", "dvd", "cd", "tv", "pc", "pdf", "fbi", "cia", "nsa", "faa", "bbc",
            "cnn", "cbs", "nbc", "itv", "mri", "ms",
        }, StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = IsUnreadableHausa,
    });

    // The step patterns. The TS builds each inline; JsRegex.Compile caches, so hoisting is a readability
    // choice and not a behaviour one.
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe BC_BEFORE_KAFIN = JsRegex.Compile("B\\.?C\\.?(?=\\.?kafin)", "giu");
    private static readonly JsRe BCE = JsRegex.Compile("(?<![\\p{L}\\p{M}])B\\.?C\\.?E?\\.?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOT_OR_SPACE = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe INITIAL_DOT = JsRegex.Compile("(?<=\\p{Lu})\\.(?=\\s+\\p{Lu})", "gu");
    private static readonly JsRe VERSUS = JsRegex.Compile("(?<=\\p{L})\\s+v\\.\\s+(?=[A-Z])", "gu");
    private static readonly JsRe US_DOLLAR = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:US|uS)\\s?\\$\\s?(?=\\d)", "giu");
    private static readonly JsRe RANGE_DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+\\.\\d+)\\s*[-–]\\s*(\\d+\\.\\d+)(?![\\d.])", "gu");
    private static readonly JsRe RANGE_PLAIN = JsRegex.Compile("(?<![\\d.,])(\\d[\\d,]*)\\s*[-–]\\s*(\\d[\\d,]*)(?![\\d.])", "gu");
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
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{Nd}])-(\\d+)(?!\\s*[-\\d])", "gu");
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

    /** Normalize one Hausa input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
    public static string NormalizeHausa(string input)
    {
        var s = input;

        // 1) HTML ENTITIES — the corpus's one `&amp;` reads "da" (and). FIRST, before the ampersand rule.
        s = JsRegex.Replace(s, AMP_ENTITY, _ => " da ");

        // 2) ERA MARKERS — `1000 B.C.`, `10,000 BCE`. The corpus's B.C./BCE read "kafin haihuwar Yesu"
        //    (before the birth of Jesus). The corpus's ONE instance writes "1000 B.C.kafin zuwan" — the
        //    "kafin" (before) already follows, so B.C. is redundant there and is removed (else a double
        //    "kafin kafin"). The bare BCE cases expand.
        s = JsRegex.Replace(s, BC_BEFORE_KAFIN, _ => "");
        s = JsRegex.Replace(s, BCE, _ => "kafin haihuwar Yesu");

        // 3) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
        //    `George W. Bush` — the W. suffix dot is a break. `Roe v. Wade` — the v. is a dotted lowercase.
        s = JsRegex.Replace(s, DOTTED_CAPS, m => JsRegex.Replace(m.Value, DOT_OR_SPACE, _ => ""));
        //    ⚠ `\p{Lu}`, NOT `[A-Z]`, which is the line above's class dropped to ASCII on the way past —
        //    the same trap as `[^\W\d_]`, in the spelling that looks least like a mistake. Six languages
        //    carried this line verbatim and every one of them has capitals outside ASCII; here it is
        //    Hausa's own hooked ⟨Ɓ Ɗ Ƙ⟩. The minimal pair, measured before the fix:
        //        "M. Bello"    → "M Bello"
        //        "M. Ɗanjuma" → unchanged   ← the dot survives as a spurious clause break
        s = JsRegex.Replace(s, INITIAL_DOT, _ => "");
        // `v.` in a legal case name (Roe v. Wade) reads "da" (and). The v. sits between two NAMES, not two
        // initials, so match a word-boundary "v." with a capital following (Wade).
        s = JsRegex.Replace(s, VERSUS, _ => " da ");

        // 3b) CURRENCY PREFIXES — `US$14.7`, `US $ 30` (the corpus's US dollar glued AND spaced forms). The
        //     bare `$` is the tier's; the US prefix names the currency. AFTER the era markers.
        //     The word is `dala` — the corpus's own "dalar Amurka" and "biliyoyin dalolin Amurka" — not the
        //     English `dollar`, which is attested nowhere. Same fix as the tier's `$` entry in hausa.ts.
        s = JsRegex.Replace(s, US_DOLLAR, _ => "dala ");

        // 4) RANGES and SCORES — `2-3 km`, `5-3`, `1644-1912`, `2-5`. Hausa reads these with "zuwa" (to)
        //     or just two numbers. The corpus's prose uses "daga X zuwa Y". A leading minus stays a sign.
        //     A DECIMAL range needs its own rule and has to come FIRST: the plain-range lookbehind `(?<![\d.,])`
        //     blocks a digit that follows a dot, so `4.2-3.9 miliyan` — the corpus's one decimal range — never
        //     matched, the decimal rule then turned each side into words, and the hyphen was dropped with no
        //     joiner at all (*huɗu maki biyu uku maki tara*).
        s = JsRegex.Replace(s, RANGE_DECIMAL, m => $"{m.Groups[1].Value} zuwa {m.Groups[2].Value}");
        s = JsRegex.Replace(s, RANGE_PLAIN, m => $"{m.Groups[1].Value} zuwa {m.Groups[2].Value}");

        // 5) CLOCK, in the COLON form. `8:46 na safe` → takwas da arba'in da shida na safe; `11:29` → goma
        //     sha ɗaya da ashirin da tara. The corpus's own "na safe"/"na yamma" (a.m./p.m.) stay. The
        //     English p.m./a.m. markers expand. NOT a sports time: a THIRD `\d.\d\d` field (4:41.30) means
        //     a pace. The marker is captured WITHOUT eating the space before it (the clock-glue trap).
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

        // 6) CLOCK, in the DOT form before a timezone — `12.00 GMT`, `15.00 UTC`. The dot is otherwise a
        //     decimal; a timezone after the two-digit minutes marks a clock.
        s = JsRegex.Replace(s, CLOCK_DOT_TZ, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = mv == 0
                ? HausaNumbers.NumberToWords(hv)
                : $"{HausaNumbers.NumberToWords(hv)} da {HausaNumbers.NumberToWords(mv)}";
            return $"{head} {m.Groups[3].Value}";
        });

        // 7) VERSION DOTS and DOT DECIMALS — `1.1`, `1.5`, `2.8`, `12.8`, `Hoto na 1.1`, `2.8 miliyan`. The
        //     dot is a DECIMAL (the corpus follows English; thousands use COMMAS). Read "da rabi" (and a
        //     half) for a .5 fraction, "da kwata" for .25/.75, or the digit-by-digit "maki" (point). The
        //     corpus's only dot-decimals are 1.1, 1.5, 2.8, 12.8; "maki" is the Hausa word for "point".
        //     AFTER the clock.
        s = JsRegex.Replace(s, GHZ, m => $"{m.Groups[1].Value} gigahertz");
        // Longest-first alternation: km/h and m/s must win over the bare km/m.
        s = JsRegex.Replace(s, DECIMAL_UNIT, m =>
            $"{m.Groups[1].Value} maki {SpellFraction(m.Groups[2].Value)} {UNIT_NOUN[m.Groups[3].Value.ToLowerInvariant()]}");
        // A VERSION LETTER after the fraction (802.11n) is a separate letter — emit it spaced.
        s = JsRegex.Replace(s, DECIMAL_VERSION, m =>
            $"{m.Groups[1].Value} maki {SpellFraction(m.Groups[2].Value)} ");
        s = JsRegex.Replace(s, DECIMAL_PLAIN, m =>
            $"{m.Groups[1].Value} maki {SpellFraction(m.Groups[2].Value)}");

        // 7c) COMMA-DECIMALS — `12,5`. Hausa follows English (comma = thousands, dot = decimal), so a
        //     comma-decimal is corpus-absent — but it must not LEAK the comma as a clause pause. A comma
        //     followed by a THREE-digit group is thousands (6,387) and stays for the TOKEN; this claims
        //     only 1-2 digit fractions.
        s = JsRegex.Replace(s, DECIMAL_COMMA, m =>
            $"{m.Groups[1].Value} maki {SpellFraction(m.Groups[2].Value)}");

        // 8) FRACTIONS. `4/4` (the corpus's four-wheel drive) reads "hudu-hudu"; `inci 1/5` (one fifth of
        //     an inch) reads "ɗaya bisa biyar" (one over five). The corpus's two fractions are 4/4 and 1/5.
        s = JsRegex.Replace(s, FRACTION, m =>
            $"{HausaNumbers.NumberToWords(Js.Number(m.Groups[1].Value))} bisa {HausaNumbers.NumberToWords(Js.Number(m.Groups[2].Value))}");

        // 9) DEGREES. `30°C` came out as the bare consonant [tʃ]; `35°W` is a LONGITUDE. "digiri" is the
        //     degree word. The compass letters N/S/E/W read their Hausa words.
        s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} digiri Celsius");
        s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} digiri Fahrenheit");
        s = JsRegex.Replace(s, DEG_COMPASS, m =>
            $"{m.Groups[1].Value} digiri {COMPASS[m.Groups[2].Value.ToUpperInvariant()]}");
        s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} digiri");

        // 10) RATES — `160km / h`, `480 km/h`, `133 m/s`, `300 mph`, `600Mbit/s`, `64 kph`, `100-200
        //     mil/awa`. The corpus's own prose "mil/awa" (miles per hour) is text; the unit/unit forms need
        //     "a awa" (per hour). AFTER the version-dot rule (12.8km has been claimed), BEFORE the tier.
        s = JsRegex.Replace(s, RATE_SLASH, m =>
        {
            var d = m.Groups[3].Value.ToLowerInvariant();
            return $"{HausaNumbers.NumberToWords(Js.Number(m.Groups[1].Value))} {RATE_NOUN[m.Groups[2].Value.ToLowerInvariant()]} a {(d == "h" || d == "u" ? "awa" : "daƙiƙa")}";
        });
        s = JsRegex.Replace(s, RATE_WORD, m =>
            $"{HausaNumbers.NumberToWords(Js.Number(m.Groups[1].Value))} {(m.Groups[2].Value.ToLowerInvariant() == "kph" ? "kilomita" : "mil")} a awa");
        s = JsRegex.Replace(s, RATE_MBIT, m =>
            $"{HausaNumbers.NumberToWords(Js.Number(m.Groups[1].Value))} megabit a daƙiƙa");

        // 10b) THE UNIT SYMBOL BEFORE ITS NUMERAL — `km 2-3`, and this is HAUSA'S OWN ORDER, not a typo.
        //     The shared tier fires only AFTER a numeral, so `mai nisan km 2-3 ya rufe shi` left `km` in the
        //     IPA as raw ASCII — the artifact's one genuine unit leak, and invisible to every gate but the
        //     raw-Latin one, since a Latin run in a Latin-script language looks like a word.
        //     ⚠ THE ORDER IS MEASURED, NOT ASSUMED. This artifact writes the SPELLED-OUT noun in exactly this
        //     position five times — `kilomita 1`, `kilomita 7` ×2, `kilomita 2` ×2 — against one abbreviated
        //     `km 2`. Hausa puts the measure noun in front of its count, and the corpus is consistent about it;
        //     the abbreviation is simply the one spelling the tier could not reach.
        //     ⚠ SO THE NUMBER IS LEFT WHERE IT STANDS and only the symbol is spelled out. Rewriting to
        //     `2-3 kilomita` would "fix" the leak by imposing the tier's digit-first order on a language whose
        //     own corpus writes the other one; the point is to say the noun, not to move the count.
        //     ⚠ MULTI-LETTER, VOWEL-FREE, EXACT CASE — trap 46 and `isBareUnitKey`'s argument. A bare `m`
        //     collides with far too much to claim on a following digit alone, and upper-case `KM`/`Cm` are
        //     mostly not units at all; both are ×0 here, so neither is guessed at.
        //     ⚠ AFTER THE RANGE STEP, which has already turned `2-3` into `2 zuwa 3`. Run before it and the
        //     lookahead would have to admit the hyphen and would then also match a compound designation.
        s = JsRegex.Replace(s, UNIT_BEFORE_NUM, m => UNIT_BEFORE[m.Groups[1].Value]);

        // 11) SIGNS. `+30°C` — the plus was dropped. `&` → *da* (and). A TRUE minus (`-5`) reads "rashin";
        //     the corpus's `-\d` are all ranges/scores, now handled above. `%` → *kashi* (the tier's prefix).
        s = JsRegex.Replace(s, PLUS, _ => " ƙari ");
        s = JsRegex.Replace(s, MINUS, m => $"rashin {m.Groups[1].Value}");
        s = JsRegex.Replace(s, AMP_INITIALS, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return $"{LETTER_NAME.GetValueOrDefault(a.ToLowerInvariant()) ?? a} da {LETTER_NAME.GetValueOrDefault(b.ToLowerInvariant()) ?? b}{m.Groups[3].Value}";
        });
        s = JsRegex.Replace(s, AMP_SPACED, _ => " da ");
        s = JsRegex.Replace(s, EQUALS, m => $"{m.Groups[1].Value} daidai {m.Groups[2].Value}");
        s = JsRegex.Replace(s, LESS_THAN, m => $"{m.Groups[1].Value} kasa da {m.Groups[2].Value}");
        s = JsRegex.Replace(s, GREATER_THAN, m => $"{m.Groups[1].Value} fiye da {m.Groups[2].Value}");
        s = JsRegex.Replace(s, TIMES, m => $"{m.Groups[1].Value} sau {m.Groups[2].Value}");
        // A PERCENT after a DECIMAL — `3.5%`. The dot rule has converted the number to words by now, so the
        // tier's digit-adjacent kashi would miss it; claim the word-form percent here (the decimal-percent
        // leak). The bare-digit `%` is the tier's. NOT when "kashi" already precedes (the corpus writes
        // "kashi 3.5%" — adding another kashi would double it).
        s = JsRegex.Replace(s, DECIMAL_PERCENT, m => $"kashi {m.Groups[1].Value}");

        // 12) INITIALISMS, LAST of the letter rules: it must run after the era markers (else B.C. → *ba.
        //     ca.*) and after the dotted-capital rule.
        s = NormalizeInitialisms(s);

        // A padded replacement (` ƙari `, ` da `) doubles a space that was already there and can leave one at
        // an edge (`+30°C` → ` ƙari …`). SLOT-GAP is a defect class; this pass should not feed it.
        return JsRegex.Replace(JsRegex.Replace(s, SPACE_RUN, _ => " "), EDGE_SPACE, _ => "");
    }
}
