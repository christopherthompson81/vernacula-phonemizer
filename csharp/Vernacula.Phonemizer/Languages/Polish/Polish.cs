/**
 * Polish (pl) phonemizer — canonical IPA.
 * Ported from src/languages/polish/polish.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

public static class PolishPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One Polish word → canonical IPA with penultimate primary stress. */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        var nucIdx = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        var stressAt = nucIdx.Count >= 2 ? nucIdx[^2] : (nucIdx.Count > 0 ? nucIdx[0] : -1);
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressAt) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp.Normalize(System.Text.NormalizationForm.FormC);
    }

    /**
     * Shared SYMBOL tier — %, currency signs and unit abbreviations, matched only when a NUMBER is adjacent,
     * which is why it runs LAST and why the decimal comma is left in the text for it to see.
     * `CountForm` is Polish's own, NOT the shared Slavic selector: Polish sends a compound ending in 1 to the
     * genitive plural where Russian keeps the singular.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "razy" },
        Ampersand = "i",
        CountForm = Normalize.PlCountForm,
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Magnitudes = Manifest.MANIFEST.SymbolTier.Magnitudes,
    });

    /**
     * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim,
     * so nothing about the orthography is invented here. A token this class REJECTS carries a letter the
     * language does not use, i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]";
    /** NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. */
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ TWO DELIBERATE WIDENINGS HERE. The word arm is ALL OF LATIN, not just NATIVE_CLASS: the narrow class
    // ends the token at an out-of-inventory diacritic, and that letter is then read as an English LETTER NAME
    // with the rest of the word starting over. And the number arm carries its DECIMAL COMMA, or the comma is
    // taken as clause punctuation and `14,7` comes back as a phrase break mid-number.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+(?:,\\d+)?)|([.?!,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ORDER: the Polish rewrites first, then INITIALISMS (after the abbreviation rules, so `m.in.` is
            // not spelled out EM-EN), then the shared symbol tier LAST — it needs the number still adjacent to
            // its unit or sign. Roman numerals arrive already converted at the registry seam.
            var normalized = SYMBOLS(Normalize.NormalizePolishInitialisms(Normalize.NormalizePolish(input)));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var bits = m.Groups[2].Value.Split(',');
                    var intPart = bits[0];
                    var frac = bits.Length > 1 ? bits[1] : null;
                    foreach (var wd in PolishNumbers.NumberToWords(Js.Number(intPart), intPart).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                    if (frac is not null)
                    {
                        sink.Emit(PhonemizeWord(Manifest.MANIFEST.DecimalWord)); // the Polish name of the decimal comma
                        foreach (var d in Js.CodePoints(frac))
                            foreach (var wd in PolishNumbers.NumberToWords(Js.Number(d)).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Polish phonemizer. */
    public static ILanguage CreatePolish() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("polish", CreatePolish);
        Registry.RegisterRomanPolicy("pl", RomanOrdinals.ROMAN_POLICY);
    }
}
