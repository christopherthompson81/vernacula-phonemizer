/**
 * Native Urdu (ur) text phonemizer — canonical IPA.
 * Ported from src/languages/urdu/urdu.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Urdu;

public static class UrduPhonemizer
{
    private static UrduDef DEF => G2p.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private static readonly IReadOnlyDictionary<string, string> EASTERN_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["۰"] = "0", ["۱"] = "1", ["۲"] = "2", ["۳"] = "3", ["۴"] = "4",
        ["۵"] = "5", ["۶"] = "6", ["۷"] = "7", ["۸"] = "8", ["۹"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(EASTERN_DIGITS.Keys);
    private const string URDU_WORD = "ء-ٟٮ-ۓە-ۜ۞-ۿ";

    // Loaded LAZILY (registry.ts imports every rider eagerly; the TSV is only read on first Urdu use).
    private static Dictionary<string, string>? LEXICON;
    private static Dictionary<string, string> IpaLexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/urdu", "lexicon-ipa.tsv", optional: true);

    /**
     * The coverage lexicon's key set (covered skeletons), for the neural rider pre-pass to leave covered
     * words bare.
     */
    public static IReadOnlyDictionary<string, string> CoverageLexicon() => IpaLexicon();

    private static readonly JsRe EXPLICIT_MARK = JsRegex.Compile("̲", "gu");
    private static readonly JsRe N_BEFORE_LABIAL = JsRegex.Compile("n(?=[bp])", "gu");
    private static readonly JsRe N_BEFORE_VELAR = JsRegex.Compile("n(?=[kɡ])", "gu");

    /** Post-g2p canonicalisation (UNSTRESSED): turn raw g2p output into final canonical IPA. */
    public static string FinalizeUrduIpa(string ipa) =>
        N_BEFORE_VELAR.Replace(
            N_BEFORE_LABIAL.Replace(
                EXPLICIT_MARK.Replace(Schwa.DeleteMedialSchwa(ipa), ""), "m"), "ŋ");

    /** Lexicon-FREE core: g2p + finalize + weight stress. */
    public static string PhonemizeWordCore(string word)
    {
        var ipa = G2p.PhonemizeWord(word);
        if (string.IsNullOrEmpty(ipa)) return "";
        return WeightStress.ApplyWeightStress(FinalizeUrduIpa(ipa)).Normalize(System.Text.NormalizationForm.FormC);
    }

    /** One Urdu word → canonical IPA. If the writer supplied harakat, respect it (g2p reads the explicit
     *  vowels); else consult the IPA coverage lexicon (short-circuit straight to canonical IPA +
     *  weight-stress); else the lexicon-free default-schwa core. */
    public static string PhonemizeWord(string word)
    {
        if (!HarakatLexicon.HARAKAT.IsMatch(word))
        {
            if (IpaLexicon().TryGetValue(word.Normalize(System.Text.NormalizationForm.FormC), out var ipa)
                && ipa.Length > 0)
                return WeightStress.ApplyWeightStress(ipa).Normalize(System.Text.NormalizationForm.FormC);
        }
        return PhonemizeWordCore(word);
    }

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = DEF.SymbolTier.Percent,
        Currency = DEF.SymbolTier.Currency,
        Units = DEF.SymbolTier.Units,
        ExponentWords = DEF.SymbolTier.ExponentWords,
        Ampersand = DEF.SymbolTier.Ampersand,
        Multiply = DEF.SymbolTier.Multiply,
    });

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{URDU_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+(?:(?:(?<!(?<![{DIGIT_CLASS}])0),|\\.)[{DIGIT_CLASS}]+)?)|([۔؟،؛.?!,;:])",
        "gu");

    /** The Urdu-specific rewrites, built once against the manifest's numbers definition. */
    private static readonly Func<string, string> NormalizeUrdu = Normalize.MakeUrduNormalizer(G2p.DEF.Numbers);

    private static string ToAscii(string d) =>
        string.Concat(Js.CodePoints(d).Where(c => c != ",").Select(c => EASTERN_DIGITS.GetValueOrDefault(c, c)));

    private static string Number(string digits)
    {
        var split = ToAscii(digits).Split('.');
        var intPart = split[0];
        var frac = split.Length > 1 ? split[1] : null;
        var n = Js.Number(intPart);
        // ⚠ ABOVE 2^53 THE NUMBER IS NOT COMPOSED — the double has already lost its low digits, so the numeral
        // would be confidently wrong. The fallback is digit-at-a-time off the original STRING, which is what
        // the decimal tail below already does; it must never return "" or the number vanishes from the reading.
        var head = double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
            ? Core.Numbers.RenderNumber(n, DEF.Numbers, PhonemizeWordCore) // numbers bypass the content lexicon
            : Core.Numbers.SpellDigits(intPart, DEF.Numbers, PhonemizeWordCore);
        if (frac is null || frac == "") return head;
        var dot = DEF.Numbers.DecimalWord;
        var tail = Js.CodePoints(frac).Select(d => Core.Numbers.RenderNumber(Js.Number(d), DEF.Numbers, PhonemizeWordCore));
        return string.Join(" ", new[] { head, !string.IsNullOrEmpty(dot) ? PhonemizeWordCore(dot) : "" }
            .Concat(tail).Where(x => x != ""));
    }

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign = null) => _foreign = foreign;

        public string Text(string input)
        {
            return Clauses.AssembleClauses(SYMBOLS(NormalizeUrdu(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    sink.Emit(_foreign is not null ? _foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Urdu phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateUrdu(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf()
    {
        Registry.Register("urdu", () => CreateUrdu(Registry.ReadAsEnglish));
        // The neural rider's coverage-lexicon accessor — see RiderNeural's port note on why this registers
        // rather than being declared statically as the TypeScript does.
        RiderNeural.RegisterRider("ur", CoverageLexicon);
    }
}
