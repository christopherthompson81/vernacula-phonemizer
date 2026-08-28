/**
 * Czech (cs) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/czech/normalize.ts — see that file for the corpus evidence and for the
 * standing CASE limitation the ordinal rules trade against.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Czech;

public static class Normalize
{
    /** Regular, NBSP and narrow-NBSP — all three occur as thousands separators.
     *  ⚠ ESCAPED, NOT LITERAL: three of the four are invisible, and an editor that folded them to a plain
     *  space would silently narrow the class. */
    private const string GROUP_SPACE = "\u0020\u00a0\u202f\u2009";

    /**
     * Czech count-form selector for the local rules below and for Czech.cs's shared symbol tier.
     * 1 → 0 (sg), 2–4 → 1 (paucal, but never 12–14), else 2 (genitive plural). ⚠ NOT the shared Slavic
     * selector: a Czech compound ending in 1 takes the genitive plural where Russian keeps the singular.
     */
    public static int CsCountForm(double n)
    {
        if (n == 1) return 0;
        var m100 = Math.Abs(n) % 100;
        if (m100 >= 12 && m100 <= 14) return 2;
        var m10 = m100 % 10;
        return m10 >= 2 && m10 <= 4 ? 1 : 2;
    }

    /** Pick the count form of a counted noun written [sg, paucal, gen-pl]. */
    private static string Counted(double n, IReadOnlyList<string> forms) =>
        forms[Math.Min(CsCountForm(n), forms.Count - 1)];

    private static readonly JsRe FINAL_Y = JsRegex.Compile("ý$", "u");

    /**
     * Adjectival case forms of a masculine-nominative ordinal (první, druhý, třetí, dvacátý …).
     * ⚠ EVERY element of a compound inflects, not just the tail: sto dvacátý pátý → ve stu dvacátém pátém.
     */
    private static string InflectOrdinal(string masc, string c) =>
        string.Join(" ", masc.Split(' ').Select(w =>
        {
            if (w.EndsWith("í", StringComparison.Ordinal))
            {
                var soft = w[..^1]; // první/třetí keep the soft -i- (prvního, prvnímu)
                return soft + c switch
                {
                    "gen" => "ího", "loc" => "ím", "instr" => "ím", "plGen" => "ích",
                    "neutNom" => "í", "fem" => "í", "dat" => "ímu", _ => "",
                };
            }
            var stem = JsRegex.Replace(w, FINAL_Y, _ => ""); // druhý → druh|ý
            return stem + c switch
            {
                "gen" => "ého", "loc" => "ém", "instr" => "ým", "plGen" => "ých",
                "neutNom" => "é", "fem" => "á", "dat" => "ému", _ => "",
            };
        }));

    /** Czech letter names, for the initialism pass — USA is [ú es á], DVD [dé vé dé]. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "á", ["b"] = "bé", ["c"] = "cé", ["č"] = "čé", ["d"] = "dé", ["e"] = "é", ["f"] = "ef",
        ["g"] = "gé", ["h"] = "há", ["i"] = "í", ["j"] = "jé", ["k"] = "ká", ["l"] = "el", ["m"] = "em",
        ["n"] = "en", ["o"] = "ó", ["p"] = "pé", ["q"] = "kvé", ["r"] = "er", ["ř"] = "eř", ["s"] = "es",
        ["š"] = "eš", ["t"] = "té", ["u"] = "ú", ["v"] = "vé", ["w"] = "dvojité vé", ["x"] = "iks",
        ["y"] = "ypsilon", ["z"] = "zet", ["ž"] = "žet",
    };

    /** Czech phonotactics, for the OOV rule in core/initialisms.ts — generous on purpose; the work is done
     *  by the no-vowel test and the run/onset tests, not by cluster policing. */
    public static readonly Func<string, bool> IsUnreadableCzech = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouyáéíóúůýrl]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "bz", "čt", "čv", "čl", "čm", "čn", "čr", "dl", "dr", "dv", "gl", "gr", "gn",
            "kl", "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr", "ps", "pt", "rv", "sk", "sl",
            "sm", "sn", "sp", "st", "sv", "sw", "šk", "šl", "šm", "šn", "šp", "št", "šv", "tl", "tr", "tv",
            "vz", "vl", "vn", "vr", "zl", "zn", "zv", "žl", "žn",
            "js", "kd", "zd", "dn", "hr", "lz", "kt", "zh", "jd", "hm", "zb", "zk", "hl", "tm", "km",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "rk", "rt", "rd", "rb", "rs", "rn", "rl", "rm", "rv", "rž", "št", "st", "sk", "zd", "zl",
            "zn", "zm", "čt", "ck", "ct", "dn", "tn",
            "ch", "dl", "tl", "ng", "ns", "sm", "dm", "kt",
        }, StringComparer.Ordinal),
        Digraphs = new HashSet<string>(new[] { "ch", "dž", "dz", "ct" }, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms Czech spells out although the letters could be read as a word (czech.jsonc). */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /** Initialism pass. ⚠ ORDERING: must run AFTER the abbreviation rules, or `Co.` is spelled CEE-OH.
     *  Czech has no pronunciation dictionary (its g2p is rule-based), so `IsRecorded` is always false. */
    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableCzech,
    });

    public static string NormalizeCzechInitialisms(string text) => INITIALISMS(text);

    /** Multi-dot abbreviations — the ERA markers. ⚠ Claimed FIRST, or their interior dots survive as breaks. */
    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])př\\.\\s?n\\.\\s?l\\.?(?!\\p{L})", "giu"), "před naším letopočtem"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])n\\.\\s?l\\.?(?!\\p{L})", "giu"), "našeho letopočtu"),
    };

    /** Single-dot abbreviations → their expansion. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["tzv"] = "takzvaný", ["např"] = "například", ["atd"] = "a tak dále", ["apod"] = "a podobně",
        ["aj"] = "a jiné", ["tzn"] = "to znamená", ["tj"] = "to jest",
        ["dr"] = "doktor", ["jr"] = "junior", ["sv"] = "svatý", ["st"] = "svatý",
        ["co"] = "společnost", ["inc"] = "společnost", ["mil"] = "milionů", ["s"] = "strana",
        ["cca"] = "cirka",
    };
    // ⚠ `s` IS HELD OUT of the shared alternation and gets its own digit-guarded rule — see the TypeScript.
    private static readonly string DOTTED_ALT =
        string.Join("|", DOTTED.Keys.Where(k => k != "s").OrderByDescending(a => a.Length));

    private static readonly string[] HOUR = { "hodina", "hodiny", "hodin" };
    private static readonly string[] MINUTE = { "minuta", "minuty", "minut" };
    private static readonly string[] DEGREE = { "stupeň", "stupně", "stupňů" };

    private static readonly JsRe FEM_JEDEN = JsRegex.Compile("jeden$", "u");
    private static readonly JsRe FEM_DVA = JsRegex.Compile("dva$", "u");

    /** A numeral agreeing with a FEMININE counted noun — Czech marks gender on 1 and 2 only. */
    private static string Feminine(string words) =>
        JsRegex.Replace(JsRegex.Replace(words, FEM_JEDEN, _ => "jedna"), FEM_DVA, _ => "dvě");

    private static readonly JsRe ONLY_CLOSERS = JsRegex.Compile("^[\\s»)”\"']*$", "u");

    /**
     * Re-attach a sentence period that an abbreviation's dot was doing double duty for.
     * ⚠ THE TS TAKES `...rest` AND READS ITS LAST TWO ELEMENTS — how a JS replacer receives (…groups,
     * offset, wholeString) at any arity. C# hands the Match and the subject separately, so they are named.
     */
    private static string KeepFinal(string expansion, string matched, int offset, string whole) =>
        ONLY_CLOSERS.IsMatch(whole[(offset + matched.Length)..]) ? $"{expansion}." : expansion;

    private static readonly string[] ORD_1_19 =
    {
        "", "první", "druhý", "třetí", "čtvrtý", "pátý", "šestý", "sedmý", "osmý", "devátý",
        "desátý", "jedenáctý", "dvanáctý", "třináctý", "čtrnáctý", "patnáctý", "šestnáctý",
        "sedmnáctý", "osmnáctý", "devatenáctý",
    };
    private static readonly string[] ORD_TENS =
    {
        "", "", "dvacátý", "třicátý", "čtyřicátý", "padesátý", "šedesátý", "sedmdesátý",
        "osmdesátý", "devadesátý",
    };
    private static readonly string[] ORD_HUNDREDS =
    {
        "", "stý", "dvoustý", "třístý", "čtyřstý", "pětistý", "šestistý", "sedmistý",
        "osmistý", "devítistý",
    };

    /** Masculine-nominative ordinal for 1–999, or null out of range. */
    private static string? Ordinal(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n > 999) return null;
        if (n < 20) return ORD_1_19[(int)n];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            return ORD_TENS[(int)t] + (u != 0 ? $" {ORD_1_19[(int)u]}" : "");
        }
        double h = Math.Floor(n / 100), r = n % 100;
        return ORD_HUNDREDS[(int)h] + (r != 0 ? $" {Ordinal(r)}" : "");
    }

    /** The genitive (and the one dative) month-name forms the date rule reads. */
    private static readonly IReadOnlyDictionary<string, string> MONTH_RULE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ledna"] = "gen", ["února"] = "gen", ["března"] = "gen", ["dubna"] = "gen", ["května"] = "gen",
        ["června"] = "gen", ["července"] = "gen", ["srpna"] = "gen", ["září"] = "gen", ["října"] = "gen",
        ["listopadu"] = "gen", ["prosince"] = "gen", ["červenci"] = "dat",
    };
    private static readonly string MONTH_ALT = string.Join("|", MONTH_RULE.Keys.OrderByDescending(a => a.Length));

    // The step patterns, hoisted. JsRegex.Compile caches, so this is a readability choice, not a behaviour one.
    private static readonly JsRe DEGROUP = JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d\\.,])0)[{GROUP_SPACE}](?=\\d{{3}}(?!\\d))", "gu");
    private static readonly JsRe GROUP_SPACE_ANY = JsRegex.Compile($"[{GROUP_SPACE}]", "gu");
    private static readonly JsRe DOTTED_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}.])({DOTTED_ALT})\\.(\\s+)(?=[\\p{{L}}\\d(„\"])", "giu");
    private static readonly JsRe DOTTED_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}.])({DOTTED_ALT})\\.(?=\\s*(?:[,;:!?»)”]|$))", "giu");
    private static readonly JsRe PAGE_S = JsRegex.Compile("(?<![\\p{L}\\p{M}.])s\\.(\\s+)(?=\\d)", "giu");
    private static readonly JsRe CLOCK = JsRegex.Compile("([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!,\\d)(?:\\s+(?:h|hodin)(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe DATE_NN = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])(\\d{1,2})\\.\\s+(\\d{1,2})\\.(?=\\s*(?:do\\b|\\d{4}|[.,\\p{Ll}]|$))", "gu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile("(\\d)\\.(?=\\d)", "gu");
    private static readonly JsRe ORD_RANGE = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.])(\\d+)\\.\\s*[–—-]\\s*(\\d+)\\.(?![\\d])", "gu");
    private static readonly JsRe CENTURY = JsRegex.Compile("((?:\\d+\\.\\s*)(?:,\\s*\\d+\\.\\s*)*(?:\\s+a\\s+\\d+\\.\\s*)?)století(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe CENTURY_V = JsRegex.Compile("(?:v|ve)\\s+$", "iu");
    private static readonly JsRe CENTURY_ITEM = JsRegex.Compile("(\\d+)\\.", "gu");
    private static readonly JsRe DECADE = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d+)\\.\\s+(let|letech)(?!\\p{L})", "gu");
    private static readonly JsRe DATE_MONTH = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}\\d.,])(\\d+)\\.\\s+({MONTH_ALT})(?!\\p{{L}})", "gu");
    private static readonly JsRe PLACE_PAIR = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d+)\\.\\s+a\\s+(\\d+)\\.\\s+místě", "gu");
    private static readonly JsRe PLACE_LOC = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d+)\\.\\s+místě(?!\\p{L})", "gu");
    private static readonly JsRe PLACE_ACC = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d+)\\.\\s+místo(?!\\p{L})", "gu");
    private static readonly JsRe HOUR_ORD = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d+)\\.\\s+(hodin\\p{L}*)(?!\\p{L})", "gu");
    private static readonly JsRe ORDINAL_DOT = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d+)\\.(?=\\s*[,\\p{Ll}])", "gu");
    private static readonly JsRe REGNAL = JsRegex.Compile("(?<=\\p{Lu}\\p{Ll}+\\p{M}*[\u0020\u00a0])(\\d{1,2})\\.?(?=[\\s.,;:!?]|$)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s?[–—-]\\s?(?=\\d)", "gu");
    private static readonly JsRe MIL_H = JsRegex.Compile("(\\d+)\\s?mil\\s?\\/\\s?h(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d+)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d+)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)\\s?°", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−]\\s?(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s*[=≈]\\s*", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s*<\\s*", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s*>\\s*", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s*÷\\s*", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})\\/(\\d{1,3})(?![\\d.,])", "gu");
    private static readonly JsRe PH = JsRegex.Compile("(?<![\\p{L}\\p{M}])pH(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe GHZ = JsRegex.Compile("(?<![\\p{L}\\p{M}])Ghz(?![\\p{L}\\p{M}])", "giu");

    /** Normalize one Czech input string. Pure text→text; ordered, and each ordering coupling is stated in
     *  the TypeScript. */
    public static string NormalizeCzech(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, first — TWO passes, because the groups overlap on the shared digit.
        for (var i = 0; i < 2; i++)
            s = Rewrite(s, DEGROUP, "");
        s = Rewrite(s, GROUP_SPACE_ANY, _ => " ");

        // 1) MULTI-DOT ABBREVIATIONS (the era markers), before the single-dot rule.
        foreach (var (re, w) in MULTI_DOT)
        {
            var whole = s;
            s = Rewrite(s, re, m => KeepFinal(w, m.Value, m.Index, whole));
        }

        // 2) SINGLE-DOT ABBREVIATIONS. The dot is consumed so it cannot become a phrase break.
        s = Rewrite(s, DOTTED_MID, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122) — the pattern is built from this table's own keys but
            // carries `i`+`u`, so JS's fold widens it and a near-miss matches while its key is absent.
            DOTTED.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        s = Rewrite(s, DOTTED_END, m =>
            DOTTED.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}." : m.Value);
        s = Rewrite(s, PAGE_S, m => $"{DOTTED["s"]}{m.Groups[1].Value}");

        // 3) CLOCK. ⚠ Before any rule that looks for a bare number.
        s = Rewrite(s, CLOCK, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = $"{Feminine(CzechNumbers.NumberToWords(hv))} {Counted(hv, HOUR)}";
            return mv == 0 ? head : $"{head} {Feminine(CzechNumbers.NumberToWords(mv))} {Counted(mv, MINUTE)}";
        });

        // 4) DATE `N. N.`, before the version-dot rule, which would otherwise eat the interior dot.
        s = Rewrite(s, DATE_NN, m =>
        {
            double dv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (dv < 1 || dv > 31 || mv < 1 || mv > 12) return m.Value;
            return $"{InflectOrdinal(Ordinal(dv)!, "gen")} {InflectOrdinal(Ordinal(mv)!, "gen")} ";
        });

        // 5) VERSION / FIGURE DOTS between digits, before the ordinal rules.
        s = Rewrite(s, VERSION_DOT, "$1 tečka ");

        // 6) ORDINAL RANGE — `10.–11.` read as "až" (through).
        s = Rewrite(s, ORD_RANGE, m =>
        {
            var oa = Ordinal(Js.Number(m.Groups[1].Value));
            var ob = Ordinal(Js.Number(m.Groups[2].Value));
            if (oa is null || ob is null) return m.Value;
            return $"{oa} až {ob}";
        });

        // 7) CENTURY — an immediately-preceding v/ve governs the LOCATIVE, every other preposition the GENITIVE.
        var whole7 = s;
        s = Rewrite(s, CENTURY, m =>
        {
            var loc = CENTURY_V.IsMatch(whole7[..m.Index]);
            var c = loc ? "loc" : "gen";
            var list = JsRegex.Replace(m.Groups[1].Value, CENTURY_ITEM,
                mm => InflectOrdinal(Ordinal(Js.Number(mm.Groups[1].Value))!, c));
            return $"{list}století";
        });

        // 8) DECADE — `N. + let/letech` governs the genitive/locative PLURAL.
        s = Rewrite(s, DECADE, m =>
            $"{InflectOrdinal(Ordinal(Js.Number(m.Groups[1].Value))!, "plGen")} {m.Groups[2].Value}");

        // 9) DATE MONTHS — the month name is the case cue; červenci (after `k`) takes the dative.
        s = Rewrite(s, DATE_MONTH, m =>
            $"{InflectOrdinal(Ordinal(Js.Number(m.Groups[1].Value))!, MONTH_RULE[m.Groups[2].Value])} {m.Groups[2].Value}");

        // 10) PLACE — the compound first, then locative `místě` and neuter-accusative `místo`, then the one
        //     written-out hour ordinal (feminine locative, whose -é/-í ending neutNom already supplies).
        s = Rewrite(s, PLACE_PAIR, m =>
            $"{InflectOrdinal(Ordinal(Js.Number(m.Groups[1].Value))!, "loc")} a {InflectOrdinal(Ordinal(Js.Number(m.Groups[2].Value))!, "loc")} místě");
        s = Rewrite(s, PLACE_LOC, m => $"{InflectOrdinal(Ordinal(Js.Number(m.Groups[1].Value))!, "loc")} místě");
        s = Rewrite(s, PLACE_ACC, m => $"{InflectOrdinal(Ordinal(Js.Number(m.Groups[1].Value))!, "neutNom")} místo");
        s = Rewrite(s, HOUR_ORD, m =>
            $"{InflectOrdinal(Ordinal(Js.Number(m.Groups[1].Value))!, "neutNom")} {m.Groups[2].Value}");

        // 11) GENERAL ORDINAL — a following LOWERCASE word or comma → ordinal; uppercase or clause end →
        //     an ordinary sentence period, left alone.
        s = Rewrite(s, ORDINAL_DOT, m => Ordinal(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // 12) REGNAL ORDINALS — the digit after a capitalized NAME, guarded to ≤ 39 and a following break.
        s = Rewrite(s, REGNAL, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            var o = Ordinal(n);
            return o is null || n > 39 ? m.Value : o;
        });

        // 13) NUMERIC RANGES → "do". Digits on BOTH sides, so designations like `COVID-19` are untouched.
        s = Rewrite(s, RANGE, "$1 do ");

        // 14) RATE UNITS the shared tier cannot compose. AFTER the range rule.
        s = Rewrite(s, MIL_H, m => $"{m.Groups[1].Value} mil za hodinu");

        // 15) SIGNS. Degrees take the same three-way agreement.
        s = Rewrite(s, DEG_C, m => $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)} Celsia");
        s = Rewrite(s, DEG_F, m => $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)} Fahrenheita");
        s = Rewrite(s, DEG_BARE, m => $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)}");
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), not a `+`, so no `+` rule can ever match inside it.
        s = Rewrite(s, PLUSMINUS, _ => " plus mínus ");
        s = Rewrite(s, PLUS, "$1plus ");
        s = Rewrite(s, TIMES, "$1 krát ");
        s = Rewrite(s, MINUS, "$1mínus ");

        s = Rewrite(s, EQUALS, _ => " rovná se ");
        s = Rewrite(s, LESS_THAN, _ => " menší než ");
        s = Rewrite(s, GREATER_THAN, _ => " větší než ");
        s = Rewrite(s, DIVIDE, _ => " děleno ");
        s = Rewrite(s, AMPERSAND, _ => " a ");

        // 16) FRACTIONS — feminine, agreeing with the elided *část*.
        s = Rewrite(s, FRACTION, m =>
        {
            var den = Ordinal(Js.Number(m.Groups[2].Value));
            if (den is null || Js.Number(m.Groups[1].Value) != 1) return m.Value;
            return $"jedna {InflectOrdinal(den, "fem")}";
        });

        // 17) pH and Ghz — AFTER the version-dot rule, so "2.4Ghz" reads "dva tečka čtyři gigahertz".
        s = Rewrite(s, PH, _ => "pé há");
        s = Rewrite(s, GHZ, _ => "gigahertz");

        return s;
    }
}
