/**
 * Zulu / isiZulu (zu) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/zulu/normalize.ts — see that file for the noun-class-concord design, the
 * click-letter argument behind the degree/era/`sq mi` rules, and the corpus evidence for every step.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zulu;

public static class Normalize
{
    /** Metric / imperial unit words, all the same `ama-` + borrowed-stem frame. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "amakhilomitha", ["m"] = "amamitha", ["mm"] = "amamilimitha", ["cm"] = "amasentimitha",
        ["kg"] = "amakhilogremu", ["mi"] = "amamayela", ["ft"] = "amafidi",
        ["kma"] = "amakhilomitha",
    };

    /** Rate denominators. Both are ONE agglutinated word — see the RATE step. */
    private static readonly IReadOnlyDictionary<string, string> PER = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["h"] = "ngehora", ["s"] = "ngomzuzwana",
    };

    /** Compass directions, for a degree reading. */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "enyakatho", ["S"] = "eningizimu", ["E"] = "empumalanga", ["W"] = "entshonalanga",
    };

    private static IReadOnlyDictionary<string, string> ORDINAL_YE => Manifest.MANIFEST.OrdinalYe;

    /** `ngaphambi kukaKristu` — before Christ. No `AD`/`A.D.` form is declared. */
    private const string BCE_WORD = "ngaphambi kukaKristu";

    /** Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period, consuming the
     *  dot only when the sentence visibly continues. `body` is the abbreviation WITHOUT its final dot. */
    private static string ExpandDotted(string s, string body, string word)
    {
        var atEnd = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.(?=[  ]*(?:$|\\p{{Lu}}))", "gu");
        var inline = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.", "gu");
        return inline.Replace(atEnd.Replace(s, _ => $"{word}."), _ => word);
    }

    /** A clock's spoken body. `:00` reads as the bare hour, never *iqanda* (zero). */
    private static string ClockBody(string h, string min)
    {
        var hv = Js.Number(h);
        var mv = Js.Number(min);
        return mv == 0 ? Js.NumberToString(hv) : $"{Js.NumberToString(hv)} nemizuzu engu-{Js.NumberToString(mv)}";
    }

    /** a.m./p.m. → the half-day words. */
    private static string HalfDay(string? marker)
    {
        if (marker is null) return "";
        return Js.ToLowerCase(marker).StartsWith("p", StringComparison.Ordinal) ? " ntambama" : " ekuseni";
    }

    /** ENGLISH LETTER NAMES SPELLED IN NGUNI ORTHOGRAPHY, for reading initialisms. ⚠ Every spelling avoids
     *  c, q and x, which are CLICK letters here — see the TS for the sourcing argument. */
    private static readonly IReadOnlyDictionary<string, string> NGUNI_LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "eyi", ["B"] = "bhi", ["C"] = "si", ["D"] = "di", ["E"] = "i", ["F"] = "efu",
        ["G"] = "ji", ["H"] = "eyitshi", ["I"] = "ayi", ["J"] = "jeyi", ["K"] = "kheyi", ["L"] = "eli",
        ["M"] = "emu", ["N"] = "eni", ["O"] = "o", ["P"] = "phi", ["Q"] = "khyu", ["R"] = "a",
        ["S"] = "esi", ["T"] = "thi", ["U"] = "yu", ["V"] = "vi", ["W"] = "dabhuliyu", ["X"] = "eksi",
        ["Y"] = "wayi", ["Z"] = "zedi",
    };

    /** Acronyms said as WORDS, not letters. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS = new HashSet<string>(new[]
    {
        "covid", "nato", "fifa", "opec", "unesco", "unicef", "aids", "laser", "sars", "eskom", "sadc",
    }, StringComparer.Ordinal);

    private static readonly JsRe LOWERCASE = JsRegex.Compile("\\p{Ll}", "u");
    private static readonly JsRe WHITESPACE = JsRegex.Compile("\\s", "u");
    private static readonly JsRe ALLCAPS_RUN = JsRegex.Compile("(?<![\\p{Lu}\\p{M}\\d])[A-Z]{2,6}(?![\\p{L}\\p{M}\\d$])", "gu");

    private static string SpellNguniInitialisms(string s)
    {
        if (!LOWERCASE.IsMatch(s) && WHITESPACE.IsMatch(s.Trim())) return s;
        return ALLCAPS_RUN.Replace(s, m =>
        {
            var run = m.Value;
            return WORD_ACRONYMS.Contains(Js.ToLowerCase(run))
                ? run
                : string.Join(" ", Js.CodePoints(run).Select(c => NGUNI_LETTER_NAME.TryGetValue(c, out var v) ? v : c));
        });
    }

    // ── The step patterns, hoisted. JsRegex.Compile caches, so this is a readability choice only.
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*&\\s*", "gu");
    private static readonly JsRe BCE_BARE = JsRegex.Compile("(?<![\\p{L}\\p{M}])BCE(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe BC_AFTER_NUM = JsRegex.Compile("(?<=\\d[  ])BC(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[  ]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOTS_AND_SPACE = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe LONE_INITIAL = JsRegex.Compile("(?<=\\p{L}[  ])(\\p{Lu})\\.(?=[  ]+\\p{Lu})", "gu");
    private static readonly JsRe DEGROUP_COMMA = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(,\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe DEGROUP_SPACE = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})([    ]\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe SPORTS_TIME = JsRegex.Compile("(?<![\\d:.,])(\\d{1,2}):([0-5]\\d)\\.(\\d{2})(?![\\d.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile(
        "(?<![\\d:.,])([01]?\\d|2[0-3]):[  ]?([0-5]\\d)(?![:.\\d])(?:[  ]*([Aa]\\.?[Mm]\\.?|[Pp]\\.?[Mm]\\.?)(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe CLOCK_TZ = JsRegex.Compile(
        "(?<![\\d.,])(\\d{1,2})[.,]([0-5]\\d)(?=[  ]*(?:UTC|GMT)(?![\\p{L}\\p{M}]))", "gu");
    private static readonly JsRe CLOCK_TZ_BARE = JsRegex.Compile(
        "(?<![\\d.,])(0\\d)([0-5]\\d)(?=[  ]*(?:UTC|GMT)(?![\\p{L}\\p{M}]))", "gu");
    private static readonly JsRe LOOSE_MERIDIEM = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])([Aa]\\.[Mm]|[Pp]\\.[Mm])\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("[  ]?\\+[  ]?(?=\\d)", "gu");
    private static readonly JsRe SAID_DEGREES = JsRegex.Compile("amazinga[^.!?;]*$", "u");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d[\\d.,]*)[  ]?[°º][  ]?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d[\\d.,]*)[  ]?[°º][  ]?F(?![\\p{L}\\p{M}])", "gui");
    // ⚠ `[+]?` removed from these two — step 8c claims every `+` before a digit, so it was unreachable
    // and the comment there already claimed it was gone. See the TS.
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d[\\d.,]*)[  ]?[°º][  ]?([NSEW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d[\\d.,]*)[  ]?[°º]", "gu");
    private static readonly JsRe RANGE_DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+\\.\\d+)[  ]*[-–—][  ]*(\\d+\\.\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe RANGE_INT = JsRegex.Compile("(?<![\\d.,])(\\d[\\d,]*\\d|\\d)[  ]*[-–—][  ]*(\\d[\\d,]*\\d|\\d)(?![\\d.,])", "gu");
    private static readonly JsRe RATE = JsRegex.Compile(
        "(?<!\\d)(\\d[\\d.,]*)[  ]?(km|mi|m|mm|cm|kg)[  ]*\\/[  ]*([hs])(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MPH = JsRegex.Compile("(?<![\\p{L}\\p{M}])mph(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe KPH = JsRegex.Compile("(?<![\\p{L}\\p{M}])kph(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe SQ_MI = JsRegex.Compile("(\\d[\\d.,]*)[  ]?sq[  ]?mi(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe KMA = JsRegex.Compile("(?<!\\d)(\\d[\\d.,]*)[  ]?kma(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe TRAILING_ZEROS = JsRegex.Compile("0+$", "u");
    private static readonly JsRe DEC_CURRENCY = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(?:US\\$|AUD\\$|\\$|£)[  ]?(\\d+)\\.(\\d+)(?!\\.?\\d)", "gu");
    private static readonly JsRe DEC_UNIT = JsRegex.Compile(
        "(?<![\\d.,])(\\d+)\\.(\\d+)[  ]?(km|mi|mm|cm|kg|ft|m)([²2])?(?![\\p{L}\\p{M}'’])", "giu");
    private static readonly JsRe DEC_PLAIN = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?!\\.?\\d)", "gu");
    private static readonly JsRe DEC_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/.,])1[  ]?\\/[  ]?(\\d{1,2})(?![\\d/.,])", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("[  ]?×[  ]?", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("[  ]?=[  ]?", "gu");
    private static readonly JsRe LESS = JsRegex.Compile("[  ]?<[  ]?", "gu");
    private static readonly JsRe GREATER = JsRegex.Compile("[  ]?>[  ]?", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{Nd}])(?<![\\p{L}\\p{Nd}][  ])[-−](?=\\d)", "gu");
    private static readonly JsRe SPACED_DASH = JsRegex.Compile("(?<!\\d)[  ]+[-–—]+[  ]+(?!\\d)", "gu");
    private static readonly JsRe ETC = JsRegex.Compile("(?<![\\p{L}\\p{M}])njll?\\.?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DOCTOR = JsRegex.Compile("(?<![\\p{L}\\p{M}])u?dkt\\.?(?![\\p{L}\\p{M}])", "giu");

    /** `[i, ...f.replace(/0+$/, "")].filter(t => t !== "").join(" ")` — the decimal read digit by digit. */
    private static string Dec(string i, string f)
    {
        var parts = new List<string> { i };
        parts.AddRange(Js.CodePoints(TRAILING_ZEROS.Replace(f, "")));
        return string.Join(" ", parts.Where(t => t != ""));
    }

    /**
     * Zulu text normalization. Runs BEFORE the shared symbol tier, so every rule leaves a NUMBER where the
     * tier expects one — except the decimal rewrite, which claims its neighbouring sign and unit itself.
     */
    public static string NormalizeZulu(string input)
    {
        var s = input;

        // 1) HTML ENTITY, first.
        s = AMP_ENTITY.Replace(s, "&");

        // 2) AMPERSAND → `kanye ne-`.
        s = AMPERSAND.Replace(s, " kanye ne-");

        // 3) ERA MARKERS, before the generic dotted-run rule below.
        s = ExpandDotted(s, "B\\.C\\.E", BCE_WORD);
        s = ExpandDotted(s, "B\\.C", BCE_WORD);
        s = BCE_BARE.Replace(s, _ => BCE_WORD);
        s = BC_AFTER_NUM.Replace(s, _ => BCE_WORD);

        // 4) DOTTED CAPITAL RUNS and a LONE INITIAL.
        s = DOTTED_CAPS.Replace(s, m => DOTS_AND_SPACE.Replace(m.Value, ""));
        s = LONE_INITIAL.Replace(s, "$1");

        // 5) THOUSANDS DE-GROUPING, before anything else numeric.
        s = DEGROUP_COMMA.Replace(s, m => COMMA_G.Replace(m.Value, ""));
        s = DEGROUP_SPACE.Replace(s, m => GROUP_SPACES.Replace(m.Value, ""));

        // 5b) SPORTS TIMES, before the clock rule.
        s = SPORTS_TIME.Replace(s, "$1 $2 $3");

        // 6) CLOCK, colon form.
        s = CLOCK_COLON.Replace(s, m =>
            $"{ClockBody(m.Groups[1].Value, m.Groups[2].Value)}{HalfDay(m.Groups[3].Success ? m.Groups[3].Value : null)}");

        // 7) CLOCK before a TIMEZONE, comma/dot and bare-four-digit spellings.
        s = CLOCK_TZ.Replace(s, m => ClockBody(m.Groups[1].Value, m.Groups[2].Value));
        s = CLOCK_TZ_BARE.Replace(s, m => ClockBody(m.Groups[1].Value, m.Groups[2].Value));

        // 8) a.m./p.m. NOT attached to a clock.
        s = LOOSE_MERIDIEM.Replace(s, m => HalfDay(m.Value).Trim());

        // 8c) THE PLUS AND ±, before the degree rule — see the TS on why this ordering is load-bearing.
        s = PLUSMINUS.Replace(s, " plas o mayinas ");
        s = PLUS.Replace(s, " plas ");

        // 9) DEGREES.
        string Deg(string digits, string tail, int offset, string full) =>
            $"{(SAID_DEGREES.IsMatch(full[..offset]) ? "" : "amazinga angu-")}{digits}{tail}";
        var full9 = s;
        s = DEG_C.Replace(s, m => Deg(m.Groups[1].Value, "", m.Index, full9));
        var full9F = s;
        s = DEG_F.Replace(s, m => Deg(m.Groups[1].Value, " Fahrenheit", m.Index, full9F));
        var full9C = s;
        s = DEG_COMPASS.Replace(s, m =>
            Deg(m.Groups[1].Value, $" {COMPASS[m.Groups[2].Value.ToUpperInvariant()]}", m.Index, full9C));
        var full9B = s;
        s = DEG_BARE.Replace(s, m => Deg(m.Groups[1].Value, "", m.Index, full9B));

        // 10) RANGES → `kuya ku-`. Decimal ranges FIRST — see the TS.
        s = RANGE_DECIMAL.Replace(s, "$1 kuya ku-$2");
        s = RANGE_INT.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(COMMA_G.Replace(a, "")) < Js.Number(COMMA_G.Replace(b, ""))
                ? $"{a} kuya ku-{b}" : m.Value;
        });

        // 11) RATE, LOCAL and not the shared tier's — Zulu's rate is a SINGLE agglutinated word.
        s = RATE.Replace(s, m =>
            $"{m.Groups[1].Value} {UNIT_WORD[Js.ToLowerCase(m.Groups[2].Value)]} {PER[Js.ToLowerCase(m.Groups[3].Value)]}");
        s = MPH.Replace(s, $"{UNIT_WORD["mi"]} {PER["h"]}");
        s = KPH.Replace(s, $"{UNIT_WORD["km"]} {PER["h"]}");

        // 12) SQUARE MILES.
        s = SQ_MI.Replace(s, $"$1 {UNIT_WORD["mi"]} skwele");

        // 12b) `kma`, the corpus's own misspelling of km — the UNIT_WORD entry no pattern used to reach.
        s = KMA.Replace(s, $"$1 {UNIT_WORD["kma"]}");

        // 13) DECIMALS — the currency and unit arms first.
        s = DEC_CURRENCY.Replace(s, m => $"{Dec(m.Groups[1].Value, m.Groups[2].Value)} amadola");
        s = DEC_UNIT.Replace(s, m =>
            $"{Dec(m.Groups[1].Value, m.Groups[2].Value)} {UNIT_WORD[Js.ToLowerCase(m.Groups[3].Value)]}"
            + (m.Groups[4].Success ? " skwele" : ""));
        s = DEC_PLAIN.Replace(s, m => Dec(m.Groups[1].Value, m.Groups[2].Value));

        // 13b) COMMA-DECIMAL.
        s = DEC_COMMA.Replace(s, m => Dec(m.Groups[1].Value, m.Groups[2].Value));

        // 14) FRACTION — numerator 1 only.
        s = FRACTION.Replace(s, m =>
            ORDINAL_YE.TryGetValue(Js.NumberToString(Js.Number(m.Groups[1].Value)), out var ord)
                ? $"ingxenye {ord}" : m.Value);

        // 14b) MATH SIGNS. The plus is NOT claimed here — step 8c takes it.
        s = TIMES.Replace(s, " kuphindwe ngo-");
        s = EQUALS.Replace(s, " kulingana no-");
        s = LESS.Replace(s, " ngaphansi kuka-");
        s = GREATER.Replace(s, " ngaphezu kuka-");
        s = MINUS.Replace(s, "ukukhipha ");

        // 15) A SPACED DASH is a parenthetical break, LAST.
        s = SPACED_DASH.Replace(s, ", ");
        s = ETC.Replace(s, "njalonjalo");
        s = DOCTOR.Replace(s, "udokotela");

        // INITIALISMS LAST — every rule above owns capitals of its own.
        s = SpellNguniInitialisms(s);

        return s;
    }
}
