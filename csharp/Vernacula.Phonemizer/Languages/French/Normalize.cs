/**
 * French (fr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/french/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class Normalize
{
    /** Space characters used as digit-group separators in French typography: regular, NBSP, narrow NBSP,
     *  thin space — all four written as literals, so an editor that folds one cannot narrow the class. */
    private const string GROUP_SPACE = "    ";

    /** Currency sign → [singular, plural], for the money-with-centimes rule. Mirrors the SYMBOLS config in
     *  french.ts, which owns the plain (no-centimes) currency case. */
    private static readonly IReadOnlyDictionary<string, string[]> CURRENCY_WORDS = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["€"] = new[] { "euro", "euros" }, ["$"] = new[] { "dollar", "dollars" },
        ["£"] = new[] { "livre", "livres" }, ["¥"] = new[] { "yen", "yens" },
    };

    /** Months, for the date rules. */
    private const string MONTHS = "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre";

    /** Dotted abbreviations → the spoken words. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["m"] = "monsieur", ["mm"] = "messieurs", ["mme"] = "madame", ["mmes"] = "mesdames",
        ["mlle"] = "mademoiselle", ["mlles"] = "mesdemoiselles",
        ["dr"] = "docteur", ["pr"] = "professeur", ["st"] = "saint", ["ste"] = "sainte", ["sts"] = "saints", ["stes"] = "saintes",
        ["cf"] = "confer", ["ex"] = "exemple", ["env"] = "environ",
        ["p"] = "page", ["pp"] = "pages", ["art"] = "article", ["vol"] = "volume", ["chap"] = "chapitre",
        ["éd"] = "édition", ["av"] = "avenue", ["bd"] = "boulevard", ["bld"] = "boulevard", ["jr"] = "junior",
        ["tél"] = "téléphone",
    };

    /** Abbreviations Lexique ALREADY pronounces as a token (etc → [ɛtseteʁa], mme → [madam]). */
    private static readonly IReadOnlySet<string> DOT_ONLY =
        new HashSet<string>(new[] { "etc", "mme", "mmes", "mlle", "mlles" }, StringComparer.Ordinal);

    /** Undotted abbreviations. French normally writes these bare (le Dr Martin, Mme Curie); `dr`/`pr` are not
     *  French words, so expanding them unconditionally is safe. */
    private static readonly IReadOnlyDictionary<string, string> UNDOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "docteur", ["pr"] = "professeur",
    };

    /** French letter names, for initialisms. Verified individually through this engine: bé=[be], cé=[se],
     *  effe=[ɛf], ache=[aʃ], ku=[ky], esse=[ɛs] (NOT "èse", which voices to [ɛz]), ixe=[iks], zède=[zɛd].
     *  `w` and `y` are genuinely two words in French (double vé, i grec). */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "bé", ["c"] = "cé", ["d"] = "dé", ["e"] = "e", ["f"] = "effe", ["g"] = "gé", ["h"] = "ache", ["i"] = "i",
        ["j"] = "ji", ["k"] = "ka", ["l"] = "elle", ["m"] = "emme", ["n"] = "enne", ["o"] = "o", ["p"] = "pé", ["q"] = "ku",
        ["r"] = "erre", ["s"] = "esse", ["t"] = "té", ["u"] = "u", ["v"] = "vé", ["w"] = "double vé", ["x"] = "ixe",
        ["y"] = "i grec", ["z"] = "zède",
    };

    /** French phonotactics, for the OOV rule in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableFrench = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouyàâäéèêëîïôöûüùœæ]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "kl", "kr",
            "ch", "ph", "th", "gn", "qu", "sc", "sp", "st", "ps", "pn", "pt", "sm", "sn", "gu", "rh", "ct",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "ch", "gn",
            "st", "sc", "sk", "sp", "ct", "pt", "ft", "xt", "ss", "tt", "ll", "mm", "nn", "pp", "rr", "ff",
            "rt", "rd", "rs", "rc", "rl", "rm", "rn", "rp", "rb", "rg", "rf", "rv", "rq",
            "lt", "ld", "ls", "lc", "lm", "lp", "lb", "lf", "lk", "lv",
            "nt", "nd", "ns", "nc", "nk", "ng", "mp", "mb",
            "cs", "ks", "ts", "ps", "bs", "ds", "gs", "fs", "ms",
        }, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms spelled out although their lowercase form is an ordinary French word. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly JsRe FINAL_UN = JsRegex.Compile("(^|[-\\s])un$", "u");

    /** Non-negative integer → words, with the final *un* feminized (heure/minute are feminine). */
    private static string FeminineWords(double n) => FINAL_UN.Replace(Numbers.NumberToWords(n), "$1une");

    /** An hour/minute pair → "onze heures vingt" / "une heure" / "zéro heure trente". */
    private static string TimeWords(double h, double? min)
    {
        var hourWord = h == 1 ? "heure" : "heures";
        var head = $"{FeminineWords(h)} {hourWord}";
        return min is null || min == 0 ? head : $"{head} {FeminineWords(min.Value)}";
    }

    /** Fraction denominators with a suppletive name; anything else uses the ordinal (1/5 = un cinquième). */
    private static readonly IReadOnlyDictionary<int, string> DENOMINATOR = new Dictionary<int, string>
    {
        [2] = "demi", [3] = "tiers", [4] = "quart",
    };

    private static string? FractionWords(int num, int den)
    {
        var baseWord = DENOMINATOR.GetValueOrDefault(den) ?? Ordinals.Ordinal(den);
        if (baseWord is null || den < 2) return null;
        var plural = num > 1 && !baseWord.EndsWith("s", StringComparison.Ordinal) ? $"{baseWord}s" : baseWord;
        return $"{Numbers.NumberToWords(num)} {plural}";
    }

    /** Longest first, so `mmes` is not matched as `mme` + a stray s. */
    private static readonly string ABBREV_ALT =
        string.Join("|", DOTTED_ABBREV.Keys.Concat(DOT_ONLY).OrderByDescending(k => k.Length));

    private static readonly JsRe GROUP_SPACE_RE = JsRegex.Compile($"(\\d)[{GROUP_SPACE}](\\d{{3}})(?!\\d)", "gu");
    private static readonly JsRe NBSP_RUN = JsRegex.Compile("[\\u00a0\\u202f\\u2009]", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile("\\bav(?:ant)?\\.?\\s*j\\.?\\s*-?\\s*c\\.?", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("\\bapr(?:ès)?\\.?\\s*j\\.?\\s*-?\\s*c\\.?", "giu");
    private static readonly JsRe DEGREE_SPACED = JsRegex.Compile("(\\d)\\s*°\\s*(?=[CF](?![\\p{L}\\p{M}]))", "gui");
    private static readonly JsRe NUMERO = JsRegex.Compile("\\bn[°º]\\s*(?=\\d)", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe UNDOTTED = JsRegex.Compile("\\b(dr|pr)\\b\\.?(?=\\s+\\p{L})", "giu");
    private static readonly JsRe NAME_INITIAL = JsRegex.Compile("\\b([a-zà-ÿ])\\.(\\s+)(?=[\\p{L}])", "giu");
    private static readonly JsRe MONEY_POST = JsRegex.Compile("(\\d+),(\\d{2})\\s?([€$£¥])", "gu");
    private static readonly JsRe MONEY_PRE = JsRegex.Compile("([€$£¥])\\s?(\\d+),(\\d{2})", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})/(\\d{1,3})\\b(?!\\s*/?\\d)", "gu");
    private static readonly JsRe CLOCK_H = JsRegex.Compile("\\b([01]?\\d|2[0-3])\\s*[hH]\\s*([0-5]\\d)?(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("\\b([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!\\.\\d)", "gu");
    private static readonly JsRe NUMERIC_DATE = JsRegex.Compile("\\b(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})\\b", "gu");
    private static readonly JsRe FIRST_OF_MONTH = JsRegex.Compile($"\\b1\\s+({MONTHS})\\b", "giu");

    /** Normalize one French input string. */
    public static string NormalizeFrench(string input, Func<string, bool> isWord)
    {
        var s = input;

        s = GROUP_SPACE_RE.Replace(s, "$1$2");
        s = GROUP_SPACE_RE.Replace(s, "$1$2"); // millions: 1 234 567
        s = NBSP_RUN.Replace(s, " ");

        s = ERA_BC.Replace(s, "avant Jésus-Christ");
        s = ERA_AD.Replace(s, "après Jésus-Christ");

        s = DEGREE_SPACED.Replace(s, "$1°");

        s = NUMERO.Replace(s, "numéro ");

        // DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues, so it cannot become a phrase
        // break; at a phrase end it stays, because there it really is the sentence end.
        s = ABBREV_MID.Replace(s, m =>
        {
            var ab = m.Groups[1].Value;
            var sp = m.Groups[2].Value;
            var key = ab.ToLowerInvariant();
            return DOT_ONLY.Contains(key) ? $"{ab}{sp}" : $"{DOTTED_ABBREV[key]}{sp}";
        });
        s = ABBREV_END.Replace(s, m =>
        {
            var ab = m.Groups[1].Value;
            return DOT_ONLY.Contains(ab.ToLowerInvariant()) ? m.Value : $"{DOTTED_ABBREV[ab.ToLowerInvariant()]}.";
        });

        s = UNDOTTED.Replace(s, m => UNDOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]);

        s = NAME_INITIAL.Replace(s, m =>
        {
            var name = LETTER_NAME.GetValueOrDefault(m.Groups[1].Value.ToLowerInvariant());
            return name is null ? m.Value : $"{name}{m.Groups[2].Value}";
        });

        s = MONEY_POST.Replace(s, m =>
        {
            var (intPart, cents, sym) = (m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value);
            var forms = CURRENCY_WORDS[sym];
            var unit = intPart == "1" ? forms[0] : forms[1];
            return cents == "00" ? $"{intPart} {unit}" : $"{intPart} {unit} {Js.NumberToString(Js.Number(cents))}";
        });
        s = MONEY_PRE.Replace(s, m =>
        {
            var (sym, intPart, cents) = (m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value);
            var forms = CURRENCY_WORDS[sym];
            var unit = intPart == "1" ? forms[0] : forms[1];
            return cents == "00" ? $"{intPart} {unit}" : $"{intPart} {unit} {Js.NumberToString(Js.Number(cents))}";
        });

        s = PLUS_MINUS.Replace(s, " plus moins ");
        s = PLUS_ATTACHED.Replace(s, "$1 plus $2");
        s = PLUS_LEADING.Replace(s, "$1plus $2");

        s = MINUS.Replace(s, "$1moins $2");

        s = EQUALS_RE.Replace(s, " est égal à ");
        s = LESS_THAN.Replace(s, " est inférieur à ");
        s = GREATER_THAN.Replace(s, " est supérieur à ");
        s = DIVIDE.Replace(s, " divisé par ");

        s = FRACTION.Replace(s, m =>
            FractionWords((int)Js.Number(m.Groups[1].Value), (int)Js.Number(m.Groups[2].Value)) ?? m.Value);

        s = CLOCK_H.Replace(s, m => TimeWords(
            Js.Number(m.Groups[1].Value),
            m.Groups[2].Success && m.Groups[2].Value.Length > 0 ? Js.Number(m.Groups[2].Value) : null));
        s = CLOCK_COLON.Replace(s, m => TimeWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));

        s = NUMERIC_DATE.Replace(s, m =>
        {
            var (d, mo, y) = (m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value);
            var monthIdx = (int)Js.Number(mo) - 1;
            var months = MONTHS.Split('|');
            if (monthIdx < 0 || monthIdx >= months.Length || Js.Number(d) < 1 || Js.Number(d) > 31) return m.Value;
            return $"{(Js.Number(d) == 1 ? Ordinals.Ordinal(1) : d)} {months[monthIdx]} {y}";
        });
        s = FIRST_OF_MONTH.Replace(s, m => $"{Ordinals.Ordinal(1)} {m.Groups[1].Value}");

        return s;
    }

    /** INITIALISMS. */
    public static string NormalizeFrenchInitialisms(string text, Func<string, bool> isRecorded)
    {
        // ⚠ NOT HOISTED TO A STATIC FIELD like the other ports' initialism normalizers: this one closes over
        // `isRecorded`, the lexicon membership test the caller supplies, so it is rebuilt per call exactly as
        // the TS `makeInitialismNormalizer({...})(text)` is.
        return Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => LETTER_NAME.GetValueOrDefault(l),
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = isRecorded,
            IsUnreadable = IsUnreadableFrench,
        })(text);
    }
}
