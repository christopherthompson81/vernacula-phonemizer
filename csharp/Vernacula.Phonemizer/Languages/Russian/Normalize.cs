/**
 * Russian (ru) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/russian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Russian;

public static class Normalize
{
    private const string GROUP_SPACE = "    ";

    /**
     * Written case ending → the ordinal's full ending, for a HARD-stem ordinal (пятый, шестой, сороковой) and
     * for the one soft stem among them (третий).
     */
    private static readonly IReadOnlyDictionary<string, string[]> CASE_ENDING = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
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

    /** Integer → the masculine-nominative ordinal, extended past `russianOrdinal`'s own 1–100 range. */
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
        // JS `forms[0] || last.slice(stem.length)` — the empty hard ending is FALSY in JS, so it falls back
        // to whatever the lemma already carries (the "й" row, where the base form IS the nominative).
        words[^1] = stem + (soft ? forms[1] : forms[0].Length > 0 ? forms[0] : last[stem.Length..]);
        return string.Join(" ", words);
    }

    /**
     * ⚠ Every boundary in this file is an explicit lookaround, never `\b`: the JS `\b` this port reproduces is
     * defined on ASCII word characters and finds none against Cyrillic, so a rule written with it matches
     * nothing at all. Do not "simplify" a lookaround back to `\b` here.
     */

    /** Russian phonotactics, for the OOV rule in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableRussian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{Manifest.MANIFEST.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Codas, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms spelled out. Authored in russian.jsonc beside the other hand-authored facts. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => Manifest.MANIFEST.LetterNames.TryGetValue(l, out var v) ? v : null,
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

    /** Dotted abbreviations → the full word. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["г"] = "года", ["гг"] = "годов", ["в"] = "века", ["вв"] = "веков",
        ["ул"] = "улица", ["им"] = "имени", ["стр"] = "страница", ["проф"] = "профессор", ["акад"] = "академик",
        ["руб"] = "рублей", ["тыс"] = "тысяч", ["млн"] = "миллионов", ["млрд"] = "миллиардов",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe GROUP_1 = JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d\\.,])0)[{GROUP_SPACE}](?=\\d{{3}}(?!\\d))", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space
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

    // ⚠ THE CASE TEST CANNOT LIVE IN THE PATTERN: the abbreviation itself needs `i`, and `\p{Ll}`/`\p{Lu}`
    // inside an `i` regex case-fold and match either case. Hence the callback at the use site.
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

        s = GROUP_1.Replace(s, "");
        s = GROUP_1.Replace(s, "");
        s = SPACES.Replace(s, " ");

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

        s = NUMERO.Replace(s, "номер ");

        s = ORDINAL_NOTATION.Replace(s, m =>
        {
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            if (bas is null) return m.Value;
            return InflectOrdinal(bas, m.Groups[2].Value.ToLowerInvariant()) ?? m.Value;
        });

        s = YEAR_G.Replace(s, "$1 $2 году");

        s = ABBREV_MID.Replace(s, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122). The pattern is built from this table's OWN keys but
            // carries `i`+`u`, so JS's fold widens it — `ſ`→`s`, and the Cyrillic `ᲀᲃᲅ` forms onto theirs —
            // and a near-miss MATCHES while its key is absent. The TS asserted non-null and spoke the word
            // "undefined"; this indexer THREW. Refuse the whole match.
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        s = ABBREV_END.Replace(s, m =>
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}." : m.Value);

        s = KM_H.Replace(s, "$1 километров в час");
        s = M_S.Replace(s, "$1 метров в секунду");
        // ⚠ THE LOWERCASE SCALE LETTERS ARE IN THE CHARACTER CLASS, NOT AN `i` FLAG — under `i` the class
        // folds and would also reject uppercase, quietly narrowing what the rule claims.
        s = DEG_C.Replace(s, "$1 градусов Цельсия");
        s = DEG_F.Replace(s, "$1 градусов Фаренгейта");
        s = DEG.Replace(s, "$1 градусов");

        s = CLOCK.Replace(s, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = $"{Numbers.NumberToWords(hv)} {Counted(hv, HOUR)}";
            return mv == 0 ? head : $"{head} {Numbers.NumberToWords(mv)} {Counted(mv, MINUTE)}";
        });

        s = MINUS.Replace(s, "$1минус $2");
        s = PLUS_MINUS.Replace(s, " плюс минус ");
        s = PLUS_ATTACHED.Replace(s, "$1 плюс $2");
        s = PLUS_LEADING.Replace(s, "$1плюс $2");

        s = EQUALS.Replace(s, " равно ");
        s = LESS_THAN.Replace(s, " меньше чем ");
        s = GREATER_THAN.Replace(s, " больше чем ");
        s = DIVIDE.Replace(s, " разделить на ");

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
