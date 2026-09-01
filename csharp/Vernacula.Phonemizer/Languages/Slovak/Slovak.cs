/**
 * Slovak (sk) phonemizer — canonical IPA. Rule g2p (G2p.cs) + fixed FIRST-syllable stress with secondary stress
 * on even non-final nuclei (like Czech). Syllabic r̩/l̩ (and long ĺ/ŕ) count as nuclei. Text() tokenizes words /
 * numbers / punctuation.
 * Ported from src/languages/slovak/slovak.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovak;

public static class SlovakPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One Slovak word → canonical IPA with first-syllable primary stress + even-non-final secondary stress. */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        var nucIdx = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        if (nucIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var last = nucIdx.Count - 1;
        var outp = "";
        var vi = -1;
        for (var i = 0; i < segs.Count; i++)
        {
            if (segs[i].Nucleus)
            {
                vi++;
                outp += vi == 0 ? "ˈ" : vi >= 2 && vi % 2 == 0 && vi != last ? "ˌ" : "";
            }
            outp += segs[i].Ph;
        }
        return outp;
    }

    /** The shared symbol tier. ⚠ `CountForm` is SLOVAK'S OWN whole-numeral selector, not the shared Slavic one.
     *  Declared HERE (and consumed from Normalize.cs) so the tier and the local rules agree. */
    internal static readonly Func<string, string> Symbols = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "krát" },
        Percent = new[] { "percento", "percentá", "percent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "dolár", "doláre", "dolárov" },
            ["€"] = new[] { "euro", "eurá", "eur" },
            ["£"] = new[] { "libra", "libry", "libier" },
            ["¥"] = new[] { "jen", "jeny", "jenov" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometer", "kilometre", "kilometrov" },
            ["m"] = new[] { "meter", "metre", "metrov" },
            ["cm"] = new[] { "centimeter", "centimetre", "centimetrov" },
            ["mm"] = new[] { "milimeter", "milimetre", "milimetrov" },
            ["kg"] = new[] { "kilogram", "kilogramy", "kilogramov" },
            ["ghz"] = new[] { "gigahertz", "gigahertze", "gigahertzov" },
            ["mhz"] = new[] { "megahertz", "megahertze", "megahertzov" },
        },
        UnitPer = new UnitPerSpec { ByDenominator = new Dictionary<string, string> { ["h"] = "na", ["s"] = "za" } },
        RateDenominators = new Dictionary<string, string> { ["h"] = "hodinu", ["s"] = "sekundu" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "štvorcový", "štvorcové", "štvorcových" },
            Cubed = new[] { "kubický", "kubické", "kubických" },
            Position = ExponentPosition.Before,
        },
        CountForm = Normalize.SkCountForm,
    });

    /** This language's OWN inventory — a token this REJECTS carries a letter Slovak does not use. */
    private const string NATIVE_CLASS = "[A-Za-zÁáÄäČčĎďÉéÍíĹĺĽľŇňÓóÔôŔŕŠšŤťÚúÝýŽž]";
    /** NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. */
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
    // out-of-inventory diacritic and that letter was then read as an English LETTER NAME.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // normalize FIRST — its ordinal, clock, era and range steps need the digits still adjacent to
            // their marks. It calls the shared symbol tier itself.
            return Clauses.AssembleClauses(Normalize.NormalizeSlovak(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var digits = m.Groups[2].Value;
                    // ≤9 digits fits a safe integer (the top composed magnitude) → compose; longer → read the
                    // raw string digit-by-digit so the float conversion can't lose precision.
                    var words = digits.Length <= 9
                        ? SlovakNumbers.NumberToWords(Js.Number(digits), digits)
                        : SlovakNumbers.ReadDigits(digits);
                    foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Slovak phonemizer (rule g2p + first-syllable stress + cardinal numbers). */
    public static ILanguage CreateSlovak() => new Engine();

    internal static void RegisterSelf() => Registry.Register("slovak", CreateSlovak);
}
