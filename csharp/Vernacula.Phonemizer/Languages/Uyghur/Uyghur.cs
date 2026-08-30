/**
 * Uyghur / ئۇيغۇرچە (ug) phonemizer — the Uyghur Arabic alphabet is a FULL phonemic alphabet, so a greedy
 * letter→IPA scan plus word-final stop devoicing suffices; cardinals use the Turkic compositor.
 * Ported from src/languages/uyghur/uyghur.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Uyghur;

public sealed class UyghurPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static readonly IReadOnlyDictionary<string, string> FINAL_DEVOICE =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["b"] = "p", ["d"] = "t", ["ɡ"] = "k" };

    /** Phonemize a single Uyghur word to canonical IPA (segmental; final devoicing; non-tonal). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.Normalize(word, NormalizationForm.FormC);
        var seg = new List<string>();
        foreach (var ch in Js.CodePoints(w))
            if (G.TryGetValue(ch, out var g)) seg.Add(g);
        if (seg.Count > 0 && FINAL_DEVOICE.TryGetValue(seg[^1], out var dev)) seg[^1] = dev;
        return string.Concat(seg);
    }

    private static NumbersDef NUM => Manifest.MANIFEST.Numbers;

    /** Turkic decimal composition: units + a distinct round-ten word, JUXTAPOSED with no connective. */
    private static List<string?> TurkicNumberWords(double n, NumbersDef d)
    {
        if (n < 10) return [d.Units[(int)n]];
        if (n < 100)
        {
            double t = Math.Floor(n / 10) * 10, u = n % 10;
            var outp = new List<string?> { d.Tens[Js.NumberToString(t)] };
            if (u != 0) outp.Add(d.Units[(int)u]);
            return outp;
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            var outp = new List<string?>();
            if (h > 1) outp.Add(d.Units[(int)h]);
            outp.Add(d.Magnitudes.Hundred);
            if (r != 0) outp.AddRange(TurkicNumberWords(r, d));
            return outp;
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var outp = new List<string?>();
            if (th > 1) outp.AddRange(TurkicNumberWords(th, d));
            outp.Add(d.Magnitudes.Thousand);
            if (r != 0) outp.AddRange(TurkicNumberWords(r, d));
            return outp;
        }
        if (n < 1_000_000_000)
        {
            double m = Math.Floor(n / 1_000_000), r = n % 1_000_000;
            var outp = new List<string?>(TurkicNumberWords(m, d)) { d.Magnitudes.Million };
            if (r != 0) outp.AddRange(TurkicNumberWords(r, d));
            return outp;
        }
        double b = Math.Floor(n / 1_000_000_000), rb = n % 1_000_000_000;
        var res = new List<string?>(TurkicNumberWords(b, d)) { d.Magnitudes.Billion };
        if (rb != 0) res.AddRange(TurkicNumberWords(rb, d));
        return res;
    }

    internal static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** A run of ASCII digits → the spoken Uyghur cardinal in canonical IPA. */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!IsSafeInteger(n)) return Numbers.SpellDigits(digits, NUM, PhonemizeWord);
        return Numbers.RenderNumber(n, NUM, PhonemizeWord, TurkicNumberWords);
    }

    /** A non-negative integer → its Uyghur numeral SPELLING (words, not IPA) — the dependency the
     *  normalizer's ordinal rule needs so it can suffix the LAST WORD of the numeral. */
    public static string NumeralWords(double n)
    {
        if (!IsSafeInteger(n) || n < 0) return "";
        return string.Join(" ", TurkicNumberWords(n, NUM).Where(w => w is not null && w != ""));
    }

    private static readonly Func<string, string> NormalizeUyghur = Normalize.MakeUyghurNormalizer(NumeralWords);

    private static readonly JsRe TOKEN = JsRegex.Compile("([ؠ-ۿ]+)|(\\d+)|([؟؛،.!?…,])", "gu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(NormalizeUyghur(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Number(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Uyghur phonemizer (greedy letter g2p + final devoicing + the Turkic number compositor). */
    public static ILanguage CreateUyghur() => new UyghurPhonemizer();

    internal static void RegisterSelf() => Registry.Register("uyghur", CreateUyghur);
}
