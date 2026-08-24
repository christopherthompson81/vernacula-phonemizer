/**
 * Native Odia / ଓଡ଼ିଆ (or) text phonemizer — canonical IPA. An Eastern Indo-Aryan abugida read by the
 * generic engine (Core/Abugida.cs); this file adds only geminate → length, ଳ୍ଳ → [ɭː] and initial stress.
 * Ported from src/languages/odia/odia.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Odia;

public sealed class OdiaDef : AbugidaDef
{
    public NumbersDef Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
}

/** Read a Latin run with another language's engine — injected from the registry. */
public delegate string ForeignPhonemizer(string latin);

public sealed class OdiaPhonemizer : ILanguage
{
    internal static readonly OdiaDef DEF = LoadManifest.Load<OdiaDef>("languages/odia", "odia.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private const string ODIA_WORD = "଀-୥୰-୷"; // Odia block EXCLUDING the digits ୦-୯ (matched by the digit branch)
    private static readonly IReadOnlyDictionary<string, string> ODIA_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["୦"] = "0", ["୧"] = "1", ["୨"] = "2", ["୩"] = "3", ["୪"] = "4",
        ["୫"] = "5", ["୬"] = "6", ["୭"] = "7", ["୮"] = "8", ["୯"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(ODIA_DIGITS.Keys);
    private const string VOWEL = "aeiouɔɾ";

    private static Func<string, string>? G2P;
    private static string G2p(string w) => (G2P ??= Abugida.MakeAbugidaG2P(DEF, PhonologyLoader.LoadSharedPhonology()))(w);

    private static readonly JsRe GEMINATE = JsRegex.Compile(
        "(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|n̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋwɾr])\\1(?!͡)", "gu");
    private static readonly JsRe LENGTH_ASPIRATE = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe RETROFLEX_GEM = JsRegex.Compile("ɭl", "gu");
    private static readonly JsRe FIRST_VOWEL = JsRegex.Compile($"[{VOWEL}]", "u");

    /** One Odia word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var norm = word.Normalize(NormalizationForm.FormC);
        var x = G2p(norm);
        x = LENGTH_ASPIRATE.Replace(GEMINATE.Replace(x, "$1ː"), "$1ː");
        x = RETROFLEX_GEM.Replace(x, "ɭː"); // ଳ୍ଳ → geminate retroflex [ɭː]
        var m = FIRST_VOWEL.Match(x);
        if (m.Success) x = x[..m.Index] + "ˈ" + x[m.Index..];
        return x.Normalize(NormalizationForm.FormC);
    }

    private static string ToAscii(string d) =>
        string.Concat(Js.CodePoints(d).Select(c => ODIA_DIGITS.TryGetValue(c, out var a) ? a : c));

    private static string Number(string digits)
    {
        var n = Js.Number(ToAscii(digits));
        // ⚠ ABOVE 2^53 THE NUMBER IS NOT COMPOSED — the double has already lost its low digits — but the
        // refusal must NOT return the raw digit string, which no g2p in this fleet reads. Spell it out
        // digit-at-a-time through this language's own number words instead.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return Numbers.SpellDigits(ToAscii(digits), DEF.Numbers, PhonemizeWord);
        return Numbers.RenderNumber(n, DEF.Numbers, PhonemizeWord);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        // ⚠ The foreign group is ALL OF LATIN, not `[A-Za-z]+`: an ASCII-only class ends the token at a
        // diacritic and the letter carrying it is read as an English LETTER NAME (`São Paulo`).
        $"([{ODIA_WORD}]+)|(\\p{{Script=Latin}}[\\p{{Script=Latin}}\\p{{M}}]*)|([{DIGIT_CLASS}]+)|([।॥.?!,;:])",
        "gu");

    private static readonly Func<string, string> NORMALIZE = Normalize.MakeOdiaNormalizer(DEF.Numbers);

    private readonly ForeignPhonemizer? _foreign;

    public OdiaPhonemizer(ForeignPhonemizer? foreign = null) => _foreign = foreign;

    public string Text(string input)
    {
        // ⚠ ORDER: native digits ୦-୯ are folded to ASCII FIRST, because every pattern in Normalize is written
        // against ASCII digits. `Number()` folds them again for the bare-numeral path, so no reading changes.
        return Clauses.AssembleClauses(NORMALIZE(Unicode.FoldNativeDigits(input)), TOKEN, (m, sink) =>
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

    /** Build the Odia phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateOdia(ForeignPhonemizer? foreign = null) => new OdiaPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("odia", () => CreateOdia(latin => Registry.ReadAsEnglish(latin)));
}
