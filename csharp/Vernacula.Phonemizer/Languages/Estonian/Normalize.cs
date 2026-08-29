/**
 * Estonian (et) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into Estonian words the pipeline speaks. Pure text→text, no IPA. Runs inside
 * `Estonian.cs`'s `Text()` BEFORE the shared symbol tier, so digits stay digits and the tier can still see
 * number–unit adjacency.
 *
 * ⚠ THE DEFINING CLASS IS THE ORDINAL, and Estonian makes it hard twice over: the ordinal is written as a
 * bare `N.` (a digit and a period, which is also a sentence end), and it must AGREE IN CASE with the noun
 * that follows. So the rule reads the head word, derives its case from a noun-stem table, and composes the
 * ordinal in that case — nominative, or stem + the noun's own ending.
 * Ported from src/languages/estonian/normalize.ts — see that file for every corpus count and the sourcing.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Estonian;

public static class Normalize
{
    // ── The ordinal / genitive machinery ─────────────────────────────────────────────────────────────

    private static readonly string[] GEN_UNIT =
        ["nulli", "ühe", "kahe", "kolme", "nelja", "viie", "kuue", "seitsme", "kaheksa", "üheksa"];

    private static readonly string[] ORD_NOM_UNIT =
        ["", "esimene", "teine", "kolmas", "neljas", "viies", "kuues", "seitsmes", "kaheksas", "üheksas"];

    private static readonly string[] ORD_STEM_UNIT =
        ["", "esimese", "teise", "kolmanda", "neljanda", "viienda", "kuuenda", "seitsmenda", "kaheksanda",
         "üheksanda"];

    private const string TEN_NOM = "kümnes", TEN_STEM = "kümnenda", TEN_GEN = "kümne";
    private const string TEEN_NOM = "teistkümnes", TEEN_STEM = "teistkümnenda", TEEN_GEN = "teistkümne";
    private const string HUN_NOM = "sajas", HUN_STEM = "sajanda", HUN_GEN = "saja";
    private const string THO_NOM = "tuhandes", THO_STEM = "tuhandenda", THO_GEN = "tuhande";

    private static string GenCardinal(int n)
    {
        if (n < 10) return GEN_UNIT[n];
        if (n == 10) return TEN_GEN;
        if (n < 20) return $"{GEN_UNIT[n - 10]}{TEEN_GEN}";
        if (n < 100)
        {
            var t = n / 10;
            var u = n % 10;
            return u == 0 ? $"{GEN_UNIT[t]}{TEN_GEN}" : $"{GEN_UNIT[t]}{TEN_GEN} {GEN_UNIT[u]}";
        }
        if (n < 1000)
        {
            var h = n / 100;
            var r = n % 100;
            var head = $"{(h == 1 ? "" : GEN_UNIT[h])}{HUN_GEN}";
            return r == 0 ? head : $"{head} {GenCardinal(r)}";
        }
        var th = n / 1000;
        var rem = n % 1000;
        var h2 = $"{(th == 1 ? "" : $"{GenCardinal(th)} ")}{THO_GEN}";
        return rem == 0 ? h2 : $"{h2} {GenCardinal(rem)}";
    }

    private static readonly IReadOnlySet<string> PLURAL_ENDINGS =
        new HashSet<string>(["te", "tel", "test", "il"], StringComparer.Ordinal);

    /**
     * ⚠ A SENTINEL THAT CAN NEVER BE A CASE ENDING — the TS writes it as a LITERAL NUL character in the
     * source, which makes that file non-text to `file(1)` and silently unsearchable to `grep`. Spelled here
     * as the escape `\u0000`, which is the same string and leaves this file greppable.
     */
    public const string NOMINATIVE = "\u0000nom";

    public static string? Ordinal(double n, string ending)
    {
        if (!double.IsInteger(n) || n < 1 || n > 9999) return null;
        var v = (int)n;
        var nom = ending == NOMINATIVE;
        var plural = PLURAL_ENDINGS.Contains(ending);
        // The last component decides the form, and `esimene`/`teine` have no composable plural.
        if (plural && (v % 100 == 1 || v % 100 == 2)) return null;
        string Put(string nomForm, string stem) => nom ? nomForm : $"{stem}{ending}";

        if (v < 10) return Put(ORD_NOM_UNIT[v], ORD_STEM_UNIT[v]);
        if (v == 10) return Put(TEN_NOM, TEN_STEM);
        if (v < 20) return Put($"{GEN_UNIT[v - 10]}{TEEN_NOM}", $"{GEN_UNIT[v - 10]}{TEEN_STEM}");
        string? Compose(string head, int rest)
        {
            var tail = Ordinal(rest, ending);
            return tail is null ? null : $"{head} {tail}";
        }
        if (v < 100)
        {
            var t = v / 10;
            var u = v % 10;
            if (u != 0) return Compose($"{GEN_UNIT[t]}{TEN_GEN}", u);
            return Put($"{GEN_UNIT[t]}{TEN_NOM}", $"{GEN_UNIT[t]}{TEN_STEM}");
        }
        if (v < 1000)
        {
            var h = v / 100;
            var r = v % 100;
            var g = h == 1 ? "" : GEN_UNIT[h];
            if (r != 0) return Compose($"{g}{HUN_GEN}", r);
            return Put($"{g}{HUN_NOM}", $"{g}{HUN_STEM}");
        }
        var th = v / 1000;
        var rr = v % 1000;
        var g2 = th == 1 ? "" : $"{GenCardinal(th)} ";
        if (rr != 0) return Compose($"{g2}{THO_GEN}", rr);
        return Put($"{g2}{THO_NOM}", $"{g2}{THO_STEM}");
    }

    // ── The head noun's case, read off a stem table ──────────────────────────────────────────────────

    private static readonly string[] NOUN_STEMS =
    [
        "aastatuhande", "sünniaastapäeva", "eluaasta", "aasta", "sajandi", "koha", "järgu",
        "jaanuari", "veebruari", "märtsi", "aprilli", "mai", "juuni", "juuli", "augusti", "septembri",
        "oktoobri", "novembri", "detsembri",
    ];

    private static readonly IReadOnlySet<string> NOUN_ENDINGS =
        new HashSet<string>(["", "l", "st", "ks", "t", "ni", "te", "tel", "test", "il"], StringComparer.Ordinal);

    private static readonly IReadOnlySet<string> GENITIVE_ATTRIBUTE =
        new HashSet<string>(["ni", "na", "ta", "ga"], StringComparer.Ordinal);

    private static readonly IReadOnlySet<string> NOUN_NOMINATIVE = new HashSet<string>(
        ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september",
         "oktoober", "november", "detsember", "sajand", "koht", "trükk", "ametlik", "valitsus"],
        StringComparer.Ordinal);

    private static string? CaseOf(string word)
    {
        if (NOUN_NOMINATIVE.Contains(word)) return NOMINATIVE;
        foreach (var stem in NOUN_STEMS)
        {
            if (!word.StartsWith(stem, StringComparison.Ordinal)) continue;
            var rest = word[stem.Length..];
            if (NOUN_ENDINGS.Contains(rest)) return GENITIVE_ATTRIBUTE.Contains(rest) ? "" : rest;
        }
        return null;
    }

    private const string HEAD_WORD = "[a-zõäöüšž]+";

    // ── Vocabulary ───────────────────────────────────────────────────────────────────────────────────

    private const string DECIMAL_WORD = "koma";
    private const string RANGE_JOINER = "kuni";
    private const string DEGREE_WORD = "kraadi";

    private static readonly (JsRe Re, string Phrase)[] ERA =
    [
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])e\\.\\s?m\\.\\s?a\\.?(?![\\p{L}\\p{M}])", "gu"), "enne meie aja arvamist"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])m\\.\\s?a\\.\\s?j\\.?(?![\\p{L}\\p{M}])", "gu"), "meie aja arvamise järgi"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])eKr(?![\\p{L}\\p{M}])", "gu"), "enne Kristust"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])pKr(?![\\p{L}\\p{M}])", "gu"), "pärast Kristust"),
    ];

    /** ⚠ THE ABBREVIATION'S OWN DOT IS OPTIONAL AND MUST NOT EAT A SENTENCE END — the lookahead refuses a
     *  following capitalised word or end-of-string, which is where the dot is the writer's full stop. */
    private const string ABBREV_DOT = @"(?:\.(?!\s+\p{Lu}|\s*$))?";

    private static (JsRe, string) Abbrev(string form, string phrase) =>
        (JsRegex.Compile($@"(?<![\p{{L}}\p{{M}}]){form}{ABBREV_DOT}(?![\p{{L}}\p{{M}}])", "gu"), phrase);

    private static readonly (JsRe Re, string Word)[] ABBREV =
    [
        Abbrev("jms", "ja muu selline"),
        Abbrev("jmt", "ja muud teised"),
        Abbrev("ptk", "peatükk"),
        Abbrev("tlk", "tõlkinud"),
        Abbrev("nt", "näiteks"),
        Abbrev("nr", "number"),
        Abbrev("nn", "nii nimetatud"),
        Abbrev("sh", "sealhulgas"),
        Abbrev("jm", "ja muud"),
        Abbrev("jt", "ja teised"),
        Abbrev("vt", "vaata"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])u\\.?(?=\\s+\\d)", "gu"), "umbes"),
    ];

    // ── The clause window: is a word already said nearby? ────────────────────────────────────────────

    private static readonly JsRe CUT_LEFT = JsRegex.Compile("[.!?…][^.!?…]*$", "u");
    private static readonly JsRe CUT_RIGHT = JsRegex.Compile("[.!?…]", "u");

    /** JS `String.prototype.search(re)` — the index of the first match, or −1. `JsRe` has no `Search`, and
     *  this is the whole of it. */
    private static int Search(JsRe re, string s)
    {
        var m = re.Match(s);
        return m.Success ? m.Index : -1;
    }

    private static string ClauseWindow(string full, int start, int end)
    {
        var left = full[Math.Max(0, start - 45)..start];
        var right = full[end..Math.Min(full.Length, end + 45)];
        var cut = Search(CUT_LEFT, left);
        var stop = Search(CUT_RIGHT, right);
        return left[(cut == -1 ? 0 : cut + 1)..] + full[start..end] + (stop == -1 ? right : right[..stop]);
    }

    private static bool SaidNear(string full, int start, int end, params string[] needles)
    {
        var alt = string.Join("|", needles.Select(n => $"{n}\\p{{L}}*"));
        return JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])(?:{alt})(?![\\p{{L}}\\p{{M}}])", "iu")
            .IsMatch(ClauseWindow(full, start, end));
    }

    // ── The rule patterns ────────────────────────────────────────────────────────────────────────────

    /** The clock, and it needs the word `kell` before it — a bare `H.MM` is not a time of day. */
    private static readonly JsRe CLOCK_MARKED =
        JsRegex.Compile("(?<=\\bkell[ao]?\\s)([01]?\\d|2[0-3])[.:]([0-5]\\d)(?![\\d]|[.,:]\\d)", "giu");

    private static readonly JsRe DEGROUP = JsRegex.Compile(
        "(?<![\\d.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");  // space, NBSP, NNBSP, thin
    private static readonly JsRe SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");

    private static readonly JsRe ORD_PAIR_CONJ = JsRegex.Compile(
        $"(?<![\\d.,:\\p{{L}}\\p{{M}}])(\\d{{1,4}})\\.\\s+(ja|või)\\s+(\\d{{1,4}})\\.(?=\\s+({HEAD_WORD}))", "gu");
    private static readonly JsRe ORD_PAIR_DASH = JsRegex.Compile(
        $"(?<![\\d.,:\\p{{L}}\\p{{M}}])(\\d{{1,4}})\\.\\s*[–—-]\\s*(\\d{{1,4}})\\.(?=\\s+({HEAD_WORD}))", "gu");
    private static readonly JsRe ORD_SINGLE = JsRegex.Compile(
        $"(?<![\\d.,:\\p{{L}}\\p{{M}}])(\\d{{1,4}})\\.(?=\\s+({HEAD_WORD}))", "gu");
    private static readonly JsRe GEN_SUFFIX =
        JsRegex.Compile("(?<![\\d.,\\p{Sc}])(\\d{1,4})-(le|ni)(?![\\p{L}\\p{M}])", "gu");

    private static readonly JsRe RANGE_DASH = JsRegex.Compile(
        @"(?<![-+−–—/\d.,:\p{L}\p{M}])(\d+)[ ]?[-–—][ ]?(\d+)(?![-+−/\d:\p{L}\p{M}]|,\d)", "gu");
    private static readonly JsRe RANGE_ELLIPSIS =
        JsRegex.Compile("(?<![\\d.,])(\\d+)\\s*\\.\\.\\.\\s*(\\d+)(?![\\d.,])", "gu");

    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d+)(?![\\d,])", "gu");

    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(\\d)\\s*°\\s*[CF](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s*°(?!\\s*\\d+\\s*['’′])", "gu");

    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,–—-])[-−–](?=\\d)", "gu");
    private static readonly JsRe PLUS_LEAD = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_INFIX =
        JsRegex.Compile("(?<=[\\p{L}\\p{M}\\d)\\p{Sc}])\\s*\\+\\s*(?=[\\p{L}\\p{M}\\d(\\p{Sc}])", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_WS = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    public static string NormalizeEstonian(string input)
    {
        input = Rewrite(input, CLOCK_MARKED, "$1 $2");
        var t = input;

        t = Rewrite(t, DEGROUP, m => $"{m.Groups[1].Value}{SPACES.Replace(m.Groups[2].Value, "")}");

        foreach (var (re, phrase) in ERA) t = Rewrite(t, re, phrase);
        foreach (var (re, word) in ABBREV) t = Rewrite(t, re, word);

        // The ordinal, which must agree in case with the noun that follows — a pair joined by a
        // conjunction, a pair joined by a dash, then the single.
        t = Rewrite(t, ORD_PAIR_CONJ, m =>
        {
            var e = CaseOf(m.Groups[4].Value);
            if (e is null) return m.Value;
            var x = Ordinal(Js.Number(m.Groups[1].Value), e);
            var y = Ordinal(Js.Number(m.Groups[3].Value), e);
            return x is not null && y is not null ? $"{x} {m.Groups[2].Value} {y}" : m.Value;
        });
        t = Rewrite(t, ORD_PAIR_DASH, m =>
        {
            var e = CaseOf(m.Groups[3].Value);
            if (e is null) return m.Value;
            var x = Ordinal(Js.Number(m.Groups[1].Value), e);
            var y = Ordinal(Js.Number(m.Groups[2].Value), e);
            return x is not null && y is not null ? $"{x} {y}" : m.Value;
        });
        t = Rewrite(t, ORD_SINGLE, m =>
        {
            var e = CaseOf(m.Groups[2].Value);
            return e is null ? m.Value : Ordinal(Js.Number(m.Groups[1].Value), e) ?? m.Value;
        });

        // A figure carrying the genitive-based `-le` / `-ni` suffix.
        t = Rewrite(t, GEN_SUFFIX, m =>
        {
            var v = Js.Number(m.Groups[1].Value);
            return v >= 1 && v <= 9999 ? $"{GenCardinal((int)v)}{m.Groups[2].Value}" : m.Value;
        });

        // Ranges — the dash arm only when the span ASCENDS, which is what separates it from a subtraction
        // or an identifier.
        t = Rewrite(t, RANGE_DASH, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                ? $"{m.Groups[1].Value} {RANGE_JOINER} {m.Groups[2].Value}"
                : m.Value);
        t = Rewrite(t, RANGE_ELLIPSIS, $"$1 {RANGE_JOINER} $2");

        // The decimal comma — the fraction is read DIGIT BY DIGIT.
        t = Rewrite(t, DECIMAL, m =>
            $"{m.Groups[1].Value} {DECIMAL_WORD} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // Degrees — ⚠ NOT SAID TWICE: if `kraad…` is already in the clause window, only the figure is left.
        //
        // ⚠ AND `frozen` IS REASSIGNED BETWEEN THE TWO ARMS ON PURPOSE. The TS callback's fourth argument
        // is JS `String.replace`'s "the string being searched", which is `t` AS IT STANDS AT THAT CALL —
        // so the bare-° arm looks into the output of the scale arm, not into the original. `Degree` closes
        // over the VARIABLE, so reassigning it before the second Rewrite is what reproduces that. Reading
        // both arms against the same snapshot would be a different function on any input where the first
        // arm inserted or removed a `kraadi`.
        var frozen = t;
        string Degree(Match m) =>
            SaidNear(frozen, m.Index, m.Index + m.Length, "kraad")
                ? m.Groups[1].Value
                : $"{m.Groups[1].Value} {DEGREE_WORD}";
        t = Rewrite(t, DEG_SCALE, Degree);
        frozen = t;
        t = Rewrite(t, DEG_BARE, Degree);

        t = Rewrite(t, MINUS, "miinus ");
        t = Rewrite(t, PLUS_LEAD, "pluss ");
        t = Rewrite(t, PLUS_INFIX, " pluss ");

        return Rewrite(Rewrite(t, WS_RUN, " "), EDGE_WS, "");
    }

    // ── Initialisms ──────────────────────────────────────────────────────────────────────────────────

    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["a"] = "aa", ["b"] = "bee", ["c"] = "tsee", ["d"] = "dee", ["e"] = "ee", ["f"] = "eff",
            ["g"] = "gee", ["h"] = "haa", ["i"] = "ii", ["j"] = "jott", ["k"] = "kaa", ["l"] = "ell",
            ["m"] = "emm", ["n"] = "enn", ["o"] = "oo", ["p"] = "pee", ["q"] = "kuu", ["r"] = "err",
            ["s"] = "ess", ["t"] = "tee", ["u"] = "uu", ["v"] = "vee", ["w"] = "kaksisvee", ["x"] = "iks",
            ["y"] = "igrek", ["z"] = "tsett", ["ä"] = "ää", ["ö"] = "öö", ["õ"] = "õõ", ["ü"] = "üü",
            ["š"] = "šaa", ["ž"] = "žee",
        };

    public static readonly Func<string, bool> IsUnreadableEstonian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouyõäöü]", "u"),
        LegalOnsets = new HashSet<string>(
            ["bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps", "sk", "sl", "sn",
             "sp", "st", "sv", "tr", "ts", "tv"], StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(
            ["kk", "ks", "ld", "ll", "ls", "lt", "mm", "nd", "ng", "nk", "nn", "ns", "nt", "pp", "rd", "rr",
             "rs", "rt", "ss", "st", "tt", "hk", "ht"], StringComparer.Ordinal),
    });

    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(["usa"], StringComparer.Ordinal);

    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableEstonian,
    });

    public static string NormalizeEstonianInitialisms(string text) => INITIALISMS(ResolveHyphenInflection(text));

    /** An ALL-CAPS acronym carrying an inflectional suffix after a hyphen — the suffix attaches to the last
     *  letter NAME rather than standing alone. */
    private static readonly JsRe HYPHEN_INFLECTION =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu}{2,})-([a-zõäöüšž]{1,3})(?![\\p{L}\\p{M}])", "gu");

    private static string ResolveHyphenInflection(string text) =>
        Rewrite(text, HYPHEN_INFLECTION, m =>
        {
            var head = m.Groups[1].Value;
            var suf = m.Groups[2].Value;
            var lower = Js.ToLowerCase(head);
            if (!ACRONYM_LETTERS.Contains(lower) && !IsUnreadableEstonian(lower)) return m.Value;
            var names = Js.CodePoints(lower).Select(l => LETTER_NAME.GetValueOrDefault(l)).ToList();
            if (names.Any(n => n is null)) return m.Value;
            return Js.Trim($"{string.Join(" ", names.Take(names.Count - 1))} {names[^1]}{suf}");
        });
}
