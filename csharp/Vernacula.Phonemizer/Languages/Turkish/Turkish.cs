/**
 * Turkish (tr) phonemizer — canonical IPA.
 * Ported from src/languages/turkish/turkish.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public static class TurkishPhonemizer
{
    private static Dictionary<string, double>? STRESS;
    private static readonly object GATE = new();
    private static Dictionary<string, double> StressDict()
    {
        lock (GATE) return STRESS ??= LoadTsv.LoadTsvMapV<double>("languages/turkish", "stress.tsv",
            (v, _) => Js.Number(v) is var d && double.IsNaN(d) ? null : d, optional: true);
    }

    private static readonly JsRe VOWEL_LETTER = JsRegex.Compile("[aeıioöuüâîû]", "");
    private static int NVowels(string s)
    {
        var n = 0;
        foreach (var c in Js.CodePoints(s)) if (VOWEL_LETTER.IsMatch(c)) n++;
        return n;
    }

    private const string PRE_ACCENT =
        "(?:(?:r)?ken|(?:y)?l[ae]|m[ae]|s[ae]|[dt][ıiuü]r|(?:y)?(?:[ıiuü]m|[ıiuü]z|s[ıiuü]n[ıiuü]z))";
    private const string TAIL = "(?:l[ae]r|[ıiuü][mnz]|n[ıiuü]z|[ae]|y[ae]|d[ae]n?|n[ıiuü]n|)";
    private static readonly JsRe PRE_ACCENT_RE = JsRegex.Compile(PRE_ACCENT + TAIL + "$", "u");
    private static readonly JsRe IYOR_RE = JsRegex.Compile("([ıiuü])yor(?:um|sun|uz|sunuz|lar)?$", "u");

    /** A pre-accenting suffix's 1-based stressed syllable, or undefined (→ default final stress). */
    private static int? MorphStress(string wl)
    {
        var iyor = IYOR_RE.Match(wl); // progressive: stress the I of Iyor (geliyor→ɟelˈijoɾ)
        if (iyor.Success) return NVowels(wl[..(iyor.Index + 1)]);
        var m = PRE_ACCENT_RE.Match(wl); // leftmost pre-accenting suffix → stress the syllable before it
        if (m.Success)
        {
            var syl = NVowels(wl[..m.Index]);
            if (syl >= 1) return syl;
        }
        return null;
    }

    /** Phonemize a single Turkish word to canonical IPA (with a stress mark before the stressed vowel). `finalStress`
     *  forces plain final-syllable stress, bypassing the lexicon + pre-accenting rules (used for number words,
     *  which are lexically final-stressed — the -Iz person-ending rule would otherwise mis-stress
     *  dokuz→dˈokuz). */
    public static string PhonemizeWord(string word, bool finalStress = false)
    {
        var segs = G2p.ToSegments(word);
        var nuclei = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        if (nuclei.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var wl = G2p.TrLower(word);
        double? syl = finalStress
            ? null
            : (StressDict().TryGetValue(wl, out var lex) ? lex : MorphStress(wl));
        var stressIdx =
            syl is not null && syl >= 1 && syl <= nuclei.Count
                ? nuclei[(int)syl.Value - 1]
                : nuclei[^1];
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
        $"({HostWord.LATIN_RUN})|(\\d+)\\.(?=[^\\S\\n]+\\S)|(\\d+(?:(?<!(?<!\\d)0)\\.\\d{{3}})*(?:,\\d+)?)(?:['’]([a-zçğıiöşüâîû]+))?|([.!?…,;:])", "giu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zçğıiöşüâîûİ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    /** A number token (Turkish thousands-dots / decimal-comma) → spoken words. */
    private static readonly JsRe THOUSANDS_DOT = JsRegex.Compile("\\.", "g");
    private static string NumberTokenToWords(string tok)
    {
        var bits = tok.Split(',');
        var intRaw = bits[0];
        var frac = bits.Length > 1 ? bits[1] : null;
        var words = TurkishNumbers.NumberToWords(Js.Number(JsRegex.Replace(intRaw, THOUSANDS_DOT, _ => "")));
        if (frac is not null)
            words +=
                $" {Manifest.MANIFEST.Numbers.DecimalConnector} " +
                string.Join(" ", Js.CodePoints(frac).Select(d => TurkishNumbers.NumberToWords(Js.Number(d))));
        return words;
    }

    /** The unit table, named so the apostrophe-suffix rule below can derive its alternation from the SAME object
     *  the tier is given — a second hand-written list would drift the moment a unit is added. */
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> UNITS =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometre" }, ["cm"] = new[] { "santimetre" }, ["mm"] = new[] { "milimetre" },
            ["kg"] = new[] { "kilogram" }, ["m"] = new[] { "metre" },
        };

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Multiply = Manifest.MANIFEST.SymbolTier.Multiply,
        PercentPrefix = Manifest.MANIFEST.SymbolTier.PercentPrefix,
    });

    /**
     * An apostrophe-attached suffix defeats the unit tier's trailing guard (`360 km'lik`), so the suffix is
     * parked behind a sentinel, the tier speaks the unit, and the suffix is glued back on.
     */
    private static readonly string UNIT_ALT = string.Join("|", UNITS.Keys.OrderByDescending(a => a.Length));
    private const string SUFFIX_MARK = "\u0001"; // never occurs in input; the glue step below removes it again
    private static readonly JsRe SUFFIXED_UNIT = JsRegex.Compile($"(\\d[\\d.,]*\\s?(?:{UNIT_ALT})(?:\\s?[²³23])?)['’](\\p{{L}}+)", "gu");
    private static readonly JsRe MARKED_SUFFIX = JsRegex.Compile($"(\\S+)\\s{SUFFIX_MARK}(\\p{{L}}+)", "gu");

    /** Read a unit carrying an apostrophe suffix: park the suffix, let the tier speak the unit, glue it back. */
    private static string ReadSuffixedUnits(string text)
    {
        var parked = JsRegex.Replace(text, SUFFIXED_UNIT, m => $"{m.Groups[1].Value} {SUFFIX_MARK}{m.Groups[2].Value}");
        var spoken = JsRegex.Replace(SYMBOLS(parked), MARKED_SUFFIX, m => m.Groups[1].Value + m.Groups[2].Value);
        return string.Join("", spoken.Split(SUFFIX_MARK));
    }

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            Clauses.AssembleClauses(ReadSuffixedUnits(Normalize.NormalizeTurkish(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success)
                {
                    var ord = Normalize.OrdinalWords(Js.Number(m.Groups[2].Value));
                    if (ord is not null)
                        foreach (var wd in ord.Split(' ')) sink.Emit(PhonemizeWord(wd, true));
                    else
                    {
                        foreach (var wd in NumberTokenToWords(m.Groups[2].Value).Split(' '))
                            sink.Emit(PhonemizeWord(wd, true));
                        var mk0 = CLAUSE_MARK.GetValueOrDefault(".");
                        if (mk0 is not null) sink.Pause(mk0);
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var words = NumberTokenToWords(m.Groups[3].Value).Split(' ').ToList();
                    foreach (var wd in m.Groups[4].Success && m.Groups[4].Value.Length > 0
                                 ? Normalize.AttachSuffix(words, m.Groups[4].Value)
                                 : words)
                        sink.Emit(PhonemizeWord(wd, true));
                }
                else if (m.Groups[5].Success && m.Groups[5].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[5].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Turkish phonemizer (rule g2p + final-syllable stress + an exception lexicon). */
    public static ILanguage CreateTurkish() => new Engine();

    internal static void RegisterSelf() => Registry.Register("turkish", CreateTurkish);
}
