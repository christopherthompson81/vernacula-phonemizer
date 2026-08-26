/**
 * Thai (th) phonemizer — canonical IPA (authored).
 * Ported from src/languages/thai/thai.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Thai;

public static class ThaiPhonemizer
{
    private static readonly JsRe TOKEN = JsRegex.Compile("([฀-๿]+)|(\\d+)|([.!?…,;:])", "gu");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static IReadOnlyList<string> TH_UNITS => Normalize.THAI_DIGIT_WORDS;
    private static readonly (double V, string W)[] TH_MAG =
        { (1e6, "ล้าน"), (1e5, "แสน"), (1e4, "หมื่น"), (1e3, "พัน"), (100, "ร้อย") };

    private static List<string> NumberToThaiWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
        {
            return Js.CodePoints((raw ?? Js.NumberToString(Math.Abs(n))))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => TH_UNITS[(int)Js.Number(d)])
                .ToList();
        }
        if (n == 0) return new List<string> { TH_UNITS[0] };
        var @out = new List<string>();
        var r = n;
        foreach (var (v, w) in TH_MAG)
        {
            if (r >= v)
            {
                var q = Math.Floor(r / v);
                @out.AddRange(NumberToThaiWords(q));
                @out.Add(w);
                r %= v;
            }
        }
        if (r >= 10)
        {
            var t = Math.Floor(r / 10);
            if (t == 2) @out.Add("ยี่สิบ");
            else if (t == 1) @out.Add("สิบ");
            else { @out.Add(TH_UNITS[(int)t]); @out.Add("สิบ"); }
            r %= 10;
            if (r == 1) { @out.Add("เอ็ด"); r = 0; } // final 1 after a ten is เอ็ด
        }
        if (r > 0) @out.Add(TH_UNITS[(int)r]);
        return @out;
    }

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Ampersand = Manifest.MANIFEST.SymbolTier.Ampersand,
        Multiply = Manifest.MANIFEST.SymbolTier.Multiply,
        UnspacedScript = Manifest.MANIFEST.SymbolTier.UnspacedScript,
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            Clauses.AssembleClauses(Normalize.NormalizeThai(SYMBOLS(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(G2p.PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in NumberToThaiWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value)) sink.Emit(G2p.PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    public static ILanguage CreateThai() => new Engine();

    internal static void RegisterSelf() => Registry.Register("thai", CreateThai);
}
