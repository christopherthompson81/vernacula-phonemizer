/**
 * Finnish (fi) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Finnish g2p cannot
 * already read into Finnish words the pipeline speaks. Pure text→text, no IPA. Runs BEFORE the shared symbol
 * tier, so digits stay digits and the tier can still see number–unit adjacency.
 *
 * Ported from src/languages/finnish/normalize.ts, whose header carries the whole evidential record: the
 * per-class corpus counts, the 333-context table behind the bare `N.` ordinal and its sentence-period
 * invariant, the colon-as-inflectional-joint census and the PRICED refusal of every oblique suffix, the
 * range and fraction refusals, why there is no comma-grouping arm (unlike sv/nb), the sourcing tiers for
 * every emitted word, and the letter names corroborated against the referee's own spelled acronyms.
 * Nothing is re-derived here.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Finnish;

public static class Normalize
{
    // ── DATA ────────────────────────────────────────────────────────────────

    /** ORDINALS 1–9 in FINAL position (the form a compound ends in) and the COMBINING form used everywhere
     *  else. Only 1 and 2 have two shapes. Every form is a referee lemma. */
    private static readonly string[] ORD_FINAL =
    [
        "", "ensimmäinen", "toinen", "kolmas", "neljäs", "viides", "kuudes", "seitsemäs", "kahdeksas",
        "yhdeksäs",
    ];
    private static readonly string[] ORD_COMB =
    [
        "", "yhdes", "kahdes", "kolmas", "neljäs", "viides", "kuudes", "seitsemäs", "kahdeksas", "yhdeksäs",
    ];
    private const string ORD_TEN = "kymmenes";
    private const string ORD_TEEN = "toista";
    private const string ORD_HUNDRED = "sadas";

    /** The Finnish ordinal for 1 … 999, or null outside it — an unclaimable number keeps its digits and its
     *  period rather than getting a guessed ending. ⚠ 999 IS THE CEILING because the thousands formant would
     *  be composing a form the referee does not carry. */
    public static string? Ordinal(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n > 999) return null;
        if (n < 10) return ORD_FINAL[(int)n];
        if (n == 10) return ORD_TEN;
        if (n < 20) return $"{ORD_COMB[(int)n - 10]}{ORD_TEEN}";
        if (n < 100)
        {
            var t = (int)Math.Floor(n / 10);
            var o = (int)(n % 10);
            return $"{ORD_COMB[t]}{ORD_TEN}{(o != 0 ? ORD_FINAL[o] : "")}";
        }
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        var hundreds = h == 1 ? ORD_HUNDRED : $"{ORD_COMB[h]}{ORD_HUNDRED}";
        return $"{hundreds}{(r != 0 ? Ordinal(r) : "")}";
    }

    /** Month names in the PARTITIVE — the case a Finnish date takes, and the form the corpus already writes
     *  in its 147 spelled-out dates. */
    private static readonly string[] MONTHS =
    [
        "", "tammikuuta", "helmikuuta", "maaliskuuta", "huhtikuuta", "toukokuuta", "kesäkuuta", "heinäkuuta",
        "elokuuta", "syyskuuta", "lokakuuta", "marraskuuta", "joulukuuta",
    ];
    private const string MONTH_LOOKAHEAD =
        "(?:tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuu\\p{L}*|päivä\\p{L}*";

    /** The decimal separator's NAME — two independent sources, and the sense read. */
    private const string DECIMAL_WORD = "pilkku";

    /** LETTER NAMES — 21 of the 29 corroborated by the referee's OWN IPA for 59 spelled-out acronyms. ⚠ THE
     *  ä-SERIES AND THE SHORT FORM are both the majority spelling there; either is a variant, not an error. */
    private static readonly Dictionary<string, string> LETTER_NAME = new()
    {
        ["a"] = "aa", ["b"] = "bee", ["c"] = "see", ["d"] = "dee", ["e"] = "ee", ["f"] = "äf", ["g"] = "gee",
        ["h"] = "hoo", ["i"] = "ii", ["j"] = "jii", ["k"] = "koo", ["l"] = "äl", ["m"] = "äm", ["n"] = "än",
        ["o"] = "oo", ["p"] = "pee", ["q"] = "kuu", ["r"] = "är", ["s"] = "äs", ["t"] = "tee", ["u"] = "uu",
        ["v"] = "vee", ["w"] = "kaksoisvee", ["x"] = "äks", ["y"] = "yy", ["z"] = "tseta",
        ["å"] = "ruotsalainen oo", ["ä"] = "ää", ["ö"] = "öö",
    };

    /** THE LONG (VOWEL-FINAL) FORM of the seven consonant-final names, used ONLY when a case suffix attaches
     *  to the last letter: `KTM:n` is *koo tee ÄMMÄN*, because gluing `n` to the short *äm* gives a
     *  word-final cluster Finnish does not have. */
    private static readonly Dictionary<string, string> LETTER_NAME_LONG = new()
    {
        ["f"] = "äffä", ["l"] = "ällä", ["m"] = "ämmä", ["n"] = "ännä", ["r"] = "ärrä", ["s"] = "ässä",
        ["x"] = "äksä",
    };

    /** Finnish phonotactics for the OOV rule. ⚠ THE CODA SET IS THE LOAD-BEARING ONE: a Finnish word ends in
     *  a vowel or a single ⟨n s t r l⟩, so left empty it would spell out `SARS`, which the referee records as
     *  a WORD. Onsets are the loan clusters only. */
    public static readonly Func<string, bool> IsUnreadableFinnish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouyäöå]", "u"),
        LegalOnsets = new HashSet<string>(
        [
            "bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps", "sk", "sp", "st",
            "tr", "tv",
        ], StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(
            ["ks", "ls", "ns", "nt", "rs", "rt", "st", "lt"], StringComparer.Ordinal),
    });

    /** LEXICAL: letter runs that ARE readable as Finnish words and are spelled out anyway. ⚠ `usa` and `ivy`
     *  are deliberately ABSENT — the referee records Finnish reading those two AS WORDS. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(["eu", "yk", "cia", "em", "ep"], StringComparer.Ordinal);

    /** DOTTED ABBREVIATIONS — `keepFinal` marks the ones that can end a sentence, where the period must
     *  survive as a pause. ⚠ EVERY DIGIT-SENSITIVE ONE CARRIES A LEFT GUARD, because the same two letters
     *  are a UNIT here (`mm.` is *muun muassa* AND the millimetre in the same 406 segments). */
    private static readonly (JsRe Re, string Word, bool KeepFinal)[] ABBREV =
    [
        // Multi-dot BEFORE single-dot, or the interior dot survives as a phrase break.
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])o\\.\\s?s\\.(?=\\s)", "gu"), "omaa sukua", false),
        // Era markers before the generic abbreviations, for the same ordering reason.
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])eaa\\.", "gu"), "ennen ajanlaskun alkua", true),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])jaa\\.", "gu"), "jälkeen ajanlaskun alun", true),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])(?<!\\d )s\\.(?=\\s+\\d)", "gu"), "syntynyt", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])(?<!\\d )k\\.(?=\\s+\\d)", "gu"), "kuollut", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])(?<!\\d )mm\\.(?=\\s)", "gu"), "muun muassa", false),
        // ⚠ THE DIGIT AND COLON GUARDS ARE NOT DECORATION — without `\d:` in the lookbehind
        // `korvasi Volvo 850:n.` read as "Volvo 850 noin".
        (JsRegex.Compile("(?<![\\p{L}\\p{M}\\d:])n\\.(?=\\s)", "gu"), "noin", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])[Vv]\\.(?=\\s+\\d)", "gu"), "vuonna", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])esim\\.", "gu"), "esimerkiksi", true),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])jne\\.", "gu"), "ja niin edelleen", true),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])väh\\.", "gu"), "vähintään", true),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])milj\\.", "gu"), "miljoonaa", true),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])lyh\\.", "gu"), "lyhenne", true),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])(?<=\\d )as\\.", "gu"), "asukasta", true),
        // Parenthesised LANGUAGE tags. ⚠ `keepFinal` is FALSE for all of them: a tag always INTRODUCES the
        // foreign name, so the shared "a capital follows ⇒ sentence end" heuristic reads exactly backwards.
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])engl\\.", "gu"), "englanniksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])ven\\.", "gu"), "venäjäksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])saks\\.", "gu"), "saksaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])arab\\.", "gu"), "arabiaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])jap\\.", "gu"), "japaniksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])kreik\\.", "gu"), "kreikaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])ital\\.", "gu"), "italiaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])kiin\\.", "gu"), "kiinaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])kor\\.", "gu"), "koreaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])ukr\\.", "gu"), "ukrainaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])puol\\.", "gu"), "puolaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])mong\\.", "gu"), "mongoliaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])arm\\.", "gu"), "armeniaksi", false),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])esp\\.", "gu"), "espanjaksi", false),
    ];

    // ── THE PASS ────────────────────────────────────────────────────────────

    private static bool IsDay(double d) => d >= 1 && d <= 31;
    private static bool IsMonth(double m) => m >= 1 && m <= 12;

    /** A clock's minute field. `01` is *nolla yksi* and `00` is *nolla nolla*; a bare `Number("01")` would
     *  lose the zero, which is a syllable Finnish says. */
    private static string Minutes(string mm)
    {
        var zero = Manifest.MANIFEST.Numbers.Zero;
        if (mm == "00") return $"{zero} {zero}";
        if (mm.StartsWith("0", StringComparison.Ordinal)) return $"{zero} {mm[1..]}";
        return mm;
    }

    private static readonly JsRe SPACE_GROUP =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[ \\u00a0\\u202f\\u2009](?=\\d{3}(?!\\d))", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe CLOSERS = JsRegex.Compile("^[\"”'’)\\]]+", "u");
    private static readonly JsRe SENTENCE_NEXT = JsRegex.Compile("^\\s+[\"“(]?\\p{Lu}", "u");

    private static readonly JsRe DOTTED_DATE_Y =
        JsRegex.Compile("(?<![\\d.,:])(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?!\\d)", "gu");
    private static readonly JsRe DOTTED_DATE =
        JsRegex.Compile("(?<![\\d.,:])(\\d{1,2})\\.(\\d{1,2})\\.(?!\\d)", "gu");
    private static readonly JsRe CLOCK =
        JsRegex.Compile("(?<=(?:kello|klo\\.?)\\s)(\\d{1,2})[.:](\\d{2})(?![\\d.,])", "giu");

    /** ⚠ THE GATE IS RIGHT AND ITS ADJACENCY WAS TOO TIGHT (#1114) — these two arms add CONTEXT the marker
     *  already licensed; they do not widen the marker. The sports times are still rejected by the `(?![\d.,])`
     *  tail, not by the marker, which is what makes the widening free. See the TS for the FLEURS counts. */
    private static readonly JsRe CLOCK_RANGE = JsRegex.Compile(
        "(?<=(?:kello|klo\\.?)\\s)(\\d{1,2})[.:](\\d{2})(\\s+ja\\s+)(\\d{1,2})[.:](\\d{2})(?![\\d.,])", "giu");
    private static readonly JsRe CLOCK_PAREN = JsRegex.Compile(
        "(?<=\\()(\\d{1,2})[.:](\\d{2})(?=\\s+(?:UTC|GMT|EET|EEST|koordinoitua)(?![\\p{L}\\p{M}]))", "giu");


    private static readonly string ORD_TAIL = $"(?=\\s+(?:{MONTH_LOOKAHEAD}|\\p{{Ll}}))";
    private static readonly JsRe ORDINAL_RANGE =
        JsRegex.Compile($"(?<![\\d.,:\\p{{L}}])(\\d{{1,3}})\\.\\s*[–—-]\\s*(\\d{{1,3}})\\.{ORD_TAIL}", "gu");
    private static readonly JsRe ORDINAL_BARE =
        JsRegex.Compile($"(?<![\\d.,:\\p{{L}}])(\\d{{1,3}})\\.{ORD_TAIL}", "gu");
    private static readonly JsRe ORDINAL_COLON =
        JsRegex.Compile("(?<![\\d.,:])(\\d{1,3}):s(?![\\p{L}\\p{M}])", "gu");

    private static readonly JsRe COLON_AFTER_DIGIT = JsRegex.Compile("(?<=\\d)\\s*:(?=[a-zåäö])", "gu");
    private static readonly JsRe COLON_AFTER_SYMBOL =
        JsRegex.Compile("(?<=[%²³]|°[CFcf])\\s*:[a-zåäö]+(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe COLON_AFTER_UNIT =
        JsRegex.Compile("(?<=\\d\\s?(?:kg|km|cm|mm|m))\\s*:[a-zåäö]+(?![\\p{L}\\p{M}])", "gu");

    private static readonly JsRe APOSTROPHE_GENITIVE =
        JsRegex.Compile("(?<=[bcdfghjklmnpqrstvwxz])['’](?=[a-zåäö]{1,4}(?![\\p{L}\\p{M}]))", "giu");

    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d),(\\d+)(?!\\d)", "gu");

    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEGREE_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEGREE_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile("(\\d)\\s*°", "gu");

    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])[-−–](?=\\d)", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])\\+(?=\\d)", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile("(?<=\\d)\\s*\\+\\s*(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("=", "gu");
    private static readonly JsRe LESS = JsRegex.Compile("<", "gu");
    private static readonly JsRe GREATER = JsRegex.Compile(">", "gu");

    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[ \\t]{2,}", "gu");

    public static string NormalizeFinnish(string input)
    {
        var t = input;

        // 1) SPACE-GROUPED THOUSANDS, FIRST — a space is a token boundary, so `1 786` reached the number
        //    path as TWO numerals. Exactly three digits per block, and looped to stability.
        string prev;
        do
        {
            prev = t;
            t = SPACE_GROUP.Replace(t, "");
        } while (t != prev);

        // 2) DOTTED ABBREVIATIONS — multi-dot before single-dot, era markers before the generic ones, and
        //    all of them BEFORE the initialism pass. ⚠ AND BEFORE THE DATE AND ORDINAL RULES: three arms are
        //    gated on a FOLLOWING FIGURE, and steps 3–5 turn that figure into a word (trap 39).
        foreach (var (re, word, keepFinal) in ABBREV)
        {
            var frozen = t;
            t = re.Replace(t, m =>
            {
                if (!keepFinal || !m.Value.EndsWith(".", StringComparison.Ordinal)) return word;
                var after = CLOSERS.Replace(frozen[(m.Index + m.Value.Length)..], "");
                return after.Trim() == "" || SENTENCE_NEXT.IsMatch(after) ? $"{word}." : word;
            });
        }

        // 3) DOTTED DATES, BEFORE the ordinal rule — otherwise its month/lowercase lookahead never fires and
        //    the three fields read as three cardinals separated by two clause pauses.
        t = DOTTED_DATE_Y.Replace(t, m =>
        {
            var d = Js.Number(m.Groups[1].Value);
            var mo = Js.Number(m.Groups[2].Value);
            return IsDay(d) && IsMonth(mo) && Ordinal(d) is { } ord
                ? $"{ord} {MONTHS[(int)mo]} {m.Groups[3].Value}"
                : m.Value;
        });
        t = DOTTED_DATE.Replace(t, m =>
        {
            var d = Js.Number(m.Groups[1].Value);
            var mo = Js.Number(m.Groups[2].Value);
            return IsDay(d) && IsMonth(mo) && Ordinal(d) is { } ord ? $"{ord} {MONTHS[(int)mo]}" : m.Value;
        });

        // 4) CLOCK, GATED ON THE MARKER WORD — the gate is the measurement: a bare-period clock rule would
        //    have fixed 3 and broken the 2 sports times.
        string? ClockBody(string h, string mm) =>
            Js.Number(h) < 24 && Js.Number(mm) < 60 ? $"{h} {Minutes(mm)}" : null;

        // 4a) THE RANGE FIRST, AND THE ORDER IS THE WHOLE OF IT. `kello 6.30 ja 7.30` is matched as ONE span
        //     so the marker licenses both operands — which means it must run BEFORE the single arm, or that
        //     arm has already rewritten `6.30` and the lookbehind no longer sees a digit to anchor on.
        t = CLOCK_RANGE.Replace(t, m =>
        {
            var a = ClockBody(m.Groups[1].Value, m.Groups[2].Value);
            var b = ClockBody(m.Groups[4].Value, m.Groups[5].Value);
            return a is not null && b is not null ? $"{a}{m.Groups[3].Value}{b}" : m.Value;
        });
        t = CLOCK.Replace(t, m => ClockBody(m.Groups[1].Value, m.Groups[2].Value) ?? m.Value);
        // 4b) THE PARENTHETICAL TIMEZONE GLOSS — keyed on the ZONE NAME rather than on the bracket, because
        //     a bracket alone licenses nothing. ⚠ `Noin 11.29` IS DELIBERATELY LEFT: `noin` is a general
        //     quantity hedge, not a time word, and one instance is not a marker.
        t = CLOCK_PAREN.Replace(t, m => ClockBody(m.Groups[1].Value, m.Groups[2].Value) ?? m.Value);

        // 5) THE BARE `N.` ORDINAL — the largest rule in the file. THE ORDINAL RANGE IS CLAIMED FIRST, or its
        //    LEFT operand is stranded and read as a cardinal; only the connective is refused.
        t = ORDINAL_RANGE.Replace(t, m =>
        {
            var x = Ordinal(Js.Number(m.Groups[1].Value));
            var y = Ordinal(Js.Number(m.Groups[2].Value));
            return x is not null && y is not null ? $"{x} {y}" : m.Value;
        });
        t = ORDINAL_BARE.Replace(t, m => Ordinal(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // 6) THE ORDINAL COLON SUFFIX `N:s` — the written `s` IS the nominative ending, so there is nothing
        //    to inflect. Restricted to `:s` on purpose; the oblique forms fall through to step 7.
        t = ORDINAL_COLON.Replace(t, m => Ordinal(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // 7) THE REMAINING COLON SUFFIXES — the PRICED REFUSAL. The colon is a morpheme joint and
        //    `clausePunctuation` reads it as a clause pause. ⚠ THE TWO ARMS DIFFER: after DIGITS the suffix
        //    survives as its own token, but after a SYMBOL a trailing letter makes the tier DECLINE the whole
        //    match, so the symbol arm drops the suffix with the colon.
        t = COLON_AFTER_DIGIT.Replace(t, "");
        t = COLON_AFTER_SYMBOL.Replace(t, "");
        t = COLON_AFTER_UNIT.Replace(t, "");

        // 8) THE APOSTROPHE GENITIVE. ⚠ GUARDED ON A CONSONANT BEFORE IT, because Finnish uses the SAME mark
        //    for its own vowel-hiatus boundary (`raa'asti`), where gluing would create a spurious long vowel.
        t = APOSTROPHE_GENITIVE.Replace(t, "");

        // 9) THE DECIMAL COMMA — the second-largest defect. ⚠ THE FRACTION KEEPS ITS DIGITS AND SO DOES THE
        //    INTEGER: the rule inserts ONE word, which is what preserves the number–unit adjacency the shared
        //    tier matches on.
        t = DECIMAL_COMMA.Replace(t, m =>
            $"{m.Groups[1].Value} {DECIMAL_WORD} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 10) DEGREES, BEFORE any rule that could claim the scale letter. ⚠ THE ARC-MINUTE `′` IS LEFT ALONE
        //     — reading the ring without the tick improves the degree and leaves that gap as it was.
        t = DEG_F_SIGN.Replace(DEG_C_SIGN.Replace(t, "°C"), "°F");
        t = DEGREE_C.Replace(t, "$1 astetta");
        t = DEGREE_F.Replace(t, "$1 astetta fahrenheitia");
        t = DEGREE_BARE.Replace(t, "$1 astetta");

        // 11) THE MINUS AND PLUS SIGNS — the fleet shape, and the width is a MEASUREMENT: the plain form
        //     scores 3 true / 0 false for the minus and 1/0 for the plus over the retained text.
        t = MINUS.Replace(t, "miinus ");
        t = PLUS.Replace(t, "plus ");
        t = PLUS_INFIX.Replace(t, " plus ");

        // 11b) THE RELATIONAL SIGNS — ×0 in this corpus, read anyway, because a DROPPED sign is inaudible.
        //      Both words come from the fi.wikipedia article that NAMES THE SIGN BESIDE THE WORD.
        //      ⚠ `÷` and `±` are REFUSED, and both refusals are findings — see the TS.
        t = GREATER.Replace(LESS.Replace(EQUALS.Replace(t, " yhtä suuri kuin "), " pienempi kuin "), " suurempi kuin ");

        // 12) THE AMPERSAND — spaced on both sides, always, or `B&B` fuses into one token.
        t = AMPERSAND.Replace(AMP_ENTITY.Replace(t, "&"), " ja ");

        // The insertions above pad with spaces so a word never fuses with its neighbours; collapse the runs.
        return MULTI_SPACE.Replace(t, " ");
    }

    /**
     * THE INITIALISM PASS — the third-largest class, and the one that produced the worst readings
     * (`MM-kilpailuissa` → *mː …*, where the gemination rule turned two letters into one long /mː/).
     * ⚠ ORDERING: it runs AFTER `NormalizeFinnish`, so the abbreviation dots are already spent, and after
     * the shared ROMAN pass, which wraps `Text()` because Finnish is not in `ROMAN_NATIVE`.
     */
    private static readonly Func<string, string> INITIALISMS =
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => LETTER_NAME.GetValueOrDefault(l),
            AcronymLetters = ACRONYM_LETTERS,
            // Finnish has no in-engine pronunciation dictionary, so every lexical fact lives in
            // ACRONYM_LETTERS above.
            IsRecorded = _ => false,
            IsUnreadable = IsUnreadableFinnish,
        });

    public static string NormalizeFinnishInitialisms(string text) => INITIALISMS(ResolveColonInflection(text));

    private static readonly JsRe COLON_HEAD =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu}[\\p{L}\\p{M}\\d]*):([a-zåäö]+)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ALL_CAPS = JsRegex.Compile("^\\p{Lu}{2,}$", "u");

    /**
     * THE COLON ON AN INITIALISM. Unlike the digit and symbol forms this one is fully resolvable and needs no
     * morphology: the suffix attaches to the SPOKEN form, whose last word is a letter name. Gluing the
     * WRITTEN suffix verbatim is deliberate — writers vary on the harmony, so reproducing what was typed is
     * the honest reading.
     */
    private static string ResolveColonInflection(string text) =>
        COLON_HEAD.Replace(text, m =>
        {
            var head = m.Groups[1].Value;
            var suf = m.Groups[2].Value;
            var glued = $"{head}{suf}";
            if (!ALL_CAPS.IsMatch(head)) return glued;
            var lower = Js.ToLowerCase(head);
            if (!ACRONYM_LETTERS.Contains(lower) && !IsUnreadableFinnish(lower)) return glued;
            var letters = Js.CodePoints(lower);
            var names = letters.Select((l, i) =>
                // The LAST letter takes the suffix, so it must end in a vowel — see LETTER_NAME_LONG.
                i == letters.Count - 1
                    ? LETTER_NAME_LONG.GetValueOrDefault(l) ?? LETTER_NAME.GetValueOrDefault(l)
                    : LETTER_NAME.GetValueOrDefault(l)).ToList();
            return names.All(n => n is not null) ? $"{string.Join(" ", names)}{suf}" : glued;
        });
}
