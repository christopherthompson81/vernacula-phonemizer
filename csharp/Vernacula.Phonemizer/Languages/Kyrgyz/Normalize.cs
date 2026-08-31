/**
 * Kyrgyz (ky) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/kyrgyz/normalize.ts — see that file for the corpus evidence, the counts behind
 * each rule, and the deliberate refusals at the foot of the file.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Kyrgyz;

public static class Normalize
{
    // ---------------------------------------------------------------------------------------------------
    // KYRGYZ SUFFIX MORPHOLOGY
    // ---------------------------------------------------------------------------------------------------

    /**
     * Kyrgyz vowel harmony is FOUR-WAY on the last vowel of the stem, and a suffix carries either a HIGH
     * vowel (ы/и/у/ү) or a LOW one (а/е/о/ө) depending on which suffix it is. One table, both series.
     */
    private static readonly IReadOnlyDictionary<string, (string Hi, string Lo)> HARMONY =
        new Dictionary<string, (string, string)>(StringComparer.Ordinal)
        {
            ["а"] = ("ы", "а"), ["ы"] = ("ы", "а"),
            ["о"] = ("у", "о"),
            // ⚠ BACK /у/ IS THE ASYMMETRIC ONE: the LOW series is rounded only after a mid round vowel.
            ["у"] = ("у", "а"),
            ["е"] = ("и", "е"), ["и"] = ("и", "е"), ["э"] = ("и", "е"),
            ["ө"] = ("ү", "ө"), ["ү"] = ("ү", "ө"),
        };
    private const string VOWELS = "аоуыеэиөүяюё";
    /** Kyrgyz voiceless consonants — they select the т-/к- series of every suffix below. */
    private static readonly IReadOnlySet<string> VOICELESS =
        new HashSet<string>(Js.CodePoints("пфктсшчхцщ"), StringComparer.Ordinal);

    /** The harmony class of a word, read off its LAST vowel letter; defaults to the back-unrounded series. */
    private static (string Hi, string Lo) HarmonyOf(string word)
    {
        for (var i = word.Length - 1; i >= 0; i--)
            if (HARMONY.TryGetValue(word[i].ToString(), out var h)) return h;
        return ("ы", "а");
    }
    private static bool EndsInVowel(string w) => w.Length > 0 && VOWELS.IndexOf(w[^1]) >= 0;
    private static bool EndsVoiceless(string w) => w.Length > 0 && VOICELESS.Contains(w[^1].ToString());

    /**
     * The grammatical categories that actually occur bound to a numeral, a percent sign or a unit. ⚠ NUMBERS
     * BEHIND NAMED KEYS, NOT A STRING UNION — `review.ts` treats each string literal as a word to attest.
     */
    private enum Case { Abl, Dat, Loc, Acc, Gen, Equ, Poss, PossAcc, PossDat }

    /**
     * Build the CORRECT written form of a bound suffix for a given spoken stem. ⚠ THIS RE-DERIVES RATHER THAN
     * COPYING — the suffix in the text was harmonised by a writer looking at the DIGITS, and the corpus
     * proves it does not always agree with the words (`25ге` is *беш*, so it is `бешке` and not `-ге`).
     */
    private static string Suffix(string stem, Case kind)
    {
        var (hi, lo) = HarmonyOf(stem);
        var vowel = EndsInVowel(stem);
        var voiceless = EndsVoiceless(stem);
        var d = voiceless ? "т" : "д";
        return kind switch
        {
            Case.Abl => $"{d}{lo}н",                          // -дан/-ден/-дон/-дөн, -тан/…
            Case.Dat => $"{(voiceless ? "к" : "г")}{lo}",     // -га/-ге/-го/-гө, -ка/…
            Case.Loc => $"{d}{lo}",                           // -да/-де/-до/-дө, -та/…
            Case.Acc => $"{(vowel ? "н" : d)}{hi}",           // -ны/-ди/-ту/-дү
            Case.Gen => $"{(vowel ? "н" : d)}{hi}н",          // -нын/-дин/-түн
            Case.Equ => $"{d}{lo}й",                          // -дай/-дей/-дой/-дөй
            Case.Poss => vowel ? $"с{hi}" : hi,               // 3sg possessive: -ы/-и/-у/-ү, -сы/…
            Case.PossAcc => $"{(vowel ? $"с{hi}" : hi)}н",    // possessive + accusative
            Case.PossDat => $"{(vowel ? $"с{hi}" : hi)}н{lo}",// possessive + dative
            _ => "",
        };
    }

    /** Recognise a WRITTEN bound suffix and say which category it is. Longest form first. */
    private static readonly (JsRe Re, Case Kind)[] SUFFIX_TABLE =
    [
        (JsRegex.Compile("^(?:[дтн][ыиуү]н)$", "u"), Case.Gen),
        (JsRegex.Compile("^(?:[дт][аеоө]н)$", "u"), Case.Abl),
        (JsRegex.Compile("^(?:[дт][аеоө]й)$", "u"), Case.Equ),
        (JsRegex.Compile("^(?:[ыиуү]|с[ыиуү])н[аеоө]$", "u"), Case.PossDat),
        (JsRegex.Compile("^(?:[ыиуү]|с[ыиуү])н$", "u"), Case.PossAcc),
        (JsRegex.Compile("^(?:[гк][аеоө])$", "u"), Case.Dat),
        (JsRegex.Compile("^(?:[дт][аеоө])$", "u"), Case.Loc),
        (JsRegex.Compile("^(?:[дтн][ыиуү])$", "u"), Case.Acc),
        (JsRegex.Compile("^(?:[ыиуү]|с[ыиуү])$", "u"), Case.Poss),
    ];

    /** The written tail → its category, or null if it is not a bound suffix at all (i.e. it is a NOUN). */
    private static Case? SuffixKind(string tail)
    {
        foreach (var (re, kind) in SUFFIX_TABLE) if (re.IsMatch(tail)) return kind;
        return null;
    }
    /** One alternation matching every written form the table above recognises — for use inside a bigger pattern. */
    private const string SUFFIX_RE =
        "(?:[дтн][ыиуү]н|[дт][аеоө][нй]|(?:с?[ыиуү])н[аеоө]|(?:с?[ыиуү])н|[гк][аеоө]|[дт][аеоө]|[дтн][ыиуү]|с?[ыиуү])";

    /** Attach a bound suffix to the LAST WORD of a spoken numeral — the agreement digits cannot carry. */
    private static string Glue(string words, Case kind)
    {
        var parts = words.Split(' ');
        var last = parts[^1];
        parts[^1] = last + Suffix(last, kind);
        return string.Join(" ", parts);
    }

    /**
     * Integer → the Kyrgyz ORDINAL, i.e. the cardinal with -ынчы/-инчи/-унчу/-үнчү on its LAST word only.
     * The linking vowel is dropped after a vowel-final stem.
     */
    public static string? KyrgyzOrdinal(double n)
    {
        var words = Numbers.NumberWords(n);
        if (words is null || words == "") return null;
        var parts = words.Split(' ');
        var last = parts[^1];
        var hi = HarmonyOf(last).Hi;
        parts[^1] = EndsInVowel(last) ? $"{last}нч{hi}" : $"{last}{hi}нч{hi}";
        return string.Join(" ", parts);
    }

    // ---------------------------------------------------------------------------------------------------
    // INITIALISMS
    // ---------------------------------------------------------------------------------------------------

    /**
     * Kyrgyz phonotactics for the OOV half of core/initialisms.ts: no native initial cluster, a native coda
     * of two consonants. The onsets are the RUSSIAN-LOAN inventory; the codas are the native set.
     */
    private static readonly Func<string, bool> IsUnreadableKyrgyz = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аеёиоөуүыэюя]", "u"),
        LegalOnsets = new HashSet<string>(StringComparer.Ordinal)
        {
            "бл", "бр", "гл", "гр", "др", "кл", "кр", "пл", "пр", "сл", "см", "сп", "ст", "тр",
            "фл", "фр", "хл", "хр", "зв", "св", "тв", "дв", "сн", "шт",
        },
        LegalCodas = new HashSet<string>(StringComparer.Ordinal)
        {
            "рт", "рк", "рд", "рм", "рн", "рс", "рп", "рг", "рз", "рш", "рч",
            "нт", "нд", "нч", "нң", "нс", "нк",
            "лт", "лк", "лд", "лп", "лм",
            "ст", "шт", "фт", "кт", "пт", "йт", "йл", "йн", "йм", "йк",
        },
    });

    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.DEF.AcronymLetters, StringComparer.Ordinal);

    /**
     * Spell an unreadable all-caps run with Kyrgyz letter names. `СССР` → *эс эс эс эр*. `isRecorded` is
     * false: this tree has no Kyrgyz pronunciation dictionary.
     * ⚠ CALLED BOTH WAYS — see #1150; `onPipeline` tells the seam which string it was handed.
     */
    private static string NormalizeKyrgyzInitialisms(string text, bool onPipeline = false) =>
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => Manifest.DEF.LetterNames.TryGetValue(l, out var n) ? n : null,
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = _ => false,
            IsUnreadable = IsUnreadableKyrgyz,
        }, onPipeline)(text);

    // ---------------------------------------------------------------------------------------------------
    // UNITS — one table, read by BOTH the shared tier and the local suffixed-unit rule
    // ---------------------------------------------------------------------------------------------------

    /**
     * Unit abbreviation → its Kyrgyz word. Cyrillic keys are what the corpus writes; the Latin keys are
     * declared beside them. The squared and cubed keys are declared in BOTH the superscript and ASCII forms.
     */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["км²"] = "чарчы километр", ["м²"] = "чарчы метр", ["см²"] = "чарчы сантиметр", ["мм²"] = "чарчы миллиметр",
            ["км2"] = "чарчы километр", ["м2"] = "чарчы метр", ["см2"] = "чарчы сантиметр",
            ["км³"] = "куб километр", ["м³"] = "куб метр", ["см³"] = "куб сантиметр", ["дм³"] = "куб дециметр",
            ["км3"] = "куб километр", ["м3"] = "куб метр", ["см3"] = "куб сантиметр", ["дм3"] = "куб дециметр",
            ["км"] = "километр", ["мм"] = "миллиметр", ["см"] = "сантиметр", ["дм"] = "дециметр", ["м"] = "метр",
            ["кг"] = "килограмм", ["мг"] = "миллиграмм", ["мкг"] = "микрограмм",
            ["га"] = "гектар", ["мл"] = "миллилитр", ["л"] = "литр",
            ["km²"] = "чарчы километр", ["km2"] = "чарчы километр", ["km"] = "километр",
            ["cm"] = "сантиметр", ["mm"] = "миллиметр", ["kg"] = "килограмм", ["mg"] = "миллиграмм", ["ha"] = "гектар",
        };

    /**
     * THE SHARED SYMBOL TIER — %, currency, units, exponents, ampersand, magnitudes.
     * ⚠ `пайыз`, NOT `процент`. ⚠ `$`/`€` only. ⚠ NO `unitPer` (the rate is a bare dative). ⚠ measure words
     * PREPOSED (`чарчы километр`).
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "пайыз" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "доллар" },
            ["€"] = new[] { "евро" },
        },
        Units = UNIT_WORD.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<string>)new[] { kv.Value }),
        Magnitudes = new[] { "миллиард", "миллион", "триллион", "миң" },
        Ampersand = "жана",
    });

    // ---------------------------------------------------------------------------------------------------
    // THE RULES
    // ---------------------------------------------------------------------------------------------------

    /** A Cyrillic letter, spelled out rather than left to `\p{L}` — the guards must not admit Latin. */
    private const string CYR = "\\p{Script=Cyrillic}";
    /** "not inside a word": `\p{M}` beside `\p{L}`, per trap 23. */
    private const string NOT_WORD = "(?![\\p{L}\\p{M}])";
    private const string NOT_WORD_BEFORE = "(?<![\\p{L}\\p{M}])";

    /** 0) INVISIBLE CHARACTERS and the `&nbsp;` entity. */
    private static readonly JsRe INVISIBLE = JsRegex.Compile("[\\u00AD\\u200B-\\u200F\\uFEFF]", "gu");
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;?", "gu");

    /** 1) SPACE-GROUPED THOUSANDS — the space/NBSP/NNBSP/thin-space separators between 3-digit groups. */
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<=\\d)(?<!(?<![\\d\\.,])0)[ \\u00a0\\u202f\\u2009](?=\\d{3}(?![\\d]))", "gu");

    /** 2) THE COMMA AS A THOUSANDS SEPARATOR, only when it groups MORE than once. */
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile(
        "(?<![\\d.,])([1-9]\\d{0,2})(?:,\\d{3}){2,}(?![\\d.,])", "gu");
    private static readonly JsRe COMMA = JsRegex.Compile(",", "gu");

    /** 3) MULTI-DOT ABBREVIATIONS. ⚠ CASE-INSENSITIVE, AND THE FINAL DOT IS OPTIONAL. */
    private static readonly JsRe ERA = JsRegex.Compile(
        $"{NOT_WORD_BEFORE}б\\.\\s?[зэ]\\.\\s?ч\\.?{NOT_WORD}", "giu");
    private static readonly JsRe J_B = JsRegex.Compile($"{NOT_WORD_BEFORE}ж\\.\\s?б\\.", "gu");
    private static readonly JsRe B_A = JsRegex.Compile($"{NOT_WORD_BEFORE}б\\.\\s?а\\.", "gu");

    /** 4) MAGNITUDE ABBREVIATIONS after a number — claimed only after a digit. */
    private static readonly JsRe MLRD = JsRegex.Compile($"(?<=\\d\\s?)млрд\\.?{NOT_WORD}", "gu");
    private static readonly JsRe TRLN = JsRegex.Compile($"(?<=\\d\\s?)трлн\\.?{NOT_WORD}", "gu");
    private static readonly JsRe MLN = JsRegex.Compile($"(?<=\\d\\s?)млн\\.?{NOT_WORD}", "gu");

    /** 5) THE HYPHENATED HEAD-NOUN ABBREVIATIONS, expanded so step 6 can ordinalise them. */
    private static readonly JsRe HYPH_ЖЖ = JsRegex.Compile($"(?<=\\d)-жж\\.?{NOT_WORD}", "gu");
    private static readonly JsRe HYPH_Ж = JsRegex.Compile($"(?<=\\d)-ж\\.?{NOT_WORD}", "gu");
    private static readonly JsRe HYPH_К = JsRegex.Compile($"(?<=\\d)-к\\.?{NOT_WORD}", "gu");
    private static readonly JsRe HYPH_Б = JsRegex.Compile($"(?<=\\d)-б\\.?{NOT_WORD}", "gu");

    /** 6) THE ORDINAL HYPHEN — and the SPACED CENTURY (the Roman pass's output). */
    private static readonly JsRe ORDINAL_HEAD = JsRegex.Compile(
        $"(?<![\\d.,])(\\d{{1,12}})-(\\d{{1,12}})-({CYR}+)", "giu");
    private static readonly JsRe ORDINAL_SINGLE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d{{1,12}})-({CYR}+)", "giu");
    private static readonly JsRe SPACED_CENTURY = JsRegex.Compile(
        "(?<![\\d.,])(\\d{1,4})\\s+(кылым[\\p{Script=Cyrillic}]*)", "giu");

    /** 7) THE CASE SUFFIX BOUND TO A NUMERAL — glued or hyphenated. */
    private static readonly JsRe CASE_SUFFIX = JsRegex.Compile(
        $"(?<![\\d.,\\p{{L}}\\p{{M}}])(\\d{{1,12}})-?({SUFFIX_RE}){NOT_WORD}", "gu");

    /** 8) PERCENT, WITH ITS BOUND SUFFIX — before the tier. */
    private static readonly JsRe PERCENT_SUFFIX = JsRegex.Compile(
        $"(\\d)\\s?%\\s?-?({SUFFIX_RE}){NOT_WORD}", "gu");

    /** 8b) THE MINUS — only where the corpus can tell it from a range (trap 24). */
    private const string NO_SIGN_LEFT = "(?<![\\d°′'\\u2032\\p{L}\\p{M}])";
    private static readonly JsRe MINUS_ELLIPSIS = JsRegex.Compile(
        $"{NO_SIGN_LEFT}[-−–—]\\s?(\\d+(?:,\\d+)?)(?=\\s?[.…]{{2,3}}\\s?[-−–—]\\s?\\d+\\s?°)", "gui");
    private static readonly JsRe MINUS_DEG = JsRegex.Compile(
        $"{NO_SIGN_LEFT}[-−–—]\\s?(\\d+(?:,\\d+)?)(?=\\s?°)", "gui");

    /** 9) DEGREES — both encodings of the scale letter, the coordinate, the ⟨о⟩ stand-in, then the bare sign. */
    private static readonly string SUFFIX_ARM = $"(?:-?({SUFFIX_RE}))?{NOT_WORD}";
    private static readonly JsRe DEG_SCALE = JsRegex.Compile($"(\\d)\\s?°\\s?[CСFcсf]{SUFFIX_ARM}", "gu");
    private static readonly JsRe DEG_COORD = JsRegex.Compile(
        "(\\d)\\s?°\\s?(\\d{1,2})\\s?[′'](?:\\s?(\\d{1,2})\\s?[″\"])?", "gu");
    private static readonly JsRe DEG_CYR_O = JsRegex.Compile("(\\d)о\\s?[CС](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile($"(\\d)\\s?°{SUFFIX_ARM}", "gu");

    /** 10) THE COLON BETWEEN DIGITS IS NEVER A CLAUSE BREAK. */
    private static readonly JsRe COLON = JsRegex.Compile("(?<=\\d):(?=\\d)", "gu");

    /** 11) A UNIT WITH A BOUND CASE SUFFIX, before the shared tier. */
    private static readonly JsRe ESC_RE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static string Esc(string t) => JsRegex.Replace(t, ESC_RE, "\\$&");
    private static readonly string UNIT_KEYS = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length).Select(Esc));
    private static readonly JsRe UNIT_SUFFIX = JsRegex.Compile(
        $"(?<![\\d.,])(\\d[\\d.,]*\\d|\\d)\\s?({UNIT_KEYS})({SUFFIX_RE}){NOT_WORD}", "gu");

    /** 11b) EQUALS, POSTPOSED — `A B барабар`. */
    private static readonly JsRe EQUALS = JsRegex.Compile(
        "([\\d\\p{Script=Cyrillic}])\\s*=\\s*([\\d\\p{Script=Cyrillic}][^=.,;:!?()]{0,40})", "gu");

    /** 11c) THE NUMERO SIGN. */
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");

    /** 12) FRACTIONS — denominator in the ABLATIVE, then the numerator. */
    private static readonly JsRe FRACTION = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d./,])(\\d{1,2})\\s?/\\s?(\\d{1,2})(?![\\d./,])", "gu");

    /** 13) THE DECIMAL COMMA — «бүтүн» + denominator-ablative + numerator. */
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile(
        "(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d.,])", "gu");

    /** 14) THE DOT BETWEEN DIGITS — the pause removed, no decimal word. */
    private static readonly JsRe DIGIT_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d.,])", "gu");

    /** 15) INITIALISMS, LAST — an initialism with a bound case suffix first. */
    private static readonly JsRe INITIALISM_SUFFIX = JsRegex.Compile(
        $"{NOT_WORD_BEFORE}(\\p{{Lu}}{{2,}})({SUFFIX_RE}){NOT_WORD}", "gu");

    /** Port of `String.prototype.trimEnd()` — JS whitespace, not .NET's Unicode set. */
    private static string TrimEnd(string s)
    {
        var b = s.Length;
        while (b > 0 && Js.IsJsWhiteSpace(s[b - 1])) b--;
        return s[..b];
    }

    /** Normalize one Kyrgyz input string. Pure text→text. */
    public static string NormalizeKyrgyz(string input)
    {
        var s = input;

        // 0) INVISIBLE CHARACTERS, FIRST, because every later rule matches literals.
        s = Rewrite(Rewrite(s, INVISIBLE, ""), NBSP_ENTITY, " ");

        // 1) SPACE-GROUPED THOUSANDS.
        for (var i = 0; i < 4; i++) s = Rewrite(s, GROUP_SPACE, "");

        // 2) THE COMMA AS A THOUSANDS SEPARATOR, but only when it groups more than once.
        s = Rewrite(s, GROUP_COMMA, m => COMMA.Replace(m.Value, ""));

        // 3) MULTI-DOT ABBREVIATIONS.
        s = Rewrite(Rewrite(Rewrite(s, ERA, "биздин заманга чейин"), J_B, "жана башка"), B_A, "башкача айтканда");

        // 4) MAGNITUDE ABBREVIATIONS after a number.
        s = Rewrite(Rewrite(Rewrite(s, MLRD, "миллиард"), TRLN, "триллион"), MLN, "миллион");

        // 5) THE HYPHENATED HEAD-NOUN ABBREVIATIONS.
        s = Rewrite(Rewrite(Rewrite(Rewrite(s, HYPH_ЖЖ, "-жылдары"), HYPH_Ж, "-жылы"), HYPH_К, "-кылым"), HYPH_Б, "-бет");

        // 6) THE ORDINAL HYPHEN — a PAIR of numbers first, then the single, then the spaced century.
        s = Rewrite(s, ORDINAL_HEAD, m =>
        {
            var m0 = m.Value;
            if (SuffixKind(Js.ToLowerCase(m.Groups[3].Value)) is not null) return m0;
            var oa = KyrgyzOrdinal(Js.Number(m.Groups[1].Value));
            var ob = KyrgyzOrdinal(Js.Number(m.Groups[2].Value));
            return oa is null || ob is null ? m0 : $"{oa} {ob} {m.Groups[3].Value}";
        });
        s = Rewrite(s, ORDINAL_SINGLE, m =>
        {
            var m0 = m.Value;
            if (SuffixKind(Js.ToLowerCase(m.Groups[2].Value)) is not null) return m0;
            var ord = KyrgyzOrdinal(Js.Number(m.Groups[1].Value));
            return ord is null ? m0 : $"{ord} {m.Groups[2].Value}";
        });
        s = Rewrite(s, SPACED_CENTURY, m =>
        {
            var m0 = m.Value;
            var ord = KyrgyzOrdinal(Js.Number(m.Groups[1].Value));
            return ord is null ? m0 : $"{ord} {m.Groups[2].Value}";
        });

        // 7) THE CASE SUFFIX BOUND TO A NUMERAL — re-derived from the spoken last word.
        s = Rewrite(s, CASE_SUFFIX, m =>
        {
            var m0 = m.Value;
            var kind = SuffixKind(m.Groups[2].Value);
            var w = Numbers.NumberWords(Js.Number(m.Groups[1].Value));
            return kind is null || w is null ? m0 : Glue(w, kind.Value);
        });

        // 8) PERCENT, WITH ITS BOUND SUFFIX.
        s = Rewrite(s, PERCENT_SUFFIX, m =>
        {
            var m0 = m.Value;
            var kind = SuffixKind(m.Groups[2].Value);
            return kind is null ? m0 : $"{m.Groups[1].Value} пайыз{Suffix("пайыз", kind.Value)}";
        });

        // 8b) THE MINUS.
        s = Rewrite(s, MINUS_ELLIPSIS, "минус $1");
        s = Rewrite(s, MINUS_DEG, "минус $1");

        // 9) DEGREES.
        s = Rewrite(s, DEG_SCALE, m =>
        {
            var d = m.Groups[1].Value;
            var tail = m.Groups[2].Success ? m.Groups[2].Value : null;
            return $"{d} градус{(tail is null ? "" : Suffix("градус", SuffixKind(tail) ?? Case.Loc))}";
        });
        s = Rewrite(s, DEG_COORD, m =>
        {
            var d = m.Groups[1].Value;
            var mi = m.Groups[2].Value;
            var se = m.Groups[3].Success ? m.Groups[3].Value : null;
            return $"{d} градус {mi} минут{(se is null ? "" : $" {se} секунд")}";
        });
        s = Rewrite(s, DEG_CYR_O, "$1 градус");
        s = Rewrite(s, DEG_BARE, m =>
        {
            var d = m.Groups[1].Value;
            var tail = m.Groups[2].Success ? m.Groups[2].Value : null;
            return $"{d} градус{(tail is null ? "" : Suffix("градус", SuffixKind(tail) ?? Case.Loc))}";
        });

        // 10) THE COLON BETWEEN DIGITS.
        s = Rewrite(s, COLON, " ");

        // 11) A UNIT WITH A BOUND CASE SUFFIX FIRST, then the shared symbol tier.
        s = Rewrite(s, UNIT_SUFFIX, m =>
        {
            var m0 = m.Value;
            var kind = SuffixKind(m.Groups[3].Value);
            var word = UNIT_WORD[m.Groups[2].Value];
            if (kind is null) return m0;
            var parts = word.Split(' ');
            parts[^1] = parts[^1] + Suffix(parts[^1], kind.Value);
            return $"{m.Groups[1].Value} {string.Join(" ", parts)}";
        });
        s = SYMBOLS(s);

        // 11b) EQUALS, POSTPOSED.
        s = Rewrite(s, EQUALS, m =>
            $"{m.Groups[1].Value} {TrimEnd(m.Groups[2].Value)} барабар");

        // 11c) THE NUMERO SIGN.
        s = Rewrite(s, NUMERO, "номер ");

        // 12) FRACTIONS.
        s = Rewrite(s, FRACTION, m =>
        {
            var m0 = m.Value;
            var n = Js.Number(m.Groups[1].Value);
            var den = Js.Number(m.Groups[2].Value);
            if (!(n >= 1 && n < den && den <= 12)) return m0;
            var dw = Numbers.NumberWords(den);
            var nw = Numbers.NumberWords(n);
            return dw is null || nw is null ? m0 : $"{Glue(dw, Case.Abl)} {nw}";
        });

        // 13) THE DECIMAL COMMA.
        s = Rewrite(s, DECIMAL_COMMA, m =>
        {
            var m0 = m.Value;
            var whole = m.Groups[1].Value;
            var frac = m.Groups[2].Value;
            var w = Numbers.NumberWords(Js.Number(whole));
            var f = Numbers.NumberWords(Js.Number(frac));
            var den = Numbers.NumberWords(frac.Length == 1 ? 10 : 100);
            return w is null || f is null || den is null ? m0 : $"{w} бүтүн {Glue(den, Case.Abl)} {f}";
        });

        // 14) THE DOT BETWEEN DIGITS.
        s = Rewrite(s, DIGIT_DOT, "$1 $2");

        // 15) INITIALISMS, LAST — an initialism with a bound case suffix first.
        s = Rewrite(s, INITIALISM_SUFFIX, m =>
        {
            var m0 = m.Value;
            var kind = SuffixKind(m.Groups[2].Value);
            var spelled = NormalizeKyrgyzInitialisms(m.Groups[1].Value);
            if (kind is null || spelled == m.Groups[1].Value) return m0; // left a word by the phonotactic test
            return Glue(spelled, kind.Value);
        });
        s = NormalizeKyrgyzInitialisms(s, true); // the pipeline string

        return s;
    }
}
