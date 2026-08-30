/**
 * Galician (gl) phonemizer — canonical IPA, galego. Rule-based g2p + nasal velarization + spirantization
 * + rule-based stress; no lexicon.
 * Ported from src/languages/galician/galician.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Galician;

public sealed class GalicianPhonemizer : ILanguage
{
    private static readonly IReadOnlySet<string> NASALS =
        new HashSet<string>(Manifest.MANIFEST.Nasals, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> STOP_TO_FRIC => Manifest.MANIFEST.Spirantize;
    private static readonly IReadOnlySet<string> VELARS =
        new HashSet<string>(Manifest.MANIFEST.Velars, StringComparer.Ordinal);

    /** Coda velarization — Galician neutralizes a coda/word-final nasal to the velar [ŋ]. Runs before
     *  spirantization so the resulting ŋ blocks the following ɡ from spirantizing (ningún→niŋɡuŋ). */
    private static void VelarizeNasal(List<Seg> segs)
    {
        var last = segs.Count - 1;
        for (var i = 0; i < segs.Count; i++)
        {
            var ph = segs[i].Ph;
            var next = i < last ? segs[i + 1].Ph : "";
            if (ph == "n")
            {
                // word-final, before a velar, or the final -ns cluster (n at len-2, s at len-1)
                if (next == "" || VELARS.Contains(next) || (next == "s" && i == last - 1))
                    segs[i].Ph = "ŋ";
            }
            else if (ph == "m" && next == "")
                segs[i].Ph = "ŋ"; // final-nasal neutralization (rare -m loans)
        }
    }

    /** b/d/ɡ → β/ð/ɣ except utterance-initial, after a nasal, or d after l. */
    private static void Spirantize(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            var ph = segs[i].Ph;
            if (!STOP_TO_FRIC.TryGetValue(ph, out var fric)) continue;
            var prev = i > 0 ? segs[i - 1].Ph : "";
            var stop = i == 0 || NASALS.Contains(prev) || (ph == "d" && prev == "l");
            if (!stop) segs[i].Ph = fric;
        }
    }

    /**
     * ⚠ SPIRANTIZATION IS POST-LEXICAL — it does not stop at the word edge, and `Spirantize` above cannot
     * see past one.
     */
    private static readonly JsRe CROSS_WORD_STOP = JsRegex.Compile("([^\\s])(\\s+)([bdɡ])", "gu");
    private static readonly JsRe LETTERISH = JsRegex.Compile("[\\p{L}\\p{M}ˈˌ]", "u");

    private static string SpirantizeAcrossWords(string ipa)
    {
        // ⚠ REPORTED TO THE TRACE (#1150): runs on the ASSEMBLED string, so a token's Emitted reading is
        // not what ships — `gato` emits ɡˈato and the sentence reads ɣˈato.
        var traced = SpirantizeAcrossWordsCore(ipa);
        Core.Trace.NoteRewrite("spirantize-across-words", ipa, traced, true);
        return traced;
    }

    private static string SpirantizeAcrossWordsCore(string ipa)
    {
        return CROSS_WORD_STOP.Replace(ipa, m =>
        {
            var prev = m.Groups[1].Value;
            var gap = m.Groups[2].Value;
            var stop = m.Groups[3].Value;
            if (NASALS.Contains(prev)) return m.Value;                   // nasal + stop stays occlusive
            if (stop == "d" && prev == "l") return m.Value;             // homorganic: only /d/ after /l/
            if (!LETTERISH.IsMatch(prev)) return m.Value;               // after a pause = utterance-initial
            return prev + gap + (STOP_TO_FRIC.TryGetValue(stop, out var f) ? f : stop);
        });
    }

    /**
     * Index of the stressed nucleus: the written accent, else penultimate (word ends in a syllabic vowel /
     * n / s) or final. The "ends in a vowel" test is on the last SEGMENT being a nucleus — a word ending in
     * a falling diphthong is glide-final (cantou→[kanˈtow], amei→[aˈmej]), so it takes oxytone stress.
     */
    private static int StressedNucleus(string word, IReadOnlyList<Seg> segs)
    {
        var nuclei = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) nuclei.Add(i);
        if (nuclei.Count == 0) return -1;
        foreach (var i in nuclei) if (segs[i].Accent) return i;
        if (nuclei.Count == 1) return nuclei[0];
        var w = Js.ToLowerCase(word);
        var last = w.Length > 0 ? w[^1].ToString() : "";
        var endsNucleus = segs[^1].Nucleus; // a TRUE final vowel (a diphthong offglide is not one)
        var penult = endsNucleus || last == "n" || last == "s";
        return penult ? nuclei[^2] : nuclei[^1];
    }

    /** Phonemize a single Galician word to canonical IPA (with a stress mark). */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        if (segs.Count == 0) return "";
        VelarizeNasal(segs);
        Spirantize(segs);
        var stress = StressedNucleus(word, segs);
        var outp = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp.Append('ˈ');
            outp.Append(segs[i].Ph);
        }
        return outp.ToString();
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    // A word / number / clause-punctuation token. Numbers use the Iberian convention: dot = thousands
    // separator (1.500), comma = decimal (3,14). Galician letters incl. accents + ñ/ü.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.LATIN_RUN})|(\\d+(?:(?<!(?<!\\d)0)\\.\\d+)*(?:,\\d+)?)|([.!?…,;:])", "giu");

    /** This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class decides where
     *  the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     *  letters. A token this class REJECTS carries a letter the language does not use — a foreign name. */
    private const string NATIVE_CLASS = "[a-záéíóúüñ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private static readonly JsRe THOUSAND_DOTS = JsRegex.Compile("\\.", "g");

    /** A number token (with thousands-dots / decimal-comma) → spoken words. */
    private static string NumberTokenToWords(string tok)
    {
        var bits = tok.Split(',');
        var intRaw = bits[0];
        string? frac = bits.Length > 1 ? bits[1] : null;
        var words = Numbers.NumberToWords(Js.Number(THOUSAND_DOTS.Replace(intRaw, "")), THOUSAND_DOTS.Replace(intRaw, ""));
        if (frac is not null)
            words += $" {Manifest.MANIFEST.Numbers.DecimalConnector} "
                + string.Join(" ", Js.CodePoints(frac).Select(d => Numbers.NumberToWords(Js.Number(d))));
        return words;
    }

    private static readonly IReadOnlySet<string> FUNCTION_WORDS =
        new HashSet<string>(Manifest.MANIFEST.FunctionWords, StringComparer.Ordinal);

    /** Phonemize one running-text word, de-accenting unstressed function words. */
    private static string WordIpa(string word)
    {
        var ipa = PhonemizeWord(word);
        return FUNCTION_WORDS.Contains(Js.ToLowerCase(word)) ? Js.ReplaceFirst(ipa, "ˈ", "") : ipa;
    }

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "por cento" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euro", "euros" },
            ["$"] = new[] { "dólar", "dólares" },
            ["£"] = new[] { "libra", "libras" },
            ["¥"] = new[] { "ien", "iens" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "quilómetro", "quilómetros" },
            ["cm"] = new[] { "centímetro", "centímetros" },
            ["mm"] = new[] { "milímetro", "milímetros" },
            ["kg"] = new[] { "quilogramo", "quilogramos" },
            ["t"] = new[] { "tonelada", "toneladas" },
            ["g"] = new[] { "gramo", "gramos" },
            ["l"] = new[] { "litro", "litros" },
            ["ha"] = new[] { "hectárea", "hectáreas" },
            ["h"] = new[] { "hora", "horas" },
            ["s"] = new[] { "segundo", "segundos" },
            ["m"] = new[] { "metro", "metros" },
        },
        UnitPer = "por",
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "cadrado", "cadrados" },
            Cubed = new[] { "cúbico", "cúbicos" },
        },
        BareExponent = new BareExponentDef { Squared = "{n} ao cadrado" },
        Multiply = new MultiplyDef { Times = "multiplicado por", By = "por" },
        Ampersand = "e",
        Magnitudes = new[] { "millóns", "millón" },
        MagnitudeConnective = "de",
    });

    public string Text(string input)
    {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal, clock, era and range steps
        // need the number and its suffix still adjacent, which the tier would break; and the tier matches a
        // unit only when a NUMBER is adjacent.
        return SpirantizeAcrossWords(Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeGalician(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(WordIpa(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                sink.Emit(string.Join(" ", NumberTokenToWords(m.Groups[2].Value).Split(' ').Select(WordIpa)));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        }));
    }

    /** Build the Galician phonemizer (no data files beyond the manifest — the engine is fully rule-based). */
    public static ILanguage CreateGalician() => new GalicianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("galician", CreateGalician);
}
