/**
 * Belarusian (be) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/belarusian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Belarusian;

public static class Normalize
{
    private static BelarusianDef DEF => Manifest.DEF;
    private static BelarusianNumbers NUM => DEF.Numbers;

    /** The cardinal as words — the same composer the engine's number path uses, so an ordinal's head reads
     *  exactly as a bare numeral would (`1950` → *тысяча дзевяцьсот*). */
    private static string Cardinal(double n) =>
        string.Join(" ", Ukrainian.Numbers.eastSlavicNumberWords(n, NUM).Select(w => w ?? "")).Trim();

    /** Pick a three-form Slavic count noun for `n` (nom.sg / nom.pl 2–4 / gen.pl). */
    private static string Counted(double n, string[] forms) =>
        forms[Math.Min(NormalizeSymbols.SlavicCountForm(n), 2)];

    /**
     * Masculine-nominative ordinals. `саракавы` is the one STRESSED-ENDING stem and takes the velar-shaped
     * set, listed separately rather than guessed at (see the TS for the per-word attestations).
     */
    private static readonly string[] ORD_1_19 =
    [
        "", "першы", "другі", "трэці", "чацвёрты", "пяты", "шосты", "сёмы", "восьмы", "дзявяты",
        "дзясяты", "адзінаццаты", "дванаццаты", "трынаццаты", "чатырнаццаты", "пятнаццаты",
        "шаснаццаты", "сямнаццаты", "васямнаццаты", "дзевятнаццаты",
    ];
    private static readonly string[] ORD_TENS =
    [
        "", "дзясяты", "дваццаты", "трыццаты", "саракавы", "пяцідзясяты", "шасцідзясяты", "сямідзясяты",
        "васьмідзясяты", "дзевяносты",
    ];
    private static readonly string[] ORD_HUNDREDS =
    [
        "", "соты", "двухсоты", "трохсоты", "чатырохсоты", "пяцісоты", "шасцісоты", "сямісоты",
        "васьмісоты", "дзевяцісоты",
    ];
    private static readonly string[] ORD_THOUSANDS =
    [
        "", "тысячны", "двухтысячны", "трохтысячны", "чатырохтысячны", "пяцітысячны", "шасцітысячны",
        "сямітысячны", "васьмітысячны", "дзевяцітысячны",
    ];

    /**
     * Integer → the masculine-nominative ordinal. Only the LAST element inflects (as in Russian and
     * Ukrainian, unlike Polish).
     */
    private static string? OrdinalBase(double n)
    {
        if (!double.IsInteger(n) || n < 1) return null;
        if (n < 20) return ORD_1_19[(int)n];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            return u == 0 ? ORD_TENS[(int)t] : $"{NUM.Tens[Js.NumberToString(t * 10)]} {ORD_1_19[(int)u]}";
        }
        if (n < 1000)
        {
            var r = n % 100;
            return r == 0 ? ORD_HUNDREDS[(int)(n / 100)] : $"{Cardinal(n - r)} {OrdinalBase(r)}";
        }
        if (n < 10_000 && n % 1000 == 0) return ORD_THOUSANDS[(int)(n / 1000)];
        if (n < 1_000_000)
        {
            var r = n % 1000;
            if (r == 0) return null; // a round ten-thousand needs its own stem; not attempted
            return $"{Cardinal(n - r)} {OrdinalBase(r)}";
        }
        return null;
    }

    /**
     * The three ordinal paradigms — HARD, VELAR (a ⟨г⟩ stem), SOFT — plus the STRESSED set for `саракавы`.
     * Ordered by how likely the reading is, because the written suffix is matched with `EndsWith` and
     * several forms share a final letter.
     */
    private static readonly string[] END_HARD = ["ы", "ага", "аму", "ым", "ае", "ыя", "ых", "ая", "ай", "ымі"];
    private static readonly string[] END_VELAR = ["і", "ога", "ому", "ім", "ое", "ія", "іх", "ая", "ой", "імі"];
    private static readonly string[] END_SOFT = ["і", "яга", "яму", "ім", "яе", "ія", "іх", "яя", "яй", "імі"];
    private static readonly string[] END_STRESSED = ["ы", "ога", "ому", "ым", "ое", "ыя", "ых", "ая", "ой", "ымі"];

    private static readonly JsRe VELAR_STEM = JsRegex.Compile("[гкх]і$", "u");

    /** Every case form of the ordinal for `n`, in preference order. Only the final word inflects. */
    private static List<string> OrdinalForms(double n)
    {
        var bas = OrdinalBase(n);
        if (bas is null) return new List<string>();
        var words = bas.Split(' ');
        var last = words[^1];
        var stem = last[..^1]; // every citation form above ends in a single -ы or -і
        var endings = last == "саракавы" ? END_STRESSED
            : VELAR_STEM.IsMatch(last) ? END_VELAR
            : last.EndsWith("і", StringComparison.Ordinal) ? END_SOFT
            : END_HARD;
        var head = string.Join(" ", words[..^1]);
        return endings.Select(e => $"{(head.Length > 0 ? head + " " : "")}{stem}{e}").ToList();
    }

    /**
     * GENITIVE cardinals — the oblique half of the numeral-plus-suffix notation. The `EndsWith` guard at
     * the call site is what makes both halves safe: a candidate that does not end with the letters the
     * writer typed is never chosen.
     */
    private static readonly string[] GEN_1_19 =
    [
        "", "аднаго", "двух", "трох", "чатырох", "пяці", "шасці", "сямі", "васьмі", "дзевяці",
        "дзесяці", "адзінаццаці", "дванаццаці", "трынаццаці", "чатырнаццаці", "пятнаццаці",
        "шаснаццаці", "сямнаццаці", "васямнаццаці", "дзевятнаццаці",
    ];
    private static readonly string[] GEN_TENS =
    [
        "", "дзесяці", "дваццаці", "трыццаці", "сарака", "пяцідзесяці", "шасцідзесяці", "сямідзесяці",
        "васьмідзесяці", "дзевяноста",
    ];

    private static string? GenitiveCardinal(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n >= 100) return null;
        if (n < 20) return GEN_1_19[(int)n];
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? GEN_TENS[(int)t] : $"{GEN_TENS[(int)t]} {GEN_1_19[(int)u]}";
    }

    /** Belarusian letter names — the corpus's caps runs (ВУП, ДНС, ЗША, ААН, СНД, …) reached the g2p as
     *  raw consonant clusters without them. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["а"] = "а", ["б"] = "бэ", ["в"] = "вэ", ["г"] = "гэ", ["ґ"] = "гэ", ["д"] = "дэ", ["е"] = "е",
            ["ё"] = "ё", ["ж"] = "жэ", ["з"] = "зэ", ["і"] = "і", ["й"] = "і кароткае", ["к"] = "ка",
            ["л"] = "эль", ["м"] = "эм", ["н"] = "эн", ["о"] = "о", ["п"] = "пэ", ["р"] = "эр", ["с"] = "эс",
            ["т"] = "тэ", ["у"] = "у", ["ў"] = "у нескладовае", ["ф"] = "эф", ["х"] = "ха", ["ц"] = "цэ",
            ["ч"] = "чэ", ["ш"] = "ша", ["ы"] = "ы", ["ь"] = "мяккі знак", ["э"] = "э", ["ю"] = "ю", ["я"] = "я",
        };

    /** NOTE: every boundary in this file is an explicit lookaround, never `\b` — `\b` is defined on ASCII
     *  word characters and finds none against Cyrillic, so a rule written with it silently matches nothing. */

    /** Belarusian phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
    public static readonly Func<string, bool> IsUnreadableBelarusian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аеёіоуыэюя]", "u"),
        LegalOnsets = new HashSet<string>(
        [
            "бл", "бр", "вл", "вр", "гл", "гр", "гн", "дв", "др", "дн", "дз", "дж", "жд", "зв", "зд",
            "зл", "зм", "зн", "зр", "кл", "кн", "кр", "кв", "мн", "пл", "пр", "сл", "см", "сн", "сп",
            "ст", "св", "тр", "тв", "фл", "фр", "хл", "хр", "цв", "шк", "шл", "шп", "шт", "шч",
        ], StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(
        [
            "ст", "нт", "нд", "нс", "рт", "рд", "рс", "рн", "рм", "лт", "лд", "лс", "кт", "кс",
            "пт", "фт", "зд", "зн", "сн", "см", "нк", "нг", "лм", "лк", "рк", "рг", "рх", "нь",
            "сь", "ць", "ў", "йк", "ск", "шч",
        ], StringComparer.Ordinal),
    });

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
        // Spelled out despite being pronounceable — the corpus's own runs. ВУП (GDP) and ААН (the UN) are
        // vowel-rich and would otherwise be read as words.
        AcronymLetters = new HashSet<string>(
            ["вуп", "ааэ", "аан", "снд", "пар", "бнр", "уп", "сп", "ес", "зша", "ссср"], StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableBelarusian(w),
    });

    /** Belarusian has no pronunciation dictionary (its g2p is a flat rule scan), so the "is this recorded"
     *  test cannot be answered — acronyms are decided by the lexical list plus the OOV rule alone. */
    public static string NormalizeBelarusianInitialisms(string text) => InitialismNormalizer(text);

    private static readonly string[] METRE = ["метр", "метры", "метраў"];
    private static readonly string[] DEGREE = ["градус", "градусы", "градусаў"];

    /**
     * The magnitude abbreviations, with the four forms a Belarusian numeral governs (the fourth is the
     * genitive singular a DECIMAL takes). `млрд` before `млн` by length is the declaration order, and each
     * abbreviation is its own rule.
     */
    private static readonly (string Abbr, string[] Forms)[] MAGNITUDE_ABBREV =
    [
        ("млрд", new[] { "мільярд", "мільярды", "мільярдаў", "мільярда" }),
        ("трлн", new[] { "трыльён", "трыльёны", "трыльёнаў", "трыльёна" }),
        ("млн", new[] { "мільён", "мільёны", "мільёнаў", "мільёна" }),
        ("тыс", new[] { "тысяча", "тысячы", "тысяч", "тысячы" }),
    ];

    private static readonly JsRe HAS_SEPARATOR = JsRegex.Compile("[.,]", "u");

    /** Select the form a written quantity governs — the decimal takes the genitive singular, which is a fourth
     *  slot the three-way Slavic selector cannot express (the 2–4 slot here is the nominative plural). */
    private static string MagnitudeForm(string written, string[] forms) =>
        HAS_SEPARATOR.IsMatch(written) ? forms[3] : forms[Math.Min(NormalizeSymbols.SlavicCountForm(Js.Number(written)), 2)];

    /**
     * Abbreviations whose dot is NOT a sentence end. ⚠ `г.` and `с.` and `м.` are deliberately ABSENT: all
     * three are ambiguous in this corpus and are handled by a digit-anchored rule or refused outright
     * (see the TS header for the counted facts).
     */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["гг"] = "гадоў", ["ст"] = "стагоддзя", ["стст"] = "стагоддзяў", ["нар"] = "нарадзіўся",
            ["пам"] = "памёр", ["інш"] = "іншае", ["тыс"] = "тысяч", ["напр"] = "напрыклад", ["гл"] = "глядзі",
            ["вул"] = "вуліца", ["дол"] = "долараў",
        };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private const string NOT_LETTER = "(?![\\p{L}\\p{M}'\u2019\u02bc])";
    private const string GROUP_SPACE = " \u00a0\u202f\u2009";

    private static readonly JsRe DEGROUP_SPACE = JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d\\.,])0)[{GROUP_SPACE}](?=\\d{{3}}(?!\\d))", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile($"[{GROUP_SPACE}]", "gu");

    /**
     * The multi-word dotted abbreviations, in the TS declaration order — `да н. э.` must be tried before
     * `н. э.` or the longer reading is unreachable.
     */
    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    [
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}да\\s+н\\.\\s?э\\.", "giu"), "да нашай эры"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}н\\.\\s?э\\.", "giu"), "нашай эры"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}і\\s+г\\.\\s?д\\.", "giu"), "і гэтак далей"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}т\\.\\s?зв\\.", "giu"), "так званы"),
    ];
    private static readonly JsRe SENTENCE_TAIL = JsRegex.Compile("^\\s*[\"\u00bb)']?\\s*$", "u");
    private static readonly JsRe NUMERO = JsRegex.Compile("\u2116\\s?(?=\\d)", "gu");
    private static readonly JsRe KM_PER_HOUR = JsRegex.Compile("(\\d)\\s?(?:км\\s?/\\s?(?:гадз|год|г)|км/ч)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe YEAR_G = JsRegex.Compile($"(\\d)\\s?г\\.{NOT_LETTER}", "gu");
    private static readonly JsRe YEAR_GG = JsRegex.Compile($"(\\d)\\s?гг\\.{NOT_LETTER}", "gu");
    private static readonly JsRe SUFFIXED = JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s?-\\s?([а-яёіў]{{1,3}}){NOT_LETTER}", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d(])", "giu");
    private static readonly JsRe ABBREV_COMMA = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*[,;:])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.!?\u00bb)]|$))", "giu");
    private static readonly JsRe M_S = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?м\\/с(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe METRE_RE = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?м(?![\\p{L}\\p{M}'\u2019\u02bc\u00b2\u00b3/])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?\u00b0\\s?[CС](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?\u00b0\\s?[FФ](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d+)\\s?\u00b0", "gu");
    private static readonly JsRe CLOCK_3 = JsRegex.Compile("(?<![\\d:])(\\d{1,2}):([0-5]\\d):([0-5]\\d)(?![:\\d])", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-\u2212\u2013](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\u00b1", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\d)\\s?=\\s?", "gu");
    private static readonly JsRe EQUALS_LEFT = JsRegex.Compile("\\s?=\\s?(?=\\d)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s?<\\s?(?=\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s?>\\s?(?=\\d)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\d)\\s?\u00f7\\s?(?=\\d)", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d\\p{L}/.,])(\\d{1,2})\\/(\\d{1,2})(?![\\d/\\p{L}.,])", "gu");
    private static readonly JsRe ADZIN_FINAL = JsRegex.Compile("адзін$", "u");
    private static readonly JsRe DVA_FINAL = JsRegex.Compile("два$", "u");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s?[\u2013\u2014-]\\s?(?=\\d)", "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?![\\d.\\p{L}])", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Belarusian input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeBelarusian(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, FIRST — two passes, because adjacent groups share the digit the first consumes.
        s = Rewrite(s, DEGROUP_SPACE, "");
        s = Rewrite(s, DEGROUP_SPACE, "");
        s = Rewrite(s, SPACES, " ");

        // 1) MULTI-DOT ABBREVIATIONS, before the single-dot rule (step 4). The FINAL dot is kept when the
        //    abbreviation ends the sentence, or the corpus's sentence-final pause is lost outright.
        foreach (var (re, word) in MULTI_DOT)
        {
            var subject = s;
            s = Rewrite(s, re, m =>
            {
                var rest = subject[(m.Index + m.Length)..];
                return SENTENCE_TAIL.IsMatch(rest) ? $"{word}." : word;
            });
        }

        // 2) НУМАР.
        s = Rewrite(s, NUMERO, "нумар ");

        // 3) THE YEAR ABBREVIATION, digit-anchored — the rate rule runs FIRST and takes its `г` off the table.
        s = Rewrite(s, KM_PER_HOUR, "$1 кіламетраў на гадзіну");
        s = Rewrite(s, YEAR_G, "$1 года");
        s = Rewrite(s, YEAR_GG, "$1 гадоў");

        // 3b) THE MAGNITUDE ABBREVIATIONS, with the count agreement the numeral governs, so the tier still
        //     sees a magnitude between the figure and any unit that follows.
        foreach (var (abbr, forms) in MAGNITUDE_ABBREV)
        {
            var re = JsRegex.Compile($"(\\d+(?:[.,]\\d+)?)\\s?{abbr}\\.?{NOT_LETTER}", "gu");
            s = Rewrite(s, re, m =>
            {
                var n = m.Groups[1].Value;
                return $"{n} {MagnitudeForm(n, forms)}";
            });
        }

        // 4) DOTTED ABBREVIATIONS — the dot is consumed before a following word or a comma so it cannot
        //    become a phrase break; at a real sentence end it is kept.
        s = Rewrite(s, ABBREV_MID, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = Rewrite(s, ABBREV_COMMA, m => DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]);
        s = Rewrite(s, ABBREV_END, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        // 5) NUMERAL + WRITTEN SUFFIX — the ordinal notation AND the oblique cardinal in one notation; the
        //    written letters choose, and a form that does not end with the typed suffix is never returned.
        s = Rewrite(s, SUFFIXED, m =>
        {
            var whole = m.Value;
            var n = Js.Number(m.Groups[1].Value);
            var suffix = m.Groups[2].Value.ToLowerInvariant();
            // `-мі` and `-ці` are cardinal-only endings in this notation; everything else prefers the ordinal.
            var cardinalFirst = suffix == "мі" || suffix == "ці";
            var gen = GenitiveCardinal(n);
            if (cardinalFirst) return gen is not null && gen.EndsWith(suffix, StringComparison.Ordinal) ? gen : whole;
            var form = OrdinalForms(n).FirstOrDefault(f => f.EndsWith(suffix, StringComparison.Ordinal));
            if (form is not null) return form;
            return gen is not null && gen.EndsWith(suffix, StringComparison.Ordinal) ? gen : whole;
        });

        // 6) UNITS THE SHARED SYMBOL TIER CANNOT EXPRESS — `м` is claimed HERE rather than declared, with an
        //    explicit guard; `г` and `с` are not units in this language's text.
        s = Rewrite(s, M_S, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Math.Truncate(Js.Number(Js.ReplaceFirst(n, ",", "."))), METRE)} на секунду";
        });
        s = Rewrite(s, METRE_RE, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Math.Truncate(Js.Number(Js.ReplaceFirst(n, ",", "."))), METRE)}";
        });

        // 7) DEGREES, before the sign rules. ⚠ THE LETTER MAY BE CYRILLIC OR LATIN — the class carries both
        //    ⟨C⟩ and ⟨С⟩, which are different characters that render identically.
        s = Rewrite(s, DEG_C, "$1 градусаў Цэльсія");
        s = Rewrite(s, DEG_F, "$1 градусаў Фарэнгейта");
        s = Rewrite(s, DEG, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(n), DEGREE)}";
        });

        // 8) CLOCK — a `:00` minute is not read as *нуль*; two-digit minutes are REQUIRED. A third field
        //    means a timestamp: the colons are spent on spaces and nothing is invented.
        s = Rewrite(s, CLOCK_3, "$1 $2 $3");
        s = Rewrite(s, CLOCK, m =>
        {
            var whole = m.Value;
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = Cardinal(hv);
            if (head == "") return whole;
            return mv == 0 ? head : $"{head} {Cardinal(mv)}";
        });

        // 9) SIGNS — the corpus writes the true MINUS (U+2212) and the en-dash as well as the hyphen.
        s = Rewrite(s, MINUS, "$1мінус $2");
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
        s = Rewrite(s, PLUS_MINUS, " плюс-мінус ");
        s = Rewrite(s, PLUS, "$1плюс $2");

        // 10) RELATIONAL AND DIVISION SIGNS — `=` requires a DIGIT on one side, and that guard is the whole
        //     rule (the bibliographic title separators).
        s = Rewrite(s, EQUALS, "$1 ёсць ");
        s = Rewrite(s, EQUALS_LEFT, " ёсць ");
        s = Rewrite(s, LESS_THAN, "$1 менш за ");
        s = Rewrite(s, GREATER_THAN, "$1 больш за ");
        s = Rewrite(s, DIVIDE, "$1 падзяліць на ");

        // 11) FRACTIONS — feminine, agreeing with the elided *частка*; BOUNDED AT A DENOMINATOR OF TEN, and
        //     the bound is the evidence (every `\d+/\d+` in the corpus is an alternative date).
        s = Rewrite(s, FRACTION, m =>
        {
            var whole = m.Value;
            double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
            if (den < 2 || den > 10 || num < 1 || num >= den) return whole;
            // ⚠ THE DENOMINATOR AGREES WITH THE NUMERATOR, not merely with the elided noun — the three-way
            // selector every count noun in this file takes, on the feminine ordinal forms.
            var slot = new[] { 7, 5, 6 }[Math.Min(NormalizeSymbols.SlavicCountForm(num), 2)]; // fem.nom · nom.pl · gen.pl
            var forms = OrdinalForms(den);
            if (slot >= forms.Count) return whole; // JS `ordinalForms(den)[slot]` is `undefined` and the rule declines
            var numWord = DVA_FINAL.Replace(ADZIN_FINAL.Replace(Cardinal(num), "адна"), "дзве");
            return $"{numWord} {forms[slot]}";
        });

        // 12) NUMERIC RANGES — digits are required on BOTH sides so `COVID-19` cannot match; NOTHING may be
        //     required after the second number (`на глыбіні 100—200 м.` is how this corpus ends a sentence).
        s = Rewrite(s, RANGE, "$1 да ");

        // 13) DOT DECIMALS → the comma form the engine's number token reads. The trailing guard rejects a
        //     LETTER, which is what keeps the train model and the mobile standard out.
        s = Rewrite(s, DOT_DECIMAL, "$1,$2");

        // A padded replacement doubles a space that was already there — collapse the runs.
        return Rewrite(s, DOUBLE_SPACE, " ");
    }
}
