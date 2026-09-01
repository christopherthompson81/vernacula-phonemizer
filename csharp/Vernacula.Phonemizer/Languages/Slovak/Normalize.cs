/**
 * Slovak (sk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/slovak/normalize.ts — see that file for the corpus evidence, the measured counts
 * behind every rule, and the standing `N.` disambiguation that is NOT Croatian's.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Slovak;

public static class Normalize
{
    /** Regular, NBSP and narrow-NBSP — the corpus uses NBSP both as a thousands separator and as an ordinary
     *  inter-word space, so it is folded to a plain space AFTER the de-grouping pass.
     *  ⚠ ESCAPED, NOT LITERAL: three of the four are invisible, and an editor that folded them to a plain
     *  space would silently narrow the class. */
    private const string GROUP_SPACE = " \u00a0\u202f\u2009";

    /**
     * Slovak's OWN count-form selector, and the one place Slovak parts from both the shared Slavic selector
     * and Czech: keyed on the WHOLE numeral, not the final digits. 1 → 0 (sg), exactly 2/3/4 → 1 (nominative
     * plural), everything else → 2 (genitive plural).
     */
    public static int SkCountForm(double n) =>
        n == 1 ? 0 : n == 2 || n == 3 || n == 4 ? 1 : 2;

    /** Pick the count form of a counted noun written [sg, paucal (2–4), gen-pl]. */
    private static string Counted(double n, IReadOnlyList<string> forms) =>
        forms[Math.Min(SkCountForm(n), 2)];

    /** Slovak letter names, for the initialism pass. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "á", ["á"] = "dlhé á", ["ä"] = "á prehlasované", ["b"] = "bé", ["c"] = "cé", ["č"] = "čé",
        ["d"] = "dé", ["ď"] = "ďé", ["e"] = "é", ["é"] = "dlhé é", ["f"] = "ef", ["g"] = "gé", ["h"] = "há",
        ["i"] = "í", ["í"] = "dlhé í", ["j"] = "jé", ["k"] = "ká", ["l"] = "el", ["ĺ"] = "dlhé el",
        ["ľ"] = "eľ", ["m"] = "em", ["n"] = "en", ["ň"] = "eň", ["o"] = "ó", ["ó"] = "dlhé ó",
        ["ô"] = "ó so vokáňom", ["p"] = "pé", ["q"] = "kvé", ["r"] = "er", ["ŕ"] = "dlhé er",
        ["s"] = "es", ["š"] = "eš", ["t"] = "té", ["ť"] = "ťé", ["u"] = "ú", ["ú"] = "dlhé ú",
        ["v"] = "vé", ["w"] = "dvojité vé", ["x"] = "iks", ["y"] = "ypsilon", ["ý"] = "dlhé ypsilon",
        ["z"] = "zet", ["ž"] = "žet",
    };

    /** Slovak phonotactics, for the OOV rule in core/initialisms.ts — generous on purpose; the work is done by
     *  the no-vowel test and the run/onset tests, not by cluster policing. */
    public static readonly Func<string, bool> IsUnreadableSlovak = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouyáäéíóôúý]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "bz", "čl", "čm", "čn", "čr", "čv", "dl", "dr", "dv", "dž", "gl", "gn", "gr",
            "hl", "hm", "hn", "hr", "hv", "kl", "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr",
            "ps", "pt", "sk", "sl", "sm", "sn", "sp", "st", "sv", "sw", "šk", "šl", "šm", "šn", "šp", "št",
            "šv", "tl", "tr", "tv", "vl", "vn", "vr", "vz", "zl", "zn", "zv", "žl", "žn",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ck", "ct", "čt", "dn", "lm", "rb", "rd", "rk", "rl", "rm", "rn", "rs", "rt", "rv", "rž",
            "sk", "st", "šť", "št", "tn", "zd", "zl", "zm", "zn",
        }, StringComparer.Ordinal),
    });

    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /** Initialism pass. ⚠ ORDERING: must run AFTER the abbreviation rules and the regnal rule — an all-caps
     *  run is what both look like. Slovak has no pronunciation dictionary, so `IsRecorded` is always false. */
    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableSlovak,
    });

    public static string NormalizeSlovakInitialisms(string text) => INITIALISMS(text);

    private static readonly string[] HODINA = { "hodina", "hodiny", "hodín" };
    private static readonly string[] MINUTA = { "minúta", "minúty", "minút" };
    private static readonly string[] STUPEN = { "stupeň", "stupne", "stupňov" };
    private static readonly string[] MILA = { "míľa", "míle", "míľ" };

    private static readonly JsRe FEM_JEDEN = JsRegex.Compile("jeden$", "u");
    private static readonly JsRe FEM_DVA = JsRegex.Compile("dva$", "u");

    /** A numeral agreeing with a FEMININE counted noun — Slovak marks gender on 1 and 2 only: jeden/jedna, dva/dve.
     *  ⚠ NOT ON THE SEAM: `words` is a freshly composed word, not the pipeline string. */
    private static string Feminine(string words) =>
        JsRegex.Replace(JsRegex.Replace(words, FEM_JEDEN, _ => "jedna"), FEM_DVA, _ => "dve");

    // ---------------------------------------------------------------------------------------------------
    // ORDINALS
    // ---------------------------------------------------------------------------------------------------

    /** Masculine-nominative ordinals 1–19. 5–19 end in SHORT -y (the rhythmic law forbids a long ending after
     *  a long syllable), and `InflectWord` keys the ending set off exactly that. */
    private static readonly string[] ORD_1_19 =
    {
        "", "prvý", "druhý", "tretí", "štvrtý", "piaty", "šiesty", "siedmy", "ôsmy", "deviaty",
        "desiaty", "jedenásty", "dvanásty", "trinásty", "štrnásty", "pätnásty", "šestnásty",
        "sedemnásty", "osemnásty", "devätnásty",
    };
    private static readonly string[] ORD_TENS =
    {
        "", "desiaty", "dvadsiaty", "tridsiaty", "štyridsiaty", "päťdesiaty", "šesťdesiaty",
        "sedemdesiaty", "osemdesiaty", "deväťdesiaty",
    };
    private static readonly string[] ORD_HUNDREDS =
    {
        "", "stý", "dvojstý", "trojstý", "štvorstý", "päťstý", "šesťstý", "sedemstý", "osemstý", "deväťstý",
    };

    /** Hard adjectival endings, [LONG after a short stem-final syllable, SHORT after a long one]. */
    private static readonly IReadOnlyDictionary<string, string[]> HARD = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["m.nom"] = new[] { "ý", "y" }, ["m.gen"] = new[] { "ého", "eho" }, ["m.dat"] = new[] { "ému", "emu" },
        ["m.loc"] = new[] { "om", "om" }, ["m.instr"] = new[] { "ým", "ym" },
        ["f.nom"] = new[] { "á", "a" }, ["f.gen"] = new[] { "ej", "ej" }, ["f.acc"] = new[] { "ú", "u" },
        ["f.instr"] = new[] { "ou", "ou" },
        ["n.nom"] = new[] { "é", "e" }, ["n.gen"] = new[] { "ého", "eho" }, ["n.loc"] = new[] { "om", "om" },
        ["n.instr"] = new[] { "ým", "ym" },
        ["pl.nom"] = new[] { "é", "e" }, ["pl.gen"] = new[] { "ých", "ych" },
    };

    /** `tretí` is the ONLY soft ordinal in 1–999 and its locative/feminine-instrumental palatalise the stem,
     *  so the forms are listed rather than derived. */
    private static readonly IReadOnlyDictionary<string, string> TRETI = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["m.nom"] = "tretí", ["m.gen"] = "tretieho", ["m.dat"] = "tretiemu", ["m.loc"] = "treťom", ["m.instr"] = "tretím",
        ["f.nom"] = "tretia", ["f.gen"] = "tretej", ["f.acc"] = "tretiu", ["f.instr"] = "treťou",
        ["n.nom"] = "tretie", ["n.gen"] = "tretieho", ["n.loc"] = "treťom", ["n.instr"] = "tretím",
        ["pl.nom"] = "tretie", ["pl.gen"] = "tretích",
    };

    /** One ordinal word → the requested slot. */
    private static string InflectWord(string w, string slot)
    {
        if (w == "tretí") return TRETI[slot];
        var longEnding = w.EndsWith("ý", StringComparison.Ordinal); // ý ⇒ long set; y ⇒ the rhythmically shortened one
        var e = HARD[slot];
        return w[..^1] + (longEnding ? e[0] : e[1]);
    }

    /** An ordinal split into the CARDINAL prefix (which does not inflect) and the ordinal words (which all do).
     *  Returns null for an exact thousand (1000, 2000 …), which needs *tisíci*. */
    private static (string Pre, string[] Ord)? OrdinalParts(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n >= 1_000_000) return null;
        if (n < 20) return ("", new[] { ORD_1_19[(int)n] });
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            return u == 0 ? ("", new[] { ORD_TENS[(int)t] }) : ("", new[] { ORD_TENS[(int)t], ORD_1_19[(int)u] });
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), rem = n % 100;
            if (rem == 0) return ("", new[] { ORD_HUNDREDS[(int)h] });
            var sub = OrdinalParts(rem)!.Value;
            return (SlovakNumbers.NumberToWords(h * 100), sub.Ord);
        }
        var r = n % 1000;
        if (r == 0) return null; // an exact thousand needs *tisíci*
        var tail = OrdinalParts(r)!.Value;
        return (SlovakNumbers.NumberToWords(n - r) + (tail.Pre == "" ? "" : $" {tail.Pre}"), tail.Ord);
    }

    /** Integer → the ordinal in one case slot, or null out of range. */
    public static string? OrdinalWords(double n, string slot)
    {
        var p = OrdinalParts(n);
        if (p is null) return null;
        var words = p.Value.Ord.Select(w => InflectWord(w, slot)).ToArray();
        return p.Value.Pre == "" ? string.Join(" ", words) : $"{p.Value.Pre} {string.Join(" ", words)}";
    }

    /** The licensing word after a bare `N.`, and the case it governs. */
    private static readonly IReadOnlyDictionary<string, string> LICENSOR = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        // century (neuter)
        ["storočia"] = "n.gen", ["storočí"] = "n.loc", ["storočím"] = "n.instr", ["storočie"] = "n.nom", ["storočiu"] = "n.loc",
        // month genitives after a day number
        ["januára"] = "m.gen", ["februára"] = "m.gen", ["marca"] = "m.gen", ["apríla"] = "m.gen", ["mája"] = "m.gen",
        ["júna"] = "m.gen", ["júla"] = "m.gen", ["augusta"] = "m.gen", ["septembra"] = "m.gen", ["októbra"] = "m.gen",
        ["novembra"] = "m.gen", ["decembra"] = "m.gen",
        // decades
        ["rokoch"] = "pl.gen", ["rokov"] = "pl.gen", ["roky"] = "pl.nom",
        // rank / place (neuter)
        ["mieste"] = "n.loc", ["miesto"] = "n.nom", ["miesta"] = "n.gen",
        // the remaining attested heads
        ["kategórie"] = "f.gen", ["kategória"] = "f.nom", ["kategórii"] = "f.gen",
        ["gólom"] = "m.instr", ["gól"] = "m.nom", ["gólu"] = "m.gen",
        ["najväčším"] = "m.instr", ["najväčšou"] = "f.instr", ["najväčšia"] = "f.nom", ["najväčší"] = "m.nom",
        ["najväčšie"] = "n.nom",
        ["svetovej"] = "f.gen", ["svetová"] = "f.nom", ["svetovú"] = "f.acc", ["svetovou"] = "f.instr",
        ["typu"] = "m.gen", ["typ"] = "m.nom", ["typom"] = "m.instr",
    };
    private static readonly string LICENSOR_ALT = string.Join("|", LICENSOR.Keys.OrderByDescending(a => a.Length));

    // ---------------------------------------------------------------------------------------------------
    // ABBREVIATIONS
    // ---------------------------------------------------------------------------------------------------

    private static readonly JsRe ONLY_CLOSERS = JsRegex.Compile("^[\\s»)”\"'\\]]*$", "u");
    private static readonly JsRe CAPS_AFTER = JsRegex.Compile("^\\s+\\p{Lu}", "u");

    /**
     * Re-attach a sentence period that an abbreviation's dot was doing double duty for: either the utterance
     * ends there, or it runs on into a NEW (capitalised) sentence. ⚠ THE TS READS THE LAST TWO ELEMENTS of the
     * replacer's (...groups, offset, wholeString) rest; C# hands the Match and the subject separately.
     */
    private static string KeepFinal(string expansion, string matched, int offset, string whole)
    {
        var after = whole[(offset + matched.Length)..];
        if (ONLY_CLOSERS.IsMatch(after)) return $"{expansion}.";
        return CAPS_AFTER.IsMatch(after) ? $"{expansion}." : expansion;
    }

    /** MULTI-DOT abbreviations — the ERA markers and `n. m.`. ⚠ Claimed FIRST, or their interior dots survive
     *  as breaks. `pred n. l.` is matched before the bare `n. l.` so the preposition is read into the
     *  instrumental. */
    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])p\\.\\s?n\\.\\s?l\\.?(?![\\p{L}\\p{M}])", "giu"), "pred naším letopočtom"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])pred\\s+n\\.\\s?l\\.?(?![\\p{L}\\p{M}])", "giu"), "pred naším letopočtom"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])n\\.\\s?l\\.?(?![\\p{L}\\p{M}])", "giu"), "nášho letopočtu"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])n\\.\\s?m\\.?(?![\\p{L}\\p{M}])", "giu"), "nad morom"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])t\\.\\s?j\\.?(?![\\p{L}\\p{M}])", "giu"), "to jest"),
    };

    /** SINGLE-DOT abbreviations → their expansion. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["tzv"] = "takzvaný", ["atď"] = "a tak ďalej", ["napr"] = "napríklad", ["č"] = "číslo",
        ["dr"] = "doktor", ["jr"] = "junior",
    };
    private static readonly string DOTTED_ALT = string.Join("|", DOTTED.Keys.OrderByDescending(a => a.Length));

    private static readonly JsRe DOTTED_MID =
        JsRegex.Compile("(?<![\\p{L}\\p{M}.])(" + DOTTED_ALT + ")\\.(\\s+)(?=[\\p{L}\\d(„\"])", "giu");
    private static readonly JsRe DOTTED_END =
        JsRegex.Compile("(?<![\\p{L}\\p{M}.])(" + DOTTED_ALT + ")\\.(?=\\s*(?:[»)”\\]]\\s*)*$)", "giu");
    private static readonly JsRe DOTTED_BARE =
        JsRegex.Compile("(?<![\\p{L}\\p{M}.])(" + DOTTED_ALT + ")\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe ST_LOUIS = JsRegex.Compile("(?<![\\p{L}\\p{M}.])(St)\\.(?=\\s+\\p{Lu})", "gu");

    // ---------------------------------------------------------------------------------------------------
    // CLOCKS
    // ---------------------------------------------------------------------------------------------------

    /** A clock's hour, as the FEMININE ordinal that agrees with the elided *hodina*, or null for hour 0. */
    private static string? ClockHour(double h, string slot) => h == 0 ? null : OrdinalWords(h, slot);

    /** The neutral, ungoverned clock reading: cardinal + counted noun (`15:00` → pätnásť hodín). */
    private static string NeutralClock(double hv, double mv)
    {
        var head = $"{Feminine(SlovakNumbers.NumberToWords(hv))} {Counted(hv, HODINA)}";
        return mv == 0 ? head : $"{head} {Feminine(SlovakNumbers.NumberToWords(mv))} {Counted(mv, MINUTA)}";
    }

    /** One clock → words. `slot` is chosen by the GOVERNING PREPOSITION: o/do/po/od/pred/okolo take -ej,
     *  medzi takes -ou, nothing → the neutral cardinal + counted *hodín*. */
    private static string Clock(double hv, double mv, string? slot)
    {
        if (slot is null) return NeutralClock(hv, mv);
        var head = ClockHour(hv, slot);
        if (head is null) return NeutralClock(hv, mv);
        return mv == 0 ? head : $"{head} {SlovakNumbers.NumberToWords(mv)}";
    }

    private const string CLOCK_BODY = "([01]?\\d|2[0-3])[:.]([0-5]\\d)";
    private const string CLOCK_TAIL = "(?![\\d:])(?!\\.\\d)(?!,\\d)";

    private static readonly JsRe CLOCK_RANGE =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(medzi\\s+)" + CLOCK_BODY + "\\s*(?:[-–—]|a)\\s*" + CLOCK_BODY + CLOCK_TAIL, "giu");
    private static readonly JsRe CLOCK =
        JsRegex.Compile("(?<![\\d:.,])" + CLOCK_BODY + CLOCK_TAIL + "(?:\\s+(?:hod|h)(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe CLOCK_GOV =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:o|do|po|od|pred|okolo)\\s+$", "iu");

    // ---------------------------------------------------------------------------------------------------
    // STEP PATTERNS
    // ---------------------------------------------------------------------------------------------------

    private static readonly JsRe DEGROUP =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[" + GROUP_SPACE + "](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe GROUP_SPACE_ANY = JsRegex.Compile("[" + GROUP_SPACE + "]", "gu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile("(\\d)\\.(?=\\d)", "gu");
    private static readonly JsRe NUM_RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\s?[–—-]\\s?(\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe LIC_ITEM = JsRegex.Compile("(\\d{1,4})\\.(,?)", "gu");
    private static readonly JsRe LIC_ORD = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d.,])((?:\\d{1,4}\\.,?\\s+(?:a\\s+(?:[\\p{Ll}\\p{M}]+\\s+)?)?)*)"
        + "(\\d{1,4})\\.\\s+(" + LICENSOR_ALT + ")(?![\\p{L}\\p{M}])",
        "gu");
    private static readonly JsRe GEN_ORD = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d{1,4})\\.(?=\\s*[,\\p{Ll}])", "gu");
    private static readonly JsRe NAME_BEFORE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu}[\\p{L}\\p{M}]+)\\s+$", "u");
    private static readonly JsRe MIL_H = JsRegex.Compile("(\\d+)\\s?míľ\\s?\\/\\s?h(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MI_H = JsRegex.Compile("(\\d+)\\s?mi\\s?\\/\\s?h(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d+)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d+)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)\\s?°", "gu");
    private static readonly JsRe TIMES_X = JsRegex.Compile("(?<=\\d)\\s?[x×]\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−]\\s?(?=\\d)", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<=\\d),(?=\\d)", "gu");

    private static readonly IReadOnlyDictionary<int, string[]> DENOMINATOR = new Dictionary<int, string[]>
    {
        [2] = new[] { "polovica", "polovice", "polovíc" }, [3] = new[] { "tretina", "tretiny", "tretín" },
        [4] = new[] { "štvrtina", "štvrtiny", "štvrtín" }, [5] = new[] { "pätina", "pätiny", "pätín" },
        [6] = new[] { "šestina", "šestiny", "šestín" }, [7] = new[] { "sedmina", "sedminy", "sedmín" },
        [8] = new[] { "osmina", "osminy", "osmín" }, [9] = new[] { "devätina", "devätiny", "devätín" },
        [10] = new[] { "desatina", "desatiny", "desatín" },
    };
    private static readonly JsRe FRAC_34 = JsRegex.Compile("(\\d+)¾", "gu");
    private static readonly JsRe FRAC_12 = JsRegex.Compile("(\\d+)½", "gu");
    private static readonly JsRe FRAC_14 = JsRegex.Compile("(\\d+)¼", "gu");
    private static readonly JsRe FRAC_NN = JsRegex.Compile("(?<![\\d/.,])(\\d{1,3})\\/(\\d{1,2})(?![\\d/.,])", "gu");
    private static readonly JsRe APPROX = JsRegex.Compile("\\s*≈\\s*", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s*=\\s*", "gu");
    private static readonly JsRe LESS = JsRegex.Compile("\\s*<\\s*", "gu");
    private static readonly JsRe GREATER = JsRegex.Compile("\\s*>\\s*", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s*÷\\s*", "gu");
    private static readonly JsRe AMP_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})\\s*[&＆]\\s*(\\p{Lu})(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMP = JsRegex.Compile("\\s*[&＆]\\s*", "gu");

    /** Normalize one Slovak input string. Pure text→text; ordered, and each ordering coupling is stated in
     *  the TypeScript. */
    public static string NormalizeSlovak(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, FIRST — TWO passes, because the groups overlap on the shared digit.
        for (var i = 0; i < 2; i++)
            s = Rewrite(s, DEGROUP, "");
        s = Rewrite(s, GROUP_SPACE_ANY, " ");

        // 1) MULTI-DOT ABBREVIATIONS (era markers, `n. m.`, `t. j.`), before the single-dot rule.
        foreach (var item in MULTI_DOT)
        {
            var whole = s;
            s = Rewrite(s, item.Re, m => KeepFinal(item.Word, m.Value, m.Index, whole));
        }

        // 2) SINGLE-DOT ABBREVIATIONS. The dot is consumed so it cannot become a phrase break.
        s = Rewrite(s, DOTTED_MID, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122) — the pattern is built from this table's own keys but
            // carries `i`+`u`, so JS's fold can widen it; a near-miss that lacks a key is left alone.
            DOTTED.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        s = Rewrite(s, DOTTED_END, m =>
            DOTTED.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}." : m.Value);
        s = Rewrite(s, DOTTED_BARE, m =>
            DOTTED.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? w : m.Value);
        //    `St. Louis` — the DOT ONLY, with no expansion, and only before a capitalised word.
        s = Rewrite(s, ST_LOUIS, "$1");

        // 3) CLOCK RANGE, before the single clock (⚠ order by who needs WORDS first): `medzi` governs the
        //    instrumental on BOTH clocks, and the dash becomes the `a` the corpus writes.
        s = Rewrite(s, CLOCK_RANGE, m =>
            $"{m.Groups[1].Value}{Clock(Js.Number(m.Groups[2].Value), Js.Number(m.Groups[3].Value), "f.instr")} "
            + $"a {Clock(Js.Number(m.Groups[4].Value), Js.Number(m.Groups[5].Value), "f.instr")}");

        // 4) CLOCK. ⚠ Before any rule that looks for a bare number, and before the version-dot rule.
        var whole4 = s;
        s = Rewrite(whole4, CLOCK, m =>
        {
            var before = whole4[..m.Index];
            var governed = CLOCK_GOV.IsMatch(before);
            return Clock(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value), governed ? "f.gen" : null);
        });

        // 5) VERSION / FIGURE DOTS between digits — AFTER the clock, BEFORE the ordinal rules.
        s = Rewrite(s, VERSION_DOT, "$1 bodka ");

        // 6) NUMERIC RANGES → "do". Digits on BOTH sides so designations like `Il-76` are untouched;
        //    EQUAL ENDPOINTS ARE NOT A RANGE (a score).
        s = Rewrite(s, NUM_RANGE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return a == b ? m.Value : $"{a} do {b}";
        });

        // 7) LICENSED ORDINALS — inflected by the noun that follows. The LIST prefix handles `11., 12. a 13.`
        //    and every item takes the head noun's case.
        s = Rewrite(s, LIC_ORD, m =>
        {
            var slot = LICENSOR[m.Groups[3].Value];
            var tail = OrdinalWords(Js.Number(m.Groups[2].Value), slot);
            if (tail is null) return m.Value;
            // ⚠ ON A CAPTURE, NOT THE PIPELINE STRING — hence JsRegex.Replace, not the seam.
            var pre = JsRegex.Replace(m.Groups[1].Value, LIC_ITEM, mm =>
                (OrdinalWords(Js.Number(mm.Groups[1].Value), slot) ?? mm.Value) + mm.Groups[2].Value);
            return $"{pre}{tail} {m.Groups[3].Value}";
        });

        // 8) GENERAL ORDINAL — a `N.` followed by a LOWERCASE word or a COMMA is an ordinal; uppercase / quote /
        //    end is a SENTENCE PERIOD. Regnal: the agreement comes from the NAME's own ending, not the follower.
        var whole8 = s;
        s = Rewrite(whole8, GEN_ORD, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            var name = NAME_BEFORE.Match(whole8[..m.Index]);
            var nameStr = name.Success ? name.Groups[1].Value : null;
            var slot = (nameStr is null || n > 39) ? "m.nom"
                : nameStr.EndsWith("ho", StringComparison.Ordinal) ? "m.gen"
                    : nameStr.EndsWith("a", StringComparison.Ordinal) ? "f.nom"
                        : nameStr.EndsWith("y", StringComparison.Ordinal) ? "f.gen" : "m.nom";
            return OrdinalWords(n, slot) ?? m.Value;
        });

        // 9) MÍĽ RATE — `40 míľ/h` → the written genitive plural plus the denominator.
        s = Rewrite(s, MIL_H, m => $"{m.Groups[1].Value} míľ za hodinu");
        s = Rewrite(s, MI_H, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), MILA)} za hodinu");

        // 10) SIGNS that must be read BEFORE the shared tier. Degrees take the three-way agreement.
        s = Rewrite(s, DEG_C, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), STUPEN)} Celzia");
        s = Rewrite(s, DEG_F, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), STUPEN)} Fahrenheita");
        s = Rewrite(s, DEG_BARE, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), STUPEN)}");
        s = Rewrite(s, TIMES_X, " krát ");
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
        s = Rewrite(s, PLUSMINUS, " plus mínus ");
        s = Rewrite(s, PLUS, "$1plus ");
        s = Rewrite(s, MINUS, "$1mínus ");

        // 11) THE SHARED SYMBOL TIER — %, currency, units, rates, exponents. It must see the number still
        //     adjacent to its unit and still carrying its decimal comma.
        s = SlovakPhonemizer.Symbols(s);

        // 12) DECIMAL COMMA → the word.
        s = Rewrite(s, DECIMAL_COMMA, " čiarka ");

        // 13) FRACTIONS — composed from the denominator noun and a feminine numerator.
        s = Rewrite(s, FRAC_34, "$1 a tri štvrtiny");
        s = Rewrite(s, FRAC_12, "$1 a pol");
        s = Rewrite(s, FRAC_14, "$1 a štvrtina");
        s = Rewrite(s, FRAC_NN, m =>
        {
            if (!DENOMINATOR.TryGetValue((int)Js.Number(m.Groups[2].Value), out var forms)) return m.Value;
            return $"{Feminine(SlovakNumbers.NumberToWords(Js.Number(m.Groups[1].Value), m.Groups[1].Value))} "
                   + $"{Counted(Js.Number(m.Groups[1].Value), forms)}";
        });

        // 14) RELATIONAL SIGNS and the ampersand. The flanking letters are SPELLED when both are lone capitals.
        s = Rewrite(s, APPROX, " približne sa rovná ");
        s = Rewrite(s, EQUALS, " rovná sa ");
        s = Rewrite(s, LESS, " menší ako ");
        s = Rewrite(s, GREATER, " väčší ako ");
        s = Rewrite(s, DIVIDE, " delené ");
        s = Rewrite(s, AMP_CAPS, m =>
        {
            var x = LETTER_NAME.GetValueOrDefault(Js.ToLowerCase(m.Groups[1].Value));
            var y = LETTER_NAME.GetValueOrDefault(Js.ToLowerCase(m.Groups[2].Value));
            return x is null || y is null ? m.Value : $"{x} a {y}";
        });
        s = Rewrite(s, AMP, " a ");

        // 15) INITIALISMS, LAST — after the Roman-numeral and regnal rules and the abbreviation expansions.
        s = NormalizeSlovakInitialisms(s);

        return s;
    }
}
