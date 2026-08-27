/**
 * Slovenian (sl) phonemizer — rule g2p plus lexical stress from stress.tsv with a PENULTIMATE fallback and
 * a compound suffix rule; owns the five-slot Slovene count-form selector and the shared symbol tier.
 * Ported from src/languages/slovenian/slovenian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovenian;

/** A counted noun in the five slots `SlCountForm` indexes, plus its grammatical GENDER. */
public sealed class Counted
{
    public required string G { get; init; }
    public required IReadOnlyList<string> Forms { get; init; }
}

public sealed class SlovenianPhonemizer : ILanguage
{
    private static Dictionary<string, double>? STRESS;
    private static readonly object GATE = new();

    /** Lexical stress: word → 0-based ordinal of the stressed NUCLEUS. */
    public static Dictionary<string, double> StressDict()
    {
        lock (GATE)
        {
            // ⚠ THE `fold` IS LOAD-BEARING (#1068): 1,252 of the 37,340 keys are ə/ł respellings no Slovene
            // input can match, and 684 of them alias onto a word the file does not otherwise contain — so
            // dropping it here would load a DIFFERENT lexicon from the TypeScript's.
            return STRESS ??= LoadTsv.LoadTsvMapV<double>(
                "languages/slovenian", "stress.tsv", (v, _) => Js.Number(v), fold: k => Nat(k));
        }
    }

    /** Whether the lexicon knows this word's stress. */
    public static bool StressLexiconHas(string word) => StressDict().ContainsKey(word.ToLowerInvariant());

    private const int MIN_SUFFIX = 6;

    /** A COMPOUND takes its last element's own stress, shifted right by the nuclei in front of it. */
    private static double? BySuffix(string w, int nucleiCount)
    {
        var lex = StressDict();
        for (var cut = w.Length - MIN_SUFFIX; cut > 0; cut--)
        {
            var suffix = w[cut..];
            if (!lex.TryGetValue(suffix, out var at)) continue;
            var prefixNuclei = CountNuclei(w[..cut]);
            if (prefixNuclei < 1) continue;
            var shifted = prefixNuclei + at;
            return shifted < nucleiCount ? shifted : null;
        }
        return null;
    }

