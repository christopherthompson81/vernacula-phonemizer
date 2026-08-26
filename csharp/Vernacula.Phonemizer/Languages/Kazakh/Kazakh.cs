/**
 * Kazakh (kk) phonemizer — canonical IPA. Rule g2p (G2p.cs) plus the STRESSPOSN_1RU stress rule, initial-cluster
 * epenthesis, and the vowel-harmony ɫ→l lightening; text() tokenizes words / numbers / punctuation.
 * Ported from src/languages/kazakh/kazakh.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kazakh;

public static class KazakhPhonemizer
{
    /** Any Kazakh vowel/glide letter (from the manifest's vowel + glide tables) — its absence means an abbreviation. */
    private static readonly JsRe VOWEL_OR_GLIDE = JsRegex.Compile(
        $"[{string.Concat(Manifest.MANIFEST.Vowels.Keys)}{string.Concat(Manifest.MANIFEST.Glides.Keys)}]", "u");

    private static readonly JsRe FRONT_VOWEL = JsRegex.Compile($"[{Manifest.MANIFEST.FrontVowels}]", "u");
    private static readonly JsRe DARK_L = JsRegex.Compile("ɫ", "gu");

    /** One Kazakh word → canonical IPA with a single primary-stress mark (STRESSPOSN_1RU). */
    public static string PhonemizeWord(string word)
    {
        if (!VOWEL_OR_GLIDE.IsMatch(Js.ToLowerCase(word)))
        {
            var cons = G2p.ToSegments(word).Select(s => s.Ph).ToList();
            if (cons.Count == 0) return "";
            return string.Concat(cons.Select((c, i) => i == cons.Count - 1 ? $"{c}ˈə" : $"{c}ə"));
        }
        var segs = G2p.ToSegments(word);
        static bool IsCons(Seg s) => !s.Nucleus && s.Ph != "w" && s.Ph != "j";
        if (segs.Count >= 3 && IsCons(segs[0]) && IsCons(segs[1]) && IsCons(segs[2]))
            segs.Insert(1, new Seg { Ph = "ə", Nucleus = true });
        var nucIdx = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        if (nucIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var stressNuc = nucIdx.Count - 1;
        for (var k = 1; k < nucIdx.Count; k++)
        {
            if (segs[nucIdx[k]].Ph == "ə") { stressNuc = k - 1; break; }
        }
        var stressIdx = nucIdx[stressNuc];
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) outp += "ˈ";
            outp += segs[i].Ph;
        }
        if (FRONT_VOWEL.IsMatch(outp)) outp = DARK_L.Replace(outp, "l");
        return outp;
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static readonly JsRe TOKEN = JsRegex.Compile(
        "([Ѐ-ӿ]+)|([1-9]\\d{0,2}(?:[ \\u00a0\\u202f\\u2009]\\d{3})+(?:,\\d+)?|\\d+,\\d+|\\d+)|([.!?…,;:])", "gu");

    private static readonly JsRe CAMEL_SPLIT = JsRegex.Compile(@"(?<=\p{Ll})(?=\p{Lu})", "u");
    private static readonly JsRe SPACES = JsRegex.Compile(" ", "gu");

    public static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "есе" },
        Ampersand = "және",
        Percent = new[] { "пайыз" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "доллар" }, ["€"] = new[] { "еуро" }, ["¥"] = new[] { "йен" }, ["£"] = new[] { "фунт" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["км"] = new[] { "километр" }, ["km"] = new[] { "километр" },
            ["кг"] = new[] { "килограмм" }, ["kg"] = new[] { "килограмм" },
            ["м"] = new[] { "метр" }, ["m"] = new[] { "метр" },
            ["мм"] = new[] { "миллиметр" }, ["mm"] = new[] { "миллиметр" },
            ["см"] = new[] { "сантиметр" }, ["cm"] = new[] { "сантиметр" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "шаршы" }, Cubed = new[] { "текше" }, Position = "before",
        },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // normalize FIRST, then the shared symbol tier — normalize's case-suffix/ordinal/era steps need
            // the number and its suffix still adjacent, which the tier would break.
            return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeKazakh(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                {
                    foreach (var part in CAMEL_SPLIT.Re.Split(m.Groups[1].Value)) sink.Emit(PhonemizeWord(part));
                }
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var ipa = KazakhNumbers.NumberToIpa(Js.Number(SPACES.Replace(m.Groups[2].Value, "")));
                    foreach (var w in ipa.Split(' ')) sink.Emit(w); // numbers are pre-phonemized
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    public static ILanguage CreateKazakh() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("kazakh", CreateKazakh);
        Registry.RegisterRomanPolicy("kk", RomanOrdinals.ROMAN_POLICY);
    }
}
