/**
 * Polish (pl) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the pl_pl FLEURS corpus (1,919 unique cased utterances, column 3). Every count below was
 * taken from that column, and every rule here exists because the engine produced something wrong on it:
 *
 *   dotted abbreviations ×~70 mid-sentence (np. ×27, godz. ×8, ds. ×6, r. ×6, ok. ×4, tzn./tzw./m.in. ×3
 *       each, itp./p.n.e. ×2, Jr. ×3, w./n.e./ang./zob./s. ×1) — every one read the letters as a bogus word
 *       AND left the dot as a phrase break: `np. złoto` → [np . zwɔtɔ], `ds.` → [ts .], `tzw.` → [tsf .].
 *   all-caps initialisms ×~170 (USA ×11, RPA ×6, ONZ ×4, PKB/DNA/FBI/GPS/AOL/UNESCO ×3 …) — USA → [ˈusa],
 *       ONZ → [ˈɔns], DVD → [tft], GMT → [ɡmt], UTC → [ˈutt͡s].
 *   Roman numerals ×43 — ALREADY correct: they arrive converted at the registry seam and romanOrdinals.ts
 *       supplies the ordinal a century wants (`w XIX wieku` → dziewiętnasty wieku). Untouched here.
 *   `N.` ordinal notation ×19 mid-sentence (see step 7) — read as a cardinal PLUS a spurious phrase break:
 *       `37. kraj` → [tʂɨd͡ʑɛɕt͡ɕi ɕɛdɛm . kraj].
 *   clock times ×17 — the colon is clause punctuation here, so `8:46` read as [ɔɕɛm , t͡ʂtɛrd͡ʑɛɕt͡ɕi ʂɛɕt͡ɕ]
 *       (a phrase break inside the time) and `12:00` as "dwanaście , zero".
 *   space-grouped thousands ×16 — the number token cannot span a space, so `104 500` read as
 *       "sto cztery pięćset", `330 000` as "trzysta trzydzieści zero", `5 000 000` as "pięć zero zero".
 *   decimals with a comma ×19 — the comma was a phrase break: `14,7 miliarda` → [t͡ʂtɛrnaɕt͡ɕɛ , ɕɛdɛm …].
 *       (Handled in polish.ts's TOKEN, not here — see the note at step 0.)
 *   numeric ranges ×16 — the dash was DROPPED, fusing the endpoints: `1418–1450` → one run of words.
 *   percent ×9 — the sign was dropped outright: `18% mieszkańców` → "osiemnaście mieszkańców".
 *   units ×~40 (km ×20, mm ×7, m ×5, kg ×2, cm/mln/mld ×1, km/h ×3, km/godz. ×3, mph ×2, km² ×1, Mb/s ×1)
 *       — dropped or read as letters: `19 500 km²` → "…pięćset km", `2,3 mld` → [mlt], `12,8 km` → "km".
 *   version dots ×5 (`802.11n` ×4, `rysunek 1.1.` ×1) — the interior dot was a phrase break.
 *   °C ×1, `+` ×1, `1/5` ×1.
 *
 * COUNT AGREEMENT. Polish is three-way (1 procent / 2–4 procenty / 5+ procent) but it is NOT Russian's:
 * `core/normalizeSymbols.ts`'s `slavicCountForm` sends any numeral ending in 1 to the singular (21 процент),
 * and Polish sends it to the genitive plural — *dwadzieścia jeden procent*, never *…jeden procent* in the
 * singular sense. `numbers.ts` already documents the same divergence for magnitude nouns. So `plCountForm`
 * below is Polish-specific: index 0 only for an EXACT count of 1.
 *
 * CASE, the standing limitation. Polish ordinals and counted nouns inflect for case, and the surrounding
 * case is not recoverable from a number alone. Where a governing preposition IS adjacent and unambiguous
 * (`o godz.` → locative, `przed godz.` → instrumental, `w latach 20.` → genitive/locative plural) the rule
 * reads it and inflects; elsewhere it emits the citation form. That is the same trade `romanOrdinals.ts`
 * already documents: the right lexeme with the wrong ending beats the wrong word entirely.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

public static class Normalize
{
    /** Regular space and NBSP — the two that occur as thousands separators in the corpus. (The TS comment
     *  says "Regular, NBSP and narrow-NBSP", but the class it declares holds only the first two: U+0020 and
     *  U+00A0. Recorded rather than silently widened — adding U+202F here would be a behaviour change the
     *  golden cannot see, and the TS is the specification.)
     *  ⚠ ESCAPED, NOT LITERAL: the NBSP is invisible, and a heredoc or an editor that folds it to a plain
     *  space would silently narrow the class to nothing. Same repair the French grouping class needed. */
    private const string GROUP_SPACE = " \u00a0\u202f\u2009";

    /**
     * Polish count-form selector for `core/normalizeSymbols.ts` (and for the local unit rules below).
     * 0 = nominative singular, 1 = paucal (2–4), 2 = genitive plural.
     *
     * DIFFERS FROM `slavicCountForm`, deliberately: that one returns 0 for every numeral ending in 1 (Russian
     * *двадцать один процент*). Polish uses the genitive plural for a compound ending in "jeden"
     * (*dwadzieścia jeden procent*, *dwadzieścia jeden tysięcy*), so only an exact 1 takes the singular.
     */
    public static int PlCountForm(double n)
    {
        if (n == 1) return 0;
        // A decimal count takes the GENITIVE SINGULAR — 2,3 miliarda, 2,4 procenta — which is index 3. The
        // note that used to sit here said a three-form table could not express it and settled for the
        // genitive plural as "the nearer of the two available". That was wrong on the mechanism: `CountForms`
        // is a plain string[] and `pick` clamps to the array length, so a fourth entry is local data. The
        // tables that need one now carry it; a table with only three forms still clamps to index 2, i.e. the
        // old behaviour.
        if (!double.IsInteger(n)) return 3;
        var m100 = Math.Abs(n) % 100;
        if (m100 >= 12 && m100 <= 14) return 2;
        var m10 = m100 % 10;
        return m10 >= 2 && m10 <= 4 ? 1 : 2;
    }

    /** Pick the count form of a counted noun written [sg, paucal, gen-pl]. */
    private static string Counted(double n, IReadOnlyList<string> forms) =>
        // CLAMPED, exactly as core's `pick` is: plCountForm returns 3 for a decimal (the genitive singular)
        // and not every table carries a fourth form. Without the clamp this indexed past the end and emitted
        // the literal string "undefined".
        forms[Math.Min(PlCountForm(n), forms.Count - 1)];

    private static readonly JsRe FINAL_Y = JsRegex.Compile("y$", "u");

    /**
     * Adjectival case forms of a masculine-nominative ordinal (pierwszy, drugi, trzeci, dwudziesty …).
     * Regular adjectival declension, so this is morphology rather than data: hard stems in -y take
     * -a / -ej / -ą / -ych, the two soft stems in the 1–23 range (drugi, trzeci) take the -i- forms.
     * Used by the clock (godzina is FEMININE — "ósma", "o ósmej") and by the decade rule at step 7.
     */
    private static string InflectOrdinal(string masc, string c) =>
        // EVERY element inflects, not just the last: Polish compound ordinals agree throughout
        // (dwudziesty pierwszy → o dwudziestej pierwszej), which is the divergence from Russian that
        // romanOrdinals.ts already records. Inflecting only the tail produced *o dwudziesty pierwszej*.
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

    /** Polish letter names, for the initialism pass. USA is [u es a], ONZ [o en zet], DVD [de fau de]. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["ą"] = "a z ogonkiem", ["b"] = "be", ["c"] = "ce", ["ć"] = "cie", ["d"] = "de",
        ["e"] = "e", ["ę"] = "e z ogonkiem", ["f"] = "ef", ["g"] = "gie", ["h"] = "ha", ["i"] = "i",
        ["j"] = "jot", ["k"] = "ka", ["l"] = "el", ["ł"] = "eł", ["m"] = "em", ["n"] = "en",
        ["ń"] = "eń", ["o"] = "o", ["ó"] = "o kreskowane", ["p"] = "pe", ["q"] = "ku", ["r"] = "er",
        ["s"] = "es", ["ś"] = "eś", ["t"] = "te", ["u"] = "u", ["v"] = "fau", ["w"] = "wu",
        ["x"] = "iks", ["y"] = "igrek", ["z"] = "zet", ["ź"] = "ziet", ["ż"] = "żet",
    };

    /** Polish phonotactics, for the OOV rule in core/initialisms.ts. Polish tolerates very heavy clusters, so
     *  the onset/coda sets are generous on purpose — the work here is done by the no-vowel test (GMT, DVD,
     *  UTC, XDR, PNG), not by cluster policing, and a false "unreadable" would letter-spell a real acronym. */
    public static readonly Func<string, bool> IsUnreadablePolish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouyąęó]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "ch", "cz", "dl", "dr", "dz", "dż", "dź", "gl", "gr", "gd", "gn", "gw", "kl", "kn",
            "kr", "kt", "kw", "ml", "mł", "mn", "mr", "pl", "pr", "ps", "pt", "rz", "sk", "sl", "sł", "sm",
            "sn", "sp", "st", "sw", "sz", "śc", "śl", "śm", "śn", "św", "tl", "tr", "tw", "wl", "wł", "wr",
            "zb", "zd", "zg", "zł", "zn", "zw", "źr", "żr",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ch", "cz", "sz", "rz", "st", "śc", "ść", "zd", "nt", "nd", "nk", "ng", "ns", "nc", "rt", "rd",
            "rk", "rs", "rn", "rm", "rz", "lt", "ld", "lk", "ls", "lm", "łt", "łd", "łk", "kt", "ks", "pt",
            "ft", "zm", "zn", "sk", "sm", "tr", "dr", "br", "gr", "pr", "kr", "wr", "cs", "js", "js",
        }, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms Polish spells out although the letters could be read as a word. Authored in
     *  polish.jsonc beside the language's other hand-authored facts. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /**
     * Initialism pass. ORDERING: must run AFTER the abbreviation rules below (`m.in.` must not become EM-EN)
     * and after Roman numerals — Polish is not in `ROMAN_NATIVE`, so romans are already digits/ordinal words
     * by the time `text()` is entered and the hazard cannot arise. Polish has no pronunciation dictionary
     * (its g2p is rule-based), so `isRecorded` is always false, as in Russian.
     */
    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
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

    /**
     * Single-dot abbreviations → their expansion. SOURCE: the standard Polish abbreviation inventory
     * (Wielki słownik ortograficzny PWN / Wikisłownik "skróty"): np. = na przykład, ok. = około,
     * tzn. = to znaczy, tzw. = tak zwany, itp. = i tym podobne, itd. = i tak dalej, ds. = do spraw,
     * zob. = zobacz, im. = imienia, ang. = angielski, Jr. = junior.
     *
     * `tzw.` is emitted in the masculine-nominative citation form; it is an adjective and agrees with its
     * head ("tzw. spamu" wants *tak zwanego*). Accepted per the case limitation in the file header — the
     * alternative was the status quo, which read it as the nonce word [tsf] plus a phrase break.
     */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["np"] = "na przykład", ["ok"] = "około", ["tzn"] = "to znaczy", ["tzw"] = "tak zwany",
        ["itp"] = "i tym podobne", ["itd"] = "i tak dalej", ["ds"] = "do spraw", ["zob"] = "zobacz",
        ["im"] = "imienia", ["ang"] = "angielski", ["jr"] = "junior",
    };
    private static readonly string DOTTED_ALT = string.Join("|", DOTTED.Keys.OrderByDescending(a => a.Length));

    /** Units the shared symbol tier can express (matched only when a NUMBER is adjacent). [sg, paucal, gen-pl]. */
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
     *  czwarta*. No `0:MM` occurs in the corpus. */
    private static string? HourOrd(double h) => h == 0 ? null : RomanOrdinals.Ordinal(h);
    private static readonly string[] DEGREE = { "stopień", "stopnie", "stopni" };
    private static readonly string[] KMH = { "kilometr", "kilometry", "kilometrów", "kilometra" };
    private static readonly string[] MILE = { "mila", "mile", "mil", "mili" };

    private sealed record ClockCaseResult(string Noun, string Ord);

    /**
     * Case of `godzina` / of the clock ordinal, from the governing preposition immediately before it.
     * Sourced from the prepositions' standard government: o/po/przy/w + locative, około/do/z + genitive
     * (identical form for a feminine adjective: godzinie / -ej), przed/między/nad/pod + instrumental.
     */
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
     * Re-attach a sentence period that an abbreviation's dot was doing double duty for.
     *
     * ⚠ THE TS TAKES `...rest` AND READS ITS LAST TWO ELEMENTS, which is how a JS replacer callback receives
     * (…groups, offset, wholeString) at any arity. C# hands the whole `Match` and the subject separately, so
     * the two are named parameters here — same test, no variadic games.
     */
    private static string KeepFinal(string expansion, string matched, int offset, string whole) =>
        ONLY_CLOSERS.IsMatch(whole[(offset + matched.Length)..]) ? $"{expansion}." : expansion;

    // The step patterns. The TS builds several inline; JsRegex.Compile caches, so hoisting is a
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

        // 0) DIGIT DE-GROUPING, first (⚠ a grouping separator is otherwise read as clause
        //    punctuation, and the number token cannot span a space). Polish groups thousands with a SPACE and
        //    marks the decimal with a COMMA — verified against the corpus: 16 space-grouped numbers, 19
        //    comma-decimals, ZERO period-grouped and zero comma-grouped. Two passes, because the groups
        //    overlap on the shared digit (5 000 000). The decimal comma itself is NOT rewritten here: it must
        //    stay adjacent to the number for the shared unit/percent tier to see it, so polish.ts's TOKEN
        //    swallows it and emits "przecinek" (the Polish name of the decimal comma) between the parts.
        for (var i = 0; i < 2; i++)
            s = JsRegex.Replace(s, DEGROUP, m => m.Groups[1].Value + m.Groups[2].Value);
        s = JsRegex.Replace(s, GROUP_SPACE_ANY, _ => " ");

        // 1) MULTI-DOT ABBREVIATIONS, before the single-dot rule — otherwise the interior
        //    dot of p.n.e. / m.in. survives as a phrase break. p.n.e. is also an ERA marker and so has to
        //    precede the generic rules for the same reason.
        //    Each expansion CONSUMES the abbreviation's final dot, so where that dot was also the sentence
        //    period it has to be put back — "…do roku 1000 n.e." ends the utterance, and eating the dot lost
        //    its sentence-final pause. `keepFinal` is applied to every dot-consuming rule below for that
        //    reason; it was found by auditing the corpus diff for utterances whose trailing mark disappeared.
        foreach (var (re, w) in MULTI_DOT)
        {
            var whole1 = s;
            s = JsRegex.Replace(s, re, m => KeepFinal(w, m.Value, m.Index, whole1));
        }

        // 2) COMPOUND UNITS containing a dot or a slash. Before the generic `godz.` rule (which would eat the
        //    dot of `km/godz.`) and before the shared symbol tier (which matches single tokens only).
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
        // SQUARED units are composed by the shared tier now (exponentWords in polish.ts). The RATE forms above
        // stay local: "na godzinę" is a preposition plus an ACCUSATIVE, the corpus writes a bare numberless
        // `km/h`, and `km/godz.` needs keepFinal so its dot cannot swallow a sentence period.
        s = JsRegex.Replace(s, MBPS, m => $"{m.Groups[1].Value} megabitów na sekundę");

        // 3) `godz.` → godzina, in the case the preceding preposition governs. All 8 corpus instances are
        //    clock contexts ("o godz. 12:00", "przed godz. 23:35"); none is the "hours elapsed" sense.
        s = JsRegex.Replace(s, GODZ, m =>
        {
            var prep = m.Groups[1].Success ? m.Groups[1].Value : null;
            return $"{(prep is not null ? prep + " " : "")}{ClockCase(prep).Noun}";
        });

        // 4) `r.` and `w.` after a number. Both corpus senses are oblique (w/z/na + rok → roku, w + wiek →
        //    wieku); the nominative rok/wiek does not occur after a numeral, so the oblique form is emitted
        //    unconditionally. 15 instances of `r.`, 2 of `w.` — every one previously a bogus word + a break.
        //    `w.` additionally takes an ORDINAL numeral: `III w.` is *trzeci wiek*, not *trzy wiek*. The Roman
        //    pass cannot supply it, because its context test only sees the adjacent WORD and "w" is also the
        //    preposition — adding it to romanOrdinals' CONTEXT would fire on every "XX w Polsce". So the
        //    ordinal is applied here, after the roman has already become digits.
        var whole4 = s;
        s = JsRegex.Replace(s, YEAR_R, m =>
            KeepFinal($"{m.Groups[1].Value}{m.Groups[2].Value}roku", m.Value, m.Index, whole4));
        var whole4b = s;
        s = JsRegex.Replace(s, CENTURY_W, m =>
            KeepFinal($"{RomanOrdinals.Ordinal(Js.Number(m.Groups[1].Value)) ?? m.Groups[1].Value}{m.Groups[2].Value}wieku", m.Value, m.Index, whole4b));
        s = JsRegex.Replace(s, PAGE_S, m => $"{m.Groups[1].Value} strona ");
        //    `nr` carries no dot in Polish, so it never reached the dotted rule and read as the cluster [nr].
        s = JsRegex.Replace(s, NR, _ => "numer");

        // 5) SINGLE-DOT ABBREVIATIONS. The dot is consumed so it cannot become a phrase break. Two shapes:
        //    followed by a word, and followed by another mark or end of clause (`itp.` at the end of a list),
        //    where the sentence period is kept.
        s = JsRegex.Replace(s, DOTTED_MID, m =>
            $"{DOTTED[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = JsRegex.Replace(s, DOTTED_END, m =>
            $"{DOTTED[m.Groups[1].Value.ToLowerInvariant()]}.");

        // 6) VERSION / FIGURE DOTS between digits — `802.11n` ×4 and `rysunek 1.1.` ×1 were breaking the
        //    sentence at the interior dot. Before step 7 so the ordinal rule never sees a digit-dot-digit.
        s = JsRegex.Replace(s, VERSION_DOT, m => $"{m.Groups[1].Value} kropka ");

        // 7) ORDINAL NOTATION `N.` — derived by tabulating what surrounds it in this corpus, NOT ported from
        //    German's or Turkish's rule. 36 instances of `\d+\.`; 17 are sentence-final, 5 are version dots
        //    (step 6), and the remaining 14 are ordinals. The discriminator that fell out of the table:
        //      · followed by end-of-line or by an UPPERCASE word → sentence period. This is the case that
        //        matters, and the corpus contains the trap: "…, lat 21. Cuddeback prowadził…" is an AGE plus a
        //        full stop, not the 21st of anything. ZERO sentence-final pauses are lost by this rule.
        //      · followed by a LOWERCASE word (or a comma) → ordinal. All 14: "37. kraj", "60. trafieniem",
        //        "1. i 3. pułku", "numerem 1. drużyna", "miejscu 190., a jego", and 6 decade phrases.
        //    DECADES are the majority and are the one case where the inflection IS recoverable: `lat`/`latach`
        //    govern the genitive/locative plural (*w latach dwudziestych*) and `lata` the nominative plural
        //    (*na lata pięćdziesiąte*). Both are regular adjectival endings, so they are applied; every other
        //    context gets the masculine nominative, per the file header.
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

        // 8) CLOCK. ⚠ Before any rule that looks for a bare number: `11:30` must not be
        //    claimed by the range or unit rules. The colon is clause punctuation in polish.jsonc, so every
        //    time in the corpus was previously split by a phrase break. Polish reads the hour as a FEMININE
        //    ORDINAL agreeing with godzina (8:46 = ósma czterdzieści sześć), inflected by the governing
        //    preposition — which step 3 has already left in place ahead of any `godzinie`/`godziną`.
        //    `:00` drops the minutes, which is the idiomatic reading (o dwunastej, not o dwunastej zero zero).
        //    Two digits are REQUIRED after the colon, which is also what keeps the rule off the corpus's
        //    sports scores ("wynosi 7:2", "wynosi zatem 3:2") — those were checked and are untouched.
        //    The governing preposition is looked up from the text BEFORE the match rather than with an
        //    optional lookbehind group: V8 lets `(?:(?<=…))?` match empty and never populates the capture.
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

        // 9) NUMERIC RANGES. The en/em dash between two numbers was dropped outright, fusing "1418" and
        //    "1450" into one uninterrupted run of number words (16 instances). Read as "do" — the ordinary
        //    Polish reading of a range dash. Digits are required on BOTH sides so that "Ił-76", "COVID-19"
        //    and "100-dolarowych" are not touched.
        s = JsRegex.Replace(s, RANGE, m => $"{m.Groups[1].Value} do ");

        // 10) SIGNS. Degrees take the same three-way agreement; the corpus instance is "+30°C".
        s = JsRegex.Replace(s, DEG_C, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)} Celsjusza");
        s = JsRegex.Replace(s, DEG_F, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)} Fahrenheita");
        s = JsRegex.Replace(s, DEG_BARE, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), DEGREE)}");
        // THE MINUS. ⚠ THE CORPUS CONTAINS NO TRUE NEGATIVE — every `-<digit>` in it is a RANGE
        //    (1000–1300), a SCORE (1977-1981), a DESIGNATION (ił-76) or a clock range. The rule is written anyway on
        //    the corpus is not the only input, and a dropped minus INVERTS a quantity rather than
        //    merely omitting it. What matters is that it fires on NONE of those instances, and the corpus diff is
        //    what verifies that rather than the guard looking plausible.
        //
        //    THREE GUARDS, each rejecting a shape this corpus actually contains:
        //      · a digit IMMEDIATELY AFTER the sign — rejects the spaced `- 2` form
        //      · a letter or digit IMMEDIATELY BEFORE — rejects `ił-76` and closed ranges
        //      · a digit ANYWHERE to the left — rejects the SPACED range or score (`26 - 00`), which the fleet's
        //        usual guard misses because the character before the hyphen is a SPACE. That gap cost a real defect
        //        in th, where a year range was read as a subtraction.
        //
        //    ⚠ WHAT NONE OF THEM CAN REJECT is a spaced DESIGNATION: `word -1` is the same shape as a genuine
        //    `was -5`, which is exactly why mr and nl decline the rule outright (see ACCEPTED_SIGN_SILENCE in
        //    defects.ts). This corpus has no such instance, so the rule is safe HERE — a fact about this corpus,
        //    not about the guard.
        var whole10 = s;
        s = JsRegex.Replace(s, MINUS, m =>
            DIGIT_AT_END.IsMatch(whole10[..m.Index]) ? m.Value : "minus ");
        // ⚠ ± TAKES TWO SIGN NAMES, so it is only expressible once BOTH the plus and the minus rules exist —
        //    both halves are taken from the rules in this file. ⚠ It needs its OWN rule: ± is a single character
        //    (U+00B1), not a `+`, so no `+` rule can match inside it and the sign would otherwise be dropped in
        //    silence.
        s = JsRegex.Replace(s, PLUSMINUS, _ => " plus minus ");
        s = JsRegex.Replace(s, PLUS, m => $"{m.Groups[1].Value}plus ");

        // 10b) THE RELATIONAL AND DIVISION SIGNS.

        //      ⚠ POLISH IS WHERE THE REGISTER RESTRICTION MADE THE ANSWER WORSE, and that is the finding worth
        //      keeping. `attest.ts --context "matematyka arytmetyka dzielenie"` returned `równa się` ABSENT — because
        //      pl.wikipedia's Dzielenie article is built out of LaTeX and never spells a reading out. Dropping the
        //      restriction found it immediately, in a mountain-prominence article of all places:
        //
        //        "«Sucha wybitność» Mauna Kea równa się «mokrej wybitności» (4205 m) powiększonej o głębokość …"
        //        "«Sucha wybitność» Aconcagui równa się mokrej wybitności (6962 m) plus głębokość …"
        //
        //      — a quantitative equality between measured values, with `plus` in the same sentence. The tier-4 rule
        //      is therefore NOT "search maths articles": it is *find the article class that has to state the
        //      quantity*, which is the same lesson `attest.ts`'s header records for ff's `kaaree` (place articles,
        //      not scholarly maths, because a place cannot state its subject without an area figure).
        //
        //      ⚠ AND `równa` IS THE SUBSTRING TRAP, SEVENTH INSTANCE: ×0 TOKEN / ×25 SUBSTRING in pl_pl, and all 25
        //      are `porównaniu` / `porównano` / `porównać` — the comparison verb, not the equality adjective.
        //
        //      The comparatives come from the corpus and take `niż` rather than `od`. Both are attested
        //      (`mniejsze niż` ×2, `mniejsze od` ×3, `większe niż` ×4) and they are not interchangeable here: `od`
        //      governs the GENITIVE while `numbers.ts` emits nominative cardinals, so `7 < 3` would read
        //      *mniejsze od trzy* with the wrong case. `niż` takes the nominative. Same repair Russian needed.
        //
        //      `podzielić przez` is the infinitive, which is how the division is dictated in Polish ("sześć
        //      podzielić przez trzy") and is what the wiki attests (×2, plus `dzielone przez` ×1); the participle
        //      `podzielone` is ×0 token / ×0 substring in the corpus, so the attested form is the one shipped.
        s = JsRegex.Replace(s, EQUALS, _ => " równa się ");
        s = JsRegex.Replace(s, LESS_THAN, _ => " mniejsze niż ");
        s = JsRegex.Replace(s, GREATER_THAN, _ => " większe niż ");
        s = JsRegex.Replace(s, DIVIDE, _ => " podzielić przez ");

        // 11) FRACTIONS — feminine, agreeing with the elided *część*: 1/5 is "jedna piąta". Digits on both
        //     sides only, so the corpus's " / " in "lokalizacji i / lub płeć" is untouched.
        s = JsRegex.Replace(s, FRACTION, m =>
        {
            var den = RomanOrdinals.Ordinal(Js.Number(m.Groups[2].Value));
            if (den is null || Js.Number(m.Groups[1].Value) != 1) return m.Value;
            return $"jedna {InflectOrdinal(den, "fem")}";
        });

        return s;
    }
}
