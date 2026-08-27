/**
 * Slovenian (sl) text normalization — the pre-tokenizer pass (era markers, abbreviations, the clock, the
 * licensed `N.` ordinals, ranges, degrees, fractions, the shared symbol tier at step 14, initialisms last).
 * Ported from src/languages/slovenian/normalize.ts — see that file for the corpus evidence and for the
 * ordering coupling stated at every step.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovenian;

public static class Normalize
{
    private static SlovenianNumbers N => Manifest.MANIFEST.Numbers;

    /** SLOVENE LETTER NAMES, for the initialism pass and for the `&`/glued-letter rules. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["a"] = "a", ["b"] = "be", ["c"] = "ce", ["č"] = "če", ["d"] = "de", ["e"] = "e",
            ["f"] = "fe", ["g"] = "ge", ["h"] = "he", ["i"] = "i", ["j"] = "je", ["k"] = "ke",
            ["l"] = "le", ["m"] = "me", ["n"] = "ne", ["o"] = "o", ["p"] = "pe", ["r"] = "re",
            ["s"] = "se", ["š"] = "še", ["t"] = "te", ["u"] = "u", ["v"] = "ve", ["z"] = "ze",
            ["ž"] = "že", ["q"] = "ku", ["w"] = "dvojni ve", ["x"] = "iks", ["y"] = "ipsilon",
            ["ć"] = "mehki če", ["đ"] = "dže",
        };

    private static string? LetterName(string l) => LETTER_NAME.TryGetValue(l, out var v) ? v : null;

    /** Slovene phonotactics, for the OOV rule in Core/Initialisms. */
    public static readonly Func<string, bool> IsUnreadableSlovenian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouy]", "u"),
        LegalOnsets = new HashSet<string>(StringComparer.Ordinal)
        {
            "bl", "br", "cv", "čl", "čr", "čv", "dl", "dr", "dv", "dž", "gl", "gn", "gr", "hl", "hm",
            "hr", "hv", "kl", "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr", "ps", "pt", "sk",
            "sl", "sm", "sn", "sp", "sr", "st", "sv", "sw", "šk", "šl", "šm", "šp", "št", "šv", "tl",
            "tr", "tv", "vl", "vn", "vr", "vz", "zb", "zd", "zg", "zl", "zm", "zn", "zr", "zv", "žl", "žr",
        },
        LegalCodas = new HashSet<string>(StringComparer.Ordinal)
        {
            "ck", "čn", "dn", "jn", "jt", "lc", "lk", "lm", "ln", "ls", "lt", "mp", "nc", "nd", "nk",
            "nt", "rd", "rk", "rn", "rs", "rt", "rž", "sk", "sm", "sn", "st", "šk", "št", "zd", "zm", "zn",
        },
    });

    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = LetterName,
        AcronymLetters = new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableSlovenian,
    });

    /** ORDERING: must run after the Roman-numeral/regnal rules and the abbreviation expansions. */
    public static string NormalizeSlovenianInitialisms(string text) => INITIALISMS(text);

    // -----------------------------------------------------------------------------------------------
    // COUNTED NOUNS — the four-way dual agreement
    // -----------------------------------------------------------------------------------------------

    private static IReadOnlyList<string> STOPINJA() => SlovenianPhonemizer.COUNTED["deg"].Forms;

    /** Pick the form of a five-slot counted noun for `n`. */
    private static string CountedForm(double n, IReadOnlyList<string> forms) =>
        forms[Math.Min(SlovenianPhonemizer.SlCountForm(n), forms.Count - 1)];

    // -----------------------------------------------------------------------------------------------
    // ORDINALS
    // -----------------------------------------------------------------------------------------------

    private static readonly string[] ORD_1_19 =
    {
        "", "prvi", "drugi", "tretji", "četrti", "peti", "šesti", "sedmi", "osmi", "deveti", "deseti",
        "enajsti", "dvanajsti", "trinajsti", "štirinajsti", "petnajsti", "šestnajsti", "sedemnajsti",
        "osemnajsti", "devetnajsti",
    };
    private static readonly string[] ORD_TENS =
    {
        "", "deseti", "dvajseti", "trideseti", "štirideseti", "petdeseti", "šestdeseti", "sedemdeseti",
        "osemdeseti", "devetdeseti",
    };
    private static readonly string[] ORD_HUNDREDS =
    {
        "", "stoti", "dvestoti", "tristoti", "štiristoti", "petstoti", "šeststoti", "sedemstoti",
        "osemstoti", "devetstoti",
    };

    /** Definite-adjective endings, [after a HARD stem, after a PALATAL one]. */
    private static readonly IReadOnlyDictionary<string, (string Hard, string Palatal)> ENDINGS =
        new Dictionary<string, (string, string)>(StringComparer.Ordinal)
        {
            ["m.nom"] = ("i", "i"),
            ["m.gen"] = ("ega", "ega"),
            ["m.dat"] = ("emu", "emu"),
            ["m.loc"] = ("em", "em"),
            ["m.instr"] = ("im", "im"),
            ["f.nom"] = ("a", "a"),
            ["f.gen"] = ("e", "e"),
            ["f.dat"] = ("i", "i"),
            ["f.acc"] = ("o", "o"),
            ["n.nom"] = ("o", "e"),
            ["n.gen"] = ("ega", "ega"),
            ["n.loc"] = ("em", "em"),
            ["n.instr"] = ("im", "im"),
            ["pl.nom"] = ("i", "i"),
            ["pl.gen"] = ("ih", "ih"),
        };

    private static readonly JsRe PALATAL_STEM = JsRegex.Compile("[jčžšc]$", "u");

    /** Integer → the masculine-nominative ordinal, composed as `Numbers` composes the cardinal. */
    public static string? OrdinalBase(double n)
    {
        if (double.IsNaN(n) || double.IsInfinity(n) || Math.Floor(n) != n || n < 1 || n >= 1_000_000) return null;
        if (n < 20) return ORD_1_19[(int)n];
        if (n < 100)
        {
            var t = (int)Math.Floor(n / 10);
            var u = (int)(n % 10);
            return u == 0 ? ORD_TENS[t] : $"{N.Units[u]}{N.And}{ORD_TENS[t]}";
        }
        if (n < 1000)
        {
            var r = n % 100;
            return r == 0
                ? ORD_HUNDREDS[(int)(n / 100)]
                : $"{N.Hundreds[(int)Math.Floor(n / 100)]} {OrdinalBase(r)}";
        }
        var rem = n % 1000;
        if (rem == 0)
        {
            var th = n / 1000;
            return th == 1 ? "tisoči" : $"{Numbers.NumberToWords(th)} tisoči";
        }
        return $"{Numbers.NumberToWords(n - rem)} {OrdinalBase(rem)}";
    }

    /** One ordinal (possibly a multi-word composition) → the requested slot; only the last word inflects. */
    public static string Inflect(string bas, string slot)
    {
        var words = bas.Split(' ');
        var last = words[^1];
        var stem = last[..^1];
        var e = ENDINGS[slot];
        words[^1] = stem + (PALATAL_STEM.IsMatch(stem) ? e.Palatal : e.Hard);
        return string.Join(" ", words);
    }

    /** Integer → the ordinal in one case slot, or null out of range. */
    public static string? OrdinalWords(double n, string slot)
    {
        var bas = OrdinalBase(n);
        return bas is null ? null : Inflect(bas, slot);
    }

    /** The licensing word after a bare `N.`, and the case it governs. ⚠ ORDERED — `LICENSOR_ALT` is built
     *  from these keys and the TS sort is STABLE over the object's insertion order. */
    private static readonly (string Word, string Slot)[] LICENSOR_ROWS =
    {
        ("stoletja", "n.gen"), ("stoletju", "n.loc"), ("stoletje", "n.nom"), ("stoletjem", "n.instr"),
        ("stoletij", "pl.gen"),
        ("letih", "pl.gen"), ("let", "pl.gen"), ("leta", "pl.nom"), ("leti", "pl.gen"),
        ("januarja", "m.gen"), ("februarja", "m.gen"), ("marca", "m.gen"), ("aprila", "m.gen"),
        ("maja", "m.gen"), ("junija", "m.gen"), ("julija", "m.gen"), ("avgusta", "m.gen"),
        ("septembra", "m.gen"), ("oktobra", "m.gen"), ("novembra", "m.gen"), ("decembra", "m.gen"),
        ("januar", "m.nom"), ("februar", "m.nom"), ("marec", "m.nom"), ("april", "m.nom"),
        ("maj", "m.nom"), ("junij", "m.nom"), ("julij", "m.nom"), ("avgust", "m.nom"),
        ("september", "m.nom"), ("oktober", "m.nom"), ("november", "m.nom"), ("december", "m.nom"),
        ("januarjem", "m.instr"), ("februarjem", "m.instr"), ("marcem", "m.instr"), ("aprilom", "m.instr"),
        ("majem", "m.instr"), ("junijem", "m.instr"), ("julijem", "m.instr"), ("avgustom", "m.instr"),
        ("septembrom", "m.instr"), ("oktobrom", "m.instr"), ("novembrom", "m.instr"), ("decembrom", "m.instr"),
        ("januarju", "m.loc"), ("februarju", "m.loc"), ("marcu", "m.loc"), ("aprilu", "m.loc"),
        ("maju", "m.loc"), ("juniju", "m.loc"), ("juliju", "m.loc"), ("avgustu", "m.loc"),
        ("septembru", "m.loc"), ("oktobru", "m.loc"), ("novembru", "m.loc"), ("decembru", "m.loc"),
        ("uri", "f.dat"), ("uro", "f.acc"), ("ure", "f.gen"), ("ura", "f.nom"),
        ("mesto", "n.nom"), ("mestu", "n.loc"), ("mesta", "n.gen"), ("mestom", "n.instr"),
        ("kategorije", "f.gen"), ("kategorija", "f.nom"), ("kategoriji", "f.dat"), ("kategorijo", "f.acc"),
        ("členom", "m.instr"), ("člen", "m.nom"), ("člena", "m.gen"), ("členu", "m.loc"),
        ("svetovno", "f.acc"), ("svetovni", "f.dat"), ("svetovna", "f.nom"), ("svetovne", "f.gen"),
        ("največja", "f.nom"), ("največji", "m.nom"), ("največje", "n.nom"), ("največjega", "m.gen"),
        ("znamka", "f.nom"), ("znamke", "f.gen"), ("znamko", "f.acc"),
        ("dne", "m.gen"), ("dan", "m.nom"), ("dneva", "m.gen"), ("dnevu", "m.loc"),
        ("vojske", "f.gen"), ("vojska", "f.nom"), ("vojski", "f.dat"), ("vojsko", "f.acc"),
        ("polk", "m.nom"), ("polka", "m.gen"), ("polku", "m.loc"),
    };

    private static readonly IReadOnlyDictionary<string, string> LICENSOR =
        LICENSOR_ROWS.ToDictionary(r => r.Word, r => r.Slot, StringComparer.Ordinal);

    // ⚠ `OrderByDescending` because JS `Array.prototype.sort` is STABLE — equal-length keys keep the
    // declaration order above, and the alternation's order decides which of two prefixes wins.
    private static readonly string LICENSOR_ALT =
        string.Join("|", LICENSOR_ROWS.Select(r => r.Word).OrderByDescending(k => k.Length));

    /** The case slot a following word governs when it is NOT in the closed list — read off the ENDING. */
    private static string SlotFromEnding(string word)
    {
        if (word.EndsWith("ega", StringComparison.Ordinal)) return "m.gen";
        if (word.EndsWith("ih", StringComparison.Ordinal)) return "pl.gen";
        return "m.nom";
    }

    // -----------------------------------------------------------------------------------------------
    // ABBREVIATIONS
    // -----------------------------------------------------------------------------------------------

    private static readonly JsRe AFTER_ALL_CLOSERS = JsRegex.Compile("^[\\s»)”\"'\\]]*$", "u");
    private static readonly JsRe AFTER_CAPITAL = JsRegex.Compile("^\\s+\\p{Lu}", "u");

    /** Re-attach a sentence period that an abbreviation's dot was doing double duty for. */
    private static string KeepFinal(string expansion, string matched, int offset, string whole)
    {
        var after = whole[(offset + matched.Length)..];
        if (AFTER_ALL_CLOSERS.IsMatch(after)) return expansion + ".";
        return AFTER_CAPITAL.IsMatch(after) ? expansion + "." : expansion;
    }

    /** MULTI-DOT abbreviations — the ERA MARKERS. ⚠ Claimed FIRST. */
    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])pr\\.\\s?n\\.\\s?(?:št|š)\\.?(?![\\p{L}\\p{M}])", "gu"), "pred našim štetjem"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])n\\.\\s?(?:št|š)\\.?(?![\\p{L}\\p{M}])", "gu"), "našega štetja"),
    };

    private static readonly (string Ab, string Word)[] DOTTED_ROWS =
    {
        ("itd", "in tako dalje"), ("npr", "na primer"), ("oz", "oziroma"), ("idr", "in drugo"),
        ("št", "številka"), ("ml", "mlajši"),
    };
    private static readonly IReadOnlyDictionary<string, string> DOTTED =
        DOTTED_ROWS.ToDictionary(r => r.Ab, r => r.Word, StringComparer.Ordinal);
    private static readonly string DOTTED_ALT =
        string.Join("|", DOTTED_ROWS.Select(r => r.Ab).OrderByDescending(k => k.Length));

    /** HONORIFICS — expanded ONLY before a capitalised word. */
    private static readonly IReadOnlyDictionary<string, string> HONORIFIC =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["dr"] = "doktor", ["g"] = "gospod", ["ga"] = "gospa" };

    // -----------------------------------------------------------------------------------------------
    // FRACTIONS
    // -----------------------------------------------------------------------------------------------

    private static readonly IReadOnlyDictionary<int, string[]> DENOMINATOR = new Dictionary<int, string[]>
    {
        [2] = new[] { "polovica", "polovici", "polovice", "polovic", "polovice" },
        [3] = new[] { "tretjina", "tretjini", "tretjine", "tretjin", "tretjine" },
        [4] = new[] { "četrtina", "četrtini", "četrtine", "četrtin", "četrtine" },
        [5] = new[] { "petina", "petini", "petine", "petin", "petine" },
        [6] = new[] { "šestina", "šestini", "šestine", "šestin", "šestine" },
        [7] = new[] { "sedmina", "sedmini", "sedmine", "sedmin", "sedmine" },
        [8] = new[] { "osmina", "osmini", "osmine", "osmin", "osmine" },
        [9] = new[] { "devetina", "devetini", "devetine", "devetin", "devetine" },
        [10] = new[] { "desetina", "desetini", "desetine", "desetin", "desetine" },
    };

    /** A numeral agreeing with a FEMININE head. */
    private static string FeminineNumeral(double n) =>
        N.CountForms.TryGetValue("f", out var f) && f.TryGetValue(Js.NumberToString(n), out var w)
            ? w
            : Numbers.NumberToWords(n);

    // -----------------------------------------------------------------------------------------------
    // THE CLOCK
    // -----------------------------------------------------------------------------------------------

    private static readonly IReadOnlyDictionary<string, string> URA =
        new Dictionary<string, string>(StringComparer.Ordinal)
        { ["f.nom"] = "ura", ["f.gen"] = "ure", ["f.dat"] = "uri", ["f.acc"] = "uro" };

    /** One clock → words: the hour as the ORDINAL that agrees with *ura*, the noun, the minutes cardinal. */
    private static string Clock(double hv, double mv, string slot)
    {
        var hasNoun = URA.TryGetValue(slot, out var noun);
        var ord = hv == 0 ? null : OrdinalWords(hv, slot);
        if (ord is null || !hasNoun)
            return mv == 0
                ? Numbers.NumberToWords(hv)
                : $"{Numbers.NumberToWords(hv)} {Numbers.NumberToWords(mv)}";
        return mv == 0 ? $"{ord} {noun}" : $"{ord} {noun} {Numbers.NumberToWords(mv)}";
    }

    private const string CLOCK_BODY = "([01]?\\d|2[0-3])[:.]([0-5]\\d)";
    private const string CLOCK_TAIL = "(?![\\d:])(?!\\.\\d)(?!,\\d)";
    private static readonly JsRe CLOCK_GOV = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(ob|po|okoli|okrog|od|do|med|pred)\\s+(?:[\\p{Ll}\\p{M}]+\\s+)?$", "iu");
    private static readonly IReadOnlyDictionary<string, string> GOV_SLOT =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["ob"] = "f.dat", ["po"] = "f.dat", ["okoli"] = "f.gen", ["okrog"] = "f.gen",
            ["od"] = "f.gen", ["do"] = "f.gen", ["med"] = "f.acc", ["pred"] = "f.acc",
        };

    private static string GovSlot(string whole, int offset)
    {
        var m = CLOCK_GOV.Match(whole[..offset]);
        if (!m.Success) return "f.nom";
        var gov = m.Groups[1].Value.ToLowerInvariant();
        return gov.Length > 0 && GOV_SLOT.TryGetValue(gov, out var s) ? s : "f.nom";
    }

    // -----------------------------------------------------------------------------------------------
    // THE RULES
    // -----------------------------------------------------------------------------------------------

    private static readonly JsRe DEGROUP_DOT =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe DEGROUP_SPACE =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[ \\u00a0\\u202f\\u2009](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe FOLD_SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");

    private static readonly JsRe DOTTED_MID = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}.])({DOTTED_ALT})\\.(\\s+)(?=[\\p{{L}}\\d(„\"»])", "giu");
    private static readonly JsRe DOTTED_END = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}.])({DOTTED_ALT})\\.(?=\\s*(?:[»)”\\]]\\s*)*$)", "giu");
    private static readonly JsRe DOTTED_ANY = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}.])({DOTTED_ALT})\\.(?![\\p{{L}}\\p{{M}}])", "giu");
    private static readonly JsRe HONORIFIC_RE =
        JsRegex.Compile("(?<![\\p{L}\\p{M}.])([Dd]r|[Gg]a|[Gg])\\.(\\s+)(?=\\p{Lu})", "gu");
    private static readonly JsRe ST_RE = JsRegex.Compile("(?<![\\p{L}\\p{M}.])(St)\\.(?=\\s+\\p{Lu})", "gu");
    private static readonly JsRe INC_RE = JsRegex.Compile("(?<![\\p{L}\\p{M}.])(Inc)\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe AL_RE = JsRegex.Compile("(?<=(?:et|Et)\\s)(al)\\.(?![\\p{L}\\p{M}])", "gu");

    private static readonly JsRe CLOCK_RE = JsRegex.Compile(
        $"(?<![\\d.,]){CLOCK_BODY}{CLOCK_TAIL}(?:\\s+(?:ure|uri|uro|ura)(?![\\p{{L}}\\p{{M}}]))?", "gu");
    private static readonly JsRe MILITARY_RE = JsRegex.Compile(
        "(?<![\\d.,:])([01]\\d|2[0-3])([0-5]\\d)(?![\\d.,:])(?=\\s*\\)?\\s*(?:po\\s+)?(?:UTC|GMT|CET|CEST)(?![\\p{L}\\p{M}]))",
        "gu");

    private static readonly JsRe VERSION_DOT = JsRegex.Compile("(\\d)\\.(?=\\d)", "gu");

    private static readonly JsRe SCORE_RE =
        JsRegex.Compile("(?<![\\d.,:–—-])(\\d{1,2})([:–—-])(\\d{1,2})(?![\\d:])(?!\\.\\d)(?!,\\d)", "gu");
    private static readonly JsRe SAID_PROTI = JsRegex.Compile("^\\s*proti(?![\\p{L}\\p{M}])", "u");
    private static readonly JsRe RANGE_RE =
        JsRegex.Compile("(?<![\\d.,])(\\d+(?:,\\d+)*)\\s?[–—-]\\s?(\\d+(?:,\\d+)*)(?![\\d.,])", "gu");

    private static readonly JsRe REGNAL_RE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])([Kk]ralj[\\p{L}\\p{M}]*|[Cc]esar[\\p{L}\\p{M}]*|[Pp]apež[\\p{L}\\p{M}]*|[Pp]oglavar[\\p{L}\\p{M}]*)"
        + "(\\s+(?:\\p{Lu}[\\p{L}\\p{M}]*\\s+){1,3})(\\d{1,2})(\\.?)(?![\\p{L}\\p{M}\\d,])", "gu");

    private static readonly JsRe LICENSED_RE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d.,])((?:\\d{1,4}\\.,?\\s+(?:in\\s+)?)*)"
        + $"(\\d{{1,4}})\\.\\s+((?:[\\p{{Ll}}\\p{{M}}]+\\s+)?)({LICENSOR_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe LIST_ITEM = JsRegex.Compile("(\\d{1,4})\\.(,?)", "gu");

    private static readonly JsRe GENERAL_ORD =
        JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d{1,4})\\.(?=\\s*[,]|\\s+[\\p{Ll}\\p{M}])", "gu");
    private static readonly JsRe FOLLOWER_WORD = JsRegex.Compile("^\\s+([\\p{Ll}\\p{M}]+)", "u");

    private static readonly JsRe SUFFIX_IH =
        JsRegex.Compile("(?<![\\d.,\\p{L}\\p{M}])(\\d{1,4})\\s?-\\s?ih(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[aeiou]$", "u");

    private static readonly JsRe HYPHEN_UNIT =
        JsRegex.Compile("(\\d)-(?=(?:km|mm|cm|kg|m)(?![\\p{L}\\p{M}]))", "gu");

    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d+(?:,\\d+)?)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d+(?:,\\d+)?)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+(?:,\\d+)?)\\s?°", "gu");

    private static readonly JsRe TIMES_RE = JsRegex.Compile("(?<=\\d)\\s?[x×]\\s?(?=\\d)", "gu");

    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe LEAD_PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe LEAD_MINUS = JsRegex.Compile("(^|[\\s(])[-−]\\s?(?=\\d)", "gu");
    private static readonly JsRe TZ_PLUS = JsRegex.Compile("(?<=\\p{Lu})\\+(?=\\d)", "gu");

    private static readonly JsRe NUM_COMPOUND = JsRegex.Compile("(?<![\\d.,-])(\\d+)-(\\p{Ll}{4,})", "gu");

    private static readonly JsRe MILJ_RATE =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])milj\\s?\\/\\s?(?:uro|h)(?![\\p{L}\\p{M}])", "giu");

    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<=\\d),(\\d+)", "gu");
    private static readonly JsRe LEADING_ZEROS = JsRegex.Compile("^0*", "u");

    private static readonly JsRe MIXED_FRAC =
        JsRegex.Compile("(?<![\\d.,\\/])(\\d+)\\s+(\\d{1,3})\\/(\\d{1,2})(?![\\d.,\\/])", "gu");
    private static readonly JsRe BARE_FRAC =
        JsRegex.Compile("(?<![\\d.,\\/])(\\d{1,3})\\/(\\d{1,2})(?![\\d.,\\/])", "gu");
    private static readonly JsRe VULGAR_34 = JsRegex.Compile("(\\d+)¾", "gu");
    private static readonly JsRe VULGAR_12 = JsRegex.Compile("(\\d+)½", "gu");
    private static readonly JsRe VULGAR_14 = JsRegex.Compile("(\\d+)¼", "gu");

    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s*=\\s*", "gu");
    private static readonly JsRe LESS_RE = JsRegex.Compile("(\\d)\\s*<\\s*(?=\\d)", "gu");
    private static readonly JsRe MORE_RE = JsRegex.Compile("(\\d)\\s*>\\s*(?=\\d)", "gu");
    private static readonly JsRe AMPERSAND_LETTERS =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})\\s*[&＆]\\s*(\\p{Lu})(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe SL_VOICELESS = JsRegex.Compile("^[ptksšcčfh]", "u");
    private static readonly JsRe DIVIDE_RE = JsRegex.Compile("(\\d+)\\s?÷\\s?(\\d+)", "gu");
    private static readonly JsRe AMPERSAND_RE = JsRegex.Compile("\\s*[&＆]\\s*", "gu");

    private static readonly JsRe GLUED_LETTER = JsRegex.Compile("(?<=\\d)(\\p{L})(?![\\p{L}\\p{M}])", "gu");

    private static readonly JsRe ESC_RE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");

    /** Normalize one Slovenian input string. Pure text→text, a numbered sequence of order-dependent steps. */
    public static string NormalizeSlovenian(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, FIRST. Two passes, because groups overlap on the shared digit.
        for (var i = 0; i < 2; i++) s = DEGROUP_DOT.Replace(s, _ => "");
        for (var i = 0; i < 2; i++) s = DEGROUP_SPACE.Replace(s, _ => "");
        s = FOLD_SPACES.Replace(s, _ => " ");

        // 1) MULTI-DOT ERA MARKERS, before the single-dot rule.
        foreach (var (re, w) in MULTI_DOT)
        {
            // `whole` is the string THIS replace was handed — the JS callback's last argument.
            var whole = s;
            s = re.Replace(s, m => KeepFinal(w, m.Value, m.Index, whole));
        }

        // 2) SINGLE-DOT ABBREVIATIONS.
        s = DOTTED_MID.Replace(s, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122) — the pattern is built from this table's own keys but
            // carries `i`+`u`, so JS's fold widens it and a near-miss matches while its key is absent.
            DOTTED.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        s = DOTTED_END.Replace(s, m =>
            DOTTED.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}." : m.Value);
        s = DOTTED_ANY.Replace(s, m =>
            DOTTED.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? w : m.Value);
        s = HONORIFIC_RE.Replace(s, m =>
            HONORIFIC.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        s = ST_RE.Replace(s, m => m.Groups[1].Value);
        s = INC_RE.Replace(s, m => m.Groups[1].Value);
        s = AL_RE.Replace(s, m => m.Groups[1].Value);

        // 3) CLOCK, before the version-dot rule.
        {
            var whole = s;
            s = CLOCK_RE.Replace(s, m =>
                Clock(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value), GovSlot(whole, m.Index)));
        }
        {
            var whole = s;
            s = MILITARY_RE.Replace(s, m =>
                Clock(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value), GovSlot(whole, m.Index)));
        }

        // 4) VERSION / FIGURE DOTS between digits.
        s = VERSION_DOT.Replace(s, m => $"{m.Groups[1].Value} pika ");

        // 5a) SCORES AND RATIOS, before the range rule.
        {
            var whole = s;
            s = SCORE_RE.Replace(s, m =>
            {
                var a = m.Groups[1].Value;
                var mark = m.Groups[2].Value;
                var b = m.Groups[3].Value;
                if (mark != ":" && Js.Number(b) > Js.Number(a)) return m.Value; // a real range — step 5b owns it
                var said = SAID_PROTI.IsMatch(whole[(m.Index + m.Length)..]);
                return said ? $"{a} {b}" : $"{a} proti {b}";
            });
        }

        // 5b) NUMERIC RANGES, read as "do".
        s = RANGE_RE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return a.Length == 4 && b.Length <= 2 ? m.Value : $"{a} do {b}";
        });

        // 6a) REGNAL ORDINALS.
        {
            var whole = s;
            s = REGNAL_RE.Replace(s, m =>
            {
                var title = m.Groups[1].Value;
                var names = m.Groups[2].Value;
                var digits = m.Groups[3].Value;
                var dot = m.Groups[4].Value;
                var t = title.ToLowerInvariant();
                var slot =
                    t.EndsWith("ica", StringComparison.Ordinal) ? "f.nom"
                    : t.EndsWith("ice", StringComparison.Ordinal) ? "f.gen"
                    : t.EndsWith("ico", StringComparison.Ordinal) ? "f.acc"
                    : t.EndsWith("ici", StringComparison.Ordinal) ? "f.dat"
                    : t.EndsWith("a", StringComparison.Ordinal) ? "m.gen"
                    : t.EndsWith("u", StringComparison.Ordinal) ? "m.loc"
                    : "m.nom";
                var ord = OrdinalWords(Js.Number(digits), slot);
                if (ord is null) return m.Value;
                var body = $"{title}{names}{ord}";
                return dot == "" ? body : KeepFinal(body, m.Value, m.Index, whole);
            });
        }

        // 6b) LICENSED ORDINALS.
        s = LICENSED_RE.Replace(s, m =>
        {
            var list = m.Groups[1].Value;
            var digits = m.Groups[2].Value;
            var mid = m.Groups[3].Value;
            var head = m.Groups[4].Value;
            var slot = LICENSOR[head];
            var tail = OrdinalWords(Js.Number(digits), slot);
            if (tail is null) return m.Value;
            var pre = LIST_ITEM.Replace(list, w =>
                $"{OrdinalWords(Js.Number(w.Groups[1].Value), slot) ?? w.Value}{w.Groups[2].Value}");
            return $"{pre}{tail} {mid}{head}";
        });

        // 6c) GENERAL ORDINAL.
        {
            var whole = s;
            s = GENERAL_ORD.Replace(s, m =>
            {
                var fw = FOLLOWER_WORD.Match(whole[(m.Index + m.Length)..]);
                var word = fw.Success ? fw.Groups[1].Value : null;
                return OrdinalWords(Js.Number(m.Groups[1].Value), word is null ? "m.nom" : SlotFromEnding(word))
                       ?? m.Value;
            });
        }

        // 7) NUMERAL + HYPHEN + `-ih`.
        s = SUFFIX_IH.Replace(s, m =>
        {
            var digits = m.Groups[1].Value;
            var words = Numbers.NumberToWords(Js.Number(digits), digits);
            return ENDS_VOWEL.IsMatch(words) ? m.Value : words + "ih";
        });

        // 8) HYPHEN BEFORE A UNIT ABBREVIATION.
        s = HYPHEN_UNIT.Replace(s, m => $"{m.Groups[1].Value} ");

        // 9) DEGREES, before the shared tier and before the `+` rule.
        s = DEG_C.Replace(s, m => $"{m.Groups[1].Value} {CountedForm(NumOf(m.Groups[1].Value), STOPINJA())} Celzija");
        s = DEG_F.Replace(s, m => $"{m.Groups[1].Value} {CountedForm(NumOf(m.Groups[1].Value), STOPINJA())} Fahrenheita");
        s = DEG_BARE.Replace(s, m => $"{m.Groups[1].Value} {CountedForm(NumOf(m.Groups[1].Value), STOPINJA())}");

        // 10) `x`/`×` between digits → *krat*.
        s = TIMES_RE.Replace(s, _ => " krat ");

        // 11) A LEADING `+`/`−` on a number.
        s = PLUSMINUS.Replace(s, _ => " plus minus ");
        s = LEAD_PLUS.Replace(s, m => $"{m.Groups[1].Value}plus ");
        s = LEAD_MINUS.Replace(s, m => $"{m.Groups[1].Value}minus ");
        s = TZ_PLUS.Replace(s, _ => " plus ");

        // 11z) NUMERAL-INITIAL COMPOUNDS.
        s = NUM_COMPOUND.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            var tail = m.Groups[2].Value;
            var v = Js.Number(n);
            if (!(Math.Floor(v) == v && Math.Abs(v) <= 9007199254740991d)) return m.Value;
            var words = Numbers.NumberToWords(v);
            var cut = words.LastIndexOf(' ');
            return cut < 0 ? words + tail : $"{words[..cut]} {words[(cut + 1)..]}{tail}";
        });

        // 12) THE SPELLED-OUT MILE RATE.
        s = MILJ_RATE.Replace(s, _ => "milj na uro");

        // 14) THE SHARED SYMBOL TIER — %, currency, units, rates, exponents.
        s = SlovenianPhonemizer.SYMBOLS(s);

        // 15) THE COUNT NUMERAL'S GENDER — only doable AFTER the tier.
        foreach (var (_, c) in SlovenianPhonemizer.COUNTED_ORDER)
        {
            var sg = c.Forms[0];
            var dual = c.Forms[1];
            var paucal = c.Forms[2];
            if (c.G == "m")
            {
                s = JsRegex.Compile($"(?<![\\d.,])1 (?={Esc(sg)}(?![\\p{{L}}\\p{{M}}]))", "gu").Replace(s, _ => "en ");
                s = JsRegex.Compile($"(?<![\\d.,])(?<!do )3 (?={Esc(paucal)}(?![\\p{{L}}\\p{{M}}]))", "gu").Replace(s, _ => "trije ");
                s = JsRegex.Compile($"(?<![\\d.,])(?<!do )4 (?={Esc(paucal)}(?![\\p{{L}}\\p{{M}}]))", "gu").Replace(s, _ => "štirje ");
            }
            else
            {
                s = JsRegex.Compile($"(?<![\\d.,])2 (?={Esc(dual)}(?![\\p{{L}}\\p{{M}}]))", "gu").Replace(s, _ => "dve ");
            }
        }

        // 16) DECIMAL COMMA — AND THE FRACTIONAL PART'S LEADING ZEROS SURVIVE IT.
        s = DECIMAL_COMMA.Replace(s, m =>
        {
            var frac = m.Groups[1].Value;
            var zeros = LEADING_ZEROS.Match(frac).Length;
            return zeros == 0
                ? $" {N.DecimalWord} {frac}"
                : $" {N.DecimalWord} {string.Concat(Enumerable.Repeat("0 ", zeros))}{frac[zeros..]}";
        });

        // 17) FRACTIONS — the mixed form first, because `29 3/4` is one quantity.
        s = MIXED_FRAC.Replace(s, m =>
        {
            var f = Frac(m.Groups[2].Value, m.Groups[3].Value, "");
            return f == "" ? m.Value : $"{m.Groups[1].Value} in {f}";
        });
        s = BARE_FRAC.Replace(s, m => Frac(m.Groups[1].Value, m.Groups[2].Value, m.Value));
        s = VULGAR_34.Replace(s, m => $"{m.Groups[1].Value} in tri četrtine");
        s = VULGAR_12.Replace(s, m => $"{m.Groups[1].Value} in pol");
        s = VULGAR_14.Replace(s, m => $"{m.Groups[1].Value} in ena četrtina");

        // 18) RELATIONAL SIGNS and the AMPERSAND.
        s = EQUALS_RE.Replace(s, _ => " enako ");
        s = LESS_RE.Replace(s, m => $"{m.Groups[1].Value} je manjše od ");
        s = MORE_RE.Replace(s, m => $"{m.Groups[1].Value} je večje od ");
        s = AMPERSAND_LETTERS.Replace(s, m =>
        {
            var x = LetterName(m.Groups[1].Value.ToLowerInvariant());
            var y = LetterName(m.Groups[2].Value.ToLowerInvariant());
            return x is null || y is null ? m.Value : $"{x} in {y}";
        });
        s = DIVIDE_RE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            var y = Numbers.NumberToWords(Js.Number(b), b);
            return $"{Numbers.NumberToWords(Js.Number(a), a)} deljeno {(SL_VOICELESS.IsMatch(y) ? "s" : "z")} {y}";
        });

        s = AMPERSAND_RE.Replace(s, _ => " in ");

        // 19) A LONE LETTER GLUED TO A DIGIT RUN → its LETTER NAME.
        s = GLUED_LETTER.Replace(s, m =>
        {
            var name = LetterName(m.Groups[1].Value.ToLowerInvariant());
            return name is null ? m.Value : " " + name;
        });

        // 20) INITIALISMS, LAST.
        s = NormalizeSlovenianInitialisms(s);

        return s;
    }

    private static string Frac(string a, string b, string whole)
    {
        if (!DENOMINATOR.TryGetValue((int)Js.Number(b), out var forms)) return whole;
        if (Js.Number(a) == 1 && Js.Number(b) == 2) return "pol";
        return $"{FeminineNumeral(Js.Number(a))} {CountedForm(Js.Number(a), forms)}";
    }

    /** The VALUE of a Slovene-written number ("2,4" → 2.4), for the local agreement calls. */
    private static double NumOf(string n) => Js.Number(Js.ReplaceFirst(n, ",", "."));

    /** Escape a literal for embedding in a RegExp source. */
    private static string Esc(string t) => ESC_RE.Replace(t, m => "\\" + m.Value);
}
