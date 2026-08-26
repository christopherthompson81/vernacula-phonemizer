/**
 * Ukrainian (uk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/ukrainian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

public static class Normalize
{
    private static UkrainianDef DEF => Manifest.DEF;
    private static UkrainianNumbers NUM => DEF.Numbers;

    /** The cardinal, as words — the same composer the engine's number path uses, so an ordinal's head reads
     *  exactly as a bare numeral would (`1970` → *тисяча дев'ятсот*). */
    private static string Cardinal(double n) =>
        string.Join(" ", Numbers.eastSlavicNumberWords(n, NUM).Select(w => w ?? "")).Trim();

    /**
     * Pick a Slavic count form for `n` — the FOUR-way selector this language already declares for the shared
     * symbol tier (see ukrainian.cs `CountForm`): nom.sg / nom.pl (2–4) / gen.pl, plus the GENITIVE SINGULAR
     * that a DECIMAL governs (2,4 відсотка).
     */
    private static string Counted(double n, IReadOnlyList<string> forms) =>
        double.IsInteger(n) ? forms[Math.Min(NormalizeSymbols.SlavicCountForm(n), 2)] : forms[3];

    /**
     * The masculine-nominative ordinal tables (ukrainian.jsonc `ordinals`). `третій` is the one SOFT stem;
     * every other form there is hard (-ий), which is what the paradigm below keys on.
     */
    private static UkrainianOrdinals ORD => DEF.Ordinals;

    /** Integer → the masculine-nominative ordinal. */
    private static string? OrdinalBase(double n)
    {
        if (!double.IsInteger(n) || n < 1) return null;
        if (n < 20) return ORD.OneToNineteen[(int)n];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            // ⚠ A MISSING TENS KEY IS `undefined` IN JS, where the TS asserts it non-null; the C# indexer
            // would throw instead. Neither is reachable from ukrainian.jsonc (20…90 are all authored), so the
            // lookup is direct — see the parity note in romanOrdinals.cs, where the same table IS reachable
            // with a gap.
            return u == 0 ? ORD.Tens[(int)t] : $"{NUM.Tens[Js.NumberToString(t * 10)]} {ORD.OneToNineteen[(int)u]}";
        }
        if (n < 1000)
        {
            var r = n % 100;
            if (r == 0) return ORD.Hundreds[(int)(n / 100)];
            return $"{Cardinal(n - r)} {OrdinalBase(r)}";
        }
        if (n < 10_000 && n % 1000 == 0) return ORD.Thousands[(int)(n / 1000)];
        if (n < 1_000_000)
        {
            var r = n % 1000;
            if (r == 0) return null; // a round ten-thousand needs its own stem; not attempted
            return $"{Cardinal(n - r)} {OrdinalBase(r)}";
        }
        return null;
    }

    /**
     * The ordinal endings (ukrainian.jsonc `ordinals.endings`), in the order the manifest declares — which is
     * a PREFERENCE order, not a paradigm order, because the written suffix is matched by `EndsWith` and
     * several forms share a final letter: `-й` is claimed by both перший and першій, and the masculine
     * nominative is what `1-й` means. `CaseIndex` is how the clock rule names a case instead of indexing by
     * a magic number.
     */
    private static IReadOnlyList<OrdinalEnding> ORD_ENDINGS => ORD.Endings;
    private static readonly IReadOnlyDictionary<string, int> CASE_INDEX =
        ORD.Endings.Select((e, i) => (e.Case, i)).ToDictionary(x => x.Case, x => x.i, StringComparer.Ordinal);
    private static int CaseIndex(string name) =>
        CASE_INDEX.TryGetValue(name, out var i)
            ? i
            : throw new InvalidOperationException($"ukrainian.jsonc: ordinals.endings has no case \"{name}\"");

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

    /** GENITIVE cardinals (ukrainian.jsonc `genitiveCardinals`). */
    private static UkrainianGenitiveCardinals GEN => DEF.GenitiveCardinals;

    private static string? GenitiveCardinal(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n >= 1000) return null;
        if (n < 20) return GEN.OneToNineteen[(int)n];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            return u == 0 ? GEN.Tens[(int)t] : $"{GEN.Tens[(int)t]} {GEN.OneToNineteen[(int)u]}";
        }
        double h = Math.Floor(n / 100), r2 = n % 100;
        return r2 == 0 ? GEN.Hundreds[(int)h] : $"{GEN.Hundreds[(int)h]} {GenitiveCardinal(r2)}";
    }

    /** NOTE: every boundary in this file is an explicit lookaround, never `\b` — `\b` is defined on ASCII word
     *  characters and finds none against Cyrillic, so a rule written with it silently matches nothing. That is
     *  exactly how `core/initialisms.ts` was a total no-op for Russian (США → [sʂa]) until it was fixed. */

    /** Ukrainian phonotactics, for the OOV rule in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableUkrainian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{DEF.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(DEF.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(DEF.Phonotactics.Codas, StringComparer.Ordinal),
    });

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => DEF.LetterNames.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = new HashSet<string>(Manifest.DEF.AcronymLetters, StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableUkrainian(w),
    });

    /** Ukrainian has no pronunciation dictionary (its g2p is a flat rule scan), so the "is this recorded"
     *  test cannot be answered — acronyms are decided by the lexical list plus the OOV rule alone. */
    public static string NormalizeUkrainianInitialisms(string text) => InitialismNormalizer(text);

    /** Preposition → the `ordinals.endings` case it governs (ukrainian.jsonc `clock`), resolved to the index
     *  `OrdinalForms` returns. `FEM_NOM` is the default when no preposition governs. */
    private static readonly IReadOnlyDictionary<string, int> HOUR_CASE =
        DEF.Clock.PrepositionCase.ToDictionary(kv => kv.Key, kv => CaseIndex(kv.Value), StringComparer.Ordinal);
    private static readonly int FEM_NOM = CaseIndex(DEF.Clock.DefaultCase);

    // ⚠ THE METRE AND THE SQUARE ADJECTIVE COME FROM THE SYMBOL TIER'S OWN DATA, not from a second copy here.
    // Both rules below hold words the tier already declares (`symbols.units.м`, `symbols.exponentWords.squared`),
    // and before the lift this file carried its own byte-identical duplicates of each — two sources for one fact,
    // with nothing to keep them together.
    private static readonly IReadOnlyList<string> METRE = DEF.SymbolTier.Units["м"];
    private static readonly IReadOnlyList<string> DEGREE = DEF.Degree;
    /** Only the gen.pl is ever read (step 3), which is index 2 of the squared adjective's four forms. */
    private static readonly string SQUARE_GEN_PL = DEF.SymbolTier.ExponentWords.Squared![2];

    // ⚠ ONE SOURCE with the symbol tier in Ukrainian.cs: the rate words below are the tier's own
    // `RateDenominators`, and `SIGN.Times` / `SIGN.Ampersand` are what it declares for ⟨×⟩ and ⟨&⟩. `м/с` and
    // `миль/год` are composed here only because the tier cannot reach them (see step 6), not because they are
    // different words.
    private static SignWords SIGN => DEF.SignWords;
    private static string UNIT_PER => DEF.SymbolTier.UnitPer;
    private static IReadOnlyDictionary<string, string> RATE => DEF.SymbolTier.RateDenominators;

    /** Abbreviations whose dot is NOT a sentence end (ukrainian.jsonc `dottedAbbrev`). `кв.` is absent on
     *  purpose — it is an ADJECTIVE that must agree with the following number, so it has its own rule. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = DEF.DottedAbbrev;
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private const string NOT_LETTER = "(?![\\p{L}\\p{M}'\u2019\u02bc])";

    private const string GROUP_SPACE = " \u00a0\u202f\u2009";

    private static readonly JsRe DEGROUP_SPACE = JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d\\.,])0)[{GROUP_SPACE}](?=\\d{{3}}(?!\\d))", "gu");
    private static readonly JsRe DEGROUP_COMMA = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0),(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile($"[{GROUP_SPACE}]", "gu");
    /**
     * The multi-word dotted abbreviations, compiled from `multiDotAbbrev` IN MANIFEST ORDER — `до н. е.` must
     * be tried before `н. е.` or the longer reading is unreachable. The written form is reconstructed rather
     * than stored as a pattern: whitespace AFTER A DOT is optional (both `н. е.` and `н.е.` occur in the
     * corpus), whitespace after a bare word is required.
     */
    private static readonly (JsRe Re, string Word)[] MULTI_DOT = DEF.MultiDotAbbrev.Select(a =>
    {
        var parts = a.Written.Split(' ');
        var src = "(?<![\\p{L}\\p{M}])";
        for (var i = 0; i < parts.Length; i++)
        {
            if (i > 0) src += parts[i - 1].EndsWith('.') ? "\\s?" : "\\s+";
            src += parts[i].Replace(".", "\\.");
        }
        return (JsRegex.Compile(src, "giu"), a.Reading);
    }).ToArray();

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
    // ⚠ THE FEMININE 1 AND 2 ARE `numbers.feminine`, the pair the magnitude compositor already uses for the
    // feminine тисяча (одна тисяча, дві тисячі) — and the masculine forms they replace are `numbers.units[1]`
    // and `[2]`. The fraction rule held its own copies of all four.
    private static readonly JsRe ODIN_FINAL = JsRegex.Compile($"{Manifest.DEF.Numbers.Units[1]}$", "u");
    private static readonly JsRe DVA_FINAL = JsRegex.Compile($"{Manifest.DEF.Numbers.Units[2]}$", "u");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d{1,2})\\.(\\d)(?![\\d.])", "gu");

    /** Normalize one Ukrainian input string. Pure text→text. */
    public static string NormalizeUkrainian(string input)
    {
        var s = input;

        s = DEGROUP_SPACE.Replace(s, "");
        s = DEGROUP_COMMA.Replace(s, "");
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

        s = NUMERO.Replace(s, $"{DEF.NumberSign} ");

        s = SQ_KM.Replace(s, "$1 км\u00b2");
        s = SQ_MILES.Replace(s, $"$1 {SQUARE_GEN_PL} миль");

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
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), METRE)} {UNIT_PER} {RATE["с"]}";
        });
        s = METRE_RE.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), METRE)}";
        });
        s = PER_HOUR.Replace(s, $" {UNIT_PER} {RATE["год"]}");
        s = DEG_C.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), DEGREE)} {DEF.TemperatureScales["C"]}";
        });
        s = DEG_F.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            return $"{n} {Counted(Js.Number(Js.ReplaceFirst(n, ",", ".")), DEGREE)} {DEF.TemperatureScales["F"]}";
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

        s = MINUS.Replace(s, $"$1{SIGN.Minus} $2");
        s = PLUS_MINUS.Replace(s, $" {SIGN.PlusMinus} ");
        s = PLUS.Replace(s, $"$1{SIGN.Plus} $2");

        s = EQUALS.Replace(s, $" {SIGN.Equals} ");
        s = LESS_THAN.Replace(s, $" {SIGN.LessThan} ");
        s = GREATER_THAN.Replace(s, $" {SIGN.GreaterThan} ");
        s = DIVIDE.Replace(s, $" {SIGN.DividedBy} ");

        s = RANGE.Replace(s, $"$1 {DEF.RangeWord} ");

        s = FRACTION.Replace(s, m =>
        {
            var whole = m.Value;
            double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
            var forms = OrdinalForms(den);
            if (FEM_NOM >= forms.Count) return whole;
            var fem = forms[FEM_NOM];
            var numWord = DVA_FINAL.Replace(ODIN_FINAL.Replace(Cardinal(num), NUM.Feminine.One), NUM.Feminine.Two);
            return $"{numWord} {fem}";
        });

        s = DOT_DECIMAL.Replace(s, "$1,$2");

        return s;
    }
}
