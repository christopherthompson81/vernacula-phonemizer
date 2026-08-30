/**
 * Native Telugu (te) text phonemizer — canonical IPA.
 * Ported from src/languages/telugu/telugu.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Telugu;

public static class TeluguPhonemizer
{
    private static TeluguManifest DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private const string TELUGU_WORD = "ఀ-౯ౠ-ౣ";
    private static readonly IReadOnlyDictionary<string, string> TELUGU_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["౦"] = "0", ["౧"] = "1", ["౨"] = "2", ["౩"] = "3", ["౪"] = "4",
        ["౫"] = "5", ["౬"] = "6", ["౭"] = "7", ["౮"] = "8", ["౯"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(TELUGU_DIGITS.Keys);
    private const string VOWEL = "aeiouɾ"; // nucleus starts (for the geminate/stress scan; ɾ only in the ɾu vocalic-r nucleus)

    private static Func<string, string>? G2P;
    private static readonly object GATE = new();
    private static string G2p(string w)
    {
        lock (GATE) G2P ??= Abugida.MakeAbugidaG2P(DEF, PhonologyLoader.LoadSharedPhonology());
        return G2P(w);
    }

    private static readonly JsRe GEMINATE =
        JsRegex.Compile("(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t͡s|d͡z|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦʋɾr])\\1(?!͡)", "gu");
    private static readonly JsRe FINAL_ANUSVARA = JsRegex.Compile("ం$", "u");
    private static readonly JsRe ASPIRATE_AFTER_LENGTH = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe RETROFLEX_LL = JsRegex.Compile("ɭl", "gu");
    private static readonly JsRe FIRST_VOWEL = JsRegex.Compile($"[{VOWEL}]", "u");

    /** One Telugu word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var norm = JsRegex.Replace(Js.Normalize(word, System.Text.NormalizationForm.FormC), FINAL_ANUSVARA, _ => "మ్");
        var x = G2p(norm);
        x = JsRegex.Replace(x, GEMINATE, m => m.Groups[1].Value + "ː");
        x = JsRegex.Replace(x, ASPIRATE_AFTER_LENGTH, m => m.Groups[1].Value + "ː");
        x = JsRegex.Replace(x, RETROFLEX_LL, _ => "ɭː"); // ళ్ల → geminate retroflex [ɭː] (కోళ్లు→koːɭːu)
        var m2 = FIRST_VOWEL.Match(x);
        if (m2.Success) x = x[..m2.Index] + "ˈ" + x[m2.Index..];
        return x.Normalize(System.Text.NormalizationForm.FormC);
    }

    private static string ToAscii(string d) =>
        string.Concat(Js.CodePoints(d).Select(c => TELUGU_DIGITS.GetValueOrDefault(c) ?? c));

    /** Digits → IPA. */
    private static string Number(string digits)
    {
        var n = Js.Number(ToAscii(digits));
        // ⚠ Mirrors JS `Number.isSafeInteger`: above 2^53 the double has already lost the low digits, so the
        // numeral is read digit-at-a-time THROUGH THE SAME COMPOSER rather than composed as a quantity.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return string.Join(" ", Js.CodePoints(ToAscii(digits))
                .SelectMany(d => TeluguNumbersComposer.NumberToWords(Js.Number(d)).Split(' '))
                .Select(PhonemizeWord));
        return string.Join(" ", TeluguNumbersComposer.NumberToWords(n).Split(' ').Select(PhonemizeWord));
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{TELUGU_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+)|([।॥.?!,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign) => _foreign = foreign;

        public string Text(string input) =>
            Clauses.AssembleClauses(Normalize.NormalizeTelugu(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(_foreign is not null ? _foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Telugu phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateTelugu(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("telugu", () => CreateTelugu(Registry.ReadAsEnglish));
}
