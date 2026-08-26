/**
 * Kazakh (kk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA. Steps are ORDER-DEPENDENT.
 * Ported from src/languages/kazakh/normalize.ts — see that file for the corpus evidence and the
 * per-step coupling notes.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kazakh;

public static class Normalize
{
    /** Cardinal numbers in ORTHOGRAPHY (kazakh.jsonc stores these as IPA). */
    private static readonly string[] UNIT_CARD =
    [
        "", "бір", "екі", "үш", "төрт", "бес", "алты", "жеті", "сегіз", "тоғыз",
    ];

    // ⚠ `UNIT_CARD[0]` is EMPTY ON PURPOSE (positional table); the zero WORD is used only at the top of
    // `Orthographic`, never in the positional path.
    private const string ZERO_CARD = "нөл";

    private static readonly string[] TENS_CARD =
    [
        "", "он", "жиырма", "отыз", "қырық", "елу", "алпыс", "жетпіс", "сексен", "тоқсан",
    ];

    private const string HUNDRED_CARD = "жүз";
    private const string THOUSAND_CARD = "мың";

    /** Integer → the Kazakh ORDINAL, in orthography. Extends RomanOrdinals.Ordinal (which caps at 100). */
    private static string? OrdinalWord(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n >= 1000000) return null;
        if (n >= 1000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            if (r == 0) return null;
            var head1 = $"{(th == 1 ? UNIT_CARD[1] : Orthographic(th))} {THOUSAND_CARD}";
            var tail1 = OrdinalWord(r);
            return tail1 is null ? null : $"{head1} {tail1}";
        }
        if (n <= 100) return RomanOrdinals.Ordinal((int)n);
        double h = Math.Floor(n / 100), rr = n % 100;
        var head = h == 1 ? HUNDRED_CARD : $"{UNIT_CARD[(int)h]} {HUNDRED_CARD}";
        if (rr == 0) return Js.ReplaceFirst($"{head}інші", "іінші", "інші");
        return $"{head} {OrdinalWord(rr)}";
    }

    /** The Kazakh case suffixes the corpus writes after digits, keyed by the CASE they mark. */
    private static readonly IReadOnlyDictionary<string, string> CASE_BY_SUFFIX = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ге"] = "dat", ["ға"] = "dat", ["ке"] = "dat", ["қа"] = "dat",
        ["ден"] = "abl", ["дан"] = "abl", ["тен"] = "abl", ["тан"] = "abl", ["нен"] = "abl", ["нан"] = "abl",
        ["ның"] = "gen", ["нің"] = "gen", ["дың"] = "gen", ["дің"] = "gen", ["тың"] = "gen", ["тің"] = "gen",
        ["да"] = "loc", ["де"] = "loc", ["та"] = "loc", ["те"] = "loc",
        ["мен"] = "ins", ["бен"] = "ins", ["пен"] = "ins",
    };

    private static readonly JsRe VOWEL_ALL = JsRegex.Compile("[аәеиоөұүыі]", "gu");

    /** The LAST vowel of a word — the harmony class that picks the ending. */
    private static string? LastVowel(string w)
    {
        string? v = null;
        foreach (var match in JsRegex.MatchAll(VOWEL_ALL, w)) v = match.Value;
        return v;
    }

    private const string BACK_VOWELS = "аәоұы"; // the complement (е и ө ү і) is FRONT — every ending is a two-way choice

    /** The harmonised ending for a case, given the word's last vowel. */
    private static string CaseEnding(string caseName, string lastVowelChar)
    {
        var back = BACK_VOWELS.Contains(lastVowelChar, StringComparison.Ordinal);
        return caseName switch
        {
            "dat" => back ? "ға" : "ге",
            "abl" => back ? "дан" : "ден",
            "gen" => back ? "ның" : "нің",
            "loc" => back ? "да" : "де",
            "ins" => "мен", // NOT harmony-conditioned — the instrumental varies by VOICING; see WithCase
            _ => "",
        };
    }

    /** The DATE possessive: `15-і` is *он бесі* — the number in words with the possessive on its last word. */
    private static string? OrdinalOrCardinalTail(double n)
    {
        var b = Orthographic(n);
        if (b == "") return null;
        var words = b.Split(' ');
        var last = words[^1];
        var v = LastVowel(last);
        if (v is null) return null;
        words[^1] = $"{last}{(BACK_VOWELS.Contains(v, StringComparison.Ordinal) ? "ы" : "і")}";
        return string.Join(" ", words);
    }

    private static readonly JsRe VOICELESS_FINAL = JsRegex.Compile("[кқпсстфхцчшщ]$", "u");
    private static readonly JsRe NASAL_FINAL = JsRegex.Compile("[нмң]$", "u");
    private static readonly JsRe VOICED_SIBILANT_FINAL = JsRegex.Compile("[жз]$", "u");

    /** Attach a case ending to the LAST WORD of a composed number, honouring harmony. */
    private static string WithCase(string numberWord, string caseName)
    {
        var words = numberWord.Split(' ');
        var last = words[^1];
        var v = LastVowel(last);
        if (v is null) return numberWord;
        var back = BACK_VOWELS.Contains(v, StringComparison.Ordinal);
        var voiceless = VOICELESS_FINAL.IsMatch(last);
        var nasal = NASAL_FINAL.IsMatch(last);
        var e = CaseEnding(caseName, v);
        if (voiceless && caseName == "dat") e = back ? "қа" : "ке";
        if (voiceless && caseName == "loc") e = back ? "та" : "те";
        if (voiceless && caseName == "abl") e = back ? "тан" : "тен";
        if (nasal && caseName == "abl") e = back ? "нан" : "нен";
        if (voiceless && caseName == "ins") e = "пен";
        if (VOICED_SIBILANT_FINAL.IsMatch(last) && caseName == "ins") e = "бен";
        words[^1] = last + e;
        return string.Join(" ", words);
    }

    // ---------------------------------------------------------------------------------------------------
    // THE RULES
    // ---------------------------------------------------------------------------------------------------

    private static readonly JsRe GROUPED_THOUSANDS =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[ \\u00a0\\u202f\\u2009](?=\\d{3}(?!\\d))", "gu");

    private static readonly (JsRe Re, string With)[] ERA_MARKERS =
    [
        (JsRegex.Compile(@"(?<![\p{L}\p{M}])б\.\s?д\.\s?д\.(\s+)(?=[\p{L}\d])", "giu"), "біздің дәуірге дейін$1"),
        (JsRegex.Compile(@"(?<![\p{L}\p{M}])б\.\s?д\.\s?д\.(?=\s*(?:[.,;:!?»)]|$))", "giu"), "біздің дәуірге дейін."),
        (JsRegex.Compile(@"(?<![\p{L}\p{M}])т\.\s?б\.(\s+)(?=[\p{L}\d])", "giu"), "тағы басқа$1"),
        (JsRegex.Compile(@"(?<![\p{L}\p{M}])т\.\s?б\.(?=\s*(?:[.,;:!?»)]|$))", "giu"), "тағы басқа."),
        (JsRegex.Compile(@"(?<![\p{L}\p{M}])т\.\s?с\.\s?с\.(\s+)(?=[\p{L}\d])", "giu"), "тағы сол сияқты$1"),
        (JsRegex.Compile(@"(?<![\p{L}\p{M}])т\.\s?с\.\s?с\.(?=\s*(?:[.,;:!?»)]|$))", "giu"), "тағы сол сияқты."),
    ];

    private static readonly JsRe ORDINAL_SUFFIX =
        JsRegex.Compile(@"(?<![\d.,])(\d+)(?:-)?(ші|шы|нші|ншы)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe N_NOUN =
        JsRegex.Compile(@"(?<![\d.,])(\d+)-([а-яәғқңөұүһі]+)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe NUMERO = JsRegex.Compile(@"№\s?(?=\d)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        @"(?<![\d:.,])([01]?\d|2[0-3]):\s*([0-5]\d)(?![:.\d])(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан|ның|нің|да|де|та|те|мен|бен|пен)?",
        "giu");
    private static readonly JsRe DOT_CLOCK = JsRegex.Compile(@"(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)", "giu");
    private static readonly JsRe CASE_SUFFIX = JsRegex.Compile(
        @"(?<![\d.,])(\d+)(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан|ның|нің|да|де|та|те|мен|бен|пен)(?![\p{L}\p{M}])",
        "giu");

    private const string DEG_SUFFIX = "(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)";
    private static readonly JsRe DEG_C_PLUS =
        JsRegex.Compile($@"(^|[\s(])\+\s?(\d+)\s?°\s?C\s?(?:-)?{DEG_SUFFIX}?", "giu");
    private static readonly JsRe DEG_C_MINUS =
        JsRegex.Compile($@"(^|[\s(])[-−](\d+)\s?°\s?C\s?(?:-)?{DEG_SUFFIX}?", "giu");
    private static readonly JsRe DEG_C =
        JsRegex.Compile($@"(\d+)\s?°\s?C\s?(?:-)?{DEG_SUFFIX}?(?![\p{{L}}\p{{M}}])", "giu");
    private static readonly JsRe DEG_F =
        JsRegex.Compile($@"(\d+)\s?°\s?F\s?(?:-)?{DEG_SUFFIX}?(?![\p{{L}}\p{{M}}])", "giu");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile(@"(\d+)\s?°\s?([NSEW])(?![\p{L}\p{M}])", "giu");

    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "солтүстік", ["S"] = "оңтүстік", ["E"] = "шығыс", ["W"] = "батыс",
    };

    private static readonly JsRe RATE_KMH = JsRegex.Compile(
        $@"(\d[\d ]*)\s?(км)\s*\/\s*(сағ|сағат)(?:-)?{DEG_SUFFIX}?(?![\p{{L}}\p{{M}}])", "giu");
    private static readonly JsRe RATE_MPH = JsRegex.Compile(
        $@"(\d[\d ]*)\s?миля\s*\/\s*сағат(?:-)?{DEG_SUFFIX}?(?![\p{{L}}\p{{M}}])", "giu");
    private static readonly JsRe SPACES = JsRegex.Compile(" ", "gu");

    private static readonly JsRe RANGE = JsRegex.Compile(@"(?<![\d.,])(\d[\d ]*)\s*[-–—]\s*(\d[\d ]*)(?![\d.-])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile(@"(?<![\d.,])(\d{1,3})\s?\/\s?(\d{1,3})(?![\d.,])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile(@"(?<=\d),(?=\d)", "gu");
    private static readonly JsRe SIGNED_DOT_DECIMAL = JsRegex.Compile(@"(?<![\p{L}\p{Nd}])[-−](\d+)\.(\d+)(?![\d.])", "giu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile(@"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", "giu");
    private static readonly JsRe PLUS = JsRegex.Compile(@"(^|[\s(])\+\s?(\d)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile(@"(\d+)\s?÷\s?(\d+)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_AFTER_CAPS = JsRegex.Compile(@"(?<=[A-Z])\s?\+\s?(\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile(@"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile(@"(\d)\s*×\s*(\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile(@"(\S)\s*=\s*(\S)", "gu");
    private static readonly JsRe LESS = JsRegex.Compile(@"(\d)\s*<\s*(\d)", "gu");
    private static readonly JsRe MORE = JsRegex.Compile(@"(\d)\s*>\s*(\d)", "gu");

    /** A trailing optional case suffix on a composed phrase — the shape every degree/rate arm repeats. */
    private static string WithOptionalCase(string b, Group sfx)
    {
        if (sfx.Success && sfx.Value.Length > 0 && CASE_BY_SUFFIX.TryGetValue(Js.ToLowerCase(sfx.Value), out var c))
            return WithCase(b, c);
        return b;
    }

    /** Normalize one Kazakh input string. Pure text→text. */
    public static string NormalizeKazakh(string input)
    {
        var s = input;

        // 0) SPACE-GROUPED THOUSANDS — de-group FIRST, before anything reads a pause.
        for (var i = 0; i < 2; i++) s = GROUPED_THOUSANDS.Replace(s, "");

        // 1) DOTTED ABBREVIATIONS and ERA MARKERS, before the single-dot rule.
        foreach (var (re, with) in ERA_MARKERS) s = re.Replace(s, with);

        // 2) ORDINALS — `190-шы`, `1-ші`. Runs BEFORE the clock rule.
        s = ORDINAL_SUFFIX.Replace(s, m =>
        {
            var ord = OrdinalWord(Js.Number(m.Groups[1].Value));
            return ord ?? m.Value;
        });

        // 2b) `N-НОУН` — the ordinal writing with the noun spelled out. A ONE-LETTER tail is the date possessive.
        s = N_NOUN.Replace(s, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            var tail = m.Groups[2].Value;
            if (CASE_BY_SUFFIX.ContainsKey(Js.ToLowerCase(tail))) return m.Value; // an ending, not a noun
            var ord = OrdinalWord(n);
            if (ord is null) return m.Value;
            if (tail.Length <= 2) return OrdinalOrCardinalTail(n) ?? m.Value;
            return $"{ord} {tail}";
        });

        // 2c) НӨМІР.
        s = NUMERO.Replace(s, "нөмір ");

        // 3) CLOCK, in the COLON form.
        s = CLOCK.Replace(s, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            var b = mv == 0 ? Orthographic(hv) : $"{Orthographic(hv)} {Orthographic(mv)}";
            return WithOptionalCase(b, m.Groups[3]);
        });

        // 3b) DOT-CLOCK before a timezone. ⚠ ZERO MINUTES ARE OMITTED, as in the `:`-clock arm.
        s = DOT_CLOCK.Replace(s, m =>
        {
            var mv = Js.Number(m.Groups[2].Value);
            return $"{Orthographic(Js.Number(m.Groups[1].Value))}{(mv == 0 ? "" : $" {Orthographic(mv)}")} {m.Groups[3].Value}";
        });

        // 4) THE CASE SUFFIX. Runs AFTER the clock rule.
        s = CASE_SUFFIX.Replace(s, m =>
        {
            if (!CASE_BY_SUFFIX.TryGetValue(Js.ToLowerCase(m.Groups[2].Value), out var caseName)) return m.Value;
            var n = Js.Number(m.Groups[1].Value);
            if (Orthographic(n) == "") return m.Value; // out-of-range guard
            return WithCase(Orthographic(n), caseName);
        });

        // 5) DEGREES. Runs BEFORE the case-suffix rule for the °C-тан form; the sign is claimed here.
        s = DEG_C_PLUS.Replace(s, m =>
            WithOptionalCase($"{m.Groups[1].Value}плюс {Orthographic(Js.Number(m.Groups[2].Value))} градус Цельсий", m.Groups[3]));
        s = DEG_C_MINUS.Replace(s, m =>
            WithOptionalCase($"{m.Groups[1].Value}минус {Orthographic(Js.Number(m.Groups[2].Value))} градус Цельсий", m.Groups[3]));
        s = DEG_C.Replace(s, m =>
            WithOptionalCase($"{Orthographic(Js.Number(m.Groups[1].Value))} градус Цельсий", m.Groups[2]));
        s = DEG_F.Replace(s, m =>
            WithOptionalCase($"{Orthographic(Js.Number(m.Groups[1].Value))} градус Фаренгейт", m.Groups[2]));
        s = DEG_COMPASS.Replace(s, m =>
            $"{Orthographic(Js.Number(m.Groups[1].Value))} градус {COMPASS[m.Groups[2].Value.ToUpperInvariant()]}");

        // 5b) RATES — `83 км/сағ`, `160 км/сағ-қа`, `17 500 миля/сағат`.
        s = RATE_KMH.Replace(s, m =>
        {
            var n = Js.Number(SPACES.Replace(m.Groups[1].Value, ""));
            return WithOptionalCase($"{Orthographic(n)} километр сағат", m.Groups[4]);
        });
        s = RATE_MPH.Replace(s, m =>
        {
            var n = Js.Number(SPACES.Replace(m.Groups[1].Value, ""));
            return WithOptionalCase($"{Orthographic(n)} миля сағат", m.Groups[2]);
        });

        // 6) NUMERIC RANGES.
        s = RANGE.Replace(s, "$1–$2");

        // 7) THE SHARED SYMBOL TIER — %, units.
        s = KazakhPhonemizer.SYMBOLS(s);

        // 7z) FRACTIONS — the DENOMINATOR comes first, in the ABLATIVE (бестен бір).
        s = FRACTION.Replace(s, m =>
        {
            string num = Orthographic(Js.Number(m.Groups[1].Value)), den = Orthographic(Js.Number(m.Groups[2].Value));
            return num == "" || den == "" ? m.Value : $"{WithCase(den, "abl")} {num}";
        });

        // 8) DECIMAL COMMA → the word.
        s = DECIMAL_COMMA.Replace(s, " бүтін ");

        // 8b) DOT DECIMALS/VERSIONS. ⚠ THE SIGNED CASE IS CLAIMED FIRST.
        s = SIGNED_DOT_DECIMAL.Replace(s, m =>
            $"минус {Orthographic(Js.Number(m.Groups[1].Value))} нүкте {Orthographic(Js.Number(m.Groups[2].Value))}");
        s = DOT_DECIMAL.Replace(s, m =>
            $"{Orthographic(Js.Number(m.Groups[1].Value))} нүкте {Orthographic(Js.Number(m.Groups[2].Value))}");

        // 9) SIGNS.
        s = PLUS.Replace(s, "$1плюс $2");
        s = DIVIDE.Replace(s, m =>
            $"{Orthographic(Js.Number(m.Groups[1].Value))} {WithCase(Orthographic(Js.Number(m.Groups[2].Value)), "dat")} бөлінеді");
        s = PLUS_MINUS.Replace(s, " плюс минус ");
        s = PLUS_AFTER_CAPS.Replace(s, " плюс $1");
        s = MINUS.Replace(s, "минус $1");
        s = TIMES.Replace(s, "$1 есе $2");
        s = EQUALS.Replace(s, "$1 тең $2");
        s = LESS.Replace(s, "$1 аз $2");
        s = MORE.Replace(s, "$1 көп $2");

        return s;
    }

    /** Orthographic Kazakh cardinal (the manifest stores IPA; restated here for the rules that emit words). */
    private static string Orthographic(double n)
    {
        if (n == 0) return ZERO_CARD; // the positional table has "" here
        if (n < 10) return UNIT_CARD[(int)n];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            // TENS AND UNIT ARE SEPARATE WORDS — он бес, жиырма тоғыз.
            return u == 0 ? TENS_CARD[(int)t] : $"{TENS_CARD[(int)t]} {UNIT_CARD[(int)u]}";
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            var head = h == 1 ? HUNDRED_CARD : $"{UNIT_CARD[(int)h]} {HUNDRED_CARD}";
            return r == 0 ? head : $"{head} {Orthographic(r)}";
        }
        if (n < 1000000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var head = $"{(th == 1 ? UNIT_CARD[1] : Orthographic(th))} {THOUSAND_CARD}";
            return r == 0 ? head : $"{head} {Orthographic(r)}";
        }
        return "";
    }
}
