/**
 * Spanish (es) phonemizer — canonical IPA, broad Castilian.
 * Ported from src/languages/spanish/spanish.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public sealed class SpanishPhonemizer : ILanguage
{
    private static readonly IReadOnlySet<string> NASALS = new HashSet<string>(Manifest.MANIFEST.Nasals, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> STOP_TO_FRIC => Manifest.MANIFEST.Spirantize;
    private static readonly JsRe FINAL_VOWEL = JsRegex.Compile("[aeiouáéíóú]$", "i");

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
     * ⚠ SPIRANTIZATION IS POST-LEXICAL — it does not stop at the word edge, and `spirantize()` above cannot
     * see past one.
     */
    private static readonly JsRe CROSS_WORD_STOP = JsRegex.Compile("([^\\s])(\\s+)([bdɡ])", "gu");
    private static readonly JsRe LETTERISH = JsRegex.Compile("[\\p{L}\\p{M}ˈˌ]", "u");

    private static string SpirantizeAcrossWords(string ipa)
    {
        return CROSS_WORD_STOP.Replace(ipa, m =>
        {
            var prev = m.Groups[1].Value;
            var gap = m.Groups[2].Value;
            var stop = m.Groups[3].Value;
            if (NASALS.Contains(prev)) return m.Value;                    // un dato, con base
            if (stop == "ɡ" && prev == "n") return m.Value;               // (covered above, kept explicit)
            if (stop == "d" && prev == "l") return m.Value;               // el dato
            if (!LETTERISH.IsMatch(prev)) return m.Value;                 // after a pause mark = utterance-initial
            return prev + gap + (STOP_TO_FRIC.TryGetValue(stop, out var f) ? f : stop);
        });
    }

    /** Index of the stressed nucleus: the written accent, else penultimate (word ends vowel/n/s) or final. */
    private static int StressedNucleus(string word, IReadOnlyList<Seg> segs)
    {
        var nuclei = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) nuclei.Add(i);
        if (nuclei.Count == 0) return -1;
        foreach (var i in nuclei) if (segs[i].Accent) return i;
        if (nuclei.Count == 1) return nuclei[0];
        var w = word.ToLowerInvariant(); // n/s test must be case-insensitive (EXAMEN, CRISIS)
        var last = w.Length > 0 ? w[^1].ToString() : "";
        var penult = FINAL_VOWEL.IsMatch(w) || last == "n" || last == "s";
        return penult ? nuclei[^2] : nuclei[^1];
    }

    /** Phonemize a single Spanish word to canonical IPA (with a stress mark). */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        if (segs.Count == 0) return "";
        Spirantize(segs);
        var stress = StressedNucleus(word, segs);
        var outp = new System.Text.StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp.Append('ˈ');
            outp.Append(segs[i].Ph);
        }
        return outp.ToString();
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation; // ¿¡ openers are silent
    // A word / number / clause-punctuation token. Numbers use the Spanish convention: dot = thousands
    // separator (1.500), comma = decimal (3,14).
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.LATIN_RUN})|(\\d+(?:\\.\\d+)*(?:,\\d+)?)|([.!?…,;:])", "giu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-záéíóúüñ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private static readonly JsRe THOUSAND_DOTS = JsRegex.Compile("\\.", "g");

    /** A number token (with Spanish thousands-dots / decimal-comma) → spoken words. */
    private static string NumberTokenToWords(string tok)
    {
        var bits = tok.Split(',');
        var intRaw = bits[0];
        string? frac = bits.Length > 1 ? bits[1] : null;
        var words = Numbers.NumberToWords(Js.Number(THOUSAND_DOTS.Replace(intRaw, "")));
        if (frac is not null)
            words += $" {Manifest.MANIFEST.Numbers.DecimalConnector} "
                + string.Join(" ", Js.CodePoints(frac).Select(d => Numbers.NumberToWords(Js.Number(d))));
        return words;
    }

    private static readonly IReadOnlySet<string> FUNCTION_WORDS =
        new HashSet<string>(Manifest.MANIFEST.FunctionWords, StringComparer.Ordinal);

    /** Phonemize one running-text word, de-accenting unstressed function words (y → i, de → de). */
    private static string WordIpa(string word)
    {
        var ipa = PhonemizeWord(word);
        return FUNCTION_WORDS.Contains(word.ToLowerInvariant()) ? Js.ReplaceFirst(ipa, "ˈ", "") : ipa;
    }

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "por" },
        Ampersand = "y",
        Percent = new[] { "por ciento" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euro", "euros" }, ["$"] = new[] { "dólar", "dólares" },
            ["£"] = new[] { "libra", "libras" }, ["¥"] = new[] { "yen", "yenes" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km/h"] = new[] { "kilómetro por hora", "kilómetros por hora" },
            ["m/s"] = new[] { "metro por segundo", "metros por segundo" },
            ["°c"] = new[] { "grado Celsius", "grados Celsius" },
            ["°f"] = new[] { "grado Fahrenheit", "grados Fahrenheit" },
            ["°"] = new[] { "grado", "grados" },
            ["m"] = new[] { "metro", "metros" },
            // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre — the one exception to the one-letter case rule.
            ["l"] = new[] { "litro", "litros" }, ["L"] = new[] { "litro", "litros" },
            ["ml"] = new[] { "mililitro", "mililitros" },
            ["g"] = new[] { "gramo", "gramos" }, ["t"] = new[] { "tonelada", "toneladas" },
            ["ha"] = new[] { "hectárea", "hectáreas" },
            ["kW"] = new[] { "kilovatio", "kilovatios" }, ["W"] = new[] { "vatio", "vatios" },
            ["Hz"] = new[] { "hercio", "hercios" },
            ["gb"] = new[] { "gigabyte", "gigabytes" }, ["mb"] = new[] { "megabyte", "megabytes" },
            ["km"] = new[] { "kilómetro", "kilómetros" }, ["cm"] = new[] { "centímetro", "centímetros" },
            ["mm"] = new[] { "milímetro", "milímetros" },
            ["kg"] = new[] { "kilogramo", "kilogramos" }, ["mg"] = new[] { "miligramo", "miligramos" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "cuadrado", "cuadrados" },
            Cubed = new[] { "cúbico", "cúbicos" },
        },
        BareExponent = new BareExponentDef
        {
            Squared = "{n} al cuadrado", Cubed = "{n} al cubo", Power = "{n} elevado a {e}", Negative = "menos",
        },
        Magnitudes = new[] { "millones", "millón" },
        MagnitudeConnective = "de", // cinco millones DE dólares
    });

    private readonly bool _americas;

    public SpanishPhonemizer(bool americas = false) => _americas = americas;

    public string Text(string input)
    {
        // ⚠ ORDER: text normalization → INITIALISMS → SYMBOLS last, since the time rule upstream has
        // already claimed the hour.
        var normalized = SYMBOLS(Normalize.NormalizeSpanishInitialisms(
            Normalize.NormalizeSpanish(input, new SpanishNormalizeOptions { Americas = _americas })));
        return SpirantizeAcrossWords(Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
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

    /** Build the Spanish phonemizer (no data files — the engine is fully rule-based). `americas` selects
     *  Latin-American usage in the normalization layer. es-419 passes it; `es` (Castilian) does not. */
    public static ILanguage CreateSpanish(bool americas = false) => new SpanishPhonemizer(americas);

    internal static void RegisterSelf()
    {
        Registry.Register("spanish", () => CreateSpanish());
        Registry.RegisterRomanPolicy("es", RomanOrdinals.ROMAN_POLICY);
    }
}
