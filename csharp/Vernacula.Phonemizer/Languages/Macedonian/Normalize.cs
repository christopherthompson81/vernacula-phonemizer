/**
 * Macedonian (mk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Macedonian
 * engine cannot already read into words the existing pipeline speaks. Pure text→text; no IPA. Runs inside
 * Macedonian.cs's `Text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS mk_mk CORPUS (1,857 unique utterances). The conventions that break the naive
 * pipeline, and the full sourcing for each, are in the TypeScript original — src/languages/macedonian/
 * normalize.ts. In brief:
 *
 *   · GROUPING IS A PERIOD and the DECIMAL is a comma (`400.000`, `6,5`) — but the corpus also uses
 *     comma-thousands in English-influenced spots (`1,400 луѓе`). A comma followed by exactly 3 digits is
 *     grouping; 1–2 digits is a decimal. The period form is de-grouped here; the comma stays adjacent for
 *     the shared symbol tier and the TOKEN, like Czech.
 *   · THE ORDINAL IS A SUFFIX, not a dot — `17-ти век`, `18-тиот век`, `37-ма`, `1970-тите години`. The
 *     written suffix is the LAST letters of the spoken ordinal and encodes GENDER + DEFINITENESS. Only the
 *     LAST element of a compound ordinalizes.
 *
 * ORDERING COUPLINGS, each a bug that happened:
 *   · de-grouping FIRST — a period/space is otherwise a token boundary or clause mark.
 *   · multi-dot era markers BEFORE the single-dot year rule, and before the `N г.` expansion.
 *   · the ordinal-suffix rule BEFORE the century/date rules, which would otherwise claim the digits.
 *   · the range rule BEFORE the clock rule, so `22:00-23:00` becomes "22:00 до 23:00" first.
 *   · personal-initial single capitals BEFORE the initialism pass (which would otherwise see the dot).
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Macedonian;

public static class Normalize
{
    private const string GROUP_SPACE = " \u00a0\u202f\u2009";  // space, NBSP, NNBSP, thin space

    /** The months — dates read the day as an ordinal. */
    private static readonly IReadOnlyList<string> MONTHS = new[]
    {
        "јануари", "февруари", "март", "април", "мај", "јуни", "јули",
        "август", "септември", "октомври", "ноември", "декември",
    };

    /** Macedonian letter names — Cyrillic, plus the Latin letters that appear in embedded initialisms
     *  (GPS → ге пе ес, DVD → де ве де). Personal initials read through the same map. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["а"] = "а", ["б"] = "бе", ["в"] = "ве", ["г"] = "ге", ["д"] = "де", ["ѓ"] = "ѓе", ["е"] = "е",
            ["ж"] = "же", ["з"] = "зе", ["ѕ"] = "ѕе", ["и"] = "и", ["ј"] = "је", ["к"] = "ка", ["л"] = "ел",
            ["љ"] = "ље", ["м"] = "ем", ["н"] = "ен", ["њ"] = "ње", ["о"] = "о", ["п"] = "пе", ["р"] = "ер",
            ["с"] = "ес", ["т"] = "те", ["ќ"] = "ќе", ["у"] = "у", ["ф"] = "еф", ["х"] = "ха", ["ц"] = "це",
            ["ч"] = "че", ["џ"] = "џе", ["ш"] = "ша",
            ["a"] = "а", ["b"] = "бе", ["c"] = "це", ["d"] = "де", ["e"] = "е", ["f"] = "еф", ["g"] = "ге",
            ["h"] = "ха", ["i"] = "и", ["j"] = "је", ["k"] = "ка", ["l"] = "ел", ["m"] = "ем", ["n"] = "ен",
            ["o"] = "о", ["p"] = "пе", ["q"] = "ку", ["r"] = "ер", ["s"] = "ес", ["t"] = "те", ["u"] = "у",
            ["v"] = "ве", ["w"] = "даблве", ["x"] = "икс", ["y"] = "ипсилон", ["z"] = "зет",
        };

    /** Macedonian phonotactics for the OOV "can this be read as a word" test. ⚠ The vowel class carries
     *  BOTH the Cyrillic vowels and the Latin ones: the embedded-Latin initialisms the corpus writes
     *  (ASUS, PALM, MINAE, JAS) are READ as foreign words and so must be "readable", while a vowel-less
     *  Latin run (GPS, DVD, CCTV, XDR) is letter-spelled by the OOV rule. Onset/coda sets carry both
     *  scripts for the same reason. */
    public static readonly Func<string, bool> IsUnreadableMacedonian = Initialisms.MakeUnreadableTest(
        new PhonotacticsData
        {
            Vowels = JsRegex.Compile("[аеиоуaeiou]", "u"),
            LegalOnsets = new HashSet<string>(new[]
            {
                "бл", "бр", "вл", "вр", "гл", "гр", "дв", "др", "жв", "жд", "зб", "зг", "зд", "зл", "зм",
                "зн", "зр", "кл", "кн", "кр", "мн", "мр", "пл", "пр", "пс", "пт", "ск", "сл", "см", "сн",
                "сп", "ст", "св", "тв", "тр", "фл", "фр", "хл", "хм", "хр", "цв", "цр", "шк", "шл", "шм",
                "шн", "шп", "шт", "шв",
                "bl", "br", "vl", "vr", "gl", "gr", "dv", "dr", "zd", "zl", "zm", "zn", "zr", "kl", "kn",
                "kr", "mn", "mr", "pl", "pr", "ps", "pt", "sk", "sl", "sm", "sn", "sp", "st", "sv", "tv",
                "tr", "fl", "fr", "xl", "xm", "xr", "ts", "tʃ", "ʃk", "ʃl", "ʃm", "ʃn", "ʃp", "ʃt", "ʃv",
                "st", "spr", "str",
            }, StringComparer.Ordinal),
            LegalCodas = new HashSet<string>(new[]
            {
                "ст", "ск", "зд", "зн", "зл", "зм", "шт", "жв", "жб", "рт", "рк", "рд", "рс", "рн", "рл",
                "рм", "рв", "лт", "лд", "лс", "лм", "нт", "нд", "нк", "нг", "мп", "цк", "цт", "чк", "чм", "пс",
                "st", "sk", "zd", "zn", "zl", "zm", "ʃt", "rt", "rk", "rd", "rs", "rn", "rl", "rm", "rv",
                "lt", "ld", "ls", "lm", "nt", "nd", "nk", "ng", "mp", "ts", "tʃ", "ps", "ks", "ŋ", "ndʒ",
            }, StringComparer.Ordinal),
        });

    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.DEF.AcronymLetters, StringComparer.Ordinal);

    /** Macedonian has no pronunciation dictionary (its g2p is rule-based), so IsRecorded is always false. */
    public static string NormalizeMacedonianInitialisms(string text) =>
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = _ => false,
            IsUnreadable = w => IsUnreadableMacedonian(w),
        })(text);

    // ── Ordinal transforms ───────────────────────────────────────────────────
    private static readonly JsRe LAST_WORD = JsRegex.Compile("(\\S+)$", "u");
    private static readonly JsRe LAST_WORD_I = JsRegex.Compile("(\\S+)и$", "u");

    /** Masculine definite: append the postpositive article -от to the LAST word (осумнаесетти →
     *  осумнаесеттиот). For compounds only the last element takes it (дваесет и првиот). */
    private static string MascDef(string b) => JsRegex.Replace(b, LAST_WORD, "$1от");
    /** Feminine indefinite: the last word's -и → -а (седми → седма, први → прва, илјадити → илјадита). */
    private static string FemIndef(string b) => JsRegex.Replace(b, LAST_WORD_I, "$1а");
    /** Feminine definite: append -та to the last word (прва → првата, трета → третата). */
    private static string FemDef(string b) => JsRegex.Replace(FemIndef(b), LAST_WORD, "$1та");
    /** Definite plural: append -те to the last word (седумдесетти → седумдесеттите). */
    private static string PluralDef(string w) => JsRegex.Replace(w, LAST_WORD, "$1те");

    private enum SuffixKind { MascIndef, MascDef, FemIndef, FemDef, Count, Decade, Approx }

    /**
     * The written ordinal suffix → how to build the full form from the number's masculine-indefinite
     * ordinal. ⚠ `-та` is feminine DEFINITE for ordinary numbers (првата, третата) but for a round
     * thousand/million the feminine indefinite already ends in -та (илјадита), because the corpus's
     * `1.000-та поштенска марка` reads "илјадита" — the preceding possessive carries the definiteness.
     */
    private static SuffixKind KindOf(string suffix) => suffix switch
    {
        "тиот" or "миот" or "виот" or "риот" or "от" => SuffixKind.MascDef,
        "ма" => SuffixKind.FemIndef,
        "та" => SuffixKind.FemDef,
        "тите" or "ите" => SuffixKind.Decade,
        "тина" => SuffixKind.Approx,
        "те" => SuffixKind.Count,   // the caller decides decade-vs-count via the following word
        _ => SuffixKind.MascIndef,  // ти / ви / ми / ри
    };

    private static readonly JsRe DEGROUP_DOT =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe DEGROUP_SPACE =
        JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d\\.,])0)[{GROUP_SPACE}](?=\\d{{3}}(?!\\d))", "gu");
    private static readonly JsRe ERA_BEFORE_1 = JsRegex.Compile("пр\\.\\s*н\\.\\s*е\\.", "giu");
    private static readonly JsRe ERA_BEFORE_2 = JsRegex.Compile("п\\.\\s*н\\.\\s*е\\.", "giu");
    private static readonly JsRe ERA_OUR = JsRegex.Compile("(?<![\\p{L}\\p{M}])н\\.\\s*е\\.", "giu");
    private static readonly JsRe YEAR_GOD = JsRegex.Compile("(\\d+)\\s*год\\.", "gu");
    private static readonly JsRe YEAR_G = JsRegex.Compile("(\\d+)\\s*г\\.", "gu");
    private static readonly JsRe ITN = JsRegex.Compile("(?<![\\p{L}\\p{M}])итн\\.(?=\\s|$|[,.;:!?»\"')])", "giu");
    private static readonly JsRe TE = JsRegex.Compile("(?<![\\p{L}\\p{M}])т\\.е\\.", "giu");
    private static readonly JsRe GDIN = JsRegex.Compile("[Гг]-дин(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DR = JsRegex.Compile("[Дд]-р(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe FIGURE_DOT = JsRegex.Compile("(\\d)\\.(\\d+)(?!\\d)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)", "gu");
    private static readonly JsRe CLOCK =
        JsRegex.Compile("([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!,\\d)(\\s*ч(?!\\p{L})\\.?)?", "gu");
    private static readonly JsRe AM = JsRegex.Compile("\\bam\\b", "giu");
    private static readonly JsRe PM = JsRegex.Compile("\\bpm\\b", "giu");
    private static readonly JsRe ORD_SUFFIX = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])(\\d+)\\s*-?\\s*(тите|тиот|миот|виот|риот|тина|ите|от|ти|ви|ми|ри|та|ма|те)(?!\\p{L})",
        "gu");
    private static readonly JsRe FOLLOWS_GODINI = JsRegex.Compile("^\\s*години", "gu");
    private static readonly JsRe CENTURY_PAIR = JsRegex.Compile("(\\d+)\\s+и\\s+(\\d+)\\s*век(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe CENTURY = JsRegex.Compile("(\\d+)\\s*век(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe CENTURY_DOT = JsRegex.Compile("(\\d+)\\.\\s*век(?![\\p{L}\\p{M}])", "gu");
    private static readonly string MONTH_ALT = string.Join("|", MONTHS);
    private static readonly JsRe DATE_RANGE = JsRegex.Compile(
        $"(\\d{{1,2}})\\s+({MONTH_ALT})\\s*[-–—]\\s*(\\d{{1,2}})\\s+({MONTH_ALT})(?![\\p{{L}}\\p{{M}}])", "giu");
    private static readonly JsRe DATE =
        JsRegex.Compile($"(\\d{{1,2}})(?:\\.)?\\s+({MONTH_ALT})(?![\\p{{L}}\\p{{M}}])", "giu");
    private static readonly JsRe REGNAL =
        JsRegex.Compile("(\\p{Lu}\\p{Ll}+\\p{M}*)[ \u00a0](\\d{1,2})(?![,\\d])(?=\\.?[.,;:!?]|$)", "gu");  // space, NBSP
    private static readonly JsRe MILJI = JsRegex.Compile("(\\d+)\\s*милји\\s*\\/\\s*час(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MPH = JsRegex.Compile("(\\d+)\\s*mph(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe KPH = JsRegex.Compile("(\\d+)\\s*kph(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MBIT = JsRegex.Compile("(\\d+)\\s*Mbit\\/s(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MM2 = JsRegex.Compile("(\\d+)\\s*мм\\s*[²2](?!\\d)", "gu");
    private static readonly JsRe KM2 = JsRegex.Compile("(\\d+)\\s*км\\s*[²2](?!\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d+)\\s*°\\s*C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d+)\\s*°\\s*F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_W = JsRegex.Compile("(\\d+)\\s*°\\s*W(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_E = JsRegex.Compile("(\\d+)\\s*°\\s*E(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)\\s*°", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−]\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(?=\\d)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s*÷\\s*", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s*=\\s*", "gu");
    private static readonly JsRe LESS = JsRegex.Compile("\\s*<\\s*", "gu");
    private static readonly JsRe GREATER = JsRegex.Compile("\\s*>\\s*", "gu");
    private static readonly JsRe AMP = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe PH = JsRegex.Compile("(?<![\\p{L}\\p{M}])pH(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe GHZ = JsRegex.Compile("(?<![\\p{L}\\p{M}])Ghz(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe FRAC_34 = JsRegex.Compile("(\\d+)¾", "gu");
    private static readonly JsRe FRAC_12 = JsRegex.Compile("(\\d+)½", "gu");
    private static readonly JsRe FRAC_14 = JsRegex.Compile("(\\d+)¼", "gu");
    private static readonly JsRe UNIT_FRACTION =
        JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\/(\\d{1,2})(?![\\d.,])", "gu");
    private static readonly JsRe INITIAL_AFTER_COMMA =
        JsRegex.Compile("(?<=,\\s)([А-ШЃЅЈЉЊЌЏ])\\.(?=\\s+[А-Ш]\\p{Ll})", "gu");
    private static readonly JsRe LONE_LATIN_CAPITAL =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])([A-Z])(?![\\p{L}\\p{M}])", "gu");

    /**
     * Normalize one Macedonian input string. Pure text→text. Runs BEFORE the shared symbol tier (which
     * needs the number still adjacent to its unit/sign), and the initialism pass runs after it.
     */
    public static string NormalizeMacedonian(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, first — a period/space is otherwise a token boundary or clause mark. The
        //    comma stays: it is BOTH the decimal separator (6,5) and a thousands separator in the
        //    English-influenced spots (1,400) — the TOKEN distinguishes them by block length, like Czech.
        //    ⚠ TWO PASSES, not a fixed point: this is the TS's own `for (let i = 0; i < 2; i++)`.
        for (var i = 0; i < 2; i++) s = Rewrite(s, DEGROUP_DOT, "");
        for (var i = 0; i < 2; i++) s = Rewrite(s, DEGROUP_SPACE, "");

        // 1) ERA MARKERS (multi-dot) BEFORE the single-dot year rule, so the interior dots never reach
        //    clausePunctuation as breaks: `356 г. п.н.е.` → "356 година пред нашата ера".
        s = Rewrite(s, ERA_BEFORE_1, "пред нашата ера");
        s = Rewrite(s, ERA_BEFORE_2, "пред нашата ера");
        s = Rewrite(s, ERA_OUR, "од нашата ера");

        // 2) YEAR ABBREVIATION `N г.` / `N год.` → "N година" (a specific year) or "N години" (a count or
        //    age — the corpus's one small instance "25 г., и Заха" is an age).
        s = Rewrite(s, YEAR_GOD, m => $"{m.Groups[1].Value} {(Js.Number(m.Groups[1].Value) >= 100 ? "година" : "години")}");
        s = Rewrite(s, YEAR_G, m => $"{m.Groups[1].Value} {(Js.Number(m.Groups[1].Value) >= 100 ? "година" : "години")}");

        // 3) SINGLE-DOT / HYPHEN ABBREVIATIONS. Hyphenated, so they do not collide with the year rule.
        s = Rewrite(s, ITN, "и така натаму");
        s = Rewrite(s, TE, "то ест");
        s = Rewrite(s, GDIN, "господин");
        s = Rewrite(s, DR, "доктор");

        // 4) VERSION / FIGURE DOTS between digits — `802.11n`, `Слика 1.1`, `14.7 милијарди`, `12.00 GMT`
        //    — were breaking the sentence at the interior dot. Read as "точка" (point).
        s = Rewrite(s, FIGURE_DOT, "$1 точка $2");

        // 5) NUMERIC RANGES, BEFORE the clock — including `22:00-23:00` → "22:00 до 23:00" so the times
        //    are claimed whole. ⚠ The LEFT side must be ≥2 digits (or both single) so an alphanumeric
        //    designation like `II-76` (→ "2-76" after the shared Roman pass) is not read as a range.
        s = Rewrite(s, RANGE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            if (a.Length == 1 && b.Length > 1) return m.Value; // "2-76" — a designation, not a range
            return $"{a} до {b}";
        });

        // 6) CLOCK. The colon is otherwise clause punctuation, so `06:30` reads as "шест , триесет".
        //    Macedonian reads the time CARDINALLY with "и": 6:30 = "шест и триесет"; `:00` drops the
        //    minutes. The trailing "часот"/"ч" is kept. A comma after the minutes marks a sports time.
        s = Rewrite(s, CLOCK, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            var body = mv == 0 ? Numbers.NumberToText(hv) : $"{Numbers.NumberToText(hv)} и {Numbers.NumberToText(mv)}";
            // ⚠ The optional `ч` group participates only for "23:35 ч". The TS distinguishes by ARGUMENT
            // TYPE because the replacer's args shift; here the group's own Success flag says it directly.
            return m.Groups[3].Success ? $"{body} часот" : body;
        });
        // 6b) `am`/`pm` after a time → претпладне/попладне. Standalone words (the clock already consumed
        //     the digits), matched on word boundaries so "Сами" is untouched.
        s = Rewrite(s, AM, "претпладне");
        s = Rewrite(s, PM, "попладне");

        // 7) THE ORDINAL SUFFIX, the largest class in this file. ⚠ The `-те` suffix is ambiguous between a
        //    count ("the N") and a decade: a 4-digit number followed by "години" is a decade, otherwise
        //    it is "the N".
        {
            var subject = s;
            s = Rewrite(s, ORD_SUFFIX, m =>
            {
                var digits = m.Groups[1].Value;
                var suffix = m.Groups[2].Value;
                var n = Js.Number(digits);
                var bas = Numbers.MkOrdinal(n);
                if (bas is null) return m.Value;
                var kind = KindOf(suffix);
                if (kind == SuffixKind.Decade) return PluralDef(bas);
                if (kind == SuffixKind.Approx)
                {
                    if (n % 10 != 0) return m.Value;
                    return $"{Numbers.NumberToText(n)}ина"; // дваесет → дваесетина
                }
                if (kind == SuffixKind.Count)
                {
                    var rest = subject[(m.Index + m.Length)..];
                    if (n >= 1000 && FOLLOWS_GODINI.IsMatch(rest)) return PluralDef(bas); // decade
                    return PluralDef(Numbers.NumberToText(n));                            // "the N"
                }
                return kind switch
                {
                    SuffixKind.MascDef => MascDef(bas),
                    SuffixKind.FemIndef => FemIndef(bas),
                    SuffixKind.FemDef => n % 1000 == 0 ? FemIndef(bas) : FemDef(bas),
                    _ => bas, // MascIndef
                };
            });
        }

        // 8) CENTURY — `N век` → ordinal + век, including the compound list `10 и 11 век`, and the one
        //    Germanic remnant `8. век`. The suffix forms are already claimed by step 7.
        s = Rewrite(s, CENTURY_PAIR, m =>
        {
            var oa = Numbers.MkOrdinal(Js.Number(m.Groups[1].Value));
            var ob = Numbers.MkOrdinal(Js.Number(m.Groups[2].Value));
            return oa is not null && ob is not null ? $"{oa} и {ob} век" : m.Value;
        });
        s = Rewrite(s, CENTURY, m =>
        {
            var o = Numbers.MkOrdinal(Js.Number(m.Groups[1].Value));
            return o is null ? m.Value : $"{o} век";
        });
        s = Rewrite(s, CENTURY_DOT, m =>
        {
            var o = Numbers.MkOrdinal(Js.Number(m.Groups[1].Value));
            return o is null ? m.Value : $"{o} век";
        });

        // 9) DATES — `N <month>` → ordinal + month, including a date range and the Germanic-dot form
        //    `4. јули 1776`. The day must be 1–31.
        s = Rewrite(s, DATE_RANGE, m =>
        {
            var oa = Numbers.MkOrdinal(Js.Number(m.Groups[1].Value));
            var ob = Numbers.MkOrdinal(Js.Number(m.Groups[3].Value));
            if (oa is null || ob is null) return m.Value;
            return $"{oa} {m.Groups[2].Value} до {ob} {m.Groups[4].Value}";
        });
        s = Rewrite(s, DATE, m =>
        {
            var dv = Js.Number(m.Groups[1].Value);
            var o = dv >= 1 && dv <= 31 ? Numbers.MkOrdinal(dv) : null;
            return o is null ? m.Value : $"{o} {m.Groups[2].Value}";
        });

        // 10) REGNAL ORDINALS. The shared Roman pass has already rewritten the corpus's three Romans to
        //     CARDINAL digits before this engine runs. The digit after a capitalised NAME is read as an
        //     ordinal. ⚠ The FEMININE form follows a feminine-marked name (names in -а): "Елизабета 2" →
        //     "Втора". Guards, each from a corpus false positive: the digit must be 2–39 (a regnal
        //     "first" is not written as a roman, and "Формула 1" is Formula ONE), must be followed by
        //     PUNCTUATION or end, and must not open a comma-grouped thousands run ("Од 1,400 луѓе").
        s = Rewrite(s, REGNAL, m =>
        {
            var name = m.Groups[1].Value;
            var n = Js.Number(m.Groups[2].Value);
            var o = Numbers.MkOrdinal(n);
            if (o is null || n < 2 || n > 39) return m.Value;
            return $"{name} {(name.EndsWith("а", StringComparison.Ordinal) ? FemIndef(o) : o)}";
        });

        // 11) RATE UNITS the shared tier cannot compose. ⚠ The Cyrillic squared units `мм2`/`км2` are local
        //     because the tier's exponent lookbehind is ASCII-only and the corpus writes `3136 мм2`.
        s = Rewrite(s, MILJI, "$1 милји на час");
        s = Rewrite(s, MPH, "$1 милји на час");
        s = Rewrite(s, KPH, "$1 километри на час");
        s = Rewrite(s, MBIT, "$1 мегабити на секунда");
        s = Rewrite(s, MM2, "$1 квадратни милиметри");
        s = Rewrite(s, KM2, "$1 квадратни километри");

        // 12) DEGREES. The corpus's own spelled-out form is "30 степени целзиусови", so °C/°F use the "по"
        //     construction; `° W`/`° E` are coordinates.
        s = Rewrite(s, DEG_C, "$1 степени по Целзиус");
        s = Rewrite(s, DEG_F, "$1 степени по Фаренхајт");
        s = Rewrite(s, DEG_W, "$1 степени запад");
        s = Rewrite(s, DEG_E, "$1 степени исток");
        s = Rewrite(s, DEG_BARE, "$1 степени");

        // 13) SIGNS. ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside
        //     it. It needs its own rule or the sign is dropped in silence; the reading is this language's
        //     own two words juxtaposed, both taken from the plus and minus rules already here.
        s = Rewrite(s, MINUS, "$1минус ");
        s = Rewrite(s, PLUS_MINUS, " плус минус ");
        s = Rewrite(s, PLUS, "$1плус ");
        s = Rewrite(s, TIMES, "$1 пати ");
        s = Rewrite(s, DIVIDE, " поделено со ");
        s = Rewrite(s, EQUALS, " еднакво на ");
        s = Rewrite(s, LESS, " помало од ");
        s = Rewrite(s, GREATER, " поголемо од ");
        s = Rewrite(s, AMP, " и ");

        // 14) pH → "пе ха" (letter names) and `Ghz` → "гигахерци".
        s = Rewrite(s, PH, "пе ха");
        s = Rewrite(s, GHZ, "гигахерци");

        // 14b) FRACTIONS — the corpus's "29¾ инчи на 24½ инчи" and "5 мм (1/5 инчи)". The vulgar glyphs are
        //      in no clause-punctuation map, so they were being dropped outright. mk is therefore in the
        //      registry's VULGAR_FOLD_OPT_OUT: it reads them better than the shared fold can, with the
        //      "и" that joins a mixed number.
        s = Rewrite(s, FRAC_34, "$1 и три четвртини");
        s = Rewrite(s, FRAC_12, "$1 и половина");
        s = Rewrite(s, FRAC_14, "$1 и четвртина");
        s = Rewrite(s, UNIT_FRACTION, m =>
        {
            var denom = Js.Number(m.Groups[2].Value);
            var suffix = denom == 2 ? "половина" : denom == 3 ? "третина" : denom == 4 ? "четвртина"
                : denom == 5 ? "петтина" : denom == 6 ? "шестина" : null;
            if (suffix is null || Js.Number(m.Groups[1].Value) != 1) return m.Value;
            return $"една {suffix}";
        });

        // 15) PERSONAL-INITIAL single capitals — `Н. Вејн` (the shared LONE_INITIAL handles `В. Буш`; this
        //     one follows a comma). And a lone Latin capital standing as a LETTER between words — `буквата
        //     V` reads "ве", not the English [viː].
        s = Rewrite(s, INITIAL_AFTER_COMMA, m =>
            LETTER_NAME.TryGetValue(Js.ToLowerCase(m.Groups[1].Value), out var v) ? v : m.Groups[1].Value);
        s = Rewrite(s, LONE_LATIN_CAPITAL, m =>
            LETTER_NAME.TryGetValue(Js.ToLowerCase(m.Groups[1].Value), out var v) ? v : m.Groups[1].Value);

        return s;
    }
}
