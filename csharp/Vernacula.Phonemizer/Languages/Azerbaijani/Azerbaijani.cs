/**
 * Azerbaijani (az) phonemizer — North Azerbaijani (Latin), canonical IPA. Rule g2p + final-syllable stress.
 * Ported from src/languages/azerbaijani/azerbaijani.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Azerbaijani;

public static class AzerbaijaniPhonemizer
{
    /** Phonemize a single Azerbaijani word to canonical IPA (final-syllable stress, before the stressed vowel). */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        var nuclei = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        if (nuclei.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var stressIdx = nuclei[^1]; // final-syllable default
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp;
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.LATIN_RUN})|(\\d+(?<!(?<!\\d)0)\\.\\d{{3}}(?:\\.\\d{{3}})*|\\d+,\\d+|\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this class REJECTS carries a letter Azerbaijani does not use. */
    private const string NATIVE_CLASS = "[a-zçğəıiöşüx]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "vur" },
        Percent = new[] { "faiz" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["€"] = new[] { "avro" }, ["$"] = new[] { "dollar" },
            ["£"] = new[] { "funt sterlinq" }, ["¥"] = new[] { "yen" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometr" }, ["sm"] = new[] { "santimetr" }, ["mm"] = new[] { "millimetr" },
            ["kg"] = new[] { "kilogram" }, ["m"] = new[] { "metr" }, ["mil"] = new[] { "mil" },
            ["mi"] = new[] { "mil" }, ["yard"] = new[] { "yard" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadrat" }, Cubed = new[] { "kub" }, Position = "before",
        },
        Magnitudes = new[] { "milyon", "milyard", "trilyon" },
    });

    private static readonly JsRe GROUP_SEPARATORS = JsRegex.Compile("[ .]", "gu");

    /** A number token (Azerbaijani space-/period-thousands, comma-decimal) → spoken words. */
    private static string NumberTokenToWords(string tok)
    {
        var bits = tok.Split(',');
        var intRaw = bits[0];
        var frac = bits.Length > 1 ? bits[1] : null;
        var words = AzerbaijaniNumbers.NumberToWords(Js.Number(GROUP_SEPARATORS.Replace(intRaw, "")));
        if (frac is not null)
            words +=
                $" {Manifest.MANIFEST.Numbers.DecimalConnector} " +
                string.Join(" ", Js.CodePoints(frac).Select(d => AzerbaijaniNumbers.NumberToWords(Js.Number(d))));
        return words;
    }

    private static readonly JsRe DOTTED_I = JsRegex.Compile("İ", "gu");
    private static readonly JsRe DOTLESS_I = JsRegex.Compile("I", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ⚠ The İ→i / I→ı fold runs AFTER normalize.ts, not before: folding up front destroys the
            // all-caps signal the initialism pass keys on (`ı`/`i` are lowercase), so `IBM sistemi` read as
            // a word. Here the only consumer left is the tokenizer, whose /i class cannot see İ at all.
            var normalized = DOTLESS_I.Replace(DOTTED_I.Replace(SYMBOLS(Normalize.NormalizeAzerbaijani(input)), "i"), "ı");
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var wd in NumberTokenToWords(m.Groups[2].Value).Split(' ')) sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Azerbaijani phonemizer (rule g2p + final-syllable stress). */
    public static ILanguage CreateAzerbaijani() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("azerbaijani", CreateAzerbaijani);
        Registry.RegisterRomanPolicy("az", RomanOrdinals.ROMAN_POLICY);
    }
}
