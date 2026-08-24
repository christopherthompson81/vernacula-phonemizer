/**
 * Native Kannada (kn) text phonemizer — canonical IPA.
 * Ported from src/languages/kannada/kannada.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kannada;

/** Read a Latin run with another language's engine — injected from the registry. */
public delegate string ForeignPhonemizer(string latin);

public sealed class KannadaPhonemizer : ILanguage
{
    private static KannadaManifest DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private const string KANNADA_WORD = "ಀ-೥೰-೿"; // Kannada block minus the digit range
    private static readonly IReadOnlyDictionary<string, string> KANNADA_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["೦"] = "0", ["೧"] = "1", ["೨"] = "2", ["೩"] = "3", ["೪"] = "4",
        ["೫"] = "5", ["೬"] = "6", ["೭"] = "7", ["೮"] = "8", ["೯"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(KANNADA_DIGITS.Keys);
    private const string VOWEL = "aeiouɾ";

    private static Func<string, string>? G2P;
    private static string G2p(string w) => (G2P ??= Abugida.MakeAbugidaG2P(DEF, PhonologyLoader.LoadSharedPhonology()))(w);

    private static readonly JsRe GEMINATE = JsRegex.Compile(
        "(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋɾr])\\1(?!͡)", "gu");
    private static readonly JsRe LENGTH_ASPIRATE = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe RETROFLEX_GEM = JsRegex.Compile("ɭl", "gu");
    private static readonly JsRe FIRST_VOWEL = JsRegex.Compile($"[{VOWEL}]", "u");
    private static readonly JsRe FINAL_ANUSVARA = JsRegex.Compile("ಂ$", "u");

    /** One Kannada word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var norm = FINAL_ANUSVARA.Replace(word.Normalize(NormalizationForm.FormC), "ಮ್");
        var x = G2p(norm);
        x = LENGTH_ASPIRATE.Replace(GEMINATE.Replace(x, "$1ː"), "$1ː");
        x = RETROFLEX_GEM.Replace(x, "ɭː"); // ಳ್ಳ → geminate retroflex [ɭː]
        var m = FIRST_VOWEL.Match(x);
        if (m.Success) x = x[..m.Index] + "ˈ" + x[m.Index..];
        return x.Normalize(NormalizationForm.FormC);
    }

    private static string ToAscii(string d) =>
        string.Concat(Js.CodePoints(d).Select(c => KANNADA_DIGITS.TryGetValue(c, out var a) ? a : c));

    /** Digits → IPA. */
    private static string Number(string digits)
    {
        var n = Js.Number(ToAscii(digits));
        // `n` is a JS `number` here as in the TS: past 2^53 the low digits are gone, so the composed numeral
        // would be wrong. Read digit-at-a-time instead, THROUGH THE SAME COMPOSER — the raw ASCII digits must
        // never leak into the IPA.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return string.Join(" ", Js.CodePoints(ToAscii(digits))
                .SelectMany(d => Numbers.NumberToWords(Js.Number(d)).Split(' '))
                .Select(PhonemizeWord));
        return string.Join(" ", Numbers.NumberToWords(n).Split(' ').Select(PhonemizeWord));
    }

    // The foreign arm is LATIN_RUN — ALL of Latin plus marks, not `[A-Za-z]+`, which ended the token at a
    // diacritic and left that letter to be read as an English letter name.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{KANNADA_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+)|([।॥.?!,;:])", "gu");

    private readonly ForeignPhonemizer? _foreign;

    public KannadaPhonemizer(ForeignPhonemizer? foreign = null) => _foreign = foreign;

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeKannada(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(_foreign is not null ? _foreign(m.Groups[2].Value) : "");
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
            else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[4].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Kannada phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateKannada(ForeignPhonemizer? foreign = null) => new KannadaPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("kannada", () => CreateKannada(latin => Registry.ReadAsEnglish(latin)));
}