    /** Nuclei in a bare SPELLING, counted the way `ToSegments` will. */
    private static int CountNuclei(string w)
    {
        var n = 0;
        for (var i = 0; i < w.Length; i++)
        {
            var c = w[i];
            if ("aeiou".Contains(c)) n++;
            else if (c == 'r'
                     && !(i - 1 >= 0 && "aeiou".Contains(w[i - 1]))
                     && !(i + 1 < w.Length && "aeiou".Contains(w[i + 1]))) n++;
        }
        return n;
    }

    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        var nuclei = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) nuclei.Add(i);
        if (nuclei.Count < 2) return string.Concat(segs.Select(s => s.Ph));
        var lower = word.ToLowerInvariant();
        var hasKnown = StressDict().TryGetValue(lower, out var known);
        double at;
        if (hasKnown && known < nuclei.Count) at = known;
        else at = BySuffix(lower, nuclei.Count) ?? nuclei.Count - 2;
        // ⚠ The TS indexes `nuclei[at]` with a possibly non-integral `at` (a NaN or fractional lexicon value
        // yields `undefined` there and a throw here); every stress.tsv value is an integer, and a NaN is
        // filtered out by `known < nuclei.length` above.
        var mark = nuclei[(int)at];
        var sb = new System.Text.StringBuilder();
        for (var i = 0; i < segs.Count; i++) sb.Append(i == mark ? "ˈ" + segs[i].Ph : segs[i].Ph);
        return sb.ToString();
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private const string NATIVE_CLASS = "[A-Za-zČčŠšŽžĆćĐđ]";

    /** NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. */
    public static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "gu");

    /**
     * Slove count-form selector — index into a five-slot array:
     * 0 sg (1) · 1 DUAL (2) · 2 paucal (3–4) · 3 gen.pl (5+) · 4 gen.sg (a decimal).
     */
    public static int SlCountForm(double n) =>
        !(!double.IsNaN(n) && !double.IsInfinity(n) && Math.Floor(n) == n) ? 4
        : n == 1 ? 0
        : n == 2 ? 1
        : n >= 3 && n <= 4 ? 2
        : 3;

    private static Counted C(string g, params string[] forms) => new() { G = g, Forms = forms };

    /** ⚠ ORDERED: step 15 of Normalize iterates these in the TS object's declaration order. */
    public static readonly IReadOnlyList<KeyValuePair<string, Counted>> COUNTED_ORDER = new[]
    {
        new KeyValuePair<string, Counted>("km", C("m", "kilometer", "kilometra", "kilometri", "kilometrov", "kilometra")),
        new KeyValuePair<string, Counted>("m", C("m", "meter", "metra", "metri", "metrov", "metra")),
        new KeyValuePair<string, Counted>("mm", C("m", "milimeter", "milimetra", "milimetri", "milimetrov", "milimetra")),
        new KeyValuePair<string, Counted>("cm", C("m", "centimeter", "centimetra", "centimetri", "centimetrov", "centimetra")),
        new KeyValuePair<string, Counted>("kg", C("m", "kilogram", "kilograma", "kilogrami", "kilogramov", "kilograma")),
        new KeyValuePair<string, Counted>("ghz", C("m", "gigaherc", "gigaherca", "gigaherci", "gigahercev", "gigaherca")),
        new KeyValuePair<string, Counted>("mbit", C("m", "megabit", "megabita", "megabiti", "megabitov", "megabita")),
        new KeyValuePair<string, Counted>("mph", C("f", "milja na uro", "milji na uro", "milje na uro", "milj na uro", "milje na uro")),
        new KeyValuePair<string, Counted>("deg", C("f", "stopinja", "stopinji", "stopinje", "stopinj", "stopinje")),
        new KeyValuePair<string, Counted>("pct", C("m", "odstotek", "odstotka", "odstotki", "odstotkov", "odstotka")),
        new KeyValuePair<string, Counted>("usd", C("m", "dolar", "dolarja", "dolarji", "dolarjev", "dolarja")),
        new KeyValuePair<string, Counted>("eur", C("m", "evro", "evra", "evri", "evrov", "evra")),
        new KeyValuePair<string, Counted>("gbp", C("m", "funt", "funta", "funti", "funtov", "funta")),
        new KeyValuePair<string, Counted>("jpy", C("m", "jen", "jena", "jeni", "jenov", "jena")),
    };

    public static readonly IReadOnlyDictionary<string, Counted> COUNTED =
        COUNTED_ORDER.ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);

    private static IReadOnlyList<string> F(string k) => COUNTED[k].Forms;

    /** SYMBOL NORMALIZATION — Slovenian. ⚠ Public: Normalize.cs runs it at its own step 14. */
    public static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "krat" },
        Percent = new[] { "odstotek", "odstotka", "odstotki", "odstotkov", "odstotka" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dolar", "dolarja", "dolarji", "dolarjev", "dolarja" },
            ["USD"] = new[] { "dolar", "dolarja", "dolarji", "dolarjev", "dolarja" },
            ["€"] = new[] { "evro", "evra", "evri", "evrov", "evra" },
            ["£"] = new[] { "funt", "funta", "funti", "funtov", "funta" },
            ["¥"] = new[] { "jen", "jena", "jeni", "jenov", "jena" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = F("km"), ["m"] = F("m"), ["mm"] = F("mm"), ["cm"] = F("cm"), ["kg"] = F("kg"),
            ["ghz"] = F("ghz"), ["mbit"] = F("mbit"), ["mph"] = F("mph"),
        },
        Magnitudes = new[]
        {
            "milijon", "milijona", "milijoni", "milijonov",
            "milijarda", "milijardi", "milijarde", "milijard", "tisoč",
        },
        UnitPer = "na",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "uro", ["s"] = "sekundo" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadratni", "kvadratna", "kvadratni", "kvadratnih", "kvadratnega" },
            Cubed = new[] { "kubični", "kubična", "kubični", "kubičnih", "kubičnega" },
            Position = "before",
        },
        CountForm = SlCountForm,
    });

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeSlovenian(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var d = m.Groups[2].Value;
                var words = d.Length <= 15 ? Numbers.NumberToWords(Js.Number(d), d) : Numbers.ReadDigits(d);
                foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Slovenian phonemizer (rule g2p + lexical stress + cardinal numbers). */
    public static ILanguage CreateSlovenian() => new SlovenianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("slovenian", CreateSlovenian);
}
