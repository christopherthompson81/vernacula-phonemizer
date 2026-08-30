/**
 * Irish (ga) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/irish/normalize.ts — see that file for the corpus evidence behind every rule.
 *
 * ⚠ THE ORDINAL IS A NUMERAL PLUS `ú` (7ú, 11ú, 190ú), which unhandled reads as the bare vowel — `1ú` comes
 * out *ˈa hˈeːn̪ˠ ˈuː*.
 *
 * ⚠ THE CLOCK AND ERA MARKERS ARE IRISH ABBREVIATIONS, not English ones: `i.n.` / `r.n.` are iarnóin and
 * réamhnóin (p.m. / a.m.), `A.D.` is tar éis Chríost and `R.C.` roimh Chríost.
 *
 * ⚠ THE RATE DENOMINATORS ARE IRISH TOO: `km/u` is the Irish spelling of km/h (uair = hour), and `msu` is
 * míle san uair, i.e. mph.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Irish;

public static class Normalize
{
    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Irish letter names — the standard alphabet (a, bé, cé, dé, e, eif, gé, héis, í, jé, cá, eil, eim,
     *  ein, ó, pé, cú, ear, eas, té, ú, vé, wae, eics, yé, zae). */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "bé", ["c"] = "cé", ["d"] = "dé", ["e"] = "e", ["f"] = "eif", ["g"] = "gé",
        ["h"] = "héis", ["i"] = "í", ["j"] = "jé", ["k"] = "cá", ["l"] = "eil", ["m"] = "eim", ["n"] = "ein",
        ["o"] = "ó", ["p"] = "pé", ["q"] = "cú", ["r"] = "ear", ["s"] = "eas", ["t"] = "té", ["u"] = "ú",
        ["v"] = "vé", ["w"] = "wae", ["x"] = "eics", ["y"] = "yé", ["z"] = "zae",
    };

    /** Irish phonotactics, for the OOV rule in Core/Initialisms.cs (can this letter run be a word at all?). */
    public static readonly Func<string, bool> IsUnreadableIrish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouáéíóú]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bh", "ch", "dh", "fh", "gh", "mh", "ph", "sh", "th", "bhf", "gc", "bp", "dt", "nd",
            "mb", "ng", "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "sc", "sk",
            "sl", "sm", "sn", "sp", "st", "tr", "ts",
            "cn", "gn", "sr", "dl",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "b", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "x", "bh", "ch", "dh", "fh",
            "gh", "mh", "ph", "sh", "th", "cht", "rt", "rd", "st", "nd", "nc", "nt", "mp", "mb", "ng",
            "lth", "rth", "nn", "ll", "rr",
            "ht", "sc", "lt", "rb", "rm", "rp", "nm", "ns", "rc", "rg", "sk",
        }, StringComparer.Ordinal),
        // ONE phoneme each — see PhonotacticsData.Digraphs.
        Digraphs = new HashSet<string>(new[]
        {
            "bh", "ch", "dh", "fh", "gh", "mh", "ph", "sh", "th", "bhf", "dt", "gc", "nd", "mb", "ng", "ts",
        }, StringComparer.Ordinal),
    });

    /** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS = new HashSet<string>(new[]
    {
        "nato", "covid", "fifa", "opec", "unesco", "aids", "laser", "gaa", "rte", "ira", "nasa",
    }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(Js.ToLowerCase(l), out var v) ? v : null,
        AcronymLetters = new HashSet<string>(new[]
        {
            // broadcasters and orgs said as letters
            "bbc", "cnn", "cbs", "nbc", "rté", "itv", "csi", "fbi", "cia", "nsa", "faa", "nhk",
            // codes
            "xdr-tb", "h5n1", "a1gp", "pstn", "dna", "hiv", "dvd", "cd", "tv", "pc", "pdf", "gps",
            "mri", "ms", "ir",
        }, StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = w => IsUnreadableIrish(w),
    });

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE IRISH ORDINAL
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Ordinal words 1–10, WITHOUT the article — the corpus supplies its own ("an 15ú haois", "sa 10ú haois").
     *
     * ELEVEN IS `aonú`, NOT `chéad`: the corpus writes "san aonú háit déag", and `chéad` is only ever the
     * standalone first. So the teens take their own unit series, where 1 → aonú.
     */
    private static readonly IReadOnlyDictionary<int, string> ORD_1_10 = new Dictionary<int, string>
    {
        [1] = "chéad", [2] = "dara", [3] = "tríú", [4] = "ceathrú", [5] = "cúigiú",
        [6] = "séú", [7] = "seachtú", [8] = "ochtú", [9] = "naoú", [10] = "deichiú",
    };

    /**
     * The unit series used INSIDE a compound (teens and 21+): 1 is `aonú`, not `chéad`, and 2 is `dóú`, not
     * `dara`. Stated as an inference, not an attestation — see the TypeScript.
     */
    private static readonly IReadOnlyDictionary<int, string> ORD_UNIT_IN_COMPOUND = BuildUnitInCompound();

    private static Dictionary<int, string> BuildUnitInCompound()
    {
        var d = ORD_1_10.ToDictionary(kv => kv.Key, kv => kv.Value);
        d[1] = "aonú";
        d[2] = "dóú";
        return d;
    }

    /** Words that are NOT the noun a compound ordinal encloses — the corpus writes a LIST ("sna 11ú, 12ú agus
     *  13ú haoiseanna"), and pulling the next token inside gave *dara agus déag*. */
    private static readonly IReadOnlySet<string> NOT_A_NOUN = new HashSet<string>(new[]
    {
        "agus", "is", "nó", "ná", "ach", "mar", "féin", "seo", "sin", "siúd",
        "a", "an", "na", "ag", "ar", "as", "chun", "de", "do", "faoi", "go", "i", "in", "le", "ó", "roimh",
        "sa", "san", "sna", "tar", "thar", "um",
    }, StringComparer.Ordinal);

    /** The ordinal of a CARDINAL WORD when it ends a compound (from Numbers.cs's emitted words). The counting
     *  series prefixes `h` to the vowel-initial aon/ocht (a haon, a hocht), so both forms are keyed. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_ORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["aon"] = "aonú", ["haon"] = "aonú", ["dó"] = "dara", ["trí"] = "tríú", ["ceathair"] = "ceathrú",
        ["cúig"] = "cúigiú", ["sé"] = "séú", ["seacht"] = "seachtú", ["ocht"] = "ochtú", ["hocht"] = "ochtú",
        ["naoi"] = "naoú", ["deich"] = "deichiú",
    };

    private static readonly IReadOnlyDictionary<string, string> TENS_ORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["fiche"] = "fichiú", ["tríocha"] = "tríochadú", ["daichead"] = "daicheadú", ["caoga"] = "caogadú",
        ["seasca"] = "seascadú", ["seachtó"] = "seachtódú", ["ochtó"] = "ochtódú", ["nócha"] = "nóchadú",
        ["céad"] = "céadú", ["chéad"] = "chéadú", ["míle"] = "míliú", ["milliún"] = "milliúna",
        ["billiún"] = "billiúna",
    };

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");
    private static readonly JsRe SPACE_RUN_U = JsRegex.Compile("\\s+", "gu");
    private static readonly JsRe VOWEL_INITIAL = JsRegex.Compile("^[aeiouáéíóú]", "u");

    /** Integer → the Irish ordinal (the corpus's `Nú` digit form). Below 10 the table; from 10 up the
     *  cardinal's last element takes the -ú ordinal ending. Anything outside the compositor's range → null. */
    public static string? OrdinalWords(double n, string noun = "")
    {
        if (!Numbers.IsSafeInteger(n) || n < 1 || n >= 1e12) return null;
        if (n <= 10) return ORD_1_10[(int)n];
        // THE NOUN GOES INSIDE A COMPOUND ORDINAL: Irish writes "an naoú haois déag", never *an naoú déag
        // haois* — the tens element follows the NOUN, so the caller hands the following word over.
        var tail = noun.Length == 0 ? "" : $"{noun} ";
        if (n < 20) return Js.Trim($"{ORD_UNIT_IN_COMPOUND[(int)n - 10]} {tail}déag");
        // 20+: a round ten is the stem + -ú (fiche → fichiú). A compound is the UNIT ordinal first and the
        // tens last, joined by "is" — "an t-aonú lá is fiche" (the 21st day).
        var card = Numbers.NumberToWords(n);
        if (card.Length == 0 || HAS_DIGIT.IsMatch(card)) return null;
        var words = card.Split(' ').Where(w => w != "a").ToList(); // the counting particle is not part of an ordinal
        if (words.Count == 1)
        {
            var only = TENS_ORD.TryGetValue(words[0], out var t0) ? t0
                : UNIT_ORD.TryGetValue(words[0], out var u0) ? u0 : null;
            return only is null ? null : $"{only}{(noun.Length == 0 ? "" : $" {noun}")}";
        }
        // A compound ending in a TENS word ordinalises IN PLACE and keeps its order — 190 is "céad nóchadú"
        // (hundred ninetieth), not *nóchadú is céad*. Only a UNIT-final compound takes the "is" inversion.
        var lastWord = words[^1];
        if (TENS_ORD.TryGetValue(lastWord, out var lastTens))
        {
            var head = string.Join(" ", words.Take(words.Count - 1).Append(lastTens));
            return noun.Length == 0 ? head : $"{head} {noun}";
        }
        var unit = UNIT_ORD.TryGetValue(lastWord, out var lu) ? lu : null;
        var tens = string.Join(" ", words.Take(words.Count - 1));
        if (unit is null || tens.Length == 0) return null;
        return Js.Trim(SPACE_RUN_U.Replace($"{unit} {tail}is {tens}", " "));
    }

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PATTERNS
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200B\\u200C\\u200D\\uFEFF]", "gu");
    private static readonly JsRe AD_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])A\\.D\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RC_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])R\\.C\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe AD_BEFORE = JsRegex.Compile("(?<![\\p{L}\\p{M}])AD(?=\\s*\\d+)", "giu");
    private static readonly JsRe AD_AFTER = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\d[\\d,]*\\s+AD(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe AD_INNER = JsRegex.Compile("AD", "giu");
    private static readonly JsRe BC_BEFORE = JsRegex.Compile("(?<![\\p{L}\\p{M}])BC(?=\\s*\\d+)", "giu");
    private static readonly JsRe BC_AFTER = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\d[\\d,]*\\s+BC(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe BC_INNER = JsRegex.Compile("BC", "giu");
    private static readonly JsRe NA_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])N\\.A\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe SA_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])S\\.A\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe SRL = JsRegex.Compile("(?<![\\p{L}\\p{M}])srl\\.?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe US_DOLLAR = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:US|uS)\\$(?=\\s?\\d)", "giu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \\u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOTTED_CAPS_MARKS = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe LONE_INITIAL_DOT = JsRegex.Compile("(?<=\\p{Lu})\\.(?=\\s+\\p{Lu})", "gu");
    private static readonly JsRe DR_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}])Dr\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe DR_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])Dr\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe ETC_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}])etc\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe ETC_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])etc\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe ORDINAL = JsRegex.Compile(
        "(\\ban )?(?<![\\d.,])(\\d[\\d,]*)ú(?![\\p{L}\\p{M}])([ \\u00a0]+([\\p{L}\\p{M}]+))?", "giu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe TZ_HYPHEN = JsRegex.Compile("(?<=\\p{L})[-–](?=\\d)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,])(\\d(?:[\\d,]*\\d)?)\\s*[-–]\\s*(\\d(?:[\\d,]*\\d)?)(?![\\d.])", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        "(?<![\\d:,])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])(?:\\s*(i\\.?n\\.?|r\\.?n\\.?|[Aa]\\.?[Mm]\\.?|[Pp]\\.?[Mm]\\.?))?", "giu");
    private static readonly JsRe AP_I = JsRegex.Compile("^i", "");
    private static readonly JsRe AP_R = JsRegex.Compile("^r", "");
    private static readonly JsRe AP_P = JsRegex.Compile("^p", "");
    private static readonly JsRe AP_A = JsRegex.Compile("^a", "");
    private static readonly JsRe GIGAHERTZ = JsRegex.Compile("(?<![\\d.,])(\\d+\\.\\d+)\\s?Ghz?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe VERSION_LETTER = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?=[a-z](?![\\p{L}\\p{M}]))", "giu");
    private static readonly JsRe DECIMAL_UNIT = JsRegex.Compile(
        "(?<![\\d.,])(\\d+)\\.(\\d+)\\s?(km|m|kg|mm|cm|msu|km\\/u)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DECIMAL_PLAIN = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d.])", "giu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile("(\\d+)¾", "gu");
    private static readonly JsRe ONE_HALF = JsRegex.Compile("(\\d+)½", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?[°º]\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?[°º]\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?[°º]\\s?([NSEW])(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?[°º](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RATE = JsRegex.Compile(
        "(?<!\\d)(\\d+)\\s?(km|m|kg|mm|cm)\\s*\\/\\s*(h|u)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MSU = JsRegex.Compile("(?<!\\d)(\\d+)\\s?msu(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{Nd}])[-−](\\d+)(?!\\s*[-\\d])", "gu");
    private static readonly JsRe AMP_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})&(\\p{Lu})(s?)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile("\\s&\\s", "gu");
    private static readonly JsRe AMP_TAIL = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})&(\\p{Lu})(\\p{Ll}+)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\S)\\s*÷\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(\\d)", "gu");
    private static readonly JsRe DECIMAL_PERCENT = JsRegex.Compile(
        "([\\p{L}\\p{M}\\d]+ pointe [\\p{L}\\p{M} ]+?)\\s*%\\s*(?![\\p{L}\\p{M}])", "gu");

    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "ciliméadar", ["m"] = "méadar", ["kg"] = "cileagram", ["mm"] = "milliméadar",
        ["cm"] = "ceintiméadar", ["msu"] = "míle san uair", ["km/u"] = "ciliméadar san uair",
    };
    private static readonly IReadOnlyDictionary<string, string> RATE_UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "ciliméadar", ["m"] = "méadar", ["kg"] = "cileagram", ["mm"] = "milliméadar",
        ["cm"] = "ceintiméadar",
    };
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "ó thuaidh", ["S"] = "ó dheas", ["E"] = "soir", ["W"] = "siar",
    };

    /** The fraction digits of a decimal, read one at a time. */
    private static string SpellDigits(string f) =>
        string.Join(" ", Js.CodePoints(f).Select(d => Numbers.NumberToWords(Js.Number(d))));

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PASS
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Normalize one Irish input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
    public static string NormalizeIrish(string input)
    {
        var s = input;

        // 0) ZERO-WIDTH — the corpus has U+200B ZERO WIDTH SPACE ×18. Invisible, but they split tokens.
        s = Rewrite(s, ZERO_WIDTH, ""); // ZWSP, ZWNJ, ZWJ, BOM

        // 1) ERA MARKERS and MULTI-DOT ABBREVIATIONS — FIRST, before the dotted-capital rule: otherwise the
        //    interior dot becomes a break.
        //    ⚠ The INNER `Replace` calls are `JsRe.Replace`: their subject is the MATCHED RUN, not the
        //    pipeline string, so the seam is not declared for them.
        s = Rewrite(s, AD_DOTTED, "tar éis Chríost");
        s = Rewrite(s, RC_DOTTED, "roimh Chríost");
        s = Rewrite(s, AD_BEFORE, "tar éis Chríost");
        s = Rewrite(s, AD_AFTER, m => AD_INNER.Replace(m.Value, "tar éis Chríost"));
        s = Rewrite(s, BC_BEFORE, "roimh Chríost");
        s = Rewrite(s, BC_AFTER, m => BC_INNER.Replace(m.Value, "roimh Chríost"));
        s = Rewrite(s, NA_DOTTED, "Náisiúin Aontaithe");
        s = Rewrite(s, SA_DOTTED, "Stáit Aontaithe");
        // `srl.` is *agus araile* ("et cetera"). The dot is optional because FLEURS strips it.
        s = Rewrite(s, SRL, "agus araile");

        // 1b) CURRENCY PREFIXES — `US$14.7`. The `$` is REQUIRED so `US` alone does not expand.
        s = Rewrite(s, US_DOLLAR, "dollar na Stát Aontaithe ");

        // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
        s = Rewrite(s, DOTTED_CAPS, m => DOTTED_CAPS_MARKS.Replace(m.Value, "")); // space, NBSP
        //    ⚠ `\p{Lu}`, NOT `[A-Z]`. Here it is Irish's own fada'd ⟨Á É Í Ó Ú⟩ — and ⟨Ó⟩ is the surname
        //    particle. Measured before the fix: "S. Ó Riain" kept a dot that leaked as a clause break.
        s = Rewrite(s, LONE_INITIAL_DOT, "");

        // 3) SINGLE-DOT ABBREVIATIONS. `Dr.` → "dochtúir", `etc.` → "srl".
        s = Rewrite(s, DR_MID, "Dochtúir$1");
        s = Rewrite(s, DR_END, "Dochtúir.");
        s = Rewrite(s, ETC_MID, "srl$1");
        s = Rewrite(s, ETC_END, "srl.");

        // 4) ORDINALS — the `Nú` form. THE FOLLOWING NOUN is captured, because a compound ordinal encloses it,
        //    and the PRECEDING word is inspected: a vowel-initial ordinal takes the t- prefix after a bare
        //    "an" (an t-ochtú, an t-aonú). BEFORE the clock rule.
        s = Rewrite(s, ORDINAL, m =>
        {
            var art = m.Groups[1].Success ? m.Groups[1].Value : null;
            var d = m.Groups[2].Value;
            var spaced = m.Groups[3].Success ? m.Groups[3].Value : null;
            var noun = m.Groups[4].Success ? m.Groups[4].Value : null;
            var n = Js.Number(COMMAS.Replace(d, "")); // a matched group, not the pipeline string
            if (double.IsNaN(n) || double.IsInfinity(n) || n < 1) return m.Value;
            // A noun is only pulled INSIDE for the compounds that enclose one; elsewhere it stays put.
            var encloses = n > 10 && (n < 20 || n % 10 != 0)
                && (noun is null || !NOT_A_NOUN.Contains(Js.ToLowerCase(noun)));
            var ord = OrdinalWords(n, encloses ? noun ?? "" : "");
            if (ord is null) return m.Value;
            var tPrefix = art is not null && VOWEL_INITIAL.IsMatch(ord) ? "t-" : "";
            var head = $"{art ?? ""}{tPrefix}{ord}";
            return encloses && noun is not null ? head : $"{head}{spaced ?? ""}";
        });

        // 5a) THE TIMEZONE-OFFSET HYPHEN IS A SIGN, NOT A WORD HYPHEN — `UTC-08:00`, `GMT-0:44`. Settled
        //     HERE, before the clock rule turns the digits into WORDS and the hyphen becomes indistinguishable
        //     from a compound joint (`GMT-00:43` read *tʲˈeːn̪ˠɑːⁱdʲ*, one word).
        //     ⚠ Gated on a preceding LETTER and a following DIGIT: a hyphen between two letter runs is
        //     load-bearing elsewhere in the fleet, which is why this is not a shared rule.
        s = Rewrite(s, TZ_HYPHEN, " ");

        // 5) RANGES and SCORES — `10-60 nóiméad`, `6-6`. ⚠ EACH OPERAND MUST END ON A DIGIT, or in `1, -2`
        //    the left operand matches `1,` (the sentence comma) and a RANGE is read where the text has a
        //    negative number.
        s = Rewrite(s, RANGE, "$1 go dtí $2");

        // 6) CLOCK, in the COLON form. The i.n./r.n./p.m./a.m. marker expands to the Irish time-of-day. NOT a
        //    sports time: a THIRD `\d.\d\d` field (4:41.30) means a pace.
        s = Rewrite(s, CLOCK, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            var head = mv == 0
                ? Numbers.NumberToWords(hv)
                : $"{Numbers.NumberToWords(hv)} {Numbers.NumberToWords(mv)}";
            var apLower = Js.ToLowerCase(m.Groups[3].Success ? m.Groups[3].Value : "");
            var suffix = AP_I.IsMatch(apLower) ? " iarnóin"
                : AP_R.IsMatch(apLower) ? " réamhnóin"
                : AP_P.IsMatch(apLower) ? " iarnóin"
                : AP_A.IsMatch(apLower) ? " réamhnóin" : "";
            return $"{head}{suffix}";
        });

        // 7) VERSION DOTS and DOT DECIMALS. The dot is a DECIMAL (the corpus follows English; thousands use
        //    COMMAS). Read "pointe", the fraction digit-by-digit. GIGAHERTZ is claimed FIRST. AFTER the clock.
        s = Rewrite(s, GIGAHERTZ, "$1 gigahertz");
        // A VERSION LETTER after the fraction (802.11n) is a separate letter, not glued to the last digit.
        s = Rewrite(s, VERSION_LETTER, m => $"{m.Groups[1].Value} pointe {SpellDigits(m.Groups[2].Value)} ");
        // ⚠ THE UNIT MISS BRANCH IS REACHABLE, and the `!` in the TypeScript spoke the word "undefined": the
        // pattern is built from this table's own keys but carries `i`+`u`, so JS's fold widens it — `ſ`→`s`
        // reaches the `msu` key — and a near-miss matches while `mſu` is absent from the table. Refuse the
        // whole match, as gl/#1122 does. (Both engines were corrected together.)
        s = Rewrite(s, DECIMAL_UNIT, m =>
            UNIT_WORD.TryGetValue(Js.ToLowerCase(m.Groups[3].Value), out var uw)
                ? $"{m.Groups[1].Value} pointe {SpellDigits(m.Groups[2].Value)} {uw}"
                : m.Value);
        s = Rewrite(s, DECIMAL_PLAIN, m => $"{m.Groups[1].Value} pointe {SpellDigits(m.Groups[2].Value)}");

        // 7c) COMMA-DECIMALS — `12,5`. Corpus-absent (Irish follows English), but the comma must not LEAK as a
        //     clause pause. A comma followed by a THREE-digit group is thousands and stays for the TOKEN.
        s = Rewrite(s, DECIMAL_COMMA, m => $"{m.Groups[1].Value} pointe {SpellDigits(m.Groups[2].Value)}");

        // 8) FRACTIONS. `29¾ orlach` → *fiche a naoi agus trí cheathrú orlach*; `1/5 orlach` is "one fifth of
        //    an inch" → *an cúigiú orlach*.
        s = Rewrite(s, THREE_QUARTERS, "$1 agus trí cheathrú");
        s = Rewrite(s, ONE_HALF, "$1 agus leath");
        s = Rewrite(s, FRACTION, m =>
        {
            var ord = OrdinalWords(Js.Number(m.Groups[2].Value));
            if (ord is null) return m.Value;
            // THE ARTICLE BELONGS HERE, not in the ordinal table: a `Nú` digit is preceded by the corpus's own
            // article, but a FRACTION supplies its own, and a vowel-initial ordinal takes the t- prefix.
            var article = VOWEL_INITIAL.IsMatch(ord) ? "an t-" : "an ";
            // A unit fraction (1/N) is the ordinal noun; a non-unit fraction (M/N) is "M N-ú" (dhá chúigiú).
            var a = Js.Number(m.Groups[1].Value);
            return a == 1 ? $"{article}{ord}" : $"{Numbers.NumberToWords(a)} {ord}";
        });

        // 9) DEGREES. `30°C` came out as the bare consonant [k]; `35°W` is a LONGITUDE.
        s = Rewrite(s, DEG_C, "$1 céim Celsius");
        s = Rewrite(s, DEG_F, "$1 céim Fahrenheit");
        s = Rewrite(s, DEG_COMPASS, m => $"{m.Groups[1].Value} céim {COMPASS[JsUpper(m.Groups[2].Value)]}");
        s = Rewrite(s, DEG_BARE, "$1 céim");

        // 10) RATES — `70km/h`, `160km/u`, `35-40 msu`. AFTER the version-dot rule, BEFORE the tier.
        s = Rewrite(s, RATE, m =>
            $"{Numbers.NumberToWords(Js.Number(m.Groups[1].Value))} {RATE_UNIT[Js.ToLowerCase(m.Groups[2].Value)]} san uair");
        s = Rewrite(s, MSU, m => $"{Numbers.NumberToWords(Js.Number(m.Groups[1].Value))} míle san uair");

        // 11) SIGNS. ⚠ ± TAKES THE CONJUNCTION, unlike most of the fleet: `móide` and `lúide` are
        //     prepositional forms — "the more by", "the less by" — so juxtaposing them bare reads as two
        //     successive operations rather than one tolerance. Irish joins them with `nó`.
        s = Rewrite(s, PLUS_MINUS, " móide nó lúide ");
        s = Rewrite(s, PLUS, " móide ");
        // ⚠ U+2212 IS IN THE CLASS AND THE ASCII HYPHEN'S GUARDS ARE UNCHANGED. The MINUS SIGN is a distinct
        // code point whose only Unicode meaning is the arithmetic operator; the hyphen is the ambiguous one
        // and keeps every guard it had, so a range and a negative exponent are still refused.
        s = Rewrite(s, MINUS, "lúide $1");
        s = Rewrite(s, AMP_CAPS, m =>
            $"{LetterName(m.Groups[1].Value)} agus {LetterName(m.Groups[2].Value)}{m.Groups[3].Value}");
        s = Rewrite(s, AMP_SPACED, " agus ");
        // The corpus's `B&Banna` (B&B + the -anna plural): the & between two caps with a following vowel run.
        s = Rewrite(s, AMP_TAIL, m =>
            $"{LetterName(m.Groups[1].Value)} agus {LetterName(m.Groups[2].Value)}{m.Groups[3].Value}");
        s = Rewrite(s, EQUALS, "$1 ionann is $2");
        // THE DIVISION SIGN. Sourced from FLEURS's parallel aspect-ratio sentence — the Irish translator wrote
        // "roinnt ar a dó dhéag"; ga.wikipedia corroborates the same form.
        s = Rewrite(s, DIVIDE, "$1 roinnt ar $2");
        s = Rewrite(s, LESS_THAN, "$1 níos lú ná $2");
        s = Rewrite(s, GREATER_THAN, "$1 níos mó ná $2");
        s = Rewrite(s, TIMES, "$1 faoi $2");
        // A PERCENT after a DECIMAL — `3.5%`. The dot rule has converted the number to words by now, so the
        // tier's digit-adjacent % would miss it. The bare-digit `%` is the tier's.
        s = Rewrite(s, DECIMAL_PERCENT, "$1 faoin gcéad");

        // 12) INITIALISMS, LAST of the letter rules: after the era markers (else A.D. → *a. dé.*) and after
        //     the dotted-capital rule.
        s = NormalizeInitialisms(s);

        return s;
    }

    private static string LetterName(string c) =>
        LETTER_NAME.TryGetValue(Js.ToLowerCase(c), out var v) ? v : c;

    /** JS `String.prototype.toUpperCase` for the single ASCII-or-folding letters this file upper-cases. */
    private static string JsUpper(string s) => s.ToUpperInvariant();
}
