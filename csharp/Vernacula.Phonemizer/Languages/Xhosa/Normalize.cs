/**
 * Xhosa / isiXhosa (xh) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/xhosa/normalize.ts — see that file for the noun-class-concord design (every rule
 * leaves its operand as DIGITS), the click-letter argument behind the degree and letter-name rules, and the
 * corpus evidence and step ordering each rule states.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Xhosa;

public static class Normalize
{
    private static IReadOnlyList<string> NA => Manifest.MANIFEST.Numbers.Na;

    /** Nguni vowel coalescence for the connective `na-` + a vowel-initial noun. */
    private static readonly IReadOnlyDictionary<string, string> COALESCE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["e"] = "e", ["i"] = "e", ["o"] = "o", ["u"] = "o",
    };

    /** Measure nouns. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "iikhilomitha", ["m"] = "iimitha", ["cm"] = "iisentimitha", ["mm"] = "iimilimitha",
        ["mi"] = "iimayile", ["kg"] = "iikhilogram",
    };

    /** Rate denominators — single ATTESTED words, not an "A per B" composition. */
    private static readonly IReadOnlyDictionary<string, string> PER = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["h"] = "ngeyure", ["u"] = "ngeyure", ["s"] = "ngomzuzwana",
    };

    /** Currency, for the DECIMAL path only. Keys must match the tier's declaration (see Xhosa.cs). */
    private static readonly IReadOnlyDictionary<string, string> CUR_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["US$"] = "iidola zaseMelika", ["AUD$"] = "iidola", ["$"] = "iidola",
        ["£"] = "iiponti", ["¥"] = "iiyeni",
    };

    /** Magnitude words. Shared with Xhosa.cs's `Magnitudes` and kept identical. */
    public static readonly IReadOnlyList<string> MAGNITUDES = new[]
    {
        "yezigidi", "zezigidi", "izigidi", "bhiliyoni", "miliyoni", "million",
    };

    /** ⚠ `sort((a, b) => b.length - a.length)` — JS `Array.prototype.sort` is STABLE, so equal-length entries
     *  keep their declaration order. `OrderByDescending` is stable too; `List.Sort` is not. */
    private static readonly string MAG_ALT = string.Join("|", MAGNITUDES.OrderByDescending(m => m.Length));

    /** Compass points for a bare degree — `35°W` is a LONGITUDE, not a temperature. */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "emantla", ["S"] = "emazantsi", ["E"] = "empuma", ["W"] = "entshona",
    };

    private const string AM = "kusasa";
    private const string PM = "emva kwemini";

    // ── HELPERS ──────────────────────────────────────────────────────────────────────────────────────

    /** `na-` prefixed to a numeral's words, with the coalescence above. */
    private static string Connective(double n)
    {
        if (n < 10)
        {
            var i = (int)n;
            return i >= 0 && i < NA.Count ? NA[i] : Numbers.NumberToWords(n);
        }
        var parts = Numbers.NumberToWords(n).Split(' ');
        var head = parts[0];
        var key = Js.ToLowerCase(head[..1]);
        parts[0] = COALESCE.TryGetValue(key, out var v) ? $"n{v}{head[1..]}" : $"na {head}";
        return string.Join(" ", parts);
    }

    /** An hour and its minutes as Xhosa words. `:00` emits the hour alone. */
    private static string ClockWords(double h, double m) =>
        m == 0 ? Numbers.NumberToWords(h) : $"{Numbers.NumberToWords(h)} {Connective(m)}";

    /** The digits of a fractional part, spaced so the number path speaks them one at a time. */
    private static string Spell(string i, string frac) => $"{i} {string.Join(" ", Js.CodePoints(frac))}";

    /** Is a word appearing anywhere in the ~40 characters before this offset? The `amaqondo` redundancy guard. */
    private static bool SaidBefore(string full, int offset, string word) =>
        full[Math.Max(0, offset - 40)..offset].Contains(word, StringComparison.Ordinal);

    /** ENGLISH LETTER NAMES SPELLED IN NGUNI ORTHOGRAPHY. ⚠ Every spelling avoids c, q and x, which are CLICK
     *  letters here — see the TS for the sourcing argument. */
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
        if (!LOWERCASE.IsMatch(s) && WHITESPACE.IsMatch(Js.Trim(s))) return s;
        return Rewrite(s, ALLCAPS_RUN, m =>
        {
            var run = m.Value;
            return WORD_ACRONYMS.Contains(Js.ToLowerCase(run))
                ? run
                : string.Join(" ", Js.CodePoints(run).Select(c => NGUNI_LETTER_NAME.TryGetValue(c, out var v) ? v : c));
        });
    }

    // ── THE PASS. Patterns hoisted; JsRegex.Compile caches, so this is a readability choice only. ─────
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("&", "gu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:\\p{Lu}\\.){2,}", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe LEADS_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe LEADS_SPACE_CAP = JsRegex.Compile("^[  ]+\\p{Lu}", "u");
    private static readonly JsRe CAPS_ONE_DOT = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})\\.(\\p{Lu})(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe GLUED_INITIAL = JsRegex.Compile("(?<![\\p{Lu}\\p{M}])(\\p{Lu})\\.(?=\\p{Lu}\\p{Ll})", "gu");
    // ⚠ THE CONCORD'S CASE IS IN THE CLASS, NOT AN `i` FLAG — `\p{Lu}` under `/i` matches a lowercase letter,
    // so the "followed by a capitalised name" guard would require nothing. See the TS.
    private static readonly JsRe HONORIFIC = JsRegex.Compile("(?<![\\p{L}\\p{M}])([uU]?)Mnu\\.?(?=[  ]\\p{Lu})", "gu");
    private static readonly JsRe JUNIOR = JsRegex.Compile("(?<![\\p{L}\\p{M}])Jr\\.(?=[  ]\\p{Ll})", "gu");
    private static readonly JsRe ETC = JsRegex.Compile("(?<![\\p{L}\\p{M}])njll?\\.?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEGROUP_COMMA = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:,\\d{3})+(?![\\d]|,\\d)", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe DEGROUP_SPACE = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:[    ]\\d{3})+)(?![\\d])", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe CUR_SPLIT = JsRegex.Compile("(?<=[\\p{L}\\p{M}])(?=(?:US|AUD)?[$£¥€][  ]?\\d)", "gu");
    private static readonly JsRe CUR_JOIN = JsRegex.Compile("(?<![\\p{L}\\p{M}])(US|AUD)[  ]+(?=[$£¥€][  ]?\\d)", "gu");
    private static readonly JsRe DEC_CURRENCY = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])(US\\$|AUD\\$|[$£¥])[  ]?(\\d+)([.,])(\\d+)((?:[  ](?:{MAG_ALT}))?)", "gu");
    private static readonly JsRe TRAILING_SPACE = JsRegex.Compile("[  ]+$", "u");
    private static readonly JsRe DEC_UNIT = JsRegex.Compile(
        "(?<![\\d.,])(\\d+)([.,])(\\d+)[  ]?(km|mm|cm|kg|mi|m)(?![\\p{L}\\p{M}'’ʼ])", "gu");
    private static readonly JsRe RANGE_DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+\\.\\d+)[  ]?[-–][  ]?(\\d+\\.\\d+)(?![\\d.])", "gu");
    // ⚠ THE MARKER HAS A RIGHT EDGE, and without one it ate the next word: `ama-` is a Xhosa noun-class prefix,
    // so `9:30 amaXhosa` matched ` Am`. See the TS.
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile(
        "(?<![\\d:.,])([01]?\\d|2[0-3]):[  ]?([0-5]\\d)(?![:.\\d])(?:[  ]*([AaPp])\\.?[Mm]\\.?(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe CLOCK_TZ = JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\.([0-5]\\d)(?![.\\d])[  ]*(UTC|GMT)", "gu");
    // ⚠ `:` IS DECLARED CLAUSE PUNCTUATION, so a numeric colon the clock rules decline reached the tokenizer
    // as a PAUSE inside a quantity. All 8 corpus survivors are numeric relations. See the TS.
    private static readonly JsRe NUMERIC_COLON = JsRegex.Compile("(\\d)[  ]?:[  ]?(?=\\d)", "gu");
    private static readonly JsRe RANGE_INT = JsRegex.Compile("(?<![\\d.,])(\\d+)[  ]?[-–][  ]?(\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe RATE = JsRegex.Compile("(?<![\\d.,])(\\d+)[  ]?(km|mi|m)[  ]*\\/[  ]*(h|u|s)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MPH = JsRegex.Compile("(?<![\\d.,])(\\d+)[  ]?(mph|kph)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])([+-])?(\\d+)[  ]?°[  ]?[CF](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d+)[  ]?°[  ]?([NSEW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)[  ]?[°º](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ENG_ORDINAL = JsRegex.Compile("(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe EQUALS = JsRegex.Compile("[  ]*[=≈][  ]*", "gu");
    private static readonly JsRe LESS = JsRegex.Compile("[  ]*<[  ]*", "gu");
    private static readonly JsRe GREATER = JsRegex.Compile("[  ]*>[  ]*", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)[  ]*×[  ]*(?=\\d)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("[  ]*÷[  ]*", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile("(?<=[\\p{L}\\d])\\+(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEAD = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])\\+[  ]?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])(?<![\\p{L}\\p{M}][  ])[-−](?=\\d)", "gu");
    private static readonly JsRe DEC_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d])", "gu");
    private static readonly JsRe DEC_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe RUN_OF_SPACES = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACES = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** A comma is a decimal separator only with a 1–2 digit tail; a dot always is. */
    private static bool Decimal(string sep, string frac) => sep == "." || frac.Length <= 2;

    /** Normalize one Xhosa input string. Steps are ORDER-DEPENDENT; each states its coupling in the TS. */
    public static string NormalizeXhosa(string input)
    {
        var s = input;

        // 1) HTML ENTITY, then the bare ampersand → `kunye`.
        s = Rewrite(Rewrite(s, AMP_ENTITY, "&"), AMPERSAND, " kunye ");

        // 2) DOTTED CAPITAL RUNS → the bare letters, keeping the final dot where the sentence visibly ends.
        var full2 = s;
        s = Rewrite(s, DOTTED_CAPS, m =>
        {
            var letters = DOTS.Replace(m.Value, "");
            var rest = full2[(m.Index + m.Length)..];
            if (LEADS_LETTER.IsMatch(rest)) return $"{letters} "; // glued next word
            return rest == "" || LEADS_SPACE_CAP.IsMatch(rest) ? $"{letters}." : letters;
        });
        s = Rewrite(s, CAPS_ONE_DOT, "$1$2");
        s = Rewrite(s, GLUED_INITIAL, "$1 ");

        // 3) ABBREVIATIONS.
        s = Rewrite(s, HONORIFIC, "$1Mnumzana");
        s = Rewrite(s, JUNIOR, "Jr");
        s = Rewrite(s, ETC, "njalonjalo");

        // 4) THOUSANDS DE-GROUPING, before anything else numeric.
        s = Rewrite(s, DEGROUP_COMMA, m => COMMA_G.Replace(m.Value, ""));
        s = Rewrite(s, DEGROUP_SPACE, m => GROUP_SPACES.Replace(m.Value, ""));

        // 5) THE CURRENCY SIGN, PRISED OFF ITS CONCORD PREFIX. ⚠ THE SPLIT MUST RUN BEFORE THE JOIN.
        s = Rewrite(s, CUR_SPLIT, " ");
        s = Rewrite(s, CUR_JOIN, "$1");

        // 6) A DECIMAL CARRYING A CURRENCY SIGN OR A UNIT must claim it here.
        s = Rewrite(s, DEC_CURRENCY, m =>
        {
            var sym = m.Groups[1].Value;
            var frac = m.Groups[4].Value;
            if (!Decimal(m.Groups[3].Value, frac)) return m.Value;
            var cur = CUR_WORD.TryGetValue(sym, out var c) ? c : "";
            return TRAILING_SPACE.Replace($"{Spell(m.Groups[2].Value, frac)}{m.Groups[5].Value} {cur}", "");
        });
        s = Rewrite(s, DEC_UNIT, m =>
            Decimal(m.Groups[2].Value, m.Groups[3].Value)
                ? $"{Spell(m.Groups[1].Value, m.Groups[3].Value)} {UNIT_WORD[m.Groups[4].Value]}"
                : m.Value);

        // 7) A DECIMAL RANGE, before the plain range rule and before step 15.
        s = Rewrite(s, RANGE_DECIMAL, "$1 ukuya ku $2");

        // 8) THE CLOCK, colon form — the one rule that must produce WORDS.
        s = Rewrite(s, CLOCK_COLON, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            var marker = !m.Groups[3].Success ? ""
                : Js.ToLowerCase(m.Groups[3].Value) == "p" ? $" {PM}" : $" {AM}";
            return $"{ClockWords(hv, mv)}{marker}";
        });

        // 9) THE CLOCK, DOT form before a timezone — `12.00 GMT`.
        s = Rewrite(s, CLOCK_TZ, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            return hv > 23 ? m.Value : $"{ClockWords(hv, Js.Number(m.Groups[2].Value))} {m.Groups[3].Value}";
        });

        // 9b) A COLON LEFT BETWEEN TWO DIGITS IS NOT A CLAUSE BREAK. AFTER both clock rules.
        s = Rewrite(s, NUMERIC_COLON, "$1 ");

        // 10) RANGES → `ukuya ku`. ⚠ ASCENDING ONLY: a non-ascending `N-N` is a score or a season.
        s = Rewrite(s, RANGE_INT, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                ? $"{m.Groups[1].Value} ukuya ku {m.Groups[2].Value}" : m.Value);

        // 11) RATES, resolved locally rather than through the tier's `unitPer`.
        s = Rewrite(s, RATE, m =>
        {
            var hasHead = UNIT_WORD.TryGetValue(Js.ToLowerCase(m.Groups[2].Value), out var head);
            var hasPer = PER.TryGetValue(Js.ToLowerCase(m.Groups[3].Value), out var per);
            return !hasHead || !hasPer ? m.Value : $"{m.Groups[1].Value} {head} {per}";
        });
        s = Rewrite(s, MPH, m =>
            $"{m.Groups[1].Value} {(Js.ToLowerCase(m.Groups[2].Value) == "kph" ? UNIT_WORD["km"] : UNIT_WORD["mi"])} {PER["h"]}");

        // 12) DEGREES — a temperature, a longitude, and the bare sign.
        var full12 = s;
        s = Rewrite(s, DEG_SCALE, m =>
        {
            var sign = m.Groups[1].Success ? m.Groups[1].Value : null;
            var body = SaidBefore(full12, m.Index, "maqondo") ? m.Groups[2].Value : $"amaqondo {m.Groups[2].Value}";
            if (sign == "+") return $"plas {body}";
            return sign == "-" ? $"thabatha {body}" : body;
        });
        var full12b = s;
        s = Rewrite(s, DEG_COMPASS, m =>
            $"{(SaidBefore(full12b, m.Index, "maqondo") ? m.Groups[1].Value : $"amaqondo {m.Groups[1].Value}")} {COMPASS[m.Groups[2].Value]}");
        var full12c = s;
        s = Rewrite(s, DEG_BARE, m =>
            SaidBefore(full12c, m.Index, "maqondo") ? m.Groups[1].Value : $"amaqondo {m.Groups[1].Value}");

        // 13) THE ENGLISH ORDINAL SUFFIX — redundant orthography beside the written Xhosa concord.
        s = Rewrite(s, ENG_ORDINAL, "$1");

        // 14) RELATIONAL AND ARITHMETIC SIGNS. A dropped sign is INAUDIBLE.
        s = Rewrite(s, EQUALS, " lilingana ne ");
        s = Rewrite(s, LESS, " ngaphantsi kuna ");
        s = Rewrite(s, GREATER, " ngaphezulu kuna ");
        s = Rewrite(s, TIMES, "$1 phindaphinda ");
        s = Rewrite(s, DIVIDE, " yahlula ");
        s = Rewrite(s, PLUS_INFIX, " plas ");
        s = Rewrite(s, PLUS_LEAD, "plas ");
        s = Rewrite(s, MINUS, "thabatha ");

        // 15) DECIMALS, LAST of the numeric rules.
        s = Rewrite(s, DEC_DOT, m => Spell(m.Groups[1].Value, m.Groups[2].Value));
        s = Rewrite(s, DEC_COMMA, m => Spell(m.Groups[1].Value, m.Groups[2].Value));

        // INITIALISMS LAST — every rule above owns capitals of its own.
        s = SpellNguniInitialisms(s);

        return Rewrite(Rewrite(s, RUN_OF_SPACES, " "), EDGE_SPACES, "");
    }
}
