/**
 * Polish (pl) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/polish/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

public static class Normalize
{
    /** The space characters Polish groups thousands with: plain, NBSP, narrow NBSP, thin.
     *  ⚠ ESCAPED, NOT LITERAL — three of the four are invisible, and an editor or a heredoc that folded them
     *  to a plain space would silently narrow the class. */
    private const string GROUP_SPACE = " \u00a0\u202f\u2009";

    /**
     * Polish count-form selector for the shared symbol tier (and for the local unit rules below).
     * 0 = nominative singular, 1 = paucal (2–4), 2 = genitive plural, 3 = genitive singular (a DECIMAL count:
     * 2,3 miliarda). ⚠ DELIBERATELY NOT the shared Slavic selector, which returns 0 for every numeral ending
     * in 1: Polish puts a compound ending in "jeden" in the genitive plural, so only an exact 1 takes sg.
     */
    public static int PlCountForm(double n)
    {
        if (n == 1) return 0;
        if (!double.IsInteger(n)) return 3;
        var m100 = Math.Abs(n) % 100;
        if (m100 >= 12 && m100 <= 14) return 2;
        var m10 = m100 % 10;
        return m10 >= 2 && m10 <= 4 ? 1 : 2;
    }

    /** Pick the count form of a counted noun written [sg, paucal, gen-pl]. CLAMPED, exactly as core's `pick`
     *  is: `PlCountForm` can return 3 and not every table carries a fourth form. */
    private static string Counted(double n, IReadOnlyList<string> forms) =>
        forms[Math.Min(PlCountForm(n), forms.Count - 1)];

    private static readonly JsRe FINAL_Y = JsRegex.Compile("y$", "u");

    /** Adjectival case forms of a masculine-nominative ordinal (pierwszy, drugi, trzeci, dwudziesty …).
     *  Used by the clock (godzina is FEMININE — "ósma", "o ósmej") and by the decade rule.
     *  ⚠ EVERY element inflects, not just the last: Polish compound ordinals agree throughout, so
     *  `dwudziesty pierwszy` → `o dwudziestej pierwszej`. Inflecting only the tail gave
     *  *o dwudziesty pierwszej*. */
    private static string InflectOrdinal(string masc, string c) =>
        string.Join(" ", masc.Split(' ').Select(w =>
        {
            if (w.EndsWith("gi", StringComparison.Ordinal) || w.EndsWith("ki", StringComparison.Ordinal))
            {
                var stem = w[..^1]; // drugi → drug|i; a velar stem keeps the -i- (drugiej)
                return stem + c switch
                {
                    "fem" => "a", "femObl" => "iej", "femInstr" => "ą", "plGen" => "ich", _ => "ie",
                };
            }
            if (w.EndsWith("ci", StringComparison.Ordinal))
            {
                var stem = w[..^1]; // trzeci → trzec|i
                return stem + c switch
                {
                    "fem" => "ia", "femObl" => "iej", "femInstr" => "ią", "plGen" => "ich", _ => "ie",
                };
            }
            var hard = JsRegex.Replace(w, FINAL_Y, _ => ""); // dwudziesty → dwudziest|y
            return hard + c switch
            {
                "fem" => "a", "femObl" => "ej", "femInstr" => "ą", "plGen" => "ych", _ => "e",
            };
        }));

    /** Polish phonotactics, for the OOV rule in core/initialisms.ts. Polish tolerates very heavy clusters, so
     *  the onset/coda sets are generous on purpose — the work here is done by the no-vowel test (GMT, DVD,
     *  UTC, XDR, PNG), not by cluster policing, and a false "unreadable" would letter-spell a real acronym. */
    public static readonly Func<string, bool> IsUnreadablePolish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{Manifest.MANIFEST.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Codas, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms Polish spells out although the letters could be read as a word. Authored in
     *  polish.jsonc beside the language's other hand-authored facts. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /** Initialism pass. ⚠ ORDERING: must run AFTER the abbreviation rules below, or `m.in.` is spelled out
     *  EM-EN. Polish has no pronunciation dictionary (its g2p is rule-based), so `IsRecorded` is always false. */
    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => Manifest.MANIFEST.LetterNames.GetValueOrDefault(l),
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadablePolish,
    });

    public static string NormalizePolishInitialisms(string text) => INITIALISMS(text);

    /** Multi-dot abbreviations. ⚠ Claimed FIRST, or their interior dots survive as phrase breaks. */
    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])p\\.\\s?n\\.\\s?e\\.", "giu"), "przed naszą erą"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])n\\.\\s?e\\.", "giu"), "naszej ery"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])m\\.\\s?in\\.", "giu"), "między innymi"),
    };

    /** Single-dot abbreviations → their expansion. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["np"] = "na przykład", ["ok"] = "około", ["tzn"] = "to znaczy", ["tzw"] = "tak zwany",
        ["itp"] = "i tym podobne", ["itd"] = "i tak dalej", ["ds"] = "do spraw", ["zob"] = "zobacz",
        ["im"] = "imienia", ["ang"] = "angielski", ["jr"] = "junior",
    };
    private static readonly string DOTTED_ALT = string.Join("|", DOTTED.Keys.OrderByDescending(a => a.Length));

    /** Units the shared symbol tier can express, matched only when a NUMBER is adjacent. [sg, paucal, gen-pl,
     *  gen-sg] — the fourth form is what a decimal count takes. */
    public static readonly IReadOnlyDictionary<string, string[]> UNITS = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["km"] = new[] { "kilometr", "kilometry", "kilometrów", "kilometra" },
        ["m"] = new[] { "metr", "metry", "metrów", "metra" },
        ["cm"] = new[] { "centymetr", "centymetry", "centymetrów", "centymetra" },
        ["mm"] = new[] { "milimetr", "milimetry", "milimetrów", "milimetra" },
        ["kg"] = new[] { "kilogram", "kilogramy", "kilogramów", "kilograma" },
        ["mln"] = new[] { "milion", "miliony", "milionów", "miliona" },
        ["mld"] = new[] { "miliard", "miliardy", "miliardów", "miliarda" },
    };

    /** Clock hour → masculine-nominative ordinal, later inflected to feminine. Hour 0 returns undefined: it is
     *  read "zero" rather than as an ordinal, and the rule declines to claim it rather than say *dwudziesta
     *  czwarta*. */
    private static string? HourOrd(double h) => h == 0 ? null : RomanOrdinals.Ordinal(h);
    private static readonly string[] DEGREE = { "stopień", "stopnie", "stopni" };
    private static readonly string[] KMH = { "kilometr", "kilometry", "kilometrów", "kilometra" };
    private static readonly string[] MILE = { "mila", "mile", "mil", "mili" };

    private sealed record ClockCaseResult(string Noun, string Ord);

    /** Case of `godzina` / of the clock ordinal, from the governing preposition immediately before it. */
    private static ClockCaseResult ClockCase(string? prep)
    {
        var p = (prep ?? "").ToLowerInvariant();
        if (p == "o" || p == "po" || p == "przy") return new ClockCaseResult("godzinie", "femObl");
        if (p == "około" || p == "do" || p == "z" || p == "od") return new ClockCaseResult("godziny", "femObl");
        if (p == "przed" || p == "między" || p == "nad" || p == "pod")
            return new ClockCaseResult("godziną", "femInstr");
        return new ClockCaseResult("godzina", "fem");
    }
    private const string PREP_ALT = "o|po|przy|około|do|z|od|przed|między|nad|pod";

    private static readonly JsRe ONLY_CLOSERS = JsRegex.Compile("^[\\s»)”\"']*$", "u");

    /**
     * Re-attach a sentence period that an abbreviation's dot was doing double duty for — every dot-consuming
     * rule below runs through this.
     * ⚠ THE TS TAKES `...rest` AND READS ITS LAST TWO ELEMENTS, which is how a JS replacer callback receives
     * (…groups, offset, wholeString) at any arity. C# hands the whole `Match` and the subject separately, so
     * the two are named parameters here — same test, no variadic games.
     */
    private static string KeepFinal(string expansion, string matched, int offset, string whole) =>
        ONLY_CLOSERS.IsMatch(whole[(offset + matched.Length)..]) ? $"{expansion}." : expansion;

    // The step patterns. The TS builds several inline; JsRegex.Compile caches, so hoisting them here is a
    // readability choice and not a behaviour one.
    private static readonly JsRe DEGROUP = JsRegex.Compile($"(\\d)[{GROUP_SPACE}](\\d{{3}})(?!\\d)", "gu");
    private static readonly JsRe GROUP_SPACE_ANY = JsRegex.Compile($"[{GROUP_SPACE}]", "gu");
    private static readonly JsRe KMH_NUM = JsRegex.Compile("(\\d+)\\s?km\\s?\\/\\s?(?:h|godz\\.?)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe KMH_BARE = JsRegex.Compile("(?<![\\p{L}\\p{M}])km\\s?\\/\\s?(?:h|godz\\.?)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MPH = JsRegex.Compile("(\\d+)\\s?mph(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MBPS = JsRegex.Compile("(\\d+)\\s?Mb\\s?\\/\\s?s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe GODZ = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])(?:({PREP_ALT})\\s+)?godz\\.", "giu");
    private static readonly JsRe YEAR_R = JsRegex.Compile("(\\d+)(\\s+)r\\.", "gu");
    private static readonly JsRe CENTURY_W = JsRegex.Compile("(\\d+)(\\s+)w\\.", "gu");
    private static readonly JsRe PAGE_S = JsRegex.Compile("(\\d)\\s?s\\.\\s?(?=\\d)", "gu");
    private static readonly JsRe NR = JsRegex.Compile("(?<![\\p{L}\\p{M}])nr\\.?(?=\\s+[\\d\\p{Lu}])", "gu");
    private static readonly JsRe DOTTED_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}.])({DOTTED_ALT})\\.(\\s+)(?=[\\p{{L}}\\d(„\"])", "giu");
    private static readonly JsRe DOTTED_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}.])({DOTTED_ALT})\\.(?=\\s*(?:[,;:!?»)”]|$))", "giu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile("(\\d)\\.(?=\\d)", "gu");
    private static readonly JsRe DECADE = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(lat|lata|latach)(\\s+)(\\d+)\\.(?=\\s*[,\\p{Ll}])", "gu");
    private static readonly JsRe ORDINAL_DOT = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,])(\\d+)\\.(?=\\s*[,\\p{Ll}])", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!,\\d)", "gu");
    private static readonly JsRe CLOCK_PREP = JsRegex.Compile($"(?:^|[\\s(])({PREP_ALT})\\s+(?:godzin\\p{{L}}*\\s+)?$", "iu");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s?[–—-]\\s?(?=\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d+)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d+)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)\\s?°", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_AT_END = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})\\/(\\d{1,3})(?![\\d.,])", "gu");

    /** Normalize one Polish input string. Pure text→text; ordered, and each ordering coupling is stated. */
    public static string NormalizePolish(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING FIRST — a grouping separator is otherwise read as clause punctuation, and the
        //    number token cannot span a space. TWO PASSES, because adjacent groups overlap on the shared digit
        //    (5 000 000). The decimal COMMA is deliberately left in place: it must stay adjacent to the number
        //    for the shared unit/percent tier, and Polish.cs's TOKEN swallows it.
        for (var i = 0; i < 2; i++)
            s = JsRegex.Replace(s, DEGROUP, m => m.Groups[1].Value + m.Groups[2].Value);
        s = JsRegex.Replace(s, GROUP_SPACE_ANY, _ => " ");

        // 1) MULTI-DOT ABBREVIATIONS, before the single-dot rule — otherwise the interior dot of p.n.e./m.in.
        //    survives as a phrase break, and p.n.e. is also an era marker.
        foreach (var (re, w) in MULTI_DOT)
        {
            var whole1 = s;
            s = JsRegex.Replace(s, re, m => KeepFinal(w, m.Value, m.Index, whole1));
        }

        // 2) COMPOUND UNITS containing a dot or a slash, before the generic `godz.` rule (which would eat the
        //    dot of `km/godz.`) and before the shared symbol tier, which matches single tokens only.
        var whole2 = s;
        s = JsRegex.Replace(s, KMH_NUM, m =>
        {
            var n = m.Groups[1].Value;
            return KeepFinal($"{n} {Counted(Js.Number(n), KMH)} na godzinę", m.Value, m.Index, whole2);
        });
        var whole2b = s;
        s = JsRegex.Replace(s, KMH_BARE, m => KeepFinal("kilometrów na godzinę", m.Value, m.Index, whole2b));
        s = JsRegex.Replace(s, MPH, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), MILE)} na godzinę");
        s = JsRegex.Replace(s, MBPS, m => $"{m.Groups[1].Value} megabitów na sekundę");

        s = JsRegex.Replace(s, GODZ, m =>
        {
            var prep = m.Groups[1].Success ? m.Groups[1].Value : null;
            return $"{(prep is not null ? prep + " " : "")}{ClockCase(prep).Noun}";
        });

        var whole4 = s;
        s = JsRegex.Replace(s, YEAR_R, m =>
            KeepFinal($"{m.Groups[1].Value}{m.Groups[2].Value}roku", m.Value, m.Index, whole4));
        //    `w.` additionally takes an ORDINAL numeral (`III w.` is *trzeci wiek*). The roman pass cannot
        //    supply it — its context test sees only the adjacent word, and "w" is also the preposition — so the
        //    ordinal is applied HERE, after the roman has already become digits.
        var whole4b = s;
        s = JsRegex.Replace(s, CENTURY_W, m =>
            KeepFinal($"{RomanOrdinals.Ordinal(Js.Number(m.Groups[1].Value)) ?? m.Groups[1].Value}{m.Groups[2].Value}wieku", m.Value, m.Index, whole4b));
        s = JsRegex.Replace(s, PAGE_S, m => $"{m.Groups[1].Value} strona ");
        s = JsRegex.Replace(s, NR, _ => "numer");

        s = JsRegex.Replace(s, DOTTED_MID, m =>
            $"{DOTTED[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = JsRegex.Replace(s, DOTTED_END, m =>
            $"{DOTTED[m.Groups[1].Value.ToLowerInvariant()]}.");

        // 6) VERSION / FIGURE DOTS between digits, BEFORE step 7 so the ordinal rule never sees digit-dot-digit.
        s = JsRegex.Replace(s, VERSION_DOT, m => $"{m.Groups[1].Value} kropka ");

        // 7) ORDINAL NOTATION `N.`. The discriminator is what FOLLOWS the dot: end-of-line or an UPPERCASE word
        //    → an ordinary sentence period, left alone; a LOWERCASE word or a comma → an ordinal. DECADES are
        //    the one context whose inflection is recoverable — `lat`/`latach` govern the genitive/locative
        //    plural and `lata` the nominative plural — so they are inflected and everything else is masculine
        //    nominative.
        s = JsRegex.Replace(s, DECADE, m =>
        {
            var head = m.Groups[1].Value;
            var n = Js.Number(m.Groups[3].Value);
            var masc = RomanOrdinals.Ordinal(n);
            if (masc is null || n % 10 != 0) return m.Value;
            return $"{head}{m.Groups[2].Value}{InflectOrdinal(masc, head.ToLowerInvariant() == "lata" ? "plNom" : "plGen")}";
        });
        s = JsRegex.Replace(s, ORDINAL_DOT, m =>
            RomanOrdinals.Ordinal(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // 8) CLOCK, ⚠ BEFORE any rule that looks for a bare number, or `11:30` is claimed by the range or unit
        //    rules. The hour is a FEMININE ORDINAL agreeing with godzina, inflected by the governing
        //    preposition — which step 3 has already left standing ahead of any `godzinie`/`godziną`. `:00`
        //    drops the minutes. TWO digits are required after the colon, which is also what keeps the rule off
        //    sports scores. ⚠ The preposition is looked up from the text BEFORE the match rather than with an
        //    optional lookbehind group: in the JS engine `(?:(?<=…))?` matches empty and never populates the
        //    capture, so the port reproduces the explicit lookup rather than "fixing" it.
        var whole8 = s;
        s = JsRegex.Replace(s, CLOCK, m =>
        {
            var masc = HourOrd(Js.Number(m.Groups[1].Value));
            if (masc is null) return m.Value;
            var pm = CLOCK_PREP.Match(whole8[..m.Index]);
            var ord = ClockCase(pm.Success ? pm.Groups[1].Value : null).Ord;
            var head = InflectOrdinal(masc, ord);
            return Js.Number(m.Groups[2].Value) == 0 ? head : $"{head} {m.Groups[2].Value}";
        });

        // 9) NUMERIC RANGES → "do". Digits are required on BOTH sides, which is what keeps designations like
        //    `COVID-19` and `100-dolarowych` out.
        s = JsRegex.Replace(s, RANGE, m => $"{m.Groups[1].Value} do ");

        s = JsRegex.Replace(s, DEG_C, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)} Celsjusza");
        s = JsRegex.Replace(s, DEG_F, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)} Fahrenheita");
        s = JsRegex.Replace(s, DEG_BARE, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)}");
        // THE MINUS TAKES THREE GUARDS, each rejecting a shape the corpus actually contains: a digit
        // IMMEDIATELY AFTER the sign (rejects the spaced `- 2`), a letter or digit immediately BEFORE (rejects
        // `ił-76` and closed ranges), and a digit ANYWHERE to the left (rejects a SPACED range or score like
        // `26 - 00`, which the fleet's usual guard misses because the character before the hyphen is a space).
        var whole10 = s;
        s = JsRegex.Replace(s, MINUS, m =>
            DIGIT_AT_END.IsMatch(whole10[..m.Index]) ? m.Value : "minus ");
        // ⚠ ± NEEDS ITS OWN RULE: it is a single character (U+00B1), not a `+`, so no `+` rule can match
        // inside it and the sign would otherwise be dropped in silence.
        s = JsRegex.Replace(s, PLUSMINUS, _ => " plus minus ");
        s = JsRegex.Replace(s, PLUS, m => $"{m.Groups[1].Value}plus ");

        s = JsRegex.Replace(s, EQUALS, _ => " równa się ");
        // ⚠ THE COMPARATIVES TAKE `niż`, NOT `od`, AND THE TWO ARE NOT INTERCHANGEABLE: `od` governs the
        // GENITIVE while the number path emits nominative cardinals, so `7 < 3` would read *mniejsze od trzy*.
        s = JsRegex.Replace(s, LESS_THAN, _ => " mniejsze niż ");
        s = JsRegex.Replace(s, GREATER_THAN, _ => " większe niż ");
        s = JsRegex.Replace(s, DIVIDE, _ => " podzielić przez ");

        // 11) FRACTIONS — feminine, agreeing with the elided *część*: 1/5 is "jedna piąta". Digits on both
        //     sides only, so an ordinary spaced " / " is untouched.
        s = JsRegex.Replace(s, FRACTION, m =>
        {
            var den = RomanOrdinals.Ordinal(Js.Number(m.Groups[2].Value));
            if (den is null || Js.Number(m.Groups[1].Value) != 1) return m.Value;
            return $"jedna {InflectOrdinal(den, "fem")}";
        });

        return s;
    }
}
