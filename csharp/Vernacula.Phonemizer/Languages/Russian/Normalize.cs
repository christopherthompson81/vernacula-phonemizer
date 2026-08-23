/**
 * Russian (ru) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE HARD PART IS ORDINAL NOTATION. Russian writes `5-е`, `1-й`, `1970-х`, `3-м`, and the suffix is NOT
 * an ordinal marker — it is the CASE ENDING. `5-е` is пятое (neuter nominative), `5-го` пятого (genitive),
 * `1970-х` семидесятых (genitive plural). So the rule reads the ending off the text and INFLECTS the
 * ordinal to match, rather than concatenating: what is written is the last letters of the full form, not a
 * suffix that can be appended. Unclaimed, each of these speaks the bare letter as a word — `5-е` comes out
 * [pʲætʲ je], "five ye".
 *
 * Already correct and untouched: dates take a plain cardinal day, the decimal comma reads as *целых*
 * (1,5 → один целых пять), % carries proper Slavic count agreement through the shared symbol tier
 * (процент / процента / процентов), and Roman numerals arrive already converted at the registry seam —
 * with `russian/romanOrdinals.ts` supplying the ORDINAL reading a century wants, so `XV век` is already
 * *пятнадцатый век*. That also means the roman-vs-initialism ordering hazard cannot arise here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Russian;

public static class Normalize
{
    private const string GROUP_SPACE = "    ";

    /**
     * Written case ending → the ordinal's full ending, for a HARD-stem ordinal (пятый, шестой, сороковой) and
     * for the one soft stem among them (третий). The written form shows only the last letters, so this maps
     * back to the whole ending rather than appending.
     */
    private static readonly IReadOnlyDictionary<string, string[]> CASE_ENDING = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        // written        hard      soft (третий)
        ["й"] = new[] { "", "ий" }, // masculine nominative — the base form already
        ["е"] = new[] { "ое", "ье" }, ["ое"] = new[] { "ое", "ье" },
        ["я"] = new[] { "ая", "ья" }, ["ая"] = new[] { "ая", "ья" },
        ["го"] = new[] { "ого", "ьего" }, ["ого"] = new[] { "ого", "ьего" },
        ["м"] = new[] { "ом", "ьем" }, ["ом"] = new[] { "ом", "ьем" },
        ["му"] = new[] { "ому", "ьему" }, ["ому"] = new[] { "ому", "ьему" },
        ["х"] = new[] { "ых", "ьих" }, ["ых"] = new[] { "ых", "ьих" },
        ["ю"] = new[] { "ую", "ью" }, ["ую"] = new[] { "ую", "ью" },
        ["ой"] = new[] { "ой", "ьей" }, ["ей"] = new[] { "ой", "ьей" },
        ["ые"] = new[] { "ые", "ьи" }, ["ие"] = new[] { "ые", "ьи" },
        ["ым"] = new[] { "ым", "ьим" }, ["ыми"] = new[] { "ыми", "ьими" },
    };

    /** Longest first, so `ого` is not matched as `го`. */
    private static readonly string CASE_ALT = string.Join("|", CASE_ENDING.Keys.OrderByDescending(k => k.Length));

    /**
     * Integer → the masculine-nominative ordinal, extended past `russianOrdinal`'s own 1–100 range. ⚠ ONLY THE
     * LAST ELEMENT INFLECTS in Russian, so a larger number is its cardinal head plus the ordinal of its final
     * ≤100 part: 1970 → "тысяча девятьсот" + семидесятый. That is what `1970-х` needs, and `russianOrdinal`
     * alone returns undefined there.
     */
    private static string? OrdinalBase(double n)
    {
        var direct = double.IsInteger(n) && n >= int.MinValue && n <= int.MaxValue ? RomanOrdinals.RussianOrdinal((int)n) : null;
        if (direct is not null) return direct;
        var rest = n % 100;
        if (rest == 0) return null; // a round hundred/thousand needs сотый/тысячный — not attempted
        var tail = double.IsInteger(rest) ? RomanOrdinals.RussianOrdinal((int)rest) : null;
        if (tail is null) return null;
        return $"{Numbers.NumberToWords(n - rest)} {tail}";
    }

    private static readonly JsRe ORD_STEM = JsRegex.Compile("(ый|ой|ий)$", "u");

    /** Inflect a masculine-nominative ordinal to the case the written suffix marks. */
    private static string? InflectOrdinal(string bas, string written)
    {
        if (!CASE_ENDING.TryGetValue(written, out var forms)) return null;
        var words = bas.Split(' ').ToList();
        var last = words[^1];
        var soft = last.EndsWith("ий", StringComparison.Ordinal); // третий is the only soft stem in the 1–19 table
        var stem = ORD_STEM.Replace(last, "");
        // JS `forms[0] || last.slice(stem.length)` — the empty hard ending falls back to whatever the lemma
        // already carries (the "й" row, where the base form IS the nominative).
        words[^1] = stem + (soft ? forms[1] : forms[0].Length > 0 ? forms[0] : last[stem.Length..]);
        return string.Join(" ", words);
    }

    /** Cyrillic letter names, for initialisms. США is [эс ша а], ДНК [дэ эн ка], ТВ [тэ вэ]. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["а"] = "а", ["б"] = "бэ", ["в"] = "вэ", ["г"] = "гэ", ["д"] = "дэ", ["е"] = "е", ["ё"] = "ё",
        ["ж"] = "жэ", ["з"] = "зэ", ["и"] = "и", ["й"] = "и краткое", ["к"] = "ка", ["л"] = "эль",
        ["м"] = "эм", ["н"] = "эн", ["о"] = "о", ["п"] = "пэ", ["р"] = "эр", ["с"] = "эс", ["т"] = "тэ",
        ["у"] = "у", ["ф"] = "эф", ["х"] = "ха", ["ц"] = "цэ", ["ч"] = "че", ["ш"] = "ша", ["щ"] = "ща",
        ["ы"] = "ы", ["э"] = "э", ["ю"] = "ю", ["я"] = "я",
    };

    /** NOTE: every boundary in this file is an explicit lookaround, never `\b` — `\b` is defined on ASCII
     *  word characters and finds none against Cyrillic, so a rule written with it silently matches nothing.
     *  The same trap has now appeared in French, Hindi, Bengali, Mandarin and here, including inside
     *  core/initialisms.ts itself, which this run had to fix. */

    /** Russian phonotactics, for the OOV rule in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableRussian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аеёиоуыэюя]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "бл", "бр", "вл", "вр", "гл", "гр", "дв", "др", "жд", "зв", "зд", "кл", "кр", "пл", "пр",
            "сл", "см", "сн", "сп", "ст", "тр", "фл", "фр", "хл", "хр", "цв", "шк", "шл", "шп", "шт", "щи",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ст", "сть", "нт", "нд", "нс", "рт", "рд", "рс", "рн", "рм", "лт", "лд", "лс", "кт", "кс",
            "пт", "фт", "зд", "зн", "сн", "см", "тр", "др", "бр", "вр", "гр", "пр", "кр", "нк", "нг",
        }, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms spelled out. Authored in russian.jsonc beside the other hand-authored facts. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableRussian(w),
    });

    /** Russian's lexicon is a STRESS dictionary, not a wordlist of attested forms, so it cannot serve as the
     *  "is this recorded" test. Acronyms are decided by the lexical list plus the OOV rule alone. */
    public static string NormalizeRussianInitialisms(string text) => InitialismNormalizer(text);

    /** Slavic count agreement for a counted noun: [nominative sg, paucal, genitive pl]. */
    private static string Counted(double n, string[] forms) =>
        forms[Math.Min(NormalizeSymbols.SlavicCountForm(n), 2)];

    private static readonly string[] HOUR = { "час", "часа", "часов" };
    private static readonly string[] MINUTE = { "минута", "минуты", "минут" };

    /** Abbreviations. `г.`/`гг.` are the frequent ones (×10) and were reading as a bare [k]. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["г"] = "года", ["гг"] = "годов", ["в"] = "века", ["вв"] = "веков",
        ["ул"] = "улица", ["им"] = "имени", ["стр"] = "страница", ["проф"] = "профессор", ["акад"] = "академик",
        ["руб"] = "рублей", ["тыс"] = "тысяч", ["млн"] = "миллионов", ["млрд"] = "миллиардов",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe GROUP_1 = JsRegex.Compile($"(\\d)[{GROUP_SPACE}](\\d{{3}})(?!\\d)", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");
    private static readonly JsRe ORDINAL_NOTATION = JsRegex.Compile($"\\b(\\d+)\\s?-\\s?({CASE_ALT})(?![а-яё])", "giu");
    private static readonly JsRe YEAR_G = JsRegex.Compile("(?<![\\p{L}\\p{M}])(в|во)\\s+(\\d+)\\s*г\\.", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe KM_H = JsRegex.Compile("(\\d)\\s?км\\/ч(?![а-яё])", "giu");
    private static readonly JsRe M_S = JsRegex.Compile("(\\d)\\s?м\\/с(?![а-яё])", "giu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?[CСcс](?![а-яё])", "gu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?[FФfф](?![а-яё])", "gu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("\\b([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!,\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})\\/(\\d{1,3})\\b(?!\\s*[/\\d])", "gu");
    private static readonly JsRe ODIN_FINAL = JsRegex.Compile("один$", "u");
    private static readonly JsRe DVA_FINAL = JsRegex.Compile("два$", "u");
    private static readonly JsRe CLOSING_PUNCT = JsRegex.Compile("[,;:!?)»]", "u");
    private static readonly JsRe UPPER = JsRegex.Compile("\\p{Lu}", "u");

    // ⚠ The abbreviation itself needs `i` (both `н. э.` and `Н. Э.` occur) but the CASE TEST cannot live in
    // the pattern: `\p{Ll}`/`\p{Lu}` inside an `i` regex case-fold and match either case, so a lookahead
    // written that way fired on "Затем" and ate the sentence boundary. Hence the callback below.
    private static readonly List<(JsRe Re, string Words)> MULTI_DOT = new List<(string, string)>
    {
        ("до\\s+н\\.\\s?э", "до нашей эры"),
        ("н\\.\\s?э", "нашей эры"),
        ("т\\.\\s?е", "то есть"),
        ("т\\.\\s?д", "так далее"),
        ("т\\.\\s?п", "тому подобное"),
    }.Select(x => (JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){x.Item1}\\.(\\s*)(\\S?)", "giu"), x.Item2)).ToList();

    /** Normalize one Russian input string. Pure text→text. */
    public static string NormalizeRussian(string input)
    {
        var s = input;

        // 0) DIGIT GROUPING with a space — the Russian convention, and the number token cannot span a space, so
        //    "5 000 лет" read as "пять ноль лет".
        s = GROUP_1.Replace(s, "$1$2");
        s = GROUP_1.Replace(s, "$1$2");
        s = SPACES.Replace(s, " ");

        // 1) MULTI-DOT ABBREVIATIONS, before the single-letter rule so `н. э.` and `т. е.` are claimed whole —
        //    their interior dots were becoming phrase breaks.
        //
        //    THE TRAILING DOT IS TWO DIFFERENT THINGS and the first version consumed it unconditionally, so
        //    "в 200 г. н. э. Затем…" ran straight into the next sentence with the boundary GONE. Found by the
        //    Ukrainian run, which hit the identical bug in its own first pass and reported it here.
        //    The discriminator is CASE, which a cased script gives for free: a lowercase word or a digit after
        //    the dot continues the sentence, so the dot was the abbreviation's own and is consumed; an
        //    uppercase word or end-of-input means it was doing double duty as the sentence end, so it stays.
        //    Following punctuation already carries the break, so the dot is consumed there too rather than
        //    doubled (`н. э.,` was emitting both a `.` and a `,`).
        foreach (var (re, words) in MULTI_DOT)
        {
            s = re.Replace(s, m =>
            {
                var sp = m.Groups[1].Value;
                var next = m.Groups[2].Value;
                if (next == "") return $"{words}."; // end of input ⇒ it was the sentence end
                if (CLOSING_PUNCT.IsMatch(next)) return $"{words}{sp}{next}"; // the mark carries the break
                if (UPPER.IsMatch(next)) return $"{words}.{sp}{next}"; // a new sentence starts
                return $"{words}{sp}{next}"; // the sentence continues
            });
        }

        // 2) НОМЕР. The sign was dropped outright.
        s = NUMERO.Replace(s, "номер ");

        // 3) ORDINAL NOTATION. The suffix is the CASE ending, not an appendable marker (see the file header).
        s = ORDINAL_NOTATION.Replace(s, m =>
        {
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            if (bas is null) return m.Value;
            return InflectOrdinal(bas, m.Groups[2].Value.ToLowerInvariant()) ?? m.Value;
        });

        // 3b) `г.` after a year is года, EXCEPT after the preposition в, which governs the prepositional
        //     году ("в 2007 г." = в 2007 году). All three corpus instances are year contexts — none is the
        //     city sense of г., which would need a different expansion and does not occur here.
        s = YEAR_G.Replace(s, "$1 $2 году");

        // 4) DOTTED ABBREVIATIONS. The dot is consumed so it cannot become a phrase break.
        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        // 5) UNITS the shared tier cannot express: the Cyrillic slash unit and the degree signs.
        s = KM_H.Replace(s, "$1 километров в час");
        s = M_S.Replace(s, "$1 метров в секунду");
        // ⚠ THE LOWERCASE SCALE LETTERS GO IN THE CLASS, NOT IN AN `i` FLAG. `[а-яё]` is the guard against a
        //    SPELLED-OUT scale name (`30 °Cельсия` — the ⟨C⟩ is the word's first letter, not the symbol), and
        //    under `i` that property folds to reject uppercase Cyrillic too, quietly narrowing what the rule
        //    will claim. The class carries both cases of both alphabets instead.
        s = DEG_C.Replace(s, "$1 градусов Цельсия");
        s = DEG_F.Replace(s, "$1 градусов Фаренгейта");
        s = DEG.Replace(s, "$1 градусов");

        // 6) CLOCK. The colon was a clause mark, so "11:00" read as "одиннадцать , ноль". час and минута take
        //    Slavic count agreement (1 час / 2 часа / 5 часов).
        //    Guarded against a SPORTS time: "2:11,60 минуты" is 2 minutes 11.60 seconds, not two o'clock, and
        //    the corpus contains one. A comma-plus-digit after the minutes marks decimal seconds.
        s = CLOCK.Replace(s, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = $"{Numbers.NumberToWords(hv)} {Counted(hv, HOUR)}";
            return mv == 0 ? head : $"{head} {Numbers.NumberToWords(mv)} {Counted(mv, MINUTE)}";
        });

        // 7) SIGNS.
        s = MINUS.Replace(s, "$1минус $2");
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
        s = PLUS_MINUS.Replace(s, " плюс минус ");
        s = PLUS_ATTACHED.Replace(s, "$1 плюс $2");
        s = PLUS_LEADING.Replace(s, "$1плюс $2");

        // 7b) RELATIONAL AND DIVISION SIGNS. ⚠ THE SOURCE HERE IS A PRONUNCIATION GLOSS, which is the strongest
        //     shape this kind of evidence takes: the arithmetic articles do not merely use these words, they
        //     QUOTE THE SPOKEN READING of the notation beside the notation itself —
        //
        //       6 : 3 = 2    («шесть разделить на три равно два»)
        //       «два плюс два равно четыре»
        //
        //     ⚠ AND THE CORPUS EVIDENCE FOR `равно` IS THE WRONG SENSE: ×4 in ru_ru and every hit is the
        //     conjunction `равно как и`. A COUNT-ONLY PASS WOULD HAVE CALLED IT CORPUS-SOURCED.
        //     ⚠ THE COMPARATIVES TAKE `чем` RATHER THAN THE BARE GENITIVE, a grammatical requirement:
        //     `меньше` governs the GENITIVE and numbers.ts emits NOMINATIVE cardinals, so `7 < 3` would read
        //     *семь меньше три*. The `чем` construction takes the nominative.
        s = EQUALS.Replace(s, " равно ");
        s = LESS_THAN.Replace(s, " меньше чем ");
        s = GREATER_THAN.Replace(s, " больше чем ");
        s = DIVIDE.Replace(s, " разделить на ");

        // 8) FRACTIONS — feminine, agreeing with the elided *часть*: 1/5 is «одна пятая».
        s = FRACTION.Replace(s, m =>
        {
            double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
            if (num == 1 && den == 2) return "одна вторая";
            var bas = OrdinalBase(den);
            if (bas is null) return m.Value;
            var fem = InflectOrdinal(bas, "я");
            var numWord = DVA_FINAL.Replace(ODIN_FINAL.Replace(Numbers.NumberToWords(num), "одна"), "две");
            return fem is null ? m.Value : $"{numWord} {fem}";
        });

        return s;
    }
}
