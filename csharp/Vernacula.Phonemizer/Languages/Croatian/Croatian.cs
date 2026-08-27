/**
 * Croatian (hr, hrvatski) phonemizer — South Slavic, Gaj's Latin, fully phonemic. A THIN module: the
 * SEGMENTAL grapheme→IPA is Serbian's `PhonemizeWord`, reused verbatim, and the only Croatian delta is the
 * cardinal number words plus this file's symbol tier and normalizer.
 * Ported from src/languages/croatian/croatian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using SR = Vernacula.Phonemizer.Languages.Serbian;

namespace Vernacula.Phonemizer.Languages.Croatian;

public sealed class CroatianPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    // A Croatian word / number / punctuation token. Latin-only.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.LATIN_RUN})|([1-9]\\d{{0,2}}(?:\\.\\d{{3}})+(?:,\\d+)?|\\d+,\\d+|\\d+)|([.!?…,;:])", "giu");

    private const string NATIVE_CLASS = "[a-zčćšžđ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    /** The comma and the thousands period the number token may still carry (Normalize removes them first;
     *  the token accepts them so the tier can see a grouped figure whatever order it arrives in). */
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile(",", "gu");

    /** Croatian's symbol tier. ⚠ Public because Normalize.cs runs it in the ordered position its
     *  neighbours require — the TS keeps it here too, in the engine file, for the sourcing check. */
    public static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "puta" },
        Percent = new[] { "posto" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["¥"] = new[] { "jen" },
            ["$"] = new[] { "dolar", "dolara" },
            ["€"] = new[] { "euro" },
            ["£"] = new[] { "funta" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometar", "kilometra", "kilometara" },
            ["m"] = new[] { "metar", "metra", "metara" },
            ["mm"] = new[] { "milimetar", "milimetra", "milimetara" },
            ["cm"] = new[] { "centimetar", "centimetra", "centimetara" },
            ["mi"] = new[] { "milja", "milje", "milja" },
            ["ghz"] = new[] { "gigaherc", "gigaherca", "gigaherca" },
        },
        UnitPer = new UnitPerSpec
        {
            ByDenominator = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "na", ["s"] = "u" },
        },
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "sat", ["s"] = "sekundi" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadratni", "kvadratna", "kvadratnih" },
            Cubed = new[] { "kubni", "kubna", "kubnih" },
            Position = "before",
        },
        CountForm = NormalizeSymbols.SlavicCountForm,
    });

    public string Text(string input)
    {
        return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeCroatian(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(SR.SerbianPhonemizer.PhonemizeWord(Nat(SR.SerbianPhonemizer.ForeignLetters(m.Groups[1].Value))));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // ⚠ THE STRIPPED STRING IS BOTH THE VALUE AND THE `raw` DIGITS (#1059) — the digits cannot
                // be recovered from the double, and the separators must already be gone.
                var digits = DECIMAL_COMMA.Replace(GROUP_DOT.Replace(m.Groups[2].Value, ""), "");
                foreach (var wd in Numbers.NumberToWords(Js.Number(digits), digits).Split(' '))
                    sink.Emit(SR.SerbianPhonemizer.PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Croatian phonemizer (shared Serbo-Croatian g2p + Croatian cardinal numbers). */
    public static ILanguage CreateCroatian() => new CroatianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("croatian", CreateCroatian);
}
