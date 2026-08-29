/**
 * Estonian (et) phonemizer — eesti keel, Uralic (Finnic). Estonian is nearly as phonemic as its sibling
 * Finnish at the SEGMENT level, so the engine is a greedy grapheme scan + gemination (double letter →
 * [Cː]/[Vː]) + fixed first-syllable stress. The hard, only-partially-orthographic axes — PALATALIZATION
 * and the three-way QUANTITY (half-long) — are emitted where written and folded where not.
 * Ported from src/languages/estonian/estonian.ts — see that file for the referee evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Estonian;

public static class EstonianPhonemizer
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static EstonianNumbersDef N => Manifest.MANIFEST.Numbers;
    private static readonly IReadOnlySet<string> VOWEL_LETTERS = Manifest.VOWEL_LETTERS;

    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var segs = new List<(string Ph, bool Vowel)>();
        for (var i = 0; i < w.Length; i++)
        {
            var c = w[i].ToString();
            if (!G.TryGetValue(c, out var ph)) continue; // unknown char → skip
            var vowel = VOWEL_LETTERS.Contains(c);
            // A doubled letter → long: a double VOWEL is always long (aa→ɑː); a double CONSONANT is a
            // geminate [Cː] only AFTER A VOWEL (a true geminate is intervocalic — a doubled consonant after
            // another consonant is a compound-boundary CLUSTER, kesk+kool→keskkoːl, not a geminate).
            if (i + 1 < w.Length && w[i + 1].ToString() == c && (vowel || (segs.Count > 0 && segs[^1].Vowel)))
            {
                segs.Add((ph + "ː", vowel));
                i += 1;
                continue;
            }
            segs.Add((ph, vowel));
        }
        // Fixed first-syllable primary stress: ˈ before the first vowel nucleus.
        var first = segs.FindIndex(s => s.Vowel);
        var outp = new System.Text.StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == first) outp.Append('ˈ');
            outp.Append(segs[i].Ph);
        }
        return outp.ToString();
    }

    // ── Numbers (decimal; Estonian) ──────────────────────────────────────────────────────────────────
    private static string Sub100(int n)
    {
        if (n < 10) return N.Units[n];
        if (n == 10) return N.Ten;
        if (n < 20) return N.Teens[n - 11];
        var t = N.Units[n / 10] + N.TensSuffix;
        var u = n % 10;
        return u != 0 ? $"{t} {N.Units[u]}" : t;
    }

    private static string Sub1000(int n)
    {
        var h = n / 100;
        var r = n % 100;
        if (h == 0) return Sub100(r);
        var hw = (h == 1 ? "" : N.Units[h]) + N.Hundred;
        return r != 0 ? $"{hw} {Sub100(r)}" : hw;
    }

    internal static string NumberToText(double n)
    {
        if (n == 0) return N.Units[0];
        var parts = new List<string>();
        var mil = (int)Math.Floor(n / 1_000_000);
        n %= 1_000_000;
        if (mil != 0) parts.Add(mil == 1 ? $"{N.Units[1]} {N.Million}" : $"{Sub1000(mil)} {N.Millions}"); // üks miljon
        var th = (int)Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(th == 1 ? N.Thousand : $"{Sub1000(th)} {N.Thousand}");
        if (n != 0) parts.Add(Sub1000((int)n));
        return string.Join(" ", parts);
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n >= 1e9)
            // read digit-by-digit
            return string.Join(" ", Js.CodePoints(digits).Select(d =>
            {
                var v = Js.Number(d);
                return PhonemizeWord(double.IsInteger(v) && v >= 0 && v < N.Units.Count ? N.Units[(int)v] : d);
            }));
        return string.Join(" ", NumberToText(n).Split(' ').Where(x => x != "").Select(PhonemizeWord));
    }

    // A word (Estonian Latin letters incl. õ ä ö ü + loan š ž z) / number / punctuation token.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    private const string NATIVE_CLASS = "[a-zõäöüšžáéíóú]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    /**
     * The shared symbol tier. ⚠ ESTONIAN WELDS THE MEASURE WORD ONTO THE FRONT as one compound —
     * *ruutkilomeetrit*, *kuupmeetrit* — which is `compound`, never `before` (that would give
     * *ruut kilomeetrit*, two tokens).
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "protsent", "protsenti" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dollar", "dollarit" },
            ["€"] = new[] { "euro", "eurot" },
            ["£"] = new[] { "nael", "naela" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilomeeter", "kilomeetrit" },
            ["cm"] = new[] { "sentimeeter", "sentimeetrit" },
            ["mm"] = new[] { "millimeeter", "millimeetrit" },
            ["kg"] = new[] { "kilogramm", "kilogrammi" },
            ["ha"] = new[] { "hektar", "hektarit" },
            ["m"] = new[] { "meeter", "meetrit" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ruut" },
            Cubed = new[] { "kuup" },
            Position = ExponentPosition.Compound,
        },
        // The magnitude hop. Estonian takes NO connective (*viis miljonit dollarit*), so
        // MagnitudeConnective stays unset.
        Magnitudes = new[] { "miljon", "miljonit", "miljard", "miljardit", "biljon", "biljonit" },
        // ×4 in the retained text, every one between two proper names in a citation or a band credit, all
        // of which an Estonian reader says *ja*. The tier spaces the replacement on both sides so `B&B`
        // cannot fuse into one token.
        Ampersand = "ja",
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string rawInput)
        {
            var input = SYMBOLS(Normalize.NormalizeEstonianInitialisms(Normalize.NormalizeEstonian(rawInput)));
            return Clauses.AssembleClauses(input, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    sink.Emit(Number(m.Groups[2].Value));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Estonian phonemizer (grapheme scan + gemination + fixed first-syllable stress). */
    public static ILanguage CreateEstonian() => new Engine();

    internal static void RegisterSelf() => Registry.Register("estonian", CreateEstonian);
}
