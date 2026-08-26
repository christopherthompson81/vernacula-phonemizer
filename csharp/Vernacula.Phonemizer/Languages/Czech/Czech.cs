/**
 * Czech (cs) phonemizer — canonical IPA. Rule g2p plus fixed FIRST-syllable stress with secondary stress on
 * even non-final nuclei; syllabic r̩/l̩ count as nuclei. A loanword lexicon overrides the rules where they
 * mis-derive (chiefly di/ti/ni non-palatalization in loans).
 * Ported from src/languages/czech/czech.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Czech;

public static class CzechPhonemizer
{
    private const string Dir = "languages/czech";
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static Dictionary<string, string>? LEX;
    private static readonly object GATE = new();

    private static Dictionary<string, string> Lexicon()
    {
        lock (GATE) return LEX ??= LoadTsv.LoadTsvMap(Dir, "loanwords.tsv", optional: true);
    }

    /** One Czech word → canonical IPA with first-syllable primary stress + even-non-final secondary stress. */
    public static string PhonemizeWord(string word)
    {
        var lex = Lexicon();
        if (lex.TryGetValue(word, out var hit) || lex.TryGetValue(Js.ToLowerCase(word), out hit)) return hit;
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

    /** The shared symbol tier, with Czech's three-way agreement (1 procento / 2 procenta / 5 procent).
     *  ⚠ `CountForm` is CZECH'S OWN, not the shared Slavic selector — a compound ending in 1 takes the
     *  genitive plural where the Russian selector keeps the singular. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "krát" },
        Percent = new[] { "procento", "procenta", "procent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euro", "eura", "eur" },
            ["$"] = new[] { "dolar", "dolary", "dolarů" },
            ["£"] = new[] { "libra", "libry", "liber" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometr", "kilometry", "kilometrů" },
            ["m"] = new[] { "metr", "metry", "metrů" },
            ["cm"] = new[] { "centimetr", "centimetry", "centimetrů" },
            ["mm"] = new[] { "milimetr", "milimetry", "milimetrů" },
            ["kg"] = new[] { "kilogram", "kilogramy", "kilogramů" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "čtvereční", "čtvereční", "čtverečních" },
            Cubed = new[] { "krychlový", "krychlové", "krychlových" },
            Position = ExponentPosition.Before,
        },
        UnitPer = "za",
        RateDenominators = new Dictionary<string, string> { ["h"] = "hodinu", ["s"] = "sekundu" },
        CountForm = Normalize.CsCountForm,
    });

    /** This language's OWN inventory — a token this class REJECTS carries a letter Czech does not use. */
    private const string NATIVE_CLASS = "[A-Za-zÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž]";
    /** NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. */
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ TWO DELIBERATE WIDENINGS. The word arm is ALL OF LATIN, not NATIVE_CLASS: the narrow class ends the
    // token at an out-of-inventory diacritic and that letter is then read as an English LETTER NAME. And the
    // number arm carries its DECIMAL COMMA, or the comma is taken as clause punctuation and `2,3` becomes a
    // phrase break between "dva" and "tři".
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ORDER: Czech rewrites → INITIALISMS (after abbreviations, so `Co.` is not spelled CEE-OH) →
            // the shared symbol tier LAST (it needs the number still adjacent to its unit/sign).
            var normalized = SYMBOLS(Normalize.NormalizeCzechInitialisms(Normalize.NormalizeCzech(input)));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var bits = m.Groups[2].Value.Split(',');
                    var intPart = bits[0];
                    var frac = bits.Length > 1 ? bits[1] : null;
                    // ⚠ AND THE INTEGER PART MAY NOT BE A LONE `0`: no convention groups from zero, so
                    // `0,001` is one THOUSANDTH, not one.
                    if (frac is not null && frac.Length == 3 && intPart != "0")
                    {
                        // "19,500" is 19500 — a grouped thousand, read as one number.
                        foreach (var wd in CzechNumbers.NumberToWords(Js.Number($"{intPart}{frac}"), $"{intPart}{frac}").Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    }
                    else
                    {
                        foreach (var wd in CzechNumbers.NumberToWords(Js.Number(intPart), intPart).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                        if (frac is not null)
                        {
                            sink.Emit(PhonemizeWord("čárka")); // the Czech name of the decimal comma
                            foreach (var d in Js.CodePoints(frac))
                                foreach (var wd in CzechNumbers.NumberToWords(Js.Number(d)).Split(' '))
                                    sink.Emit(PhonemizeWord(wd));
                        }
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

    /** Build the Czech phonemizer. */
    public static ILanguage CreateCzech() => new Engine();

    internal static void RegisterSelf() => Registry.Register("czech", CreateCzech);
}
