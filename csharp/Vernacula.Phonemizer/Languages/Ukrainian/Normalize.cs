/**
 * Ukrainian (uk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/ukrainian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

public static class Normalize
{
    private static UkrainianNumbers NUM => Manifest.DEF.Numbers;

    /** The cardinal, as words — the same composer the engine's number path uses, so an ordinal's head reads
     *  exactly as a bare numeral would (`1970` → *тисяча дев'ятсот*). */
    private static string Cardinal(double n) =>
        string.Join(" ", Numbers.eastSlavicNumberWords(n, NUM).Select(w => w ?? "")).Trim();

    /**
     * Pick a Slavic count form for `n` — the FOUR-way selector this language already declares for the shared
     * symbol tier (see ukrainian.cs `CountForm`): nom.sg / nom.pl (2–4) / gen.pl, plus the GENITIVE SINGULAR
     * that a DECIMAL governs (2,4 відсотка).
     */
    private static string Counted(double n, string[] forms) =>
        double.IsInteger(n) ? forms[Math.Min(NormalizeSymbols.SlavicCountForm(n), 2)] : forms[3];

    /** Masculine nominative ordinals. */
    private static readonly string[] ORD_1_19 =
    {
        "", "перший", "другий", "третій", "четвертий", "п'ятий", "шостий", "сьомий", "восьмий", "дев'ятий",
        "десятий", "одинадцятий", "дванадцятий", "тринадцятий", "чотирнадцятий", "п'ятнадцятий",
        "шістнадцятий", "сімнадцятий", "вісімнадцятий", "дев'ятнадцятий",
    };
    private static readonly string[] ORD_TENS =
    {
        "", "десятий", "двадцятий", "тридцятий", "сороковий", "п'ятдесятий", "шістдесятий", "сімдесятий",
        "вісімдесятий", "дев'яностий",
    };
    private static readonly string[] ORD_HUNDREDS =
    {
        "", "сотий", "двохсотий", "трьохсотий", "чотирьохсотий", "п'ятисотий", "шестисотий", "семисотий",
        "восьмисотий", "дев'ятисотий",
    };
    private static readonly string[] ORD_THOUSANDS =
    {
        "", "тисячний", "двохтисячний", "трьохтисячний", "чотирьохтисячний", "п'ятитисячний",
        "шеститисячний", "семитисячний", "восьмитисячний", "дев'ятитисячний",
    };

    /** Integer → the masculine-nominative ordinal. */
    private static string? OrdinalBase(double n)
    {
        if (!double.IsInteger(n) || n < 1) return null;
        if (n < 20) return ORD_1_19[(int)n];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            // ⚠ A MISSING TENS KEY IS `undefined` IN JS, where the TS asserts it non-null; the C# indexer
            // would throw instead. Neither is reachable from ukrainian.jsonc (20…90 are all authored), so the
            // lookup is direct — see the parity note in romanOrdinals.cs, where the same table IS reachable
            // with a gap.
            return u == 0 ? ORD_TENS[(int)t] : $"{NUM.Tens[Js.NumberToString(t * 10)]} {ORD_1_19[(int)u]}";
        }
        if (n < 1000)
        {
            var r = n % 100;
            if (r == 0) return ORD_HUNDREDS[(int)(n / 100)];
            return $"{Cardinal(n - r)} {OrdinalBase(r)}";
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

    /** Ordinal adjective endings, HARD stem then SOFT (третій). */
    private static readonly (string Hard, string Soft)[] ORD_ENDINGS =
    {
        ("ий", "ій"), ("ого", "ього"), ("ому", "ьому"), ("им", "ім"), ("е", "є"), ("і", "і"),
        ("их", "іх"), ("а", "я"), ("ої", "ьої"), ("ій", "ій"), ("у", "ю"), ("ою", "ьою"), ("ими", "іми"),
    };

    /** Every case form of the ordinal for `n`, in preference order. Only the final word inflects. */
    private static List<string> OrdinalForms(double n)
    {
        var bas = OrdinalBase(n);
        if (bas is null) return new List<string>();
        var words = bas.Split(' ');
        var last = words[^1];
        var soft = last.EndsWith("ій", StringComparison.Ordinal); // третій — the only soft stem in the tables above
        var stem = last[..^2]; // both "ий" and "ій" are two characters
        var head = string.Join(" ", words[..^1]);
        return ORD_ENDINGS.Select(e => $"{(head.Length > 0 ? head + " " : "")}{stem}{(soft ? e.Soft : e.Hard)}").ToList();
    }

    /** GENITIVE cardinals. */
    private static readonly string[] GEN_1_19 =
    {
        "", "одного", "двох", "трьох", "чотирьох", "п'яти", "шести", "семи", "восьми", "дев'яти",
        "десяти", "одинадцяти", "дванадцяти", "тринадцяти", "чотирнадцяти", "п'ятнадцяти",
        "шістнадцяти", "сімнадцяти", "вісімнадцяти", "дев'ятнадцяти",
    };
    private static readonly string[] GEN_TENS =
    {
        "", "десяти", "двадцяти", "тридцяти", "сорока", "п'ятдесяти", "шістдесяти", "сімдесяти",
        "вісімдесяти", "дев'яноста",
    };
    private static readonly string[] GEN_HUNDREDS =
    {
        "", "ста", "двохсот", "трьохсот", "чотирьохсот", "п'ятисот", "шестисот", "семисот", "восьмисот",
        "дев'ятисот",
    };

    private static string? GenitiveCardinal(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n >= 1000) return null;
        if (n < 20) return GEN_1_19[(int)n];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            return u == 0 ? GEN_TENS[(int)t] : $"{GEN_TENS[(int)t]} {GEN_1_19[(int)u]}";
        }
        double h = Math.Floor(n / 100), r2 = n % 100;
        return r2 == 0 ? GEN_HUNDREDS[(int)h] : $"{GEN_HUNDREDS[(int)h]} {GenitiveCardinal(r2)}";
    }

    /** Ukrainian letter NAMES (Український правопис, назви літер). й is *йот*; ь is *м'який знак*. и and е
     *  are included with their Ukrainian values — `ИТ` occurs in the corpus. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["а"] = "а", ["б"] = "бе", ["в"] = "ве", ["г"] = "ге", ["ґ"] = "ґе", ["д"] = "де", ["е"] = "е",
        ["є"] = "є", ["ж"] = "же", ["з"] = "зе",
        ["и"] = "и", ["і"] = "і", ["ї"] = "ї", ["й"] = "йот", ["к"] = "ка", ["л"] = "ел", ["м"] = "ем",
        ["н"] = "ен", ["о"] = "о", ["п"] = "пе",
        ["р"] = "ер", ["с"] = "ес", ["т"] = "те", ["у"] = "у", ["ф"] = "еф", ["х"] = "ха", ["ц"] = "це",
        ["ч"] = "че", ["ш"] = "ша", ["щ"] = "ща",
        ["ь"] = "м'який знак", ["ю"] = "ю", ["я"] = "я",
    };

    /** NOTE: every boundary in this file is an explicit lookaround, never `\b` — `\b` is defined on ASCII word
     *  characters and finds none against Cyrillic, so a rule written with it silently matches nothing. That is
     *  exactly how `core/initialisms.ts` was a total no-op for Russian (США → [sʂa]) until it was fixed. */

    /** Ukrainian phonotactics, for the OOV rule in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableUkrainian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аеиіїєоуюя]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "бл", "бр", "вл", "вр", "гл", "гр", "гн", "дв", "др", "дн", "жд", "зв", "зд", "зл", "зм",
            "зн", "зр", "кл", "кн", "кр", "кв", "мн",
            "пл", "пр", "сл", "см", "сн", "сп", "ст", "св", "тр", "тв", "фл", "фр", "хл", "хр", "цв",
            "шк", "шл", "шп", "шт", "щи",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ст", "нт", "нд", "нс", "рт", "рд", "рс", "рн", "рм", "лт", "лд", "лс", "кт", "кс",
            "пт", "фт", "зд", "зн", "сн", "см", "тр", "др", "бр", "вр", "гр", "пр", "кр", "нк", "нг",
            "лм", "лк", "рк", "рг", "рх", "нь", "сь", "ть",
        }, StringComparer.Ordinal),
    });

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = new HashSet<string>(Manifest.DEF.AcronymLetters, StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableUkrainian(w),
    });

    /** Ukrainian has no pronunciation dictionary (its g2p is a flat rule scan), so the "is this recorded"
     *  test cannot be answered — acronyms are decided by the lexical list plus the OOV rule alone. */
    public static string NormalizeUkrainianInitialisms(string text) => InitialismNormalizer(text);

    private static readonly IReadOnlyDictionary<string, int> HOUR_CASE = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["о"] = 9, ["об"] = 9, ["в"] = 9, ["у"] = 9, ["на"] = 9, // locative — о двадцятій
        ["з"] = 8, ["із"] = 8, ["зі"] = 8, ["до"] = 8, ["від"] = 8, ["близько"] = 8, ["після"] = 8,
        ["протягом"] = 8, ["біля"] = 8, // genitive — з шостої
        ["між"] = 11, ["перед"] = 11, ["за"] = 11, // instrumental — між двадцять другою
    };
    private const int FEM_NOM = 7; // ORD_ENDINGS index — the default when no preposition governs

    private static readonly string[] METRE = { "метр", "метри", "метрів", "метра" };
    private static readonly string[] DEGREE = { "градус", "градуси", "градусів", "градуса" };
    /** Only the gen.pl is ever read (step 3), so this one stays three forms. */
    private static readonly string[] SQUARE = { "квадратний", "квадратні", "квадратних" };

    /** Abbreviations whose dot is NOT a sentence end. `кв.` is handled separately (step 3) because it is an
     *  adjective that must agree with the following number. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["р"] = "року", ["рр"] = "років", ["стор"] = "сторінка", ["див"] = "дивись", ["ін"] = "інше",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private const string NOT_LETTER = "(?![\\p{L}\\p{M}'\u2019\u02bc])";

    private const string GROUP_SPACE = " \u00a0\u202f\u2009";

    private static readonly JsRe DEGROUP_SPACE = JsRegex.Compile($"(\\d)[{GROUP_SPACE}](\\d{{3}})(?!\\d)", "gu");
    private static readonly JsRe DEGROUP_COMMA = JsRegex.Compile("(\\d),(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile($"[{GROUP_SPACE}]", "gu");
    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])до\\s+н\\.\\s?е\\.", "giu"), "до нашої ери"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])н\\.\\s?е\\.", "giu"), "нашої ери"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])т\\.\\s?п\\.", "giu"), "тому подібне"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])т\\.\\s?д\\.", "giu"), "так далі"),
    };
    private static readonly JsRe SENTENCE_TAIL = JsRegex.Compile("^\\s*[\"\u00bb)']?\\s*$", "u");
    private static readonly JsRe NUMERO = JsRegex.Compile("\u2116\\s?(?=\\d)", "gu");
    private static readonly JsRe SQ_KM = JsRegex.Compile("(\\d)\\s?кв\\.\\s?км(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe SQ_MILES = JsRegex.Compile("(\\d)\\s?кв\\.\\s?миль(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe SUFFIXED = JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s?-\\s?([а-яіїєґ]{{1,3}}){NOT_LETTER}", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d(])", "giu");
    private static readonly JsRe ABBREV_COMMA = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*[,;:])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.!?\u00bb)]|$))", "giu");
    private static readonly JsRe M_S = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?м\\/с(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe METRE_RE = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?м(?![\\p{L}\\p{M}'\u2019\u02bc\u00b2\u00b3/])", "gu");
    private static readonly JsRe PER_HOUR = JsRegex.Compile("(?<=[\\p{L}\\p{M}]{3})\\s?\\/\\s?год(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?\u00b0\\s?[CСc](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?\u00b0\\s?[FФf](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?\u00b0", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe PREV_WORD = JsRegex.Compile("([\\p{L}\\p{M}']+)\\s+$", "u");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-\u2212\u2013](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\u00b1", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?\u00f7\\s?", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s?[\u2013\u2014-]\\s?(?=\\d)", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d\\p{L}])(\\d{1,3})\\/(\\d{1,3})(?![\\d/\\p{L}])", "gu");
    private static readonly JsRe ODIN_FINAL = JsRegex.Compile("один$", "u");
    private static readonly JsRe DVA_FINAL = JsRegex.Compile("два$", "u");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d{1,2})\\.(\\d)(?![\\d.])", "gu");

    /** Normalize one Ukrainian input string. Pure text→text. */
    public static string NormalizeUkrainian(string input)
    {
        var s = input;

        for (var i = 0; i < 2; i++) s = DEGROUP_SPACE.Replace(s, "$1$2");
        s = DEGROUP_COMMA.Replace(s, "$1$2");
        s = SPACES.Replace(s, " ");

        foreach (var (re, word) in MULTI_DOT)
        {
            var subject = s;
            s = re.Replace(s, m =>
            {
                var rest = subject[(m.Index + m.Length)..];
                return SENTENCE_TAIL.IsMatch(rest) ? $"{word}." : word;
            });
        }

        s = NUMERO.Replace(s, "номер ");

        s = SQ_KM.Replace(s, "$1 км\u00b2");
        s = SQ_MILES.Replace(s, $"$1 {SQUARE[2]} миль");

        s = SUFFIXED.Replace(s, m =>
        {
            var whole = m.Value;
            var n = Js.Number(m.Groups[1].Value);
            var suffix = m.Groups[2].Value.ToLowerInvariant();
            var cardinalFirst = suffix == "ти" || suffix == "ми"
                || ((suffix == "х" || suffix == "их") && !(n >= 20 && n % 10 == 0));
            var gen = GenitiveCardinal(n);
            if (cardinalFirst) return gen is not null && gen.EndsWith(suffix, StringComparison.Ordinal) ? gen : whole;
            var form = OrdinalForms(n).FirstOrDefault(f => f.EndsWith(suffix, StringComparison.Ordinal));
            if (form is not null) return form;
            return gen is not null && gen.EndsWith(suffix, StringComparison.Ordinal) ? gen : whole;
        });

        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_COMMA.Replace(s, m => DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]);
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        s = M_S.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), METRE)} на секунду";
        });
        s = METRE_RE.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), METRE)}";
        });
        s = PER_HOUR.Replace(s, " на годину");
        s = DEG_C.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), DEGREE)} Цельсія";
        });
        s = DEG_F.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), DEGREE)} Фаренгейта";
        });
        s = DEG.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), DEGREE)}";
        });

        {
            var subject = s;
            s = CLOCK.Replace(s, m =>
            {
                var whole = m.Value;
                double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
                if (hv == 0) return whole; // *нульова година* is not said; leave it
                var before = PREV_WORD.Match(subject[..m.Index]);
                var prev = before.Success ? before.Groups[1].Value.ToLowerInvariant() : null;
                var idx = prev is not null && HOUR_CASE.TryGetValue(prev, out var got) ? got : FEM_NOM;
                var forms = OrdinalForms(hv);
                // JS `forms[idx]` on a short (or empty) array is `undefined` and the rule declines; the C#
                // indexer would throw, so the bound is explicit.
                if (idx >= forms.Count) return whole;
                var head = forms[idx];
                return mv == 0 ? head : $"{head} {Js.NumberToString(mv)}";
            });
        }

        s = MINUS.Replace(s, "$1мінус $2");
        s = PLUS_MINUS.Replace(s, " плюс мінус ");
        s = PLUS.Replace(s, "$1плюс $2");

        s = EQUALS.Replace(s, " дорівнює ");
        s = LESS_THAN.Replace(s, " менше ніж ");
        s = GREATER_THAN.Replace(s, " більше ніж ");
        s = DIVIDE.Replace(s, " розділене на ");

        s = RANGE.Replace(s, "$1 до ");

        s = FRACTION.Replace(s, m =>
        {
            var whole = m.Value;
            double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
            var forms = OrdinalForms(den);
            if (FEM_NOM >= forms.Count) return whole;
            var fem = forms[FEM_NOM];
            var numWord = DVA_FINAL.Replace(ODIN_FINAL.Replace(Cardinal(num), "одна"), "дві");
            return $"{numWord} {fem}";
        });

        s = DOT_DECIMAL.Replace(s, "$1,$2");

        return s;
    }
}
